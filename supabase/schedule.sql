-- ============================================================
--  예약 발송 기능 추가 (Supabase > SQL Editor 에서 한 번만 실행)
-- ============================================================

-- 1) 뉴스레터에 '예약 시각' 칸과 '예약됨' 상태 추가
alter table public.newsletters add column if not exists scheduled_at timestamptz;
alter table public.newsletters drop constraint if exists newsletters_status_check;
alter table public.newsletters add constraint newsletters_status_check
  check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed'));

-- 2) 발송 내역 화면에서 예약 시각을 보여주도록 통계 뷰 갱신
create or replace view public.newsletter_stats with (security_invoker = true) as
select
  n.id, n.subject, n.status, n.recipient_count, n.sent_at, n.created_at,
  count(distinct e.subscriber_id) filter (where e.type = 'open')  as unique_opens,
  count(*)                        filter (where e.type = 'click') as total_clicks,
  count(distinct e.subscriber_id) filter (where e.type = 'click') as unique_clicks,
  n.scheduled_at
from public.newsletters n
left join public.events e on e.newsletter_id = n.id
group by n.id;
