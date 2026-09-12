create or replace function public.cp_decode_ca_pdf_literal_newlines_trigger()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public'
as $$
begin
  if coalesce(new.quality_flags,'[]'::jsonb) ? 'ca_pdf_import' then
    new.content := replace(coalesce(new.content,''), chr(92)||'n', chr(10));
    new.why_news := replace(coalesce(new.why_news,''), chr(92)||'n', chr(10));
    new.prelims := replace(coalesce(new.prelims,''), chr(92)||'n', chr(10));
    new.mains := replace(coalesce(new.mains,''), chr(92)||'n', chr(10));
  end if;
  return new;
end;
$$;

drop trigger if exists zz_cp_decode_ca_pdf_literal_newlines on public.articles;
create trigger zz_cp_decode_ca_pdf_literal_newlines
before insert or update of content,why_news,prelims,mains,quality_flags on public.articles
for each row execute function public.cp_decode_ca_pdf_literal_newlines_trigger();
