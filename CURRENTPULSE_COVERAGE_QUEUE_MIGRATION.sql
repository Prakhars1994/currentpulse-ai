-- CurrentPulse coaching coverage queue upgrade.
-- Safe to run more than once in the Supabase SQL Editor.

begin;

alter table public.article_queue
  add column if not exists pipeline_kind text not null default 'news',
  add column if not exists coverage_event_key text,
  add column if not exists coverage_sources jsonb not null default '[]'::jsonb,
  add column if not exists target_article_id bigint references public.articles(id) on delete set null;

alter table public.article_queue
  drop constraint if exists article_queue_pipeline_kind_check;

alter table public.article_queue
  add constraint article_queue_pipeline_kind_check
  check (pipeline_kind in ('news', 'coaching', 'coaching_enrichment'));

create unique index if not exists article_queue_coverage_event_key_unique
  on public.article_queue (coverage_event_key);

create index if not exists article_queue_pipeline_status_idx
  on public.article_queue (pipeline_kind, status, importance desc, created_at asc);

create index if not exists article_queue_target_article_idx
  on public.article_queue (target_article_id)
  where target_article_id is not null;

grant select, insert, update on public.article_queue to service_role;

comment on column public.article_queue.coverage_sources is
  'Complete trusted coaching-source bundle retained until publication or enrichment succeeds.';

comment on column public.article_queue.pipeline_kind is
  'Separates AI news candidates from trusted coaching publication and enrichment jobs.';

commit;

