-- ============================================================
--  뉴스레터 시스템 DB 스키마
--  Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- ============================================================
create extension if not exists pgcrypto;

-- 관리자 목록 ----------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 블로그 글 ------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title        text not null,
  excerpt      text default '',
  cover_url    text default '',
  content      text default '',
  category     text default '',
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 구독자 ---------------------------------------------------------
create table if not exists public.subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name            text default '',
  status          text not null default 'active' check (status in ('active', 'unsubscribed')),
  token           uuid not null default gen_random_uuid(),  -- 수신거부 링크 검증용
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz
);

-- 뉴스레터 -------------------------------------------------------
create table if not exists public.newsletters (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null default '',
  preheader       text default '',
  intro           text default '',
  post_ids        uuid[] not null default '{}',
  html            text default '',            -- 템플릿이 적용된 최종 HTML
  status          text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  recipient_count int not null default 0,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- 수신자별 발송 기록 ------------------------------------------------
create table if not exists public.deliveries (
  id            bigserial primary key,
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  subscriber_id uuid references public.subscribers(id) on delete set null,
  email         text not null,
  status        text not null,           -- sent / failed
  provider_id   text,
  error         text,
  created_at    timestamptz not null default now(),
  unique (newsletter_id, email)
);

-- 오픈·클릭 이벤트 --------------------------------------------------
create table if not exists public.events (
  id            bigserial primary key,
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  subscriber_id uuid references public.subscribers(id) on delete set null,
  type          text not null check (type in ('open', 'click')),
  url           text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index if not exists events_newsletter_idx on public.events (newsletter_id, type);

-- 블로그 조회수 ----------------------------------------------------
create table if not exists public.page_views (
  id         bigserial primary key,
  slug       text not null,
  source     text default 'direct',
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on public.page_views (created_at);

-- 뉴스레터별 통계 뷰 -------------------------------------------------
create or replace view public.newsletter_stats with (security_invoker = true) as
select
  n.id, n.subject, n.status, n.recipient_count, n.sent_at, n.created_at,
  count(distinct e.subscriber_id) filter (where e.type = 'open')  as unique_opens,
  count(*)                        filter (where e.type = 'click') as total_clicks,
  count(distinct e.subscriber_id) filter (where e.type = 'click') as unique_clicks
from public.newsletters n
left join public.events e on e.newsletter_id = n.id
group by n.id;

-- ============================================================
--  RLS (행 단위 보안)
--  - 방문자: 공개 글 읽기, 구독 신청, 조회수 기록만 가능
--  - 관리자: 전부 가능
--  - 발송/추적 Edge Function 은 service_role 키로 RLS 를 우회
-- ============================================================
alter table public.admins      enable row level security;
alter table public.posts       enable row level security;
alter table public.subscribers enable row level security;
alter table public.newsletters enable row level security;
alter table public.deliveries  enable row level security;
alter table public.events      enable row level security;
alter table public.page_views  enable row level security;

drop policy if exists "admins self read" on public.admins;
create policy "admins self read" on public.admins for select using (user_id = auth.uid());

drop policy if exists "posts public read" on public.posts;
create policy "posts public read" on public.posts for select using (published or public.is_admin());
drop policy if exists "posts admin write" on public.posts;
create policy "posts admin write" on public.posts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "subscribers public insert" on public.subscribers;
create policy "subscribers public insert" on public.subscribers for insert to anon, authenticated
  with check (status = 'active');
drop policy if exists "subscribers admin all" on public.subscribers;
create policy "subscribers admin all" on public.subscribers for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "newsletters admin all" on public.newsletters;
create policy "newsletters admin all" on public.newsletters for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "deliveries admin read" on public.deliveries;
create policy "deliveries admin read" on public.deliveries for select using (public.is_admin());

drop policy if exists "events admin read" on public.events;
create policy "events admin read" on public.events for select using (public.is_admin());

drop policy if exists "page_views public insert" on public.page_views;
create policy "page_views public insert" on public.page_views for insert to anon, authenticated
  with check (char_length(slug) < 120 and char_length(coalesce(source, '')) < 60);
drop policy if exists "page_views admin read" on public.page_views;
create policy "page_views admin read" on public.page_views for select using (public.is_admin());

-- 방문자가 token 컬럼을 읽거나 status 를 바꾸지 못하도록 컬럼 권한 제한
revoke all on public.subscribers from anon;
grant insert (email, name) on public.subscribers to anon;

-- ============================================================
--  관리자 등록 (Authentication 에서 사용자를 만든 뒤 실행)
--  insert into public.admins (user_id)
--  select id from auth.users where email = '관리자이메일@회사.com';
-- ============================================================
