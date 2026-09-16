-- Keep the private Mains answer-sheet cleanup path reproducible.
drop policy if exists "students delete own answer pdf" on storage.objects;
create policy "students delete own answer pdf"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'mains-answer-sheets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Cover membership/evaluation foreign keys used by ownership and dashboard queries.
create index if not exists mains_attempts_entitlement_id_idx on public.mains_attempts(entitlement_id);
create index if not exists mains_attempts_user_id_idx on public.mains_attempts(user_id);
create index if not exists mains_entitlements_product_id_idx on public.mains_entitlements(product_id);
create index if not exists mains_entitlements_user_id_idx on public.mains_entitlements(user_id);
create index if not exists mains_evaluations_user_id_idx on public.mains_evaluations(user_id);
create index if not exists mains_orders_product_id_idx on public.mains_orders(product_id);
create index if not exists mains_orders_user_id_idx on public.mains_orders(user_id);
