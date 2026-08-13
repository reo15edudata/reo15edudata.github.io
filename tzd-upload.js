const TZD_UPLOAD_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const TZD_PROVINCES = {
  "เชียงใหม่": ["เมืองเชียงใหม่", "จอมทอง", "แม่แจ่ม", "เชียงดาว", "ดอยสะเก็ด", "แม่แตง", "แม่ริม", "สะเมิง", "ฝาง", "แม่อาย", "พร้าว", "สันป่าตอง", "สันกำแพง", "สันทราย", "หางดง", "ฮอด", "ดอยเต่า", "อมก๋อย", "สารภี", "เวียงแหง", "ไชยปราการ", "แม่วาง", "แม่ออน", "ดอยหล่อ", "กัลยาณิวัฒนา"],
  "แม่ฮ่องสอน": ["เมืองแม่ฮ่องสอน", "ขุนยวม", "ปาย", "แม่สะเรียง", "แม่ลาน้อย", "สบเมย", "ปางมะผ้า"],
  "ลำปาง": ["เมืองลำปาง", "แม่เมาะ", "เกาะคา", "เสริมงาม", "งาว", "แจ้ห่ม", "วังเหนือ", "เถิน", "แม่พริก", "แม่ทะ", "สบปราบ", "ห้างฉัตร", "เมืองปาน"],
  "ลำพูน": ["เมืองลำพูน", "แม่ทา", "บ้านโฮ่ง", "ลี้", "ทุ่งหัวช้าง", "ป่าซาง", "บ้านธิ", "เวียงหนองล่อง"]
};
const TZD_FINDING_UPDATE_FIELDS = [
  ["TARGET_COUNT", "เป้าหมาย"],
  ["FIRSTSCREEN_FOUND_HAVEEVIDENCE", "ดำเนินการสำรวจและอัปเดตหลักฐานการสำรวจครบถ้วนแล้ว"],
  ["FIRSTSCREEN_FOUND_HAVENTEVIDENCE", "ดำเนินการ First Screen แต่ยังอัปเดตหลักฐานไม่ครบถ้วน"]
];
const TZD_NEED_HELP_FIELDS = [
  ["NEEDHELP_INFO_SURVEYED", "ทำแบบสำรวจแล้ว"],
  ["NEEDHELP_INFO_NOTSURVEY", "ยังไม่ได้ทำแบบสำรวจ"]
];
const TZD_STATUS_FIELDS = [
  ["BACKED_TO_EDU", "กลับเข้าศึกษาต่อแล้ว"], ["ALTER_EDU", "อยู่ในการศึกษาทางเลือกตามมาตรา 12 (เช่น บ้านเรียน ศูนย์การเรียน)"],
  ["STUDY_ABROAD", "ย้ายไปศึกษาต่อต่างประเทศ"], ["GRADUTED_COMPLUSEEDU", "จบการศึกษาภาคบังคับแล้ว ไม่ต้องการความช่วยเหลือ"],
  ["WORK_EMPLOY", "มีงานทำ/ประกอบอาชีพแล้ว ไม่ต้องการความช่วยเหลือ"], ["HAVE_FAMILY", "มีครอบครัวหรือมีบุตรแล้ว ดูแลตัวเองได้ ไม่ต้องการความช่วยเหลือ"],
  ["JUSTICE_SYS", "อยู่ในกระบวนการยุติธรรม (เช่น อยู่ในความดูแลของสถานพินิจฯ หรือศูนย์ฝึกอบรมฯ)"], ["WELFARE_CENTER", "อยู่ในสถานสงเคราะห์"],
  ["DRUG_ADDICT", "ติดสารเสพติด ต้องฟื้นฟูสุขภาพ ยังไม่พร้อมเข้าสู่การศึกษาหรือการเรียนรู้"], ["RELOCATED", "ย้ายภูมิลำเนาหรือย้ายสถานศึกษา"],
  ["CANT_FIND_HOUSE", "หาบ้านไม่พบ"], ["DONT_NEED_HELP", "ไม่ต้องการความช่วยเหลือ"],
  ["DECEASED", "เสียชีวิต"]
];
const TZD_PLAN_STATUSES = ["ยังไม่ได้ดำเนินการ", "รอ CMS ยืนยัน", "CMS ยืนยันแล้ว", "ยุติการดูแล"];
const TZD_STAGE_FIELDS = [["DO_CARE_PLAN", "ทำแผนการดูแล"], ["FOLLOW_1ST", "ติดตามรอบที่ 1"], ["FOLLOW_2ND", "ติดตามรอบที่ 2"]];
const TZD_PUBLIC_SHEETS = ["TZD_Finding_Update", "TZD_Finding_Status", "TZD_CM_CarePlanning", "TZD_CM_Follow"];
const tzdExistingRows = Object.fromEntries(TZD_PUBLIC_SHEETS.map(sheet => [sheet, []]));
let tzdOtpEmail = "";
let tzdOtpTimer = null;
let tzdRounds = [];

document.addEventListener("DOMContentLoaded", initTzdForm);

async function initTzdForm() {
  const province = document.getElementById("tzdProvince");
  Object.keys(TZD_PROVINCES).forEach(value => province.add(new Option(value, value)));
  province.addEventListener("change", renderTzdInputTable);
  document.getElementById("tzdTopic").addEventListener("change", renderTzdInputTable);
  document.querySelectorAll('input[name="roundMode"]').forEach(input => input.addEventListener("change", toggleTzdRoundMode));
  document.getElementById("tzdExistingRound").addEventListener("change", fillTzdTableFromExisting);
  document.getElementById("copyPreviousRound").addEventListener("click", copyPreviousTzdRound);
  document.getElementById("requestTzdOtp").addEventListener("click", requestTzdOtp);
  document.getElementById("tzdEmail").addEventListener("input", () => { if (normalizedTzdEmail() !== tzdOtpEmail) tzdOtpEmail = ""; });
  document.getElementById("tzdUploadForm").addEventListener("submit", submitTzdForm);
  document.getElementById("tzdCurrentMonth").textContent = `รอบรายงาน ${formatTzdMonth(currentTzdMonth())}`;
  try {
    await refreshTzdRounds();
  } catch (error) {
    console.warn(error);
    showTzdUploadStatus("ยังโหลดรายการเดือนเดิมไม่ได้ แต่ยังสามารถรายงานเดือนปัจจุบันได้", "info");
  }
}

function renderTzdInputTable() {
  const province = document.getElementById("tzdProvince").value;
  const topic = document.getElementById("tzdTopic").value;
  const districts = TZD_PROVINCES[province] || [];
  document.getElementById("tzdTableEmpty").hidden = Boolean(districts.length);
  document.getElementById("tzdTableWrap").hidden = !districts.length;
  document.getElementById("tzdDistrictCount").textContent = districts.length ? `${province} · ${districts.length} อำเภอ` : "กรุณาเลือกจังหวัด";
  document.getElementById("tzdTableTitle").textContent = topic === "survey" ? "สรุปผลการสำรวจเด็กที่หลุดออกจากระบบ" : "สถานะการจัดทำแผนช่วยเหลือ Care Plan";
  updateCopyPreviousButton();
  if (!districts.length) return;
  if (topic === "survey") renderSurveyTable(districts);
  else renderCareTable(districts);
  fillTzdTableFromExisting();
}

function renderSurveyTable(districts) {
  const fields = [...TZD_FINDING_UPDATE_FIELDS, ...TZD_NEED_HELP_FIELDS, ...TZD_STATUS_FIELDS];
  document.getElementById("tzdTableHead").innerHTML = `<tr><th rowspan="2" class="district-cell">อำเภอ</th><th colspan="3">เป้าหมายและ First Screen</th><th colspan="2">ยินดีให้ข้อมูล</th><th colspan="13">สถานะผลการติดตามอื่น</th></tr><tr>${fields.map(([, label]) => `<th class="field-head">${escapeTzdForm(label)}</th>`).join("")}</tr>`;
  document.getElementById("tzdTableBody").innerHTML = districts.map((district, districtIndex) => `<tr><td class="district-cell">${escapeTzdForm(district)}</td>${fields.map(([field, label]) => tableNumberInput(districtIndex, field, `${district} — ${label}`)).join("")}</tr>`).join("");
}

function renderCareTable(districts) {
  document.getElementById("tzdTableHead").innerHTML = `<tr><th rowspan="2" class="district-cell">อำเภอ</th><th rowspan="2" class="field-head">ส่งต่อจัดทำแผน</th>${TZD_STAGE_FIELDS.map(([, label]) => `<th colspan="4">${escapeTzdForm(label)}</th>`).join("")}</tr><tr>${TZD_STAGE_FIELDS.flatMap(() => TZD_PLAN_STATUSES).map(status => `<th class="field-head">${escapeTzdForm(status)}</th>`).join("")}</tr>`;
  document.getElementById("tzdTableBody").innerHTML = districts.map((district, districtIndex) => `<tr><td class="district-cell">${escapeTzdForm(district)}</td>${tableNumberInput(districtIndex, "CASE_PREPARE_COUNT", `${district} — ส่งต่อจัดทำแผน`)}${TZD_STAGE_FIELDS.map(([field, label]) => TZD_PLAN_STATUSES.map((status, statusIndex) => tableNumberInput(districtIndex, field, `${district} — ${label} — ${status}`, statusIndex)).join("")).join("")}</tr>`).join("");
}

function tableNumberInput(districtIndex, field, label, statusIndex = "") {
  return `<td><label class="sr-only">${escapeTzdForm(label)}</label><input type="number" min="0" step="1" value="0" required class="table-number" data-district-index="${districtIndex}" data-field="${field}"${statusIndex === "" ? "" : ` data-status-index="${statusIndex}"`}></td>`;
}

function toggleTzdRoundMode() {
  const edit = selectedRoundMode() === "edit";
  const select = document.getElementById("tzdExistingRound");
  select.hidden = !edit;
  select.disabled = !edit;
  select.required = edit;
  document.getElementById("tzdCurrentMonth").hidden = edit;
  if (!edit) select.value = "";
  renderTzdInputTable();
  updateCopyPreviousButton();
}

function selectedRoundMode() { return document.querySelector('input[name="roundMode"]:checked').value; }

async function refreshTzdRounds() {
  const datasets = await Promise.all(TZD_PUBLIC_SHEETS.map(fetchTzdSheet));
  TZD_PUBLIC_SHEETS.forEach((sheet, index) => { tzdExistingRows[sheet] = datasets[index]; });
  const months = new Set(datasets.flat().map(tzdRowMonth).filter(Boolean));
  tzdRounds = [...months].sort();
  const select = document.getElementById("tzdExistingRound");
  select.innerHTML = '<option value="">-- เลือกรอบเดือนที่แก้ไข --</option>' + [...tzdRounds].reverse().map(month => `<option value="${month}">${formatTzdMonth(month)}</option>`).join("");
  updateCopyPreviousButton();
}

async function fetchTzdSheet(sheetName) {
  const rows = [];
  let offset = 0;
  while (true) {
    const url = new URL(TZD_UPLOAD_URL);
    url.searchParams.set("dbKey", "DB_5");
    url.searchParams.set("sheetName", sheetName);
    url.searchParams.set("limit", "10000");
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || `โหลด ${sheetName} ไม่สำเร็จ`);
    rows.push(...(result.data || []));
    if (!result.hasMore || !result.data?.length) break;
    offset += result.data.length;
  }
  return rows;
}

function fillTzdTableFromExisting() {
  document.querySelectorAll("#tzdTableBody .table-number").forEach(input => { input.value = 0; });
  updateCopyPreviousButton();
  if (selectedRoundMode() !== "edit") return;
  const roundMonth = document.getElementById("tzdExistingRound").value;
  const province = document.getElementById("tzdProvince").value;
  if (!roundMonth || !province) return;
  const topic = document.getElementById("tzdTopic").value;
  const districts = TZD_PROVINCES[province] || [];
  const matching = sheet => latestTzdRowsForMonth(tzdExistingRows[sheet], roundMonth).filter(row => String(row.PROV_NAME || "").trim() === province);
  if (topic === "survey") {
    fillTzdDistrictFields(matching("TZD_Finding_Update"), districts, TZD_FINDING_UPDATE_FIELDS.map(([field]) => field));
    fillTzdDistrictFields(matching("TZD_Finding_Status"), districts, [...TZD_NEED_HELP_FIELDS, ...TZD_STATUS_FIELDS].map(([field]) => field));
  } else {
    fillTzdDistrictFields(matching("TZD_CM_CarePlanning"), districts, ["CASE_PREPARE_COUNT"]);
    matching("TZD_CM_Follow").forEach(row => {
      const districtIndex = districts.indexOf(String(row.DISTRICT || "").trim());
      const statusIndex = TZD_PLAN_STATUSES.indexOf(String(row.PLAN_STATUS || "").trim());
      if (districtIndex < 0 || statusIndex < 0) return;
      TZD_STAGE_FIELDS.forEach(([field]) => setTzdTableValue(districtIndex, field, row[field], statusIndex));
    });
  }
}

function copyPreviousTzdRound() {
  const province = document.getElementById("tzdProvince").value;
  const topic = document.getElementById("tzdTopic").value;
  const targetMonth = targetTzdRoundMonth();
  if (!province) return showTzdUploadStatus("กรุณาเลือกจังหวัดก่อนดึงข้อมูล", "error");
  if (!targetMonth) return showTzdUploadStatus("กรุณาเลือกรอบเดือนที่ต้องการแก้ไข", "error");
  const sourceMonth = previousTzdMonthWithData(targetMonth, province, topic);
  if (!sourceMonth) return showTzdUploadStatus("ไม่พบข้อมูลรอบก่อนหน้าของจังหวัดและหัวข้อนี้", "error");
  fillTzdTableForMonth(sourceMonth, province, topic);
  showTzdUploadStatus(`ดึงข้อมูลรอบเดือน ${formatTzdMonth(sourceMonth)} มาใส่ในตารางแล้ว กรุณาตรวจสอบและแก้ไขก่อนบันทึก`, "info");
}

function fillTzdTableForMonth(roundMonth, province, topic) {
  document.querySelectorAll("#tzdTableBody .table-number").forEach(input => { input.value = 0; });
  const districts = TZD_PROVINCES[province] || [];
  const matching = sheet => latestTzdRowsForMonth(tzdExistingRows[sheet], roundMonth).filter(row => String(row.PROV_NAME || "").trim() === province);
  if (topic === "survey") {
    fillTzdDistrictFields(matching("TZD_Finding_Update"), districts, TZD_FINDING_UPDATE_FIELDS.map(([field]) => field));
    fillTzdDistrictFields(matching("TZD_Finding_Status"), districts, [...TZD_NEED_HELP_FIELDS, ...TZD_STATUS_FIELDS].map(([field]) => field));
  } else {
    fillTzdDistrictFields(matching("TZD_CM_CarePlanning"), districts, ["CASE_PREPARE_COUNT"]);
    matching("TZD_CM_Follow").forEach(row => {
      const districtIndex = districts.indexOf(String(row.DISTRICT || "").trim());
      const statusIndex = TZD_PLAN_STATUSES.indexOf(String(row.PLAN_STATUS || "").trim());
      if (districtIndex < 0 || statusIndex < 0) return;
      TZD_STAGE_FIELDS.forEach(([field]) => setTzdTableValue(districtIndex, field, row[field], statusIndex));
    });
  }
}

function targetTzdRoundMonth() {
  return selectedRoundMode() === "edit" ? document.getElementById("tzdExistingRound").value : currentTzdMonth();
}

function previousTzdMonthWithData(targetMonth, province, topic) {
  const sheets = topic === "survey" ? ["TZD_Finding_Update", "TZD_Finding_Status"] : ["TZD_CM_CarePlanning", "TZD_CM_Follow"];
  return [...tzdRounds].reverse().find(month => month < targetMonth && sheets.some(sheet => tzdExistingRows[sheet].some(row => tzdRowMonth(row) === month && String(row.PROV_NAME || "").trim() === province))) || "";
}

function updateCopyPreviousButton() {
  const button = document.getElementById("copyPreviousRound");
  if (!button) return;
  const province = document.getElementById("tzdProvince").value;
  const targetMonth = targetTzdRoundMonth();
  button.disabled = !province || !targetMonth || !previousTzdMonthWithData(targetMonth, province, document.getElementById("tzdTopic").value);
}

function fillTzdDistrictFields(rows, districts, fields) {
  rows.forEach(row => {
    const districtIndex = districts.indexOf(String(row.DISTRICT || "").trim());
    if (districtIndex < 0) return;
    fields.forEach(field => setTzdTableValue(districtIndex, field, row[field]));
  });
}

function setTzdTableValue(districtIndex, field, value, statusIndex = null) {
  const statusSelector = statusIndex === null ? ":not([data-status-index])" : `[data-status-index="${statusIndex}"]`;
  const input = document.querySelector(`[data-district-index="${districtIndex}"][data-field="${field}"]${statusSelector}`);
  if (input) input.value = numberTzdForm(value);
}

function latestTzdRowsForMonth(rows, month) {
  const latest = new Map();
  rows.filter(row => tzdRowMonth(row) === month).forEach(row => {
    const key = [row.PROV_NAME, row.DISTRICT, row.PLAN_STATUS || ""].map(value => String(value || "").trim()).join("|");
    const timestamp = parseTzdFormTimestamp(row.SUBMITED_TIME) || 0;
    if (!latest.has(key) || timestamp >= latest.get(key).timestamp) latest.set(key, { row, timestamp });
  });
  return [...latest.values()].map(item => item.row);
}

async function requestTzdOtp() {
  const email = normalizedTzdEmail();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showTzdUploadStatus("กรุณากรอกอีเมลให้ถูกต้อง", "error");
  const button = document.getElementById("requestTzdOtp");
  button.disabled = true;
  showTzdUploadStatus("กำลังส่งรหัส OTP ไปยังอีเมล…", "info");
  try {
    const result = await postTzdForm({ action: "requestTzdUploadOtp", email, website: document.getElementById("tzdWebsite").value });
    if (!result.success) throw new Error(result.message || "ส่งรหัสไม่สำเร็จ");
    tzdOtpEmail = email;
    showTzdUploadStatus("ส่งรหัส OTP แล้ว กรุณาตรวจสอบกล่องจดหมายและโฟลเดอร์ Spam", "success");
    startTzdOtpCooldown(60);
  } catch (error) { showTzdUploadStatus(error.message, "error"); button.disabled = false; }
}

function startTzdOtpCooldown(seconds) {
  clearInterval(tzdOtpTimer);
  const button = document.getElementById("requestTzdOtp");
  let remaining = seconds;
  button.disabled = true;
  button.textContent = `ขอรหัสใหม่ใน ${remaining} วินาที`;
  tzdOtpTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) { clearInterval(tzdOtpTimer); button.disabled = false; button.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>ส่งรหัส OTP'; }
    else button.textContent = `ขอรหัสใหม่ใน ${remaining} วินาที`;
  }, 1000);
}

async function submitTzdForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const email = normalizedTzdEmail();
  const otp = document.getElementById("tzdOtp").value.trim();
  const province = document.getElementById("tzdProvince").value;
  if (!province || !TZD_PROVINCES[province]) return showTzdUploadStatus("กรุณาเลือกจังหวัด", "error");
  if (email !== tzdOtpEmail) return showTzdUploadStatus("กรุณาขอรหัส OTP สำหรับอีเมลนี้ก่อน", "error");
  if (!/^\d{6}$/.test(otp)) return showTzdUploadStatus("กรุณากรอกรหัส OTP 6 หลัก", "error");
  if (!document.getElementById("tzdConfirm").checked) return showTzdUploadStatus("กรุณายืนยันความถูกต้องของข้อมูล", "error");
  const mode = selectedRoundMode();
  const roundMonth = mode === "edit" ? document.getElementById("tzdExistingRound").value : currentTzdMonth();
  if (!roundMonth) return showTzdUploadStatus("กรุณาเลือกรอบเดือนที่ต้องการแก้ไข", "error");
  const button = document.getElementById("submitTzdUpload");
  button.disabled = true;
  showTzdUploadStatus(`กำลังตรวจสอบและบันทึกข้อมูล ${TZD_PROVINCES[province].length} อำเภอ…`, "info");
  try {
    const payload = {
      action: "submitTzdForm", dbKey: "DB_5", email, emailOtp: otp, consent: true,
      website: document.getElementById("tzdWebsite").value,
      mode, roundMonth, province, topic: document.getElementById("tzdTopic").value,
      rows: collectTzdTableRows(province)
    };
    const result = await postTzdForm(payload);
    if (!result.success) throw new Error(result.message || "บันทึกข้อมูลไม่สำเร็จ");
    showTzdUploadStatus(`บันทึกสำเร็จ ${result.message}`, "success");
    tzdOtpEmail = "";
    document.getElementById("tzdOtp").value = "";
    await refreshTzdRounds();
  } catch (error) { console.error(error); showTzdUploadStatus(error.message, "error"); }
  finally { button.disabled = false; }
}

function collectTzdTableRows(province) {
  const topic = document.getElementById("tzdTopic").value;
  return TZD_PROVINCES[province].map((district, districtIndex) => {
    if (topic === "survey") {
      const fields = [...TZD_FINDING_UPDATE_FIELDS, ...TZD_NEED_HELP_FIELDS, ...TZD_STATUS_FIELDS];
      return { district, values: Object.fromEntries(fields.map(([field]) => [field, readTzdTableNumber(districtIndex, field)])) };
    }
    return {
      district,
      values: {
        CASE_PREPARE_COUNT: readTzdTableNumber(districtIndex, "CASE_PREPARE_COUNT"),
        careStatuses: TZD_PLAN_STATUSES.map((status, statusIndex) => ({
          PLAN_STATUS: status,
          ...Object.fromEntries(TZD_STAGE_FIELDS.map(([field]) => [field, readTzdTableNumber(districtIndex, field, statusIndex)]))
        }))
      }
    };
  });
}

function readTzdTableNumber(districtIndex, field, statusIndex = null) {
  const statusSelector = statusIndex === null ? ":not([data-status-index])" : `[data-status-index="${statusIndex}"]`;
  const input = document.querySelector(`[data-district-index="${districtIndex}"][data-field="${field}"]${statusSelector}`);
  const value = Number(input?.value);
  if (!Number.isFinite(value) || value < 0) throw new Error("ทุกช่องต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
  return value;
}

function currentTzdMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Bangkok" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  let year = Number(values.year);
  let month = Number(values.month);
  if (Number(values.day) <= 5) {
    month--;
    if (month === 0) { month = 12; year--; }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function tzdRowMonth(row) {
  const explicit = String(row?.ROUND_MONTH || "").trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(explicit)) return explicit;
  const timestamp = parseTzdFormTimestamp(row?.SUBMITED_TIME);
  if (timestamp === null) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok" }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function formatTzdMonth(month) {
  const match = String(month).match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 15)));
}

function normalizedTzdEmail() { return document.getElementById("tzdEmail").value.trim().toLowerCase(); }
async function postTzdForm(payload) { const response = await fetch(TZD_UPLOAD_URL, { method: "POST", body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`ระบบตอบกลับ HTTP ${response.status}`); return response.json(); }
function numberTzdForm(value) { const number = Number(String(value ?? 0).replace(/,/g, "").trim()); return Number.isFinite(number) ? number : 0; }
function parseTzdFormTimestamp(value) { if (typeof value === "number" && value < 100000) return Date.UTC(1899, 11, 30) + value * 86400000 - 7 * 3600000; const timestamp = new Date(value).getTime(); return Number.isNaN(timestamp) ? null : timestamp; }
function showTzdUploadStatus(message, type) { const status = document.getElementById("tzdUploadStatus"); status.hidden = false; status.textContent = message; status.className = `rounded-lg border px-4 py-3 text-sm lg:col-span-2 ${type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-blue-200 bg-blue-50 text-blue-800"}`; }
function escapeTzdForm(value) { return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]); }
