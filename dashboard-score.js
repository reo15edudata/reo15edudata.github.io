const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const SCORE_SHEETS = {
  ONET_Score: "O-NET",
  NT_AVGScore: "NT (คะแนนเฉลี่ย)",
  NT_LevelScore: "NT (ระดับคุณภาพ)",
  RT_Score: "RT",
  VNET_Score: "V-NET",
  BNET_Score: "B-NET",
  NNET_Score: "N-NET"
};
let scoreData = {};
let scoreChart;

window.addEventListener("DOMContentLoaded", initScoreDashboard);

async function initScoreDashboard() {
  try {
    populateDatasetFilter();
    await loadDataset("ONET_Score");
    refreshDependentFilters();
    renderScoreDashboard();

    document.getElementById("filterDataset").addEventListener("change", async event => {
      try {
        window.showPageLoader?.(`กำลังดึงข้อมูล ${SCORE_SHEETS[event.target.value]}…`);
        await loadDataset(event.target.value);
        refreshDependentFilters();
        renderScoreDashboard();
      } catch (error) {
        document.getElementById("scoreTableBody").innerHTML =
          `<tr><td colspan="4" class="p-8 text-center text-rose-600">${escapeHtml(error.message)}</td></tr>`;
      } finally {
        window.hidePageLoader?.();
      }
    });
    document.getElementById("filterForm").addEventListener("submit", event => {
      event.preventDefault();
      renderScoreDashboard();
    });
    document.getElementById("filterForm").addEventListener("reset", () => {
      setTimeout(() => {
        document.getElementById("filterDataset").value = "ONET_Score";
        refreshDependentFilters();
        renderScoreDashboard();
      }, 0);
    });
  } catch (error) {
    console.error(error);
    document.getElementById("scoreTableBody").innerHTML =
      `<tr><td colspan="4" class="p-8 text-center text-rose-600">${escapeHtml(error.message)}</td></tr>`;
  } finally {
    window.hidePageLoader?.();
  }
}

async function loadDataset(sheetName) {
  if (scoreData[sheetName]) return scoreData[sheetName];
  scoreData[sheetName] = await EDU15DataClient.fetchAllPages(
    GAS_WEB_APP_URL,
    "DB_4",
    sheetName
  );
  return scoreData[sheetName];
}

function populateDatasetFilter() {
  const select = document.getElementById("filterDataset");
  Object.entries(SCORE_SHEETS).forEach(([value, label]) => select.add(new Option(label, value)));
}

function refreshDependentFilters() {
  const rows = activeRows();
  fillSelect("filterYear", unique(rows, "YEAR").sort((a, b) => Number(b) - Number(a)));
  fillSelect("filterTestLevel", unique(rows, "TEST_LEVEL").sort());
  const years = unique(rows, "YEAR").sort((a, b) => Number(b) - Number(a));
  if (years.length) document.getElementById("filterYear").value = years[0];
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  const first = select.options[0];
  select.innerHTML = "";
  select.append(first);
  values.forEach(value => select.add(new Option(value, value)));
}

function unique(rows, field) {
  return [...new Set(rows.map(row => String(row[field] ?? "").trim()).filter(Boolean))];
}

function activeRows() {
  return scoreData[document.getElementById("filterDataset").value] || [];
}

function filteredRows() {
  const year = document.getElementById("filterYear").value;
  const testLevel = document.getElementById("filterTestLevel").value;
  return activeRows().filter(row => {
    if (year && String(row.YEAR) !== year) return false;
    if (testLevel && String(row.TEST_LEVEL) !== testLevel) return false;
    return true;
  });
}

function numberValue(value) {
  const parsed = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function testedCount(row) {
  return numberValue(row.STUDENT_TEST_COUNT ?? row.STUDENT_COUNT ?? row.STUDENT_CNT);
}

function itemLabel(row) {
  return row.PART_NAME || row.STANDARD_NAME || row.TEST_SUBJECT || row.QUALITY_LEVEL || "ไม่ระบุ";
}

function renderScoreDashboard() {
  const rows = filteredRows();
  const weightedDenominator = rows.reduce((sum, row) => sum + testedCount(row), 0);
  const weightedScore = rows.reduce((sum, row) => sum + numberValue(row.AVG_SCORE) * testedCount(row), 0);
  const average = weightedDenominator > 0
    ? weightedScore / weightedDenominator
    : rows.length
      ? rows.reduce((sum, row) => sum + numberValue(row.AVG_SCORE), 0) / rows.length
      : 0;
  const passed = rows.reduce((sum, row) => sum + numberValue(row.STUDENT_MOREHALFTEST_COUNT), 0);

  document.getElementById("statAverage").textContent = average.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById("statTested").textContent = weightedDenominator.toLocaleString("th-TH");
  document.getElementById("statPassed").textContent = rows.some(row => row.STUDENT_MOREHALFTEST_COUNT !== undefined)
    ? passed.toLocaleString("th-TH")
    : "—";

  renderChart(rows);
  renderTable(rows);
}

function renderChart(rows) {
  const totals = new Map();
  rows.forEach(row => {
    const label = String(itemLabel(row));
    const current = totals.get(label) || { weighted: 0, tested: 0, scores: [] };
    const tested = testedCount(row);
    current.weighted += numberValue(row.AVG_SCORE) * tested;
    current.tested += tested;
    current.scores.push(numberValue(row.AVG_SCORE));
    totals.set(label, current);
  });
  const entries = [...totals].map(([label, item]) => [
    label,
    item.tested
      ? item.weighted / item.tested
      : item.scores.reduce((sum, value) => sum + value, 0) / item.scores.length
  ]).sort((a, b) => b[1] - a[1]).slice(0, 20);

  scoreChart?.destroy();
  scoreChart = new Chart(document.getElementById("scoreChart"), {
    type: "bar",
    data: {
      labels: entries.map(([label]) => label),
      datasets: [{ label: "คะแนนเฉลี่ย", data: entries.map(([, value]) => value), backgroundColor: "#0d9488", borderRadius: 6 }]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, suggestedMax: 100 } }
    }
  });
  document.getElementById("chartSummary").textContent = `แสดงสูงสุด 20 รายการ จาก ${entries.length.toLocaleString("th-TH")} กลุ่ม`;
}

function renderTable(rows) {
  const sorted = [...rows].sort((a, b) => numberValue(b.AVG_SCORE) - numberValue(a.AVG_SCORE));
  document.getElementById("tableSummary").textContent = `พบ ${sorted.length.toLocaleString("th-TH")} รายการ`;
  document.getElementById("scoreTableBody").innerHTML = sorted.length
    ? sorted.slice(0, 500).map(row => `<tr class="border-t">
        <td class="p-3 font-medium">${escapeHtml(itemLabel(row))}</td>
        <td class="p-3">${escapeHtml(row.TEST_LEVEL || row.EDU_LEVEL || row.PROV_NAME || "-")}</td>
        <td class="p-3 text-right">${numberValue(row.AVG_SCORE).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="p-3 text-right">${testedCount(row).toLocaleString("th-TH")}</td>
      </tr>`).join("")
    : '<tr><td colspan="4" class="p-8 text-center text-slate-400">ไม่พบข้อมูลตามตัวกรอง</td></tr>';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
}
