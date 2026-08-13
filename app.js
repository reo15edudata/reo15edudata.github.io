// 1. ตั้งค่าพื้นฐาน
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";

// 2. พจนานุกรม (Schema) ตรวจสอบหัวตาราง
// โครงสร้างใหม่: จัดกลุ่มตาม dbKey ก่อน แล้วค่อยตาม sheetName ข้างใน
// เหตุผล: ชื่อชีต (เช่น "Student_Count") อาจซ้ำกันได้ในฐานข้อมูลคนละตัว (DB_1 / DB_2 / DB_3)
// แต่มีโครงสร้างคอลัมน์ต่างกัน ถ้าใช้ sheetName เป็น key ตรงๆ แบบเดิม จะเกิด key ซ้ำและตัวหลังทับตัวแรกเงียบๆ
// (นี่คือบั๊กเดิมที่ทำให้อัปโหลด "ข้อมูลจำนวนนักเรียน" validate ผิด schema)
const SCHEMA_DICT = {
    // DB_1: สารสนเทศการศึกษา (โรงเรียน/นักเรียน/ครู) — ใช้งานจริงในหน้าอัปโหลดนี้แล้ว
    "DB_1": {
        "School_Location": [
            "PROV_NAME", "DEPARTMENT_NAME", "EDU_AREA_NAME", "SCHOOL_CODE",
            "SCHOOL_NAME", "SUB_DISTRICT", "DISTRICT", "COORDI"
        ],
        "Student_Count": [
            "ACAD_YEAR", "DEPARTMENT_NAME", "SCHOOL_CODE", "SCHOOL_NAME",
            "EDU_LEVEL", "PROV_NAME", "DISTRICT", "SUB_DISTRICT",
            "STUDENT_MALE", "STUDENT_FEMALE"
        ],
        "Teacher_Count": [
            "ACAD_YEAR", "DEPARTMENT_NAME", "SCHOOL_CODE", "SCHOOL_NAME",
            "PROV_NAME", "DISTRICT", "SUB_DISTRICT",
            "TEACHER_MALE", "TEACHER_FEMALE"
        ]
    },

    // DB_2: ดัชนีการศึกษา (ระดับจังหวัด/คลัสเตอร์)
    "DB_2": {
        "Population": [
            "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "PROV_NAME", "AGE_GROUP", "GENDER", "POPU_COUNT"
        ],
        "Special_Needs": [
            "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "PROV_NAME", "DEPARTMENT_NAME", "EDU_AREA_NAME", "SPECIAL_NEEDS", "TYPE_DIS", "EDU_LEVEL", "STUDENT_COUNT"
        ],
        "Out_of_School": [
            "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "PROV_NAME", "NATIONALITY", "EDU_LEVEL", "OOSC_RESULT", "OOSC_COUNT"
        ],
        "Dropout": [
            "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "PROV_NAME", "DEPARTMENT_NAME", "EDU_LEVEL", "DROPOUT_CAUSE", "DROPOUT_COUNT"
        ],
        "Get_a_Jobs": [
            "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "DEPARTMENT_NAME", "PROV_NAME", "EDU_LEVEL", "EMPLOY_STATUS", "STUDENT_COUNT"
        ],
        "Study_YearAVG": [
            "YEAR", "PROV_NAME", "STUDY_YEARAVG"
        ],
        "Ratio_StudyLevel": [
            "YEAR", "PROV_NAME", "EDU_LEVEL", "RATIO_STUDY"
        ],
        "5YearsOld_Fertile": [
            "YEAR", "PROV_NAME", "POPU_5YSO", "POPU_5YSO_CANFOLLOW",
            "YOUTH_FERTILE_COUNT", "YOUTH_FERTILE_RATIO"
        ]
    },

    // DB_3: ความต้องการกำลังคน (ตลาดแรงงาน)
    "DB_3": {
        "Job_Vacancy_Career": [
            "YEAR", "MONTH", "PROV_NAME", "DATA_TYPE", "CAREER_TYPE", "VACANCY_COUNT"
        ],
        "Job_Vacancy_Industry": [
            "YEAR", "MONTH", "PROV_NAME", "DATA_TYPE", "INDUSTRY_TYPE", "VACANCY_COUNT"
        ],
        "Job_Vacancy_EduLevel": [
            "YEAR", "MONTH", "PROV_NAME", "DATA_TYPE", "EDU_LEVEL", "VACANCY_COUNT"
        ],
        "Vocational_Busi_MOU": [
            "YEAR", "PROV_NAME", "BUSINESS_TYPE", "BUSINESS_NAME", "COORDI",
            "BUSINESS_DETAILS", "BUSINESS_PAY", "BUSINESS_WANTS", "BUSINESS_CONTACT"
        ],
        "Business_Student_Profile": [
            "SUBMITED_TIME", "STUDENT_NAME", "GENDER", "SCHOOL_NAME",
            "EDU_LEVEL", "DESCRIPTION_STUDENT", "TOP_SKILLS", "LOOKING_WORK",
            "AVAILABLE_TIME", "PORTFOLIO_LINK", "STUDENT_CONTRACT"
        ]
    },

    "DB_4": {
        "ONET_Score": [
            "YEAR", "EDU_LEVEL", "TEST_LEVEL", "TEST_SUBJECT",
            "STUDENT_TEST_COUNT", "AVG_SCORE", "STUDENT_MOREHALFTEST_COUNT"
        ],
        "NT_AVGScore": [
            "YEAR", "TEST_LEVEL", "TEST_SUBJECT", "STUDENT_TEST_COUNT", "AVG_SCORE"
        ],
        "NT_LevelScore": [
            "YEAR", "TEST_LEVEL", "TEST_SUBJECT", "QUALITY_LEVEL",
            "STUDENT_TEST_COUNT", "AVG_SCORE"
        ],
        "RT_Score": [
            "YEAR", "TEST_LEVEL", "TEST_SUBJECT",
            "STUDENT_TEST_COUNT", "AVG_SCORE", "STUDENT_MOREHALFTEST_COUNT"
        ],
        "VNET_Score": [
            "YEAR", "TEST_LEVEL", "REGIONAL", "PROV_NAME", "TEST_SUBJECT",
            "PART_NAME", "STUDENT_COUNT", "FUll_SCORE", "AVG_SCORE", "SD_SCORE",
            "MED_SCORE", "MOD_SCORE", "MIN_SCORE", "MAX_SCORE"
        ],
        "BNET_Score": [
            "YEAR", "TEST_LEVEL", "REGIONAL", "PROV_NAME", "TEST_SUBJECT",
            "STANDARD_NAME", "STUDENT_CNT", "FULL_SCORE", "AVG_SCORE", "SD_SCORE",
            "MED_SCORE", "MOD_SCORE", "MIN_SCORE", "MAX_SCORE"
        ],
        "NNET_Score": [
            "YEAR", "PERIOD_NO", "TEST_LEVEL", "TEST_SUBJECT", "REGIONAL",
            "PROV_NAME", "STUDENT_CNT", "FULL_SCORE", "AVG_SCORE", "SD_SCORE",
            "MED_SCORE", "MOD_SCORE", "MIN_SCORE", "MAX_SCORE"
        ]
    },

    "DB_5": {
        "TZD_Finding_Update": [
            "SUBMITED_TIME", "ROUND_MONTH", "PROV_NAME", "DISTRICT", "TARGET_COUNT",
            "FIRSTSCREEN_FOUND_HAVEEVIDENCE", "FIRSTSCREEN_FOUND_HAVENTEVIDENCE"
        ],
        "TZD_Finding_Status": [
            "SUBMITED_TIME", "ROUND_MONTH", "PROV_NAME", "DISTRICT", "NEEDHELP_INFO_SURVEYED",
            "NEEDHELP_INFO_NOTSURVEY", "BACKED_TO_EDU", "ALTER_EDU", "STUDY_ABROAD",
            "GRADUTED_COMPLUSEEDU", "WORK_EMPLOY", "HAVE_FAMILY", "JUSTICE_SYS",
            "WELFARE_CENTER", "DRUG_ADDICT", "RELOCATED", "CANT_FIND_HOUSE",
            "DONT_NEED_HELP", "DECEASED"
        ],
        "TZD_CM_CarePlanning": [
            "SUBMITED_TIME", "ROUND_MONTH", "PROV_NAME", "DISTRICT", "CASE_PREPARE_COUNT"
        ],
        "TZD_CM_Follow": [
            "SUBMITED_TIME", "ROUND_MONTH", "PROV_NAME", "DISTRICT", "PLAN_STATUS",
            "DO_CARE_PLAN", "FOLLOW_1ST", "FOLLOW_2ND"
        ]
    }
};

// เปิดให้ Admin Console ใช้ schema เดียวกันสำหรับสร้างไฟล์ Excel template
window.EDU15_SCHEMAS = SCHEMA_DICT;

// 3. ฟังก์ชันหลักเมื่อกดปุ่ม
document.getElementById('uploadBtn').addEventListener('click', async () => {
    const dataType = document.getElementById('dataType').value;
    const fileInput = document.getElementById('excelFile');
    const statusMsg = document.getElementById('statusMsg');

    statusMsg.className = "status-msg";
    statusMsg.innerHTML = "";

    // --- ตรวจสอบสิทธิ์ก่อนทำอะไรทั้งสิ้น (กันไม่ให้ user ที่ยังไม่ login มาอัปโหลดได้) ---
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        showStatus("กรุณาเข้าสู่ระบบก่อนอัปโหลดข้อมูล", "error");
        return;
    }

    if (!dataType) { showStatus("กรุณาเลือกประเภทข้อมูล", "error"); return; }
    if (!fileInput.files.length) { showStatus("กรุณาเลือกไฟล์ Excel ก่อน", "error"); return; }

    const [dbKey, sheetName] = dataType.split('|');
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            showStatus("กำลังอ่านไฟล์และตรวจสอบความถูกต้อง...", "info");
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];

            // อ่านข้อมูลทั้งหมดเป็น 2D Array (แทนการเป็น Object)
            const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            if (allData.length === 0) throw new Error("ไฟล์ว่างเปล่า ไม่มีข้อมูล");

            const uploadedHeaders = allData[0]
                .map(h => String(h ?? "").trim());

            // ตัดเฉพาะคอลัมน์ว่างที่ติดท้ายไฟล์ Excel ออก
            while (
                uploadedHeaders.length > 0 &&
                uploadedHeaders[uploadedHeaders.length - 1] === ""
            ) {
                uploadedHeaders.pop();
            }
            const expectedHeaders = SCHEMA_DICT[dbKey] && SCHEMA_DICT[dbKey][sheetName];

            if (!expectedHeaders) {
                throw new Error(`ไม่พบ schema สำหรับ ${dbKey} / ${sheetName} กรุณาตรวจสอบการตั้งค่าใน SCHEMA_DICT`);
            }

            // --- ตรวจสอบหัวตาราง (Validation) ---
            const headersMatch = (
                uploadedHeaders.length === expectedHeaders.length &&
                uploadedHeaders.every(
                    (header, index) => header === expectedHeaders[index]
                )
            );

            if (!headersMatch) {
                throw new Error(
                    `หัวตารางไม่ตรงกับรูปแบบที่กำหนดสำหรับ ${sheetName} ` +
                    `กรุณาตรวจชื่อและลำดับคอลัมน์ให้ตรงกับ template`
                );
            }

            // --- แปลงข้อมูลให้เป็น 2D Array สำหรับ Google Sheets ---
            const expectedColCount = expectedHeaders.length;
            const rowData = allData.slice(1) // ตัดแถวที่ 1 (หัวตาราง) ออก
                .filter(row => row.length > 0 && row.some(cell => cell !== "")) // กรองบรรทัดที่ว่างเปล่าทิ้ง
                .map(row => {
                    // บังคับให้ทุกบรรทัดมีจำนวนคอลัมน์เท่ากันเป๊ะ (อุดรอยรั่วเรื่องพารามิเตอร์เป็น null)
                    const newRow = [...row];
                    while (newRow.length < expectedColCount) newRow.push("");
                    return newRow.slice(0, expectedColCount);
                });

            if (rowData.length === 0) throw new Error("ไม่พบข้อมูลในไฟล์ (มีแต่หัวตาราง)");

            showStatus(`ข้อมูลถูกต้อง พบทั้งหมด ${rowData.length} รายการ. กำลังตรวจสอบสิทธิ์และบันทึกลงฐานข้อมูล...`, "info");

            // --- แนบ Firebase ID Token ไปกับ request ---
            // ฝั่ง Apps Script ต้องตรวจสอบ idToken นี้กับ Google ก่อนเขียนข้อมูลจริง
            // (ดูตัวอย่างฟังก์ชัน isValidFirebaseUser ที่ให้ไว้แยกต่างหาก)
            const idToken = await currentUser.getIdToken();
            const payload = { idToken, dbKey, sheetName, data: rowData };

            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                window.EDU15DataClient?.clear();
                showStatus(`✅ สำเร็จ! ${result.message}`, "success");
                fileInput.value = "";
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            showStatus(`❌ ผิดพลาด: ${error.message}`, "error");
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(file);
});

function showStatus(text, type) {
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerHTML = text;
    if (type === "error") statusMsg.style.color = "red";
    else if (type === "success") statusMsg.style.color = "green";
    else statusMsg.style.color = "blue";
}
