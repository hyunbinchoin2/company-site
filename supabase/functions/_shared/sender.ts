// 뉴스레터 실제 발송 로직 (send-newsletter, send-scheduled 두 함수가 함께 씀)
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("NEWSLETTER_FROM") ?? "";
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

export function checkConfig() {
  if (!RESEND_API_KEY || !FROM) throw new Error("RESEND_API_KEY 또는 NEWSLETTER_FROM 이 설정되지 않았습니다.");
}

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

// 테스트 메일 한 통 (추적 없음)
export async function sendTest(nl: { id: string; subject: string; html: string }, to: string) {
  checkConfig();
  const fake: Sub = { id: "test", email: to, name: "테스트", token: "test" };
  await resend("/emails", { from: FROM, to: [to], subject: `[테스트] ${nl.subject}`, html: personalize(nl.html, fake, nl.id, false) });
}

// 구독자 전체 발송.
// fromStatuses 상태인 뉴스레터만 'sending' 으로 바꿔 잠근 뒤 보냅니다 (중복 발송 방지).
export async function sendToAll(db: SupabaseClient, newsletterId: string, fromStatuses: string[]) {
  checkConfig();
  const { data: locked } = await db.from("newsletters").update({ status: "sending" })
    .eq("id", newsletterId).in("status", fromStatuses).select("*");
  if (!locked?.length) return { skipped: true, sent: 0, failed: 0 };
  const nl = locked[0];

  const subs: Sub[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("subscribers").select("id,email,name,token")
      .eq("status", "active").order("created_at").range(from, from + 999);
    if (error) throw error;
    subs.push(...(data as Sub[]));
    if (data.length < 1000) break;
  }

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
  return { skipped: false, sent, failed };
}
