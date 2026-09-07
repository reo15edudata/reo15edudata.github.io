document.addEventListener("DOMContentLoaded", () => {
  const panels = [...document.querySelectorAll("[data-admin-panel]")];
  const navItems = [...document.querySelectorAll("[data-admin-view]")];
  const moderationState = {
    items: [],
    type: "BUSINESS",
    status: "PENDING",
    search: "",
    selected: new Set(),
    page: 1,
    pageSize: 20,
    loading: false
  };

  const STATUS_LABELS = {
    PENDING: "รอตรวจสอบ",
    APPROVED: "อนุมัติแล้ว",
    REVISION_REQUIRED: "ขอแก้ไข",
    REJECTED: "ไม่อนุมัติ"
  };
  const STATUS_CLASSES = {
    PENDING: "pending",
    APPROVED: "approved",
    REVISION_REQUIRED: "revision",
    REJECTED: "rejected"
  };
  const DETAIL_LABELS = {
    YEAR: "ปีที่ส่งข้อมูล",
    PROV_NAME: "จังหวัด",
    BUSINESS_TYPE: "ประเภทสถานประกอบการ",
    BUSINESS_NAME: "ชื่อสถานประกอบการ",
    BUSINESS_CODE: "รหัสสถานประกอบการ",
    COORDI: "พิกัด",
    BUSINESS_DETAILS: "รายละเอียดสถานประกอบการและงานที่เปิดรับ",
    BUSINESS_PAY: "ค่าตอบแทน (บาท/ชั่วโมง)",
    BUSINESS_WANTS: "ทักษะที่ต้องการ",
    BUSINESS_CONTACT: "ช่องทางติดต่อ",
    STUDENT_CODE: "รหัสโปรไฟล์ผู้เรียน",
    STUDENT_NAME: "ชื่อผู้เรียน",
    GENDER: "เพศ",
    SCHOOL_NAME: "สถานศึกษา",
    EDU_LEVEL: "ระดับการศึกษา",
    DESCRIPTION_STUDENT: "ข้อมูลแนะนำตัว",
    TOP_SKILLS: "ทักษะเด่น",
    LOOKING_WORK: "งานที่สนใจ",
    AVAILABLE_TIME: "ช่วงเวลาที่สะดวก",
    PORTFOLIO_LINK: "ผลงาน",
    STUDENT_CONTRACT: "ช่องทางติดต่อ",
    SUBMITED_TIME: "เวลาที่ส่งข้อมูล",
    DATA_STATUS: "สถานะข้อมูล"
  };

  function openView(view) {
    panels.forEach(panel => { panel.hidden = panel.dataset.adminPanel !== view; });
    navItems.forEach(item => {
      const active = item.dataset.adminView === view;
      item.classList.toggle("bg-slate-800", active);
      item.classList.toggle("text-teal-400", active);
    });
    if (view === "moderation" && !moderationState.items.length && !moderationState.loading) {
      loadModerationQueue();
    }
  }

  navItems.forEach(item => item.addEventListener("click", () => openView(item.dataset.adminView)));
  document.querySelectorAll("[data-open-view]").forEach(item => item.addEventListener("click", () => openView(item.dataset.openView)));

  document.getElementById("excelFile").addEventListener("change", event => {
    document.getElementById("selectedFileName").textContent =
      event.target.files[0]?.name || "ยังไม่ได้เลือกไฟล์";
  });

  document.getElementById("downloadTemplateBtn").addEventListener("click", async event => {
    const selected = document.getElementById("dataType").value;
    const message = document.getElementById("statusMsg");
    if (!selected) {
      message.className = "status-msg rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700";
      message.textContent = "กรุณาเลือกประเภทข้อมูลก่อนดาวน์โหลด template";
      return;
    }

    const [dbKey, sheetName] = selected.split("|");
    const headers = window.EDU15_SCHEMAS?.[dbKey]?.[sheetName];
    if (!headers) {
      message.className = "status-msg rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700";
      message.textContent = "ไม่พบ schema สำหรับประเภทข้อมูลนี้";
      return;
    }

    const button = event.currentTarget;
    button.disabled = true;
    message.className = "status-msg rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700";
    message.textContent = "กำลังเตรียมเครื่องมือสร้างไฟล์ Excel…";
    try {
      await window.EDU15Libraries.loadXlsx();
    } catch (error) {
      console.error(error);
      message.className = "status-msg rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700";
      message.textContent = "โหลดเครื่องมือ Excel ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
      button.disabled = false;
      return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    worksheet["!cols"] = headers.map(header => ({
      wch: Math.max(14, Math.min(32, header.length + 4))
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName}_template.xlsx`);

    message.className = "status-msg rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700";
    message.textContent = `ดาวน์โหลด ${sheetName}_template.xlsx แล้ว`;
    button.disabled = false;
  });

  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.replace("login.html?next=admin.html&ui=20260903-3");
      return;
    }

    document.getElementById("adminLoading").hidden = true;
    document.getElementById("accountEmail").textContent = user.email;
    document.getElementById("accountVerification").innerHTML = user.emailVerified
      ? '<span class="text-emerald-600"><i class="fas fa-circle-check mr-1"></i>ยืนยันอีเมลแล้ว</span>'
      : '<span class="text-amber-600"><i class="fas fa-triangle-exclamation mr-1"></i>ยังไม่ได้ยืนยันอีเมล</span>';
    loadModerationQueue();
  });

  document.getElementById("resetPasswordBtn").addEventListener("click", async () => {
    const user = firebase.auth().currentUser;
    const message = document.getElementById("accountMessage");
    if (!user?.email) return;
    try {
      await firebase.auth().sendPasswordResetEmail(user.email);
      message.className = "mx-6 mb-6 text-sm text-emerald-600";
      message.textContent = "ส่งลิงก์เปลี่ยนรหัสผ่านไปยังอีเมลแล้ว";
    } catch (error) {
      message.className = "mx-6 mb-6 text-sm text-rose-600";
      message.textContent = "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่";
      console.error(error);
    }
  });

  document.getElementById("accountSignOutBtn").addEventListener("click", () => {
    firebase.auth().signOut().then(() => window.location.replace("dashboard.html"));
  });

  document.getElementById("refreshModerationBtn")?.addEventListener("click", loadModerationQueue);
  document.querySelectorAll("[data-moderation-type]").forEach(button => {
    button.addEventListener("click", () => {
      moderationState.type = button.dataset.moderationType;
      moderationState.page = 1;
      moderationState.selected.clear();
      document.querySelectorAll("[data-moderation-type]").forEach(item => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      renderModeration();
    });
  });
  document.getElementById("moderationStatusFilter")?.addEventListener("change", event => {
    moderationState.status = event.target.value;
    moderationState.page = 1;
    moderationState.selected.clear();
    renderModeration();
  });
  document.getElementById("moderationSearch")?.addEventListener("input", event => {
    moderationState.search = event.target.value.trim().toLocaleLowerCase("th");
    moderationState.page = 1;
    renderModeration();
  });
  document.getElementById("moderationSelectAll")?.addEventListener("change", event => {
    visibleModerationPage().forEach(item => {
      if (event.target.checked) moderationState.selected.add(item.code);
      else moderationState.selected.delete(item.code);
    });
    renderModeration();
  });
  document.querySelectorAll("[data-review-decision]").forEach(button => {
    button.addEventListener("click", () => submitModerationDecision(button.dataset.reviewDecision));
  });
  document.getElementById("moderationPrevPage")?.addEventListener("click", () => {
    moderationState.page = Math.max(1, moderationState.page - 1);
    renderModeration();
  });
  document.getElementById("moderationNextPage")?.addEventListener("click", () => {
    const pages = Math.max(1, Math.ceil(filteredModerationItems().length / moderationState.pageSize));
    moderationState.page = Math.min(pages, moderationState.page + 1);
    renderModeration();
  });

  const detailDialog = document.getElementById("moderationDetailDialog");
  document.getElementById("closeModerationDetail")?.addEventListener("click", () => detailDialog.close());
  detailDialog?.addEventListener("click", event => {
    if (event.target === detailDialog) detailDialog.close();
  });

  async function adminApi(payload) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    const idToken = await user.getIdToken();
    const endpoint = window.EDU15_GAS_WEB_APP_URL;
    if (!endpoint) throw new Error("ไม่พบ URL สำหรับเชื่อมต่อระบบหลังบ้าน");
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ ...payload, idToken })
    });
    if (!response.ok) throw new Error(`ระบบหลังบ้านตอบกลับ HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "ดำเนินการไม่สำเร็จ");
    return result;
  }

  async function loadModerationQueue() {
    if (moderationState.loading || !firebase.auth().currentUser) return;
    moderationState.loading = true;
    setModerationMessage("loading", "กำลังโหลดรายการตรวจสอบ…");
    document.getElementById("refreshModerationBtn").disabled = true;
    try {
      const result = await adminApi({ action: "getModerationQueue" });
      moderationState.items = Array.isArray(result.data) ? result.data : [];
      moderationState.selected.clear();
      moderationState.page = 1;
      updateModerationCounts(result.counts || {});
      setModerationMessage("", "");
      renderModeration();
    } catch (error) {
      console.error(error);
      setModerationMessage("error", `${error.message} กรุณาตรวจสอบ Apps Script Deployment แล้วลองใหม่`);
      renderModeration();
    } finally {
      moderationState.loading = false;
      document.getElementById("refreshModerationBtn").disabled = false;
    }
  }

  function updateModerationCounts(counts) {
    setText("pendingCount", counts.PENDING ?? 0);
    setText("approvedCount", counts.APPROVED ?? 0);
    setText("revisionCount", counts.REVISION_REQUIRED ?? 0);
    setText("rejectedCount", counts.REJECTED ?? 0);
    const businessPending = counts.byType?.BUSINESS?.PENDING ?? 0;
    const studentPending = counts.byType?.STUDENT?.PENDING ?? 0;
    setText("businessPendingCount", businessPending);
    setText("studentPendingCount", studentPending);
    setText("overviewPendingCount", counts.PENDING ?? 0);
    const navCount = document.getElementById("moderationNavCount");
    navCount.textContent = String(counts.PENDING ?? 0);
    navCount.hidden = !(counts.PENDING > 0);
  }

  function filteredModerationItems() {
    return moderationState.items.filter(item => {
      if (item.type !== moderationState.type) return false;
      if (moderationState.status !== "ALL" && item.status !== moderationState.status) return false;
      if (!moderationState.search) return true;
      const dataText = Object.values(item.data || {}).join(" ");
      return `${item.code} ${item.email} ${dataText}`.toLocaleLowerCase("th").includes(moderationState.search);
    });
  }

  function visibleModerationPage() {
    const filtered = filteredModerationItems();
    const start = (moderationState.page - 1) * moderationState.pageSize;
    return filtered.slice(start, start + moderationState.pageSize);
  }

  function renderModeration() {
    const tbody = document.getElementById("moderationTableBody");
    if (!tbody) return;
    tbody.replaceChildren();
    const filtered = filteredModerationItems();
    const pages = Math.max(1, Math.ceil(filtered.length / moderationState.pageSize));
    moderationState.page = Math.min(moderationState.page, pages);
    const pageItems = visibleModerationPage();

    pageItems.forEach(item => {
      const row = document.createElement("tr");
      const checkCell = document.createElement("td");
      checkCell.className = "check-column";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = moderationState.selected.has(item.code);
      checkbox.setAttribute("aria-label", `เลือกรายการ ${item.code}`);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) moderationState.selected.add(item.code);
        else moderationState.selected.delete(item.code);
        updateModerationSelection(pageItems);
      });
      checkCell.append(checkbox);
      row.append(checkCell);
      row.append(createCell(item.code, "moderation-code"));

      const summaryCell = document.createElement("td");
      const primary = document.createElement("span");
      primary.className = "moderation-primary";
      primary.textContent = item.type === "BUSINESS"
        ? item.data?.BUSINESS_NAME || "ไม่ระบุชื่อสถานประกอบการ"
        : item.data?.STUDENT_NAME || "ไม่ระบุชื่อผู้เรียน";
      const secondary = document.createElement("span");
      secondary.className = "moderation-secondary";
      secondary.textContent = item.type === "BUSINESS"
        ? [item.data?.BUSINESS_TYPE, item.data?.PROV_NAME].filter(Boolean).join(" · ") || "ไม่มีรายละเอียดเพิ่มเติม"
        : [item.data?.SCHOOL_NAME, item.data?.LOOKING_WORK].filter(Boolean).join(" · ") || "ไม่มีรายละเอียดเพิ่มเติม";
      summaryCell.append(primary, secondary);
      row.append(summaryCell);
      row.append(createCell(item.email || "—"));
      row.append(createCell(formatThaiDate(item.submittedTime)));

      const statusCell = document.createElement("td");
      statusCell.append(createStatusChip(item.status));
      row.append(statusCell);
      const actionCell = document.createElement("td");
      const detailButton = document.createElement("button");
      detailButton.type = "button";
      detailButton.className = "moderation-detail-button";
      detailButton.textContent = "ดูรายละเอียด";
      detailButton.addEventListener("click", () => openModerationDetail(item));
      actionCell.append(detailButton);
      row.append(actionCell);
      tbody.append(row);
    });

    document.getElementById("moderationEmpty").hidden = pageItems.length > 0 || moderationState.loading;
    document.getElementById("moderationPageSummary").textContent = `${filtered.length.toLocaleString("th-TH")} รายการ`;
    document.getElementById("moderationPageNumber").textContent = `หน้า ${moderationState.page} / ${pages}`;
    document.getElementById("moderationPrevPage").disabled = moderationState.page <= 1;
    document.getElementById("moderationNextPage").disabled = moderationState.page >= pages;
    updateModerationSelection(pageItems);
  }

  function updateModerationSelection(pageItems = visibleModerationPage()) {
    const selectedCount = moderationState.selected.size;
    setText("moderationSelectedCount", `เลือก ${selectedCount.toLocaleString("th-TH")} รายการ`);
    document.getElementById("moderationBulkBar").hidden = selectedCount === 0;
    const selectAll = document.getElementById("moderationSelectAll");
    const selectedOnPage = pageItems.filter(item => moderationState.selected.has(item.code)).length;
    selectAll.checked = pageItems.length > 0 && selectedOnPage === pageItems.length;
    selectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < pageItems.length;
  }

  async function submitModerationDecision(decision) {
    const codes = [...moderationState.selected];
    const note = document.getElementById("moderationReviewNote").value.trim();
    if (!codes.length) return;
    if (decision !== "APPROVED" && !note) {
      setModerationMessage("error", "กรุณาระบุเหตุผลหรือสิ่งที่ต้องแก้ไขก่อนดำเนินการ");
      document.getElementById("moderationReviewNote").focus();
      return;
    }
    document.querySelectorAll("[data-review-decision]").forEach(button => { button.disabled = true; });
    setModerationMessage("loading", `กำลังอัปเดต ${codes.length.toLocaleString("th-TH")} รายการ…`);
    try {
      const result = await adminApi({ action: "reviewSubmissions", codes, decision, reviewNote: note });
      document.getElementById("moderationReviewNote").value = "";
      setModerationMessage("success", result.message);
      await loadModerationQueue();
    } catch (error) {
      console.error(error);
      setModerationMessage("error", error.message);
    } finally {
      document.querySelectorAll("[data-review-decision]").forEach(button => { button.disabled = false; });
    }
  }

  function openModerationDetail(item) {
    setText("moderationDetailType", item.typeLabel || "รายละเอียดรายการ");
    setText("moderationDetailTitle", item.code);
    const meta = document.getElementById("moderationDetailMeta");
    meta.replaceChildren(
      createInlineMeta("ผู้ส่ง", item.email || "—"),
      createInlineMeta("วันที่ส่ง", formatThaiDate(item.submittedTime)),
      createStatusChip(item.status)
    );
    const fields = document.getElementById("moderationDetailFields");
    fields.replaceChildren();
    Object.entries(item.data || {}).forEach(([key, value]) => {
      if (key === "DATA_STATUS") return;
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = DETAIL_LABELS[key] || key;
      const description = document.createElement("dd");
      description.textContent = value === "" || value === null || value === undefined ? "ไม่ได้ระบุ" : String(value);
      wrapper.append(term, description);
      fields.append(wrapper);
    });
    const review = document.getElementById("moderationDetailReview");
    if (item.reviewNote) {
      review.hidden = false;
      review.textContent = `หมายเหตุจากผู้ตรวจสอบ: ${item.reviewNote}`;
    } else {
      review.hidden = true;
      review.textContent = "";
    }
    detailDialog.showModal();
  }

  function createCell(value, className = "") {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = value === "" || value === null || value === undefined ? "—" : String(value);
    return cell;
  }

  function createStatusChip(status) {
    const chip = document.createElement("span");
    chip.className = `moderation-status-chip ${STATUS_CLASSES[status] || "pending"}`;
    chip.textContent = STATUS_LABELS[status] || status || STATUS_LABELS.PENDING;
    return chip;
  }

  function createInlineMeta(label, value) {
    const span = document.createElement("span");
    span.textContent = `${label}: ${value}`;
    return span;
  }

  function formatThaiDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok"
    }).format(date);
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  }

  function setModerationMessage(type, message) {
    const element = document.getElementById("moderationStatus");
    if (!element) return;
    element.className = `moderation-message${type ? ` is-${type}` : ""}`;
    element.textContent = message;
    element.hidden = !message;
    if (type === "loading") {
      const icon = document.createElement("i");
      icon.className = "fas fa-spinner fa-spin mr-2";
      element.prepend(icon);
    }
  }
});
