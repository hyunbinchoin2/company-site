// 뉴스레터 메일 템플릿
// 관리자 화면의 미리보기와 실제 발송 메일이 이 함수 하나로 만들어집니다.
// 메일 프로그램(Gmail, Outlook, 네이버메일) 호환을 위해 table 레이아웃 + 인라인 스타일만 씁니다.
//
// 발송 시 서버(Edge Function)가 아래 자리표시자를 수신자별로 바꿉니다.
//   {{NAME}}            수신자 이름 (없으면 "구독자")
//   {{UNSUBSCRIBE_URL}} 수신거부 링크
//   {{OPEN_PIXEL}}      오픈 추적용 1x1 이미지
// 그리고 본문의 모든 http(s) 링크를 클릭 추적 주소로 감쌉니다.
import { postUrl } from "./api.js";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const nl2br = (s = "") => esc(s).replace(/\n/g, "<br>");

export function buildNewsletterHtml({ subject, preheader, intro, posts, company, siteUrl }) {
  const c = company.brandColor || "#1F3FD8";
  const font = "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif";
  const link = (p) => postUrl(p.slug, "&utm_source=newsletter");
  const [lead, ...rest] = posts;

  const leadBlock = lead ? `
  <tr><td class="px" style="padding:8px 40px 0">
    ${lead.cover_url ? `<a href="${link(lead)}"><img src="${esc(lead.cover_url)}" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:6px"></a>` : ""}
    ${lead.category ? `<p style="margin:20px 0 6px;font:600 13px/1.4 ${font};color:${c}">${esc(lead.category)}</p>` : `<div style="height:20px"></div>`}
    <h2 style="margin:0 0 10px;font:700 22px/1.4 ${font};color:#141821;letter-spacing:-0.3px">
      <a href="${link(lead)}" style="color:#141821;text-decoration:none">${esc(lead.title)}</a></h2>
    <p style="margin:0 0 20px;font:400 15px/1.7 ${font};color:#4A5160">${esc(lead.excerpt)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:${c}">
      <a href="${link(lead)}" style="display:inline-block;padding:12px 22px;font:600 14px/1 ${font};color:#ffffff;text-decoration:none">전체 글 읽기</a>
    </td></tr></table>
  </td></tr>` : "";

  const restBlock = rest.length ? `
  <tr><td class="px" style="padding:36px 40px 0"><div style="border-top:1px solid #E4E7EC"></div></td></tr>
  ${rest.map((p) => `
  <tr><td class="px" style="padding:24px 40px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${p.cover_url ? `<td width="120" valign="top" style="padding-right:18px"><a href="${link(p)}"><img src="${esc(p.cover_url)}" width="120" alt="" style="display:block;width:120px;height:84px;object-fit:cover;border:0;border-radius:4px"></a></td>` : ""}
      <td valign="top">
        ${p.category ? `<p style="margin:0 0 4px;font:600 12px/1.4 ${font};color:${c}">${esc(p.category)}</p>` : ""}
        <a href="${link(p)}" style="font:700 16px/1.45 ${font};color:#141821;text-decoration:none">${esc(p.title)}</a>
        <p style="margin:6px 0 0;font:400 14px/1.6 ${font};color:#5B6270">${esc(p.excerpt)}</p>
      </td>
    </tr></table>
  </td></tr>`).join("")}` : "";

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<style>@media (max-width:620px){.px{padding-left:20px!important;padding-right:20px!important}}</style><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#EEF0F4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || "")}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F4"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">
  <tr><td style="height:6px;background:${c};font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td class="px" style="padding:28px 40px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font:800 17px/1 ${font};color:#141821;letter-spacing:-0.3px">${esc(company.name)}</td>
      <td align="right" style="font:400 13px/1 ${font};color:#8A909C">${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long" })} 소식</td>
    </tr></table>
  </td></tr>
  <tr><td class="px" style="padding:28px 40px 8px">
    <p style="margin:0 0 12px;font:600 15px/1.6 ${font};color:#141821">{{NAME}}님, 안녕하세요.</p>
    <p style="margin:0;font:400 15px/1.75 ${font};color:#3A404C">${nl2br(intro || "")}</p>
  </td></tr>
  ${leadBlock}
  ${restBlock}
  <tr><td class="px" style="padding:40px 40px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6F8;border-radius:6px"><tr>
      <td style="padding:18px 20px;font:400 14px/1.6 ${font};color:#3A404C">지난 소식은 블로그에서 모두 볼 수 있습니다.</td>
      <td align="right" style="padding:18px 20px"><a href="${siteUrl}/blog.html?utm_source=newsletter" style="font:600 14px/1 ${font};color:${c};text-decoration:none">블로그 가기</a></td>
    </tr></table>
  </td></tr>
  <tr><td class="px" style="padding:32px 40px 36px;font:400 12px/1.7 ${font};color:#8A909C">
    ${esc(company.name)} · ${esc(company.address)}<br>
    문의 ${esc(company.email)} · ${esc(company.phone)}<br>
    이 메일은 ${esc(company.name)} 뉴스레터를 구독하신 분께 발송됩니다.
    <a href="{{UNSUBSCRIBE_URL}}" style="color:#8A909C;text-decoration:underline">수신거부</a>
  </td></tr>
</table>
</td></tr></table>
{{OPEN_PIXEL}}
</body></html>`;
}

// 미리보기용: 자리표시자를 보기 좋은 값으로 바꿉니다.
export function previewHtml(html, name = "홍길동") {
  return html
    .replaceAll("{{NAME}}", esc(name))
    .replaceAll("{{UNSUBSCRIBE_URL}}", "#")
    .replaceAll("{{OPEN_PIXEL}}", "");
}
