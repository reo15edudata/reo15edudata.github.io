const DB_MAP = {
  DB_1: "1hagtaN4NT6LOKCghyFttk2BfvgnKAs3GFOekYdh2eoI",
  DB_2: "1Qu33KGMI-U-5Cri4NtgiV840f-mA6ReqBbo2wRrH3TU",
  DB_3: "1Ti5cLecR_GLO1tdNqlUh3jsdd8FNqv5M8ZuFD8l726I",
  DB_4: "1sWOTOnkKYbTNeDW0XQckbVxZE5z1VKsl7k06hrjpJPk"
};

const SCHEMA_DICT = {
  DB_1: {
    School_Location: [
      "PROV_NAME", "DEPARTMENT_NAME", "EDU_AREA_NAME", "SCHOOL_CODE",
      "SCHOOL_NAME", "SUB_DISTRICT", "DISTRICT", "COORDI"
    ],
    Student_Count: [
      "ACAD_YEAR", "DEPARTMENT_NAME", "SCHOOL_CODE", "SCHOOL_NAME",
      "EDU_LEVEL", "PROV_NAME", "DISTRICT", "SUB_DISTRICT",
      "STUDENT_MALE", "STUDENT_FEMALE"
    ],
    Teacher_Count: [
      "ACAD_YEAR", "DEPARTMENT_NAME", "SCHOOL_CODE", "SCHOOL_NAME",
      "PROV_NAME", "DISTRICT", "SUB_DISTRICT",
      "TEACHER_MALE", "TEACHER_FEMALE"
    ]
  },
  DB_2: {
    Population: [
      "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "PROV_NAME",
      "AGE_GROUP", "GENDER", "POPU_COUNT"
    ],
    Special_Needs: [
      "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "PROV_NAME",
      "DEPARTMENT_NAME", "EDU_AREA_NAME", "SPECIAL_NEEDS", "TYPE_DIS",
      "EDU_LEVEL", "STUDENT_COUNT"
    ],
    Out_of_School: [
      "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "PROV_NAME",
      "NATIONALITY", "EDU_LEVEL", "OOSC_RESULT", "OOSC_COUNT"
    ],
    Dropout: [
      "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "PROV_NAME",
      "DEPARTMENT_NAME", "EDU_LEVEL", "DROPOUT_CAUSE", "DROPOUT_COUNT"
    ],
    Get_a_Jobs: [
      "YEAR", "REGIONAL", "PROV_CLUSTER_NAME", "DEPARTMENT_NAME",
      "PROV_NAME", "EDU_LEVEL", "EMPLOY_STATUS", "STUDENT_COUNT"
    ],
    Study_YearAVG: [
      "YEAR", "PROV_NAME", "STUDY_YEARAVG"
    ],
    Ratio_StudyLevel: [
      "YEAR", "PROV_NAME", "EDU_LEVEL", "RATIO_STUDY"
    ]
  },
  DB_3: {
    Job_Vacancy_Career: [
      "YEAR", "MONTH", "PROV_NAME", "DATA_TYPE", "CAREER_TYPE", "VACANCY_COUNT"
    ],
    Job_Vacancy_Industry: [
      "YEAR", "MONTH", "PROV_NAME", "DATA_TYPE", "INDUSTRY_TYPE", "VACANCY_COUNT"
    ],
    Job_Vacancy_EduLevel: [
      "YEAR", "MONTH", "PROV_NAME", "DATA_TYPE", "EDU_LEVEL", "VACANCY_COUNT"
    ],
    Vocational_Busi_MOU: [
      "YEAR", "PROV_NAME", "BUSINESS_TYPE", "BUSINESS_NAME", "COORDI"
    ]
  },
  DB_4: {
    ONET_Score: [
      "YEAR", "EDU_LEVEL", "TEST_LEVEL", "TEST_SUBJECT",
      "STUDENT_TEST_COUNT", "AVG_SCORE", "STUDENT_MOREHALFTEST_COUNT"
    ],
    NT_AVGScore: [
      "YEAR", "TEST_LEVEL", "TEST_SUBJECT", "STUDENT_TEST_COUNT", "AVG_SCORE"
    ],
    NT_LevelScore: [
      "YEAR", "TEST_LEVEL", "TEST_SUBJECT", "QUALITY_LEVEL",
      "STUDENT_TEST_COUNT", "AVG_SCORE"
    ],
    RT_Score: [
      "YEAR", "TEST_LEVEL", "TEST_SUBJECT",
      "STUDENT_TEST_COUNT", "AVG_SCORE", "STUDENT_MOREHALFTEST_COUNT"
    ],
    VNET_Score: [
      "YEAR", "TEST_LEVEL", "REGIONAL", "PROV_NAME", "TEST_SUBJECT",
      "PART_NAME", "STUDENT_COUNT", "FUll_SCORE", "AVG_SCORE", "SD_SCORE",
      "MED_SCORE", "MOD_SCORE", "MIN_SCORE", "MAX_SCORE"
    ],
    BNET_Score: [
      "YEAR", "TEST_LEVEL", "REGIONAL", "PROV_NAME", "TEST_SUBJECT",
      "STANDARD_NAME", "STUDENT_CNT", "FULL_SCORE", "AVG_SCORE", "SD_SCORE",
      "MED_SCORE", "MOD_SCORE", "MIN_SCORE", "MAX_SCORE"
    ],
    NNET_Score: [
      "YEAR", "PERIOD_NO", "TEST_LEVEL", "TEST_SUBJECT", "REGIONAL",
      "PROV_NAME", "STUDENT_CNT", "FULL_SCORE", "AVG_SCORE", "SD_SCORE",
      "MED_SCORE", "MOD_SCORE", "MIN_SCORE", "MAX_SCORE"
    ]
  }
};

const PUBLIC_READ_SHEETS = Object.keys(SCHEMA_DICT).reduce(function(result, dbKey) {
  result[dbKey] = Object.keys(SCHEMA_DICT[dbKey]);
  return result;
}, {});

const METRIC_COLUMNS = {
  School_Location: ["COORDI"],
  Student_Count: ["STUDENT_MALE", "STUDENT_FEMALE"],
  Teacher_Count: ["TEACHER_MALE", "TEACHER_FEMALE"],
  Population: ["POPU_COUNT"],
  Special_Needs: ["STUDENT_COUNT"],
  Out_of_School: ["OOSC_COUNT"],
  Dropout: ["DROPOUT_COUNT"],
  Get_a_Jobs: ["STUDENT_COUNT"],
  Study_YearAVG: ["STUDY_YEARAVG"],
  Ratio_StudyLevel: ["RATIO_STUDY"],
  Job_Vacancy_Career: ["VACANCY_COUNT"],
  Job_Vacancy_Industry: ["VACANCY_COUNT"],
  Job_Vacancy_EduLevel: ["VACANCY_COUNT"],
  Vocational_Busi_MOU: ["COORDI"],
  ONET_Score: ["STUDENT_TEST_COUNT", "AVG_SCORE", "STUDENT_MOREHALFTEST_COUNT"],
  NT_AVGScore: ["STUDENT_TEST_COUNT", "AVG_SCORE"],
  NT_LevelScore: ["STUDENT_TEST_COUNT", "AVG_SCORE"],
  RT_Score: ["STUDENT_TEST_COUNT", "AVG_SCORE", "STUDENT_MOREHALFTEST_COUNT"],
  VNET_Score: [
    "STUDENT_COUNT", "FUll_SCORE", "AVG_SCORE", "SD_SCORE",
    "MED_SCORE", "MOD_SCORE", "MIN_SCORE", "MAX_SCORE"
  ],
  BNET_Score: [
    "STUDENT_CNT", "FULL_SCORE", "AVG_SCORE", "SD_SCORE",
    "MED_SCORE", "MOD_SCORE", "MIN_SCORE", "MAX_SCORE"
  ],
  NNET_Score: [
    "STUDENT_CNT", "FULL_SCORE", "AVG_SCORE", "SD_SCORE",
    "MED_SCORE", "MOD_SCORE", "MIN_SCORE", "MAX_SCORE"
  ]
};

const KEY_COLUMNS = {
  School_Location: ["SCHOOL_CODE"],
  Student_Count: ["ACAD_YEAR", "SCHOOL_CODE", "EDU_LEVEL"],
  Teacher_Count: ["ACAD_YEAR", "SCHOOL_CODE"],
  Study_YearAVG: ["YEAR", "PROV_NAME"],
  Ratio_StudyLevel: ["YEAR", "PROV_NAME", "EDU_LEVEL"],
  ONET_Score: ["YEAR", "EDU_LEVEL", "TEST_LEVEL", "TEST_SUBJECT"],
  NT_AVGScore: ["YEAR", "TEST_LEVEL", "TEST_SUBJECT"],
  NT_LevelScore: ["YEAR", "TEST_LEVEL", "TEST_SUBJECT", "QUALITY_LEVEL"],
  RT_Score: ["YEAR", "TEST_LEVEL", "TEST_SUBJECT"],
  VNET_Score: ["YEAR", "TEST_LEVEL", "PROV_NAME", "TEST_SUBJECT", "PART_NAME"],
  BNET_Score: ["YEAR", "TEST_LEVEL", "PROV_NAME", "TEST_SUBJECT", "STANDARD_NAME"],
  NNET_Score: ["YEAR", "PERIOD_NO", "TEST_LEVEL", "PROV_NAME", "TEST_SUBJECT"]
};

const MAX_ROWS_PER_UPLOAD = 50000;
const MAX_PUBLIC_PAGE_SIZE = 10000;
const WRITE_CHUNK_SIZE = 5000;

function getAuthorizedFirebaseUser(idToken) {
  if (!idToken) return null;

  const properties = PropertiesService.getScriptProperties();
  const apiKey = properties.getProperty("FIREBASE_WEB_API_KEY");
  const allowedEmails = (properties.getProperty("ALLOWED_EDITOR_EMAILS") || "")
    .split(",")
    .map(function(email) { return email.trim().toLowerCase(); })
    .filter(Boolean);

  if (!apiKey || allowedEmails.length === 0) {
    throw new Error("ยังไม่ได้ตั้งค่า FIREBASE_WEB_API_KEY หรือ ALLOWED_EDITOR_EMAILS");
  }

  const response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + apiKey,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) return null;

  const result = JSON.parse(response.getContentText());
  const user = result.users && result.users[0];
  if (!user || !user.email || !user.emailVerified) return null;

  return allowedEmails.indexOf(user.email.trim().toLowerCase()) >= 0 ? user : null;
}

function doPost(e) {
  let lock = null;
  let hasLock = false;

  try {
    const payload = JSON.parse(e.postData.contents);
    const user = getAuthorizedFirebaseUser(payload.idToken);

    if (!user) {
      return responseJSON({
        success: false,
        message: "ไม่มีสิทธิ์อัปโหลดข้อมูล กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่"
      });
    }

    lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      return responseJSON({
        success: false,
        message: "มีผู้ใช้อื่นกำลังบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง"
      });
    }
    hasLock = true;

    const targetDbId = DB_MAP[payload.dbKey];
    if (!targetDbId) throw new Error("ไม่พบฐานข้อมูลเป้าหมาย: " + payload.dbKey);

    const spreadsheet = SpreadsheetApp.openById(targetDbId);
    const targetSheet = spreadsheet.getSheetByName(payload.sheetName);
    if (!targetSheet) throw new Error("ไม่พบ Sheet เป้าหมาย: " + payload.sheetName);

    validateUploadPayload(payload, targetSheet);

    const incomingRows = payload.data;
    const existingValues = targetSheet.getDataRange().getValues();

    if (existingValues.length <= 1) {
      writeRowsInChunks(targetSheet, 2, incomingRows);
      return responseJSON({
        success: true,
        message: "เพิ่มข้อมูลใหม่เรียบร้อย " + incomingRows.length + " รายการ"
      });
    }

    const headers = existingValues[0].map(function(value) {
      return String(value).trim().toLowerCase();
    });
    const metricNames = (METRIC_COLUMNS[payload.sheetName] || []).map(function(value) {
      return value.toLowerCase();
    });
    const configuredKeys = KEY_COLUMNS[payload.sheetName] || [];
    const keyIndices = configuredKeys.length
      ? configuredKeys.map(function(columnName) {
          const index = headers.indexOf(columnName.toLowerCase());
          if (index < 0) throw new Error("ไม่พบคอลัมน์ key: " + columnName);
          return index;
        })
      : headers.reduce(function(indices, header, index) {
          if (metricNames.indexOf(header) < 0) indices.push(index);
          return indices;
        }, []);

    function buildCompositeKey(row) {
      return keyIndices.map(function(index) {
        return String(row[index] !== undefined ? row[index] : "").trim().toLowerCase();
      }).join("||");
    }

    const finalRows = existingValues.slice(1);
    const existingRowMap = new Map();
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    finalRows.forEach(function(row, index) {
      existingRowMap.set(buildCompositeKey(row), index);
    });

    incomingRows.forEach(function(incomingRow) {
      const key = buildCompositeKey(incomingRow);
      if (!existingRowMap.has(key)) {
        existingRowMap.set(key, finalRows.length);
        finalRows.push(incomingRow);
        insertedCount++;
        return;
      }

      const rowIndex = existingRowMap.get(key);
      const currentRow = finalRows[rowIndex];
      const changed = incomingRow.some(function(value, columnIndex) {
        return String(currentRow[columnIndex]) !== String(value);
      });

      if (changed) {
        finalRows[rowIndex] = incomingRow;
        updatedCount++;
      } else {
        skippedCount++;
      }
    });

    writeRowsInChunks(targetSheet, 2, finalRows);

    return responseJSON({
      success: true,
      message:
        "เพิ่มใหม่ " + insertedCount + " รายการ, อัปเดต " + updatedCount +
        " รายการ, ข้ามข้อมูลเดิม " + skippedCount + " รายการ"
    });
  } catch (error) {
    return responseJSON({ success: false, message: "Server Error: " + error.message });
  } finally {
    if (hasLock && lock) lock.releaseLock();
  }
}

function doGet(e) {
  try {
    const dbKey = e.parameter.dbKey;
    const sheetName = e.parameter.sheetName;
    if (!dbKey || !sheetName) throw new Error("กรุณาระบุ dbKey และ sheetName");
    if (!isPublicReadableSheet(dbKey, sheetName)) {
      throw new Error("ไม่อนุญาตให้อ่านข้อมูลจากชีตนี้");
    }

    const expectedHeaders = SCHEMA_DICT[dbKey] && SCHEMA_DICT[dbKey][sheetName];
    const spreadsheet = SpreadsheetApp.openById(DB_MAP[dbKey]);
    const targetSheet = spreadsheet.getSheetByName(sheetName);
    if (!targetSheet) throw new Error("ไม่พบ Sheet: " + sheetName);

    assertSheetHeaders(targetSheet, expectedHeaders);

    const requestedLimit = Number(e.parameter.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_PUBLIC_PAGE_SIZE)
      : MAX_PUBLIC_PAGE_SIZE;
    const requestedOffset = Number(e.parameter.offset);
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(Math.floor(requestedOffset), 0)
      : 0;

    const totalRows = Math.max(targetSheet.getLastRow() - 1, 0);
    const rowsToRead = Math.max(Math.min(limit, totalRows - offset), 0);
    const values = rowsToRead > 0
      ? targetSheet.getRange(offset + 2, 1, rowsToRead, expectedHeaders.length).getValues()
      : [];

    const resultData = values.map(function(row) {
      const item = {};
      expectedHeaders.forEach(function(header, index) {
        item[header] = row[index];
      });
      return item;
    });

    return responseJSON({
      success: true,
      data: resultData,
      totalRows: totalRows,
      offset: offset,
      limit: limit,
      hasMore: offset + resultData.length < totalRows
    });
  } catch (error) {
    return responseJSON({ success: false, message: error.message });
  }
}

function validateUploadPayload(payload, targetSheet) {
  const expectedHeaders = SCHEMA_DICT[payload.dbKey] &&
    SCHEMA_DICT[payload.dbKey][payload.sheetName];

  if (!expectedHeaders) throw new Error("ไม่ได้รับอนุญาตให้อัปโหลดลงชีตนี้");
  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error("ไม่พบข้อมูลสำหรับอัปโหลด");
  }
  if (payload.data.length > MAX_ROWS_PER_UPLOAD) {
    throw new Error("อัปโหลดได้สูงสุด " + MAX_ROWS_PER_UPLOAD + " แถวต่อครั้ง");
  }

  assertSheetHeaders(targetSheet, expectedHeaders);

  payload.data.forEach(function(row, index) {
    if (!Array.isArray(row) || row.length !== expectedHeaders.length) {
      throw new Error(
        "ข้อมูลแถวที่ " + (index + 2) + " ต้องมี " +
        expectedHeaders.length + " คอลัมน์"
      );
    }
  });
}

function assertSheetHeaders(sheet, expectedHeaders) {
  if (!expectedHeaders) throw new Error("ไม่พบ schema ของชีตนี้");

  const actualHeaders = sheet
    .getRange(1, 1, 1, expectedHeaders.length)
    .getDisplayValues()[0]
    .map(function(value) { return String(value).trim(); });

  const headersMatch = expectedHeaders.every(function(header, index) {
    return header === actualHeaders[index];
  });

  if (!headersMatch || sheet.getLastColumn() !== expectedHeaders.length) {
    throw new Error(
      "หัวตารางของ Google Sheet ไม่ตรงกับ schema ของ " + sheet.getName() +
      " (ต้องตรงทั้งชื่อ ลำดับ และจำนวนคอลัมน์)"
    );
  }
}

function isPublicReadableSheet(dbKey, sheetName) {
  return Boolean(
    PUBLIC_READ_SHEETS[dbKey] &&
    PUBLIC_READ_SHEETS[dbKey].indexOf(sheetName) >= 0
  );
}

function writeRowsInChunks(sheet, startRow, rows) {
  if (!rows.length) return;
  const columnCount = rows[0].length;

  for (let offset = 0; offset < rows.length; offset += WRITE_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + WRITE_CHUNK_SIZE);
    sheet.getRange(startRow + offset, 1, chunk.length, columnCount).setValues(chunk);
  }
}

function responseJSON(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
