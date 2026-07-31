/* Shared public-site behavior: authentication-aware navigation and sidebar. */
const EDU15_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA7nJ6pBdnECqseBnCi49YRbUbLtcE5dx4",
  authDomain: "edudata-reo15.firebaseapp.com",
  projectId: "edudata-reo15",
  storageBucket: "edudata-reo15.firebasestorage.app",
  messagingSenderId: "297919410636",
  appId: "1:297919410636:web:e1bccc1885ee7e68766d69"
};

function configureChartDataLabels() {
  if (typeof Chart === "undefined" || typeof ChartDataLabels === "undefined") return;
  Chart.register(ChartDataLabels);
  Chart.defaults.layout.padding = { top: 20, right: 24, bottom: 4, left: 4 };
  Chart.defaults.plugins.datalabels = {
    display: context => {
      const value = context.dataset.data?.[context.dataIndex];
      return value !== null && value !== undefined && value !== "";
    },
    formatter: value => {
      const number = Number(value);
      if (!Number.isFinite(number)) return "";
      return number.toLocaleString("th-TH", {
        minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
        maximumFractionDigits: 2
      });
    },
    anchor: context => ["doughnut", "pie", "polarArea"].includes(context.chart.config.type) ? "center" : "end",
    align: context => {
      if (["doughnut", "pie", "polarArea"].includes(context.chart.config.type)) return "center";
      return context.chart.options.indexAxis === "y" ? "right" : "top";
    },
    color: context => ["doughnut", "pie", "polarArea"].includes(context.chart.config.type) ? "#ffffff" : "#475569",
    backgroundColor: context => ["doughnut", "pie", "polarArea"].includes(context.chart.config.type) ? "rgba(15,23,42,.68)" : null,
    borderRadius: 4,
    padding: context => ["doughnut", "pie", "polarArea"].includes(context.chart.config.type) ? 3 : 1,
    clamp: true,
    clip: false,
    font: { size: 10, weight: "600" }
  };
}

function installSharedStyles() {
  const style = document.createElement("style");
  style.textContent = `
    [data-sidebar] { transition: width .2s ease; }
    [data-sidebar].sidebar-collapsed { width: 4.5rem !important; }
    [data-sidebar].sidebar-collapsed .sidebar-brand-text,
    [data-sidebar].sidebar-collapsed .sidebar-section,
    [data-sidebar].sidebar-collapsed .sidebar-link-text { display: none; }
    [data-sidebar].sidebar-collapsed a,
    [data-sidebar].sidebar-collapsed .admin-nav { justify-content: center; padding-left: .75rem; padding-right: .75rem; }
    .edu15-loader { position: fixed; inset: 0; z-index: 2000; isolation: isolate; display: flex; align-items: center; justify-content: center; background: rgba(248,250,252,.82); backdrop-filter: blur(2px); }
    .edu15-loader[hidden] { display: none; }
    .edu15-progress-track { width: 18rem; height: .55rem; overflow: hidden; border-radius: 999px; background: #e2e8f0; }
    .edu15-progress-bar { height: 100%; width: 4%; border-radius: inherit; background: linear-gradient(90deg,#14b8a6,#0ea5e9); transition: width .25s ease; }
    .edu15-loader-activity { display: flex; align-items: center; justify-content: center; gap: .45rem; margin-top: .65rem; color: #64748b; font-size: .7rem; }
    .edu15-loader-spinner { width: .8rem; height: .8rem; flex: 0 0 auto; border: 2px solid #cbd5e1; border-top-color: #0d9488; border-radius: 999px; animation: edu15-loader-spin .8s linear infinite; }
    @keyframes edu15-loader-spin { to { transform: rotate(360deg); } }
    @keyframes edu15-loader-pulse { 50% { opacity: .35; } }
    @media (prefers-reduced-motion: reduce) { .edu15-loader-spinner { animation: edu15-loader-pulse 1.6s ease-in-out infinite; } }
    .edu15-background-status { margin-top: auto; flex-shrink: 0; border-top: 1px solid rgba(148,163,184,.2); padding: .85rem .75rem; color: #cbd5e1; }
    .edu15-background-status[hidden] { display: none; }
    .edu15-background-status-label { display: flex; align-items: center; gap: .5rem; font-size: .72rem; line-height: 1.25; }
    .edu15-background-status-track { height: .3rem; margin-top: .55rem; overflow: hidden; border-radius: 999px; background: rgba(148,163,184,.24); }
    .edu15-background-status-bar { height: 100%; width: 0; border-radius: inherit; background: linear-gradient(90deg,#2dd4bf,#38bdf8); transition: width .25s ease; }
    .edu15-background-status.is-error { border-top-color: rgba(251,113,133,.45); background: rgba(127,29,29,.22); }
    .edu15-background-status.is-error .edu15-background-status-bar { background: #fb7185; }
    .edu15-background-reload { width: 100%; margin-top: .65rem; border: 1px solid rgba(253,164,175,.45); border-radius: .5rem; background: rgba(159,18,57,.28); padding: .45rem .6rem; color: #ffe4e6; font-size: .72rem; font-weight: 600; }
    .edu15-background-reload:hover { background: rgba(159,18,57,.5); }
    [data-sidebar].sidebar-collapsed .edu15-background-status { padding: .75rem .5rem; }
    [data-sidebar].sidebar-collapsed .edu15-background-status-copy,
    [data-sidebar].sidebar-collapsed .edu15-background-status-track,
    [data-sidebar].sidebar-collapsed .edu15-background-reload { display: none; }
    [data-sidebar].sidebar-collapsed .edu15-background-status-label { justify-content: center; }
    .edu15-workforce-toggle { width: 100%; }
    .edu15-workforce-submenu { margin: .3rem 0 .4rem 1.7rem; padding-left: .6rem; border-left: 1px solid rgba(148,163,184,.25); }
    .edu15-workforce-submenu a { display: block; border-radius: .4rem; padding: .45rem .55rem; color: #94a3b8; font-size: .75rem; line-height: 1.25; }
    .edu15-workforce-submenu a:hover,
    .edu15-workforce-submenu a.is-active { background: #334155; color: #5eead4; }
    [data-sidebar].sidebar-collapsed .edu15-workforce-submenu { display: none; }
    [data-sidebar].sidebar-collapsed [data-workforce-chevron] { display: none; }
    .edu15-multi { position: relative; }
    .edu15-multi-button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: .75rem; border: 1px solid #cbd5e1; border-radius: .5rem; background: #f8fafc; padding: .625rem .75rem; text-align: left; }
    .edu15-multi-panel { position: absolute; z-index: 60; top: calc(100% + .35rem); left: 0; right: 0; max-height: 17rem; overflow: auto; border: 1px solid #cbd5e1; border-radius: .65rem; background: white; padding: .45rem; box-shadow: 0 12px 30px rgba(15,23,42,.16); }
    .edu15-multi-panel[hidden] { display: none; }
    .edu15-multi-option { display: flex; align-items: flex-start; gap: .55rem; padding: .45rem .55rem; border-radius: .4rem; font-size: .875rem; cursor: pointer; }
    .edu15-multi-option:hover { background: #f1f5f9; }
    .edu15-multi-option input { margin-top: .2rem; accent-color: #0d9488; }
  `;
  document.head.appendChild(style);
}

function setupSidebar() {
  const sidebar = document.querySelector("aside");
  if (!sidebar) return;
  sidebar.dataset.sidebar = "true";
  sidebar.id = sidebar.id || "siteSidebar";
  sidebar.nextElementSibling?.classList.add("edu15-shell-content");

  const backdrop = document.createElement("div");
  backdrop.className = "edu15-sidebar-backdrop";
  backdrop.hidden = true;
  document.body.appendChild(backdrop);

  const firstDashboardLink = sidebar.querySelector('a[href="dashboard.html"]');
  if (firstDashboardLink && !sidebar.querySelector('a[href="index.html"]')) {
    const item = document.createElement("li");
    const isActive = /(?:^|\/)index\.html$/.test(location.pathname) || location.pathname.endsWith("/");
    item.innerHTML = `<a href="index.html" class="flex items-center px-3 py-2 rounded-md ${isActive ? "text-teal-400 bg-slate-800 border-l-2 border-teal-500" : "hover:bg-slate-800 hover:text-white"}"><i class="fas fa-house w-7"></i>หน้าแรก</a>`;
    firstDashboardLink.closest("li")?.before(item);
  }

  const workforceLink = sidebar.querySelector('a[href="dashboard-workforce.html"]');
  if (workforceLink && !sidebar.querySelector('a[href="dashboard-score.html"]')) {
    const item = document.createElement("li");
    const isActive = location.pathname.endsWith("/dashboard-score.html");
    item.innerHTML = `<a href="dashboard-score.html" class="flex items-center px-3 py-2 rounded-md ${isActive ? "text-teal-400 bg-slate-800 border-l-2 border-teal-500" : "hover:bg-slate-800 hover:text-white"}"><i class="fas fa-square-poll-vertical w-7"></i>ผลการทดสอบทางการศึกษา</a>`;
    workforceLink.closest("li")?.after(item);
  }
  setupWorkforceNavigation(sidebar);

  sidebar.querySelectorAll("a, button.admin-nav").forEach(link => {
    const icon = link.querySelector("i");
    if (!icon) return;
    const text = link.textContent.trim();
    link.title = text;
    const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim()) textNodes.push(walker.currentNode);
    }
    textNodes.forEach(node => {
      const span = document.createElement("span");
      span.className = "sidebar-link-text";
      span.textContent = node.textContent;
      node.replaceWith(span);
    });
  });

  sidebar.querySelectorAll("div").forEach(element => {
    if (/DASHBOARDS|MANAGEMENT|ADMIN CONSOLE/.test(element.textContent.trim()) && !element.querySelector("a")) {
      element.classList.add("sidebar-section");
    }
  });

  const brand = sidebar.querySelector("span");
  if (brand) brand.classList.add("sidebar-brand-text");

  const brandRow = sidebar.firstElementChild;
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "mobile-menu-close";
  closeButton.setAttribute("aria-label", "ปิดเมนู");
  closeButton.innerHTML = '<i class="fas fa-xmark" aria-hidden="true"></i>';
  brandRow?.appendChild(closeButton);

  const toggle = document.querySelector("header button");
  if (toggle) {
    toggle.type = "button";
    toggle.setAttribute("aria-label", "เปิดหรือปิดเมนู");
    toggle.setAttribute("aria-controls", sidebar.id);
  }

  const mobileQuery = window.matchMedia("(max-width: 767px)");
  const setMobileOpen = (open, returnFocus = false) => {
    if (!mobileQuery.matches) open = false;
    sidebar.classList.toggle("sidebar-mobile-open", open);
    backdrop.classList.toggle("is-visible", open);
    backdrop.hidden = !open;
    document.body.classList.toggle("sidebar-mobile-active", open);
    toggle?.setAttribute("aria-expanded", String(open));
    sidebar.toggleAttribute("inert", mobileQuery.matches && !open);
    if (mobileQuery.matches) sidebar.setAttribute("aria-hidden", String(!open));
    else sidebar.removeAttribute("aria-hidden");
    if (open) closeButton.focus();
    else if (returnFocus) toggle?.focus();
  };

  const syncResponsiveSidebar = () => {
    sidebar.classList.remove("sidebar-mobile-open");
    backdrop.classList.remove("is-visible");
    backdrop.hidden = true;
    document.body.classList.remove("sidebar-mobile-active");
    if (mobileQuery.matches) {
      sidebar.classList.remove("sidebar-collapsed");
      sidebar.setAttribute("aria-hidden", "true");
      sidebar.setAttribute("inert", "");
      toggle?.setAttribute("aria-expanded", "false");
    } else {
      sidebar.removeAttribute("aria-hidden");
      sidebar.removeAttribute("inert");
      toggle?.removeAttribute("aria-expanded");
    }
  };

  toggle?.addEventListener("click", () => {
    if (mobileQuery.matches) {
      setMobileOpen(!sidebar.classList.contains("sidebar-mobile-open"));
    } else {
      sidebar.classList.toggle("sidebar-collapsed");
    }
  });
  closeButton.addEventListener("click", () => setMobileOpen(false, true));
  backdrop.addEventListener("click", () => setMobileOpen(false, true));
  sidebar.querySelectorAll("a, button.admin-nav").forEach(item => {
    item.addEventListener("click", () => {
      if (mobileQuery.matches) setMobileOpen(false);
    });
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && sidebar.classList.contains("sidebar-mobile-open")) {
      setMobileOpen(false, true);
    }
  });
  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncResponsiveSidebar);
  } else {
    mobileQuery.addListener(syncResponsiveSidebar);
  }
  syncResponsiveSidebar();
}

function setupWorkforceNavigation(sidebar) {
  const workforceLink = sidebar.querySelector('a[href="dashboard-workforce.html"]');
  if (!workforceLink) return;
  const item = workforceLink.closest("li");
  if (!item) return;
  const currentPage = location.pathname.split("/").pop() || "index.html";
  const pages = [
    ["dashboard-workforce.html", "ภาพรวมความต้องการกำลังคน"],
    ["dashboard-business.html", "สถานประกอบการที่ร่วมจัดการอาชีวศึกษา"],
    ["dashboard-workforce-profile.html", "โปรไฟล์ผู้สนใจฝึกประสบการณ์"]
  ];
  const active = pages.some(([href]) => href === currentPage);
  item.innerHTML = `
    <button type="button" class="edu15-workforce-toggle flex items-center px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white ${active ? "text-teal-400 bg-slate-800 border-l-2 border-teal-500" : ""}" aria-expanded="${active}" aria-controls="workforceSubmenu">
      <i class="fas fa-users-gear w-7"></i>
      <span class="sidebar-link-text flex-1 text-left">ความต้องการกำลังคน</span>
      <i class="fas fa-chevron-down text-[10px] transition-transform ${active ? "rotate-180" : ""}" data-workforce-chevron></i>
    </button>
    <ul id="workforceSubmenu" class="edu15-workforce-submenu" ${active ? "" : "hidden"}>
      ${pages.map(([href, label]) => `<li><a href="${href}" class="${href === currentPage ? "is-active" : ""}">${label}</a></li>`).join("")}
    </ul>
  `;
  const toggle = item.querySelector(".edu15-workforce-toggle");
  const submenu = item.querySelector(".edu15-workforce-submenu");
  const chevron = item.querySelector("[data-workforce-chevron]");
  toggle.addEventListener("click", event => {
    event.stopPropagation();
    submenu.hidden = !submenu.hidden;
    toggle.setAttribute("aria-expanded", String(!submenu.hidden));
    chevron.classList.toggle("rotate-180", !submenu.hidden);
  });
}

function installLoader() {
  const progressItems = new Map();
  let loaderVersion = 0;
  let backgroundVersion = 0;
  let activityTimer = null;
  let loaderStartedAt = 0;
  const loader = document.createElement("div");
  loader.id = "pageLoader";
  loader.className = "edu15-loader";
  loader.hidden = true;
  loader.innerHTML = '<div class="rounded-xl bg-white border border-slate-200 shadow-lg px-7 py-6 text-center"><i class="fas fa-chart-line text-teal-500 text-2xl"></i><p id="pageLoaderText" class="mt-3 mb-3 text-sm font-medium text-slate-600">กำลังเตรียมข้อมูลสำหรับแสดงผล</p><div class="edu15-progress-track" role="progressbar" aria-label="ความคืบหน้าการโหลดข้อมูล" aria-valuemin="0" aria-valuemax="100"><div id="pageLoaderBar" class="edu15-progress-bar"></div></div><p id="pageLoaderPercent" class="mt-2 text-xs text-slate-400">0%</p><div class="edu15-loader-activity"><span class="edu15-loader-spinner" aria-hidden="true"></span><span id="pageLoaderActivity">ระบบกำลังติดต่อแหล่งข้อมูล</span></div></div>';
  document.body.appendChild(loader);

  const updateProgress = percent => {
    const safe = Math.min(100, Math.max(0, Math.round(percent || 0)));
    loader.dataset.progress = String(safe);
    document.getElementById("pageLoaderBar").style.width = `${Math.max(4, safe)}%`;
    document.getElementById("pageLoaderPercent").textContent = `${safe}%`;
    loader.querySelector('[role="progressbar"]').setAttribute("aria-valuenow", String(safe));
  };

  window.waitForDashboardPaint = () => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.showPageLoader = (message = "กำลังเตรียมข้อมูลสำหรับแสดงผล", percent = 0) => {
    loaderVersion++;
    progressItems.clear();
    if (activityTimer) clearInterval(activityTimer);
    loaderStartedAt = Date.now();
    const updateActivity = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - loaderStartedAt) / 1000));
      document.getElementById("pageLoaderActivity").textContent = seconds
        ? `ระบบยังคงดึงและประมวลผลข้อมูล · ${seconds} วินาที`
        : "ระบบกำลังติดต่อแหล่งข้อมูล";
    };
    updateActivity();
    activityTimer = setInterval(updateActivity, 1000);
    document.getElementById("pageLoaderText").textContent = message;
    updateProgress(Math.max(4, percent));
    loader.hidden = false;
  };
  window.reportPageProgress = (key, loaded, total) => {
    progressItems.set(key, total > 0 ? Math.min(1, loaded / total) : 0);
    const values = [...progressItems.values()];
    const measuredPercent = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length * 88
      : 0;
    const current = Number(loader.dataset.progress || 0);
    updateProgress(Math.max(current, 4 + measuredPercent));
  };
  window.hidePageLoader = async () => {
    const version = loaderVersion;
    await window.waitForDashboardPaint();
    if (version !== loaderVersion || loader.hidden) return;
    updateProgress(100);
    await new Promise(resolve => setTimeout(resolve, 140));
    if (version !== loaderVersion) return;
    loader.hidden = true;
    progressItems.clear();
    if (activityTimer) {
      clearInterval(activityTimer);
      activityTimer = null;
    }
  };

  const sidebar = document.querySelector("[data-sidebar]");
  const backgroundStatus = document.createElement("div");
  backgroundStatus.className = "edu15-background-status";
  backgroundStatus.hidden = true;
  backgroundStatus.setAttribute("role", "status");
  backgroundStatus.setAttribute("aria-live", "polite");
  backgroundStatus.innerHTML = '<div class="edu15-background-status-label"><i class="fas fa-cloud-arrow-down text-teal-400" aria-hidden="true"></i><span class="edu15-background-status-copy"><strong class="block text-xs font-medium text-slate-200">กำลังเตรียมข้อมูลเพิ่มเติม</strong><span data-background-detail>รอเริ่มดาวน์โหลด</span></span></div><div class="edu15-background-status-track"><div class="edu15-background-status-bar"></div></div><button type="button" class="edu15-background-reload" hidden><i class="fas fa-rotate-right mr-1"></i>รีเฟรชหน้าเว็บไซต์</button>';
  sidebar?.appendChild(backgroundStatus);
  backgroundStatus.querySelector(".edu15-background-reload").addEventListener("click", () => location.reload());

  const waitForIdle = () => new Promise(resolve => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(resolve, { timeout: 900 });
    } else {
      setTimeout(resolve, 250);
    }
  });

  window.cancelBackgroundTasks = () => {
    backgroundVersion++;
    backgroundStatus.hidden = true;
  };
  window.runBackgroundTasks = async (tasks, options = {}) => {
    const queue = (tasks || []).filter(task => task && typeof task.run === "function");
    const version = ++backgroundVersion;
    if (!queue.length) {
      backgroundStatus.hidden = true;
      return;
    }

    await waitForIdle();
    if (version !== backgroundVersion) return;
    backgroundStatus.hidden = false;
    const title = backgroundStatus.querySelector("strong");
    const detail = backgroundStatus.querySelector("[data-background-detail]");
    const bar = backgroundStatus.querySelector(".edu15-background-status-bar");
    const icon = backgroundStatus.querySelector("i");
    const reloadButton = backgroundStatus.querySelector(".edu15-background-reload");
    backgroundStatus.classList.remove("is-error");
    backgroundStatus.setAttribute("role", "status");
    reloadButton.hidden = true;
    icon.className = "fas fa-cloud-arrow-down text-teal-400";
    bar.style.width = "0%";
    title.textContent = options.title || "กำลังเตรียมข้อมูลเพิ่มเติม";
    let completed = 0;
    let failed = 0;

    for (const task of queue) {
      if (version !== backgroundVersion) return;
      detail.textContent = `${task.label || "ข้อมูลเพิ่มเติม"} · ${completed}/${queue.length}`;
      try {
        await task.run();
      } catch (error) {
        failed++;
        console.warn(`Background task failed: ${task.label || "unnamed"}`, error);
      }
      completed++;
      const percent = Math.round(completed / queue.length * 100);
      bar.style.width = `${percent}%`;
      detail.textContent = `${completed} จาก ${queue.length} ชุด · ${percent}%`;
    }

    if (version !== backgroundVersion) return;
    title.textContent = failed ? "โหลดข้อมูลเพิ่มเติมไม่สำเร็จ" : "ข้อมูลเพิ่มเติมพร้อมใช้งาน";
    detail.textContent = failed
      ? "กรุณารีเฟรชหน้าเว็บไซต์เพื่อโหลดข้อมูลอีกครั้ง"
      : "พร้อมสำหรับการดูรายละเอียดและตัวกรองถัดไป";
    icon.className = failed
      ? "fas fa-circle-exclamation text-rose-400"
      : "fas fa-circle-check text-emerald-400";
    if (failed) {
      backgroundStatus.classList.add("is-error");
      backgroundStatus.setAttribute("role", "alert");
      reloadButton.hidden = false;
    } else {
      setTimeout(() => {
        if (version === backgroundVersion) backgroundStatus.hidden = true;
      }, 5000);
    }
  };
}

function setupResponsiveTables() {
  document.querySelectorAll("main table").forEach(table => {
    const columnCount = table.querySelectorAll("thead tr:first-child > *").length;
    table.classList.toggle("edu15-wide-table", columnCount >= 3);
    const scrollContainer = table.closest(".overflow-x-auto, .overflow-auto");
    if (scrollContainer && columnCount >= 3) {
      scrollContainer.setAttribute("tabindex", "0");
      scrollContainer.setAttribute("role", "region");
      scrollContainer.setAttribute("aria-label", "ตารางข้อมูล เลื่อนซ้ายหรือขวาเพื่อดูคอลัมน์เพิ่มเติม");
    }
  });
}

function createMultiSelect(element, values, placeholder = "เลือกข้อมูล") {
  const selected = new Set();
  element.classList.add("edu15-multi");
  element.innerHTML = `<button type="button" class="edu15-multi-button"><span data-multi-label>${placeholder}</span><i class="fas fa-chevron-down text-xs text-slate-400"></i></button><div class="edu15-multi-panel" hidden></div>`;
  const button = element.querySelector("button");
  const panel = element.querySelector(".edu15-multi-panel");
  const label = element.querySelector("[data-multi-label]");
  const refreshLabel = () => {
    label.textContent = selected.size === 0
      ? placeholder
      : selected.size === 1
        ? [...selected][0]
        : `เลือกแล้ว ${selected.size} รายการ`;
  };
  values.forEach(value => {
    const option = document.createElement("label");
    option.className = "edu15-multi-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = value;
    const text = document.createElement("span");
    text.textContent = value;
    checkbox.addEventListener("change", () => {
      checkbox.checked ? selected.add(value) : selected.delete(value);
      refreshLabel();
    });
    option.append(checkbox, text);
    panel.appendChild(option);
  });
  button.addEventListener("click", event => {
    event.stopPropagation();
    document.querySelectorAll(".edu15-multi-panel").forEach(item => {
      if (item !== panel) item.hidden = true;
    });
    panel.hidden = !panel.hidden;
  });
  panel.addEventListener("click", event => event.stopPropagation());
  return {
    getValues: () => [...selected],
    clear: () => {
      selected.clear();
      panel.querySelectorAll("input").forEach(input => { input.checked = false; });
      refreshLabel();
    }
  };
}

window.EDU15MultiSelect = { create: createMultiSelect };

function updateAuthNavigation(user) {
  const adminLink = document.querySelector('a[href="admin.html"]');
  if (adminLink) adminLink.closest("li").hidden = !user;

  const headerArea = document.querySelector("header .flex.items-center.space-x-4");
  if (!headerArea) return;
  headerArea.innerHTML = user
    ? `<a href="admin.html" class="flex items-center text-teal-700 border border-teal-200 bg-teal-50 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-teal-100 transition" aria-label="จัดการบัญชี ${escapeHtml(user.email)}"><i class="fas fa-user-gear mr-2"></i><span class="header-auth-label">${escapeHtml(user.email)}</span></a><button id="signOutButton" type="button" class="text-slate-500 hover:text-rose-600 text-sm" title="ออกจากระบบ" aria-label="ออกจากระบบ"><i class="fas fa-right-from-bracket"></i></button>`
    : `<a href="login.html" class="flex items-center text-teal-700 border border-teal-200 bg-teal-50 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-teal-100 transition" aria-label="เข้าสู่ระบบสำหรับเจ้าหน้าที่"><i class="fas fa-right-to-bracket mr-2"></i><span class="header-auth-label">สำหรับเจ้าหน้าที่</span></a>`;
  document.getElementById("signOutButton")?.addEventListener("click", () => firebase.auth().signOut());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[char]);
}

document.addEventListener("DOMContentLoaded", () => {
  configureChartDataLabels();
  installSharedStyles();
  setupSidebar();
  setupResponsiveTables();
  installLoader();
  if (!firebase.apps.length) firebase.initializeApp(EDU15_FIREBASE_CONFIG);
  firebase.auth().onAuthStateChanged(updateAuthNavigation);
  if (document.body.dataset.dashboard === "true") showPageLoader();
});

document.addEventListener("click", () => {
  document.querySelectorAll(".edu15-multi-panel").forEach(panel => { panel.hidden = true; });
});
