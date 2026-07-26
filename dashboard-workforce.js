const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const SHEETS = { career: "Job_Vacancy_Career", industry: "Job_Vacancy_Industry", eduLevel: "Job_Vacancy_EduLevel", mou: "Vocational_Busi_MOU" };
const MONTH_NAMES = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
let data = { career: [], industry: [], eduLevel: [], mou: [] };
let trendChart;
let businessMap;
let businessLayer;

async function fetchAllPages(dbKey, sheetName) {
  return EDU15DataClient.fetchAllPages(GAS_WEB_APP_URL, dbKey, sheetName);
}

window.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  try {
    const results = await Promise.all(Object.entries(SHEETS).map(async ([key, sheet]) => [key, await fetchAllPages("DB_3", sheet)]));
    data = Object.fromEntries(results);
    populateFilters();
    initMap();
    renderDashboard(getFilters());
    document.getElementById("filterForm").addEventListener("submit", event => { event.preventDefault(); renderDashboard(getFilters()); });
    document.getElementById("filterForm").addEventListener("reset", () => setTimeout(() => renderDashboard(getFilters()), 0));
  } catch (error) {
    console.error(error);
    document.getElementById("careerTableBody").innerHTML = `<tr><td colspan="2" class="p-8 text-center text-rose-600">${escapeHtml(error.message)}</td></tr>`;
  } finally {
    window.hidePageLoader?.();
  }
}

function populateFilters() {
  const all = Object.values(data).flat();
  const unique = field => [...new Set(all.map(row => String(row[field] ?? "").trim()).filter(Boolean))];
  fillSelect("filterYear", unique("YEAR").sort((a, b) => Number(b) - Number(a)));
  fillSelect("filterMonth", unique("MONTH").sort((a, b) => Number(a) - Number(b)), value => MONTH_NAMES[Number(value)] || value);
  fillSelect("filterProvince", unique("PROV_NAME").sort());
}

function fillSelect(id, values, label = value => value) {
  const select = document.getElementById(id);
  const first = select.options[0];
  select.innerHTML = "";
  select.append(first);
  values.forEach(value => select.add(new Option(label(value), value)));
}

function getFilters() {
  return { year: document.getElementById("filterYear").value, month: document.getElementById("filterMonth").value, province: document.getElementById("filterProvince").value };
}

function filterRows(rows, filters, applyMonth = true) {
  return rows.filter(row => {
    if (filters.year && String(row.YEAR) !== filters.year) return false;
    if (applyMonth && filters.month && String(row.MONTH) !== filters.month) return false;
    if (filters.province && String(row.PROV_NAME) !== filters.province) return false;
    return true;
  });
}

function numberValue(value) {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function renderDashboard(filters) {
  const filtered = {
    career: filterRows(data.career, filters),
    industry: filterRows(data.industry, filters),
    eduLevel: filterRows(data.eduLevel, filters),
    mou: filterRows(data.mou, filters, false)
  };
  setNumber("stat-career", sum(filtered.career, "VACANCY_COUNT"));
  setNumber("stat-industry", sum(filtered.industry, "VACANCY_COUNT"));
  setNumber("stat-edu-level", sum(filtered.eduLevel, "VACANCY_COUNT"));
  setNumber("stat-mou", new Set(filtered.mou.map(row => `${row.PROV_NAME}|${row.BUSINESS_NAME}`)).size);
  renderSummaryTable("careerTableBody", filtered.career, "CAREER_TYPE");
  renderSummaryTable("industryTableBody", filtered.industry, "INDUSTRY_TYPE");
  renderSummaryTable("eduLevelTableBody", filtered.eduLevel, "EDU_LEVEL");
  renderTrend(filterRows(data.career, { ...filters, month: "" }));
  renderMou(filtered.mou);
  renderMap(filtered.mou);
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + numberValue(row[field]), 0);
}

function setNumber(id, value) {
  document.getElementById(id).textContent = value.toLocaleString("th-TH");
}

function renderSummaryTable(id, rows, field) {
  const totals = new Map();
  rows.forEach(row => {
    const key = String(row[field] || "ไม่ระบุ");
    totals.set(key, (totals.get(key) || 0) + numberValue(row.VACANCY_COUNT));
  });
  const sorted = [...totals].sort((a, b) => b[1] - a[1]);
  document.getElementById(id).innerHTML = sorted.length
    ? sorted.map(([label, value]) => `<tr class="border-t"><td class="p-3">${escapeHtml(label)}</td><td class="p-3 text-right font-medium">${value.toLocaleString("th-TH")}</td></tr>`).join("")
    : '<tr><td colspan="2" class="p-8 text-center text-slate-400">ไม่พบข้อมูล</td></tr>';
}

function renderTrend(rows) {
  const monthly = Array(12).fill(0);
  rows.forEach(row => {
    const month = Number(row.MONTH);
    if (month >= 1 && month <= 12) monthly[month - 1] += numberValue(row.VACANCY_COUNT);
  });
  trendChart?.destroy();
  trendChart = new Chart(document.getElementById("workforceTrendChart"), {
    type: "line",
    data: { labels: MONTH_NAMES.slice(1), datasets: [{ label: "ตำแหน่งงานว่าง", data: monthly, borderColor: "#0d9488", backgroundColor: "rgba(13,148,136,.12)", fill: true, tension: .35, pointRadius: 4 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderMou(rows) {
  const sorted = [...rows].sort((a, b) => String(a.BUSINESS_NAME).localeCompare(String(b.BUSINESS_NAME), "th"));
  document.getElementById("mouTableSummary").textContent = `พบ ${sorted.length.toLocaleString("th-TH")} รายการ`;
  document.getElementById("mouTableBody").innerHTML = sorted.length
    ? sorted.map(row => `<tr class="border-t"><td class="p-3 font-medium">${escapeHtml(row.BUSINESS_NAME || "ไม่ระบุ")}</td><td class="p-3">${escapeHtml(row.BUSINESS_TYPE || "-")}</td><td class="p-3">${escapeHtml(row.PROV_NAME || "-")}</td></tr>`).join("")
    : '<tr><td colspan="3" class="p-8 text-center text-slate-400">ไม่พบข้อมูล</td></tr>';
}

function initMap() {
  businessMap = L.map("businessMap", { preferCanvas: true }).setView([18.4, 99.0], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(businessMap);
  businessLayer = L.layerGroup().addTo(businessMap);
}

function parseCoordinate(value) {
  const values = String(value || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!values || values.length < 2) return null;
  let [lat, lng] = values;
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

function renderMap(rows) {
  businessLayer.clearLayers();
  const bounds = [];
  let valid = 0;
  rows.forEach(row => {
    const coordinate = parseCoordinate(row.COORDI);
    if (!coordinate) return;
    valid++;
    bounds.push(coordinate);
    L.circleMarker(coordinate, { radius: 6, color: "#6d28d9", fillColor: "#8b5cf6", fillOpacity: .75, weight: 1 })
      .bindPopup(`<strong>${escapeHtml(row.BUSINESS_NAME || "สถานประกอบการ")}</strong><br>${escapeHtml(row.BUSINESS_TYPE || "")}`)
      .addTo(businessLayer);
  });
  document.getElementById("businessMapSummary").textContent = `แสดงพิกัดที่ถูกต้อง ${valid.toLocaleString("th-TH")} แห่ง`;
  if (bounds.length) businessMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
  setTimeout(() => businessMap.invalidateSize(), 0);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}
