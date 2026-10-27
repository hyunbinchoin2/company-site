// 뉴스레터 발송 함수
// 관리자 페이지에서 호출합니다. 관리자 로그인 여부를 확인한 뒤
// 구독자마다 이름·수신거부 링크·추적 링크를 넣어 Resend 로 발송합니다.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = Deno.env.get("NEWSLETTER_FROM")!; // 예: "라이트하우스랩 <news@lighthouselab.kr>"
const FN = `${SUPABASE_URL}/functions/v1`;
const BATCH = 100; // Resend batch API 최대 100통

type Sub = { id: string; email: string; name: string | null; token: string };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const unsubUrl = (s: Sub) => `${FN}/unsubscribe?s=${s.id}&t=${s.token}`;

// 메일 상단에 들어갈 발송 날짜 (한국 시간 기준, 예: 2026년 10월 27일)
const sendDate = () =>
  new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

function personalize(html: string, s: Sub, newsletterId: string, track: boolean) {
  let out = html.replaceAll("{{SEND_DATE}}", sendDate());
  if (track) {
    // 본문의 모든 http(s) 링크를 클릭 추적 주소로 감싸기
    out = out.replace(/href="(https?:\/\/[^"]+)"/g, (_m, raw: string) => {
      const url = raw.replace(/&amp;/g, "&");
      return `href="${FN}/track?type=click&n=${newsletterId}&s=${s.id}&u=${encodeURIComponent(url)}"`;
    });
  }
  return out
    .replaceAll("{{NAME}}", escapeHtml(s.name || "구독자"))
    .replaceAll("{{UNSUBSCRIBE_URL}}", track ? unsubUrl(s) : "#")
    .replaceAll(
      "{{OPEN_PIXEL}}",
      track
        ? `<img src="${FN}/track?type=open&n=${newsletterId}&s=${s.id}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">`
        : "",
    );
}

async function resend(path: string, body: unknown) {
  const res = await fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Resend 오류 (${res.status})`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY || !FROM) return json({ error: "RESEND_API_KEY 또는 NEWSLETTER_FROM 이 설정되지 않았습니다." }, 500);

    // 1) 관리자 확인
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "로그인이 필요합니다." }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: admin } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return json({ error: "관리자 권한이 없습니다." }, 403);

    // 2) 뉴스레터 불러오기
    const { newsletter_id, test_email } = await req.json();
    const { data: nl } = await db.from("newsletters").select("*").eq("id", newsletter_id).maybeSingle();
    if (!nl) return json({ error: "뉴스레터를 찾을 수 없습니다." }, 404);
    if (!nl.html) return json({ error: "메일 본문이 비어 있습니다. 임시저장 후 다시 시도하세요." }, 400);

    // 3) 테스트 발송: 추적 없이 한 통
    if (test_email) {
      const fake: Sub = { id: "test", email: test_email, name: "테스트", token: "test" };
      await resend("/emails", { from: FROM, to: [test_email], subject: `[테스트] ${nl.subject}`, html: personalize(nl.html, fake, nl.id, false) });
      return json({ ok: true, sent: 1 });
    }

    // 4) 중복 발송 방지: draft → sending 으로 바꾼 요청만 진행
    const { data: locked } = await db.from("newsletters").update({ status: "sending" })
      .eq("id", nl.id).eq("status", "draft").select("id");
    if (!locked?.length) return json({ error: "이미 발송했거나 발송 중인 뉴스레터입니다." }, 409);

    // 5) 활성 구독자 전체 조회
    const subs: Sub[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("subscribers").select("id,email,name,token")
        .eq("status", "active").order("created_at").range(from, from + 999);
      if (error) throw error;
      subs.push(...(data as Sub[]));
      if (data.length < 1000) break;
    }

    // 6) 100통씩 발송
    let sent = 0, failed = 0;
    try {
      for (let i = 0; i < subs.length; i += BATCH) {
        const chunk = subs.slice(i, i + BATCH);
        const payload = chunk.map((s) => ({
          from: FROM,
          to: [s.email],
          subject: nl.subject,
          html: personalize(nl.html, s, nl.id, true),
          headers: {
            "List-Unsubscribe": `<${unsubUrl(s)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }));
        let rows;
        try {
          const r = await resend("/emails/batch", payload);
          const ids = r?.data ?? [];
          rows = chunk.map((s, k) => ({ newsletter_id: nl.id, subscriber_id: s.id, email: s.email, status: "sent", provider_id: ids[k]?.id ?? null }));
          sent += chunk.length;
        } catch (e) {
          rows = chunk.map((s) => ({ newsletter_id: nl.id, subscriber_id: s.id, email: s.email, status: "failed", error: String((e as Error).message) }));
          failed += chunk.length;
        }
        await db.from("deliveries").upsert(rows, { onConflict: "newsletter_id,email" });
        if (i + BATCH < subs.length) await sleep(600); // Resend 기본 초당 2회 제한
      }
    } finally {
      await db.from("newsletters").update({
        status: sent > 0 ? "sent" : "failed",
        recipient_count: sent,
        sent_at: new Date().toISOString(),
      }).eq("id", nl.id);
    }

    return json({ ok: true, sent, failed });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
