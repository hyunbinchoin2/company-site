// 수신거부 함수 (공개 — JWT 검증 끔)
//   GET  /unsubscribe?s=<구독자ID>&t=<토큰>  → 처리 후 사이트의 안내 페이지(unsubscribe.html)로 이동
//   POST 같은 주소                           → Gmail 등의 "원클릭 수신거부"
// Supabase 기본 주소에서는 HTML 화면을 직접 보여줄 수 없어서, 결과는 사이트 페이지로 넘겨 보여줍니다.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const UUID = /^[0-9a-f-]{36}$/i;

const result = (status: "ok" | "fail" | "invalid") =>
  SITE_URL
    ? new Response(null, { status: 302, headers: { Location: `${SITE_URL}/unsubscribe.html?status=${status}` } })
    : new Response(status === "ok" ? "수신거부되었습니다." : "처리하지 못했습니다.", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;
  const s = q.get("s") ?? "", t = q.get("t") ?? "";
  if (!UUID.test(s) || !UUID.test(t)) return req.method === "POST" ? new Response("bad request", { status: 400 }) : result("invalid");

  const { data } = await db.from("subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("id", s).eq("token", t).select("id");

  if (req.method === "POST") return new Response("ok");
  return result(data?.length ? "ok" : "fail");
});
