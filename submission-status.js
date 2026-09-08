const SUBMISSION_STATUS_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const STATUS_LABELS = {
  PENDING: "กำลังพิจารณา",
  APPROVED: "อนุมัติแล้ว",
  REVISION_REQUIRED: "ขอให้แก้ไข",
  REJECTED: "ไม่อนุมัติ"
};
const STATUS_EXPLANATIONS = {
  PENDING: "ผู้ดูแลได้รับข้อมูลแล้วและกำลังตรวจสอบ ยังไม่เผยแพร่บน Dashboard ในระหว่างนี้",
  APPROVED: "ข้อมูลผ่านการตรวจสอบและพร้อมแสดงบน Dashboard แล้ว",
  REVISION_REQUIRED: "ผู้ดูแลขอให้ปรับข้อมูลบางส่วน อ่านหมายเหตุด้านบนแล้วเปิดแบบฟอร์มแก้ไขเพื่อส่งกลับไปตรวจสอบอีกครั้ง",
  REJECTED: "รายการนี้ไม่ผ่านการพิจารณา หากต้องการข้อมูลเพิ่มเติม กรุณาติดต่อผู้ดูแลระบบ"
};
const EDIT_FIELDS = {
  BUSINESS: [
    ["PROV_NAME", "จังหวัด", "select", ["เชียงใหม่", "แม่ฮ่องสอน", "ลำพูน", "ลำปาง"]],
    ["BUSINESS_TYPE", "ประเภทสถานประกอบการ", "text"],
    ["BUSINESS_NAME", "ชื่อสถานประกอบการ", "text"],
    ["COORDI", "พิกัดละติจูด, ลองจิจูด", "text"],
    ["BUSINESS_DETAILS", "รายละเอียดสถานประกอบการและงานที่เปิดรับ", "textarea", null, true],
    ["BUSINESS_PAY", "ค่าตอบแทน (บาท/ชั่วโมง)", "number"],
    ["BUSINESS_CONTACT", "ช่องทางติดต่อ", "text"]
  ],
  STUDENT: [
    ["STUDENT_NAME", "ชื่อ–นามสกุล", "text"],
    ["GENDER", "เพศ", "select", ["ชาย", "หญิง", "เพศหลากหลาย", "ไม่ประสงค์ระบุ"]],
    ["SCHOOL_NAME", "สถานศึกษาที่กำลังศึกษา", "text"],
    ["EDU_LEVEL", "ระดับการศึกษา", "text"],
    ["DESCRIPTION_STUDENT", "แนะนำตัวและความสนใจ", "textarea", null, true],
    ["LOOKING_WORK", "งานที่สนใจ", "text"],
    ["AVAILABLE_TIME", "ช่วงเวลาที่พร้อม", "text"],
    ["PORTFOLIO_LINK", "Portfolio หรือผลงาน", "url"],
    ["STUDENT_CONTRACT", "ช่องทางติดต่อ", "text"]
  ]
};

const revisionSkills = new Set();
let currentSubmission = null;
let otpRequestedKey = "";
let otpCooldownTimer = null;

const lookupForm = document.getElementById("statusLookupForm");
const revisionForm = document.getElementById("revisionForm");
lookupForm.addEventListener("submit", checkSubmissionStatus);
revisionForm.addEventListener("submit", submitRevision);
document.getElementById("requestStatusOtp").addEventListener("click", requestStatusOtp);
document.getElementById("openRevisionForm").addEventListener("click", openRevisionForm);
document.getElementById("closeRevisionForm").addEventListener("click", () => { revisionForm.hidden = true; });
document.getElementById("revisionSkillSearch").addEventListener("input", renderRevisionSkills);
document.getElementById("revisionSkillGroup").addEventListener("change", renderRevisionSkills);
document.getElementById("revisionSkillResults").addEventListener("change", handleRevisionSkillChange);
document.getElementById("revisionSelectedSkills").addEventListener("click", removeRevisionSkill);
["submissionCode", "submissionEmail"].forEach(id => document.getElementById(id).addEventListener("input", invalidateStatusOtp));

initializeStatusPage();

function initializeStatusPage() {
  const code = new URLSearchParams(location.search).get("code");
  if (/^\d{11}$/.test(String(code || ""))) document.getElementById("submissionCode").value = code;
  const groupSelect = document.getElementById("revisionSkillGroup");
  WEF_SKILL_GROUPS.forEach(group => groupSelect.add(new Option(WEF_SKILL_GROUP_TRANSLATIONS[group.group] || group.group, group.group)));
}

function lookupKey() {
  return `${document.getElementById("submissionCode").value.replace(/\s/g, "")}|${document.getElementById("submissionEmail").value.trim().toLowerCase()}`;
}

function invalidateStatusOtp() {
  if (!otpRequestedKey || lookupKey() === otpRequestedKey) return;
  otpRequestedKey = "";
  document.getElementById("submissionOtp").value = "";
  document.getElementById("submissionOtp").disabled = true;
  document.getElementById("statusOtpFields").hidden = true;
  document.getElementById("checkSubmissionStatus").disabled = true;
  hideSubmissionResult();
  showStatusMessage("รหัสติดตามหรืออีเมลถูกเปลี่ยน กรุณาขอรหัสยืนยันใหม่", "info");
}

async function requestStatusOtp() {
  if (!lookupForm.reportValidity()) return;
  const code = document.getElementById("submissionCode").value.replace(/\s/g, "");
  const email = document.getElementById("submissionEmail").value.trim().toLowerCase();
  const button = document.getElementById("requestStatusOtp");
  button.disabled = true;
  showStatusMessage("กำลังตรวจสอบรายการและส่งรหัสยืนยัน…", "info");
  try {
    const result = await postStatusAction({
      action: "requestSubmissionStatusOtp",
      code,
      email,
      website: document.getElementById("statusWebsite").value
    });
    if (!result.success) throw new Error(result.message || "ส่งรหัสยืนยันไม่สำเร็จ");
    otpRequestedKey = `${code}|${email}`;
    const otpField = document.getElementById("statusOtpFields");
    const otpInput = document.getElementById("submissionOtp");
    otpField.hidden = false;
    otpInput.disabled = false;
    document.getElementById("checkSubmissionStatus").disabled = false;
    otpInput.focus();
    showStatusMessage("ส่งรหัสแล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์อีเมลขยะ รหัสมีอายุ 10 นาที", "success");
    startOtpCooldown(60);
  } catch (error) {
    showStatusMessage(error.message, "error");
    button.disabled = false;
  }
}

function startOtpCooldown(seconds) {
  clearInterval(otpCooldownTimer);
  const button = document.getElementById("requestStatusOtp");
  let remaining = seconds;
  button.textContent = `ส่งใหม่ได้ใน ${remaining} วินาที`;
  otpCooldownTimer = setInterval(() => {
    remaining--;
    button.textContent = remaining > 0 ? `ส่งใหม่ได้ใน ${remaining} วินาที` : "ส่งรหัสยืนยันใหม่";
    if (remaining <= 0) { clearInterval(otpCooldownTimer); button.disabled = false; }
  }, 1000);
}

async function checkSubmissionStatus(event) {
  event.preventDefault();
  if (!lookupForm.reportValidity()) return;
  if (!otpRequestedKey || lookupKey() !== otpRequestedKey) return showStatusMessage("กรุณาขอรหัสยืนยันสำหรับรายการนี้ก่อน", "error");
  const button = document.getElementById("checkSubmissionStatus");
  button.disabled = true;
  showStatusMessage("กำลังเปิดข้อมูลที่ยืนยันแล้ว…", "info");
  try {
    const result = await postStatusAction({
      action: "getOwnSubmission",
      code: document.getElementById("submissionCode").value.replace(/\s/g, ""),
      email: document.getElementById("submissionEmail").value.trim().toLowerCase(),
      emailOtp: document.getElementById("submissionOtp").value.trim()
    });
    if (!result.success) throw new Error(result.message || "ตรวจสอบสถานะไม่สำเร็จ");
    currentSubmission = result.data;
    renderSubmissionResult();
    showStatusMessage("ยืนยันตัวตนสำเร็จ", "success");
  } catch (error) {
    hideSubmissionResult();
    showStatusMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function renderSubmissionResult() {
  const status = currentSubmission.status;
  document.getElementById("statusPrivacyPanel").hidden = true;
  const result = document.getElementById("statusResult");
  result.hidden = false;
  document.getElementById("submissionType").textContent = currentSubmission.typeLabel;
  document.getElementById("submissionResultCode").textContent = currentSubmission.code;
  const badge = document.getElementById("submissionStatusBadge");
  badge.textContent = STATUS_LABELS[status] || status;
  badge.dataset.status = status;
  document.getElementById("submissionCreatedTime").textContent = formatSubmissionTime(currentSubmission.submittedTime);
  document.getElementById("submissionUpdatedTime").textContent = `อัปเดตล่าสุด ${formatSubmissionTime(currentSubmission.updatedTime)}`;
  document.getElementById("submissionReviewedTime").textContent = currentSubmission.reviewedTime ? formatSubmissionTime(currentSubmission.reviewedTime) : "รอผลการพิจารณา";
  const reviewStep = document.getElementById("reviewStep");
  const decisionStep = document.getElementById("decisionStep");
  reviewStep.className = "status-step is-done";
  decisionStep.className = `status-step ${status === "PENDING" ? "" : status === "REVISION_REQUIRED" ? "is-warning" : status === "REJECTED" ? "is-error" : "is-done"}`;
  document.getElementById("decisionStepTitle").textContent = STATUS_LABELS[status] || "ผลการพิจารณา";
  const notePanel = document.getElementById("reviewNotePanel");
  notePanel.hidden = !currentSubmission.reviewNote || !["REVISION_REQUIRED", "REJECTED"].includes(status);
  document.getElementById("submissionReviewNote").textContent = currentSubmission.reviewNote || "";
  document.getElementById("submissionStatusExplanation").textContent = STATUS_EXPLANATIONS[status] || "";
  document.getElementById("openRevisionForm").hidden = !currentSubmission.canEdit;
  revisionForm.hidden = true;
}

function hideSubmissionResult() {
  currentSubmission = null;
  document.getElementById("statusResult").hidden = true;
  document.getElementById("statusPrivacyPanel").hidden = false;
  revisionForm.hidden = true;
}

function openRevisionForm() {
  if (!currentSubmission?.canEdit) return;
  renderRevisionForm();
  revisionForm.hidden = false;
  revisionForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRevisionForm() {
  const fields = EDIT_FIELDS[currentSubmission.type] || [];
  const container = document.getElementById("revisionFields");
  container.innerHTML = fields.map(([field, label, type, options, full]) => {
    const id = `revision-${field}`;
    const required = field !== "PORTFOLIO_LINK" && field !== "BUSINESS_PAY";
    let control;
    if (type === "textarea") control = `<textarea id="${id}" name="${field}" class="submission-control" rows="5" ${required ? "required" : ""}></textarea>`;
    else if (type === "select") control = `<select id="${id}" name="${field}" class="submission-control" ${required ? "required" : ""}><option value="">— เลือกข้อมูล —</option>${options.map(option => `<option>${escapeStatusHtml(option)}</option>`).join("")}</select>`;
    else control = `<input id="${id}" name="${field}" type="${type}" class="submission-control" ${type === "number" ? 'min="0" max="100000" step="0.01"' : ""} ${required ? "required" : ""}>`;
    return `<div class="revision-field ${full ? "full" : ""}"><label for="${id}" class="submission-label">${escapeStatusHtml(label)}${required ? ' <span class="submission-required">*</span>' : ""}</label>${control}</div>`;
  }).join("");
  fields.forEach(([field, , type]) => {
    const value = currentSubmission.data[field] ?? "";
    const input = document.getElementById(`revision-${field}`);
    input.value = type === "number" && !Number.isFinite(Number(value)) ? "" : String(value);
  });
  setupRevisionSkills();
  document.getElementById("revisionConsent").checked = false;
  document.getElementById("revisionMessage").hidden = true;
}

function setupRevisionSkills() {
  const isBusiness = currentSubmission.type === "BUSINESS";
  const field = isBusiness ? "BUSINESS_WANTS" : "TOP_SKILLS";
  revisionSkills.clear();
  String(currentSubmission.data[field] || "").split("|").map(value => value.trim()).filter(Boolean).forEach(skill => revisionSkills.add(skill));
  document.getElementById("revisionSkillsSection").hidden = false;
  document.getElementById("revisionSkillTitle").textContent = isBusiness ? "ทักษะที่ต้องการจากผู้เรียน" : "ทักษะเด่น";
  document.getElementById("revisionSkillGuidance").textContent = isBusiness ? "เลือกอย่างน้อย 1 และไม่เกิน 10 ทักษะ" : "เลือก 3–4 ทักษะ";
  document.getElementById("revisionSkillSearch").value = "";
  document.getElementById("revisionSkillGroup").value = "";
  syncRevisionSkills();
}

function revisionSkillLimits() {
  return currentSubmission?.type === "BUSINESS" ? { min: 1, max: 10 } : { min: 3, max: 4 };
}

function renderRevisionSkills() {
  if (!currentSubmission) return;
  const query = document.getElementById("revisionSkillSearch").value.trim().toLowerCase();
  const selectedGroup = document.getElementById("revisionSkillGroup").value;
  const groups = WEF_SKILL_GROUPS.filter(group => !selectedGroup || group.group === selectedGroup);
  const results = groups.flatMap(group => group.skills.filter(skill => [skill, WEF_SKILL_TRANSLATIONS[skill], group.group, WEF_SKILL_GROUP_TRANSLATIONS[group.group]].filter(Boolean).join(" ").toLowerCase().includes(query)).map(skill => ({ skill, group: group.group }))).slice(0, 36);
  const { max } = revisionSkillLimits();
  document.getElementById("revisionSkillResults").innerHTML = results.length
    ? `<div class="revision-skill-results-grid">${results.map(({ skill }) => { const selected = revisionSkills.has(skill); const disabled = revisionSkills.size >= max && !selected; return `<label class="revision-skill-option ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}"><input type="checkbox" value="${escapeStatusHtml(skill)}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""}><span><strong>${escapeStatusHtml(WEF_SKILL_TRANSLATIONS[skill] || skill)}</strong><small>${escapeStatusHtml(skill)}</small></span></label>`; }).join("")}</div>`
    : '<div class="submission-empty">ไม่พบทักษะที่ค้นหา</div>';
}

function handleRevisionSkillChange(event) {
  const input = event.target.closest('input[type="checkbox"]');
  if (!input) return;
  const { max } = revisionSkillLimits();
  if (input.checked && revisionSkills.size < max) revisionSkills.add(input.value);
  else revisionSkills.delete(input.value);
  syncRevisionSkills();
}

function removeRevisionSkill(event) {
  const button = event.target.closest("[data-remove-revision-skill]");
  if (!button) return;
  revisionSkills.delete(button.dataset.removeRevisionSkill);
  syncRevisionSkills();
}

function syncRevisionSkills() {
  const { min, max } = revisionSkillLimits();
  document.getElementById("revisionSkillCount").textContent = `${revisionSkills.size} / ${max}`;
  document.getElementById("revisionSelectedSkills").innerHTML = revisionSkills.size
    ? [...revisionSkills].map(skill => `<span class="submission-chip"><span>${escapeStatusHtml(WEF_SKILL_TRANSLATIONS[skill] || skill)}<small>${escapeStatusHtml(skill)}</small></span><button type="button" data-remove-revision-skill="${escapeStatusHtml(skill)}" aria-label="นำทักษะออก"><i class="fas fa-xmark"></i></button></span>`).join("")
    : "ยังไม่ได้เลือกทักษะ";
  const error = document.getElementById("revisionSkillError");
  error.textContent = `กรุณาเลือกทักษะจำนวน ${min}${min === max ? "" : `–${max}`} ทักษะ`;
  error.hidden = revisionSkills.size >= min && revisionSkills.size <= max;
  renderRevisionSkills();
}

async function submitRevision(event) {
  event.preventDefault();
  if (!currentSubmission?.canEdit || !revisionForm.reportValidity()) return;
  const { min, max } = revisionSkillLimits();
  if (revisionSkills.size < min || revisionSkills.size > max) {
    document.getElementById("revisionSkillError").hidden = false;
    return;
  }
  const button = document.getElementById("submitRevision");
  button.disabled = true;
  showRevisionMessage("กำลังส่งข้อมูลที่แก้ไขกลับไปตรวจสอบ…", "info");
  try {
    const data = Object.fromEntries((EDIT_FIELDS[currentSubmission.type] || []).map(([field]) => [field, String(revisionForm.elements.namedItem(field)?.value || "").trim()]));
    data[currentSubmission.type === "BUSINESS" ? "BUSINESS_WANTS" : "TOP_SKILLS"] = [...revisionSkills].join(" | ");
    const result = await postStatusAction({
      action: "reviseOwnSubmission",
      code: currentSubmission.code,
      email: document.getElementById("submissionEmail").value.trim().toLowerCase(),
      emailOtp: document.getElementById("submissionOtp").value.trim(),
      website: document.getElementById("revisionWebsite").value,
      data
    });
    if (!result.success) throw new Error(result.message || "ส่งข้อมูลแก้ไขไม่สำเร็จ");
    currentSubmission.status = "PENDING";
    currentSubmission.canEdit = false;
    currentSubmission.updatedTime = new Date().toISOString();
    renderSubmissionResult();
    showStatusMessage(result.message, "success");
    otpRequestedKey = "";
    document.getElementById("submissionOtp").value = "";
    document.getElementById("submissionOtp").disabled = true;
    document.getElementById("checkSubmissionStatus").disabled = true;
  } catch (error) {
    showRevisionMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function postStatusAction(payload) {
  const response = await fetch(SUBMISSION_STATUS_URL, { method: "POST", body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!result.success) throw new Error(String(result.message || "ระบบไม่สามารถดำเนินการได้").replace(/^Server Error:\s*/, ""));
  return result;
}

function showStatusMessage(message, type) {
  setMessage(document.getElementById("statusLookupMessage"), message, type);
}

function showRevisionMessage(message, type) {
  setMessage(document.getElementById("revisionMessage"), message, type);
}

function setMessage(element, message, type) {
  const styles = { info: "border-blue-200 bg-blue-50 text-blue-800", success: "border-emerald-200 bg-emerald-50 text-emerald-800", error: "border-rose-200 bg-rose-50 text-rose-800" };
  element.className = `submission-status ${styles[type] || styles.info}`;
  element.textContent = message;
  element.hidden = false;
}

function formatSubmissionTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(date);
}

function escapeStatusHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}
