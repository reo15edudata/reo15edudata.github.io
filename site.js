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
    .edu15-loader { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgba(248,250,252,.82); backdrop-filter: blur(2px); }
    .edu15-loader[hidden] { display: none; }
    .edu15-progress-track { width: 18rem; height: .55rem; overflow: hidden; border-radius: 999px; background: #e2e8f0; }
    .edu15-progress-bar { height: 100%; width: 4%; border-radius: inherit; background: linear-gradient(90deg,#14b8a6,#0ea5e9); transition: width .25s ease; }
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

function installLoader() {
  const progressItems = new Map();
  const loader = document.createElement("div");
  loader.id = "pageLoader";
  loader.className = "edu15-loader";
  loader.hidden = true;
  loader.innerHTML = '<div class="rounded-xl bg-white border border-slate-200 shadow-lg px-7 py-6 text-center"><i class="fas fa-chart-line text-teal-500 text-2xl"></i><p id="pageLoaderText" class="mt-3 mb-3 text-sm font-medium text-slate-600">กำลังเตรียมข้อมูลสำหรับแสดงผล</p><div class="edu15-progress-track" role="progressbar" aria-label="ความคืบหน้าการโหลดข้อมูล" aria-valuemin="0" aria-valuemax="100"><div id="pageLoaderBar" class="edu15-progress-bar"></div></div><p id="pageLoaderPercent" class="mt-2 text-xs text-slate-400">0%</p></div>';
  document.body.appendChild(loader);
  const updateProgress = percent => {
    const safe = Math.min(100, Math.max(0, Math.round(percent || 0)));
    document.getElementById("pageLoaderBar").style.width = `${Math.max(4, safe)}%`;
    document.getElementById("pageLoaderPercent").textContent = `${safe}%`;
    loader.querySelector('[role="progressbar"]').setAttribute("aria-valuenow", String(safe));
  };
  window.showPageLoader = (message = "กำลังเตรียมข้อมูลสำหรับแสดงผล", percent = 0) => {
    document.getElementById("pageLoaderText").textContent = message;
    updateProgress(percent);
    loader.hidden = false;
  };
  window.reportPageProgress = (key, loaded, total) => {
    progressItems.set(key, total > 0 ? Math.min(1, loaded / total) : 0);
    const values = [...progressItems.values()];
    updateProgress(values.length ? values.reduce((sum, value) => sum + value, 0) / values.length * 100 : 0);
  };
  window.hidePageLoader = () => {
    updateProgress(100);
    setTimeout(() => {
      loader.hidden = true;
      progressItems.clear();
    }, 180);
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
