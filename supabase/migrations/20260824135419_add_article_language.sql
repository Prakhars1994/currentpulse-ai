alter table public.articles
  add column if not exists language text not null default 'en';

alter table public.articles
  drop constraint if exists articles_language_check;

alter table public.articles
  add constraint articles_language_check check (language in ('en', 'hi'));

create index if not exists articles_language_status_created_idx
  on public.articles (language, status, created_at desc);

comment on column public.articles.language is
  'ISO 639-1 reader language for independently authored CurrentPulse article content.';
