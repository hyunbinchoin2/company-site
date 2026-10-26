// 수신거부 함수 (공개 — JWT 검증 끔)
//   GET  /unsubscribe?s=<구독자ID>&t=<토큰>  → 수신거부 처리 후 안내 페이지
//   POST 같은 주소                           → Gmail 등의 "원클릭 수신거부"
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const COMPANY = Deno.env.get("COMPANY_NAME") ?? "뉴스레터";
const SITE_URL = Deno.env.get("SITE_URL") ?? "";
const UUID = /^[0-9a-f-]{36}$/i;
const esc = (x: string) => x.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const page = (title: string, msg: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#F3F4F7;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#141821">
<div style="max-width:440px;margin:12vh auto;padding:36px 32px;background:#fff;border-radius:14px;border:1px solid #E3E6EB">
<p style="margin:0 0 6px;font-weight:800">${COMPANY}</p><h1 style="margin:0 0 12px;font-size:22px">${title}</h1>
<p style="margin:0 0 20px;color:#5B6270;line-height:1.7">${msg}</p>
${SITE_URL ? `<a href="${SITE_URL}" style="color:#1F3FD8">사이트로 가기</a>` : ""}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;
  const s = q.get("s") ?? "", t = q.get("t") ?? "";
  if (!UUID.test(s) || !UUID.test(t)) return page("잘못된 링크입니다", "메일에 있는 수신거부 링크를 다시 눌러주세요.", 400);

  const { data } = await db.from("subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("id", s).eq("token", t).select("email");

  if (req.method === "POST") return new Response("ok");
  if (!data?.length) return page("처리하지 못했습니다", "이미 삭제된 구독 정보이거나 링크가 올바르지 않습니다.", 404);
  return page("수신거부되었습니다", `${esc(data[0].email)} 주소로 더 이상 뉴스레터를 보내지 않습니다. 다시 받고 싶으시면 사이트에서 구독해 주세요.`);
});
