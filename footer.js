(() => {
  function installFooter() {
    if (document.querySelector(".edu15-site-footer")) return;

    const style = document.createElement("style");
    style.textContent = `
      .edu15-site-footer { margin-top: 1.25rem; border-top: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; }
      .edu15-site-footer-inner { width: min(100%, 80rem); margin: 0 auto; padding: .7rem 1.25rem; font-size: .7rem; line-height: 1.55; }
      .edu15-site-footer-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .25rem 1rem; }
      .edu15-site-footer-office { color: #475569; font-weight: 600; }
      .edu15-site-footer-maker { color: #94a3b8; }
      .edu15-site-footer details { margin-top: .3rem; }
      .edu15-site-footer summary { width: max-content; color: #0f766e; cursor: pointer; font-size: .68rem; }
      .edu15-site-footer-contact { margin-top: .45rem; border-top: 1px dashed #cbd5e1; padding-top: .45rem; }
      .edu15-site-footer-contact p { margin: .15rem 0; }
      .edu15-site-footer-links { display: flex; flex-wrap: wrap; gap: .35rem .75rem; margin-top: .25rem; }
      .edu15-site-footer-link { color: #0f766e; text-decoration: none; }
      .edu15-site-footer-link:hover, .edu15-site-footer-link:focus-visible { color: #0f172a; text-decoration: underline; outline: none; }
      body.edu15-login-with-footer { flex-direction: column; }
      body.edu15-login-with-footer .edu15-site-footer { width: 100%; max-width: 44rem; border-radius: .5rem; overflow: hidden; }
      @media (max-width: 767px) {
        .edu15-site-footer { margin-top: .75rem; }
        .edu15-site-footer-inner { padding: .65rem .9rem; }
        .edu15-site-footer-summary { display: block; }
        .edu15-site-footer-maker { display: block; margin-top: .1rem; }
      }
    `;
    document.head.appendChild(style);

    const footer = document.createElement("footer");
    footer.className = "edu15-site-footer";
    footer.setAttribute("aria-label", "ข้อมูลผู้จัดทำและช่องทางติดต่อ");
    footer.innerHTML = `
      <div class="edu15-site-footer-inner">
        <div class="edu15-site-footer-summary">
          <span class="edu15-site-footer-office">กลุ่มยุทธศาสตร์การศึกษา · สำนักงานศึกษาธิการภาค 15</span>
          <span class="edu15-site-footer-maker">จัดทำโดย นายรชฏ พลอยเล็ก นักวิชาการศึกษาปฏิบัติการ</span>
        </div>
        <details>
          <summary>ข้อมูลติดต่อ</summary>
          <div class="edu15-site-footer-contact">
            <p>สำนักงานศึกษาธิการภาค 15 เลขที่ 2 ถนนห้วยแก้ว ตำบลช้างเผือก อำเภอเมือง จังหวัดเชียงใหม่ 50300</p>
            <p>โทรศัพท์ <a href="tel:053221413" class="edu15-site-footer-link">05-322-1413</a> · โทรสาร 05-321-4575</p>
            <div class="edu15-site-footer-links">
              <a href="mailto:reo15cm@gmail.com" class="edu15-site-footer-link">reo15cm@gmail.com</a>
              <a href="https://reo15.moe.go.th/" target="_blank" rel="noopener noreferrer" class="edu15-site-footer-link">เว็บไซต์หลัก</a>
              <a href="https://www.facebook.com/REO.15CHIANGMAI/" target="_blank" rel="noopener noreferrer" class="edu15-site-footer-link">Facebook</a>
            </div>
          </div>
        </details>
      </div>
    `;

    const main = document.querySelector("main");
    if (main) {
      main.appendChild(footer);
    } else {
      document.body.classList.add("edu15-login-with-footer");
      document.body.appendChild(footer);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installFooter, { once: true });
  } else {
    installFooter();
  }
})();
