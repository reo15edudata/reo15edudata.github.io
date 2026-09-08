const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const PROFILE_FIELDS = [
  "STUDENT_NAME", "GENDER", "PROV_NAME", "SCHOOL_NAME", "EDU_LEVEL",
  "DESCRIPTION_STUDENT", "TOP_SKILLS", "LOOKING_WORK",
  "AVAILABLE_TIME", "PORTFOLIO_LINK", "STUDENT_CONTRACT"
];
const selectedSkills = new Set();
const MAX_SKILL_SEARCH_RESULTS = 24;
const PROFILE_DRAFT_KEY = "edu15:draft:student-profile:v1";
const PROFILE_DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
let otpCooldownTimer = null;
let skillSearchTimer = null;
let profileDraftTimer = null;
let skillValidationAttempted = false;
let otpRequestedFor = "";
let profileFormDirty = false;
let profileDraftRestoring = false;

const profileForm = document.getElementById("studentProfileForm");
profileForm.addEventListener("submit", submitStudentProfile);
profileForm.addEventListener("input", handleProfileEdit);
profileForm.addEventListener("change", handleProfileEdit);
window.addEventListener("beforeunload", event => {
  if (!profileFormDirty) return;
  event.preventDefault();
  event.returnValue = "";
});
document.getElementById("requestOtpButton").addEventListener("click", requestEmailOtp);
document.getElementById("skillSearch").addEventListener("input", event => {
  clearTimeout(skillSearchTimer);
  skillSearchTimer = setTimeout(() => renderSkillOptions(event.target.value), 160);
});
document.getElementById("skillGroupSelect").addEventListener("change", event => {
  clearTimeout(skillSearchTimer);
  document.getElementById("skillSearch").value = "";
  renderSkillOptions();
  if (event.target.value) requestAnimationFrame(() => document.getElementById("skillResultsTitle")?.focus());
});
document.getElementById("skillOptions").addEventListener("change", handleSkillSelection);
document.getElementById("selectedSkillsPreview").addEventListener("click", handleSelectedSkillRemoval);
document.getElementById("verificationEmail").addEventListener("input", () => {
  const currentEmail = document.getElementById("verificationEmail").value.trim().toLowerCase();
  if (otpRequestedFor && currentEmail !== otpRequestedFor) {
    otpRequestedFor = "";
    document.getElementById("emailOtp").value = "";
    setOtpStatus("อีเมลถูกเปลี่ยน กรุณาขอรหัสยืนยันใหม่", "info");
  }
});
populateSkillGroups();
renderSkillOptions();
restoreProfileDraft();

function handleProfileEdit(event) {
  if (event.target.matches("#skillSearch, #skillGroupSelect")) return;
  profileFormDirty = true;
  scheduleProfileDraftSave();
}

function scheduleProfileDraftSave() {
  if (profileDraftRestoring) return;
  clearTimeout(profileDraftTimer);
  profileDraftTimer = setTimeout(saveProfileDraft, 500);
}

function saveProfileDraft() {
  const draft = {
    savedAt: Date.now(),
    verificationEmail: document.getElementById("verificationEmail").value,
    fields: Object.fromEntries(PROFILE_FIELDS.filter(field => field !== "TOP_SKILLS").map(field => [
      field,
      String(profileForm.elements.namedItem(field)?.value || "")
    ])),
    skills: [...selectedSkills]
  };
  try {
    localStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("Profile draft save skipped", error);
  }
}

function restoreProfileDraft() {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(PROFILE_DRAFT_KEY) || "null");
  } catch (error) {
    console.warn("Profile draft restore skipped", error);
    clearProfileDraft();
    return;
  }
  if (!draft?.savedAt || Date.now() - Number(draft.savedAt) > PROFILE_DRAFT_TTL) {
    clearProfileDraft();
    return;
  }

  profileDraftRestoring = true;
  Object.entries(draft.fields || {}).forEach(([field, value]) => {
    if (!PROFILE_FIELDS.includes(field) || field === "TOP_SKILLS") return;
    const control = profileForm.elements.namedItem(field);
    if (control) control.value = String(value || "");
  });
  document.getElementById("verificationEmail").value = String(draft.verificationEmail || "");
  const knownSkills = new Set(WEF_SKILL_GROUPS.flatMap(group => group.skills));
  selectedSkills.clear();
  (Array.isArray(draft.skills) ? draft.skills : []).filter(skill => knownSkills.has(skill)).slice(0, 4).forEach(skill => selectedSkills.add(skill));
  syncSelectedSkills();
  renderSkillOptions();
  profileFormDirty = true;
  profileDraftRestoring = false;
}

function clearProfileDraft() {
  clearTimeout(profileDraftTimer);
  try {
    localStorage.removeItem(PROFILE_DRAFT_KEY);
  } catch (error) {
    console.warn("Profile draft clear skipped", error);
  }
}

function populateSkillGroups() {
  const select = document.getElementById("skillGroupSelect");
  WEF_SKILL_GROUPS.forEach(({ group }) => {
    const thai = WEF_SKILL_GROUP_TRANSLATIONS[group] || group;
    select.add(new Option(thai, group));
  });
}

function renderSkillOptions(searchValue = document.getElementById("skillSearch").value) {
  const query = String(searchValue).trim().toLowerCase();
  const activeGroup = document.getElementById("skillGroupSelect").value;
  const sourceGroups = query
    ? WEF_SKILL_GROUPS
    : activeGroup
      ? WEF_SKILL_GROUPS.filter(group => group.group === activeGroup)
      : [];
  const matchingGroups = sourceGroups.map(group => ({
    group: group.group,
    skills: group.skills.filter(skill => {
      const searchable = [
        group.group,
        WEF_SKILL_GROUP_TRANSLATIONS[group.group],
        skill,
        WEF_SKILL_TRANSLATIONS[skill]
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(query) || !query;
    })
  })).filter(group => group.skills.length);
  const atLimit = selectedSkills.size >= 4;
  const totalResults = matchingGroups.reduce((sum, group) => sum + group.skills.length, 0);
  let remainingResults = query ? MAX_SKILL_SEARCH_RESULTS : totalResults;
  const groups = matchingGroups.map(group => {
    const skills = group.skills.slice(0, remainingResults);
    remainingResults -= skills.length;
    return { ...group, skills };
  }).filter(group => group.skills.length);
  const title = document.getElementById("skillResultsTitle");
  const summary = document.getElementById("skillResultsSummary");
  const limitNotice = document.getElementById("skillLimitNotice");
  limitNotice.hidden = !atLimit;

  if (query) {
    title.textContent = `ผลการค้นหา “${String(searchValue).trim()}”`;
    summary.textContent = totalResults
      ? totalResults > MAX_SKILL_SEARCH_RESULTS
        ? `พบ ${totalResults.toLocaleString("th-TH")} ทักษะ · แสดง ${MAX_SKILL_SEARCH_RESULTS.toLocaleString("th-TH")} รายการแรก กรุณาระบุคำค้นหาให้เจาะจงขึ้น`
        : `พบ ${totalResults.toLocaleString("th-TH")} ทักษะ จาก ${matchingGroups.length.toLocaleString("th-TH")} หมวด`
      : "ไม่พบทักษะที่ตรงกับคำค้นหา ลองใช้คำที่สั้นลงหรือค้นหาเป็นภาษาอังกฤษ";
  } else if (activeGroup) {
    title.textContent = WEF_SKILL_GROUP_TRANSLATIONS[activeGroup] || activeGroup;
    summary.textContent = `${activeGroup} · ${totalResults.toLocaleString("th-TH")} ทักษะ`;
  } else {
    title.textContent = "เลือกหมวดหรือค้นหาทักษะ";
    summary.textContent = "ระบบจะแสดงเฉพาะตัวเลือกที่เกี่ยวข้อง";
  }

  document.getElementById("skillOptions").innerHTML = groups.length
    ? groups.map(group => `<section class="skill-result-group">${query ? `<div class="mb-2"><h5 class="text-sm font-semibold leading-5 text-slate-700">${escapeHtml(WEF_SKILL_GROUP_TRANSLATIONS[group.group] || group.group)}</h5><p class="text-xs leading-4 text-slate-500">${escapeHtml(group.group)}</p></div>` : ""}<div class="skill-option-grid">${group.skills.map(skill => {
        const checked = selectedSkills.has(skill);
        const thai = WEF_SKILL_TRANSLATIONS[skill] || skill;
        const disabled = atLimit && !checked;
        return `<label class="skill-option ${checked ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}"><input type="checkbox" value="${escapeHtml(skill)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}><span class="skill-option-copy"><strong>${escapeHtml(thai)}</strong><small>${escapeHtml(skill)}</small></span></label>`;
      }).join("")}</div></section>`).join("")
    : `<div class="skill-empty"><div><i class="fas ${query ? "fa-magnifying-glass" : "fa-layer-group"}" aria-hidden="true"></i><strong>${query ? "ไม่พบทักษะที่ค้นหา" : "เริ่มจากหมวดหรือคำค้นหา"}</strong><p>${query ? "ลองใช้คำที่สั้นลง สลับภาษาไทยหรืออังกฤษ หรือเลือกจากหมวดทักษะ" : "เลือกหมวดทางด้านซ้ายเพื่อดูทักษะ 2–5 รายการ หรือค้นหาข้ามทุกหมวดได้ทันที"}</p></div></div>`;
}

function handleSkillSelection(event) {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  if (checkbox.checked && selectedSkills.size < 4) selectedSkills.add(checkbox.value);
  else selectedSkills.delete(checkbox.value);
  syncSelectedSkills();
  renderSkillOptions(document.getElementById("skillSearch").value);
}

function handleSelectedSkillRemoval(event) {
  const button = event.target.closest("[data-remove-skill]");
  if (!button) return;
  selectedSkills.delete(button.dataset.removeSkill);
  profileFormDirty = true;
  scheduleProfileDraftSave();
  syncSelectedSkills();
  renderSkillOptions();
  document.getElementById("selectedSkillsPreview").focus({ preventScroll: true });
}

function syncSelectedSkills() {
  // ใช้ | เพราะชื่อทักษะ WEF บางรายการมี comma อยู่ภายในชื่อ
  const serializedSkills = [...selectedSkills].join(" | ");
  const topSkillsInput = document.getElementById("topSkills");
  topSkillsInput.value = serializedSkills;
  topSkillsInput.setAttribute("value", serializedSkills);
  const count = document.getElementById("skillSelectionCount");
  count.textContent = `เลือกแล้ว ${selectedSkills.size} / 4`;
  count.dataset.state = selectedSkills.size >= 3 ? "ready" : "incomplete";
  const preview = document.getElementById("selectedSkillsPreview");
  preview.tabIndex = -1;
  preview.innerHTML = selectedSkills.size
    ? [...selectedSkills].map(skill => `<span class="skill-selected-item"><span>${escapeHtml(WEF_SKILL_TRANSLATIONS[skill] || skill)}<small class="block">${escapeHtml(skill)}</small></span><button type="button" class="skill-remove" data-remove-skill="${escapeHtml(skill)}" aria-label="นำ ${escapeHtml(WEF_SKILL_TRANSLATIONS[skill] || skill)} ออกจากรายการ"><i class="fas fa-xmark" aria-hidden="true"></i></button></span>`).join("")
    : "ยังไม่ได้เลือกทักษะ";
  const guidance = document.getElementById("skillSelectionGuidance");
  guidance.textContent = selectedSkills.size < 3
    ? `เลือกเพิ่มอีก ${3 - selectedSkills.size} ทักษะ เพื่อให้ครบขั้นต่ำ`
    : selectedSkills.size === 3
      ? "ครบขั้นต่ำแล้ว เลือกเพิ่มได้อีก 1 ทักษะ"
      : "เลือกครบ 4 ทักษะแล้ว";
  document.getElementById("skillSelectionError").hidden = !skillValidationAttempted || (selectedSkills.size >= 3 && selectedSkills.size <= 4);
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
    skillValidationAttempted = true;
    document.getElementById("skillSelectionError").hidden = false;
    document.getElementById("selectedSkillsTitle").scrollIntoView({ behavior: "smooth", block: "center" });
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
    field === "TOP_SKILLS"
      ? [...selectedSkills].join(" | ")
      : String(form.elements.namedItem(field)?.value || "").trim()
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
    profileFormDirty = false;
    skillValidationAttempted = false;
    otpRequestedFor = "";
    selectedSkills.clear();
    clearProfileDraft();
    document.getElementById("skillGroupSelect").value = "";
    document.getElementById("skillSearch").value = "";
    syncSelectedSkills();
    renderSkillOptions();
    setOtpStatus("", "info", true);
    setFormStatus(`ส่งข้อมูลเรียบร้อยแล้ว รหัสติดตามของคุณคือ ${result.code} กรุณาบันทึกรหัสนี้ไว้ ข้อมูลจะเผยแพร่หลังผ่านการตรวจสอบ`, "success", result.code);
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

function setFormStatus(message, type, code = "") {
  const status = document.getElementById("profileFormStatus");
  setStatusElement(status, message, type);
  status.hidden = false;
  if (code) {
    const link = document.createElement("a");
    link.href = `submission-status.html?code=${encodeURIComponent(code)}`;
    link.className = "mt-3 block font-semibold underline underline-offset-2";
    link.textContent = "ตรวจสอบสถานะรายการนี้";
    status.appendChild(link);
  }
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
