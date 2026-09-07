/* Shared public-site behavior: authentication-aware navigation and sidebar. */
const EDU15_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA7nJ6pBdnECqseBnCi49YRbUbLtcE5dx4",
  authDomain: "edudata-reo15.firebaseapp.com",
  projectId: "edudata-reo15",
  storageBucket: "edudata-reo15.firebasestorage.app",
  messagingSenderId: "297919410636",
  appId: "1:297919410636:web:e1bccc1885ee7e68766d69"
};
const EDU15_LIBRARY_LOADS = new Map();

function loadExternalScript(url, ready) {
  if (ready()) return Promise.resolve();
  if (EDU15_LIBRARY_LOADS.has(url)) return EDU15_LIBRARY_LOADS.get(url);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => ready() ? resolve() : reject(new Error(`โหลดไลบรารีไม่สมบูรณ์: ${url}`));
    script.onerror = () => reject(new Error(`โหลดไลบรารีไม่สำเร็จ: ${url}`));
    document.head.appendChild(script);
  }).catch(error => {
    EDU15_LIBRARY_LOADS.delete(url);
    throw error;
  });
  EDU15_LIBRARY_LOADS.set(url, promise);
  return promise;
}

function loadExternalStyle(url) {
  if (document.querySelector(`link[href="${url}"]`)) return Promise.resolve();
  if (EDU15_LIBRARY_LOADS.has(url)) return EDU15_LIBRARY_LOADS.get(url);
  const promise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.onload = resolve;
    link.onerror = () => reject(new Error(`โหลดรูปแบบไลบรารีไม่สำเร็จ: ${url}`));
    document.head.appendChild(link);
  }).catch(error => {
    EDU15_LIBRARY_LOADS.delete(url);
    throw error;
  });
  EDU15_LIBRARY_LOADS.set(url, promise);
  return promise;
}

window.EDU15Libraries = {
  loadLeaflet: () => Promise.all([
    loadExternalStyle("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"),
    loadExternalScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", () => typeof window.L !== "undefined")
  ]),
  loadXlsx: () => loadExternalScript(
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    () => typeof window.XLSX !== "undefined"
  )
};

window.EDU15Theme = {
  color(name, fallback = "") {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--edu-${name}`).trim() || fallback;
  },
  fontFamily(fallback = "ui-sans-serif, system-ui, sans-serif") {
    return getComputedStyle(document.documentElement)
      .getPropertyValue("--edu-font-family").trim() || fallback;
  },
  dataPalette() {
    return ["blue", "rose", "amber", "teal", "violet", "orange", "cyan", "lime", "pink", "neutral"]
      .map(name => this.color(`data-${name}`));
  }
};

function configureChartDataLabels() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.font.family = EDU15Theme.fontFamily();
  Chart.defaults.font.size = 12;
  Chart.register({
    id: "edu15ChartAccessibility",
    afterUpdate(chart) {
      const canvas = chart.canvas;
      if (!canvas?.parentElement) return;
      const heading = canvas.closest("article, section")?.querySelector("h3, h2");
      const existingLabel = canvas.getAttribute("aria-label")?.trim();
      const title = existingLabel || heading?.textContent?.trim() || "กราฟข้อมูล";
      const descriptionId = `${canvas.id || `chart-${chart.id}`}-data-table`;
      let description = canvas.parentElement.querySelector(`[data-chart-a11y="${descriptionId}"]`);
      if (!description) {
        description = document.createElement("div");
        description.className = "edu15-sr-only";
        description.dataset.chartA11y = descriptionId;
        description.id = descriptionId;
        canvas.insertAdjacentElement("afterend", description);
      }

      const labels = chart.data.labels || [];
      const datasets = (chart.data.datasets || []).filter((_, index) => chart.isDatasetVisible(index));
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", title);
      canvas.setAttribute("aria-describedby", descriptionId);
      canvas.setAttribute("aria-busy", "false");
      description.textContent = "";

      const table = document.createElement("table");
      const caption = document.createElement("caption");
      caption.textContent = `${title} — ตารางข้อมูลสำหรับโปรแกรมอ่านหน้าจอ`;
      table.appendChild(caption);
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      ["รายการ", ...datasets.map(dataset => dataset.label || "ค่า")].forEach(value => {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = value;
        headRow.appendChild(cell);
      });
      head.appendChild(headRow);
      table.appendChild(head);

      const body = document.createElement("tbody");
      labels.forEach((label, labelIndex) => {
        const row = document.createElement("tr");
        const rowHeader = document.createElement("th");
        rowHeader.scope = "row";
        rowHeader.textContent = String(label ?? `รายการ ${labelIndex + 1}`);
        row.appendChild(rowHeader);
        datasets.forEach(dataset => {
          const cell = document.createElement("td");
          const raw = dataset.data?.[labelIndex];
          const value = raw && typeof raw === "object" ? (raw.y ?? raw.x ?? raw.r) : raw;
          const number = Number(value);
          cell.textContent = value === null || value === undefined || value === ""
            ? "ไม่มีข้อมูล"
            : Number.isFinite(number)
              ? number.toLocaleString("th-TH", { maximumFractionDigits: 2 })
              : String(value);
          row.appendChild(cell);
        });
        body.appendChild(row);
      });
      table.appendChild(body);
      description.appendChild(table);
    }
  });
  if (typeof ChartDataLabels === "undefined") return;
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
    color: context => ["doughnut", "pie", "polarArea"].includes(context.chart.config.type)
      ? EDU15Theme.color("surface", "#ffffff")
      : EDU15Theme.color("ink-muted", "#475569"),
    backgroundColor: context => ["doughnut", "pie", "polarArea"].includes(context.chart.config.type)
      ? EDU15Theme.color("chart-label-bg", "rgba(15,23,42,.76)")
      : null,
    borderRadius: 4,
    padding: context => ["doughnut", "pie", "polarArea"].includes(context.chart.config.type) ? 3 : 1,
    clamp: true,
    clip: false,
    font: { size: 12, weight: "600" }
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
    .edu15-sr-only { position: absolute !important; width: 1px !important; height: 1px !important; margin: -1px !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
    .edu15-status-center { margin-top: auto; flex-shrink: 0; border-top: 1px solid rgba(148,163,184,.24); padding: .8rem .75rem; color: var(--edu-sidebar-text); }
    .edu15-status-heading { display: flex; align-items: center; gap: .6rem; min-width: 0; }
    .edu15-status-icon { display: inline-flex; width: 1.75rem; height: 1.75rem; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: .5rem; background: rgba(148,163,184,.14); color: var(--edu-sidebar-muted); }
    .edu15-status-copy { min-width: 0; flex: 1; }
    .edu15-status-copy strong { display: block; color: var(--edu-canvas); font-size: var(--edu-type-metadata); font-weight: 600; }
    .edu15-status-state { display: block; margin-top: .1rem; overflow: hidden; color: var(--edu-sidebar-muted); font-size: var(--edu-type-metadata); line-height: var(--edu-leading-metadata); text-overflow: ellipsis; white-space: nowrap; }
    .edu15-status-detail { margin-top: .45rem; color: var(--edu-sidebar-text); font-size: var(--edu-type-metadata); line-height: var(--edu-leading-metadata); }
    .edu15-status-track { height: .3rem; margin-top: .55rem; overflow: hidden; border-radius: 999px; background: rgba(148,163,184,.24); }
    .edu15-status-track[hidden] { display: none; }
    .edu15-status-bar { height: 100%; width: 0; border-radius: inherit; background: var(--edu-action-border); transition: width .25s ease-out; }
    .edu15-status-reload { width: 100%; min-height: 2.25rem; margin-top: .65rem; border: 1px solid rgba(253,164,175,.5); border-radius: .5rem; background: rgba(159,18,57,.28); padding: .4rem .6rem; color: #ffe4e6; font-size: var(--edu-type-metadata); font-weight: 600; }
    .edu15-status-reload:hover { background: rgba(159,18,57,.5); }
    .edu15-status-center[data-state="loading"] .edu15-status-icon { background: rgba(20,184,166,.16); color: #5eead4; }
    .edu15-status-center[data-state="ready"] .edu15-status-icon { background: rgba(16,185,129,.16); color: #6ee7b7; }
    .edu15-status-center[data-state="stalled"] .edu15-status-icon { background: rgba(245,158,11,.16); color: #fbbf24; }
    .edu15-status-center[data-state="error"] { background: rgba(127,29,29,.2); }
    .edu15-status-center[data-state="error"] .edu15-status-icon { background: rgba(244,63,94,.18); color: #fda4af; }
    .edu15-status-center[data-state="error"] .edu15-status-bar { background: #fb7185; }
    .edu15-status-beacon { position: absolute; top: .2rem; right: .2rem; width: .5rem; height: .5rem; border: 2px solid var(--edu-surface); border-radius: 999px; background: var(--edu-action); }
    .edu15-status-beacon[hidden] { display: none; }
    .edu15-status-beacon[data-state="stalled"] { background: #f59e0b; }
    .edu15-status-beacon[data-state="error"] { background: #e11d48; }
    [data-sidebar].sidebar-collapsed .edu15-status-center { padding: .75rem .5rem; }
    [data-sidebar].sidebar-collapsed .edu15-status-copy,
    [data-sidebar].sidebar-collapsed .edu15-status-detail,
    [data-sidebar].sidebar-collapsed .edu15-status-track,
    [data-sidebar].sidebar-collapsed .edu15-status-reload { display: none; }
    [data-sidebar].sidebar-collapsed .edu15-status-heading { justify-content: center; }
    .edu15-workforce-toggle { width: 100%; }
    .edu15-workforce-submenu { margin: .3rem 0 .4rem 1.7rem; padding-left: .6rem; border-left: 1px solid rgba(148,163,184,.25); }
    .edu15-workforce-submenu a { display: block; border-radius: .4rem; padding: .45rem .55rem; color: var(--edu-sidebar-muted); font-size: var(--edu-type-metadata); line-height: var(--edu-leading-metadata); }
    .edu15-workforce-submenu a:hover,
    .edu15-workforce-submenu a.is-active { background: #334155; color: #5eead4; }
    [data-sidebar].sidebar-collapsed .edu15-workforce-submenu { display: none; }
    [data-sidebar].sidebar-collapsed [data-workforce-chevron] { display: none; }
    .edu15-multi { position: relative; }
    .edu15-multi-button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: .75rem; border: 1px solid var(--edu-border-control); border-radius: .5rem; background: var(--edu-canvas); padding: .625rem .75rem; text-align: left; }
    .edu15-multi-panel { position: absolute; z-index: 60; top: calc(100% + .35rem); left: 0; right: 0; max-height: 17rem; overflow: auto; border: 1px solid var(--edu-border-control); border-radius: .65rem; background: var(--edu-surface); padding: .45rem; box-shadow: var(--edu-shadow-panel); }
    .edu15-multi-panel[hidden] { display: none; }
    .edu15-multi-option { display: flex; min-height: 2.75rem; align-items: center; gap: .55rem; padding: .45rem .55rem; border-radius: .4rem; font-size: .875rem; cursor: pointer; }
    .edu15-multi-option:hover { background: var(--edu-surface-subtle); }
    .edu15-multi-option input { margin-top: .2rem; accent-color: var(--edu-action); }
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
    const label = element.textContent.trim();
    if (/DASHBOARDS|MANAGEMENT|ADMIN CONSOLE/.test(label) && !element.querySelector("a")) {
      element.classList.add("sidebar-section");
      element.textContent = label === "DASHBOARDS"
        ? "ฐานข้อมูล"
        : label === "MANAGEMENT"
          ? "การจัดการข้อมูล"
          : "เครื่องมือผู้ดูแลระบบ";
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
      toggle?.setAttribute("aria-expanded", "true");
    }
  };

  toggle?.addEventListener("click", () => {
    if (mobileQuery.matches) {
      setMobileOpen(!sidebar.classList.contains("sidebar-mobile-open"));
    } else {
      const collapsed = sidebar.classList.toggle("sidebar-collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
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

const EDU15_DATA_SURFACES = {
  "dashboard.html": { label: "สารสนเทศการศึกษา", href: "dashboard.html" },
  "dashboard-index.html": { label: "ดัชนีทางการศึกษา", href: "dashboard-index.html" },
  "dashboard-workforce.html": { label: "ความต้องการกำลังคน", href: "dashboard-workforce.html" },
  "dashboard-business.html": { label: "สถานประกอบการ", href: "dashboard-business.html" },
  "dashboard-workforce-profile.html": { label: "โปรไฟล์ผู้สนใจฝึกประสบการณ์", href: "dashboard-workforce-profile.html" },
  "dashboard-score.html": { label: "ผลการทดสอบทางการศึกษา", href: "dashboard-score.html" }
};

const EDU15_HOME_SURFACES = [
  "dashboard.html",
  "dashboard-index.html",
  "dashboard-workforce.html",
  "dashboard-score.html"
];

function currentPageName() {
  return location.pathname.split("/").pop() || "index.html";
}

function formatDataHealthTime(value) {
  if (!value) return "ยังไม่เคยตรวจสอบ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ไม่พบเวลาตรวจสอบ";
  return `ล่าสุด ${new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date)}`;
}

function readStoredDataHealth(page) {
  try {
    return JSON.parse(localStorage.getItem(`edu15:data-health:${page}`) || "null");
  } catch (_) {
    return null;
  }
}

function installStatusCenter() {
  if (currentPageName() === "index.html") return null;
  const sidebar = document.querySelector("[data-sidebar]");
  if (!sidebar) return null;

  const center = document.createElement("section");
  center.className = "edu15-status-center";
  center.dataset.state = "idle";
  center.setAttribute("role", "status");
  center.setAttribute("aria-live", "polite");
  center.setAttribute("aria-label", "System Status");
  center.innerHTML = `<div class="edu15-status-heading">
    <span class="edu15-status-icon"><i class="fas fa-circle-info" aria-hidden="true"></i></span>
    <span class="edu15-status-copy"><strong>System Status</strong><span class="edu15-status-state">Standby</span></span>
  </div>
  <p class="edu15-status-detail">รอเริ่มทำงาน</p>
  <div class="edu15-status-track" role="progressbar" aria-label="Loading progress" aria-valuemin="0" aria-valuemax="100" hidden><div class="edu15-status-bar"></div></div>
  <button type="button" class="edu15-status-reload" hidden><i class="fas fa-rotate-right mr-1" aria-hidden="true"></i>Reload</button>`;
  sidebar.appendChild(center);

  const menuButton = document.querySelector('header button[aria-label="เปิดหรือปิดเมนู"]');
  const beacon = document.createElement("span");
  beacon.className = "edu15-status-beacon";
  beacon.hidden = true;
  beacon.setAttribute("aria-hidden", "true");
  if (menuButton) {
    menuButton.classList.add("relative");
    menuButton.appendChild(beacon);
  }

  const icon = center.querySelector(".edu15-status-icon i");
  const status = center.querySelector(".edu15-status-state");
  const detail = center.querySelector(".edu15-status-detail");
  const track = center.querySelector(".edu15-status-track");
  const bar = center.querySelector(".edu15-status-bar");
  const reloadButton = center.querySelector(".edu15-status-reload");
  reloadButton.addEventListener("click", () => location.reload());

  const icons = {
    idle: "fa-circle-info",
    loading: "fa-cloud-arrow-down",
    ready: "fa-circle-check",
    stalled: "fa-clock",
    error: "fa-triangle-exclamation"
  };

  return {
    set({ state = "idle", label = "Standby", message = "รอเริ่มทำงาน", progress = null, retry = false } = {}) {
      const safeProgress = progress === null ? null : Math.min(100, Math.max(0, Math.round(progress)));
      center.dataset.state = state;
      center.title = `System Status: ${label}`;
      icon.className = `fas ${icons[state] || icons.idle}`;
      status.textContent = label;
      detail.textContent = message;
      track.hidden = safeProgress === null;
      if (safeProgress !== null) {
        track.setAttribute("aria-valuenow", String(safeProgress));
        bar.style.width = `${Math.max(4, safeProgress)}%`;
      } else {
        track.removeAttribute("aria-valuenow");
        bar.style.width = "0%";
      }
      reloadButton.hidden = !retry;
      beacon.dataset.state = state;
      beacon.hidden = !["loading", "stalled", "error"].includes(state);
      if (menuButton) menuButton.setAttribute("aria-label", `เปิดหรือปิดเมนู · System Status: ${label}`);
    }
  };
}

function installHomeDataHealth(statusCenter) {
  if (currentPageName() !== "index.html" || !statusCenter) return;
  const storedStates = EDU15_HOME_SURFACES.map(readStoredDataHealth).filter(Boolean);
  const readyCount = storedStates.filter(item => item.state === "ready").length;
  const errorCount = storedStates.filter(item => item.state === "error").length;
  const stalledCount = storedStates.filter(item => item.state === "stalled").length;
  const issueCount = errorCount + stalledCount;
  statusCenter.set({
    state: errorCount ? "error" : stalledCount ? "stalled" : readyCount ? "ready" : "idle",
    label: issueCount ? `${issueCount} Issues` : readyCount ? `${readyCount}/${EDU15_HOME_SURFACES.length} Ready` : "Standby",
    message: storedStates.length ? "สถานะ Dashboard ที่เคยเปิด" : "ยังไม่มีประวัติบนอุปกรณ์นี้",
    retry: errorCount > 0
  });
}

function installDataHealth(statusCenter) {
  const page = currentPageName();
  const surface = EDU15_DATA_SURFACES[page];
  if (!surface || !statusCenter) return null;

  const keys = new Map();
  let state = "idle";
  let checkedAt = null;
  let lastMessage = "ยังไม่ได้เริ่มตรวจสอบแหล่งข้อมูล";
  let staleSource = false;
  const summary = () => {
    const values = [...keys.values()];
    return {
      total: values.length,
      complete: values.filter(value => value >= 1).length
    };
  };
  const persist = () => {
    const counts = summary();
    try {
      localStorage.setItem(`edu15:data-health:${page}`, JSON.stringify({
        state,
        checkedAt,
        total: counts.total,
        complete: counts.complete
      }));
    } catch (_) {
      // Status remains useful even when storage is unavailable.
    }
  };
  const render = () => {
    const counts = summary();
    const labels = { idle: "Standby", loading: "Loading", ready: "Ready", stalled: "Slow", error: "Error" };
    const progress = counts.total ? counts.complete / counts.total * 100 : null;
    const messages = {
      idle: `${surface.label} · รอเริ่มทำงาน`,
      loading: `${surface.label} · ${lastMessage}`,
      ready: `${surface.label} · ${formatDataHealthTime(checkedAt)}`,
      stalled: `${surface.label} · การเชื่อมต่อล่าช้า`,
      error: `${surface.label} · โหลดข้อมูลไม่สำเร็จ`
    };
    statusCenter.set({
      state,
      label: labels[state] || labels.idle,
      message: messages[state] || messages.idle,
      progress: state === "loading" ? progress : null,
      retry: ["stalled", "error"].includes(state)
    });
  };
  const set = (nextState, message, shouldPersist = false) => {
    state = nextState;
    lastMessage = message;
    if (nextState === "error") checkedAt = Date.now();
    if (["ready", "stalled"].includes(nextState) && !checkedAt) checkedAt = Date.now();
    render();
    if (shouldPersist) persist();
  };
  render();

  window.addEventListener("edu15:data-status", event => {
    const detail = event.detail || {};
    if (detail.checkedAt) checkedAt = detail.checkedAt;
    if (detail.status === "stale") {
      staleSource = true;
      set("stalled", "กำลังแสดงข้อมูลที่บันทึกไว้ ขณะตรวจสอบข้อมูลใหม่จาก Google Sheet", true);
    } else if (detail.status === "ready" && detail.background) {
      staleSource = false;
      set("ready", "ตรวจสอบข้อมูลใหม่จาก Google Sheet สำเร็จ", true);
    }
  });

  return {
    loading(message = "กำลังเชื่อมต่อและตรวจสอบชุดข้อมูลที่จำเป็น") {
      set("loading", message);
    },
    progress(key, loaded, total) {
      if (!key) return;
      const ratio = total > 0 ? Math.min(1, loaded / total) : 0;
      keys.set(key, Math.max(keys.get(key) || 0, ratio));
      if (!["ready", "error", "stalled"].includes(state)) {
        set("loading", "กำลังโหลดข้อมูล โดยหน้าเว็บส่วนอื่นยังใช้งานได้");
      } else {
        if (state === "ready") {
          const counts = summary();
          lastMessage = `โหลดชุดข้อมูลที่เรียกใช้สำเร็จ ${counts.complete} จาก ${counts.total} ชุด`;
        }
        render();
      }
    },
    ready() {
      if (state === "error" || staleSource) return;
      const counts = summary();
      const message = counts.total
        ? `โหลดชุดข้อมูลที่เรียกใช้สำเร็จ ${counts.complete} จาก ${counts.total} ชุด`
        : "หน้าเว็บพร้อมใช้งาน ยังไม่มีชุดข้อมูลที่ต้องดาวน์โหลด";
      set("ready", message, true);
    },
    stalled() {
      if (state === "error" || state === "ready") return;
      set("stalled", "การเชื่อมต่อใช้เวลานานกว่าปกติ คุณยังอ่านข้อมูลที่แสดงอยู่หรือกดตรวจสอบใหม่ได้", true);
    },
    error(message = "ไม่สามารถโหลดข้อมูลบางส่วนได้") {
      set("error", `${message} ข้อมูลที่โหลดสำเร็จก่อนหน้านี้ยังคงแสดงอยู่`, true);
    }
  };
}

function installLoader(dataHealth, statusCenter) {
  const progressItems = new Map();
  let loaderVersion = 0;
  let backgroundVersion = 0;
  let stalledTimer = null;
  let loaderActive = false;
  let currentProgress = 0;
  let loaderMessage = "กำลังโหลดข้อมูล";

  const updateProgress = percent => {
    const safe = Math.min(100, Math.max(0, Math.round(percent || 0)));
    currentProgress = safe;
    statusCenter?.set({
      state: "loading",
      label: `Loading ${safe}%`,
      message: loaderMessage,
      progress: safe
    });
  };

  window.waitForDashboardPaint = () => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.showPageLoader = (message = "กำลังเตรียมข้อมูลสำหรับแสดงผล", percent = 0) => {
    loaderVersion++;
    loaderActive = true;
    progressItems.clear();
    if (stalledTimer) clearTimeout(stalledTimer);
    loaderMessage = message === "กำลังเตรียมข้อมูลสำหรับแสดงผล" ? "กำลังโหลดข้อมูล" : message;
    dataHealth?.loading(loaderMessage);
    updateProgress(Math.max(4, percent));
    stalledTimer = setTimeout(() => {
      if (!loaderActive) return;
      dataHealth?.stalled();
    }, 12000);
  };
  window.reportPageProgress = (key, loaded, total) => {
    progressItems.set(key, total > 0 ? Math.min(1, loaded / total) : 0);
    const values = [...progressItems.values()];
    const measuredPercent = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length * 88
      : 0;
    updateProgress(Math.max(currentProgress, 4 + measuredPercent));
    dataHealth?.progress(key, loaded, total);
    updateProgress(Math.max(currentProgress, 4 + measuredPercent));
  };
  window.reportDataError = message => dataHealth?.error(message);
  window.hidePageLoader = async () => {
    const version = loaderVersion;
    await window.waitForDashboardPaint();
    if (version !== loaderVersion || !loaderActive) return;
    updateProgress(100);
    await new Promise(resolve => setTimeout(resolve, 140));
    if (version !== loaderVersion) return;
    loaderActive = false;
    progressItems.clear();
    dataHealth?.ready();
    if (stalledTimer) {
      clearTimeout(stalledTimer);
      stalledTimer = null;
    }
  };

  const waitForIdle = () => new Promise(resolve => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(resolve, { timeout: 900 });
    } else {
      setTimeout(resolve, 250);
    }
  });

  window.cancelBackgroundTasks = () => {
    backgroundVersion++;
  };
  window.runBackgroundTasks = async (tasks, options = {}) => {
    const queue = (tasks || []).filter(task => task && typeof task.run === "function");
    const version = ++backgroundVersion;
    if (!queue.length) return;

    await waitForIdle();
    if (version !== backgroundVersion) return;
    const backgroundLabel = options.title || "กำลังโหลดข้อมูลเสริม";
    statusCenter?.set({ state: "loading", label: "Background 0%", message: backgroundLabel, progress: 0 });
    let completed = 0;
    let failed = 0;

    for (const task of queue) {
      if (version !== backgroundVersion) return;
      statusCenter?.set({
        state: "loading",
        label: `Background ${Math.round(completed / queue.length * 100)}%`,
        message: task.label || "กำลังโหลดข้อมูลเสริม",
        progress: completed / queue.length * 100
      });
      try {
        await task.run();
      } catch (error) {
        failed++;
        console.warn(`Background task failed: ${task.label || "unnamed"}`, error);
      }
      completed++;
      const percent = Math.round(completed / queue.length * 100);
      statusCenter?.set({ state: "loading", label: `Background ${percent}%`, message: `${completed}/${queue.length} ชุด`, progress: percent });
    }

    if (version !== backgroundVersion) return;
    statusCenter?.set(failed
      ? { state: "error", label: "Error", message: "โหลดข้อมูลเสริมไม่สำเร็จ", retry: true }
      : { state: "ready", label: "Ready", message: "ข้อมูลทั้งหมดพร้อมใช้งาน" });
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

function setupAccessibleControls() {
  let generatedLabelId = 0;
  document.querySelectorAll("label:not([for])").forEach(label => {
    if (label.querySelector("input, select, textarea")) return;
    const field = label.parentElement;
    if (!field) return;
    const nativeControl = field.querySelector(":scope > select[id], :scope > input[id], :scope > textarea[id], :scope > div input[id]");
    if (nativeControl) {
      label.htmlFor = nativeControl.id;
      return;
    }
    const customControl = [...field.children].find(child => child !== label && child.id);
    if (!customControl) return;
    if (!label.id) label.id = `${customControl.id || `field-${++generatedLabelId}`}-label`;
    customControl.setAttribute("aria-labelledby", label.id);
  });
}

function closeMultiSelectPanel(panel) {
  if (!panel) return;
  panel.hidden = true;
  const button = document.querySelector(`[aria-controls="${panel.id}"]`);
  button?.setAttribute("aria-expanded", "false");
}

function createMultiSelect(element, values, placeholder = "เลือกข้อมูล") {
  const selected = new Set();
  const controlId = element.id || `edu15-multi-${Math.random().toString(36).slice(2, 9)}`;
  const panelId = `${controlId}-options`;
  const valueId = `${controlId}-value`;
  const labelledBy = element.getAttribute("aria-labelledby");
  element.classList.add("edu15-multi");
  element.innerHTML = `<button type="button" class="edu15-multi-button" aria-expanded="false" aria-controls="${panelId}"><span id="${valueId}" data-multi-label>${placeholder}</span><i class="fas fa-chevron-down text-xs text-slate-400" aria-hidden="true"></i></button><div id="${panelId}" class="edu15-multi-panel" role="group" hidden></div>`;
  const button = element.querySelector("button");
  const panel = element.querySelector(".edu15-multi-panel");
  const label = element.querySelector("[data-multi-label]");
  if (labelledBy) {
    button.setAttribute("aria-labelledby", `${labelledBy} ${valueId}`);
    panel.setAttribute("aria-labelledby", labelledBy);
  } else {
    button.setAttribute("aria-label", placeholder);
    panel.setAttribute("aria-label", placeholder);
  }
  const refreshLabel = () => {
    label.textContent = selected.size === 0
      ? placeholder
      : selected.size === 1
        ? [...selected][0]
        : `เลือกแล้ว ${selected.size} รายการ`;
  };
  values.forEach((value, index) => {
    const option = document.createElement("label");
    option.className = "edu15-multi-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `${controlId}-option-${index}`;
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
      if (item !== panel) closeMultiSelectPanel(item);
    });
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
  });
  button.addEventListener("keydown", event => {
    if (!["ArrowDown", "Enter", " "].includes(event.key)) return;
    if (["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    document.querySelectorAll(".edu15-multi-panel").forEach(item => {
      if (item !== panel) closeMultiSelectPanel(item);
    });
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    panel.querySelector("input")?.focus();
  });
  panel.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeMultiSelectPanel(panel);
    button.focus();
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
  setupAccessibleControls();
  setupResponsiveTables();
  const statusCenter = installStatusCenter();
  installHomeDataHealth(statusCenter);
  const dataHealth = installDataHealth(statusCenter);
  installLoader(dataHealth, statusCenter);
  if (!firebase.apps.length) firebase.initializeApp(EDU15_FIREBASE_CONFIG);
  firebase.auth().onAuthStateChanged(updateAuthNavigation);
  if (document.body.dataset.dashboard === "true") showPageLoader();
});

document.addEventListener("click", () => {
  document.querySelectorAll(".edu15-multi-panel").forEach(closeMultiSelectPanel);
});
