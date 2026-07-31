(() => {
  function installFooter() {
    if (document.querySelector(".edu15-site-footer")) return;

    const style = document.createElement("style");
    style.textContent = `
      .edu15-site-footer { margin-top: 2rem; border-top: 3px solid #14b8a6; background: #0f172a; color: #cbd5e1; }
      .edu15-site-footer-inner { width: min(100%, 80rem); margin: 0 auto; display: grid; grid-template-columns: 1fr; gap: 1.5rem; padding: 2rem 1.5rem; }
      .edu15-site-footer-title { margin: 0 0 .65rem; color: #5eead4; font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .edu15-site-footer p { margin: .25rem 0; font-size: .82rem; line-height: 1.7; }
      .edu15-site-footer-name { color: #f8fafc; font-size: .92rem !important; font-weight: 600; }
      .edu15-site-footer-links { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: .75rem; }
      .edu15-site-footer-link { display: inline-flex; align-items: center; min-height: 2.35rem; border: 1px solid rgba(94,234,212,.3); border-radius: .6rem; padding: .45rem .75rem; color: #99f6e4; font-size: .78rem; text-decoration: none; transition: background-color .15s ease, border-color .15s ease; }
      .edu15-site-footer-link:hover, .edu15-site-footer-link:focus-visible { border-color: #5eead4; background: rgba(20,184,166,.14); color: #fff; outline: none; }
      body.edu15-login-with-footer { flex-direction: column; }
      body.edu15-login-with-footer .edu15-site-footer { width: 100%; max-width: 64rem; border-radius: .8rem; overflow: hidden; }
      @media (min-width: 768px) {
        .edu15-site-footer-inner { grid-template-columns: 1fr 1.45fr; align-items: start; padding: 2.25rem 2rem; }
      }
      @media (max-width: 767px) {
        .edu15-site-footer { margin-top: 1.25rem; }
        .edu15-site-footer-inner { padding: 1.5rem 1.1rem; }
        .edu15-site-footer-link { flex: 1 1 auto; justify-content: center; }
      }
    `;
    document.head.appendChild(style);

    const footer = document.createElement("footer");
    footer.className = "edu15-site-footer";
    footer.setAttribute("aria-label", "ข้อมูลผู้จัดทำและช่องทางติดต่อ");
    footer.innerHTML = `
      <div class="edu15-site-footer-inner">
        <section>
          <h2 class="edu15-site-footer-title">จัดทำโดย</h2>
          <p class="edu15-site-footer-name">นายรชฏ พลอยเล็ก นักวิชาการศึกษาปฏิบัติการ</p>
          <p>กลุ่มยุทธศาสตร์การศึกษา<br>สำนักงานศึกษาธิการภาค 15</p>
        </section>
        <section>
          <h2 class="edu15-site-footer-title">ช่องทางติดต่อ</h2>
          <p>สำนักงานศึกษาธิการภาค 15 เลขที่ 2 ถนนห้วยแก้ว ตำบลช้างเผือก อำเภอเมือง จังหวัดเชียงใหม่ 50300</p>
          <p>โทรศัพท์ <a href="tel:053221413" class="edu15-site-footer-link">05-322-1413</a> โทรสาร 05-321-4575</p>
          <div class="edu15-site-footer-links">
            <a href="mailto:reo15cm@gmail.com" class="edu15-site-footer-link">reo15cm@gmail.com</a>
            <a href="https://reo15.moe.go.th/" target="_blank" rel="noopener noreferrer" class="edu15-site-footer-link">เว็บไซต์หลัก</a>
            <a href="https://www.facebook.com/REO.15CHIANGMAI/" target="_blank" rel="noopener noreferrer" class="edu15-site-footer-link">Facebook</a>
          </div>
        </section>
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
