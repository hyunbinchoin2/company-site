// 오픈·클릭 추적 함수 (공개 — JWT 검증 끔)
//   오픈:  /track?type=open&n=<뉴스레터ID>&s=<구독자ID>      → 1x1 투명 GIF
//   클릭:  /track?type=click&n=...&s=...&u=<원래 주소>       → 기록 후 원래 주소로 이동
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

// 뉴스레터 본문 캐시 (악용 방지: 메일에 실제로 들어 있던 링크로만 이동)
const htmlCache = new Map<string, string>();
async function newsletterHtml(id: string) {
  if (!htmlCache.has(id)) {
    const { data } = await db.from("newsletters").select("html").eq("id", id).maybeSingle();
    htmlCache.set(id, (data?.html ?? "").replace(/&amp;/g, "&"));
  }
  return htmlCache.get(id)!;
}

const pixel = () =>
  new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;
  const type = q.get("type");
  const n = q.get("n") ?? "";
  const s = q.get("s") ?? "";
  const valid = UUID.test(n) && UUID.test(s);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300);

  if (type === "open") {
    if (valid) await db.from("events").insert({ newsletter_id: n, subscriber_id: s, type: "open", user_agent: ua });
    return pixel();
  }

  if (type === "click") {
    const u = q.get("u") ?? "";
    if (!/^https?:\/\//.test(u)) return new Response("잘못된 링크입니다.", { status: 400 });
    if (valid) {
      const html = await newsletterHtml(n);
      if (!html.includes(u)) return new Response("잘못된 링크입니다.", { status: 400 });
      await db.from("events").insert({ newsletter_id: n, subscriber_id: s, type: "click", url: u, user_agent: ua });
    }
    return new Response(null, { status: 302, headers: { Location: u, "Cache-Control": "no-store" } });
  }

  return new Response("not found", { status: 404 });
});
