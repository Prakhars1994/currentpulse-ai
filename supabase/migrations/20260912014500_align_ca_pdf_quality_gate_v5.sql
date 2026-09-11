-- Keep production Supabase and repository migrations aligned for CurrentPulse CA PDF imports.
-- Quality v5 follows the editorial contract used by the generated PDFs: 6 useful
-- data bullets, 3 dense Prelims bullets, an about-300-word Mains answer, and a
-- clickable official source. Renderer-safe aliases are normalized before audit.

create or replace function public.cp_ca_pdf_quality_failures(body text)
returns text[]
language plpgsql
immutable
set search_path to 'pg_catalog','public'
as $$
declare
 c text:=coalesce(body,''); facts text:=''; pre text:=''; quick text:=''; model text:=''; sources text:='';
 facts_bullets int:=0; pre_bullets int:=0; model_words int:=0; f text[]:=array[]::text[];
begin
 c:=replace(c,'## MAINS QUESTION FOR UPSC','## PROBABLE MAINS QUESTION');
 c:=replace(c,'### ACTIONABLE ROADMAP','### WAY FORWARD');
 c:=replace(c,'### FINAL TAKEAWAY','### CONCLUSION');
 c:=replace(c,'## VERIFIED OFFICIAL REFERENCES','## SOURCES');
 c:=replace(c,'## PROBABLE MAINS QUESTION — UPSC','## PROBABLE MAINS QUESTION');
 c:=replace(c,'### WAY FORWARD — ACTION POINTS','### WAY FORWARD');
 c:=replace(c,'### CONCLUSION — EXAM TAKEAWAY','### CONCLUSION');
 c:=replace(c,'## SOURCES & VERIFICATION','## SOURCES');

 if c not like '%## FAST READ%' then f:=array_append(f,'FAST READ'); end if;
 if c not like '%## WHY IN NEWS%' then f:=array_append(f,'WHY IN NEWS'); end if;
 if c not like '%## TOP DATA & FACTS%' then f:=array_append(f,'TOP DATA & FACTS'); end if;
 if c not like '%## PRELIMS%' then f:=array_append(f,'PRELIMS'); end if;
 if c not like '%## QUICK REVISION%' then f:=array_append(f,'QUICK REVISION'); end if;
 if c not like '%## PROBABLE OBJECTIVE QUESTION%' then f:=array_append(f,'OBJECTIVE QUESTION'); end if;
 if c not like '%PROBABLE MAINS QUESTION%' or c not like '%## MODEL ANSWER (~300 WORDS)%' then f:=array_append(f,'MAINS STRUCTURE'); end if;
 if c not like '%SOURCES%' then f:=array_append(f,'SOURCES'); end if;
 if c not like '%**Answer:**%' or c not like '%**Explanation:**%' then f:=array_append(f,'MCQ ANSWER/EXPLANATION'); end if;
 if not (c like '%(a) %' and c like '%(b) %' and c like '%(c) %' and c like '%(d) %') then f:=array_append(f,'4 MCQ OPTIONS'); end if;
 if c not like '%[Ask CurrentPulse AI: Prelims]%' or c not like '%[Ask CurrentPulse AI: Mains]%' then f:=array_append(f,'AI LINKS'); end if;

 if position('## TOP DATA & FACTS' in c)>0 and position('## PRELIMS' in c)>0 then
   facts:=split_part(split_part(c,'## TOP DATA & FACTS',2),'## PRELIMS',1);
   facts_bullets:=regexp_count(facts,'(?m)^- ');
 end if;
 if facts_bullets<6 then f:=array_append(f,'FACT BULLETS '||facts_bullets||'/6'); end if;

 if position('## PRELIMS' in c)>0 and position('## QUICK REVISION' in c)>0 then
   pre:=split_part(split_part(c,'## PRELIMS',2),'## QUICK REVISION',1);
   pre_bullets:=regexp_count(pre,'(?m)^- ');
 end if;
 if pre_bullets<3 then f:=array_append(f,'PRELIMS BULLETS '||pre_bullets||'/3'); end if;

 if position('## QUICK REVISION' in c)>0 and position('## PROBABLE OBJECTIVE QUESTION' in c)>0 then
   quick:=split_part(split_part(c,'## QUICK REVISION',2),'## PROBABLE OBJECTIVE QUESTION',1);
 end if;
 if length(trim(quick))<80 then f:=array_append(f,'QUICK REVISION TOO SHORT'); end if;

 if position('## MODEL ANSWER (~300 WORDS)' in c)>0 and position('[Ask CurrentPulse AI: Mains]' in c)>0 then
   model:=split_part(split_part(c,'## MODEL ANSWER (~300 WORDS)',2),'[Ask CurrentPulse AI: Mains]',1);
   if length(trim(model))>0 then
     model_words:=cardinality(regexp_split_to_array(trim(regexp_replace(model,'[^[:alnum:]%]+',' ','g')),'[[:space:]]+'));
   end if;
 end if;
 if model_words<250 or model_words>380 then f:=array_append(f,'MAINS WORDS '||model_words||' (250-380)'); end if;

 if position('## SOURCES' in c)>0 then sources:=substring(c from position('## SOURCES' in c)); end if;
 if length(sources)<45 or sources !~* '(PIB|TRAI|MoSPI|Ministry|Government|official|CMLRE|ISA|NITI|RBI|SEBI|ISRO|MEA|MoEFCC|MNRE|Press Information Bureau)' then f:=array_append(f,'OFFICIAL SOURCES'); end if;
 if sources !~* 'https?://' then f:=array_append(f,'SOURCE URL'); end if;
 if c ~* '(Use a measurable implementation framework|Governance lens:|UPSC answer technique:)' then f:=array_append(f,'GENERIC FILLER'); end if;
 return f;
end;
$$;

create or replace function public.cp_normalize_ca_pdf_article_trigger()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public'
as $$
declare extracted_date text; parsed_date date; scored smallint; canonical text; failures text[];
begin
 if coalesce(new.quality_flags,'[]'::jsonb) ? 'ca_pdf_import' then
  canonical:=coalesce(new.content,'');
  if canonical is null or canonical not like '## FAST READ%' then canonical:=public.cp_normalize_ca_pdf_body(coalesce(new.why_news,new.content),new.title); end if;
  canonical:=public.cp_clean_ca_pdf_punctuation(canonical);
  canonical:=replace(canonical,'## MAINS QUESTION FOR UPSC','## PROBABLE MAINS QUESTION');
  canonical:=replace(canonical,'### ACTIONABLE ROADMAP','### WAY FORWARD');
  canonical:=replace(canonical,'### FINAL TAKEAWAY','### CONCLUSION');
  canonical:=replace(canonical,'## VERIFIED OFFICIAL REFERENCES','## SOURCES');
  canonical:=replace(canonical,'## PROBABLE MAINS QUESTION — UPSC','## PROBABLE MAINS QUESTION');
  canonical:=replace(canonical,'### WAY FORWARD — ACTION POINTS','### WAY FORWARD');
  canonical:=replace(canonical,'### CONCLUSION — EXAM TAKEAWAY','### CONCLUSION');
  canonical:=replace(canonical,'## SOURCES & VERIFICATION','## SOURCES');
  canonical:=regexp_replace(canonical,'(?m)^PROBABLE MAINS QUESTION\s*$','## PROBABLE MAINS QUESTION','g');
  canonical:=regexp_replace(canonical,'(?m)^WAY FORWARD\s*$','### WAY FORWARD','g');
  canonical:=regexp_replace(canonical,'(?m)^CONCLUSION\s*$','### CONCLUSION','g');
  canonical:=regexp_replace(canonical,'(?m)^SOURCES\s*$','## SOURCES','g');

  -- Extraction metadata is useful to the importer but must never enter live content.
  canonical:=regexp_replace(canonical,'(?mi)^\s*(?:\[\[CA_(?:START|END)\]\]|CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:.*|CURRENT AFFAIRS\s+[0-9]+)\s*$','','g');
  canonical:=regexp_replace(canonical,'(?mi)^.*Category\s+GS\s+Date\s+Quick rule.*$','','g');
  canonical:=regexp_replace(canonical,E'\n{3,}',E'\n\n','g');

  failures:=public.cp_ca_pdf_quality_failures(canonical);
  scored:=greatest(0,100-cardinality(failures)*15)::smallint;
  new.quality_score:=scored;
  new.quality_version:=5;

  if scored<90 then
   if not(coalesce(new.quality_flags,'[]'::jsonb)?'quality_gate_failed') then
     new.quality_flags:=coalesce(new.quality_flags,'[]'::jsonb) || jsonb_build_array('quality_gate_failed');
   end if;
   if tg_op='INSERT' then
     raise exception 'CA PDF quality gate failed: score % (minimum 90). Failed checks: %',scored,array_to_string(failures,', ');
   end if;
  else
   new.quality_flags:=coalesce(new.quality_flags,'[]'::jsonb)-'quality_gate_failed';
   if not(new.quality_flags?'structure_validated') then
     new.quality_flags:=new.quality_flags || jsonb_build_array('structure_validated');
   end if;
  end if;

  new.content:=public.cp_renderer_safe_ca_markdown(canonical);
  extracted_date:=substring(left(coalesce(new.why_news,''),1400) from '([0-9]{1,2} [A-Z][a-z]{2,8} 20[0-9]{2})');
  if extracted_date is not null then
    begin
      parsed_date:=to_date(extracted_date,'DD Mon YYYY');
      if parsed_date between date '2020-01-01' and current_date+7 then new.published_at:=parsed_date::timestamp+interval '12 hours'; end if;
    exception when others then null;
    end;
  end if;
 end if;
 return new;
end;
$$;
