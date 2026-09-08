const JOB_MATCHING_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const JOB_MATCHING_SHEETS = { business: "Vocational_Busi_MOU", student: "Business_Student_Profile" };
const JOB_MATCHING_GRADES = [
  { minimum: 80, grade: "A", label: "สอดคล้องมาก" },
  { minimum: 60, grade: "B", label: "สอดคล้องดี" },
  { minimum: 40, grade: "C", label: "สอดคล้องปานกลาง" },
  { minimum: 0, grade: "D", label: "สอดคล้องน้อย" }
];
const jobMatchingData = { business: [], student: [] };
let jobMatchingRole = "student";
let jobMatchingResults = [];
let selectedMatchIndex = -1;

window.addEventListener("DOMContentLoaded", initializeJobMatching);

async function initializeJobMatching() {
  document.querySelectorAll('input[name="matchingRole"]').forEach(input => input.addEventListener("change", changeMatchingRole));
  document.getElementById("runMatching").addEventListener("click", runJobMatching);
  document.getElementById("matchingSourceSearch").addEventListener("input", event => renderMatchingSourceOptions(event.target.value));
  document.getElementById("matchingSource").addEventListener("change", () => {
    document.getElementById("runMatching").disabled = !document.getElementById("matchingSource").value;
  });
  document.getElementById("matchingList").addEventListener("click", openMatchingDetail);
  document.getElementById("closeMatchingDetail").addEventListener("click", closeMatchingDetail);
  try {
    const [businessRows, studentRows] = await Promise.all([
      EDU15DataClient.fetchAllPages(JOB_MATCHING_URL, "DB_3", JOB_MATCHING_SHEETS.business, { cacheScope: "job-matching-approved-v1", networkFirst: true }),
      EDU15DataClient.fetchAllPages(JOB_MATCHING_URL, "DB_3", JOB_MATCHING_SHEETS.student, { cacheScope: "job-matching-approved-v1", networkFirst: true })
    ]);
    jobMatchingData.business = approvedRows(businessRows);
    jobMatchingData.student = approvedRows(studentRows);
    renderMatchingSourceOptions();
    setMatchingMessage(`พร้อมเปรียบเทียบผู้เรียน ${jobMatchingData.student.length.toLocaleString("th-TH")} คน กับสถานประกอบการ ${jobMatchingData.business.length.toLocaleString("th-TH")} แห่ง`, "ready");
  } catch (error) {
    console.error(error);
    setMatchingMessage(`โหลดข้อมูลไม่สำเร็จ: ${error.message}`, "error");
  } finally {
    await window.hidePageLoader?.();
  }
}

function approvedRows(rows) {
  return rows.filter(row => String(row.DATA_STATUS || "").trim().toUpperCase() === "APPROVED");
}

function changeMatchingRole(event) {
  jobMatchingRole = event.target.value;
  document.getElementById("sourceLabel").textContent = jobMatchingRole === "student" ? "โปรไฟล์ของผู้เรียน" : "สถานประกอบการของคุณ";
  document.getElementById("sourceGuidance").textContent = jobMatchingRole === "student" ? "เลือกโปรไฟล์ผู้เรียนที่ได้รับอนุมัติแล้ว" : "เลือกสถานประกอบการที่ได้รับอนุมัติแล้ว";
  document.getElementById("resultTitle").textContent = jobMatchingRole === "student" ? "5 สถานประกอบการที่สอดคล้องสูงสุด" : "5 ผู้เรียนที่สอดคล้องสูงสุด";
  const search = document.getElementById("matchingSourceSearch");
  search.value = "";
  search.placeholder = jobMatchingRole === "student" ? "พิมพ์ชื่อผู้เรียน" : "พิมพ์ชื่อสถานประกอบการ";
  renderMatchingSourceOptions();
  resetMatchingResults();
}

function renderMatchingSourceOptions(query = "") {
  const select = document.getElementById("matchingSource");
  const search = document.getElementById("matchingSourceSearch");
  const summary = document.getElementById("sourceSearchSummary");
  const rows = jobMatchingData[jobMatchingRole];
  const normalizedQuery = normalizeMatchText(query);
  const filteredRows = [...rows]
    .sort((left, right) => sourceName(left).localeCompare(sourceName(right), "th"))
    .filter(row => !normalizedQuery || sourceSearchText(row).includes(normalizedQuery));
  const placeholder = !rows.length
    ? "— ยังไม่มีข้อมูลที่ได้รับอนุมัติ —"
    : filteredRows.length
      ? jobMatchingRole === "student" ? "— เลือกชื่อผู้เรียน —" : "— เลือกสถานประกอบการ —"
      : "— ไม่พบรายชื่อที่ค้นหา —";
  select.replaceChildren(new Option(placeholder, ""));
  filteredRows.forEach(row => {
    const index = rows.indexOf(row);
    const context = jobMatchingRole === "student" ? [row.SCHOOL_NAME, row.PROV_NAME] : [row.BUSINESS_TYPE, row.PROV_NAME];
    select.add(new Option(`${sourceName(row)}${context.filter(Boolean).length ? ` · ${context.filter(Boolean).join(" · ")}` : ""}`, String(index)));
  });
  search.disabled = !rows.length;
  select.disabled = !filteredRows.length;
  summary.textContent = rows.length ? (normalizedQuery ? `พบ ${filteredRows.length.toLocaleString("th-TH")} จาก ${rows.length.toLocaleString("th-TH")} รายชื่อ` : `มี ${rows.length.toLocaleString("th-TH")} รายชื่อให้เลือก`) : "";
  document.getElementById("runMatching").disabled = true;
}

function sourceSearchText(row) {
  const context = jobMatchingRole === "student"
    ? [row.STUDENT_NAME, row.SCHOOL_NAME, row.PROV_NAME]
    : [row.BUSINESS_NAME, row.BUSINESS_TYPE, row.PROV_NAME];
  return normalizeMatchText(context.filter(Boolean).join(" "));
}

function sourceName(row) {
  return String(jobMatchingRole === "student" ? row.STUDENT_NAME : row.BUSINESS_NAME || "").trim() || "ไม่ระบุชื่อ";
}

function runJobMatching() {
  const sourceIndex = Number(document.getElementById("matchingSource").value);
  const source = jobMatchingData[jobMatchingRole][sourceIndex];
  if (!source) return;
  const targetType = jobMatchingRole === "student" ? "business" : "student";
  jobMatchingResults = jobMatchingData[targetType]
    .map(target => calculateMatch(source, target))
    .sort((left, right) => right.score - left.score || right.matchedSkills.length - left.matchedSkills.length || targetName(left.target, targetType).localeCompare(targetName(right.target, targetType), "th"))
    .slice(0, 5);
  selectedMatchIndex = -1;
  closeMatchingDetail();
  renderMatchingResults(source, targetType);
}

function calculateMatch(source, target) {
  const student = jobMatchingRole === "student" ? source : target;
  const business = jobMatchingRole === "student" ? target : source;
  const studentSkills = parseSkills(student.TOP_SKILLS);
  const wantedSkills = parseSkills(business.BUSINESS_WANTS);
  const wantedSet = new Set(wantedSkills.map(normalizeMatchText));
  const matchedSkills = studentSkills.filter(skill => wantedSet.has(normalizeMatchText(skill)));
  const skillScore = wantedSkills.length && studentSkills.length
    ? 50 * matchedSkills.length / wantedSkills.length + 15 * matchedSkills.length / studentSkills.length
    : 0;
  const provinceMatched = Boolean(normalizeMatchText(student.PROV_NAME)) && normalizeMatchText(student.PROV_NAME) === normalizeMatchText(business.PROV_NAME);
  const provinceScore = provinceMatched ? 25 : 0;
  const studentContext = [student.LOOKING_WORK, student.DESCRIPTION_STUDENT].filter(Boolean).join(" ");
  const businessContext = [business.BUSINESS_NAME, business.BUSINESS_TYPE, business.BUSINESS_DETAILS].filter(Boolean).join(" ");
  const contextScore = contextSimilarity(studentContext, businessContext) * 10;
  const score = Math.round(Math.min(100, skillScore + provinceScore + contextScore));
  const grade = JOB_MATCHING_GRADES.find(item => score >= item.minimum);
  return { target, score, grade, skillScore: Math.round(skillScore), provinceScore, contextScore: Math.round(contextScore), provinceMatched, matchedSkills };
}

function parseSkills(value) {
  return [...new Set(String(value || "").split(/\s*[|,]\s*/).map(item => item.trim()).filter(Boolean))];
}

function normalizeMatchText(value) {
  return String(value || "").trim().toLocaleLowerCase("th").replace(/\s+/g, " ");
}

function contextSimilarity(left, right) {
  const leftWords = matchWords(left);
  const rightWords = matchWords(right);
  if (!leftWords.size || !rightWords.size) return 0;
  const common = [...leftWords].filter(word => rightWords.has(word)).length;
  return Math.min(1, common / Math.max(1, Math.min(leftWords.size, rightWords.size)));
}

function matchWords(value) {
  const normalized = normalizeMatchText(value).replace(/[^\p{L}\p{N}]+/gu, " ");
  const words = typeof Intl.Segmenter === "function"
    ? [...new Intl.Segmenter("th", { granularity: "word" }).segment(normalized)].filter(item => item.isWordLike).map(item => item.segment)
    : normalized.split(/\s+/);
  const ignored = new Set(["และ", "หรือ", "การ", "งาน", "ที่", "ใน", "ของ", "กับ", "เป็น", "มี", "ให้"]);
  return new Set(words.map(word => word.trim()).filter(word => word.length > 1 && !ignored.has(word)));
}

function renderMatchingResults(source, targetType) {
  const sourceProvince = String(source.PROV_NAME || "").trim();
  const provinceChip = document.getElementById("sourceProvince");
  provinceChip.hidden = !sourceProvince;
  provinceChip.textContent = sourceProvince ? `จังหวัดที่เลือก: ${sourceProvince}` : "";
  document.getElementById("resultSummary").textContent = jobMatchingResults.length
    ? `ผลการเปรียบเทียบสำหรับ ${sourceNameForType(source, jobMatchingRole)} จากข้อมูลที่ได้รับอนุมัติแล้ว`
    : "ยังไม่มีข้อมูลอีกฝ่ายสำหรับนำมาเปรียบเทียบ";
  document.getElementById("matchingList").innerHTML = jobMatchingResults.length
    ? jobMatchingResults.map((result, index) => {
        const row = result.target;
        const reasons = [result.provinceMatched ? "จังหวัดตรงกัน" : "ต่างจังหวัด", result.matchedSkills.length ? `ทักษะตรงกัน ${result.matchedSkills.length}` : "ยังไม่พบทักษะตรงกัน"];
        return `<button type="button" class="match-row" data-match-index="${index}" data-grade="${result.grade.grade}" aria-controls="matchingDetail" aria-expanded="false"><span class="match-rank">${index + 1}</span><span class="match-copy"><strong>${escapeMatchingHtml(targetName(row, targetType))}</strong><small>${escapeMatchingHtml(targetMeta(row, targetType))}</small><span class="match-reasons">${reasons.map(reason => `<span>${escapeMatchingHtml(reason)}</span>`).join("")}</span></span><span class="match-score"><span class="match-grade">${result.grade.grade}</span><small>${result.score} คะแนน</small></span></button>`;
      }).join("")
    : '<div class="matching-empty"><i class="fas fa-database"></i><strong>ยังไม่มีข้อมูลสำหรับจับคู่</strong><p>เมื่อมีข้อมูลที่ผ่านการอนุมัติเพิ่มขึ้น ระบบจะนำมาเปรียบเทียบโดยอัตโนมัติ</p></div>';
}

function targetName(row, type) {
  return String(type === "business" ? row.BUSINESS_NAME : row.STUDENT_NAME || "").trim() || "ไม่ระบุชื่อ";
}
function sourceNameForType(row, type) { return targetName(row, type); }
function targetMeta(row, type) {
  const values = type === "business" ? [row.BUSINESS_TYPE, row.PROV_NAME] : [row.SCHOOL_NAME, row.PROV_NAME];
  return values.map(value => String(value || "").trim()).filter(Boolean).join(" · ") || "ยังไม่มีข้อมูลบริบท";
}

function openMatchingDetail(event) {
  const button = event.target.closest("[data-match-index]");
  if (!button) return;
  selectedMatchIndex = Number(button.dataset.matchIndex);
  const result = jobMatchingResults[selectedMatchIndex];
  if (!result) return;
  document.querySelectorAll("[data-match-index]").forEach((item, index) => {
    item.classList.toggle("is-active", index === selectedMatchIndex);
    item.setAttribute("aria-expanded", String(index === selectedMatchIndex));
  });
  renderMatchingDetail(result, jobMatchingRole === "student" ? "business" : "student");
}

function renderMatchingDetail(result, type) {
  const row = result.target;
  document.getElementById("detailEmpty").hidden = true;
  document.getElementById("detailContent").hidden = false;
  const grade = document.getElementById("detailGrade");
  grade.textContent = result.grade.grade;
  grade.dataset.grade = result.grade.grade;
  document.getElementById("detailTitle").textContent = targetName(row, type);
  document.getElementById("detailMeta").textContent = `${result.score} คะแนน · ${result.grade.label}`;
  document.getElementById("detailScoreParts").innerHTML = [
    [result.skillScore, 65, "ความสอดคล้องด้านทักษะ"],
    [result.provinceScore, 25, "จังหวัด"],
    [result.contextScore, 10, "งานและบริบท"]
  ].map(([value, maximum, label]) => `<div class="score-part"><strong>${value}/${maximum}</strong><span>${label}</span></div>`).join("");
  document.getElementById("detailSkills").innerHTML = result.matchedSkills.length
    ? result.matchedSkills.map(skill => `<span title="${escapeMatchingHtml(skill)}">${escapeMatchingHtml(typeof WEF_SKILL_TRANSLATIONS !== "undefined" ? WEF_SKILL_TRANSLATIONS[skill] || skill : skill)}</span>`).join("")
    : '<span class="is-empty">ยังไม่พบทักษะที่ตรงกัน</span>';
  document.getElementById("detailInformation").innerHTML = type === "business" ? businessDetailHtml(row) : studentDetailHtml(row);
  if (matchMedia("(max-width: 900px)").matches) document.getElementById("matchingDetail").scrollIntoView({ behavior: "smooth", block: "start" });
}

function businessDetailHtml(row) {
  return detailRows([
    ["จังหวัด", row.PROV_NAME], ["ประเภท", row.BUSINESS_TYPE], ["รายละเอียด", row.BUSINESS_DETAILS],
    ["ค่าตอบแทน", formatMatchingPay(row.BUSINESS_PAY)], ["ช่องทางติดต่อ", matchingContactHtml(row.BUSINESS_CONTACT), true]
  ]);
}
function studentDetailHtml(row) {
  return detailRows([
    ["จังหวัดที่สนใจ", row.PROV_NAME], ["สถานศึกษา", row.SCHOOL_NAME], ["ระดับการศึกษา", row.EDU_LEVEL],
    ["งานที่สนใจ", row.LOOKING_WORK], ["ช่วงเวลาที่พร้อม", row.AVAILABLE_TIME],
    ["Portfolio", matchingLinkHtml(row.PORTFOLIO_LINK, "เปิด Portfolio"), true], ["ช่องทางติดต่อ", matchingContactHtml(row.STUDENT_CONTRACT), true]
  ]);
}
function detailRows(rows) {
  return rows.map(([label, value, trustedHtml]) => `<div><dt>${escapeMatchingHtml(label)}</dt><dd>${trustedHtml ? value : escapeMatchingHtml(String(value || "ไม่ได้ระบุ"))}</dd></div>`).join("");
}
function formatMatchingPay(value) {
  const text = String(value ?? "").trim();
  const number = Number(text.replace(/,/g, ""));
  return text && Number.isFinite(number) ? `${number.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท/ชั่วโมง` : text || "ไม่ได้ระบุ";
}
function normalizeMatchingUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try { const url = new URL(/^www\./i.test(raw) ? `https://${raw}` : raw); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
function matchingLinkHtml(value, label) {
  const url = normalizeMatchingUrl(value);
  return url ? `<a href="${escapeMatchingHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeMatchingHtml(label)} <i class="fas fa-arrow-up-right-from-square"></i></a>` : "ไม่ได้ระบุ";
}
function matchingContactHtml(value) {
  const raw = String(value || "").trim();
  const url = normalizeMatchingUrl(raw);
  return url ? `<a href="${escapeMatchingHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeMatchingHtml(raw)} <i class="fas fa-arrow-up-right-from-square"></i></a>` : raw || "ไม่ได้ระบุ";
}

function closeMatchingDetail() {
  selectedMatchIndex = -1;
  document.querySelectorAll("[data-match-index]").forEach(item => { item.classList.remove("is-active"); item.setAttribute("aria-expanded", "false"); });
  document.getElementById("detailContent").hidden = true;
  document.getElementById("detailEmpty").hidden = false;
}

function resetMatchingResults() {
  jobMatchingResults = [];
  closeMatchingDetail();
  document.getElementById("sourceProvince").hidden = true;
  document.getElementById("resultSummary").textContent = "เลือกข้อมูลด้านบนเพื่อเริ่มเปรียบเทียบ";
  document.getElementById("matchingList").innerHTML = '<div class="matching-empty"><i class="fas fa-arrow-pointer"></i><strong>ยังไม่ได้เริ่มจับคู่</strong><p>ระบบจะแสดงผลลัพธ์เรียงจากคะแนนสูงสุด พร้อมเหตุผลประกอบแต่ละรายการ</p></div>';
}

function setMatchingMessage(message, state) {
  const element = document.getElementById("matchingMessage");
  element.textContent = message;
  element.className = `matching-message ${state === "error" ? "is-error" : state === "ready" ? "is-ready" : ""}`;
}
function escapeMatchingHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}
