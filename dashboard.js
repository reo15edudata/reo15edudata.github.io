const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const PAGE_SIZE = 25;
let studentRows = [];
let teacherRows = [];
let locationRows = [];
let currentSchools = [];
let currentPage = 1;
let genderChart;
let schoolMap;
let mapLayer;
let multiFilters = {};

async function fetchAllPages(dbKey, sheetName) {
  return EDU15DataClient.fetchAllPages(GAS_WEB_APP_URL, dbKey, sheetName);
}

window.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  try {
    [studentRows, teacherRows, locationRows] = await Promise.all([
      fetchAllPages("DB_1", "Student_Count"),
      fetchAllPages("DB_1", "Teacher_Count"),
      fetchAllPages("DB_1", "School_Location")
    ]);
    populateFilters();
    initMap();
    renderDashboard(getFilters());
    document.getElementById("filterForm").addEventListener("submit", event => {
      event.preventDefault();
      currentPage = 1;
      renderDashboard(getFilters());
    });
    document.getElementById("filterForm").addEventListener("reset", () => {
      setTimeout(() => {
        Object.values(multiFilters).forEach(control => control.clear());
        currentPage = 1;
        renderDashboard(getFilters());
      }, 0);
    });
    document.getElementById("prevPage").addEventListener("click", () => {
      if (currentPage > 1) { currentPage--; renderSchoolTable(); }
    });
    document.getElementById("nextPage").addEventListener("click", () => {
      if (currentPage * PAGE_SIZE < currentSchools.length) { currentPage++; renderSchoolTable(); }
    });
    const jumpToPage = () => {
      const pages = Math.max(1, Math.ceil(currentSchools.length / PAGE_SIZE));
      const requested = Number.parseInt(document.getElementById("pageJump").value, 10);
      if (!Number.isFinite(requested)) return;
      currentPage = Math.min(pages, Math.max(1, requested));
      renderSchoolTable();
    };
    document.getElementById("goToPage").addEventListener("click", jumpToPage);
    document.getElementById("pageJump").addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        jumpToPage();
      }
    });
    document.getElementById("schoolSort").addEventListener("change", () => {
      currentPage = 1;
      renderSchoolTable();
    });
  } catch (error) {
    console.error(error);
    document.getElementById("dataTableBody").innerHTML = `<tr><td colspan="5" class="px-5 py-10 text-center text-rose-600">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
  } finally {
    window.hidePageLoader?.();
  }
}

function populateFilters() {
  const unique = (field) => [...new Set(studentRows.map(row => String(row[field] ?? "").trim()).filter(Boolean))];
  const uniqueLocations = (field) => [...new Set(locationRows.map(row => String(row[field] ?? "").trim()).filter(Boolean))];
  const years = unique("ACAD_YEAR").sort((a, b) => Number(b) - Number(a));
  const yearSelect = document.getElementById("filterYear");
  yearSelect.innerHTML = "";
  years.forEach(value => yearSelect.add(new Option(value, value)));
  multiFilters = {
    province: EDU15MultiSelect.create(document.getElementById("filterProvince"), unique("PROV_NAME").sort(), "ทุกจังหวัด"),
    agency: EDU15MultiSelect.create(document.getElementById("filterAgency"), unique("DEPARTMENT_NAME").sort(), "ทุกสังกัด"),
    area: EDU15MultiSelect.create(document.getElementById("filterEduArea"), uniqueLocations("EDU_AREA_NAME").sort(), "ทุกเขตพื้นที่"),
    level: EDU15MultiSelect.create(document.getElementById("filterEduLevel"), unique("EDU_LEVEL").sort(), "ทุกระดับการศึกษา")
  };
  if (years.length) document.getElementById("filterYear").value = years[0];
}

function getFilters() {
  return {
    year: document.getElementById("filterYear").value,
    provinces: multiFilters.province.getValues(),
    agencies: multiFilters.agency.getValues(),
    areas: multiFilters.area.getValues(),
    levels: multiFilters.level.getValues(),
    school: document.getElementById("filterSchoolName").value.trim().toLowerCase()
  };
}

function matchesCommon(row, filters, allowedAreaCodes) {
  if (filters.year && String(row.ACAD_YEAR) !== filters.year) return false;
  if (filters.provinces.length && !filters.provinces.includes(String(row.PROV_NAME))) return false;
  if (filters.agencies.length && !filters.agencies.includes(String(row.DEPARTMENT_NAME))) return false;
  if (filters.areas.length && !allowedAreaCodes?.has(String(row.SCHOOL_CODE))) return false;
  if (filters.school && !String(row.SCHOOL_NAME || "").toLowerCase().includes(filters.school)) return false;
  return true;
}

function numberValue(value) {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function renderDashboard(filters) {
  const allowedAreaCodes = filters.areas.length
    ? new Set(
        locationRows
          .filter(row => filters.areas.includes(String(row.EDU_AREA_NAME)))
          .map(row => String(row.SCHOOL_CODE))
      )
    : null;
  const students = studentRows.filter(row => matchesCommon(row, filters, allowedAreaCodes) && (!filters.levels.length || filters.levels.includes(String(row.EDU_LEVEL))));
  const studentSchoolCodes = new Set(students.map(row => String(row.SCHOOL_CODE)));
  const teachers = teacherRows.filter(row => matchesCommon(row, filters, allowedAreaCodes) && (!filters.levels.length || studentSchoolCodes.has(String(row.SCHOOL_CODE))));
  const locations = locationRows.filter(row => {
    if (filters.provinces.length && !filters.provinces.includes(String(row.PROV_NAME))) return false;
    if (filters.agencies.length && !filters.agencies.includes(String(row.DEPARTMENT_NAME))) return false;
    if (filters.areas.length && !filters.areas.includes(String(row.EDU_AREA_NAME))) return false;
    if (filters.school && !String(row.SCHOOL_NAME || "").toLowerCase().includes(filters.school)) return false;
    return !filters.levels.length || studentSchoolCodes.has(String(row.SCHOOL_CODE));
  });

  renderStats(students, teachers);
  currentSchools = aggregateSchools(students, teachers);
  renderSchoolTable();
  renderGenderChart(students);
  renderMap(locations);
}

function renderStats(students, teachers) {
  const studentMale = students.reduce((sum, row) => sum + numberValue(row.STUDENT_MALE), 0);
  const studentFemale = students.reduce((sum, row) => sum + numberValue(row.STUDENT_FEMALE), 0);
  const teacherMale = teachers.reduce((sum, row) => sum + numberValue(row.TEACHER_MALE), 0);
  const teacherFemale = teachers.reduce((sum, row) => sum + numberValue(row.TEACHER_FEMALE), 0);
  const set = (id, value) => { document.getElementById(id).textContent = value.toLocaleString("th-TH"); };
  set("stat-total-students", studentMale + studentFemale);
  set("stat-male-students", studentMale);
  set("stat-female-students", studentFemale);
  set("stat-total-schools", new Set(students.map(row => String(row.SCHOOL_CODE))).size);
  set("stat-total-teachers", teacherMale + teacherFemale);
  set("stat-male-teachers", teacherMale);
  set("stat-female-teachers", teacherFemale);
}

function aggregateSchools(students, teachers) {
  const schools = new Map();
  const ensure = row => {
    const code = String(row.SCHOOL_CODE || row.SCHOOL_NAME || "");
    if (!schools.has(code)) schools.set(code, { code, name: row.SCHOOL_NAME || "ไม่ระบุชื่อ", agency: row.DEPARTMENT_NAME || "ไม่ระบุสังกัด", students: 0, teachers: 0 });
    return schools.get(code);
  };
  students.forEach(row => { ensure(row).students += numberValue(row.STUDENT_MALE) + numberValue(row.STUDENT_FEMALE); });
  teachers.forEach(row => { ensure(row).teachers += numberValue(row.TEACHER_MALE) + numberValue(row.TEACHER_FEMALE); });
  return [...schools.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
}

function renderSchoolTable() {
  const tbody = document.getElementById("dataTableBody");
  const [field, direction] = document.getElementById("schoolSort").value.split("-");
  const sortedSchools = [...currentSchools].sort((a, b) => {
    const comparison = field === "name"
      ? a.name.localeCompare(b.name, "th")
      : numberValue(a[field]) - numberValue(b[field]);
    return direction === "desc" ? -comparison : comparison;
  });
  const pages = Math.max(1, Math.ceil(currentSchools.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = sortedSchools.slice(start, start + PAGE_SIZE);
  tbody.innerHTML = rows.length ? rows.map((row, index) => `<tr class="border-t border-slate-100 hover:bg-slate-50"><td class="px-5 py-3 text-center text-slate-400">${(start + index + 1).toLocaleString("th-TH")}</td><td class="px-5 py-3 font-medium text-slate-700">${escapeHtml(row.name)}</td><td class="px-5 py-3 text-slate-500">${escapeHtml(row.agency)}</td><td class="px-5 py-3 text-right">${row.students.toLocaleString("th-TH")}</td><td class="px-5 py-3 text-right">${row.teachers.toLocaleString("th-TH")}</td></tr>`).join("") : '<tr><td colspan="5" class="px-5 py-10 text-center text-slate-400">ไม่พบข้อมูลตามเงื่อนไข</td></tr>';
  document.getElementById("schoolTableSummary").textContent = `พบ ${currentSchools.length.toLocaleString("th-TH")} โรงเรียน`;
  document.getElementById("pageInfo").textContent = `หน้า ${currentPage} จาก ${pages}`;
  const pageJump = document.getElementById("pageJump");
  pageJump.max = String(pages);
  pageJump.value = String(currentPage);
  document.getElementById("prevPage").disabled = currentPage <= 1;
  document.getElementById("nextPage").disabled = currentPage >= pages;
}

function renderGenderChart(students) {
  const male = students.reduce((sum, row) => sum + numberValue(row.STUDENT_MALE), 0);
  const female = students.reduce((sum, row) => sum + numberValue(row.STUDENT_FEMALE), 0);
  const parityIndex = male > 0 ? female / male : null;
  document.getElementById("genderEqualityValue").textContent =
    parityIndex === null ? "—" : parityIndex.toFixed(2);
  genderChart?.destroy();
  genderChart = new Chart(document.getElementById("genderChart"), {
    type: "bar",
    data: { labels: ["นักเรียนชาย", "นักเรียนหญิง"], datasets: [{ data: [male, female], backgroundColor: ["#3b82f6", "#ec4899"], borderRadius: 8 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: value => Number(value).toLocaleString("th-TH") } } } }
  });
}

function initMap() {
  schoolMap = L.map("schoolMap", { preferCanvas: true }).setView([18.4, 99.0], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(schoolMap);
  mapLayer = L.layerGroup().addTo(schoolMap);
}

function parseCoordinate(value) {
  const values = String(value || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!values || values.length < 2) return null;
  let [lat, lng] = values;
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

function renderMap(locations) {
  mapLayer.clearLayers();
  const bounds = [];
  let valid = 0;
  locations.forEach(row => {
    const coordinate = parseCoordinate(row.COORDI);
    if (!coordinate) return;
    valid++;
    bounds.push(coordinate);
    L.circleMarker(coordinate, { renderer: L.canvas(), radius: 5, color: "#0f766e", fillColor: "#14b8a6", fillOpacity: .75, weight: 1 })
      .bindPopup(`<strong>${escapeHtml(row.SCHOOL_NAME || "สถานศึกษา")}</strong><br>${escapeHtml(row.DEPARTMENT_NAME || "")}`)
      .addTo(mapLayer);
  });
  document.getElementById("mapSummary").textContent = `แสดงพิกัดที่ถูกต้อง ${valid.toLocaleString("th-TH")} แห่ง`;
  if (bounds.length) schoolMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
  setTimeout(() => schoolMap.invalidateSize(), 0);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}
