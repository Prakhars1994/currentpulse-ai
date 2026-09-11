-- Applied to production Supabase on 11 Sep 2026.
-- Cleans PDF-extraction spaces before punctuation for current and future CA imports.

create or replace function public.cp_clean_ca_pdf_punctuation(body text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(replace(replace(coalesce(body,''), ' .','.'), ' ,',','), ' ;',';'), ' :',':'), ' !','!'), ' ?','?')
$$;

-- The production CA PDF trigger calls cp_clean_ca_pdf_punctuation(content)
-- after canonical section normalization and before deterministic quality scoring.
