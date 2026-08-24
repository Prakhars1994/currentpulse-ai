-- Restrict public article access to published reads. All publication and admin
-- mutations use the server-side service role and therefore bypass these policies.
alter table public.articles enable row level security;

revoke all on table public.articles from public, anon, authenticated;
grant select on table public.articles to anon, authenticated;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'articles'
  loop
    execute format('drop policy if exists %I on public.articles', policy_name);
  end loop;
end
$$;

create policy "Public can read published articles"
  on public.articles
  for select
  to anon, authenticated
  using (status = 'published');

-- New sign-ups must never acquire an administrative profile. Existing profiles
-- are deliberately left unchanged.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

alter function public.increment_article_views(article_slug text)
  set search_path = public, pg_temp;
revoke all on function public.increment_article_views(text) from public, anon, authenticated;

alter function public.rls_auto_enable()
  set search_path = pg_catalog, pg_temp;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- The status dashboard must never remain permanently "running" after a worker
-- is terminated. New runs also perform this bounded recovery at start-up.
update public.automation_runs
set
  status = 'failed',
  error = coalesce(error, 'Marked failed by stale-run recovery.'),
  completed_at = coalesce(completed_at, now())
where status = 'running'
  and started_at < now() - interval '6 hours';

create index if not exists automation_runs_status_started_idx
  on public.automation_runs (status, started_at);
