alter table public.articles
  add column if not exists image_resolution jsonb;

comment on column public.articles.image_resolution is
  'Durable government/public-domain image resolver provenance and terminal status.';
