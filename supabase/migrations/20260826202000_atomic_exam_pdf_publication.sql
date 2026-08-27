-- Serialize publication replacement per exam/type so an insert failure rolls
-- back the previous-row update in the same database transaction.
create or replace function public.publish_exam_pdf_atomic(
  p_exam_slug text,
  p_pdf_type text,
  p_title text,
  p_description text,
  p_coverage_start date,
  p_coverage_end date,
  p_file_url text,
  p_storage_path text,
  p_original_filename text,
  p_version text,
  p_published boolean,
  p_created_at timestamptz,
  p_updated_at timestamptz
)
returns table (inserted_id bigint, previous_id bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous_id bigint;
begin
  if p_published then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_exam_slug || ':' || p_pdf_type, 0)
    );

    select id
      into v_previous_id
      from public.exam_pdfs
      where exam_slug = p_exam_slug
        and pdf_type = p_pdf_type
        and published
      for update;

    if v_previous_id is not null then
      update public.exam_pdfs
        set published = false,
            updated_at = p_updated_at
        where id = v_previous_id;
    end if;
  end if;

  insert into public.exam_pdfs (
    exam_slug,
    pdf_type,
    title,
    description,
    coverage_start,
    coverage_end,
    file_url,
    storage_path,
    original_filename,
    version,
    published,
    created_at,
    updated_at
  ) values (
    p_exam_slug,
    p_pdf_type,
    p_title,
    p_description,
    p_coverage_start,
    p_coverage_end,
    p_file_url,
    p_storage_path,
    p_original_filename,
    p_version,
    p_published,
    p_created_at,
    p_updated_at
  ) returning id into inserted_id;

  previous_id := v_previous_id;
  return next;
end;
$$;

revoke execute on function public.publish_exam_pdf_atomic(
  text, text, text, text, date, date, text, text, text, text,
  boolean, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.publish_exam_pdf_atomic(
  text, text, text, text, date, date, text, text, text, text,
  boolean, timestamptz, timestamptz
) to service_role;
