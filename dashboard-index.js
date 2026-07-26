const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const SHEETS = { population: ["DB_2", "Population"], special: ["DB_2", "Special_Needs"], oosc: ["DB_2", "Out_of_School"], dropout: ["DB_2", "Dropout"], jobs: ["DB_2", "Get_a_Jobs"], students: ["DB_1", "Student_Count"] };
let data = {};

async function fetchAllPages(dbKey, sheetName) {
  return EDU15DataClient.fetchAllPages(GAS_WEB_APP_URL, dbKey, sheetName);
}

window.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  try {
    const entries = await Promise.all(Object.entries(SHEETS).map(async ([key, [db, sheet]]) => [key, await fetchAllPages(db, sheet)]));
    data = Object.fromEntries(entries);
    populateFilters();
    render(getFilters());
    document.getElementById("filterForm").addEventListener("submit", event => { event.preventDefault(); render(getFilters()); });
    document.getElementById("filterForm").addEventListener("reset", () => setTimeout(() => render(getFilters()), 0));
  } catch (error) {
    console.error(error);
    document.getElementById("dataReadiness").className = "mb-6 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700";
    document.getElementById("dataReadiness").textContent = `โหลดข้อมูลไม่สำเร็จ: ${error.message}`;
  } finally {
    window.hidePageLoader?.();
  }
}

function populateFilters() {
  const all = Object.values(data).flat();
  const years = [...new Set(all.map(row => String(row.YEAR ?? row.ACAD_YEAR ?? "").trim()).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const provinces = [...new Set(all.map(row => String(row.PROV_NAME ?? "").trim()).filter(Boolean))].sort();
  fillSelect("filterYear", years);
  fillSelect("filterProvince", provinces);
  if (years.length) document.getElementById("filterYear").value = years[0];
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  const first = select.options[0];
  select.innerHTML = "";
  select.append(first);
  values.forEach(value => select.add(new Option(value, value)));
}

function getFilters() {
  return { year: document.getElementById("filterYear").value, province: document.getElementById("filterProvince").value };
}

function filtered(rows, filters) {
  return rows.filter(row => {
    const year = String(row.YEAR ?? row.ACAD_YEAR ?? "");
    if (filters.year && year !== filters.year) return false;
    if (filters.province && String(row.PROV_NAME) !== filters.province) return false;
    return true;
  });
}

function n(value) {
  const parsed = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function totalStudents(rows) {
  return rows.reduce((sum, row) => sum + n(row.STUDENT_MALE) + n(row.STUDENT_FEMALE), 0);
}

function text(row, field) {
  return String(row[field] || "").toLowerCase();
}

const LEVEL = {
  early: value => /อนุบาล|ปฐมวัย/.test(value),
  primary: value => /ประถม/.test(value),
  lower: value => /มัธยม.*(ปีที่\s*[1-3]|ตอนต้น)|ม\.?\s*[1-3]/.test(value),
  upper: value => /มัธยม.*(ปีที่\s*[4-6]|ตอนปลาย)|ม\.?\s*[4-6]|ปวช|ประกาศนียบัตรวิชาชีพ(?!ชั้นสูง)/.test(value),
  voc: value => /ปวช|ประกาศนียบัตรวิชาชีพ(?!ชั้นสูง)/.test(value),
  higherVoc: value => /ปวส|ประกาศนียบัตรวิชาชีพชั้นสูง/.test(value)
};

function ageGroup(value, from, to) {
  const numbers = String(value).match(/\d+/g)?.map(Number) || [];
  return numbers.includes(from) && numbers.includes(to);
}

function render(filters) {
  const rows = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, filtered(value, filters)]));
  renderReadiness(rows);
  renderAccess(rows);
  renderEquity(rows);
  renderEfficiency(rows);
  renderRelevancy(rows);
}

function renderReadiness(rows) {
  const available = Object.entries(rows).filter(([, value]) => value.length).map(([key]) => key).length;
  const total = Object.keys(rows).length;
  document.getElementById("dataReadiness").innerHTML = `<i class="fas fa-database mr-2"></i>พบข้อมูลพร้อมคำนวณ ${available} จาก ${total} ชุด ตัวชี้วัดที่ตัวหารเป็นศูนย์จะแสดงว่า “ยังไม่มีข้อมูล”`;
}

function ratioCard(id, numerator, denominator, labels = ["ตัวตั้ง", "ตัวหาร"]) {
  const value = denominator > 0 ? numerator / denominator * 100 : null;
  document.getElementById(id).textContent = value === null ? "ยังไม่มีข้อมูล" : `${value.toFixed(2)}%`;
  document.getElementById(`${id}-note`).textContent = `${labels[0]} ${numerator.toLocaleString("th-TH")} / ${labels[1]} ${denominator.toLocaleString("th-TH")}`;
}

function renderAccess(rows) {
  const configs = [
    ["access-early", LEVEL.early, [3, 5]],
    ["access-primary", LEVEL.primary, [6, 11]],
    ["access-lower", LEVEL.lower, [12, 14]],
    ["access-upper", LEVEL.upper, [15, 17]],
    ["access-higher-voc", LEVEL.higherVoc, [18, 19]]
  ];
  configs.forEach(([id, matchLevel, ages]) => {
    const students = totalStudents(rows.students.filter(row => matchLevel(text(row, "EDU_LEVEL"))));
    const population = rows.population.filter(row => ageGroup(row.AGE_GROUP, ages[0], ages[1])).reduce((sum, row) => sum + n(row.POPU_COUNT), 0);
    ratioCard(id, students, population, ["ผู้เรียน", "ประชากร"]);
  });
}

function renderEquity(rows) {
  const students = totalStudents(rows.students);
  const special = rows.special.reduce((sum, row) => sum + n(row.STUDENT_COUNT), 0);
  ratioCard("equity-special", special, students, ["ผู้เรียนกลุ่มพิเศษ", "ผู้เรียนทั้งหมด"]);
  document.getElementById("specialBreakdown").innerHTML = breakdown(rows.special, "SPECIAL_NEEDS", "STUDENT_COUNT");

  const ooscTotal = rows.oosc.reduce((sum, row) => sum + n(row.OOSC_COUNT), 0);
  const returned = rows.oosc.filter(row => /กลับ|เข้า.*ระบบ|ติดตาม.*สำเร็จ/.test(text(row, "OOSC_RESULT"))).reduce((sum, row) => sum + n(row.OOSC_COUNT), 0);
  ratioCard("equity-returned", returned, ooscTotal, ["กลับเข้าสู่ระบบ", "เด็กนอกระบบทั้งหมด"]);
  document.getElementById("ooscBreakdown").innerHTML = breakdown(rows.oosc, "OOSC_RESULT", "OOSC_COUNT");
}

function renderEfficiency(rows) {
  const compulsoryStudent = totalStudents(rows.students.filter(row => LEVEL.primary(text(row, "EDU_LEVEL")) || LEVEL.lower(text(row, "EDU_LEVEL"))));
  const compulsoryDropout = rows.dropout.filter(row => LEVEL.primary(text(row, "EDU_LEVEL")) || LEVEL.lower(text(row, "EDU_LEVEL"))).reduce((sum, row) => sum + n(row.DROPOUT_COUNT), 0);
  ratioCard("eff-compulsory", compulsoryDropout, compulsoryStudent, ["ออกกลางคัน", "ผู้เรียนภาคบังคับ"]);

  const vocStudent = totalStudents(rows.students.filter(row => LEVEL.voc(text(row, "EDU_LEVEL"))));
  const vocDropout = rows.dropout.filter(row => LEVEL.voc(text(row, "EDU_LEVEL"))).reduce((sum, row) => sum + n(row.DROPOUT_COUNT), 0);
  ratioCard("eff-voc", vocDropout, vocStudent, ["ออกกลางคัน ปวช.", "ผู้เรียน ปวช."]);

  const higherStudent = totalStudents(rows.students.filter(row => LEVEL.higherVoc(text(row, "EDU_LEVEL"))));
  const higherDropout = rows.dropout.filter(row => LEVEL.higherVoc(text(row, "EDU_LEVEL"))).reduce((sum, row) => sum + n(row.DROPOUT_COUNT), 0);
  ratioCard("eff-higher-voc", higherDropout, higherStudent, ["ออกกลางคัน ปวส.", "ผู้เรียน ปวส."]);
}

function renderRelevancy(rows) {
  const vocational = totalStudents(rows.students.filter(row => LEVEL.voc(text(row, "EDU_LEVEL")) || LEVEL.higherVoc(text(row, "EDU_LEVEL"))));
  const general = totalStudents(rows.students.filter(row => /มัธยม/.test(text(row, "EDU_LEVEL"))));
  ratioCard("rel-vocational", vocational, general, ["อาชีวศึกษา", "สามัญศึกษา"]);

  const jobRows = rows.jobs.filter(row => LEVEL.voc(text(row, "EDU_LEVEL")) || LEVEL.higherVoc(text(row, "EDU_LEVEL")));
  const jobTotal = jobRows.reduce((sum, row) => sum + n(row.STUDENT_COUNT), 0);
  const employed = jobRows.filter(row => /ได้งาน|มีงาน|ประกอบอาชีพ|ทำงาน/.test(text(row, "EMPLOY_STATUS"))).reduce((sum, row) => sum + n(row.STUDENT_COUNT), 0);
  ratioCard("rel-employed", employed, jobTotal, ["ได้งาน/ประกอบอาชีพ", "ผู้สำเร็จที่ติดตาม"]);
}

function breakdown(rows, field, metric) {
  const totals = new Map();
  rows.forEach(row => {
    const key = String(row[field] || "ไม่ระบุ");
    totals.set(key, (totals.get(key) || 0) + n(row[metric]));
  });
  return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => `<div class="flex justify-between gap-3 border-t border-slate-100 py-1.5"><span>${escapeHtml(label)}</span><strong>${value.toLocaleString("th-TH")}</strong></div>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}
