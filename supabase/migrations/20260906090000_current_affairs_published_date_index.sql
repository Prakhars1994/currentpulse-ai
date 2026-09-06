-- Current Affairs archives are grouped by the editorial publication date, not ingestion time.
-- These partial indexes keep the date selector and selected-date page bounded to published CA rows.
create index if not exists articles_published_current_affairs_date_idx
  on public.articles (published_at desc, id desc)
  where status = 'published' and published_at is not null;

create index if not exists article_sources_coaching_article_idx
  on public.article_sources (article_id)
  where source_kind = 'coaching';
