// ==========================================================================
// dashboard.js — ดึงข้อมูลจริงจาก Google Apps Script มาแสดงในหน้า dashboard.html
//
// ⚠️ ข้อสมมติที่ใช้ในไฟล์นี้ (โปรดตรวจสอบกับ Apps Script จริงของคุณ):
// 1. เรียก GAS_WEB_APP_URL แบบ GET ด้วย ?dbKey=...&sheetName=... แล้วได้ JSON กลับมาเป็น
//      { success: true, data: [ { COLUMN_NAME: value, ... }, ... ] }
//    โดยแต่ละ object ใน data คือ 1 แถวของชีต ใช้ชื่อคอลัมน์ตรงกับหัวตาราง (header)
// 2. คอลัมน์ DEPARTMENT_NAME มีค่าตรงกับ 4 สังกัดในหัวตาราง คือ "สพฐ.", "สช.", "อาชีวศึกษา", "อปท."
//    ถ้าข้อมูลจริงสะกด/ใช้คำต่างไปจากนี้ ต้องแก้ AGENCY_COLUMNS ด้านล่างให้ตรง
// ถ้าอย่างใดอย่างหนึ่งไม่ตรงกับความเป็นจริง ให้ปรับส่วนที่เกี่ยวข้องตามนั้นครับ
// ==========================================================================

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec"; // URL เดียวกับที่ใช้ใน app.js

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

// เก็บข้อมูลดิบทั้งหมดไว้ในหน่วยความจำ เพื่อกรอง/แสดงผลใหม่โดยไม่ต้อง fetch ซ้ำทุกครั้งที่เปลี่ยนตัวกรอง
let studentRows = [];
let teacherRows = [];

// สังกัด 4 กลุ่มหลักที่ตรงกับคอลัมน์ในตาราง (ต้องตรงกับค่าจริงในคอลัมน์ DEPARTMENT_NAME)
const AGENCY_COLUMNS = ["สพฐ.", "สช.", "อาชีวศึกษา", "อปท."];

window.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
    try {
        // ดึงข้อมูลนักเรียนและครูพร้อมกัน (คนละชีต ต้อง fetch แยก เพราะ schema ไม่ได้รวมเป็นชีตเดียว)
        const [students, teachers] = await Promise.all([
            fetchAllPages("DB_1", "Student_Count"),
            fetchAllPages("DB_1", "Teacher_Count")
        ]);

        studentRows = students;
        teacherRows = teachers;

        populateFilterOptions();
        renderDashboard(getCurrentFilters());

        const form = document.getElementById('filterForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            renderDashboard(getCurrentFilters());
        });
        form.addEventListener('reset', () => {
            // รอให้ browser เคลียร์ค่า select ก่อน ค่อยเรนเดอร์ใหม่
            setTimeout(() => renderDashboard(getCurrentFilters()), 0);
        });

    } catch (error) {
        console.error(error);
        document.getElementById('dataTableBody').innerHTML =
            `<tr><td colspan="6" class="px-4 py-8 text-center text-red-500">❌ โหลดข้อมูลไม่สำเร็จ: ${error.message}</td></tr>`;
    }
}

// สร้าง <option> ของ dropdown ทั้งหมดจากข้อมูลจริงที่โหลดมา (ไม่ hardcode ค่าคงที่)
function populateFilterOptions() {
    const years = uniqueValues(studentRows, 'ACAD_YEAR').sort((a, b) => b - a);
    const provinces = uniqueValues(studentRows, 'PROV_NAME').sort();
    const agencies = uniqueValues(studentRows, 'DEPARTMENT_NAME').sort();
    const eduAreas = uniqueValues(studentRows, 'EDU_AREA_NAME').sort();
    const eduLevels = uniqueValues(studentRows, 'EDU_LEVEL').sort();

    fillSelect('filterYear', years, 'ปีการศึกษา ');
    fillSelect('filterProvince', provinces);
    fillSelect('filterAgency', agencies);
    fillSelect('filterEduArea', eduAreas);
    fillSelect('filterEduLevel', eduLevels);

    // ตั้งค่า default ให้เลือกปีล่าสุดไว้ก่อน (เหมือนพฤติกรรมเดิม)
    if (years.length > 0) {
        document.getElementById('filterYear').value = years[0];
    }
}

function fillSelect(id, values, labelPrefix = '') {
    const select = document.getElementById(id);
    const placeholder = select.options[0]; // เก็บตัวเลือกแรก ("ทั้งหมด") ไว้
    select.innerHTML = '';
    select.appendChild(placeholder);
    values.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = labelPrefix + v;
        select.appendChild(opt);
    });
}

function uniqueValues(rows, field) {
    return Array.from(new Set(rows.map(r => String(r[field] ?? '').trim()).filter(v => v !== '')));
}

function getCurrentFilters() {
    return {
        year: document.getElementById('filterYear').value,
        province: document.getElementById('filterProvince').value,
        agency: document.getElementById('filterAgency').value,
        eduArea: document.getElementById('filterEduArea').value,
        eduLevel: document.getElementById('filterEduLevel').value,
        schoolName: document.getElementById('filterSchoolName').value.trim().toLowerCase()
    };
}

function matchesFilters(row, filters) {
    if (filters.year && String(row.ACAD_YEAR) !== String(filters.year)) return false;
    if (filters.province && row.PROV_NAME !== filters.province) return false;
    if (filters.agency && row.DEPARTMENT_NAME !== filters.agency) return false;
    if (filters.eduArea && row.EDU_AREA_NAME !== filters.eduArea) return false;
    if (filters.eduLevel && row.EDU_LEVEL !== filters.eduLevel) return false;
    if (filters.schoolName && !String(row.SCHOOL_NAME || '').toLowerCase().includes(filters.schoolName)) return false;
    return true;
}

function renderDashboard(filters) {
    const filteredStudents = studentRows.filter(r => matchesFilters(r, filters));
    const filteredTeachers = teacherRows.filter(r => matchesFilters(r, filters));

    renderStatCards(filteredStudents, filteredTeachers);
    renderTable(filteredStudents);
}

function renderStatCards(students, teachers) {
    const totalStudents = students.reduce((sum, r) => sum + Number(r.STUDENT_MALE || 0) + Number(r.STUDENT_FEMALE || 0), 0);
    const totalSchools = new Set(students.map(r => r.SCHOOL_CODE)).size;
    const totalTeachers = teachers.reduce((sum, r) => sum + Number(r.TEACHER_MALE || 0) + Number(r.TEACHER_FEMALE || 0), 0);

    document.getElementById('stat-total-students').textContent = totalStudents.toLocaleString('th-TH');
    document.getElementById('stat-total-schools').textContent = totalSchools.toLocaleString('th-TH');
    document.getElementById('stat-total-teachers').textContent = totalTeachers.toLocaleString('th-TH');
}

// ตารางสรุปแยกตามจังหวัด x สังกัด (สพฐ./สช./อาชีวศึกษา/อปท.)
function renderTable(students) {
    const summary = {}; // { [province]: { [agency]: count, total } }

    students.forEach(row => {
        const province = row.PROV_NAME || "ไม่ระบุ";
        const agency = row.DEPARTMENT_NAME || "ไม่ระบุ";
        const count = Number(row.STUDENT_MALE || 0) + Number(row.STUDENT_FEMALE || 0);

        if (!summary[province]) {
            summary[province] = { total: 0 };
            AGENCY_COLUMNS.forEach(a => summary[province][a] = 0);
        }
        if (!(agency in summary[province])) summary[province][agency] = 0; // เผื่อมีสังกัดนอกเหนือ 4 กลุ่มหลัก
        summary[province][agency] += count;
        summary[province].total += count;
    });

    const tbody = document.getElementById('dataTableBody');
    const provinces = Object.keys(summary).sort();

    if (provinces.length === 0) {
        tbody.innerHTML = `<tr class="border-b border-slate-100">
            <td colspan="6" class="px-4 py-8 text-center text-slate-400 italic">-- ไม่มีข้อมูลตามเงื่อนไขที่เลือก --</td>
        </tr>`;
        return;
    }

    tbody.innerHTML = provinces.map(prov => {
        const row = summary[prov];
        const cells = AGENCY_COLUMNS.map(a => `<td class="px-4 py-3 text-right">${(row[a] || 0).toLocaleString('th-TH')}</td>`).join('');
        return `<tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="px-4 py-3 font-medium">${prov}</td>
            ${cells}
            <td class="px-4 py-3 text-right font-bold text-teal-600">${row.total.toLocaleString('th-TH')}</td>
        </tr>`;
    }).join('');
}
