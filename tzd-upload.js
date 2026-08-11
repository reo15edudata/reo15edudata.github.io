const TZD_UPLOAD_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const TZD_PROVINCES = {
  "เชียงใหม่": ["เมืองเชียงใหม่", "จอมทอง", "แม่แจ่ม", "เชียงดาว", "ดอยสะเก็ด", "แม่แตง", "แม่ริม", "สะเมิง", "ฝาง", "แม่อาย", "พร้าว", "สันป่าตอง", "สันกำแพง", "สันทราย", "หางดง", "ฮอด", "ดอยเต่า", "อมก๋อย", "สารภี", "เวียงแหง", "ไชยปราการ", "แม่วาง", "แม่ออน", "ดอยหล่อ", "กัลยาณิวัฒนา"],
  "แม่ฮ่องสอน": ["เมืองแม่ฮ่องสอน", "ขุนยวม", "ปาย", "แม่สะเรียง", "แม่ลาน้อย", "สบเมย", "ปางมะผ้า"],
  "ลำปาง": ["เมืองลำปาง", "แม่เมาะ", "เกาะคา", "เสริมงาม", "งาว", "แจ้ห่ม", "วังเหนือ", "เถิน", "แม่พริก", "แม่ทะ", "สบปราบ", "ห้างฉัตร", "เมืองปาน"],
  "ลำพูน": ["เมืองลำพูน", "แม่ทา", "บ้านโฮ่ง", "ลี้", "ทุ่งหัวช้าง", "ป่าซาง", "บ้านธิ", "เวียงหนองล่อง"]
};
const TZD_FINDING_UPDATE_FIELDS = [
  ["TARGET_COUNT", "จำนวนเป้าหมายหลักในการติดตาม"],
  ["FIRSTSCREEN_FOUND_HAVEEVIDENCE", "First Screen และมีหลักฐานครบถ้วน"],
  ["FIRSTSCREEN_FOUND_HAVENTEVIDENCE", "First Screen แล้ว แต่หลักฐานยังไม่ครบ"]
];
const TZD_NEED_HELP_FIELDS = [
  ["NEEDHELP_INFO_SURVEYED", "ยินดีให้ข้อมูล และทำแบบสำรวจแล้ว"],
  ["NEEDHELP_INFO_NOTSURVEY", "ยินดีให้ข้อมูล แต่ยังไม่ได้ทำแบบสำรวจ"]
];
const TZD_STATUS_FIELDS = [
  ["BACKED_TO_EDU", "กลับเข้าศึกษาต่อแล้ว"], ["ALTER_EDU", "อยู่ในการศึกษาทางเลือกตามมาตรา 12"],
  ["STUDY_ABROAD", "ย้ายไปศึกษาต่อต่างประเทศ"], ["GRADUTED_COMPLUSEEDU", "จบการศึกษาภาคบังคับแล้ว"],
  ["WORK_EMPLOY", "มีงานทำ/ประกอบอาชีพแล้ว"], ["HAVE_FAMILY", "มีครอบครัวหรือมีบุตรแล้ว"],
  ["JUSTICE_SYS", "อยู่ในกระบวนการยุติธรรม"], ["WELFARE_CENTER", "อยู่ในสถานสงเคราะห์"],
  ["DRUG_ADDICT", "ติดสารเสพติด ต้องฟื้นฟูสุขภาพ"], ["RELOCATED", "ย้ายภูมิลำเนาหรือสถานศึกษา"],
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
  renderTzdNumberInputs();
  const province = document.getElementById("tzdProvince");
  Object.keys(TZD_PROVINCES).forEach(value => province.add(new Option(value, value)));
  province.addEventListener("change", () => { populateTzdDistricts(); loadExistingTzdValues(); });
  document.getElementById("tzdDistrict").addEventListener("change", loadExistingTzdValues);
  document.getElementById("tzdTopic").addEventListener("change", () => { toggleTzdTopic(); loadExistingTzdValues(); });
  document.querySelectorAll('input[name="roundMode"]').forEach(input => input.addEventListener("change", toggleTzdRoundMode));
  document.getElementById("tzdExistingRound").addEventListener("change", loadExistingTzdValues);
  document.getElementById("requestTzdOtp").addEventListener("click", requestTzdOtp);
  document.getElementById("tzdEmail").addEventListener("input", () => { if (normalizedTzdEmail() !== tzdOtpEmail) tzdOtpEmail = ""; });
  document.getElementById("tzdUploadForm").addEventListener("submit", submitTzdForm);
  toggleTzdTopic();
  try {
    await refreshTzdRounds();
  } catch (error) {
    console.warn(error);
    showTzdUploadStatus("ยังโหลดรายการรอบเดิมไม่ได้ แต่ยังสามารถส่งข้อมูลเป็นรอบใหม่ได้", "info");
  }
}

function renderTzdNumberInputs() {
  document.getElementById("findingUpdateInputs").innerHTML = TZD_FINDING_UPDATE_FIELDS.map(numberFieldHtml).join("");
  document.getElementById("needHelpInputs").innerHTML = TZD_NEED_HELP_FIELDS.map(numberFieldHtml).join("");
  document.getElementById("findingStatusInputs").innerHTML = TZD_STATUS_FIELDS.map(numberFieldHtml).join("");
  document.getElementById("carePlanningInput").innerHTML = numberFieldHtml(["CASE_PREPARE_COUNT", "จำนวนเด็กที่ส่งต่อจัดทำแผนช่วยเหลือ"]);
  document.getElementById("careStatusInputs").innerHTML = TZD_PLAN_STATUSES.map(status => `<tr class="border-t border-slate-100"><th class="p-3 text-left font-medium text-slate-700">${escapeTzdForm(status)}</th>${TZD_STAGE_FIELDS.map(([field, label]) => `<td class="p-3"><label class="sr-only">${escapeTzdForm(label)} — ${escapeTzdForm(status)}</label><input type="number" min="0" step="1" value="0" required data-care-status="${escapeTzdForm(status)}" data-care-stage="${field}" class="care-number"></td>`).join("")}</tr>`).join("");
}

function numberFieldHtml([field, label]) {
  return `<div class="number-field"><label for="field-${field}">${escapeTzdForm(label)}</label><input id="field-${field}" data-tzd-field="${field}" type="number" min="0" step="1" value="0" required></div>`;
}

function populateTzdDistricts() {
  const select = document.getElementById("tzdDistrict");
  select.innerHTML = '<option value="">ทั้งจังหวัด</option>';
  (TZD_PROVINCES[document.getElementById("tzdProvince").value] || []).forEach(value => select.add(new Option(value, value)));
}

function toggleTzdTopic() {
  const survey = document.getElementById("tzdTopic").value === "survey";
  document.getElementById("surveyFields").hidden = !survey;
  document.getElementById("careFields").hidden = survey;
  document.querySelectorAll("#surveyFields input").forEach(input => { input.disabled = !survey; });
  document.querySelectorAll("#careFields input").forEach(input => { input.disabled = survey; });
}

function toggleTzdRoundMode() {
  const edit = selectedRoundMode() === "edit";
  const select = document.getElementById("tzdExistingRound");
  select.disabled = !edit;
  select.required = edit;
  if (!edit) select.value = "";
  loadExistingTzdValues();
}

function selectedRoundMode() { return document.querySelector('input[name="roundMode"]:checked').value; }
function selectedScopeDistrict() { return document.getElementById("tzdDistrict").value || "ทั้งจังหวัด"; }

async function refreshTzdRounds() {
  const datasets = await Promise.all(TZD_PUBLIC_SHEETS.map(fetchTzdSheet));
  TZD_PUBLIC_SHEETS.forEach((sheet, index) => { tzdExistingRows[sheet] = datasets[index]; });
  const timestamps = new Set(datasets.flat().map(row => parseTzdFormTimestamp(row.SUBMITED_TIME)).filter(value => value !== null));
  tzdRounds = [...timestamps].sort((a, b) => a - b).map((timestamp, index) => ({ timestamp, round: index + 1 }));
  const select = document.getElementById("tzdExistingRound");
  select.innerHTML = '<option value="">-- เลือกรอบที่แก้ไข --</option>' + [...tzdRounds].reverse().map(item => `<option value="${item.timestamp}">รอบที่ ${item.round} · ${formatTzdFormDate(item.timestamp)}</option>`).join("");
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

function loadExistingTzdValues() {
  resetTzdValues();
  if (selectedRoundMode() !== "edit") return;
  const timestamp = Number(document.getElementById("tzdExistingRound").value);
  const province = document.getElementById("tzdProvince").value;
  if (!timestamp || !province) return;
  const district = selectedScopeDistrict();
  const topic = document.getElementById("tzdTopic").value;
  const matching = sheet => tzdExistingRows[sheet].filter(row =>
    parseTzdFormTimestamp(row.SUBMITED_TIME) === timestamp &&
    String(row.PROV_NAME || "").trim() === province &&
    String(row.DISTRICT || "").trim() === district
  );
  if (topic === "survey") {
    fillAggregateFields(matching("TZD_Finding_Update"), TZD_FINDING_UPDATE_FIELDS.map(([field]) => field));
    fillAggregateFields(matching("TZD_Finding_Status"), [...TZD_NEED_HELP_FIELDS, ...TZD_STATUS_FIELDS].map(([field]) => field));
  } else {
    fillAggregateFields(matching("TZD_CM_CarePlanning"), ["CASE_PREPARE_COUNT"]);
    const rows = matching("TZD_CM_Follow");
    rows.forEach(row => TZD_STAGE_FIELDS.forEach(([field]) => {
      const input = [...document.querySelectorAll("[data-care-status]")].find(element => element.dataset.careStatus === String(row.PLAN_STATUS || "").trim() && element.dataset.careStage === field);
      if (input) input.value = numberTzdForm(row[field]);
    }));
  }
}

function fillAggregateFields(rows, fields) {
  fields.forEach(field => {
    const input = document.querySelector(`[data-tzd-field="${field}"]`);
    if (input) input.value = rows.reduce((sum, row) => sum + numberTzdForm(row[field]), 0);
  });
}

function resetTzdValues() { document.querySelectorAll('[data-tzd-field], [data-care-status]').forEach(input => { input.value = 0; }); }

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
  if (email !== tzdOtpEmail) return showTzdUploadStatus("กรุณาขอรหัส OTP สำหรับอีเมลนี้ก่อน", "error");
  if (!/^\d{6}$/.test(otp)) return showTzdUploadStatus("กรุณากรอกรหัส OTP 6 หลัก", "error");
  if (!document.getElementById("tzdConfirm").checked) return showTzdUploadStatus("กรุณายืนยันความถูกต้องของข้อมูล", "error");
  const mode = selectedRoundMode();
  const roundTimestamp = document.getElementById("tzdExistingRound").value;
  if (mode === "edit" && !roundTimestamp) return showTzdUploadStatus("กรุณาเลือกรอบที่ต้องการแก้ไข", "error");
  const button = document.getElementById("submitTzdUpload");
  button.disabled = true;
  showTzdUploadStatus("กำลังตรวจสอบและบันทึกข้อมูล…", "info");
  try {
    const payload = {
      action: "submitTzdForm", dbKey: "DB_5", email, emailOtp: otp, consent: true,
      website: document.getElementById("tzdWebsite").value,
      mode, roundTimestamp: mode === "edit" ? Number(roundTimestamp) : null,
      province: document.getElementById("tzdProvince").value,
      district: selectedScopeDistrict(), topic: document.getElementById("tzdTopic").value,
      values: collectTzdFormValues()
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

function collectTzdFormValues() {
  const topic = document.getElementById("tzdTopic").value;
  if (topic === "survey") {
    return Object.fromEntries([...TZD_FINDING_UPDATE_FIELDS, ...TZD_NEED_HELP_FIELDS, ...TZD_STATUS_FIELDS].map(([field]) => [field, readTzdNumber(`[data-tzd-field="${field}"]`)]));
  }
  return {
    CASE_PREPARE_COUNT: readTzdNumber('[data-tzd-field="CASE_PREPARE_COUNT"]'),
    careStatuses: TZD_PLAN_STATUSES.map(status => ({
      PLAN_STATUS: status,
      ...Object.fromEntries(TZD_STAGE_FIELDS.map(([field]) => [field, readTzdNumber(`[data-care-status="${status}"][data-care-stage="${field}"]`)]))
    }))
  };
}

function readTzdNumber(selector) {
  const value = Number(document.querySelector(selector)?.value);
  if (!Number.isFinite(value) || value < 0) throw new Error("ทุกช่องต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
  return value;
}

function normalizedTzdEmail() { return document.getElementById("tzdEmail").value.trim().toLowerCase(); }
async function postTzdForm(payload) { const response = await fetch(TZD_UPLOAD_URL, { method: "POST", body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`ระบบตอบกลับ HTTP ${response.status}`); return response.json(); }
function numberTzdForm(value) { const number = Number(String(value ?? 0).replace(/,/g, "").trim()); return Number.isFinite(number) ? number : 0; }
function parseTzdFormTimestamp(value) { if (typeof value === "number" && value < 100000) return Date.UTC(1899, 11, 30) + value * 86400000 - 7 * 3600000; const timestamp = new Date(value).getTime(); return Number.isNaN(timestamp) ? null : timestamp; }
function formatTzdFormDate(timestamp) { return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(timestamp)); }
function showTzdUploadStatus(message, type) { const status = document.getElementById("tzdUploadStatus"); status.hidden = false; status.textContent = message; status.className = `rounded-lg border px-4 py-3 text-sm lg:col-span-2 ${type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-blue-200 bg-blue-50 text-blue-800"}`; }
function escapeTzdForm(value) { return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]); }
