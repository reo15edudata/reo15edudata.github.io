/* Shared public-site behavior: authentication-aware navigation and sidebar. */
const EDU15_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA7nJ6pBdnECqseBnCi49YRbUbLtcE5dx4",
  authDomain: "edudata-reo15.firebaseapp.com",
  projectId: "edudata-reo15",
  storageBucket: "edudata-reo15.firebasestorage.app",
  messagingSenderId: "297919410636",
  appId: "1:297919410636:web:e1bccc1885ee7e68766d69"
};

function installSharedStyles() {
  const style = document.createElement("style");
  style.textContent = `
    [data-sidebar] { transition: width .2s ease; }
    [data-sidebar].sidebar-collapsed { width: 4.5rem !important; }
    [data-sidebar].sidebar-collapsed .sidebar-brand-text,
    [data-sidebar].sidebar-collapsed .sidebar-section,
    [data-sidebar].sidebar-collapsed .sidebar-link-text { display: none; }
    [data-sidebar].sidebar-collapsed a { justify-content: center; padding-left: .75rem; padding-right: .75rem; }
    .edu15-loader { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgba(248,250,252,.82); backdrop-filter: blur(2px); }
    .edu15-loader[hidden] { display: none; }
  `;
  document.head.appendChild(style);
}

function setupSidebar() {
  const sidebar = document.querySelector("aside");
  if (!sidebar) return;
  sidebar.dataset.sidebar = "true";

  const workforceLink = sidebar.querySelector('a[href="dashboard-workforce.html"]');
  if (workforceLink && !sidebar.querySelector('a[href="dashboard-score.html"]')) {
    const item = document.createElement("li");
    const isActive = location.pathname.endsWith("/dashboard-score.html");
    item.innerHTML = `<a href="dashboard-score.html" class="flex items-center px-3 py-2 rounded-md ${isActive ? "text-teal-400 bg-slate-800 border-l-2 border-teal-500" : "hover:bg-slate-800 hover:text-white"}"><i class="fas fa-square-poll-vertical w-7"></i>ผลการทดสอบทางการศึกษา</a>`;
    workforceLink.closest("li")?.after(item);
  }

  sidebar.querySelectorAll("a").forEach(link => {
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
    if (/DASHBOARDS|MANAGEMENT/.test(element.textContent.trim()) && !element.querySelector("a")) {
      element.classList.add("sidebar-section");
    }
  });

  const brand = sidebar.querySelector("span");
  if (brand) brand.classList.add("sidebar-brand-text");

  const toggle = document.querySelector("header button");
  if (toggle) {
    toggle.type = "button";
    toggle.setAttribute("aria-label", "ย่อหรือขยายเมนูด้านข้าง");
    toggle.addEventListener("click", () => sidebar.classList.toggle("sidebar-collapsed"));
  }
}

function installLoader() {
  const loader = document.createElement("div");
  loader.id = "pageLoader";
  loader.className = "edu15-loader";
  loader.hidden = true;
  loader.innerHTML = '<div class="rounded-xl bg-white border border-slate-200 shadow-lg px-6 py-5 text-center"><i class="fas fa-spinner fa-spin text-teal-500 text-2xl"></i><p id="pageLoaderText" class="mt-3 text-sm font-medium text-slate-600">กำลังดึงข้อมูล Dashboard…</p></div>';
  document.body.appendChild(loader);
  window.showPageLoader = (message = "กำลังดึงข้อมูล Dashboard…") => {
    document.getElementById("pageLoaderText").textContent = message;
    loader.hidden = false;
  };
  window.hidePageLoader = () => { loader.hidden = true; };
}

function updateAuthNavigation(user) {
  const adminLink = document.querySelector('a[href="admin.html"]');
  if (adminLink) adminLink.closest("li").hidden = !user;

  const headerArea = document.querySelector("header .flex.items-center.space-x-4");
  if (!headerArea) return;
  headerArea.innerHTML = user
    ? `<a href="admin.html" class="flex items-center text-teal-700 border border-teal-200 bg-teal-50 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-teal-100 transition"><i class="fas fa-user-gear mr-2"></i><span class="hidden sm:inline">${escapeHtml(user.email)}</span><span class="sm:hidden">บัญชี</span></a><button id="signOutButton" type="button" class="text-slate-500 hover:text-rose-600 text-sm" title="ออกจากระบบ"><i class="fas fa-right-from-bracket"></i></button>`
    : `<a href="login.html" class="flex items-center text-teal-700 border border-teal-200 bg-teal-50 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-teal-100 transition"><i class="fas fa-right-to-bracket mr-2"></i>สำหรับเจ้าหน้าที่</a>`;
  document.getElementById("signOutButton")?.addEventListener("click", () => firebase.auth().signOut());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[char]);
}

document.addEventListener("DOMContentLoaded", () => {
  installSharedStyles();
  setupSidebar();
  installLoader();
  if (!firebase.apps.length) firebase.initializeApp(EDU15_FIREBASE_CONFIG);
  firebase.auth().onAuthStateChanged(updateAuthNavigation);
  if (document.body.dataset.dashboard === "true") showPageLoader();
});
