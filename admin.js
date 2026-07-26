document.addEventListener("DOMContentLoaded", () => {
  const panels = [...document.querySelectorAll("[data-admin-panel]")];
  const navItems = [...document.querySelectorAll("[data-admin-view]")];

  function openView(view) {
    panels.forEach(panel => { panel.hidden = panel.dataset.adminPanel !== view; });
    navItems.forEach(item => {
      const active = item.dataset.adminView === view;
      item.classList.toggle("bg-slate-800", active);
      item.classList.toggle("text-teal-400", active);
      item.classList.toggle("border-l-2", active);
      item.classList.toggle("border-teal-500", active);
    });
  }

  navItems.forEach(item => item.addEventListener("click", () => openView(item.dataset.adminView)));
  document.querySelectorAll("[data-open-view]").forEach(item => item.addEventListener("click", () => openView(item.dataset.openView)));

  document.getElementById("excelFile").addEventListener("change", event => {
    document.getElementById("selectedFileName").textContent =
      event.target.files[0]?.name || "ยังไม่ได้เลือกไฟล์";
  });

  document.getElementById("downloadTemplateBtn").addEventListener("click", () => {
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

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    worksheet["!cols"] = headers.map(header => ({
      wch: Math.max(14, Math.min(32, header.length + 4))
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName}_template.xlsx`);

    message.className = "status-msg rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700";
    message.textContent = `ดาวน์โหลด ${sheetName}_template.xlsx แล้ว`;
  });

  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    document.getElementById("adminLoading").hidden = true;
    document.getElementById("accountEmail").textContent = user.email;
    document.getElementById("accountVerification").innerHTML = user.emailVerified
      ? '<span class="text-emerald-600"><i class="fas fa-circle-check mr-1"></i>ยืนยันอีเมลแล้ว</span>'
      : '<span class="text-amber-600"><i class="fas fa-triangle-exclamation mr-1"></i>ยังไม่ได้ยืนยันอีเมล</span>';
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
});
