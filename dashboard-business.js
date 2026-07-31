const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const BUSINESS_SHEET = "Vocational_Busi_MOU";
let businessRows = [];
let businessProvinceFilter;
let defaultBusinessYear = "";
let businessMap;
let businessLayer;
let businessPopup;
let businessMapInitialized = false;
let pendingBusinessRows = [];
let businessMapRenderVersion = 0;
let currentMouRows = [];
let selectedBusinessRow = null;
let businessMarkerByRow = new WeakMap();
const businessCoordinateCache = new WeakMap();
const BUSINESS_MAP_CHUNK_SIZE = 200;

window.addEventListener("DOMContentLoaded", initBusinessDashboard);

async function initBusinessDashboard() {
  try {
    const metadata = await EDU15DataClient.fetchMetadata(
      GAS_WEB_APP_URL, "DB_3", BUSINESS_SHEET, ["YEAR", "PROV_NAME"]
    );
    populateBusinessFilters(metadata);
    setupBusinessDetails();
    setupLazyMap();
    await loadBusinessData();
    document.getElementById("businessFilterForm").addEventListener("submit", async event => {
      event.preventDefault();
      await loadBusinessData();
    });
    document.getElementById("businessFilterForm").addEventListener("reset", () => setTimeout(async () => {
      businessProvinceFilter.clear();
      document.getElementById("businessYear").value = defaultBusinessYear;
      await loadBusinessData();
    }, 0));
  } catch (error) {
    console.error(error);
    showBusinessError(error);
  } finally {
    await window.hidePageLoader?.();
  }
}

function populateBusinessFilters(metadata) {
  const years = [...new Set((metadata.YEAR || []).map(String).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  const provinces = [...new Set((metadata.PROV_NAME || []).map(String).filter(Boolean))].sort();
  const yearSelect = document.getElementById("businessYear");
  years.forEach(year => yearSelect.add(new Option(year, year)));
  defaultBusinessYear = years[0] || "";
  yearSelect.value = defaultBusinessYear;
  businessProvinceFilter = EDU15MultiSelect.create(
    document.getElementById("businessProvince"), provinces, "ทุกจังหวัด"
  );
}

async function loadBusinessData() {
  window.showPageLoader?.("กำลังโหลดข้อมูลสถานประกอบการ", 0);
  try {
    const year = document.getElementById("businessYear").value;
    const provinces = businessProvinceFilter.getValues();
    businessRows = await EDU15DataClient.fetchAllPages(
      GAS_WEB_APP_URL,
      "DB_3",
      BUSINESS_SHEET,
      { filters: { year, province: provinces } }
    );
    renderMou(businessRows);
    queueBusinessMapRender(businessRows);
  } catch (error) {
    console.error(error);
    showBusinessError(error);
  } finally {
    await window.hidePageLoader?.();
  }
}

function showBusinessError(error) {
  document.getElementById("mouTableBody").innerHTML =
    `<tr><td colspan="2" class="p-8 text-center text-rose-600">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
}

function renderMou(rows) {
  const sorted = [...rows].sort((a, b) => String(a.BUSINESS_NAME).localeCompare(String(b.BUSINESS_NAME), "th"));
  currentMouRows = sorted;
  if (selectedBusinessRow && !sorted.includes(selectedBusinessRow)) closeBusinessDetails();
  document.getElementById("stat-mou").textContent = sorted.length.toLocaleString("th-TH");
  document.getElementById("mouTableSummary").textContent = sorted.length
    ? `พบ ${sorted.length.toLocaleString("th-TH")} รายการ · คลิกชื่อเพื่อดูรายละเอียด`
    : "รอข้อมูลอัปเดต";
  document.getElementById("mouTableBody").innerHTML = sorted.length
    ? sorted.map((row, index) => `<tr class="border-t transition-colors hover:bg-teal-50/60"><td class="p-3"><button type="button" class="text-left font-medium text-teal-700 hover:text-teal-900 hover:underline" data-business-index="${index}" aria-controls="businessDetailPanel" aria-expanded="${row === selectedBusinessRow}">${escapeHtml(row.BUSINESS_NAME || "ไม่ระบุ")}</button></td><td class="p-3">${escapeHtml(row.BUSINESS_TYPE || "-")}</td></tr>`).join("")
    : '<tr><td colspan="2" class="p-8 text-center text-slate-400">รอข้อมูลอัปเดต</td></tr>';
}

function setupBusinessDetails() {
  document.getElementById("mouTableBody").addEventListener("click", event => {
    const button = event.target.closest("[data-business-index]");
    if (!button) return;
    const row = currentMouRows[Number(button.dataset.businessIndex)];
    if (row) showBusinessDetails(row);
  });
  document.getElementById("closeBusinessDetail").addEventListener("click", closeBusinessDetails);
}
function closeBusinessDetails() {
  selectedBusinessRow = null;
  document.getElementById("businessDetailPanel").hidden = true;
  document.querySelectorAll("[data-business-index]").forEach(button => {
    button.setAttribute("aria-expanded", "false");
    button.closest("tr")?.classList.remove("bg-teal-50");
  });
}
function showBusinessDetails(row, { focusMap = true } = {}) {
  selectedBusinessRow = row;
  document.getElementById("businessDetailName").textContent = row.BUSINESS_NAME || "ไม่ระบุชื่อสถานประกอบการ";
  document.getElementById("businessDetailMeta").textContent = [row.BUSINESS_TYPE, row.PROV_NAME]
    .map(value => String(value || "").trim()).filter(Boolean).join(" · ") || "ไม่ระบุประเภทและจังหวัด";
  document.getElementById("businessDetailText").textContent = String(row.BUSINESS_DETAILS || "").trim() || "ไม่มีรายละเอียดเพิ่มเติม";
  document.getElementById("businessDetailPay").textContent = String(row.BUSINESS_PAY || "").trim() || "ไม่ระบุค่าตอบแทน";
  const keywords = [...new Set(String(row.BUSINESS_WANTS || "").split(",").map(value => value.trim()).filter(Boolean))];
  document.getElementById("businessDetailWants").innerHTML = keywords.length
    ? keywords.map(keyword => `<span class="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">${escapeHtml(keyword)}</span>`).join("")
    : '<span class="text-sm text-slate-400">ไม่ระบุทักษะที่ต้องการ</span>';
  document.getElementById("businessDetailContact").innerHTML = businessContactHtml(row.BUSINESS_CONTACT);
  document.getElementById("businessDetailPanel").hidden = false;
  document.querySelectorAll("[data-business-index]").forEach(button => {
    const active = currentMouRows[Number(button.dataset.businessIndex)] === row;
    button.setAttribute("aria-expanded", String(active));
    button.closest("tr")?.classList.toggle("bg-teal-50", active);
  });
  if (focusMap) focusBusinessOnMap(row);
}
function businessContactHtml(value) {
  const contact = String(value || "").trim();
  if (!contact) return '<span class="text-slate-400">ไม่ระบุช่องทางติดต่อ</span>';
  const url = /^https?:\/\//i.test(contact) ? contact : /^www\./i.test(contact) ? `https://${contact}` : "";
  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="font-medium text-blue-700 hover:underline">${escapeHtml(contact)}</a>`
    : escapeHtml(contact);
}

function setupLazyMap() {
  const toggleButton = document.getElementById("toggleBusinessMapButton");
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  toggleButton.addEventListener("click", () => { if (businessMapInitialized) closeMap(); else initMap(); });
  updateMapToggle(false);
  if (!isMobile) requestAnimationFrame(initMap);
}
function updateMapToggle(isOpen) {
  const toggleButton = document.getElementById("toggleBusinessMapButton");
  toggleButton.setAttribute("aria-expanded", String(isOpen));
  toggleButton.querySelector("[data-map-toggle-label]").textContent = isOpen ? "ปิดแผนที่" : "เปิดแผนที่";
  toggleButton.querySelector("[data-map-toggle-icon]").className = isOpen ? "fas fa-map-location-dot mr-2" : "fas fa-map mr-2";
}
function initMap() {
  if (businessMapInitialized) return;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  document.getElementById("businessMapPlaceholder").classList.add("edu15-map-hidden");
  document.getElementById("businessMap").classList.remove("hidden", "edu15-map-hidden");
  document.getElementById("businessMapSummary").textContent = "กำลังเตรียมแผนที่…";
  businessMap = L.map("businessMap", {
    preferCanvas: true,
    zoomAnimation: !isMobile,
    fadeAnimation: !isMobile,
    markerZoomAnimation: !isMobile
  }).setView([18.4, 99.0], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, updateWhenIdle: true, keepBuffer: isMobile ? 1 : 2,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(businessMap);
  businessLayer = L.layerGroup().addTo(businessMap);
  businessPopup = L.popup({ maxWidth: isMobile ? 240 : 320, autoPan: false });
  businessMapInitialized = true;
  updateMapToggle(true);
  requestAnimationFrame(() => {
    businessMap.invalidateSize();
    renderMap(pendingBusinessRows, businessMapRenderVersion);
  });
}
function closeMap() {
  if (!businessMapInitialized) return;
  businessMapRenderVersion++;
  businessMap.closePopup();
  businessLayer.clearLayers();
  businessMap.remove();
  businessMap = businessLayer = businessPopup = null;
  businessMapInitialized = false;
  document.getElementById("businessMap").classList.add("hidden", "edu15-map-hidden");
  document.getElementById("businessMapPlaceholder").classList.remove("edu15-map-hidden");
  document.getElementById("businessMapSummary").textContent = "พร้อมแสดงพิกัดเมื่อเปิดแผนที่";
  updateMapToggle(false);
}
function parseCoordinate(value) {
  const values = String(value || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!values || values.length < 2) return null;
  let [lat, lng] = values;
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}
function coordinateForBusiness(row) {
  if (businessCoordinateCache.has(row)) return businessCoordinateCache.get(row);
  const coordinate = parseCoordinate(row.COORDI);
  businessCoordinateCache.set(row, coordinate);
  return coordinate;
}
function openBusinessPopup(event) {
  const marker = event.target;
  if (marker.options.edu15BusinessRow) showBusinessDetails(marker.options.edu15BusinessRow, { focusMap: false });
  businessPopup.setLatLng(event.latlng).setContent(marker.options.edu15PopupHtml).openOn(businessMap);
}
function focusBusinessOnMap(row) {
  if (!businessMapInitialized) return;
  const coordinate = coordinateForBusiness(row);
  if (!coordinate) {
    document.getElementById("businessMapSummary").textContent = "สถานประกอบการที่เลือกไม่ได้ระบุพิกัดที่ถูกต้อง";
    return;
  }
  businessMap.stop();
  businessMap.invalidateSize({ pan: false });
  businessMap.setView(coordinate, 16, { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
  const popupHtml = `<strong>${escapeHtml(row.BUSINESS_NAME || "สถานประกอบการ")}</strong><br>${escapeHtml(row.BUSINESS_TYPE || "")}`;
  businessPopup.setLatLng(coordinate).setContent(popupHtml).openOn(businessMap);
  businessMarkerByRow.get(row)?.bringToFront();
  document.getElementById("businessMapSummary").textContent = `กำลังแสดงตำแหน่ง ${row.BUSINESS_NAME || "สถานประกอบการที่เลือก"}`;
}
function queueBusinessMapRender(rows) {
  pendingBusinessRows = rows;
  businessMapRenderVersion++;
  if (!businessMapInitialized) {
    document.getElementById("businessMapSummary").textContent = "พร้อมแสดงพิกัดเมื่อเปิดแผนที่";
    return;
  }
  renderMap(rows, businessMapRenderVersion);
}
function renderMap(rows, version) {
  businessMap.closePopup();
  businessLayer.clearLayers();
  businessMarkerByRow = new WeakMap();
  const bounds = L.latLngBounds([]);
  const summary = document.getElementById("businessMapSummary");
  let valid = 0;
  let index = 0;
  const addChunk = () => {
    if (version !== businessMapRenderVersion || !businessMapInitialized) return;
    const end = Math.min(index + BUSINESS_MAP_CHUNK_SIZE, rows.length);
    for (; index < end; index++) {
      const row = rows[index];
      const coordinate = coordinateForBusiness(row);
      if (!coordinate) continue;
      valid++;
      bounds.extend(coordinate);
      const marker = L.circleMarker(coordinate, {
        radius: 6, color: "#6d28d9", fillColor: "#8b5cf6", fillOpacity: .75, weight: 1,
        edu15BusinessRow: row,
        edu15PopupHtml: `<strong>${escapeHtml(row.BUSINESS_NAME || "สถานประกอบการ")}</strong><br>${escapeHtml(row.BUSINESS_TYPE || "")}`
      }).on("click", openBusinessPopup).addTo(businessLayer);
      businessMarkerByRow.set(row, marker);
    }
    if (index < rows.length) {
      summary.textContent = `กำลังแสดงพิกัด ${index.toLocaleString("th-TH")} จาก ${rows.length.toLocaleString("th-TH")} รายการ`;
      requestAnimationFrame(addChunk);
      return;
    }
    summary.textContent = valid ? `แสดงพิกัดที่ถูกต้อง ${valid.toLocaleString("th-TH")} แห่ง` : "ไม่พบพิกัดตามตัวกรอง";
    if (selectedBusinessRow && rows.includes(selectedBusinessRow) && coordinateForBusiness(selectedBusinessRow)) {
      focusBusinessOnMap(selectedBusinessRow);
    } else if (bounds.isValid()) {
      businessMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 13, animate: false });
    }
    businessMap.invalidateSize();
  };
  requestAnimationFrame(addChunk);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[char]);
}
