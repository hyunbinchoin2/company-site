import { CONFIG, IS_DEMO } from "../assets/js/config.js";
import * as api from "../assets/js/api.js";
import { buildNewsletterHtml, previewHtml } from "../assets/js/email-template.js";

const C = CONFIG.COMPANY;
document.documentElement.style.setProperty("--brand", C.brandColor);

/* ------------------------------------------------------------------ */
/*  유틸                                                                */
/* ------------------------------------------------------------------ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s = "") =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }) : "–");
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "–");
const ratio = (a, b) => (b ? a / b : 0);
const num = (n) => Number(n || 0).toLocaleString("ko-KR");
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function toast(msg, err = false) {
  const el = document.createElement("div");
  el.className = "toast" + (err ? " err" : "");
  el.textContent = msg;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), err ? 5000 : 2800);
}

function modal({ title, body = "", input = null, confirmText = "확인", cancelText = "취소", danger = false, wide = false }) {
  return new Promise((resolve) => {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    const field = !input ? "" : input.type === "textarea"
      ? `<textarea class="textarea mono" id="m-in" rows="8" placeholder="${esc(input.placeholder || "")}">${esc(input.value || "")}</textarea>`
      : `<input class="input" id="m-in" type="${input.type || "text"}" value="${esc(input.value || "")}" placeholder="${esc(input.placeholder || "")}">`;
    bg.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t" ${wide ? 'style="width:min(860px,100%)"' : ""}>
        <h3 id="m-t">${esc(title)}</h3>
        ${body ? `<div>${body}</div>` : ""}
        ${field}
        <div class="actions">
          ${cancelText ? `<button class="btn line" data-x>${esc(cancelText)}</button>` : ""}
          <button class="btn ${danger ? "danger" : ""}" data-ok>${esc(confirmText)}</button>
        </div>
      </div>`;
    const close = (v) => { bg.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    bg.addEventListener("click", (e) => {
      if (e.target === bg || e.target.closest("[data-x]")) close(false);
      if (e.target.closest("[data-ok]")) close(input ? $("#m-in", bg).value : true);
    });
    document.addEventListener("keydown", onKey);
    document.body.append(bg);
    ($("#m-in", bg) || $("[data-ok]", bg)).focus();
  });
}

function setHeader(title, sub = "", actions = "") {
  $("#page-title").textContent = title;
  $("#page-sub").textContent = sub;
  $("#page-actions").innerHTML = actions;
  document.title = `${title} · 뉴스레터 관리자`;
}

function downloadCsv(filename, rows) {
  const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function statusBadge(s) {
  return { draft: `<span class="badge">임시저장</span>`, sending: `<span class="badge warn">발송 중</span>`,
    sent: `<span class="badge ok">발송 완료</span>`, failed: `<span class="badge danger">실패</span>` }[s] || esc(s);
}

function linkLabel(url, posts) {
  try {
    const u = new URL(url);
    const slug = u.searchParams.get("slug");
    const p = slug && posts.find((x) => x.slug === slug);
    if (p) return p.title;
    if (u.pathname.endsWith("blog.html")) return "블로그 목록";
    return u.hostname + u.pathname;
  } catch { return url; }
}

/* ------------------------------------------------------------------ */
/*  부팅 · 로그인 · 라우팅                                                */
/* ------------------------------------------------------------------ */
let session = null;
let suppressRoute = false;
const view = $("#view");

$("#login-company").textContent = `${C.name} 뉴스레터를 관리합니다.`;
$("#side-brand").innerHTML = `${esc(C.name)}<small>뉴스레터 관리자</small>`;
if (IS_DEMO) {
  $("#demo-note").hidden = false;
  $("#l-email").value = "demo@example.com";
  $("#l-pw").value = "demo";
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  $("#login-err").textContent = "";
  try {
    await api.signIn($("#l-email").value.trim(), $("#l-pw").value);
    await boot();
  } catch (err) {
    $("#login-err").textContent = err.message;
  } finally { btn.disabled = false; }
});

$("#logout").addEventListener("click", async () => { await api.signOut(); location.hash = ""; boot(); });

async function boot() {
  session = await api.getSession();
  $("#login").hidden = !!session;
  $("#app").hidden = !session;
  if (session) {
    $("#who").textContent = session.user.email;
    route();
  }
}

const routes = { dashboard, newsletters, stats, compose, posts, post: postEditor, subscribers };

async function route() {
  if (!session) return;
  if (suppressRoute) { suppressRoute = false; return; }
  const [, page = "dashboard", id] = (location.hash || "#/dashboard").split("/");
  const key = routes[page] ? page : "dashboard";
  const navKey = { stats: "newsletters", post: "posts" }[key] || key;
  $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === navKey));
  view.innerHTML = `<div class="loading">불러오는 중…</div>`;
  setHeader("");
  try { await routes[key](id); }
  catch (err) {
    console.error(err);
    view.innerHTML = `<div class="panel empty-state"><p>화면을 불러오지 못했습니다.</p><p style="color:var(--danger)">${esc(err.message)}</p></div>`;
  }
}
window.addEventListener("hashchange", route);
const go = (hash, { silent = false } = {}) => { if (silent) suppressRoute = true; location.hash = hash; };

/* ------------------------------------------------------------------ */
/*  대시보드                                                             */
/* ------------------------------------------------------------------ */
async function dashboard() {
  setHeader("대시보드", `${C.name} 뉴스레터 현황`, `<a class="btn" href="#/compose">새 뉴스레터 작성</a>`);
  const [subs, nls, views, allPosts] = await Promise.all([api.listSubscribers(), api.listNewsletters(), api.getPageViews(30), api.listAllPosts()]);
  const titleOf = (slug) => allPosts.find((p) => p.slug === slug)?.title || slug;

  const active = subs.filter((s) => s.status === "active");
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const newThisMonth = subs.filter((s) => new Date(s.created_at) >= monthStart).length;
  const sent = nls.filter((n) => n.status === "sent").sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  const last = sent[0];
  const recent6 = sent.slice(0, 6).reverse();
  const maxRate = Math.max(0.01, ...recent6.map((n) => ratio(n.unique_opens, n.recipient_count)));
  const maxViews = Math.max(1, ...views.map((v) => v.views));

  view.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="k">활성 구독자</div><div class="v">${num(active.length)}<small>명</small></div><div class="d">전체 ${num(subs.length)}명 중</div></div>
      <div class="kpi"><div class="k">이번 달 새 구독자</div><div class="v">${num(newThisMonth)}<small>명</small></div><div class="d">${monthStart.getMonth() + 1}월 1일부터</div></div>
      <div class="kpi"><div class="k">최근 발송 오픈율</div><div class="v">${last ? pct(last.unique_opens, last.recipient_count) : "–"}</div><div class="d">${last ? esc(last.subject) : "아직 발송한 뉴스레터가 없습니다"}</div></div>
      <div class="kpi"><div class="k">최근 발송 클릭률</div><div class="v">${last ? pct(last.unique_clicks, last.recipient_count) : "–"}</div><div class="d">${last ? `클릭 ${num(last.total_clicks)}회 · ${num(last.unique_clicks)}명` : ""}</div></div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>최근 발송 성과</h2><div class="legend"><span><i></i>오픈율</span><span><i class="second"></i>클릭률</span></div></div>
        <div class="panel-body">${recent6.length ? `
          <div class="cols">${recent6.map((n) => `
            <a class="col" href="#/stats/${n.id}" title="${esc(n.subject)} — 오픈 ${pct(n.unique_opens, n.recipient_count)}, 클릭 ${pct(n.unique_clicks, n.recipient_count)}" style="text-decoration:none">
              <div class="pair">
                <span style="height:${(ratio(n.unique_opens, n.recipient_count) / maxRate) * 100}%"></span>
                <span class="second" style="height:${(ratio(n.unique_clicks, n.recipient_count) / maxRate) * 100}%"></span>
              </div>
              <div class="lbl">${fmtDate(n.sent_at).slice(5)}</div>
            </a>`).join("")}
          </div>` : `<div class="empty-state"><p>발송한 뉴스레터가 생기면 여기에 오픈율과 클릭률이 쌓입니다.</p></div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>많이 읽은 글</h2><span class="hint">최근 30일 조회수</span></div>
        <div class="panel-body">${views.length ? `
          <div class="bars">${views.slice(0, 6).map((v) => `
            <div class="bar-row"><span class="name" title="${esc(titleOf(v.slug))}">${esc(titleOf(v.slug))}</span>
              <div class="bar-track"><div class="bar-fill second" style="width:${(v.views / maxViews) * 100}%"></div><div class="bar-fill" style="width:${(v.from_newsletter / maxViews) * 100}%"></div></div>
              <span class="val">${num(v.views)}</span></div>`).join("")}
          </div>
          <div class="legend" style="margin-top:14px"><span><i></i>뉴스레터에서 유입</span><span><i class="second"></i>전체 조회</span></div>`
          : `<div class="empty-state"><p>아직 집계된 조회가 없습니다.</p></div>`}
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>최근 뉴스레터</h2><a class="btn ghost sm" href="#/newsletters">전체 보기</a></div>
        ${newsletterTable(nls.slice(0, 5))}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>최근 구독자</h2><a class="btn ghost sm" href="#/subscribers">전체 보기</a></div>
        <div class="table-wrap"><table class="t"><tbody>${subs.slice(0, 6).map((s) => `
          <tr><td class="title-cell"><b>${esc(s.name || "이름 없음")}</b><small>${esc(s.email)}</small></td>
          <td class="num" style="color:var(--mute)">${fmtDate(s.created_at)}</td></tr>`).join("") || `<tr><td class="empty-state">아직 구독자가 없습니다.</td></tr>`}
        </tbody></table></div>
      </div>
    </div>`;
  bindRowLinks();
}

function newsletterTable(list) {
  if (!list.length) return `<div class="empty-state"><p>아직 만든 뉴스레터가 없습니다.</p><a class="btn" href="#/compose">첫 뉴스레터 작성</a></div>`;
  return `<div class="table-wrap"><table class="t">
    <thead><tr><th>제목</th><th>상태</th><th class="num">수신자</th><th class="num">오픈율</th><th class="num">클릭률</th></tr></thead>
    <tbody>${list.map((n) => `
      <tr class="click" data-href="${n.status === "draft" ? `#/compose/${n.id}` : `#/stats/${n.id}`}">
        <td class="title-cell"><b>${esc(n.subject || "(제목 없음)")}</b><small>${n.sent_at ? `${fmtDT(n.sent_at)} 발송` : `${fmtDT(n.created_at)} 작성`}</small></td>
        <td>${statusBadge(n.status)}</td>
        <td class="num">${n.status === "draft" ? "–" : num(n.recipient_count)}</td>
        <td class="num">${n.status === "draft" ? "–" : pct(n.unique_opens, n.recipient_count)}</td>
        <td class="num">${n.status === "draft" ? "–" : pct(n.unique_clicks, n.recipient_count)}</td>
      </tr>`).join("")}</tbody></table></div>`;
}
function bindRowLinks() {
  $$("tr[data-href]", view).forEach((tr) => tr.addEventListener("click", () => go(tr.dataset.href)));
}

/* ------------------------------------------------------------------ */
/*  발송 내역                                                            */
/* ------------------------------------------------------------------ */
async function newsletters() {
  setHeader("발송 내역·통계", "행을 누르면 상세 통계를 볼 수 있습니다", `<a class="btn" href="#/compose">새 뉴스레터 작성</a>`);
  const list = await api.listNewsletters();
  view.innerHTML = `<div class="panel">${newsletterTable(list)}</div>`;
  bindRowLinks();
}

/* ------------------------------------------------------------------ */
/*  뉴스레터 상세 통계                                                     */
/* ------------------------------------------------------------------ */
async function stats(id) {
  const [nl, events, allPosts] = await Promise.all([api.getNewsletter(id), api.getNewsletterEvents(id), api.listAllPosts()]);
  if (!nl) { view.innerHTML = `<div class="panel empty-state"><p>뉴스레터를 찾을 수 없습니다.</p></div>`; return; }
  if (nl.status === "draft") return go(`#/compose/${id}`);

  setHeader(nl.subject, `${fmtDT(nl.sent_at)} 발송 · 수신자 ${num(nl.recipient_count)}명`,
    `<button class="btn line" id="view-mail">보낸 메일 보기</button><button class="btn line" id="dl-csv">반응 CSV 받기</button>`);

  const opens = events.filter((e) => e.type === "open");
  const clicks = events.filter((e) => e.type === "click");
  const openers = new Set(opens.map((e) => e.subscriber_id));
  const clickers = new Set(clicks.map((e) => e.subscriber_id));
  const R = nl.recipient_count || 0;

  // 링크별
  const byLink = {};
  clicks.forEach((e) => {
    byLink[e.url] ??= { url: e.url, total: 0, people: new Set() };
    byLink[e.url].total++;
    byLink[e.url].people.add(e.subscriber_id);
  });
  const links = Object.values(byLink).sort((a, b) => b.total - a.total);
  const maxLink = Math.max(1, ...links.map((l) => l.total));

  // 발송 후 경과 시간별
  const t0 = Date.parse(nl.sent_at);
  const buckets = [[0, 1, "1시간"], [1, 3, "1~3시간"], [3, 6, "3~6시간"], [6, 12, "6~12시간"], [12, 24, "12~24시간"], [24, 72, "1~3일"], [72, Infinity, "3일 이후"]]
    .map(([a, b, label]) => ({ a, b, label, o: 0, c: 0 }));
  const firstOpen = {};
  opens.forEach((e) => { if (!firstOpen[e.subscriber_id]) firstOpen[e.subscriber_id] = e.created_at; });
  const place = (iso, key) => {
    const h = (Date.parse(iso) - t0) / 36e5;
    const b = buckets.find((x) => h >= x.a && h < x.b) || buckets[0];
    b[key]++;
  };
  Object.values(firstOpen).forEach((iso) => place(iso, "o"));
  clicks.forEach((e) => place(e.created_at, "c"));
  const maxB = Math.max(1, ...buckets.map((b) => Math.max(b.o, b.c)));

  // 사람별
  const people = {};
  events.forEach((e) => {
    const p = (people[e.subscriber_id] ??= { email: e.subscribers?.email || "(삭제된 구독자)", name: e.subscribers?.name || "", opened: false, clicks: 0, links: new Set(), last: e.created_at });
    if (e.type === "open") p.opened = true;
    if (e.type === "click") { p.clicks++; p.opened = true; p.links.add(linkLabel(e.url, allPosts)); }
    if (e.created_at > p.last) p.last = e.created_at;
  });
  const peopleList = Object.values(people).sort((a, b) => b.clicks - a.clicks || b.last.localeCompare(a.last));

  view.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="k">받은 사람</div><div class="v">${num(R)}<small>명</small></div><div class="d">발송 성공 기준</div></div>
      <div class="kpi"><div class="k">연 사람</div><div class="v">${pct(openers.size, R)}</div><div class="d">${num(openers.size)}명</div></div>
      <div class="kpi"><div class="k">링크를 누른 사람</div><div class="v">${pct(clickers.size, R)}</div><div class="d">${num(clickers.size)}명 · 연 사람 중 ${pct(clickers.size, openers.size)}</div></div>
      <div class="kpi"><div class="k">총 클릭</div><div class="v">${num(clicks.length)}<small>회</small></div><div class="d">1인당 ${clickers.size ? (clicks.length / clickers.size).toFixed(1) : 0}회</div></div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>링크별 클릭</h2><div class="legend"><span><i></i>누른 사람</span><span><i class="second"></i>총 클릭</span></div></div>
        <div class="panel-body">${links.length ? `<div class="bars">${links.map((l) => `
          <div class="bar-row"><span class="name" title="${esc(l.url)}">${esc(linkLabel(l.url, allPosts))}</span>
            <div class="bar-track"><div class="bar-fill second" style="width:${(l.total / maxLink) * 100}%"></div><div class="bar-fill" style="width:${(l.people.size / maxLink) * 100}%"></div></div>
            <span class="val" title="누른 사람 ${l.people.size}명">${num(l.total)}회</span></div>`).join("")}</div>`
          : `<div class="empty-state"><p>아직 링크 클릭이 없습니다.</p></div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>발송 후 반응 시점</h2><div class="legend"><span><i></i>첫 오픈</span><span><i class="second"></i>클릭</span></div></div>
        <div class="panel-body">
          <div class="cols">${buckets.map((b) => `
            <div class="col" title="${b.label}: 오픈 ${b.o}명, 클릭 ${b.c}회">
              <div class="pair"><span style="height:${(b.o / maxB) * 100}%"></span><span class="second" style="height:${(b.c / maxB) * 100}%"></span></div>
              <div class="lbl">${b.label}</div>
            </div>`).join("")}
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>반응한 구독자</h2>
        <div class="seg" role="group" aria-label="보기">
          <button aria-pressed="true" data-f="all">전체 ${num(peopleList.length)}</button>
          <button aria-pressed="false" data-f="click">클릭한 사람 ${num(clickers.size)}</button>
        </div>
      </div>
      <div class="table-wrap"><table class="t">
        <thead><tr><th>구독자</th><th>오픈</th><th class="num">클릭</th><th>누른 링크</th><th class="num">마지막 반응</th></tr></thead>
        <tbody id="people"></tbody>
      </table></div>
    </div>
    <p style="color:var(--mute);font-size:12px;margin-top:12px">오픈은 메일 속 이미지가 불러와질 때 기록됩니다. 이미지를 막아둔 메일 프로그램에서는 오픈이 빠지고, Apple 메일·Gmail의 이미지 미리 불러오기 때문에 실제보다 높게 잡힐 수 있습니다. 클릭 수치가 더 정확합니다.</p>`;

  const renderPeople = (onlyClick) => {
    const rows = peopleList.filter((p) => !onlyClick || p.clicks > 0);
    $("#people").innerHTML = rows.map((p) => `
      <tr><td class="title-cell"><b>${esc(p.name || p.email)}</b>${p.name ? `<small>${esc(p.email)}</small>` : ""}</td>
      <td>${p.opened ? `<span class="badge ok">열람</span>` : `<span class="badge">–</span>`}</td>
      <td class="num">${p.clicks ? `<b>${p.clicks}</b>` : "0"}</td>
      <td style="max-width:320px;color:var(--slate);font-size:13px">${esc([...p.links].join(", ")) || "–"}</td>
      <td class="num" style="color:var(--mute)">${fmtDT(p.last)}</td></tr>`).join("")
      || `<tr><td colspan="5" class="empty-state">아직 반응한 구독자가 없습니다.</td></tr>`;
  };
  renderPeople(false);
  $$(".seg button", view).forEach((b) => b.addEventListener("click", () => {
    $$(".seg button", view).forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderPeople(b.dataset.f === "click");
  }));

  $("#dl-csv").onclick = () => downloadCsv(`newsletter-${fmtDate(nl.sent_at)}.csv`, [
    ["이메일", "이름", "열람", "클릭 수", "누른 링크", "마지막 반응"],
    ...peopleList.map((p) => [p.email, p.name, p.opened ? "Y" : "N", p.clicks, [...p.links].join(" | "), fmtDT(p.last)]),
  ]);
  $("#view-mail").onclick = async () => {
    let html = nl.html;
    if (!html) {
      const ps = (nl.post_ids || []).map((pid) => allPosts.find((p) => p.id === pid)).filter(Boolean);
      html = buildNewsletterHtml({ ...nl, posts: ps, company: C, siteUrl: CONFIG.SITE_URL });
    }
    const w = window.open("", "_blank");
    if (w) { w.document.write(previewHtml(html, "홍길동", nl.sent_at || new Date())); w.document.close(); }
  };
}

/* ------------------------------------------------------------------ */
/*  뉴스레터 작성 + 미리보기                                                */
/* ------------------------------------------------------------------ */
async function compose(id) {
  const allPosts = await api.listAllPosts();
  const published = allPosts.filter((p) => p.published).sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  let st = { id: null, subject: "", preheader: "", intro: "", post_ids: [] };

  if (id) {
    const nl = await api.getNewsletter(id);
    if (!nl) return go("#/compose");
    if (nl.status !== "draft") return go(`#/stats/${id}`);
    st = { id: nl.id, subject: nl.subject || "", preheader: nl.preheader || "", intro: nl.intro || "", post_ids: nl.post_ids || [] };
  } else {
    // 새로 만들 때: 최근 글 2개를 미리 골라두고 기본 문구를 채움
    const m = new Date().getMonth() + 1;
    st.subject = `${C.name} ${m}월 소식`;
    st.intro = `엔투소프트의 소식과 최신 금융소식을 전달드려요.\n관심 있는 글이 있다면 눌러서 전체 내용을 확인해 보세요.`;
    st.post_ids = published.slice(0, 2).map((p) => p.id);
  }
  let dirty = !id;

  setHeader(id ? "뉴스레터 수정" : "새 뉴스레터", "왼쪽에서 내용을 고르면 오른쪽 미리보기에 메일 디자인이 바로 적용됩니다",
    id ? `<button class="btn danger" id="del-nl">삭제</button>` : "");

  view.innerHTML = `
    <div class="compose">
      <div class="compose-form">
        <div class="panel"><div class="panel-body row">
          <div class="field">
            <label for="f-subject">메일 제목 <span class="count" id="c-subject"></span></label>
            <input class="input" id="f-subject" maxlength="80" value="${esc(st.subject)}">
            <div class="help">받은편지함에 보이는 제목입니다. 40자 안쪽이 잘리지 않습니다.</div>
          </div>
          <div class="field">
            <label for="f-pre">미리보기 문구</label>
            <input class="input" id="f-pre" maxlength="120" value="${esc(st.preheader)}" placeholder="예: 고장 예측 고객 사례와 2.4 업데이트 소식">
            <div class="help">제목 옆에 회색으로 보이는 한 줄입니다. 비워두면 본문 앞부분이 보입니다.</div>
          </div>
          <div class="field">
            <label for="f-intro">인사말</label>
            <textarea class="textarea" id="f-intro" rows="4">${esc(st.intro)}</textarea>
            <div class="help">“OOO님, 안녕하세요.” 아래에 들어갑니다. 이름은 받는 사람마다 자동으로 바뀝니다.</div>
          </div>
        </div></div>

        <div class="panel">
          <div class="panel-head"><h2>보낼 글 고르기</h2><span class="hint">첫 번째 글이 크게 들어갑니다</span></div>
          <div class="panel-body">
            ${published.length ? `<div class="picker" id="picker">${published.map((p) => `
              <label class="pick"><input type="checkbox" value="${p.id}" ${st.post_ids.includes(p.id) ? "checked" : ""}>
                ${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="">` : `<span class="noimg"></span>`}
                <span class="meta"><b>${esc(p.title)}</b><small>${esc(p.category || "")} ${fmtDate(p.published_at)}</small></span>
              </label>`).join("")}</div>
              <ol class="order" id="order"></ol>`
            : `<div class="empty-state"><p>공개된 블로그 글이 없습니다. 글을 먼저 올려주세요.</p><a class="btn line" href="#/post/new">글 쓰기</a></div>`}
          </div>
        </div>
      </div>

      <div class="panel preview">
        <div class="preview-bar">
          <div class="seg" role="group" aria-label="화면 크기">
            <button aria-pressed="true" data-dev="desktop">데스크톱</button>
            <button aria-pressed="false" data-dev="mobile">모바일</button>
          </div>
          <span style="font-size:12px;color:var(--mute)">받는 사람 이름 예시: 홍길동</span>
        </div>
        <div class="inbox">
          <div class="from"><b>${esc(C.name)}</b> &lt;${esc(C.email)}&gt;</div>
          <div class="subj" id="p-subj"></div>
          <div class="pre" id="p-pre"></div>
        </div>
        <div class="stage" id="stage"><iframe id="frame" title="메일 미리보기" sandbox="allow-same-origin allow-popups"></iframe></div>
      </div>
    </div>

    <div class="sendbar">
      <span class="status" id="save-status"></span>
      <div class="actions">
        <button class="btn line" id="b-save">임시저장</button>
        <button class="btn line" id="b-test">테스트 메일 보내기</button>
        <button class="btn" id="b-send">구독자에게 발송</button>
      </div>
    </div>`;

  const frame = $("#frame");
  const postsById = Object.fromEntries(allPosts.map((p) => [p.id, p]));
  const selectedPosts = () => st.post_ids.map((pid) => postsById[pid]).filter(Boolean);
  const html = () => buildNewsletterHtml({ ...st, posts: selectedPosts(), company: C, siteUrl: CONFIG.SITE_URL });

  const setStatus = () => {
    $("#save-status").textContent = dirty ? "저장하지 않은 변경 사항이 있습니다" : "저장됨";
  };
  const renderOrder = () => {
    const ol = $("#order");
    if (!ol) return;
    ol.innerHTML = selectedPosts().map((p, i, arr) => `
      <li><span class="pos ${i === 0 ? "lead" : ""}">${i + 1}</span><span class="t">${esc(p.title)}</span>
        <button data-mv="-1" data-id="${p.id}" ${i === 0 ? "disabled" : ""} aria-label="위로">↑</button>
        <button data-mv="1" data-id="${p.id}" ${i === arr.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button></li>`).join("");
  };
  const refresh = debounce(() => {
    $("#p-subj").textContent = st.subject || "(제목 없음)";
    $("#p-pre").textContent = st.preheader || st.intro.slice(0, 60);
    $("#c-subject").textContent = `${st.subject.length}자`;
    frame.srcdoc = previewHtml(html());
  }, 120);
  frame.addEventListener("load", () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    // 미리보기 속 링크는 새 탭으로 열기
    doc.querySelectorAll("a").forEach((a) => a.setAttribute("target", "_blank"));
    frame.style.minHeight = "0";
    frame.style.height = doc.documentElement.scrollHeight + "px";
  });
  const changed = () => { dirty = true; setStatus(); refresh(); };

  $("#f-subject").addEventListener("input", (e) => { st.subject = e.target.value; changed(); });
  $("#f-pre").addEventListener("input", (e) => { st.preheader = e.target.value; changed(); });
  $("#f-intro").addEventListener("input", (e) => { st.intro = e.target.value; changed(); });
  $("#picker")?.addEventListener("change", (e) => {
    const v = e.target.value;
    st.post_ids = e.target.checked ? [...st.post_ids, v] : st.post_ids.filter((x) => x !== v);
    renderOrder(); changed();
  });
  $("#order")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mv]");
    if (!b) return;
    const i = st.post_ids.indexOf(b.dataset.id);
    const j = i + Number(b.dataset.mv);
    [st.post_ids[i], st.post_ids[j]] = [st.post_ids[j], st.post_ids[i]];
    renderOrder(); changed();
  });
  $$(".preview .seg button").forEach((b) => b.addEventListener("click", () => {
    $$(".preview .seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    $("#stage").classList.toggle("mobile", b.dataset.dev === "mobile");
    setTimeout(() => frame.dispatchEvent(new Event("load")), 320);
  }));

  const validate = () => {
    if (!st.subject.trim()) { toast("메일 제목을 입력하세요.", true); $("#f-subject").focus(); return false; }
    if (!st.post_ids.length && !st.intro.trim()) { toast("인사말을 쓰거나 보낼 글을 하나 이상 고르세요.", true); return false; }
    return true;
  };
  const save = async () => {
    const saved = await api.saveNewsletter({ id: st.id || undefined, subject: st.subject, preheader: st.preheader, intro: st.intro, post_ids: st.post_ids, html: html() });
    if (!st.id) { st.id = saved.id; go(`#/compose/${saved.id}`, { silent: true }); }
    dirty = false; setStatus();
    return saved;
  };
  const busy = (btn, on, label) => {
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span>${label}`; }
    else btn.innerHTML = btn.dataset.label;
  };

  $("#b-save").onclick = async (e) => {
    if (!validate()) return;
    busy(e.currentTarget, true, "저장 중");
    try { await save(); toast("임시저장했습니다."); } catch (err) { toast(err.message, true); }
    busy(e.currentTarget, false);
  };
  $("#b-test").onclick = async (e) => {
    if (!validate()) return;
    const to = await modal({ title: "테스트 메일 보내기", body: `<p>실제 디자인 그대로 한 통을 보냅니다. 통계에는 잡히지 않습니다.</p>`,
      input: { type: "email", value: session.user.email.includes("@admin") ? "" : session.user.email, placeholder: "받을 이메일 주소" }, confirmText: "보내기" });
    if (!to) return;
    const btn = $("#b-test");
    busy(btn, true, "보내는 중");
    try {
      await save();
      await api.sendNewsletter(st.id, { testEmail: to.trim() });
      toast(IS_DEMO ? "데모 모드에서는 실제로 보내지 않습니다." : `${to}로 테스트 메일을 보냈습니다.`);
    } catch (err) { toast(`보내지 못했습니다: ${err.message}`, true); }
    busy(btn, false);
  };
  $("#b-send").onclick = async () => {
    if (!validate()) return;
    const subs = await api.listSubscribers();
    const n = subs.filter((s) => s.status === "active").length;
    if (!n) return toast("발송할 활성 구독자가 없습니다.", true);
    const ok = await modal({
      title: "구독자에게 발송할까요?",
      body: `<p><b>${esc(st.subject)}</b><br>활성 구독자 <b>${num(n)}명</b>에게 지금 발송합니다. 발송 후에는 내용을 고칠 수 없습니다.</p>`,
      confirmText: `${num(n)}명에게 발송`,
    });
    if (!ok) return;
    const btn = $("#b-send");
    busy(btn, true, "발송 중");
    try {
      await save();
      const r = await api.sendNewsletter(st.id);
      toast(`${num(r.sent)}명에게 발송했습니다.`);
      go(`#/stats/${st.id}`);
    } catch (err) {
      toast(`발송하지 못했습니다: ${err.message}`, true);
      busy(btn, false);
    }
  };
  $("#del-nl") && ($("#del-nl").onclick = async () => {
    if (!(await modal({ title: "임시저장한 뉴스레터를 삭제할까요?", confirmText: "삭제", danger: true }))) return;
    await api.deleteNewsletter(st.id);
    toast("삭제했습니다.");
    go("#/newsletters");
  });

  renderOrder(); setStatus(); refresh();
}

/* ------------------------------------------------------------------ */
/*  블로그 글                                                            */
/* ------------------------------------------------------------------ */
async function posts() {
  setHeader("블로그 글", "공개한 글만 사이트와 뉴스레터에 나옵니다", `<a class="btn" href="#/post/new">새 글 쓰기</a>`);
  const list = await api.listAllPosts();
  view.innerHTML = `<div class="panel">${list.length ? `
    <div class="table-wrap"><table class="t">
      <thead><tr><th>제목</th><th>분류</th><th>상태</th><th class="num">공개일</th><th></th></tr></thead>
      <tbody>${list.map((p) => `
        <tr class="click" data-href="#/post/${p.id}">
          <td class="title-cell"><b>${esc(p.title)}</b><small>/${esc(p.slug)}</small></td>
          <td>${esc(p.category || "–")}</td>
          <td>${p.published ? `<span class="badge ok">공개</span>` : `<span class="badge">비공개</span>`}</td>
          <td class="num">${fmtDate(p.published_at)}</td>
          <td class="num">${p.published ? `<button class="btn ghost sm" data-copy="${esc(CONFIG.SITE_URL)}/p/${esc(p.slug)}.html" data-stop>공유 링크 복사</button><a class="btn ghost sm" href="../post.html?slug=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener" data-stop>사이트에서 보기</a>` : ""}</td>
        </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty-state"><p>아직 쓴 글이 없습니다. 첫 글을 올리면 뉴스레터에 넣을 수 있습니다.</p><a class="btn" href="#/post/new">새 글 쓰기</a></div>`}</div>`;
  $$("[data-stop]", view).forEach((a) => a.addEventListener("click", (e) => e.stopPropagation()));
  $$("[data-copy]", view).forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("공유 링크를 복사했습니다. 새 글은 최대 30분 뒤부터 썸네일이 보입니다."); }
    catch { prompt("아래 주소를 복사하세요", b.dataset.copy); }
  }));
  bindRowLinks();
}

const slugify = (t) => {
  const a = t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
  return a.length >= 3 ? a.slice(0, 60)
    : `post-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
};

async function postEditor(id) {
  const list = await api.listAllPosts();
  const isNew = !id || id === "new";
  const p = isNew ? { title: "", slug: "", category: "", excerpt: "", cover_url: "", content: "", published: false } : list.find((x) => x.id === id);
  if (!p) return go("#/posts");
  const cats = [...new Set(list.map((x) => x.category).filter(Boolean))];
  let slugTouched = !isNew;

  setHeader(isNew ? "새 글 쓰기" : "글 수정", isNew ? "" : `/${p.slug}`,
    `${isNew ? "" : `<button class="btn danger" id="del">삭제</button>`}<button class="btn" id="save">저장</button>`);

  view.innerHTML = `
    <div class="editor">
      <div class="panel"><div class="panel-body row">
        <div class="field"><label for="e-title">제목</label><input class="input" id="e-title" value="${esc(p.title)}" style="font-size:17px;font-weight:600"></div>
        <div class="field"><label for="e-excerpt">요약 <span class="count" id="c-ex"></span></label>
          <textarea class="textarea" id="e-excerpt" rows="2" maxlength="160">${esc(p.excerpt || "")}</textarea>
          <div class="help">블로그 목록과 뉴스레터에 제목 아래로 들어갑니다.</div></div>
        <div class="field"><label>본문 <span class="count">사진은 본문 칸에 끌어다 놓거나 붙여넣어도 올라갑니다</span></label>
          <div class="md-tools" role="toolbar" aria-label="본문 도구">
            <button type="button" data-md="h2" title="소제목">소제목</button>
            <button type="button" data-md="bold" title="굵게"><b>굵게</b></button>
            <button type="button" data-md="list" title="목록">• 목록</button>
            <button type="button" data-md="quote" title="인용">“ 인용</button>
            <span class="sep"></span>
            <button type="button" data-md="image" class="strong">사진 넣기</button>
            <button type="button" data-md="table" class="strong">표 넣기</button>
            <button type="button" data-md="link">링크</button>
            <input type="file" id="img-file" accept="image/*" hidden>
          </div>
          <div class="md-split"><textarea class="textarea mono" id="e-content">${esc(p.content || "")}</textarea><div class="md-preview prose" id="e-prev"></div></div></div>
      </div></div>
      <div class="row">
        <div class="panel"><div class="panel-body row">
          <label class="switch"><input type="checkbox" id="e-pub" ${p.published ? "checked" : ""}><span><b>사이트에 공개</b><br><small style="color:var(--mute)">끄면 관리자만 볼 수 있습니다</small></span></label>
        </div></div>
        <div class="panel"><div class="panel-body row">
          <div class="field"><label for="e-cat">분류</label><input class="input" id="e-cat" list="cats" value="${esc(p.category || "")}" placeholder="예: 고객 사례">
            <datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
          <div class="field"><label for="e-slug">주소 (영문)</label><input class="input" id="e-slug" value="${esc(p.slug)}">
            <div class="help">post.html?slug=<b id="slug-show">${esc(p.slug)}</b></div></div>
          <div class="field"><label for="e-cover">대표 이미지</label>
            <div style="display:flex;gap:6px"><input class="input" id="e-cover" value="${esc(p.cover_url || "")}" placeholder="https://… 또는 오른쪽 버튼으로 올리기"><button type="button" class="btn line" id="cover-up" style="height:auto">올리기</button></div>
            <input type="file" id="cover-file" accept="image/*" hidden>
            <div class="cover-prev" id="cover-prev"></div>
            <div class="help">가로로 긴 이미지(16:10)가 잘 어울립니다. 뉴스레터에도 그대로 들어갑니다.</div></div>
        </div></div>
      </div>
    </div>`;

  const upd = () => {
    $("#e-prev").innerHTML = DOMPurify.sanitize(marked.parse($("#e-content").value || "")) || `<p style="color:var(--mute)">본문 미리보기</p>`;
    $("#c-ex").textContent = `${$("#e-excerpt").value.length}/160`;
    const cv = $("#e-cover").value.trim();
    $("#cover-prev").style.backgroundImage = cv ? `url("${cv.replace(/"/g, "")}")` : "none";
    $("#slug-show").textContent = $("#e-slug").value;
  };
  $("#e-content").addEventListener("input", debounce(upd, 150));
  ["#e-excerpt", "#e-cover", "#e-slug"].forEach((s) => $(s).addEventListener("input", upd));
  $("#e-slug").addEventListener("input", () => { slugTouched = true; });
  $("#e-title").addEventListener("input", (e) => {
    if (!slugTouched) { $("#e-slug").value = slugify(e.target.value); upd(); }
  });
  upd();

  /* ---- 본문 편집 도구 ---- */
  const ta = $("#e-content");
  const insert = (before, after = "", placeholder = "") => {
    const a = ta.selectionStart, b = ta.selectionEnd;
    const sel = ta.value.slice(a, b) || placeholder;
    ta.setRangeText(before + sel + after, a, b, "end");
    if (!ta.value.slice(a, b).length && placeholder) {
      ta.selectionStart = a + before.length; ta.selectionEnd = a + before.length + sel.length;
    }
    ta.focus(); upd();
  };
  const block = (text) => {
    const a = ta.selectionStart;
    const before = ta.value.slice(0, a);
    const pre = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    ta.setRangeText(`${pre}${text}\n`, a, ta.selectionEnd, "end");
    ta.focus(); upd();
  };
  const linePrefix = (prefix) => {
    const a = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    ta.setRangeText(prefix, a, a, "end"); ta.focus(); upd();
  };
  const TABLE = `| 항목 | 내용 | 비고 |
| --- | --- | --- |
| 예시 1 | 내용을 입력하세요 |  |
| 예시 2 | 내용을 입력하세요 |  |`;

  async function uploadInto(files) {
    for (const f of files) {
      const mark = `![업로드 중: ${f.name}]()`;
      block(mark);
      try {
        const url = await api.uploadImage(f);
        ta.value = ta.value.replace(mark, `![사진 설명을 입력하세요](${url})`);
        toast("사진을 넣었습니다. '사진 설명' 부분을 고치면 사진 아래 설명으로 나옵니다.");
      } catch (err) {
        ta.value = ta.value.replace(mark + "\n", "");
        toast(err.message, true);
      }
      upd();
    }
  }

  $(".md-tools").addEventListener("click", (e) => {
    const k = e.target.closest("[data-md]")?.dataset.md;
    if (!k) return;
    if (k === "h2") linePrefix("## ");
    if (k === "bold") insert("**", "**", "굵게 할 글자");
    if (k === "list") linePrefix("- ");
    if (k === "quote") linePrefix("> ");
    if (k === "table") block(TABLE);
    if (k === "link") insert("[", "](https://)", "링크 글자");
    if (k === "image") $("#img-file").click();
  });
  $("#img-file").addEventListener("change", (e) => { uploadInto([...e.target.files]); e.target.value = ""; });
  ta.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); ta.classList.add("drop"); } });
  ta.addEventListener("dragleave", () => ta.classList.remove("drop"));
  ta.addEventListener("drop", (e) => {
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    ta.classList.remove("drop");
    if (!files.length) return;
    e.preventDefault();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    uploadInto(files);
  });
  ta.addEventListener("paste", (e) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); uploadInto(files); }
  });

  /* ---- 대표 이미지 올리기 ---- */
  $("#cover-up").onclick = () => $("#cover-file").click();
  $("#cover-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    const btn = $("#cover-up"); btn.disabled = true; btn.textContent = "올리는 중";
    try { $("#e-cover").value = await api.uploadImage(f); upd(); toast("대표 이미지를 올렸습니다."); }
    catch (err) { toast(err.message, true); }
    btn.disabled = false; btn.textContent = "올리기";
  });

  $("#save").onclick = async () => {
    const data = {
      id: isNew ? undefined : p.id,
      title: $("#e-title").value.trim(),
      slug: $("#e-slug").value.trim() || slugify($("#e-title").value),
      category: $("#e-cat").value.trim(),
      excerpt: $("#e-excerpt").value.trim(),
      cover_url: $("#e-cover").value.trim(),
      content: $("#e-content").value,
      published: $("#e-pub").checked,
      published_at: p.published_at || null,
    };
    if (!data.title) return toast("제목을 입력하세요.", true);
    if (!/^[a-z0-9-]+$/.test(data.slug)) return toast("주소는 영문 소문자, 숫자, - 만 쓸 수 있습니다.", true);
    if (list.some((x) => x.slug === data.slug && x.id !== p.id)) return toast("같은 주소를 쓰는 글이 이미 있습니다.", true);
    try {
      await api.savePost(data);
      toast(data.published ? "저장하고 공개했습니다." : "저장했습니다.");
      go("#/posts");
    } catch (err) { toast(err.message, true); }
  };
  $("#del") && ($("#del").onclick = async () => {
    if (!(await modal({ title: "글을 삭제할까요?", body: `<p>사이트에서 바로 사라집니다. 이미 보낸 뉴스레터 속 링크는 '글을 찾을 수 없음'으로 열립니다.</p>`, confirmText: "삭제", danger: true }))) return;
    await api.deletePost(p.id);
    toast("삭제했습니다.");
    go("#/posts");
  });
}

/* ------------------------------------------------------------------ */
/*  구독자                                                              */
/* ------------------------------------------------------------------ */
async function subscribers() {
  setHeader("구독자", "", `<button class="btn line" id="export">CSV 내보내기</button><button class="btn" id="add">구독자 추가</button>`);
  let list = await api.listSubscribers();
  let q = "", filter = "active";

  view.innerHTML = `
    <div class="panel">
      <div class="toolbar">
        <input class="input" id="q" type="search" placeholder="이메일 또는 이름 검색" aria-label="검색">
        <div class="seg" role="group" aria-label="상태">
          <button aria-pressed="true" data-f="active">구독 중</button>
          <button aria-pressed="false" data-f="unsubscribed">수신거부</button>
          <button aria-pressed="false" data-f="all">전체</button>
        </div>
        <span class="spacer"></span><span id="cnt" style="color:var(--mute);font-size:13px"></span>
      </div>
      <div class="table-wrap"><table class="t">
        <thead><tr><th>이메일</th><th>이름</th><th>상태</th><th class="num">구독일</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table></div>
    </div>`;

  const render = () => {
    const rows = list.filter((s) => (filter === "all" || s.status === filter) &&
      (!q || s.email.includes(q) || (s.name || "").toLowerCase().includes(q)));
    const active = list.filter((s) => s.status === "active").length;
    $("#page-sub").textContent = `구독 중 ${num(active)}명 · 수신거부 ${num(list.length - active)}명`;
    $("#cnt").textContent = `${num(rows.length)}명`;
    $("#rows").innerHTML = rows.slice(0, 500).map((s) => `
      <tr><td>${esc(s.email)}</td><td>${esc(s.name || "–")}</td>
      <td>${s.status === "active" ? `<span class="badge ok">구독 중</span>` : `<span class="badge">수신거부</span>`}</td>
      <td class="num">${fmtDate(s.created_at)}</td>
      <td class="num">
        <button class="btn ghost sm" data-toggle="${s.id}">${s.status === "active" ? "수신거부 처리" : "다시 구독"}</button>
        <button class="btn ghost sm" data-del="${s.id}" style="color:var(--danger)">삭제</button></td></tr>`).join("")
      || `<tr><td colspan="5" class="empty-state">${q ? "검색 결과가 없습니다." : "해당하는 구독자가 없습니다."}</td></tr>`;
  };
  render();

  $("#q").addEventListener("input", debounce((e) => { q = e.target.value.trim().toLowerCase(); render(); }, 150));
  $$(".seg button", view).forEach((b) => b.addEventListener("click", () => {
    $$(".seg button", view).forEach((x) => x.setAttribute("aria-pressed", x === b));
    filter = b.dataset.f; render();
  }));
  $("#rows").addEventListener("click", async (e) => {
    const t = e.target.closest("[data-toggle]"), d = e.target.closest("[data-del]");
    if (t) {
      const s = list.find((x) => x.id === t.dataset.toggle);
      const status = s.status === "active" ? "unsubscribed" : "active";
      await api.updateSubscriber(s.id, { status, unsubscribed_at: status === "active" ? null : new Date().toISOString() });
      s.status = status; render();
      toast(status === "active" ? "다시 구독 상태로 바꿨습니다." : "수신거부 처리했습니다.");
    }
    if (d) {
      const s = list.find((x) => x.id === d.dataset.del);
      if (!(await modal({ title: "구독자를 삭제할까요?", body: `<p>${esc(s.email)}<br>지난 발송 통계에서도 이 사람의 이메일이 보이지 않게 됩니다. 보통은 '수신거부 처리'를 권장합니다.</p>`, confirmText: "삭제", danger: true }))) return;
      await api.deleteSubscriber(s.id);
      list = list.filter((x) => x.id !== s.id); render();
      toast("삭제했습니다.");
    }
  });
  $("#export").onclick = () => downloadCsv(`subscribers-${fmtDate(new Date().toISOString())}.csv`,
    [["이메일", "이름", "상태", "구독일"], ...list.map((s) => [s.email, s.name, s.status === "active" ? "구독 중" : "수신거부", fmtDate(s.created_at)])]);
  $("#add").onclick = async () => {
    const text = await modal({
      title: "구독자 추가",
      body: `<p>한 줄에 한 명씩 <b>이메일, 이름</b> 순서로 붙여넣으세요. 엑셀에서 두 열을 복사해 붙여넣어도 됩니다. 이미 있는 주소는 건너뜁니다.</p>
             <p style="font-size:12px;color:var(--warn);background:var(--warn-soft);padding:8px 10px;border-radius:6px">수신 동의를 받은 분만 추가하세요. 동의 없이 광고성 메일을 보내면 정보통신망법 위반이 될 수 있습니다.</p>`,
      input: { type: "textarea", placeholder: "kim@example.com, 김민준\nlee@example.com, 이서연" },
      confirmText: "추가",
    });
    if (!text) return;
    const rows = text.split(/\r?\n/).map((l) => l.split(/[,\t]/).map((x) => x.trim())).filter(([e]) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ""))
      .map(([email, name]) => ({ email, name }));
    if (!rows.length) return toast("올바른 이메일 주소를 찾지 못했습니다.", true);
    try {
      const added = await api.addSubscribers(rows);
      toast(`${num(added)}명을 추가했습니다.${rows.length - added ? ` (${rows.length - added}명은 이미 있음)` : ""}`);
      list = await api.listSubscribers(); render();
    } catch (err) { toast(err.message, true); }
  };
}

boot();
