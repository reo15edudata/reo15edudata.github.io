const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";

async function fetchAllPages(dbKey, sheetName) {
  const allRows = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const url =
      `${GAS_WEB_APP_URL}?dbKey=${encodeURIComponent(dbKey)}` +
      `&sheetName=${encodeURIComponent(sheetName)}` +
      `&limit=${limit}&offset=${offset}`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      throw new Error(
        `${sheetName}: ${result.message || "โหลดข้อมูลไม่สำเร็จ"}`
      );
    }

    allRows.push(...(result.data || []));

    if (!result.hasMore || result.data.length === 0) {
      return allRows;
    }

    offset += result.data.length;
  }
}

const SHEETS = {
  career: "Job_Vacancy_Career",
  industry: "Job_Vacancy_Industry",
  eduLevel: "Job_Vacancy_EduLevel",
  mou: "Vocational_Busi_MOU"
};

let data = {
  career: [],
  industry: [],
  eduLevel: [],
  mou: []
};

window.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  try {
    const results = await Promise.all(
      Object.entries(SHEETS).map(async ([key, sheetName]) => {
        const rows = await fetchAllPages("DB_3", sheetName);
        return [key, rows];
      })
    );

    data = Object.fromEntries(results);

    populateFilters();
    renderDashboard(getFilters());

    document.getElementById("filterForm").addEventListener("submit", event => {
      event.preventDefault();
      renderDashboard(getFilters());
    });

    document.getElementById("filterForm").addEventListener("reset", () => {
      setTimeout(() => renderDashboard(getFilters()), 0);
    });
  } catch (error) {
    console.error(error);

    document.getElementById("workforceTableBody").innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-8 text-center text-red-500">
          โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}
        </td>
      </tr>`;
  }
}

function populateFilters() {
  const allRows = Object.values(data).flat();

  const years = uniqueValues(allRows, "YEAR")
    .sort((a, b) => Number(b) - Number(a));

  const months = uniqueValues(
    [...data.career, ...data.industry, ...data.eduLevel],
    "MONTH"
  ).sort((a, b) => Number(a) - Number(b));

  const provinces = uniqueValues(allRows, "PROV_NAME").sort();

  fillSelect("filterYear", years);
  fillSelect("filterMonth", months);
  fillSelect("filterProvince", provinces);

  if (years.length > 0) {
    document.getElementById("filterYear").value = years[0];
  }
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  const firstOption = select.options[0];

  select.innerHTML = "";
  select.appendChild(firstOption);

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function uniqueValues(rows, field) {
  return [...new Set(
    rows
      .map(row => String(row[field] ?? "").trim())
      .filter(Boolean)
  )];
}

function getFilters() {
  return {
    year: document.getElementById("filterYear").value,
    month: document.getElementById("filterMonth").value,
    province: document.getElementById("filterProvince").value
  };
}

function filterRows(rows, filters) {
  return rows.filter(row => {
    if (filters.year && String(row.YEAR) !== String(filters.year)) return false;

    // ข้อมูล MOU ไม่มี MONTH จึงยังแสดงตามปีและจังหวัด
    if (filters.month && row.MONTH !== undefined &&
      String(row.MONTH) !== String(filters.month)) {
      return false;
    }

    if (filters.province && String(row.PROV_NAME) !== filters.province) return false;

    return true;
  });
}

function sum(rows, field) {
  return rows.reduce((total, row) => {
    const value = Number(String(row[field] ?? 0).replace(/,/g, ""));
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function renderDashboard(filters) {
  const filtered = {
    career: filterRows(data.career, filters),
    industry: filterRows(data.industry, filters),
    eduLevel: filterRows(data.eduLevel, filters),
    mou: filterRows(data.mou, filters)
  };

  document.getElementById("stat-career").textContent =
    formatNumber(sum(filtered.career, "VACANCY_COUNT"));

  document.getElementById("stat-industry").textContent =
    formatNumber(sum(filtered.industry, "VACANCY_COUNT"));

  document.getElementById("stat-edu-level").textContent =
    formatNumber(sum(filtered.eduLevel, "VACANCY_COUNT"));

  document.getElementById("stat-mou").textContent =
    formatNumber(filtered.mou.length);

  renderProvinceTable(filtered);
}

function renderProvinceTable(filtered) {
  const summary = {};

  function ensureProvince(province) {
    if (!summary[province]) {
      summary[province] = {
        career: 0,
        industry: 0,
        eduLevel: 0,
        mou: 0
      };
    }
  }

  function addVacancies(rows, metric) {
    rows.forEach(row => {
      const province = String(row.PROV_NAME || "ไม่ระบุจังหวัด").trim();
      const count = Number(String(row.VACANCY_COUNT ?? 0).replace(/,/g, "")) || 0;

      ensureProvince(province);
      summary[province][metric] += count;
    });
  }

  addVacancies(filtered.career, "career");
  addVacancies(filtered.industry, "industry");
  addVacancies(filtered.eduLevel, "eduLevel");

  filtered.mou.forEach(row => {
    const province = String(row.PROV_NAME || "ไม่ระบุจังหวัด").trim();
    ensureProvince(province);
    summary[province].mou += 1;
  });

  const provinces = Object.keys(summary).sort();
  const tbody = document.getElementById("workforceTableBody");

  if (provinces.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-8 text-center text-slate-400">
          ยังไม่มีข้อมูลตามเงื่อนไขที่เลือก
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = provinces.map(province => {
    const row = summary[province];

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-4 py-3 font-medium">${escapeHtml(province)}</td>
        <td class="px-4 py-3 text-right">${formatNumber(row.career)}</td>
        <td class="px-4 py-3 text-right">${formatNumber(row.industry)}</td>
        <td class="px-4 py-3 text-right">${formatNumber(row.eduLevel)}</td>
        <td class="px-4 py-3 text-right">${formatNumber(row.mou)}</td>
      </tr>`;
  }).join("");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}