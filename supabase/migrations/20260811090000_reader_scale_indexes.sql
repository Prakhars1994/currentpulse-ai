-- CurrentPulse AI — 11 Aug 2026 public-read scaling indexes.
-- Safe to run repeatedly.

begin;

create index if not exists articles_status_created_at_idx
  on public.articles (status, created_at desc);

create index if not exists article_sources_kind_article_idx
  on public.article_sources (source_kind, article_id);

create index if not exists article_sources_kind_published_article_idx
  on public.article_sources (source_kind, source_published_at desc, article_id);

create index if not exists article_queue_status_priority_created_idx
  on public.article_queue (status, importance desc, created_at asc);

commit;
