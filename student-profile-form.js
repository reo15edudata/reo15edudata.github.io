const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const PROFILE_FIELDS = [
  "STUDENT_NAME", "GENDER", "SCHOOL_NAME", "EDU_LEVEL",
  "DESCRIPTION_STUDENT", "TOP_SKILLS", "LOOKING_WORK",
  "AVAILABLE_TIME", "PORTFOLIO_LINK", "STUDENT_CONTRACT"
];
const selectedSkills = new Set();
let otpCooldownTimer = null;
let otpRequestedFor = "";

const profileForm = document.getElementById("studentProfileForm");
profileForm.addEventListener("submit", submitStudentProfile);
document.getElementById("requestOtpButton").addEventListener("click", requestEmailOtp);
document.getElementById("skillSearch").addEventListener("input", event => renderSkillOptions(event.target.value));
document.getElementById("skillOptions").addEventListener("change", handleSkillSelection);
document.getElementById("verificationEmail").addEventListener("input", () => {
  const currentEmail = document.getElementById("verificationEmail").value.trim().toLowerCase();
  if (otpRequestedFor && currentEmail !== otpRequestedFor) {
    otpRequestedFor = "";
    document.getElementById("emailOtp").value = "";
    setOtpStatus("อีเมลถูกเปลี่ยน กรุณาขอรหัสยืนยันใหม่", "info");
  }
});
renderSkillOptions();

function renderSkillOptions(searchValue = "") {
  const query = String(searchValue).trim().toLowerCase();
  const groups = WEF_SKILL_GROUPS.map(group => ({
    group: group.group,
    skills: group.skills.filter(skill => {
      const searchable = [
        group.group,
        WEF_SKILL_GROUP_TRANSLATIONS[group.group],
        skill,
        WEF_SKILL_TRANSLATIONS[skill]
      ].filter(Boolean).join(" ").toLowerCase();
      return !query || searchable.includes(query);
    })
  })).filter(group => group.skills.length);
  const atLimit = selectedSkills.size >= 4;
  document.getElementById("skillOptions").innerHTML = groups.length
    ? groups.map(group => `<section><div class="mb-2 border-l-4 border-teal-400 pl-3"><h4 class="text-sm font-semibold leading-5 text-slate-700">${escapeHtml(WEF_SKILL_GROUP_TRANSLATIONS[group.group] || group.group)}</h4><p class="text-xs leading-4 text-slate-400">${escapeHtml(group.group)}</p></div><div class="grid grid-cols-1 items-stretch gap-2 lg:grid-cols-2">${group.skills.map(skill => {
        const checked = selectedSkills.has(skill);
        const thai = WEF_SKILL_TRANSLATIONS[skill] || skill;
        return `<label class="flex h-full min-h-[4.75rem] cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${checked ? "border-teal-400 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"} ${atLimit && !checked ? "cursor-not-allowed opacity-50" : ""}"><input type="checkbox" value="${escapeHtml(skill)}" ${checked ? "checked" : ""} ${atLimit && !checked ? "disabled" : ""} class="mt-1 h-4 w-4 shrink-0 accent-teal-600"><span class="min-w-0"><span class="block text-sm font-medium leading-5 ${checked ? "text-teal-800" : "text-slate-700"}">${escapeHtml(thai)}</span><span class="mt-1 block text-xs leading-4 text-slate-400">${escapeHtml(skill)}</span></span></label>`;
      }).join("")}</div></section>`).join("")
    : '<p class="py-8 text-center text-sm text-slate-400">ไม่พบทักษะที่ค้นหา</p>';
}

function handleSkillSelection(event) {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  if (checkbox.checked && selectedSkills.size < 4) selectedSkills.add(checkbox.value);
  else selectedSkills.delete(checkbox.value);
  syncSelectedSkills();
  renderSkillOptions(document.getElementById("skillSearch").value);
}

function syncSelectedSkills() {
  // ใช้ | เพราะชื่อทักษะ WEF บางรายการมี comma อยู่ภายในชื่อ
  document.getElementById("topSkills").value = [...selectedSkills].join(" | ");
  document.getElementById("skillSelectionCount").textContent = `เลือกแล้ว ${selectedSkills.size} / 4`;
  document.getElementById("selectedSkillsPreview").innerHTML = selectedSkills.size
    ? [...selectedSkills].map(skill => `<span class="inline-flex items-center rounded-full border border-teal-200 bg-white px-2.5 py-1 font-medium text-teal-700">${escapeHtml(WEF_SKILL_TRANSLATIONS[skill] || skill)}</span>`).join("")
    : "ยังไม่ได้เลือกทักษะ";
  document.getElementById("skillSelectionError").hidden = selectedSkills.size >= 3 && selectedSkills.size <= 4;
}

async function requestEmailOtp() {
  const emailInput = document.getElementById("verificationEmail");
  if (!emailInput.reportValidity()) return;
  const requestedEmail = emailInput.value.trim().toLowerCase();
  const button = document.getElementById("requestOtpButton");
  button.disabled = true;
  setOtpStatus("กำลังส่งรหัสยืนยันไปยังอีเมล…", "info");
  try {
    const result = await postProfileAction({
      action: "requestStudentProfileOtp",
      email: requestedEmail,
      website: String(profileForm.elements.website?.value || "")
    });
    if (!result.success) throw new Error(result.message || "ไม่สามารถส่งรหัสยืนยันได้");
    otpRequestedFor = requestedEmail;
    document.getElementById("emailOtp").focus();
    setOtpStatus("ส่งรหัสยืนยันแล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์อีเมลขยะ รหัสมีอายุ 10 นาที", "success");
    startOtpCooldown(60);
  } catch (error) {
    setOtpStatus(`ส่งรหัสไม่สำเร็จ: ${error.message}`, "error");
    button.disabled = false;
  }
}

function startOtpCooldown(seconds) {
  clearInterval(otpCooldownTimer);
  const button = document.getElementById("requestOtpButton");
  let remaining = seconds;
  button.disabled = true;
  button.textContent = `ส่งใหม่ได้ใน ${remaining} วินาที`;
  otpCooldownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(otpCooldownTimer);
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-rotate mr-2"></i>ส่งรหัสใหม่';
      return;
    }
    button.textContent = `ส่งใหม่ได้ใน ${remaining} วินาที`;
  }, 1000);
}

async function submitStudentProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("submitProfileButton");
  if (!form.reportValidity()) return;
  if (selectedSkills.size < 3 || selectedSkills.size > 4) {
    document.getElementById("skillSelectionError").hidden = false;
    document.getElementById("skillOptions").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const otp = document.getElementById("emailOtp").value.trim();
  if (!/^\d{6}$/.test(otp)) {
    setOtpStatus("กรุณากรอกรหัสยืนยัน 6 หลักให้ถูกต้อง", "error");
    document.getElementById("emailOtp").focus();
    return;
  }

  syncSelectedSkills();
  const data = Object.fromEntries(PROFILE_FIELDS.map(field => [
    field,
    String(form.elements[field]?.value || "").trim()
  ]));
  const payload = {
    action: "submitStudentProfile",
    dbKey: "DB_3",
    sheetName: "Business_Student_Profile",
    website: String(form.elements.website?.value || ""),
    consent: document.getElementById("profileConsent").checked,
    email: document.getElementById("verificationEmail").value.trim(),
    emailOtp: otp,
    data
  };

  button.disabled = true;
  setFormStatus("กำลังตรวจสอบอีเมลและส่งข้อมูล กรุณารอสักครู่…", "info");
  try {
    const result = await postProfileAction(payload);
    if (!result.success) throw new Error(result.message || "บันทึกข้อมูลไม่สำเร็จ");
    await window.EDU15DataClient?.clear?.();
    form.reset();
    otpRequestedFor = "";
    selectedSkills.clear();
    syncSelectedSkills();
    renderSkillOptions();
    setOtpStatus("", "info", true);
    setFormStatus("ยืนยันอีเมลและส่งข้อมูลเรียบร้อยแล้ว ข้อมูลของคุณจะปรากฏใน Dashboard เมื่อระบบอัปเดตสำเร็จ", "success");
  } catch (error) {
    console.error(error);
    setFormStatus(`ส่งข้อมูลไม่สำเร็จ: ${error.message} กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง`, "error");
  } finally {
    button.disabled = false;
  }
}

async function postProfileAction(payload) {
  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return response.json();
}

function setOtpStatus(message, type, hide = false) {
  const status = document.getElementById("otpStatus");
  setStatusElement(status, message, type);
  status.hidden = hide;
}

function setFormStatus(message, type) {
  const status = document.getElementById("profileFormStatus");
  setStatusElement(status, message, type);
  status.hidden = false;
}

function setStatusElement(status, message, type) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800"
  };
  status.className = `mt-3 rounded-lg border px-3 py-2 text-sm ${styles[type] || styles.info}`;
  status.textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[char]);
}
