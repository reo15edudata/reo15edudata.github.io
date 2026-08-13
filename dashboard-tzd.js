const TZD_GAS_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const TZD_SHEETS = ["TZD_Finding_Update", "TZD_Finding_Status", "TZD_CM_CarePlanning", "TZD_CM_Follow"];
const TZD_NEED_HELP_FIELDS = ["NEEDHELP_INFO_SURVEYED", "NEEDHELP_INFO_NOTSURVEY"];
const TZD_STATUS_LABELS = {
  BACKED_TO_EDU: "กลับเข้าศึกษาต่อแล้ว", ALTER_EDU: "การศึกษาทางเลือกตามมาตรา 12",
  STUDY_ABROAD: "ศึกษาต่อต่างประเทศ", GRADUTED_COMPLUSEEDU: "จบการศึกษาภาคบังคับแล้ว",
  WORK_EMPLOY: "มีงานทำ/ประกอบอาชีพแล้ว", HAVE_FAMILY: "มีครอบครัวหรือมีบุตรแล้ว",
  JUSTICE_SYS: "อยู่ในกระบวนการยุติธรรม", WELFARE_CENTER: "อยู่ในสถานสงเคราะห์",
  DRUG_ADDICT: "ต้องฟื้นฟูจากสารเสพติด", RELOCATED: "ย้ายภูมิลำเนาหรือสถานศึกษา",
  CANT_FIND_HOUSE: "หาบ้านไม่พบ", DONT_NEED_HELP: "ไม่ต้องการความช่วยเหลือ", DECEASED: "เสียชีวิต"
};
const TZD_STATUS_COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#0891b2", "#16a34a", "#65a30d", "#d97706", "#ea580c", "#e11d48", "#475569", "#94a3b8", "#64748b", "#1e293b"];
const TZD_PLAN_STATUSES = ["ยังไม่ได้ดำเนินการ", "รอ CMS ยืนยัน", "CMS ยืนยันแล้ว", "ยุติการดูแล"];
const TZD_CARE_STATUS_COLORS = ["#94a3b8", "#f59e0b", "#14b8a6", "#475569"];
const tzdData = Object.fromEntries(TZD_SHEETS.map(sheet => [sheet, []]));
const tzdBatches = Object.fromEntries(TZD_SHEETS.map(sheet => [sheet, []]));
const tzdCharts = {};
let tzdRounds = [];
let tzdProvinceMulti = null;
let tzdDistrictMulti = null;

window.addEventListener("DOMContentLoaded", initTzdDashboard);

async function initTzdDashboard() {
  try {
    const datasets = await Promise.all(TZD_SHEETS.map(sheet => EDU15DataClient.fetchAllPages(TZD_GAS_URL, "DB_5", sheet, { cacheScope: "tzd-v2", networkFirst: true })));
    TZD_SHEETS.forEach((sheet, index) => { tzdData[sheet] = datasets[index]; tzdBatches[sheet] = buildTzdBatches(datasets[index]); });
    buildTzdRounds();
    populateTzdFilters();
    setupTzdEvents();
    renderTzdDashboard();
  } catch (error) {
    console.error(error);
    document.getElementById("tzdCurrentRound").textContent = `โหลดข้อมูลไม่สำเร็จ: ${error.message}`;
  } finally { await window.hidePageLoader?.(); }
}

function parseTzdTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value < 100000 ? Date.UTC(1899, 11, 30) + value * 86400000 - 7 * 3600000 : value;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (local) { let year = Number(local[3]); if (year >= 2400) year -= 543; return Date.UTC(year, Number(local[2]) - 1, Number(local[1]), Number(local[4] || 0) - 7, Number(local[5] || 0), Number(local[6] || 0)); }
  const timestamp = new Date(text).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function buildTzdBatches(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const roundMonth = tzdRowRoundMonth(row);
    if (!roundMonth) return;
    if (!groups.has(roundMonth)) groups.set(roundMonth, new Map());
    const key = [row.PROV_NAME, row.DISTRICT, row.PLAN_STATUS || ""].map(value => String(value || "").trim()).join("|");
    const timestamp = parseTzdTimestamp(row.SUBMITED_TIME) || 0;
    const current = groups.get(roundMonth).get(key);
    if (!current || timestamp >= current.timestamp) groups.get(roundMonth).set(key, { row, timestamp });
  });
  return [...groups].map(([roundMonth, keyedRows]) => {
    const rows = [...keyedRows.values()].map(item => item.row);
    const provincesWithDistrictRows = new Set(rows.filter(row => String(row.DISTRICT || "").trim() !== "ทั้งจังหวัด").map(row => String(row.PROV_NAME || "").trim()));
    return { roundMonth, rows: rows.filter(row => String(row.DISTRICT || "").trim() !== "ทั้งจังหวัด" || !provincesWithDistrictRows.has(String(row.PROV_NAME || "").trim())) };
  }).sort((a, b) => a.roundMonth.localeCompare(b.roundMonth));
}

function buildTzdRounds() {
  const months = new Set(TZD_SHEETS.flatMap(sheet => tzdBatches[sheet].map(batch => batch.roundMonth)));
  tzdRounds = [...months].sort().map((roundMonth, index) => ({ roundMonth, round: index + 1 }));
}

function populateTzdFilters() {
  document.getElementById("tzdRound").innerHTML = '<option value="latest">รอบเดือนล่าสุด</option>' + [...tzdRounds].reverse().map(item => `<option value="${item.roundMonth}">${formatTzdMonth(item.roundMonth)}</option>`).join("");
  const allRows = TZD_SHEETS.flatMap(sheet => tzdData[sheet]);
  tzdProvinceMulti = EDU15MultiSelect.create(document.getElementById("tzdProvince"), uniqueTzdValues(allRows, "PROV_NAME"), "ทุกจังหวัด");
  tzdDistrictMulti = EDU15MultiSelect.create(document.getElementById("tzdDistrict"), uniqueTzdValues(allRows, "DISTRICT"), "ทุกอำเภอ");
}

function setupTzdEvents() {
  document.getElementById("tzdFilterForm").addEventListener("submit", event => { event.preventDefault(); renderTzdDashboard(); });
  document.getElementById("clearTzdFilters").addEventListener("click", () => {
    document.getElementById("tzdRound").value = "latest";
    tzdProvinceMulti?.clear();
    tzdDistrictMulti?.clear();
    renderTzdDashboard();
  });
}

function uniqueTzdValues(rows, field) { return [...new Set(rows.map(row => String(row[field] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")); }
function selectedTzdMonth() { const value = document.getElementById("tzdRound").value; return value === "latest" ? (tzdRounds.at(-1)?.roundMonth || "") : value; }
function selectedTzdBatch(sheet, roundMonth = selectedTzdMonth()) { return tzdBatches[sheet].find(batch => batch.roundMonth === roundMonth) || null; }
function previousTzdBatch(sheet, currentBatch) { return currentBatch ? [...tzdBatches[sheet]].reverse().find(batch => batch.roundMonth < currentBatch.roundMonth) || null : null; }

function filterTzdRows(rows, options = {}) {
  const provinces = options.provinces || tzdProvinceMulti?.getValues() || [];
  const districts = tzdDistrictMulti?.getValues() || [];
  return (rows || []).filter(row => (!provinces.length || provinces.includes(String(row.PROV_NAME || "").trim())) && (!districts.length || districts.includes(String(row.DISTRICT || "").trim())));
}

function nTzd(value) { const number = Number(String(value ?? 0).replace(/,/g, "").trim()); return Number.isFinite(number) ? number : 0; }
function sumTzd(rows, field) { return rows.reduce((sum, row) => sum + nTzd(row[field]), 0); }

function renderTzdDashboard() {
  const roundMonth = selectedTzdMonth();
  const round = tzdRounds.find(item => item.roundMonth === roundMonth);
  document.getElementById("tzdCurrentRound").textContent = round ? `รอบเดือน ${formatTzdMonth(round.roundMonth)}` : "ยังไม่มีข้อมูลรอบอัปโหลด";
  const findingBatch = selectedTzdBatch("TZD_Finding_Update", roundMonth);
  const statusBatch = selectedTzdBatch("TZD_Finding_Status", roundMonth);
  const careBatch = selectedTzdBatch("TZD_CM_CarePlanning", roundMonth);
  const followBatch = selectedTzdBatch("TZD_CM_Follow", roundMonth);
  const findingRows = filterTzdRows(findingBatch?.rows);
  const statusRows = filterTzdRows(statusBatch?.rows);
  const careRows = filterTzdRows(careBatch?.rows);
  const followRows = filterTzdRows(followBatch?.rows);
  renderFindingSummary(findingBatch, findingRows, statusRows);
  renderFindingProgress(roundMonth);
  renderFindingStatuses(statusRows);
  renderCareSummary(careBatch, followBatch, careRows, followRows);
}

function renderFindingSummary(batch, rows, statusRows) {
  const previousRows = filterTzdRows(previousTzdBatch("TZD_Finding_Update", batch)?.rows);
  const target = sumTzd(rows, "TARGET_COUNT");
  const firstScreen = sumTzd(rows, "FIRSTSCREEN_FOUND_HAVEEVIDENCE") + sumTzd(rows, "FIRSTSCREEN_FOUND_HAVENTEVIDENCE");
  const previousTarget = sumTzd(previousRows, "TARGET_COUNT");
  const previousFirst = sumTzd(previousRows, "FIRSTSCREEN_FOUND_HAVEEVIDENCE") + sumTzd(previousRows, "FIRSTSCREEN_FOUND_HAVENTEVIDENCE");
  const hasPrevious = Boolean(previousTzdBatch("TZD_Finding_Update", batch));
  document.getElementById("metricTarget").textContent = formatTzdNumber(target);
  document.getElementById("metricFirstScreen").textContent = formatTzdNumber(firstScreen);
  renderTzdChange("metricTargetChange", target, previousTarget, hasPrevious);
  renderTzdChange("metricFirstScreenChange", firstScreen, previousFirst, hasPrevious);
  const firstRate = target ? Math.min(100, firstScreen / target * 100) : 0;
  document.getElementById("findingRate").textContent = target ? `${firstRate.toFixed(1)}%` : "—";

  const allSurveyStatusFields = [...TZD_NEED_HELP_FIELDS, ...Object.keys(TZD_STATUS_LABELS)];
  const surveyedStatusTotal = allSurveyStatusFields.reduce((sum, field) => sum + sumTzd(statusRows, field), 0);
  const pending = Math.max(0, target - surveyedStatusTotal);
  document.getElementById("metricPending").textContent = formatTzdNumber(pending);
  document.getElementById("metricPendingNote").textContent = `เป้าหมาย ${formatTzdNumber(target)} − มีสถานะแล้ว ${formatTzdNumber(surveyedStatusTotal)}`;
  const comparisonTotal = firstScreen + pending;
  const completedShare = comparisonTotal ? firstScreen / comparisonTotal * 100 : 0;
  document.getElementById("firstScreenProgress").style.width = `${completedShare}%`;
  document.getElementById("pendingProgress").style.width = `${comparisonTotal ? 100 - completedShare : 0}%`;

  const surveyed = sumTzd(statusRows, "NEEDHELP_INFO_SURVEYED");
  const notSurveyed = sumTzd(statusRows, "NEEDHELP_INFO_NOTSURVEY");
  const needHelp = surveyed + notSurveyed;
  document.getElementById("metricNeedHelpTotal").textContent = formatTzdNumber(needHelp);
  document.getElementById("metricSurveyed").textContent = formatTzdNumber(surveyed);
  document.getElementById("metricNotSurveyed").textContent = formatTzdNumber(notSurveyed);
  document.getElementById("metricSurveyedRate").textContent = needHelp ? `${(surveyed / needHelp * 100).toFixed(1)}% ของผู้ต้องการความช่วยเหลือ` : "ยังไม่มีข้อมูล";
  document.getElementById("metricNotSurveyedRate").textContent = needHelp ? `${(notSurveyed / needHelp * 100).toFixed(1)}% ของผู้ต้องการความช่วยเหลือ` : "ยังไม่มีข้อมูล";
}

function renderFindingProgress(roundMonth) {
  const history = tzdBatches.TZD_Finding_Update.filter(batch => batch.roundMonth <= roundMonth);
  const selectedProvinces = tzdProvinceMulti?.getValues() || [];
  const provinces = selectedProvinces.length ? selectedProvinces : uniqueTzdValues(history.flatMap(batch => batch.rows), "PROV_NAME");
  const colors = ["#2563eb", "#e11d48", "#d97706", "#059669", "#7c3aed", "#0891b2"];
  replaceTzdChart("findingProgress", "findingProgressChart", {
    type: "line",
    data: {
      labels: history.map(batch => formatTzdMonthShort(batch.roundMonth)),
      datasets: provinces.map((province, index) => ({
        label: province,
        data: history.map(batch => { const rows = filterTzdRows(batch.rows, { provinces: [province] }); return sumTzd(rows, "FIRSTSCREEN_FOUND_HAVEEVIDENCE") + sumTzd(rows, "FIRSTSCREEN_FOUND_HAVENTEVIDENCE"); }),
        borderColor: colors[index % colors.length], backgroundColor: colors[index % colors.length], tension: .25, pointRadius: 3
      }))
    }, options: tzdChartOptions("จำนวนเด็กที่ First Screen แล้ว")
  });
}

function renderFindingStatuses(statusRows) {
  const fields = Object.keys(TZD_STATUS_LABELS);
  const values = fields.map(field => sumTzd(statusRows, field));
  replaceTzdChart("findingStatus", "findingStatusChart", { type: "doughnut", data: { labels: Object.values(TZD_STATUS_LABELS), datasets: [{ data: values, backgroundColor: TZD_STATUS_COLORS }] }, options: { maintainAspectRatio: false, cutout: "52%", plugins: { legend: { display: false }, datalabels: { display: context => context.dataset.data[context.dataIndex] > 0, formatter: value => formatTzdNumber(value), color: "#fff", font: { size: 11, weight: "bold" }, textStrokeColor: "rgba(15,23,42,.55)", textStrokeWidth: 2, clamp: true } } } });
  const total = values.reduce((sum, value) => sum + value, 0);
  document.getElementById("findingStatusTable").innerHTML = fields.map((field, index) => ({ label: TZD_STATUS_LABELS[field], value: values[index], color: TZD_STATUS_COLORS[index] })).sort((a, b) => b.value - a.value).map(item => `<tr class="border-t border-slate-100"><td class="p-3"><span class="mr-2 inline-block h-2.5 w-2.5 rounded-full" style="background:${item.color}"></span>${escapeTzd(item.label)}</td><td class="p-3 text-right font-semibold">${formatTzdNumber(item.value)}</td><td class="p-3 text-right text-slate-500">${total ? (item.value / total * 100).toFixed(1) : "0.0"}%</td></tr>`).join("") || emptyTzdRow(3);
}

function renderCareSummary(careBatch, followBatch, careRows, followRows) {
  const previousCare = filterTzdRows(previousTzdBatch("TZD_CM_CarePlanning", careBatch)?.rows);
  const previousFollow = filterTzdRows(previousTzdBatch("TZD_CM_Follow", followBatch)?.rows);
  const stages = [
    ["CasePrepare", "CASE_PREPARE_COUNT", careRows, previousCare, "", Boolean(previousTzdBatch("TZD_CM_CarePlanning", careBatch))],
    ["CarePlan", "DO_CARE_PLAN", followRows, previousFollow, "carePlanBreakdown", Boolean(previousTzdBatch("TZD_CM_Follow", followBatch))],
    ["Follow1", "FOLLOW_1ST", followRows, previousFollow, "follow1Breakdown", Boolean(previousTzdBatch("TZD_CM_Follow", followBatch))],
    ["Follow2", "FOLLOW_2ND", followRows, previousFollow, "follow2Breakdown", Boolean(previousTzdBatch("TZD_CM_Follow", followBatch))]
  ];
  stages.forEach(([name, field, rows, previousRows, breakdownId, hasPrevious]) => {
    const value = sumTzd(rows, field);
    document.getElementById(`metric${name}`).textContent = formatTzdNumber(value);
    renderTzdChange(`metric${name}Change`, value, sumTzd(previousRows, field), hasPrevious);
    if (breakdownId) renderCareBreakdown(breakdownId, rows, field, value);
  });
}

function renderCareBreakdown(id, rows, field, total) {
  document.getElementById(id).innerHTML = TZD_PLAN_STATUSES.map((status, index) => {
    const value = sumTzd(rows.filter(row => String(row.PLAN_STATUS || "").trim() === status), field);
    return `<div class="care-breakdown-row"><span><i class="fas fa-circle mr-1" style="color:${TZD_CARE_STATUS_COLORS[index]}"></i>${escapeTzd(status)}</span><strong>${formatTzdNumber(value)} <span class="font-normal text-slate-400">(${total ? (value / total * 100).toFixed(1) : "0.0"}%)</span></strong></div>`;
  }).join("");
}

function renderTzdChange(id, current, previous, hasPrevious) {
  const element = document.getElementById(id);
  if (!hasPrevious) { element.textContent = "ยังไม่มีรอบก่อนหน้า"; element.className = ""; return; }
  const change = current - previous;
  element.textContent = `${change >= 0 ? "+" : ""}${formatTzdNumber(change)} จากรอบก่อน`;
  element.className = change > 0 ? "text-emerald-600" : change < 0 ? "text-rose-600" : "text-slate-400";
}

function replaceTzdChart(key, canvasId, config) { tzdCharts[key]?.destroy(); tzdCharts[key] = new Chart(document.getElementById(canvasId), config); }
function tzdChartOptions(yTitle) { return { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: yTitle } } } }; }
function tzdRowRoundMonth(row) {
  const explicit = String(row?.ROUND_MONTH || "").trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(explicit)) return explicit;
  const timestamp = parseTzdTimestamp(row?.SUBMITED_TIME);
  if (timestamp === null) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok" }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}
function formatTzdMonth(roundMonth, style = "long") { const [year, month] = String(roundMonth).split("-").map(Number); if (!year || !month) return roundMonth; return new Intl.DateTimeFormat("th-TH", { month: style, year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, month - 1, 15))); }
function formatTzdMonthShort(roundMonth) { return formatTzdMonth(roundMonth, "short"); }
function formatTzdNumber(value) { return Number(value || 0).toLocaleString("th-TH"); }
function emptyTzdRow(colspan) { return `<tr><td colspan="${colspan}" class="p-8 text-center text-slate-400">ยังไม่มีข้อมูลในรอบหรือตัวกรองที่เลือก</td></tr>`; }
function escapeTzd(value) { return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]); }
