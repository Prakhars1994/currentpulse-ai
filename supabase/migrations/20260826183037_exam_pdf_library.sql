-- Reusable, public exam PDF library. Writes are service-role only through the
-- authenticated admin API; readers can see published rows only.
create table if not exists public.exam_pdfs (
  id bigint generated always as identity primary key,
  exam_slug text not null check (exam_slug in ('ssc', 'bpsc', 'banking', 'uppcs')),
  pdf_type text not null check (pdf_type in ('yearly-updates', 'mcq')),
  title text not null,
  description text,
  coverage_start date,
  coverage_end date,
  file_url text not null,
  storage_path text not null unique,
  original_filename text not null,
  version text not null default '1.0',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coverage_start is null or coverage_end is null or coverage_start <= coverage_end)
);

create unique index if not exists exam_pdfs_one_current_published_idx
  on public.exam_pdfs (exam_slug, pdf_type) where published;
create index if not exists exam_pdfs_public_listing_idx
  on public.exam_pdfs (exam_slug, pdf_type, updated_at desc) where published;

alter table public.exam_pdfs enable row level security;
drop policy if exists "Public can read published exam PDFs" on public.exam_pdfs;
create policy "Public can read published exam PDFs" on public.exam_pdfs
  for select to anon, authenticated using (published);
grant select on public.exam_pdfs to anon, authenticated;
revoke insert, update, delete on public.exam_pdfs from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exam-pdfs', 'exam-pdfs', true, 26214400, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket reads are explicit; uploads/replacements/deletes remain behind
-- the service-role admin route and therefore need no broad client write policy.
drop policy if exists "Public can download exam PDFs" on storage.objects;
create policy "Public can download exam PDFs" on storage.objects
  for select to anon, authenticated using (bucket_id = 'exam-pdfs');
