import { CONFIG, IS_DEMO } from "./config.js";
import { subscribe } from "./api.js";

export const C = CONFIG.COMPANY;
export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";

document.documentElement.style.setProperty("--brand", C.brandColor);

export function mountChrome(current) {
  const header = document.querySelector("[data-header]");
  const footer = document.querySelector("[data-footer]");
  if (IS_DEMO) document.body.insertAdjacentHTML("afterbegin",
    `<div class="demo-banner">데모 모드입니다. assets/js/config.js 에 Supabase 정보를 넣으면 실제 데이터로 바뀝니다.</div>`);
  if (header) header.outerHTML = `
    <header class="site-header"><div class="wrap">
      <a class="logo" href="./"><span class="logo-mark" aria-hidden="true"></span>${esc(C.name)}</a>
      <nav class="nav" aria-label="주 메뉴">
        <a href="./#capabilities">하는 일</a>
        <a href="./blog.html" ${current === "blog" ? 'aria-current="page"' : ""}>블로그</a>
        <a class="btn small" href="#subscribe">뉴스레터 구독</a>
      </nav>
    </div></header>`;
  if (footer) footer.outerHTML = `
    <footer class="site-footer"><div class="wrap">
      <div><p><b style="color:var(--ink)">${esc(C.name)}</b></p><p>${esc(C.address)}</p></div>
      <div><p>${esc(C.email)}</p><p>${esc(C.phone)}</p></div>
      <p>© ${new Date().getFullYear()} ${esc(C.nameEn || C.name)}</p>
    </div></footer>`;
}

export function bindSubscribeForms() {
  document.querySelectorAll("[data-subscribe]").forEach((form) => {
    const msg = form.querySelector(".sub-msg");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const btn = form.querySelector("button");
      msg.className = "sub-msg";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        msg.textContent = "이메일 주소 형식을 확인해 주세요.";
        msg.classList.add("err");
        return;
      }
      btn.disabled = true;
      try {
        const r = await subscribe(email, form.name?.value?.trim() || "");
        msg.textContent = r.already ? "이미 구독 중인 주소입니다." : "구독했습니다. 다음 소식부터 메일로 보내드릴게요.";
        msg.classList.add("ok");
        form.reset();
      } catch (err) {
        msg.textContent = "구독하지 못했습니다. 잠시 후 다시 시도해 주세요.";
        msg.classList.add("err");
        console.error(err);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

export const subscribeFormHtml = (btnLabel = "구독하기") => `
  <form class="sub-form" data-subscribe novalidate>
    <input name="name" type="text" placeholder="이름 (선택)" aria-label="이름" autocomplete="name">
    <input name="email" type="email" placeholder="이메일 주소" aria-label="이메일 주소" autocomplete="email" required>
    <button class="btn" type="submit">${btnLabel}</button>
    <p class="sub-msg" role="status"></p>
  </form>`;
