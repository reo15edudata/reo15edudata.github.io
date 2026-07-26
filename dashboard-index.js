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
  population: "Population",
  specialNeeds: "Special_Needs",
  outOfSchool: "Out_of_School",
  dropout: "Dropout",
  employed: "Get_a_Jobs"
};

let data = {
  population: [],
  specialNeeds: [],
  outOfSchool: [],
  dropout: [],
  employed: []
};

window.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  try {
    const results = await Promise.all(
      Object.entries(SHEETS).map(async ([key, sheetName]) => {
        const rows = await fetchAllPages("DB_2", sheetName);
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
    document.getElementById("indicatorTableBody").innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-red-500">
          โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}
        </td>
      </tr>`;
  }
}

function populateFilters() {
  const allRows = Object.values(data).flat();

  const years = uniqueValues(allRows, "YEAR")
    .sort((a, b) => Number(b) - Number(a));

  const provinces = uniqueValues(allRows, "PROV_NAME").sort();

  fillSelect("filterYear", years);
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
    province: document.getElementById("filterProvince").value
  };
}

function filterRows(rows, filters) {
  return rows.filter(row => {
    if (filters.year && String(row.YEAR) !== String(filters.year)) return false;
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
    population: filterRows(data.population, filters),
    specialNeeds: filterRows(data.specialNeeds, filters),
    outOfSchool: filterRows(data.outOfSchool, filters),
    dropout: filterRows(data.dropout, filters),
    employed: filterRows(data.employed, filters)
  };

  document.getElementById("stat-population").textContent =
    formatNumber(sum(filtered.population, "POPU_COUNT"));

  document.getElementById("stat-special-needs").textContent =
    formatNumber(sum(filtered.specialNeeds, "STUDENT_COUNT"));

  document.getElementById("stat-out-of-school").textContent =
    formatNumber(sum(filtered.outOfSchool, "OOSC_COUNT"));

  document.getElementById("stat-dropout").textContent =
    formatNumber(sum(filtered.dropout, "DROPOUT_COUNT"));

  document.getElementById("stat-employed").textContent =
    formatNumber(sum(filtered.employed, "STUDENT_COUNT"));

  renderProvinceTable(filtered);
}

function renderProvinceTable(filtered) {
  const summary = {};

  const addRows = (rows, field, metric) => {
    rows.forEach(row => {
      const province = String(row.PROV_NAME || "ไม่ระบุจังหวัด").trim();
      const value = Number(String(row[field] ?? 0).replace(/,/g, "")) || 0;

      if (!summary[province]) {
        summary[province] = {
          population: 0,
          specialNeeds: 0,
          outOfSchool: 0,
          dropout: 0,
          employed: 0
        };
      }

      summary[province][metric] += value;
    });
  };

  addRows(filtered.population, "POPU_COUNT", "population");
  addRows(filtered.specialNeeds, "STUDENT_COUNT", "specialNeeds");
  addRows(filtered.outOfSchool, "OOSC_COUNT", "outOfSchool");
  addRows(filtered.dropout, "DROPOUT_COUNT", "dropout");
  addRows(filtered.employed, "STUDENT_COUNT", "employed");

  const provinces = Object.keys(summary).sort();
  const tbody = document.getElementById("indicatorTableBody");

  if (provinces.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-slate-400">
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
        <td class="px-4 py-3 text-right">${formatNumber(row.population)}</td>
        <td class="px-4 py-3 text-right">${formatNumber(row.specialNeeds)}</td>
        <td class="px-4 py-3 text-right">${formatNumber(row.outOfSchool)}</td>
        <td class="px-4 py-3 text-right">${formatNumber(row.dropout)}</td>
        <td class="px-4 py-3 text-right">${formatNumber(row.employed)}</td>
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