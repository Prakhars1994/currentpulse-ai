-- Repair the recurring PDF extraction defect where the two characters backslash+n
-- were stored instead of real line breaks. This is the root cause of public reader
-- artefacts such as `\n\n##`, FASTREAD/WHYINNEWS merging, and stray Markdown.

create or replace function public.cp_normalize_ca_pdf_body(raw text, article_title text)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog','public'
as $$
declare
  src text:=coalesce(raw,'');
  fast text; why text; facts text; pre text; quick text; obj text; mq text; model text; sources text;
  p integer; h text;
begin
  if src='' then return src; end if;
  src:=replace(src,chr(13),'');
  src:=replace(src,chr(127),'•');
  src:=replace(src,chr(160),' ');
  src:=replace(src,E'\\n',E'\n');
  src:=regexp_replace(src,E'[ \t]+\n',E'\n','g');

  src:=replace(src,'MODEL ANSWER (~300 WORDS)','MODEL ANSWER - ~300 WORDS');
  src:=replace(src,'MODEL ANSWER — ABOUT 300 WORDS','MODEL ANSWER - ~300 WORDS');
  src:=replace(src,'MODEL ANSWER - ABOUT 300 WORDS','MODEL ANSWER - ~300 WORDS');

  if position('FAST READ - read only this box if short on time' in src)=0
     or position('WHY IN NEWS' in src)=0
     or position('TOP DATA & FACTS' in src)=0
     or position('PRELIMS' in src)=0
     or position('PROBABLE OBJECTIVE QUESTION' in src)=0
     or position('PROBABLE MAINS QUESTION' in src)=0
     or position('MODEL ANSWER - ~300 WORDS' in src)=0 then
    if position('## FAST READ' in src)>0 and position('## WHY IN NEWS' in src)>0 then return trim(src); end if;
    return src;
  end if;

  fast:=split_part(split_part(src,'FAST READ - read only this box if short on time',2),'WHY IN NEWS',1);
  why:=split_part(split_part(src,'WHY IN NEWS',2),'TOP DATA & FACTS',1);
  facts:=split_part(split_part(src,'TOP DATA & FACTS',2),'PRELIMS',1);
  p:=position(left(coalesce(article_title,''),greatest(12,least(30,length(coalesce(article_title,''))))) in facts);
  if p>0 then facts:=left(facts,p-1); end if;
  pre:=split_part(split_part(src,'PRELIMS',2),'QUICK REVISION',1);
  quick:=split_part(split_part(src,'QUICK REVISION',2),'PROBABLE OBJECTIVE QUESTION',1);
  obj:=split_part(split_part(src,'PROBABLE OBJECTIVE QUESTION',2),'Ask CurrentPulse AI: Prelims',1);
  if obj='' then obj:=split_part(split_part(src,'PROBABLE OBJECTIVE QUESTION',2),'Ask CurrentPulse AI - Prelims',1); end if;
  mq:=split_part(split_part(src,'PROBABLE MAINS QUESTION',2),'MODEL ANSWER - ~300 WORDS',1);
  model:=split_part(split_part(src,'MODEL ANSWER - ~300 WORDS',2),'Ask CurrentPulse AI: Mains',1);
  if model='' then model:=split_part(split_part(src,'MODEL ANSWER - ~300 WORDS',2),'Ask CurrentPulse AI - Mains',1); end if;
  sources:=split_part(src,'SOURCES',2);

  fast:=replace(fast,'• ','- '); why:=replace(why,'• ','- '); facts:=replace(facts,'• ','- ');
  pre:=replace(pre,'• ','- '); quick:=replace(quick,'• ','- '); obj:=replace(obj,'• ','- ');
  model:=replace(model,'• ','- '); sources:=replace(sources,'• ','- ');

  foreach h in array array['INTRODUCTION','SIGNIFICANCE','IMPLEMENTATION GAPS','ANALYTICAL DIMENSIONS','DEEPER ANALYSIS','WAY FORWARD','CONCLUSION','POLICY VALUE','CAUTIONS','ADVANTAGES','ECOLOGICAL RISKS','OPPORTUNITIES','CHALLENGES','INDIA''S INTERESTS','GOVERNANCE GAPS','ECONOMIC ROLE','LIMITATIONS','BENEFITS','WHY REPEAL CAN HELP','RISKS','ECONOMIC AND ECOLOGICAL SIGNIFICANCE','WHY DEVELOPMENT SUPPORTS SECURITY','IMPLEMENTATION CHALLENGES','WHY GUARANTEES CAN WORK','RISKS AND LIMITATIONS','STRATEGIC VALUE','WHY DISTRICT-LEVEL POLICY MATTERS','WHY DEMAND AGGREGATION MATTERS','BARRIERS','WHAT THE NUMBERS SUGGEST','WHY METHODOLOGY MATTERS'] loop
    model:=replace(model,E'\n'||h||E'\n',E'\n### '||h||E'\n');
  end loop;

  obj:=replace(obj,E'\nWhich of the statements given above is/are correct?',E'\n\nWhich of the statements given above is/are correct?');
  obj:=regexp_replace(obj,E'\n\s*\(a\)\s+',E'\n- (a) ','g');
  obj:=regexp_replace(obj,E'\n\s*\(b\)\s+',E'\n- (b) ','g');
  obj:=regexp_replace(obj,E'\n\s*\(c\)\s+',E'\n- (c) ','g');
  obj:=regexp_replace(obj,E'\n\s*\(d\)\s+',E'\n- (d) ','g');
  obj:=regexp_replace(obj,E'\nAnswer:\s*',E'\n\n**Answer:** ','g');
  obj:=regexp_replace(obj,E'\nExplanation:\s*',E'\n\n**Explanation:** ','g');
  sources:=replace(sources,E'10 September\n2026.','10 September 2026.');

  return trim(both E'\n ' from
    '## FAST READ'||E'\n'||trim(fast)||E'\n\n## WHY IN NEWS\n'||trim(why)||E'\n\n## TOP DATA & FACTS\n'||trim(facts)||E'\n\n## PRELIMS\n'||trim(pre)||E'\n\n## QUICK REVISION\n'||trim(quick)||E'\n\n## PROBABLE OBJECTIVE QUESTION\n'||trim(obj)||E'\n\n[Ask CurrentPulse AI: Prelims](https://cp.vliab.workers.dev/ai)'||E'\n\n## PROBABLE MAINS QUESTION\n'||trim(mq)||E'\n\n## MODEL ANSWER (~300 WORDS)\n'||trim(model)||E'\n\n[Ask CurrentPulse AI: Mains](https://cp.vliab.workers.dev/ai)'||E'\n\n## SOURCES\n'||trim(sources)
  );
end;
$$;

-- Keep the audit tolerant of historical storage aliases and decode extraction escapes.
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
 c:=replace(c,E'\\n',E'\n');
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
 if position('## TOP DATA & FACTS' in c)>0 and position('## PRELIMS' in c)>0 then facts:=split_part(split_part(c,'## TOP DATA & FACTS',2),'## PRELIMS',1); facts_bullets:=regexp_count(facts,'(?m)^- '); end if;
 if facts_bullets<6 then f:=array_append(f,'FACT BULLETS '||facts_bullets||'/6'); end if;
 if position('## PRELIMS' in c)>0 and position('## QUICK REVISION' in c)>0 then pre:=split_part(split_part(c,'## PRELIMS',2),'## QUICK REVISION',1); pre_bullets:=regexp_count(pre,'(?m)^- '); end if;
 if pre_bullets<3 then f:=array_append(f,'PRELIMS BULLETS '||pre_bullets||'/3'); end if;
 if position('## QUICK REVISION' in c)>0 and position('## PROBABLE OBJECTIVE QUESTION' in c)>0 then quick:=split_part(split_part(c,'## QUICK REVISION',2),'## PROBABLE OBJECTIVE QUESTION',1); end if;
 if length(trim(quick))<80 then f:=array_append(f,'QUICK REVISION TOO SHORT'); end if;
 if position('## MODEL ANSWER (~300 WORDS)' in c)>0 and position('[Ask CurrentPulse AI: Mains]' in c)>0 then model:=split_part(split_part(c,'## MODEL ANSWER (~300 WORDS)',2),'[Ask CurrentPulse AI: Mains]',1); if length(trim(model))>0 then model_words:=cardinality(regexp_split_to_array(trim(regexp_replace(model,'[^[:alnum:]%]+',' ','g')),'[[:space:]]+')); end if; end if;
 if model_words<250 or model_words>380 then f:=array_append(f,'MAINS WORDS '||model_words||' (250-380)'); end if;
 if position('## SOURCES' in c)>0 then sources:=substring(c from position('## SOURCES' in c)); end if;
 if length(sources)<45 or sources !~* '(PIB|TRAI|MoSPI|Ministry|Government|official|CMLRE|ISA|NITI|RBI|SEBI|ISRO|MEA|MoEFCC|MNRE|Press Information Bureau)' then f:=array_append(f,'OFFICIAL SOURCES'); end if;
 if sources !~* 'https?://' then f:=array_append(f,'SOURCE URL'); end if;
 if c ~* '(Use a measurable implementation framework|Governance lens:|UPSC answer technique:)' then f:=array_append(f,'GENERIC FILLER'); end if;
 return f;
end;
$$;
