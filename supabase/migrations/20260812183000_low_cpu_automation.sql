-- CurrentPulse AI — low-CPU automation hardening (12 Aug 2026).
-- Safe to run repeatedly.

begin;

create index if not exists article_queue_url_idx
  on public.article_queue (url)
  where url is not null;

create index if not exists article_queue_status_updated_idx
  on public.article_queue (status, updated_at desc);

create index if not exists article_queue_status_processing_started_idx
  on public.article_queue (status, processing_started_at)
  where processing_started_at is not null;

alter table if exists public.notification_events
  add column if not exists delivery_offset integer not null default 0;

create index if not exists notification_subscriptions_status_created_idx
  on public.notification_subscriptions (status, created_at asc);

-- Persistent source checkpoints keep ResultPulse from reparsing and rewriting
-- unchanged official pages on every cron invocation. The service role is the
-- only actor that needs access; public readers never touch this table.
create table if not exists public.automation_source_state (
  source_key text primary key,
  source_kind text not null,
  source_id text not null,
  etag text,
  last_modified text,
  content_hash text,
  initialized_at timestamptz,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists automation_source_state_kind_checked_idx
  on public.automation_source_state (source_kind, last_checked_at desc);

alter table public.automation_source_state enable row level security;
revoke all on public.automation_source_state from anon, authenticated;
grant select, insert, update on public.automation_source_state to service_role;

commit;
