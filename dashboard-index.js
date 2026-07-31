const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const SHEETS = {
  population: ["DB_2", "Population"], special: ["DB_2", "Special_Needs"],
  oosc: ["DB_2", "Out_of_School"], dropout: ["DB_2", "Dropout"],
  jobs: ["DB_2", "Get_a_Jobs"], studyYear: ["DB_2", "Study_YearAVG"],
  studyRatio: ["DB_2", "Ratio_StudyLevel"], students: ["DB_1", "Student_Count"],
  earlyDevelopment: ["DB_2", "5YearsOld_Fertile"],
  onet: ["DB_4", "ONET_Score"], nt: ["DB_4", "NT_AVGScore"], rt: ["DB_4", "RT_Score"]
};
const OPTIONAL_SHEETS = new Set(["earlyDevelopment"]);
const INDEX_SUMMARIES = {
  students: {
    groupBy: ["ACAD_YEAR", "DEPARTMENT_NAME", "EDU_LEVEL", "PROV_NAME"],
    metrics: ["STUDENT_MALE", "STUDENT_FEMALE"]
  },
  population: {
    groupBy: ["YEAR", "PROV_NAME", "AGE_GROUP", "GENDER"],
    metrics: ["POPU_COUNT"]
  },
  special: {
    groupBy: ["YEAR", "PROV_NAME", "SPECIAL_NEEDS", "TYPE_DIS"],
    metrics: ["STUDENT_COUNT"]
  },
  oosc: {
    groupBy: ["YEAR", "PROV_NAME", "OOSC_RESULT"],
    metrics: ["OOSC_COUNT"]
  },
  dropout: {
    groupBy: ["YEAR", "PROV_NAME", "DEPARTMENT_NAME", "EDU_LEVEL"],
    metrics: ["DROPOUT_COUNT"]
  },
  jobs: {
    groupBy: ["YEAR", "PROV_NAME", "DEPARTMENT_NAME", "EDU_LEVEL", "EMPLOY_STATUS"],
    metrics: ["STUDENT_COUNT"]
  },
  studyYear: {
    groupBy: ["YEAR", "PROV_NAME"],
    metrics: ["STUDY_YEARAVG"]
  },
  studyRatio: {
    groupBy: ["YEAR", "PROV_NAME", "EDU_LEVEL"],
    metrics: ["RATIO_STUDY"]
  },
  earlyDevelopment: {
    groupBy: ["YEAR", "PROV_NAME"],
    metrics: ["POPU_5YSO", "POPU_5YSO_CANFOLLOW", "YOUTH_FERTILE_COUNT", "YOUTH_FERTILE_RATIO"]
  }
};
const RETURNED_OOSC = new Set(["ศึกษาภายในประเทศ", "ศึกษาต่างประเทศ", "ไม่ตกหล่น-กำลังศึกษา", "อยู่ในการศึกษาทางเลือกตามมาตรา 12"]);
let data = {};
let provinceFilter;
let charts = {};
let currentJobRows = [];
let employmentColorMap = new Map();
let indexLoadVersion = 0;

window.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  try {
    data = Object.fromEntries(Object.keys(SHEETS).map(key => [key, []]));
    const metadataEntries = await Promise.all([
      ["students", "DB_1", "Student_Count", ["ACAD_YEAR", "PROV_NAME"]],
      ["population", "DB_2", "Population", ["YEAR", "PROV_NAME"]],
      ["special", "DB_2", "Special_Needs", ["YEAR", "PROV_NAME"]],
      ["oosc", "DB_2", "Out_of_School", ["YEAR", "PROV_NAME"]],
      ["dropout", "DB_2", "Dropout", ["YEAR", "PROV_NAME"]],
      ["jobs", "DB_2", "Get_a_Jobs", ["YEAR", "PROV_NAME"]],
      ["studyYear", "DB_2", "Study_YearAVG", ["YEAR", "PROV_NAME"]],
      ["studyRatio", "DB_2", "Ratio_StudyLevel", ["YEAR", "PROV_NAME"]],
      ["earlyDevelopment", "DB_2", "5YearsOld_Fertile", ["YEAR", "PROV_NAME"]],
      ["onet", "DB_4", "ONET_Score", ["YEAR"]],
      ["nt", "DB_4", "NT_AVGScore", ["YEAR"]],
      ["rt", "DB_4", "RT_Score", ["YEAR"]]
    ].map(async ([key, dbKey, sheetName, fields]) => {
      try {
        return [key, await EDU15DataClient.fetchMetadata(GAS_WEB_APP_URL, dbKey, sheetName, fields)];
      } catch (error) {
        if (!OPTIONAL_SHEETS.has(key)) throw error;
        console.warn(`Optional metadata ${sheetName} is not available yet`, error);
        return [key, {}];
      }
    }));
    populateFilters(Object.fromEntries(metadataEntries));
    await loadIndexData(getFilters());
    document.getElementById("filterForm").addEventListener("submit", async event => {
      event.preventDefault();
      await loadIndexData(getFilters());
    });
    document.getElementById("filterForm").addEventListener("reset", () => setTimeout(async () => {
      provinceFilter.clear();
      document.getElementById("filterYear").selectedIndex = 0;
      await loadIndexData(getFilters());
    }, 0));
    document.getElementById("employmentLevelFilter").addEventListener("change", renderEmploymentTable);
  } catch (error) {
    console.error(error);
    document.getElementById("dataReadiness").className = "mb-6 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700";
    document.getElementById("dataReadiness").textContent = `โหลดข้อมูลไม่สำเร็จ: ${error.message}`;
  } finally {
    window.hidePageLoader?.();
  }
}

function populateFilters(metadata) {
  const years = [...new Set(Object.values(metadata).flatMap(item => [
    ...(item.ACAD_YEAR || []),
    ...(item.YEAR || [])
  ]).map(String).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const yearSelect = document.getElementById("filterYear");
  years.forEach(year => yearSelect.add(new Option(year, year)));
  const provinces = [...new Set(Object.values(metadata)
    .flatMap(item => item.PROV_NAME || [])
    .map(String)
    .filter(Boolean))].sort();
  provinceFilter = EDU15MultiSelect.create(document.getElementById("filterProvince"), provinces, "ทุกจังหวัด");
}

async function fetchIndexDataset(key, filters) {
  const [dbKey, sheetName] = SHEETS[key];
  const serverFilters = {
    province: filters.provinces,
    ...(key === "studyYear" ? {} : { year: filters.year })
  };
  try {
    if (INDEX_SUMMARIES[key]) {
      return await EDU15DataClient.fetchSummary(
        GAS_WEB_APP_URL,
        dbKey,
        sheetName,
        { ...INDEX_SUMMARIES[key], filters: serverFilters }
      );
    }
    return await EDU15DataClient.fetchAllPages(
      GAS_WEB_APP_URL,
      dbKey,
      sheetName,
      { filters: serverFilters }
    );
  } catch (error) {
    if (!OPTIONAL_SHEETS.has(key)) throw error;
    console.warn(`Optional dataset ${sheetName} is not available yet`, error);
    return [];
  }
}

async function loadIndexData(filters) {
  const version = ++indexLoadVersion;
  window.cancelBackgroundTasks?.();
  window.showPageLoader?.("กำลังโหลดข้อมูลหลักของดัชนี", 0);
  document.getElementById("dataReadiness").className = "mb-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800";
  document.getElementById("dataReadiness").innerHTML = `<i class="fas fa-circle-info mr-2"></i>กำลังเตรียมข้อมูลปี ${filters.year} ${filters.provinces.length ? `· ${filters.provinces.length} จังหวัด` : "· ภาพรวมพื้นที่ ศธภ.15"}`;

  const store = async key => {
    const rows = await fetchIndexDataset(key, filters);
    if (version !== indexLoadVersion) return false;
    data[key] = rows;
    return true;
  };

  try {
    await Promise.all([store("students"), store("population")]);
    if (version !== indexLoadVersion) return;
    renderAccess({
      students: filteredDataset("students", filters),
      population: filteredDataset("population", filters),
      studyYear: [],
      studyRatio: []
    }, filters);
    document.getElementById("dataReadiness").innerHTML = `<i class="fas fa-circle-check mr-2"></i>ข้อมูลหลักปี ${filters.year} พร้อมใช้งาน · กำลังเตรียมตัวชี้วัดส่วนอื่นในเบื้องหลัง`;
    await window.hidePageLoader?.();

    const rerenderAccess = () => renderAccess({
      students: filteredDataset("students", filters),
      population: filteredDataset("population", filters),
      studyYear: filteredDataset("studyYear", filters),
      studyRatio: filteredDataset("studyRatio", filters)
    }, filters);
    const rerenderEquity = () => renderEquity({
      students: filteredDataset("students", filters),
      special: filteredDataset("special", filters),
      oosc: filteredDataset("oosc", filters)
    });
    const rerenderEfficiency = () => renderEfficiency({
      students: filteredDataset("students", filters),
      dropout: filteredDataset("dropout", filters)
    });
    const rerenderRelevancy = () => renderRelevancy({
      students: filteredDataset("students", filters),
      jobs: filteredDataset("jobs", filters)
    });
    const task = (key, label, renderer) => ({
      label,
      run: async () => {
        if (!await store(key) || version !== indexLoadVersion) return;
        renderer();
      }
    });

    window.runBackgroundTasks?.([
      task("studyYear", "แนวโน้มปีการศึกษาเฉลี่ย", rerenderAccess),
      task("studyRatio", "สัดส่วนระดับการศึกษา", rerenderAccess),
      task("special", "ผู้เรียนที่มีความต้องการพิเศษ", rerenderEquity),
      task("oosc", "เด็กนอกระบบการศึกษา", rerenderEquity),
      task("earlyDevelopment", "พัฒนาการเด็กปฐมวัย", () => renderQuality(filters, filteredDataset("earlyDevelopment", filters))),
      task("onet", "ผลการทดสอบ O-NET", () => renderQuality(filters, filteredDataset("earlyDevelopment", filters))),
      task("nt", "ผลการทดสอบ NT", () => renderQuality(filters, filteredDataset("earlyDevelopment", filters))),
      task("rt", "ผลการทดสอบ RT", () => renderQuality(filters, filteredDataset("earlyDevelopment", filters))),
      task("dropout", "ข้อมูลผู้เรียนออกกลางคัน", rerenderEfficiency),
      task("jobs", "ข้อมูลการมีงานทำ", rerenderRelevancy)
    ], { title: "กำลังเตรียมตัวชี้วัดเพิ่มเติม" });
  } catch (error) {
    console.error(error);
    if (version === indexLoadVersion) {
      document.getElementById("dataReadiness").className = "mb-6 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700";
      document.getElementById("dataReadiness").textContent = `โหลดข้อมูลไม่สำเร็จ: ${error.message}`;
      await window.hidePageLoader?.();
    }
  }
}

function getFilters() {
  return { year: document.getElementById("filterYear").value, provinces: provinceFilter.getValues() };
}

function filteredDataset(key, filters = getFilters(), yearField) {
  const field = yearField || (key === "students" ? "ACAD_YEAR" : "YEAR");
  let rows = data[key].filter(row => !filters.provinces.length || !row.PROV_NAME || filters.provinces.includes(String(row.PROV_NAME)));
  const year = Number(filters.year);
  return rows.filter(row => Number(row[field]) === year);
}

function n(value) {
  const parsed = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function totalStudents(rows) {
  return rows.reduce((sum, row) => sum + n(row.STUDENT_MALE) + n(row.STUDENT_FEMALE), 0);
}

function levelText(row) { return String(row.EDU_LEVEL || "").toLowerCase(); }
const LEVEL = {
  early: value => /อนุบาล|ปฐมวัย/.test(value),
  primary: value => /ประถม/.test(value),
  lower: value => /มัธยม.*(ปีที่\s*[1-3]|ตอนต้น)|ม\.?\s*[1-3]/.test(value),
  upper: value => /มัธยม.*(ปีที่\s*[4-6]|ตอนปลาย)|ม\.?\s*[4-6]|ปวช/.test(value),
  voc: value => /ปวช|ประกาศนียบัตรวิชาชีพ(?!(?:ชั้น|ขั้น)สูง)/.test(value),
  higherVoc: value => /ปวส|ประกาศนียบัตรวิชาชีพ(?:ชั้น|ขั้น)สูง/.test(value)
};

function normalizeEducationLevel(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

const ACCESS_LEVELS = Object.fromEntries(Object.entries({
  early: [
    "อนุบาล 1(หลักสูตร 3 ปีของ สช.)/อนุบาล 3 ขวบ",
    "อนุบาล 2(หลักสูตร 3 ปีของ สช.)/อนุบาล 1",
    "อนุบาล 3(หลักสูตร 3 ปีของ สช.)/อนุบาล 2",
    "เตรียมอนุบาล"
  ],
  primary: [
    "ประถมศึกษาปีที่ 1/เกรด 1",
    "ประถมศึกษาปีที่ 2/เกรด 2",
    "ประถมศึกษาปีที่ 3/เกรด 3",
    "ประถมศึกษาปีที่ 4/เกรด 4",
    "ประถมศึกษาปีที่ 5/เกรด 5",
    "ประถมศึกษาปีที่ 6/เกรด 6",
    "กศน.ประถมศึกษา",
    "กศน.ประถมศึกษา (ป.6)"
  ],
  lower: [
    "มัธยมศึกษาปีที่ 1 /เกรด 7/ นาฎศิลป์ชั้นที่ 1",
    "มัธยมศึกษาปีที่ 2 /เกรด 8/ นาฎศิลป์ชั้นที่ 2",
    "มัธยมศึกษาปีที่ 3 /เกรด 9/ นาฎศิลป์ชั้นที่ 3",
    "กศน.มัธยมศึกษาตอนต้น",
    "กศน.มัธยมศึกษาตอนต้น (ม.3)"
  ],
  upper: [
    "มัธยมศึกษาปีที่ 4/เกรด10",
    "มัธยมศึกษาปีที่ 5/เกรด11/เตรียมทหารชั้นปีที่ 1",
    "มัธยมศึกษาปีที่ 6/เกรด12/เตรียมทหารชั้นปีที่ 2",
    "ประกาศนียบัตรวิชาชีพปีที่ 1",
    "ประกาศนียบัตรวิชาชีพปีที่ 2",
    "ประกาศนียบัตรวิชาชีพปีที่ 3",
    "กศน.มัธยมศึกษาตอนปลาย",
    "มัธยมศึกษาปีที่ 6/เกรด12/เตรียมทหารชั้นปีที่ 2/กศน.มัธยมศึกษา",
    "มัธยมศึกษาปีที่ 4/เกรด10/เตรียมทหารชั้นปีที่ 1",
    "มัธยมศึกษาปีที่ 5/เกรด11/เตรียมทหารชั้นปีที่ 2",
    "มัธยมศึกษาปีที่ 6/เกรด12/เตรียมทหารชั้นปีที่ 3",
    "กศน.มัธยมศึกษาตอนปลาย (ม.6)"
  ],
  higherVoc: [
    "ประกาศนียบัตรวิชาชีพชั้นสูงชั้นปีที่ 1",
    "ประกาศนียบัตรวิชาชีพชั้นสูงชั้นปีที่ 2",
    "ประกาศนียบัตรวิชาชีพชั้นสูงชั้นปีที่ 1/ ปวท. ชั้นปีที่ 1 - ปกศ. สูง",
    "ประกาศนียบัตรวิชาชีพชั้นสูงชั้นปีที่ 2/ ปวท. ชั้นปีที่ 1 - ปกศ. สูง"
  ]
}).map(([group, values]) => [group, new Set(values.map(normalizeEducationLevel))]));

const VOCATIONAL_DEPARTMENT = "สำนักงานคณะกรรมการการอาชีวศึกษา";
const EFFICIENCY_LEVELS = {
  compulsoryStudents: new Set([
    "ประถมศึกษาปีที่ 1/เกรด 1",
    "ประถมศึกษาปีที่ 2/เกรด 2",
    "ประถมศึกษาปีที่ 3/เกรด 3",
    "ประถมศึกษาปีที่ 4/เกรด 4",
    "ประถมศึกษาปีที่ 5/เกรด 5",
    "ประถมศึกษาปีที่ 6/เกรด 6",
    "มัธยมศึกษาปีที่ 1 /เกรด 7/ นาฎศิลป์ชั้นที่ 1",
    "มัธยมศึกษาปีที่ 2 /เกรด 8/ นาฎศิลป์ชั้นที่ 2",
    "มัธยมศึกษาปีที่ 3 /เกรด 9/ นาฎศิลป์ชั้นที่ 3"
  ].map(normalizeEducationLevel)),
  compulsoryDropout: new Set(["ประถมศึกษา", "มัธยมศึกษาตอนต้น"].map(normalizeEducationLevel)),
  vocationalStudents: new Set([
    "ประกาศนียบัตรวิชาชีพปีที่ 1",
    "ประกาศนียบัตรวิชาชีพปีที่ 2",
    "ประกาศนียบัตรวิชาชีพปีที่ 3"
  ].map(normalizeEducationLevel)),
  vocationalDropout: new Set(["มัธยมศึกษาตอนปลาย (สามัญ + อาชีวะ)"].map(normalizeEducationLevel)),
  higherVocStudents: new Set(ACCESS_LEVELS.higherVoc),
  higherVocDropout: new Set(["ประกาศนียบัตรวิชาชีพชั้นสูง"].map(normalizeEducationLevel))
};

function ageGroup(value, from, to) {
  const numbers = String(value).match(/\d+/g)?.map(Number) || [];
  return numbers.includes(from) && numbers.includes(to);
}

function render() {
  const filters = getFilters();
  const rows = Object.fromEntries(Object.keys(data).map(key => [key, filteredDataset(key, filters)]));
  document.getElementById("dataReadiness").innerHTML = `<i class="fas fa-circle-info mr-2"></i>กำลังแสดงปี ${filters.year} ${filters.provinces.length ? `· ${filters.provinces.length} จังหวัด` : "· ภาพรวมพื้นที่ ศธภ.15"} · ส่วนที่ยังไม่มีข้อมูลจะแสดง “รอข้อมูลอัปเดต”`;
  renderAccess(rows, filters);
  renderEquity(rows);
  renderQuality(filters, rows.earlyDevelopment);
  renderEfficiency(rows);
  renderRelevancy(rows);
}

function ratioCard(id, numerator, denominator, labels) {
  document.getElementById(id).textContent = denominator ? `${(numerator / denominator * 100).toFixed(2)}%` : "รอข้อมูลอัปเดต";
  const note = document.getElementById(`${id}-note`);
  if (note) note.textContent = denominator ? `${labels[0]} ${numerator.toLocaleString("th-TH")} / ${labels[1]} ${denominator.toLocaleString("th-TH")}` : "";
}

function renderAccess(rows, filters) {
  [["access-early", ACCESS_LEVELS.early, [3,5]], ["access-primary", ACCESS_LEVELS.primary, [6,11]], ["access-lower", ACCESS_LEVELS.lower, [12,14]], ["access-upper", ACCESS_LEVELS.upper, [15,17]], ["access-higher-voc", ACCESS_LEVELS.higherVoc, [18,19]]].forEach(([id, allowedLevels, ages]) => {
    const studentRows = rows.students.filter(row => allowedLevels.has(normalizeEducationLevel(row.EDU_LEVEL)));
    const populationRows = rows.population.filter(row => ageGroup(row.AGE_GROUP, ages[0], ages[1]));
    const students = totalStudents(studentRows);
    const population = populationRows.reduce((sum, row) => sum + n(row.POPU_COUNT), 0);
    ratioCard(id, students, studentRows.length && populationRows.length ? population : 0, ["ผู้เรียน", "ประชากร"]);
  });

  const studyRows = rows.studyYear;
  const provinceValues = new Map();
  studyRows.forEach(row => provinceValues.set(String(row.PROV_NAME), n(row.STUDY_YEARAVG)));
  const values = [...provinceValues.values()];
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  document.getElementById("studyYearAverage").textContent = average === null ? "รอข้อมูลอัปเดต" : `${average.toFixed(2)} ปี`;
  document.getElementById("studyYearAverageNote").textContent = values.length
    ? `ค่าเฉลี่ย ${values.length} จังหวัด${filters.provinces.length ? "ที่เลือก" : ""}`
    : "";
  const provinceCardStyles = [
    ["bg-blue-50", "text-blue-700"],
    ["bg-teal-50", "text-teal-700"],
    ["bg-amber-50", "text-amber-700"],
    ["bg-violet-50", "text-violet-700"]
  ];
  document.getElementById("studyYearProvinceCards").innerHTML = provinceValues.size
    ? [...provinceValues].sort((a,b) => a[0].localeCompare(b[0], "th")).map(([province, value], index) => {
        const [background, text] = provinceCardStyles[index % provinceCardStyles.length];
        return `<div class="rounded-lg ${background} p-2"><span class="block text-[11px] text-slate-500">${escapeHtml(province)}</span><strong class="${text}">${value.toFixed(2)} ปี</strong></div>`;
      }).join("")
    : '<p class="col-span-2 py-2 text-xs text-slate-400">รอข้อมูลอัปเดต</p>';
  renderStudyCharts(filters);
}

function renderStudyCharts(filters) {
  let trendRows = data.studyYear.filter(row => !filters.provinces.length || filters.provinces.includes(String(row.PROV_NAME)));
  const years = [...new Set(trendRows.map(row => String(row.YEAR)))].sort((a,b) => Number(a)-Number(b));
  const provinces = [...new Set(trendRows.map(row => String(row.PROV_NAME)))].sort();
  const colors = ["#0d9488","#2563eb","#f59e0b","#e11d48","#7c3aed"];
  replaceChart("studyYear", "studyYearChart", {
    type: "line",
    data: { labels: years, datasets: provinces.map((province,index) => ({ label: province, data: years.map(year => n(trendRows.find(row => String(row.YEAR) === year && String(row.PROV_NAME) === province)?.STUDY_YEARAVG) || null), borderColor: colors[index % colors.length], backgroundColor: colors[index % colors.length], tension: .3, spanGaps: true })) },
    options: baseChartOptions({ yTitle: "ปี" })
  });
  document.getElementById("studyYearSummary").textContent = `${years.length} ปีข้อมูล · ${provinces.length} จังหวัด`;
  const selectedYear = String(filters.year);
  const currentProvinceValues = provinces.map((province,index) => ({
    province,
    value: trendRows.find(row => String(row.YEAR) === selectedYear && String(row.PROV_NAME) === province)?.STUDY_YEARAVG,
    color: colors[index % colors.length]
  })).filter(item => item.value !== undefined && item.value !== null && item.value !== "");
  document.getElementById("studyYearTrendCards").innerHTML = currentProvinceValues.length
    ? currentProvinceValues.map(item => `<div class="rounded-lg border bg-slate-50 p-2.5" style="border-color:${item.color}55"><span class="block truncate text-[11px] text-slate-500">${escapeHtml(item.province)}</span><strong class="mt-1 block text-base" style="color:${item.color}">${n(item.value).toFixed(2)} ปี</strong><span class="text-[10px] text-slate-400">ปี ${escapeHtml(selectedYear)}</span></div>`).join("")
    : '<p class="col-span-full py-2 text-xs text-slate-400">รอข้อมูลอัปเดตสำหรับปีที่เลือก</p>';

  const ratioRows = filteredDataset("studyRatio", filters);
  const grouped = groupSum(ratioRows, "EDU_LEVEL", "RATIO_STUDY");
  const ratioColors = ["#2563eb","#14b8a6","#f59e0b","#ec4899","#8b5cf6","#f97316","#06b6d4","#84cc16","#e11d48","#64748b"];
  replaceChart("studyRatio", "studyRatioChart", {
    type: "bar", data: { labels: grouped.map(item => item.label), datasets: [{ data: grouped.map(item => item.value / Math.max(1, new Set(ratioRows.map(row => row.PROV_NAME)).size)), backgroundColor: grouped.map((_, index) => ratioColors[index % ratioColors.length]), borderRadius: 6 }] },
    options: { ...baseChartOptions({ legend: false, yTitle: "ร้อยละ" }), indexAxis: "y" }
  });
  document.getElementById("studyRatioSummary").textContent = ratioRows.length ? `${ratioRows.length} รายการตามตัวกรอง` : "รอข้อมูลอัปเดต";
}

function renderEquity(rows) {
  const students = totalStudents(rows.students);
  const special = rows.special.reduce((sum,row) => sum + n(row.STUDENT_COUNT), 0);
  ratioCard("equity-special", special, rows.special.length && rows.students.length ? students : 0, ["ผู้เรียนกลุ่มพิเศษ", "ผู้เรียนทั้งหมด"]);
  document.getElementById("specialBreakdown").innerHTML = groupSum(rows.special, "SPECIAL_NEEDS", "STUDENT_COUNT").slice(0,4).map(item => `<div class="subject-row"><span>${escapeHtml(item.label)}</span><strong>${item.value.toLocaleString("th-TH")}</strong></div>`).join("");
  const disabilityTypes = new Map();
  const disadvantageTypes = new Map();
  rows.special.forEach(row => {
    const group = String(row.SPECIAL_NEEDS || "ไม่ระบุ");
    const type = String(row.TYPE_DIS || "ไม่ระบุ");
    const target = /พิการ/.test(group) ? disabilityTypes : disadvantageTypes;
    target.set(type, (target.get(type) || 0) + n(row.STUDENT_COUNT));
  });
  const renderSpecialTypes = (id, values) => {
    document.getElementById(id).innerHTML = values.size
      ? [...values].sort((a,b) => b[1]-a[1]).map(([type,value]) => `<tr class="border-t"><td class="p-2">${escapeHtml(type)}</td><td class="p-2 text-right">${value.toLocaleString("th-TH")}</td></tr>`).join("")
      : '<tr><td colspan="2" class="p-6 text-center text-slate-400">รอข้อมูลอัปเดต</td></tr>';
  };
  renderSpecialTypes("disabilityTypeTable", disabilityTypes);
  renderSpecialTypes("disadvantageTypeTable", disadvantageTypes);
  replaceChart("special", "specialNeedsChart", doughnutConfig(["ผู้เรียนที่มีความต้องการพิเศษ","ผู้เรียนทั่วไป"], [special, Math.max(0, students-special)], ["#ec4899","#e2e8f0"]));

  const total = rows.oosc.reduce((sum,row) => sum + n(row.OOSC_COUNT), 0);
  const untracked = rows.oosc.filter(row => String(row.OOSC_RESULT).trim() === "ยังไม่ได้ติดตาม").reduce((sum,row) => sum+n(row.OOSC_COUNT),0);
  const tracked = Math.max(0, total-untracked);
  const returned = rows.oosc.filter(row => RETURNED_OOSC.has(String(row.OOSC_RESULT).trim())).reduce((sum,row) => sum+n(row.OOSC_COUNT),0);
  const notFound = rows.oosc.filter(row => /หาบ้านไม่พบ-ไม่มีข้อมูล-ไม่ยินดีให้ข้อมูล-ไม่พบตัว/.test(String(row.OOSC_RESULT))).reduce((sum,row) => sum+n(row.OOSC_COUNT),0);
  document.getElementById("equity-returned").textContent = tracked ? `${(returned/tracked*100).toFixed(2)}%` : "รอข้อมูลอัปเดต";
  document.getElementById("oosc-followup-rate").textContent = total ? `${(tracked/total*100).toFixed(2)}%` : "—";
  document.getElementById("oosc-found-rate").textContent = tracked ? `${((tracked-notFound)/tracked*100).toFixed(2)}%` : "—";
  replaceChart("ooscFollowup", "ooscFollowupChart", doughnutConfig(["ติดตามแล้ว","ยังไม่ได้ติดตาม"], [tracked,untracked], ["#3b82f6","#cbd5e1"]));
  replaceChart("ooscIdentity", "ooscIdentityChart", doughnutConfig(["พบตัวตน","ไม่พบตัวตน"], [Math.max(0,tracked-notFound),notFound], ["#14b8a6","#fb7185"]));
  const causes = groupSum(rows.oosc.filter(row => String(row.OOSC_RESULT).trim() !== "ยังไม่ได้ติดตาม"), "OOSC_RESULT", "OOSC_COUNT");
  document.getElementById("ooscCauseTable").innerHTML = causes.map(item => `<tr class="border-t"><td class="p-2">${escapeHtml(item.label)}</td><td class="p-2 text-right">${item.value.toLocaleString("th-TH")}</td><td class="p-2 text-right">${tracked ? (item.value/tracked*100).toFixed(2) : "0.00"}%</td></tr>`).join("");
}

function scoreScope(filters) {
  return filters.provinces.length === 1 ? filters.provinces[0] : "ระดับ ศธภ.15";
}

function scoreRows(key, filters, scope) {
  let rows = data[key].filter(row => String(row.TEST_LEVEL).trim() === scope);
  const year = Number(filters.year);
  return rows.filter(row => Number(row.YEAR) === year);
}

function renderQuality(filters, earlyDevelopmentRows) {
  renderEarlyDevelopment(earlyDevelopmentRows);
  const scope = scoreScope(filters);
  const rtArea = scoreRows("rt", filters, scope), ntArea = scoreRows("nt", filters, scope), onetArea = scoreRows("onet", filters, scope);
  const rtNation = scoreRows("rt", filters, "ระดับประเทศ"), ntNation = scoreRows("nt", filters, "ระดับประเทศ"), onetNation = scoreRows("onet", filters, "ระดับประเทศ");
  renderAverageTestCard("quality-rt", rtArea, "รวม 2 ด้าน");
  renderAverageTestCard("quality-nt", ntArea, "รวม 2 ด้าน");
  renderOnetCard("quality-onet-m3", onetArea.filter(row => /มัธยมศึกษาปีที่\s*3|ม\.?\s*3/.test(String(row.EDU_LEVEL))));
  renderOnetCard("quality-onet-m6", onetArea.filter(row => /มัธยมศึกษาปีที่\s*6|ม\.?\s*6/.test(String(row.EDU_LEVEL))));

  const comparison = [];
  addComparison(comparison, "RT", rtArea, rtNation);
  addComparison(comparison, "NT", ntArea, ntNation);
  const areaM3 = onetArea.filter(row => /มัธยมศึกษาปีที่\s*3|ม\.?\s*3/.test(String(row.EDU_LEVEL)));
  const nationM3 = onetNation.filter(row => /มัธยมศึกษาปีที่\s*3|ม\.?\s*3/.test(String(row.EDU_LEVEL)));
  addComparison(comparison, "O-NET ม.3", areaM3, nationM3);
  replaceChart("quality", "qualityComparisonChart", {
    type: "bar", data: { labels: comparison.map(item => item.label), datasets: [{ label: scope, data: comparison.map(item => item.area), backgroundColor:comparison.map(item=>item.color), borderRadius:5 },{ label:"ระดับประเทศ", data:comparison.map(item=>item.nation), backgroundColor:comparison.map(item=>`${item.color}55`), borderColor:comparison.map(item=>item.color), borderWidth:1, borderRadius:5 }] },
    options: comparisonChartOptions("คะแนนเฉลี่ย", scope)
  });
}

function renderEarlyDevelopment(rows) {
  const value = document.getElementById("quality-early-development");
  const note = document.getElementById("quality-early-development-note");
  const summary = summarizeEarlyDevelopment(rows);

  if (summary.rate === null) {
    value.textContent = "รอข้อมูลอัปเดต";
    note.textContent = rows.length
      ? "ไม่พบคอลัมน์ร้อยละ หรือคู่ข้อมูล A/B ที่ใช้คำนวณ"
      : "";
    return;
  }

  value.textContent = `${summary.rate.toFixed(2)}%`;
  note.textContent = summary.mode === "ratio"
    ? `เด็กพัฒนาการสมวัย ${summary.numerator.toLocaleString("th-TH")} / เด็กที่ได้รับการคัดกรอง ${summary.denominator.toLocaleString("th-TH")} คน`
    : `ค่าเฉลี่ยจากข้อมูล ${summary.count.toLocaleString("th-TH")} รายการ`;
}

function summarizeEarlyDevelopment(rows) {
  if (!rows.length) return { rate: null };
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const normalized = new Map(keys.map(key => [
    String(key).trim().toUpperCase().replace(/[\s%-]+/g, "_"),
    key
  ]));
  const findExact = candidates => candidates
    .map(candidate => normalized.get(candidate))
    .find(Boolean);

  const numeratorField = findExact([
    "YOUTH_FERTILE_COUNT", "A", "FERTILE_COUNT", "DEVELOPED_COUNT", "CHILD_DEVELOPED_COUNT",
    "CHILD_PASS_COUNT", "PASS_COUNT", "NORMAL_COUNT"
  ]);
  const denominatorField = findExact([
    "POPU_5YSO_CANFOLLOW", "B", "SCREENED_COUNT", "CHILD_SCREENED_COUNT", "TOTAL_COUNT",
    "CHILD_TOTAL", "TARGET_COUNT"
  ]);

  if (numeratorField && denominatorField) {
    const numerator = rows.reduce((sum, row) => sum + n(row[numeratorField]), 0);
    const denominator = rows.reduce((sum, row) => sum + n(row[denominatorField]), 0);
    return {
      rate: denominator ? numerator / denominator * 100 : null,
      numerator,
      denominator,
      mode: "ratio"
    };
  }

  const rateField = findExact([
    "PERCENT", "PERCENTAGE", "RESULT", "PERFORMANCE", "RATE", "RATIO",
    "YOUTH_FERTILE_RATIO", "FERTILE_PERCENT", "FERTILE_RATE", "DEVELOPMENT_PERCENT",
    "DEVELOPMENT_RATE", "VALUE", "ร้อยละ", "ผลงาน"
  ]) || keys.find(key => /PERCENT|PERCENTAGE|RATE|RATIO|RESULT|PERFORMANCE|ร้อยละ|ผลงาน/i.test(key));
  const rates = rateField
    ? rows.map(row => valueOrNull(row[rateField])).filter(value => value !== null)
    : [];
  if (!rates.length) return { rate: null };

  const decimalScale = rates.every(rate => rate >= 0 && rate <= 1) ? 100 : 1;
  return {
    rate: rates.reduce((sum, rate) => sum + rate, 0) / rates.length * decimalScale,
    count: rates.length,
    mode: "average"
  };
}

function valueOrNull(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function renderAverageTestCard(id, rows, combinedLabel) {
  const combined = rows.find(row => String(row.TEST_SUBJECT).includes(combinedLabel));
  document.getElementById(id).textContent = combined ? n(combined.AVG_SCORE).toFixed(2) : "รอข้อมูลอัปเดต";
  const subjects = rows.filter(row => !String(row.TEST_SUBJECT).includes(combinedLabel));
  document.getElementById(`${id}-subjects`).innerHTML = subjects.length ? subjects.map(row => `<div class="subject-row"><span>${escapeHtml(row.TEST_SUBJECT)}</span><strong>${n(row.AVG_SCORE).toFixed(2)}</strong></div>`).join("") : '<p class="text-slate-400">รอข้อมูลอัปเดต</p>';
}

function renderOnetCard(id, rows) {
  document.getElementById(`${id}-subjects`).innerHTML = rows.length ? rows.map(row => `<div class="subject-row"><span>${escapeHtml(row.TEST_SUBJECT)}</span><strong>${n(row.STUDENT_TEST_COUNT) ? (n(row.STUDENT_MOREHALFTEST_COUNT)/n(row.STUDENT_TEST_COUNT)*100).toFixed(2) : "0.00"}%</strong></div>`).join("") : '<p class="text-slate-400">รอข้อมูลอัปเดต</p>';
}

function addComparison(target, prefix, areaRows, nationRows) {
  areaRows.filter(row => !String(row.TEST_SUBJECT).includes("รวม")).forEach(row => {
    const nation = nationRows.find(item => String(item.TEST_SUBJECT) === String(row.TEST_SUBJECT));
    if (nation) target.push({ label:`${prefix} ${row.TEST_SUBJECT}`, area:n(row.AVG_SCORE), nation:n(nation.AVG_SCORE), color:comparisonColor(prefix, row.TEST_SUBJECT) });
  });
}

function comparisonColor(prefix, subject) {
  if (prefix === "RT") return /อ่านรู้เรื่อง/.test(subject) ? "#fb7185" : "#f43f5e";
  if (prefix === "NT") return /คณิต/.test(subject) ? "#8b5cf6" : "#6366f1";
  if (/คณิต/.test(subject)) return "#0ea5e9";
  if (/วิทย/.test(subject)) return "#14b8a6";
  if (/อังกฤษ/.test(subject)) return "#f59e0b";
  if (/ไทย/.test(subject)) return "#ec4899";
  return "#64748b";
}

function renderEfficiency(rows) {
  const renderRate = (id, studentLevels, dropoutLevels, department = "") => {
    const studentRows = rows.students.filter(row => studentLevels.has(normalizeEducationLevel(row.EDU_LEVEL)));
    const dropoutRows = rows.dropout.filter(row =>
      dropoutLevels.has(normalizeEducationLevel(row.EDU_LEVEL)) &&
      (!department || normalizeEducationLevel(row.DEPARTMENT_NAME) === department)
    );
    const dropout = dropoutRows.reduce((sum,row) => sum+n(row.DROPOUT_COUNT),0);
    const students = totalStudents(studentRows);
    const ready = dropoutRows.length && studentRows.length && students;
    document.getElementById(id).textContent = ready ? `${(dropout/students*100).toFixed(2)}%` : "รอข้อมูลอัปเดต";
    document.getElementById(`${id}-note`).textContent = ready ? `ออกกลางคัน ${dropout.toLocaleString("th-TH")} / ผู้เรียน ${students.toLocaleString("th-TH")} คน` : "";
  };
  renderRate("eff-compulsory", EFFICIENCY_LEVELS.compulsoryStudents, EFFICIENCY_LEVELS.compulsoryDropout);
  renderRate("eff-voc", EFFICIENCY_LEVELS.vocationalStudents, EFFICIENCY_LEVELS.vocationalDropout, VOCATIONAL_DEPARTMENT);
  renderRate("eff-higher-voc", EFFICIENCY_LEVELS.higherVocStudents, EFFICIENCY_LEVELS.higherVocDropout, VOCATIONAL_DEPARTMENT);
}

function renderRelevancy(rows) {
  const isVocAgency = row => /อาชีว/.test(String(row.DEPARTMENT_NAME || ""));
  const vocational = totalStudents(rows.students.filter(row => isVocAgency(row) || LEVEL.voc(levelText(row)) || LEVEL.higherVoc(levelText(row))));
  const general = totalStudents(rows.students.filter(row => !isVocAgency(row) && LEVEL.upper(levelText(row)) && !LEVEL.voc(levelText(row))));
  const combined = vocational + general;
  const vocationalPercent = combined ? vocational / combined * 100 : 0;
  const generalPercent = combined ? general / combined * 100 : 0;
  document.getElementById("rel-vocational").textContent = combined ? `${vocationalPercent.toFixed(2)} : ${generalPercent.toFixed(2)}` : "รอข้อมูลอัปเดต";
  document.getElementById("rel-vocational-note").textContent = combined ? `สายอาชีพ ${vocational.toLocaleString("th-TH")} คน ต่อ สายสามัญ ${general.toLocaleString("th-TH")} คน` : "";
  document.getElementById("rel-vocational-legend").innerHTML = combined
    ? `<div class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"><span class="block text-xs font-medium text-amber-700"><i class="fas fa-circle mr-1"></i>สายอาชีพ</span><strong class="mt-1 block text-xl text-amber-700">${vocationalPercent.toFixed(2)}%</strong></div><div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2"><span class="block text-xs font-medium text-blue-700"><i class="fas fa-circle mr-1"></i>สายสามัญ</span><strong class="mt-1 block text-xl text-blue-700">${generalPercent.toFixed(2)}%</strong></div>`
    : "";
  const vocationalIcons = combined ? Math.round(vocationalPercent / 5) : 0;
  document.getElementById("rel-vocational-people").innerHTML = combined
    ? Array.from({length:20}, (_, index) => `<i class="fas fa-person ${index < vocationalIcons ? "text-amber-500" : "text-blue-500"}" aria-hidden="true"></i>`).join("")
    : '<span class="col-span-10 py-4 text-sm text-slate-400">รอข้อมูลอัปเดต</span>';

  const jobRows = rows.jobs.filter(row => LEVEL.voc(levelText(row)) || LEVEL.higherVoc(levelText(row)) || /มัธยมศึกษาตอนปลาย/.test(levelText(row)));
  currentJobRows = jobRows;
  const status = groupSum(jobRows, "EMPLOY_STATUS", "STUDENT_COUNT");
  const employmentColors = ["#14b8a6","#3b82f6","#f59e0b","#fb7185","#8b5cf6","#94a3b8"];
  employmentColorMap = new Map(status.map((item,index) => [item.label, employmentColors[index % employmentColors.length]]));
  replaceChart("employment", "employmentChart", doughnutConfig(status.map(item=>item.label), status.map(item=>item.value), status.map(item=>employmentColorMap.get(item.label))));
  const levelSelect = document.getElementById("employmentLevelFilter");
  const previous = levelSelect.value;
  const levels = [...new Set(jobRows.map(row => String(row.EDU_LEVEL || "")).filter(Boolean))].sort();
  levelSelect.innerHTML = "";
  levels.forEach(level => levelSelect.add(new Option(level,level)));
  if (levels.includes(previous)) levelSelect.value = previous;
  renderEmploymentTable();
}

function renderEmploymentTable() {
  const level = document.getElementById("employmentLevelFilter").value;
  const details = groupSum(currentJobRows.filter(row => String(row.EDU_LEVEL) === level), "EMPLOY_STATUS", "STUDENT_COUNT");
  document.getElementById("employmentTable").innerHTML = details.length
    ? details.map(item => {
        const color = employmentColorMap.get(item.label) || "#94a3b8";
        return `<tr class="border-t" style="border-left:4px solid ${color};background:${color}0d"><td class="p-2"><span class="mr-2 inline-block h-2.5 w-2.5 rounded-full" style="background:${color}"></span>${escapeHtml(item.label)}</td><td class="p-2 text-right font-semibold" style="color:${color}">${item.value.toLocaleString("th-TH")}</td></tr>`;
      }).join("")
    : '<tr><td colspan="2" class="p-6 text-center text-slate-400">รอข้อมูลอัปเดต</td></tr>';
}

function groupSum(rows, field, metric) {
  const totals = new Map();
  rows.forEach(row => {
    const label = String(row[field] || "ไม่ระบุ");
    totals.set(label, (totals.get(label)||0)+n(row[metric]));
  });
  return [...totals].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
}

function setNumber(id, value) { document.getElementById(id).textContent = value.toLocaleString("th-TH"); }
function replaceChart(key, canvasId, config) { charts[key]?.destroy(); charts[key] = new Chart(document.getElementById(canvasId), config); }
function doughnutConfig(labels, values, colors) { return { type:"doughnut", data:{ labels, datasets:[{ data:values, backgroundColor:colors }] }, options:{ maintainAspectRatio:false, plugins:{ legend:{ position:"bottom" } } } }; }
function baseChartOptions({legend=true,yTitle=""}={}) { return { maintainAspectRatio:false, plugins:{legend:{display:legend,position:"bottom"}}, scales:{y:{beginAtZero:true,title:{display:Boolean(yTitle),text:yTitle}}} }; }
function comparisonChartOptions(yTitle, primaryLabel) {
  const options = baseChartOptions({ yTitle });
  options.plugins.legend.labels = {
    generateLabels: chart => [
      { text:`${primaryLabel} — สีทึบ`, fillStyle:"rgba(71,85,105,1)", strokeStyle:"#475569", lineWidth:1, hidden:!chart.isDatasetVisible(0), datasetIndex:0 },
      { text:"ระดับประเทศ — สีโปร่งใส", fillStyle:"rgba(71,85,105,.25)", strokeStyle:"#475569", lineWidth:1, hidden:!chart.isDatasetVisible(1), datasetIndex:1 }
    ]
  };
  return options;
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"})[char]); }
