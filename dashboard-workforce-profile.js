const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const PROFILE_SHEET = "Business_Student_Profile";
const PROFILE_PAGE_SIZE = 20;
let profileRows = [];
let filteredProfileRows = [];
let profilePage = 1;
let visibleProfileRows = [];

window.addEventListener("DOMContentLoaded", initProfileDashboard);

async function initProfileDashboard() {
  try {
    profileRows = await EDU15DataClient.fetchAllPages(GAS_WEB_APP_URL, "DB_3", PROFILE_SHEET);
    populateProfileFilters();
    renderProfileStats();
    applyProfileFilters();
    setupProfileEvents();
  } catch (error) {
    console.error(error);
    document.getElementById("profileTableBody").innerHTML =
      `<tr><td colspan="4" class="p-10 text-center text-rose-600">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    document.getElementById("profileTableSummary").textContent = "ไม่สามารถโหลดข้อมูลได้";
  } finally {
    await window.hidePageLoader?.();
  }
}

function populateProfileFilters() {
  fillSelect("profileGender", uniqueValues("GENDER"));
  fillSelect("profileSchool", uniqueValues("SCHOOL_NAME"));
  fillSelect("profileLevel", uniqueValues("EDU_LEVEL"));
}
function uniqueValues(field) {
  return [...new Set(profileRows.map(row => String(row[field] || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "th"));
}
function fillSelect(id, values) {
  const select = document.getElementById(id);
  values.forEach(value => select.add(new Option(value, value)));
}

function renderProfileStats() {
  document.getElementById("profileTotal").textContent = profileRows.length.toLocaleString("th-TH");
  const totals = new Map();
  profileRows.forEach(row => {
    const gender = String(row.GENDER || "").trim() || "ไม่ระบุ";
    totals.set(gender, (totals.get(gender) || 0) + 1);
  });
  const colors = [
    ["bg-blue-50", "text-blue-700", "border-blue-100", "fa-mars"],
    ["bg-pink-50", "text-pink-700", "border-pink-100", "fa-venus"],
    ["bg-violet-50", "text-violet-700", "border-violet-100", "fa-venus-mars"],
    ["bg-slate-50", "text-slate-700", "border-slate-200", "fa-user"]
  ];
  document.getElementById("genderStats").innerHTML = [...totals]
    .sort((a, b) => b[1] - a[1])
    .map(([gender, total], index) => {
      const [background, text, border, icon] = colors[index % colors.length];
      return `<article class="rounded-xl border ${border} ${background} p-5 shadow-sm"><div class="flex items-start justify-between"><div><span class="text-sm text-slate-500">${escapeHtml(gender)}</span><strong class="mt-2 block text-3xl ${text}">${total.toLocaleString("th-TH")}</strong><span class="text-xs text-slate-400">คน</span></div><i class="fas ${icon} mt-1 text-xl ${text}"></i></div></article>`;
    }).join("") || '<p class="col-span-full rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400">ยังไม่มีข้อมูลจำแนกตามเพศ</p>';
}

function setupProfileEvents() {
  document.getElementById("profileFilterForm").addEventListener("submit", event => {
    event.preventDefault();
    profilePage = 1;
    applyProfileFilters();
  });
  document.getElementById("profileFilterForm").addEventListener("reset", () => setTimeout(() => {
    profilePage = 1;
    applyProfileFilters();
  }, 0));
  document.getElementById("profileTableBody").addEventListener("click", event => {
    const button = event.target.closest("[data-profile-index]");
    if (!button) return;
    const row = visibleProfileRows[Number(button.dataset.profileIndex)];
    if (row) showStudentDetail(row);
  });
  document.getElementById("closeStudentDetail").addEventListener("click", closeStudentDetail);
  document.getElementById("profilePrevPage").addEventListener("click", () => {
    if (profilePage > 1) {
      profilePage--;
      renderProfileTable();
    }
  });
  document.getElementById("profileNextPage").addEventListener("click", () => {
    const pages = Math.max(1, Math.ceil(filteredProfileRows.length / PROFILE_PAGE_SIZE));
    if (profilePage < pages) {
      profilePage++;
      renderProfileTable();
    }
  });
}

function applyProfileFilters() {
  const search = document.getElementById("profileSearch").value.trim().toLowerCase();
  const gender = document.getElementById("profileGender").value;
  const school = document.getElementById("profileSchool").value;
  const level = document.getElementById("profileLevel").value;
  filteredProfileRows = profileRows.filter(row => {
    const haystack = [row.STUDENT_NAME, row.SCHOOL_NAME, row.LOOKING_WORK, row.TOP_SKILLS]
      .map(value => String(value || "").toLowerCase()).join(" ");
    return (!search || haystack.includes(search)) &&
      (!gender || String(row.GENDER) === gender) &&
      (!school || String(row.SCHOOL_NAME) === school) &&
      (!level || String(row.EDU_LEVEL) === level);
  });
  closeStudentDetail();
  renderProfileTable();
}

function renderProfileTable() {
  const pages = Math.max(1, Math.ceil(filteredProfileRows.length / PROFILE_PAGE_SIZE));
  profilePage = Math.min(profilePage, pages);
  const start = (profilePage - 1) * PROFILE_PAGE_SIZE;
  visibleProfileRows = filteredProfileRows.slice(start, start + PROFILE_PAGE_SIZE);
  document.getElementById("profileTableBody").innerHTML = visibleProfileRows.length
    ? visibleProfileRows.map((row, index) => `<tr class="border-t border-slate-100 hover:bg-slate-50"><td class="p-3 text-center text-slate-400">${(start + index + 1).toLocaleString("th-TH")}</td><td class="p-3"><button type="button" data-profile-index="${index}" class="text-left font-semibold text-teal-700 hover:underline">${escapeHtml(row.STUDENT_NAME || "ไม่ระบุชื่อ")}</button><span class="mt-1 block text-xs text-slate-400">${escapeHtml(row.GENDER || "ไม่ระบุเพศ")} · ${escapeHtml(row.EDU_LEVEL || "ไม่ระบุระดับ")}</span></td><td class="p-3 text-slate-600">${escapeHtml(row.SCHOOL_NAME || "-")}</td><td class="p-3 text-slate-600">${escapeHtml(row.LOOKING_WORK || "-")}</td></tr>`).join("")
    : '<tr><td colspan="4" class="p-10 text-center text-slate-400">ไม่พบข้อมูลตามเงื่อนไข</td></tr>';
  document.getElementById("profileTableSummary").textContent =
    `พบ ${filteredProfileRows.length.toLocaleString("th-TH")} คน จากทั้งหมด ${profileRows.length.toLocaleString("th-TH")} คน`;
  document.getElementById("profilePageSummary").textContent = visibleProfileRows.length
    ? `แสดง ${(start + 1).toLocaleString("th-TH")}–${(start + visibleProfileRows.length).toLocaleString("th-TH")} จาก ${filteredProfileRows.length.toLocaleString("th-TH")} รายการ`
    : "ไม่มีรายการ";
  document.getElementById("profilePageIndicator").textContent = `หน้า ${profilePage.toLocaleString("th-TH")} / ${pages.toLocaleString("th-TH")}`;
  document.getElementById("profilePrevPage").disabled = profilePage <= 1;
  document.getElementById("profileNextPage").disabled = profilePage >= pages;
}

function showStudentDetail(row) {
  document.getElementById("detailStudentName").textContent = row.STUDENT_NAME || "ไม่ระบุชื่อ";
  document.getElementById("detailStudentMeta").textContent =
    [row.GENDER, row.SCHOOL_NAME, row.EDU_LEVEL].map(value => String(value || "").trim()).filter(Boolean).join(" · ");
  document.getElementById("detailDescription").textContent = row.DESCRIPTION_STUDENT || "ไม่ได้ระบุ";
  const rawSkills = String(row.TOP_SKILLS || "");
  const skillParts = rawSkills.includes("|") ? rawSkills.split("|") : rawSkills.split(",");
  const skills = [...new Set(skillParts.map(value => value.trim()).filter(Boolean))];
  document.getElementById("detailSkills").innerHTML = skills.length
    ? skills.map(skill => `<span class="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">${escapeHtml(skill)}</span>`).join("")
    : '<span class="text-sm text-slate-400">ไม่ได้ระบุ</span>';
  document.getElementById("detailLookingWork").textContent = row.LOOKING_WORK || "ไม่ได้ระบุ";
  document.getElementById("detailAvailableTime").textContent = row.AVAILABLE_TIME || "ไม่ได้ระบุ";
  document.getElementById("detailPortfolio").innerHTML = externalLinkHtml(row.PORTFOLIO_LINK, "เปิด Portfolio");
  document.getElementById("detailContact").innerHTML = contactHtml(row.STUDENT_CONTRACT);
  document.getElementById("detailSubmittedTime").textContent = formatSubmittedTime(row.SUBMITED_TIME);
  document.getElementById("studentDetailPanel").hidden = false;
  document.getElementById("studentDetailPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function closeStudentDetail() {
  document.getElementById("studentDetailPanel").hidden = true;
}
function normalizeExternalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
function externalLinkHtml(value, label) {
  const url = normalizeExternalUrl(value);
  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="font-semibold text-blue-700 hover:underline"><i class="fas fa-arrow-up-right-from-square mr-1"></i>${escapeHtml(label)}</a>`
    : '<span class="text-slate-400">ไม่ได้ระบุ</span>';
}
function contactHtml(value) {
  const raw = String(value || "").trim();
  if (!raw) return '<span class="text-slate-400">ไม่ได้ระบุ</span>';
  const url = normalizeExternalUrl(raw);
  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="font-semibold text-blue-700 hover:underline"><i class="fas fa-arrow-up-right-from-square mr-1"></i>${escapeHtml(raw)}</a>`
    : `<span class="font-medium text-slate-700">${escapeHtml(raw)}</span>`;
}
function formatSubmittedTime(value) {
  if (!value) return "ไม่ได้ระบุ";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[char]);
}
