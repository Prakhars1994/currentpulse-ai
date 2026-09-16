create or replace function public.submit_mains_answer(
  p_test_type text,
  p_exam text,
  p_subject text,
  p_answer_pdf_path text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_entitlement public.mains_entitlements%rowtype;
  v_attempt_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if coalesce(length(trim(p_test_type)),0) < 2 or coalesce(length(trim(p_exam)),0) < 2 then
    raise exception 'Test type and exam are required';
  end if;
  if p_answer_pdf_path is null
     or p_answer_pdf_path !~ ('^' || v_uid::text || '/[0-9a-fA-F-]{36}\.pdf$') then
    raise exception 'Invalid private answer PDF path';
  end if;

  select * into v_entitlement
  from public.mains_entitlements
  where user_id = v_uid and credits_used < credits_granted
  order by granted_at asc, id asc
  for update skip locked
  limit 1;

  if not found then raise exception 'No test credits available'; end if;

  update public.mains_entitlements
  set credits_used = credits_used + 1
  where id = v_entitlement.id
    and user_id = v_uid
    and credits_used < credits_granted;

  if not found then raise exception 'Credit could not be reserved'; end if;

  insert into public.mains_attempts(
    user_id, entitlement_id, test_type, exam, subject,
    status, answer_pdf_path, submitted_at
  )
  values(
    v_uid, v_entitlement.id, trim(p_test_type), trim(p_exam),
    nullif(trim(p_subject),''),
    'uploaded', p_answer_pdf_path, now()
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.submit_mains_answer(text,text,text,text) from public, anon;
grant execute on function public.submit_mains_answer(text,text,text,text) to authenticated;
