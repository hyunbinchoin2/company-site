// 뉴스레터 메일 템플릿
// 관리자 화면의 미리보기와 실제 발송 메일이 이 함수 하나로 만들어집니다.
// 메일 프로그램(Gmail, Outlook, 네이버메일) 호환을 위해 table 레이아웃 + 인라인 스타일만 씁니다.
//
// 발송 시 서버(Edge Function)가 아래 자리표시자를 수신자별로 바꿉니다.
//   {{NAME}}            수신자 이름 (없으면 "구독자")
//   {{UNSUBSCRIBE_URL}} 수신거부 링크
//   {{OPEN_PIXEL}}      오픈 추적용 1x1 이미지
//   {{SEND_DATE}}       실제 발송하는 날짜 (예: 2026년 10월 27일, 한국 시간)
// 그리고 본문의 모든 http(s) 링크를 클릭 추적 주소로 감쌉니다.
import { postUrl } from "./api.js";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const nl2br = (s = "") => esc(s).replace(/\n/g, "<br>");

export function buildNewsletterHtml({ subject, preheader, intro, posts, company, siteUrl }) {
  const c = company.brandColor || "#A42F2B";
  const ink = "#17191F";
  const text = "#3D414B";
  const mute = "#8B8F99";
  const line = "#E8E9EC";
  const font = "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif";
  const link = (p) => postUrl(p.slug, "&utm_source=newsletter");
  const logo = esc(company.nameEn || company.name);
  const [lead, ...rest] = posts;

  // 대표 글: 큰 이미지 + 제목 + 요약 + 버튼
  const leadBlock = lead ? `
  <tr><td class="px" style="padding:12px 36px 0">
    ${lead.cover_url ? `<a href="${link(lead)}" style="text-decoration:none"><img src="${esc(lead.cover_url)}" width="528" alt="${esc(lead.title)}" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:10px"></a>` : ""}
    <p style="margin:28px 0 10px;font:700 12px/1.6 ${font};color:${c};letter-spacing:1px">${esc(lead.category || "NEWS")}</p>
    <h2 style="margin:0 0 14px;font:800 23px/1.5 ${font};color:${ink};letter-spacing:-0.4px">
      <a href="${link(lead)}" style="color:${ink};text-decoration:none">${esc(lead.title)}</a></h2>
    <p style="margin:0 0 28px;font:400 15px/1.95 ${font};color:${text}">${esc(lead.excerpt || "")}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="border-radius:8px;background:${c}">
        <a href="${link(lead)}" style="display:inline-block;padding:14px 26px;font:700 14px/1 ${font};color:#ffffff;text-decoration:none;letter-spacing:0.2px">자세히 읽기 &nbsp;&rarr;</a>
      </td>
    </tr></table>
  </td></tr>` : "";

  // 나머지 글: 세로로 쌓는 카드 (휴대폰 메일 앱에서도 깨지지 않도록 한 줄 배치를 쓰지 않음)
  const restBlock = rest.length ? `
  <tr><td class="px" style="padding:56px 36px 0">
    <p style="margin:0;font:700 13px/1.6 ${font};color:${ink};letter-spacing:0.5px">함께 읽으면 좋은 글</p>
  </td></tr>
  ${rest.map((p) => `
  <tr><td class="px" style="padding:14px 36px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${line}"><tr>
      <td style="padding:26px 0 6px">
        ${p.cover_url ? `<a href="${link(p)}" style="text-decoration:none"><img src="${esc(p.cover_url)}" width="528" alt="${esc(p.title)}" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:10px;margin:0 0 20px"></a>` : ""}
        ${p.category ? `<p style="margin:0 0 6px;font:700 12px/1.6 ${font};color:${c};letter-spacing:0.5px">${esc(p.category)}</p>` : ""}
        <a href="${link(p)}" style="font:800 18px/1.55 ${font};color:${ink};text-decoration:none;letter-spacing:-0.3px">${esc(p.title)}</a>
        ${p.excerpt ? `<p style="margin:10px 0 0;font:400 14px/1.9 ${font};color:${mute}">${esc(p.excerpt)}</p>` : ""}
        <p style="margin:14px 0 0"><a href="${link(p)}" style="font:700 14px/1.6 ${font};color:${c};text-decoration:none">자세히 읽기 &rarr;</a></p>
      </td>
    </tr></table>
  </td></tr>`).join("")}` : "";

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<style>
  @media (max-width:620px){
    .px{padding-left:22px!important;padding-right:22px!important}
    .wrap{border-radius:0!important}
  }
</style></head>
<body style="margin:0;padding:0;background:#F2F3F5;-webkit-text-size-adjust:100%;word-break:keep-all">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || "")}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F3F5"><tr><td align="center" style="padding:40px 12px">

<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;word-break:keep-all">

  <!-- 머리: 가운데 로고 -->
  <tr><td align="center" style="padding:44px 36px 0">
    <a href="${siteUrl}/?utm_source=newsletter" style="text-decoration:none;font:900 26px/1 ${font};color:${c};letter-spacing:3px">${logo}</a>
    <p style="margin:14px 0 0;font:500 12px/1.6 ${font};color:${mute};letter-spacing:2px">NEWSLETTER &nbsp;·&nbsp; {{SEND_DATE}}</p>
  </td></tr>
  <tr><td class="px" style="padding:32px 36px 0"><div style="height:1px;background:${line};line-height:1px;font-size:0">&nbsp;</div></td></tr>

  <!-- 인사말 -->
  <tr><td class="px" style="padding:36px 36px 20px">
    <p style="margin:0 0 14px;font:700 17px/1.8 ${font};color:${ink};letter-spacing:-0.2px">{{NAME}}님, 안녕하세요.</p>
    <p style="margin:0;font:400 15px/1.95 ${font};color:${text}">${nl2br(intro || "")}</p>
  </td></tr>

  ${leadBlock}
  ${restBlock}

  <!-- 블로그 바로가기 -->
  <tr><td class="px" align="center" style="padding:56px 36px 52px">
    <p style="margin:0 0 18px;font:400 14px/1.8 ${font};color:${mute}">지난 소식은 블로그에서 모두 볼 수 있습니다.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="border:1px solid ${ink};border-radius:8px">
        <a href="${siteUrl}/blog.html?utm_source=newsletter" style="display:inline-block;padding:13px 24px;font:700 14px/1 ${font};color:${ink};text-decoration:none">블로그 바로가기</a>
      </td>
    </tr></table>
  </td></tr>

  <!-- 바닥글 -->
  <tr><td class="px" align="center" style="padding:36px 36px 40px;background:#FAFAFB;border-top:1px solid ${line}">
    <p style="margin:0 0 10px;font:900 15px/1 ${font};color:${c};letter-spacing:2px">${logo}</p>
    <p style="margin:0;font:400 12px/1.9 ${font};color:${mute}">
      (주)${esc(company.name)}${company.ceo ? ` &nbsp;|&nbsp; 대표이사 ${esc(company.ceo)}` : ""}<br>
      ${esc(company.address)}<br>
      TEL ${esc(company.phone)}${company.fax ? ` &nbsp;|&nbsp; FAX ${esc(company.fax)}` : ""} &nbsp;|&nbsp; ${esc(company.email)}
    </p>
    <p style="margin:18px 0 0;font:400 12px/1.9 ${font};color:#A4A8B1">
      본 메일은 ${esc(company.name)} 뉴스레터 수신에 동의하신 분께 발송됩니다.<br>
      더 이상 받지 않으려면 <a href="{{UNSUBSCRIBE_URL}}" style="color:${mute};text-decoration:underline">수신거부</a>를 눌러주세요.
    </p>
  </td></tr>
</table>

</td></tr></table>
{{OPEN_PIXEL}}
</body></html>`;
}

// 미리보기용: 자리표시자를 보기 좋은 값으로 바꿉니다.
export const dateKST = (d = new Date()) =>
  new Date(d).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

// date: 발송한 메일을 다시 볼 때는 실제 발송일, 작성 중에는 오늘 날짜
export function previewHtml(html, name = "홍길동", date = new Date()) {
  return html
    .replaceAll("{{SEND_DATE}}", dateKST(date))
    .replaceAll("{{NAME}}", esc(name))
    .replaceAll("{{UNSUBSCRIBE_URL}}", "#")
    .replaceAll("{{OPEN_PIXEL}}", "");
}
