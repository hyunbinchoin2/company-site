// 예약 발송 함수
// Supabase Cron 이 1분마다 호출합니다. 예약 시각이 지난 뉴스레터를 찾아 발송합니다.
// 외부에서 함부로 부르지 못하도록 CRON_SECRET 값이 맞아야만 동작합니다.
import { createClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/cors.ts";
import { sendToAll } from "../_shared/sender.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "forbidden" }, 403);
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: due, error } = await db.from("newsletters").select("id,subject")
    .eq("status", "scheduled").lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at").limit(5);
  if (error) return json({ error: error.message }, 500);

  const results = [];
  for (const nl of due ?? []) {
    try {
      const r = await sendToAll(db, nl.id, ["scheduled"]);
      results.push({ id: nl.id, subject: nl.subject, ...r });
    } catch (e) {
      console.error(e);
      results.push({ id: nl.id, subject: nl.subject, error: String((e as Error).message) });
    }
  }
  return json({ ok: true, checked: due?.length ?? 0, results });
});
