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
  } catch (error) {
    console.error(error);
    document.getElementById("dataTableBody").innerHTML = `<tr><td colspan="4" class="px-5 py-10 text-center text-rose-600">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
  } finally {
    window.hidePageLoader?.();
  }
}

function populateFilters() {
  const fill = (id, values) => {
    const select = document.getElementById(id);
    const first = select.options[0];
    select.innerHTML = "";
    select.append(first);
    values.forEach(value => select.add(new Option(value, value)));
  };
  const unique = (field) => [...new Set(studentRows.map(row => String(row[field] ?? "").trim()).filter(Boolean))];
  const uniqueLocations = (field) => [...new Set(locationRows.map(row => String(row[field] ?? "").trim()).filter(Boolean))];
  const years = unique("ACAD_YEAR").sort((a, b) => Number(b) - Number(a));
  fill("filterYear", years);
  fill("filterProvince", unique("PROV_NAME").sort());
  fill("filterAgency", unique("DEPARTMENT_NAME").sort());
  // Student_Count และ Teacher_Count ไม่มี EDU_AREA_NAME แล้ว
  // จึงใช้เขตพื้นที่จาก School_Location และเชื่อมด้วย SCHOOL_CODE
  fill("filterEduArea", uniqueLocations("EDU_AREA_NAME").sort());
  fill("filterEduLevel", unique("EDU_LEVEL").sort());
  if (years.length) document.getElementById("filterYear").value = years[0];
}

function getFilters() {
  return {
    year: document.getElementById("filterYear").value,
    province: document.getElementById("filterProvince").value,
    agency: document.getElementById("filterAgency").value,
    area: document.getElementById("filterEduArea").value,
    level: document.getElementById("filterEduLevel").value,
    school: document.getElementById("filterSchoolName").value.trim().toLowerCase()
  };
}

function matchesCommon(row, filters, allowedAreaCodes) {
  if (filters.year && String(row.ACAD_YEAR) !== filters.year) return false;
  if (filters.province && String(row.PROV_NAME) !== filters.province) return false;
  if (filters.agency && String(row.DEPARTMENT_NAME) !== filters.agency) return false;
  if (filters.area && !allowedAreaCodes?.has(String(row.SCHOOL_CODE))) return false;
  if (filters.school && !String(row.SCHOOL_NAME || "").toLowerCase().includes(filters.school)) return false;
  return true;
}

function numberValue(value) {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function renderDashboard(filters) {
  const allowedAreaCodes = filters.area
    ? new Set(
        locationRows
          .filter(row => String(row.EDU_AREA_NAME) === filters.area)
          .map(row => String(row.SCHOOL_CODE))
      )
    : null;
  const students = studentRows.filter(row => matchesCommon(row, filters, allowedAreaCodes) && (!filters.level || String(row.EDU_LEVEL) === filters.level));
  const studentSchoolCodes = new Set(students.map(row => String(row.SCHOOL_CODE)));
  const teachers = teacherRows.filter(row => matchesCommon(row, filters, allowedAreaCodes) && (!filters.level || studentSchoolCodes.has(String(row.SCHOOL_CODE))));
  const locations = locationRows.filter(row => {
    if (filters.province && String(row.PROV_NAME) !== filters.province) return false;
    if (filters.agency && String(row.DEPARTMENT_NAME) !== filters.agency) return false;
    if (filters.area && String(row.EDU_AREA_NAME) !== filters.area) return false;
    if (filters.school && !String(row.SCHOOL_NAME || "").toLowerCase().includes(filters.school)) return false;
    return !filters.level || studentSchoolCodes.has(String(row.SCHOOL_CODE));
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
  const pages = Math.max(1, Math.ceil(currentSchools.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = currentSchools.slice(start, start + PAGE_SIZE);
  tbody.innerHTML = rows.length ? rows.map(row => `<tr class="border-t border-slate-100 hover:bg-slate-50"><td class="px-5 py-3 font-medium text-slate-700">${escapeHtml(row.name)}</td><td class="px-5 py-3 text-slate-500">${escapeHtml(row.agency)}</td><td class="px-5 py-3 text-right">${row.students.toLocaleString("th-TH")}</td><td class="px-5 py-3 text-right">${row.teachers.toLocaleString("th-TH")}</td></tr>`).join("") : '<tr><td colspan="4" class="px-5 py-10 text-center text-slate-400">ไม่พบข้อมูลตามเงื่อนไข</td></tr>';
  document.getElementById("schoolTableSummary").textContent = `พบ ${currentSchools.length.toLocaleString("th-TH")} โรงเรียน`;
  document.getElementById("pageInfo").textContent = `หน้า ${currentPage} จาก ${pages}`;
  document.getElementById("prevPage").disabled = currentPage <= 1;
  document.getElementById("nextPage").disabled = currentPage >= pages;
}

function renderGenderChart(students) {
  const male = students.reduce((sum, row) => sum + numberValue(row.STUDENT_MALE), 0);
  const female = students.reduce((sum, row) => sum + numberValue(row.STUDENT_FEMALE), 0);
  const max = Math.max(male, female);
  const parity = max ? (Math.min(male, female) / max) * 100 : 0;
  document.getElementById("genderEqualityText").textContent = `ดัชนีความใกล้เคียงระหว่างเพศ ${parity.toFixed(1)}%`;
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
