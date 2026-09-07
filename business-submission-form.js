const BUSINESS_GAS_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const BUSINESS_SKILL_LIMIT = 10;
const BUSINESS_SEARCH_LIMIT = 8;
const businessSkills = new Set();
let businessMap = null;
let businessMarker = null;
let businessOtpEmail = "";
let businessOtpTimer = null;
let businessSkillValidationAttempted = false;

const businessForm = document.getElementById("businessSubmissionForm");
businessForm.addEventListener("submit", submitBusinessForm);
document.getElementById("requestBusinessOtp").addEventListener("click", requestBusinessOtp);
document.getElementById("searchBusinessPlace").addEventListener("click", searchBusinessPlace);
document.getElementById("businessPlaceSearch").addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  searchBusinessPlace();
});
document.getElementById("businessType").addEventListener("change", toggleOtherBusinessType);
document.getElementById("businessSkillGroup").addEventListener("change", () => {
  document.getElementById("businessSkillSearch").value = "";
  renderBusinessSkills();
});
document.getElementById("businessSkillSearch").addEventListener("input", renderBusinessSkills);
document.getElementById("businessSkillResults").addEventListener("change", handleBusinessSkillChange);
document.getElementById("businessSelectedSkills").addEventListener("click", removeBusinessSkill);
document.getElementById("businessEmail").addEventListener("input", () => {
  if (businessOtpEmail && normalizedEmail() !== businessOtpEmail) {
    businessOtpEmail = "";
    document.getElementById("businessOtp").value = "";
    showBusinessStatus("businessOtpStatus", "อีเมลถูกเปลี่ยน กรุณาขอรหัสยืนยันใหม่", "info");
  }
});

initializeBusinessForm();

async function initializeBusinessForm() {
  document.getElementById("businessYear").value = String(new Date().getFullYear() + 543);
  populateBusinessSkillGroups();
  renderBusinessSkills();
  await Promise.allSettled([populateBusinessTypes(), initializeBusinessMap()]);
}

async function populateBusinessTypes() {
  const select = document.getElementById("businessType");
  select.innerHTML = '<option value="">— เลือกประเภท —</option>';
  try {
    const metadata = await EDU15DataClient.fetchMetadata(
      BUSINESS_GAS_URL, "DB_3", "Vocational_Busi_MOU", ["BUSINESS_TYPE"]
    );
    [...new Set((metadata.BUSINESS_TYPE || []).map(value => String(value).trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "th"))
      .forEach(value => select.add(new Option(value, value)));
  } catch (error) {
    console.warn("Business type metadata unavailable", error);
  }
  select.add(new Option("อื่น ๆ — โปรดระบุ", "__OTHER__"));
}

function toggleOtherBusinessType() {
  const input = document.getElementById("businessTypeOther");
  const isOther = document.getElementById("businessType").value === "__OTHER__";
  input.hidden = !isOther;
  input.required = isOther;
  if (isOther) input.focus();
  else input.value = "";
}

async function initializeBusinessMap() {
  const status = document.getElementById("businessPlaceStatus");
  status.textContent = "กำลังเตรียมแผนที่…";
  try {
    await EDU15Libraries.loadLeaflet();
    businessMap = L.map("businessLocationMap", {
      preferCanvas: true,
      zoomAnimation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    }).setView([18.35, 99.0], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      updateWhenIdle: true,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(businessMap);
    businessMap.on("click", event => setBusinessCoordinate(event.latlng.lat, event.latlng.lng));
    status.textContent = "คลิกบนแผนที่เพื่อปักหมุด หรือค้นหาสถานที่ทางด้านซ้าย";
  } catch (error) {
    console.error(error);
    status.textContent = "โหลดแผนที่ไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองอีกครั้ง";
  }
}

async function searchBusinessPlace() {
  const input = document.getElementById("businessPlaceSearch");
  const query = input.value.trim() || document.getElementById("businessName").value.trim();
  const province = document.getElementById("businessProvince").value;
  if (query.length < 3) {
    input.focus();
    document.getElementById("businessPlaceStatus").textContent = "กรุณาพิมพ์ชื่อหรือที่อยู่อย่างน้อย 3 ตัวอักษร";
    return;
  }
  const button = document.getElementById("searchBusinessPlace");
  button.disabled = true;
  document.getElementById("businessPlaceStatus").textContent = "กำลังค้นหาสถานที่…";
  document.getElementById("businessPlaceResults").replaceChildren();
  try {
    const searchText = [query, province, "ประเทศไทย"].filter(Boolean).join(" ");
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", searchText);
    url.searchParams.set("countrycodes", "th");
    url.searchParams.set("limit", String(BUSINESS_SEARCH_LIMIT));
    url.searchParams.set("addressdetails", "1");
    const response = await fetch(url, { headers: { "Accept-Language": "th" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const results = await response.json();
    renderBusinessPlaces(results);
  } catch (error) {
    console.error(error);
    document.getElementById("businessPlaceStatus").textContent = "ค้นหาสถานที่ไม่สำเร็จ กรุณาลองอีกครั้งหรือปักหมุดบนแผนที่โดยตรง";
  } finally {
    button.disabled = false;
  }
}

function renderBusinessPlaces(results) {
  const container = document.getElementById("businessPlaceResults");
  document.getElementById("businessPlaceStatus").textContent = results.length
    ? `พบ ${results.length.toLocaleString("th-TH")} ตำแหน่ง กรุณาเลือกตำแหน่งที่ถูกต้อง`
    : "ไม่พบสถานที่ ลองเพิ่มชื่อถนน อำเภอ หรือจังหวัด";
  container.innerHTML = results.map((result, index) => `
    <button type="button" class="submission-place" data-place-index="${index}">
      <strong>${escapeBusinessHtml(result.name || result.display_name?.split(",")[0] || "สถานที่")}</strong>
      <span>${escapeBusinessHtml(result.display_name || "")}</span>
    </button>`).join("");
  container.querySelectorAll("[data-place-index]").forEach(button => {
    button.addEventListener("click", () => {
      const result = results[Number(button.dataset.placeIndex)];
      setBusinessCoordinate(Number(result.lat), Number(result.lon), 17);
      document.getElementById("businessPlaceStatus").textContent = "เลือกตำแหน่งแล้ว สามารถลากหมุดเพื่อปรับพิกัดได้";
    });
  });
}

function setBusinessCoordinate(lat, lng, zoom) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !businessMap) return;
  const value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  document.getElementById("businessCoordinate").value = value;
  document.getElementById("businessCoordinateDisplay").textContent = value;
  if (!businessMarker) {
    businessMarker = L.marker([lat, lng], { draggable: true }).addTo(businessMap);
    businessMarker.on("dragend", event => {
      const position = event.target.getLatLng();
      setBusinessCoordinate(position.lat, position.lng);
    });
  } else {
    businessMarker.setLatLng([lat, lng]);
  }
  businessMap.setView([lat, lng], zoom || Math.max(businessMap.getZoom(), 15));
}

function populateBusinessSkillGroups() {
  const select = document.getElementById("businessSkillGroup");
  WEF_SKILL_GROUPS.forEach(({ group }) => {
    select.add(new Option(WEF_SKILL_GROUP_TRANSLATIONS[group] || group, group));
  });
}

function renderBusinessSkills() {
  const query = document.getElementById("businessSkillSearch").value.trim().toLowerCase();
  const group = document.getElementById("businessSkillGroup").value;
  const source = query ? WEF_SKILL_GROUPS : group ? WEF_SKILL_GROUPS.filter(item => item.group === group) : [];
  const matches = source.flatMap(item => item.skills.filter(skill => [
    item.group, WEF_SKILL_GROUP_TRANSLATIONS[item.group], skill, WEF_SKILL_TRANSLATIONS[skill]
  ].filter(Boolean).join(" ").toLowerCase().includes(query)).map(skill => ({ group: item.group, skill })));
  const shown = matches.slice(0, 30);
  const atLimit = businessSkills.size >= BUSINESS_SKILL_LIMIT;
  document.getElementById("businessSkillResults").innerHTML = shown.length
    ? `<div class="submission-skill-grid">${shown.map(({ skill }) => {
        const selected = businessSkills.has(skill);
        const disabled = atLimit && !selected;
        return `<label class="submission-skill-option ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}"><input type="checkbox" value="${escapeBusinessHtml(skill)}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""}><span><strong>${escapeBusinessHtml(WEF_SKILL_TRANSLATIONS[skill] || skill)}</strong><small>${escapeBusinessHtml(skill)}</small></span></label>`;
      }).join("")}</div>${matches.length > shown.length ? `<p class="submission-help mt-3">พบ ${matches.length.toLocaleString("th-TH")} รายการ แสดง 30 รายการแรก กรุณาระบุคำค้นหาให้เจาะจงขึ้น</p>` : ""}`
    : `<div class="submission-empty">${query ? "ไม่พบทักษะที่ค้นหา" : "เลือกหมวดหรือค้นหาทักษะเพื่อเริ่มต้น"}</div>`;
}

function handleBusinessSkillChange(event) {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  if (checkbox.checked && businessSkills.size < BUSINESS_SKILL_LIMIT) businessSkills.add(checkbox.value);
  else businessSkills.delete(checkbox.value);
  syncBusinessSkills();
  renderBusinessSkills();
}

function removeBusinessSkill(event) {
  const button = event.target.closest("[data-remove-business-skill]");
  if (!button) return;
  businessSkills.delete(button.dataset.removeBusinessSkill);
  syncBusinessSkills();
  renderBusinessSkills();
}

function syncBusinessSkills() {
  const serialized = [...businessSkills].join(" | ");
  document.getElementById("businessWants").value = serialized;
  document.getElementById("businessSkillCount").textContent = `เลือกแล้ว ${businessSkills.size} / ${BUSINESS_SKILL_LIMIT}`;
  document.getElementById("businessSelectedSkills").innerHTML = businessSkills.size
    ? [...businessSkills].map(skill => `<span class="submission-chip"><span>${escapeBusinessHtml(WEF_SKILL_TRANSLATIONS[skill] || skill)}<small>${escapeBusinessHtml(skill)}</small></span><button type="button" data-remove-business-skill="${escapeBusinessHtml(skill)}" aria-label="นำทักษะออก"><i class="fas fa-xmark" aria-hidden="true"></i></button></span>`).join("")
    : "ยังไม่ได้เลือกทักษะ";
  document.getElementById("businessSkillError").hidden = !businessSkillValidationAttempted || (businessSkills.size > 0 && businessSkills.size <= BUSINESS_SKILL_LIMIT);
}

async function requestBusinessOtp() {
  const input = document.getElementById("businessEmail");
  if (!input.reportValidity()) return;
  const button = document.getElementById("requestBusinessOtp");
  button.disabled = true;
  showBusinessStatus("businessOtpStatus", "กำลังส่งรหัสยืนยัน…", "info");
  try {
    const result = await postBusinessAction({
      action: "requestBusinessSubmissionOtp",
      email: normalizedEmail(),
      website: document.getElementById("businessWebsite").value
    });
    if (!result.success) throw new Error(result.message || "ส่งรหัสไม่สำเร็จ");
    businessOtpEmail = normalizedEmail();
    document.getElementById("businessOtp").focus();
    showBusinessStatus("businessOtpStatus", "ส่งรหัสแล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์อีเมลขยะ รหัสมีอายุ 10 นาที", "success");
    startBusinessOtpCooldown(60);
  } catch (error) {
    showBusinessStatus("businessOtpStatus", `ส่งรหัสไม่สำเร็จ: ${error.message}`, "error");
    button.disabled = false;
  }
}

function startBusinessOtpCooldown(seconds) {
  clearInterval(businessOtpTimer);
  const button = document.getElementById("requestBusinessOtp");
  let remaining = seconds;
  businessOtpTimer = setInterval(() => {
    remaining--;
    button.textContent = remaining > 0 ? `ส่งใหม่ได้ใน ${remaining} วินาที` : "ส่งรหัสใหม่";
    if (remaining <= 0) {
      clearInterval(businessOtpTimer);
      button.disabled = false;
    }
  }, 1000);
}

async function submitBusinessForm(event) {
  event.preventDefault();
  if (!businessForm.reportValidity()) return;
  if (!document.getElementById("businessCoordinate").value) {
    showBusinessStatus("businessFormStatus", "กรุณาค้นหาหรือปักหมุดตำแหน่งสถานประกอบการบนแผนที่", "error");
    document.getElementById("coordinateTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (!businessSkills.size || businessSkills.size > BUSINESS_SKILL_LIMIT) {
    businessSkillValidationAttempted = true;
    document.getElementById("businessSkillError").hidden = false;
    document.getElementById("businessSkillsTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (businessOtpEmail !== normalizedEmail() || !/^\d{6}$/.test(document.getElementById("businessOtp").value.trim())) {
    showBusinessStatus("businessOtpStatus", "กรุณาขอรหัสและกรอกรหัสยืนยัน 6 หลักสำหรับอีเมลนี้", "error");
    document.getElementById("businessEmailTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const typeSelect = document.getElementById("businessType");
  const businessType = typeSelect.value === "__OTHER__"
    ? document.getElementById("businessTypeOther").value.trim()
    : typeSelect.value;
  if (!businessType) {
    document.getElementById("businessTypeOther").reportValidity();
    return;
  }
  const button = document.getElementById("submitBusiness");
  button.disabled = true;
  showBusinessStatus("businessFormStatus", "กำลังตรวจสอบอีเมลและส่งข้อมูล…", "info");
  try {
    const data = Object.fromEntries(["PROV_NAME", "BUSINESS_NAME", "COORDI", "BUSINESS_DETAILS", "BUSINESS_PAY", "BUSINESS_CONTACT"].map(field => [
      field, String(businessForm.elements.namedItem(field)?.value || "").trim()
    ]));
    data.BUSINESS_TYPE = businessType;
    data.BUSINESS_WANTS = [...businessSkills].join(" | ");
    const result = await postBusinessAction({
      action: "submitBusinessSubmission",
      dbKey: "DB_3",
      sheetName: "Vocational_Busi_MOU",
      email: normalizedEmail(),
      emailOtp: document.getElementById("businessOtp").value.trim(),
      website: document.getElementById("businessWebsite").value,
      consent: document.getElementById("businessConsent").checked,
      data
    });
    if (!result.success) throw new Error(result.message || "บันทึกข้อมูลไม่สำเร็จ");
    await EDU15DataClient.clear();
    showBusinessStatus("businessFormStatus", `ส่งข้อมูลเรียบร้อยแล้ว รหัสติดตามของคุณคือ ${result.code} กรุณาบันทึกรหัสนี้ไว้ ข้อมูลอยู่ระหว่างการตรวจสอบ`, "success", result.code);
    businessForm.reset();
    document.getElementById("businessYear").value = String(new Date().getFullYear() + 543);
    businessSkills.clear();
    businessSkillValidationAttempted = false;
    syncBusinessSkills();
    businessOtpEmail = "";
    document.getElementById("businessCoordinate").value = "";
    document.getElementById("businessCoordinateDisplay").textContent = "ยังไม่ได้ปักหมุด";
    if (businessMarker) { businessMarker.remove(); businessMarker = null; }
    toggleOtherBusinessType();
  } catch (error) {
    console.error(error);
    showBusinessStatus("businessFormStatus", `ส่งข้อมูลไม่สำเร็จ: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function postBusinessAction(payload) {
  const response = await fetch(BUSINESS_GAS_URL, { method: "POST", body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return result;
}

function normalizedEmail() {
  return document.getElementById("businessEmail").value.trim().toLowerCase();
}

function showBusinessStatus(id, message, type, code = "") {
  const element = document.getElementById(id);
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800"
  };
  element.className = `submission-status mt-3 ${styles[type] || styles.info}`;
  element.hidden = false;
  element.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  element.appendChild(text);
  if (code) {
    const codeElement = document.createElement("strong");
    codeElement.className = "submission-success-code mt-2 block";
    codeElement.textContent = code;
    element.appendChild(codeElement);
  }
}

function escapeBusinessHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
}
