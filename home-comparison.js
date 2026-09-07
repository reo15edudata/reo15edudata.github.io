const HOME_COMPARISON_API_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const HOME_PROVINCES = [
  { name: "เชียงใหม่", short: "ชม" },
  { name: "แม่ฮ่องสอน", short: "มส" },
  { name: "ลำพูน", short: "ลพ" },
  { name: "ลำปาง", short: "ลป" }
];

const homeNumber = value => {
  const number = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
};

const homeFormatNumber = value => value.toLocaleString("th-TH");

function homeComparisonMetric(label, value, maximum, unit) {
  const percent = maximum > 0 ? Math.max(value > 0 ? 3 : 0, value / maximum * 100) : 0;
  return `<div class="province-metric">
    <div class="province-metric-heading">
      <span class="province-metric-label">${label}</span>
      <span class="province-metric-value">${homeFormatNumber(value)} ${unit}</span>
    </div>
    <div class="province-bar-track" aria-hidden="true"><div class="province-bar" style="--province-bar-width:${percent.toFixed(2)}%"></div></div>
  </div>`;
}

function renderHomeComparison(rows, year) {
  const container = document.getElementById("provinceComparisonRows");
  const maxima = {
    students: Math.max(...rows.map(row => row.students), 0),
    teachers: Math.max(...rows.map(row => row.teachers), 0),
    schools: Math.max(...rows.map(row => row.schools), 0)
  };

  container.innerHTML = rows.map(row => `<article class="province-comparison-row" aria-label="จังหวัด${row.name}: นักเรียน ${homeFormatNumber(row.students)} คน ครู ${homeFormatNumber(row.teachers)} คน สถานศึกษา ${homeFormatNumber(row.schools)} แห่ง">
    <div class="province-name"><span class="province-marker" aria-hidden="true">${row.short}</span><span>จังหวัด${row.name}</span></div>
    ${homeComparisonMetric("นักเรียน", row.students, maxima.students, "คน")}
    ${homeComparisonMetric("ครู", row.teachers, maxima.teachers, "คน")}
    ${homeComparisonMetric("สถานศึกษา", row.schools, maxima.schools, "แห่ง")}
  </article>`).join("");
  container.setAttribute("aria-busy", "false");
  document.getElementById("provinceComparisonStatus").textContent = `ปีการศึกษา ${year} · ความยาวของแถบเปรียบเทียบกับจังหวัดที่มีค่าสูงสุดในตัวชี้วัดเดียวกัน`;
}

async function loadHomeComparison(year) {
  const container = document.getElementById("provinceComparisonRows");
  container.setAttribute("aria-busy", "true");
  container.innerHTML = `<div class="province-comparison-loading"><span class="province-loading-mark" aria-hidden="true"></span><span>กำลังเตรียมภาพเปรียบเทียบ 4 จังหวัด</span></div>`;

  try {
    const summary = await EDU15DataClient.fetchHomeProvinceSummary(
      HOME_COMPARISON_API_URL,
      year,
      HOME_PROVINCES.map(province => province.name)
    );
    const rows = HOME_PROVINCES.map(province => {
      const source = summary.data.find(row => String(row.PROV_NAME).trim() === province.name) || {};
      return {
        ...province,
        students: homeNumber(source.students),
        teachers: homeNumber(source.teachers),
        schools: homeNumber(source.schools)
      };
    });
    renderHomeComparison(rows, summary.year);
    return summary;
  } catch (error) {
    console.error(error);
    container.setAttribute("aria-busy", "false");
    container.innerHTML = `<div class="province-comparison-error" role="alert"><span>ไม่สามารถโหลดภาพเปรียบเทียบได้ในขณะนี้</span><button type="button" id="retryHomeComparison"><i class="fas fa-rotate-right" aria-hidden="true"></i> ลองอีกครั้ง</button></div>`;
    document.getElementById("provinceComparisonStatus").textContent = "ส่วนเปรียบเทียบขัดข้อง แต่ยังสามารถเปิดดูฐานข้อมูลแต่ละหมวดได้ตามปกติ";
    document.getElementById("retryHomeComparison")?.addEventListener("click", () => loadHomeComparison(year));
  }
}

async function initHomeComparison() {
  const yearSelect = document.getElementById("provinceComparisonYear");
  if (!yearSelect || !window.EDU15DataClient) return;

  try {
    const initial = await loadHomeComparison("");
    if (!initial) return;
    const years = [...new Set((initial.years || []).map(String).filter(Boolean))]
      .sort((a, b) => homeNumber(b) - homeNumber(a));
    if (!years.length) throw new Error("ไม่พบปีการศึกษา");

    yearSelect.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join("");
    yearSelect.value = initial.year;
    yearSelect.disabled = false;
    yearSelect.addEventListener("change", () => loadHomeComparison(yearSelect.value));
  } catch (error) {
    console.error(error);
    yearSelect.innerHTML = `<option>ไม่พบปีข้อมูล</option>`;
    const container = document.getElementById("provinceComparisonRows");
    container.setAttribute("aria-busy", "false");
    container.innerHTML = `<div class="province-comparison-error" role="alert"><span>ยังไม่สามารถเตรียมข้อมูลเปรียบเทียบได้</span><button type="button" id="retryHomeComparisonInit"><i class="fas fa-rotate-right" aria-hidden="true"></i> ลองอีกครั้ง</button></div>`;
    document.getElementById("retryHomeComparisonInit")?.addEventListener("click", initHomeComparison);
  }
}

window.addEventListener("DOMContentLoaded", initHomeComparison);
