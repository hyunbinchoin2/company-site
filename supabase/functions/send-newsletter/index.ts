// 뉴스레터 발송 함수 (관리자 페이지에서 호출)
// 관리자 로그인 여부를 확인한 뒤 테스트 메일 또는 전체 발송을 합니다.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { sendTest, sendToAll } from "../_shared/sender.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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
    const { data: nl } = await db.from("newsletters").select("id,subject,html,status").eq("id", newsletter_id).maybeSingle();
    if (!nl) return json({ error: "뉴스레터를 찾을 수 없습니다." }, 404);
    if (!nl.html) return json({ error: "메일 본문이 비어 있습니다. 임시저장 후 다시 시도하세요." }, 400);

    // 3) 테스트 발송
    if (test_email) {
      await sendTest(nl, test_email);
      return json({ ok: true, sent: 1 });
    }

    // 4) 지금 바로 전체 발송 (임시저장·예약 상태 모두 가능)
    const r = await sendToAll(db, nl.id, ["draft", "scheduled"]);
    if (r.skipped) return json({ error: "이미 발송했거나 발송 중인 뉴스레터입니다." }, 409);
    return json({ ok: true, sent: r.sent, failed: r.failed });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
