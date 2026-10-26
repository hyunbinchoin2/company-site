import { CONFIG, IS_DEMO } from "./config.js";
import { subscribe } from "./api.js";

export const C = CONFIG.COMPANY;
export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";

document.documentElement.style.setProperty("--brand", C.brandColor);

// 브라우저 탭 아이콘: 브랜드 색 사각형 위 N
const favicon = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${C.brandColor}"/><path d="M18 46V18h6l16 18V18h6v28h-6L24 28v18z" fill="#fff"/></svg>`)}`;

export function mountChrome(current) {
  const header = document.querySelector("[data-header]");
  const footer = document.querySelector("[data-footer]");
  document.querySelectorAll('link[rel="icon"]').forEach((l) => (l.href = favicon));
  if (IS_DEMO) document.body.insertAdjacentHTML("afterbegin",
    `<div class="demo-banner">데모 모드입니다. assets/js/config.js 에 Supabase 정보를 넣으면 실제 데이터로 바뀝니다.</div>`);
  if (header) header.outerHTML = `
    <header class="site-header"><div class="wrap">
      <a class="logo" href="./" aria-label="${esc(C.name)} 홈">${esc(C.nameEn || C.name)}</a>
      <nav class="nav" aria-label="주 메뉴">
        <a href="./#solutions">솔루션</a>
        <a href="./#why">회사 소개</a>
        <a href="./blog.html" ${current === "blog" ? 'aria-current="page"' : ""}>블로그</a>
        <a href="./#contact">도입 문의</a>
        <a class="btn small" href="#subscribe">뉴스레터 구독</a>
      </nav>
    </div></header>`;
  if (footer) footer.outerHTML = `
    <footer class="site-footer"><div class="wrap">
      <div class="foot-brand">${esc(C.nameEn || C.name)}</div>
      <div class="foot-info">
        <p>(주)${esc(C.name)}${C.ceo ? ` <span>대표이사 ${esc(C.ceo)}</span>` : ""}</p>
        <p>${esc(C.address)}</p>
        <p>전화 ${esc(C.phone)}${C.fax ? ` <span>팩스 ${esc(C.fax)}</span>` : ""} <span>메일 ${esc(C.email)}</span></p>
      </div>
      <p class="foot-copy">© ${new Date().getFullYear()} ${esc(C.nameEn || C.name)}</p>
    </div></footer>`;
  // 스크롤하면 헤더 아래 그림자
  const bar = document.querySelector(".site-header");
  const onScroll = () => bar && bar.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
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
