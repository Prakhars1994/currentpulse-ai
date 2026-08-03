-- CurrentPulse AI image-pipeline migration
-- Safe to run more than once.

alter table if exists public.article_queue
  add column if not exists image_url text;

comment on column public.article_queue.image_url is
  'Image discovered during RSS or trusted-source collection and preserved until publication.';

grant select, insert, update on table public.article_queue to service_role;
