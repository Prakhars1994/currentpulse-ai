-- CurrentPulse CA PDF normalization and deterministic quality gate
-- Applied to production Supabase on 11 Sep 2026.
-- Purpose: prevent strict admin PDF imports from publishing repeated page chrome,
-- malformed MCQs, flat Mains sections, or misleading quality_score=100.

create or replace function public.cp_normalize_ca_pdf_body(raw text, article_title text)
returns text
language plpgsql
immutable
as $$
declare
  src text := coalesce(raw,'');
  fast text; why text; facts text; pre text; quick text; obj text;
  mq text; model text; sources text; p integer; h text;
begin
  if src = '' then return src; end if;
  if position('FAST READ - read only this box if short on time' in src)=0
     or position('WHY IN NEWS' in src)=0
     or position('TOP DATA & FACTS' in src)=0
     or position('PRELIMS' in src)=0
     or position('PROBABLE OBJECTIVE QUESTION' in src)=0
     or position('PROBABLE MAINS QUESTION' in src)=0
     or position('MODEL ANSWER - ~300 WORDS' in src)=0 then
    return src;
  end if;

  fast := split_part(split_part(src,'FAST READ - read only this box if short on time',2),'WHY IN NEWS',1);
  why := split_part(split_part(src,'WHY IN NEWS',2),'TOP DATA & FACTS',1);
  facts := split_part(split_part(src,'TOP DATA & FACTS',2),'PRELIMS',1);
  p := position(left(coalesce(article_title,''), greatest(12, least(30,length(coalesce(article_title,''))))) in facts);
  if p > 0 then facts := left(facts,p-1); end if;
  pre := split_part(split_part(src,'PRELIMS',2),'QUICK REVISION',1);
  quick := split_part(split_part(src,'QUICK REVISION',2),'PROBABLE OBJECTIVE QUESTION',1);
  obj := split_part(split_part(src,'PROBABLE OBJECTIVE QUESTION',2),'Ask CurrentPulse AI - Prelims',1);
  mq := split_part(split_part(src,'PROBABLE MAINS QUESTION',2),'MODEL ANSWER - ~300 WORDS',1);
  model := split_part(split_part(src,'MODEL ANSWER - ~300 WORDS',2),'Ask CurrentPulse AI - Mains',1);
  sources := split_part(src,'SOURCES',2);

  fast := replace(fast,'• ', '- '); why := replace(why,'• ', '- ');
  facts := replace(facts,'• ', '- '); pre := replace(pre,'• ', '- ');
  quick := replace(quick,'• ', '- '); obj := replace(obj,'• ', '- ');
  model := replace(model,'• ', '- '); sources := replace(sources,'• ', '- ');

  foreach h in array array['INTRODUCTION','SIGNIFICANCE','IMPLEMENTATION GAPS','ANALYTICAL DIMENSIONS','WAY FORWARD','CONCLUSION','POLICY VALUE','CAUTIONS','ADVANTAGES','ECOLOGICAL RISKS','OPPORTUNITIES','CHALLENGES','INDIA''S INTERESTS','GOVERNANCE GAPS','ECONOMIC ROLE','LIMITATIONS','BENEFITS','WHY REPEAL CAN HELP','RISKS'] loop
    model := replace(model, E'\n'||h||E'\n', E'\n### '||h||E'\n');
  end loop;

  obj := replace(obj,E'\nWhich of the statements given above is/are correct?',E'\n\nWhich of the statements given above is/are correct?');
  obj := replace(obj,E'\n(a) ',E'\n- (a) '); obj := replace(obj,E'\n(b) ',E'\n- (b) ');
  obj := replace(obj,E'\n(c) ',E'\n- (c) '); obj := replace(obj,E'\n(d) ',E'\n- (d) ');
  obj := replace(obj,E'\nAnswer: ',E'\n\n**Answer:** ');
  obj := replace(obj,E'\nExplanation: ',E'\n\n**Explanation:** ');
  sources := replace(sources,E'10 September\n2026.','10 September 2026.');

  return trim(both E'\n ' from
    '## FAST READ' || E'\n' || trim(fast) || E'\n\n' ||
    '## WHY IN NEWS' || E'\n' || trim(why) || E'\n\n' ||
    '## TOP DATA & FACTS' || E'\n' || trim(facts) || E'\n\n' ||
    '## PRELIMS' || E'\n' || trim(pre) || E'\n\n' ||
    '## QUICK REVISION' || E'\n' || trim(quick) || E'\n\n' ||
    '## PROBABLE OBJECTIVE QUESTION' || E'\n' || trim(obj) || E'\n\n' ||
    '[Ask CurrentPulse AI: Prelims](https://cp.vliab.workers.dev/ai)' || E'\n\n' ||
    '## PROBABLE MAINS QUESTION' || E'\n' || trim(mq) || E'\n\n' ||
    '## MODEL ANSWER (~300 WORDS)' || E'\n' || trim(model) || E'\n\n' ||
    '[Ask CurrentPulse AI: Mains](https://cp.vliab.workers.dev/ai)' || E'\n\n' ||
    '## SOURCES' || E'\n' || trim(sources));
end;
$$;

create or replace function public.cp_ca_pdf_quality_score(body text)
returns smallint
language plpgsql
immutable
as $$
declare s integer := 40; c text := coalesce(body,'');
begin
  if c like '%## FAST READ%' then s:=s+5; end if;
  if c like '%## WHY IN NEWS%' then s:=s+5; end if;
  if c like '%## TOP DATA & FACTS%' then s:=s+5; end if;
  if c like '%## PRELIMS%' then s:=s+5; end if;
  if c like '%## PROBABLE OBJECTIVE QUESTION%' then s:=s+5; end if;
  if c like '%**Answer:**%' and c like '%**Explanation:**%' then s:=s+5; end if;
  if c like '%## PROBABLE MAINS QUESTION%' and c like '%## MODEL ANSWER (~300 WORDS)%' then s:=s+10; end if;
  if c like '%[Ask CurrentPulse AI: Prelims]%' and c like '%[Ask CurrentPulse AI: Mains]%' then s:=s+5; end if;
  if c like '%## SOURCES%' then s:=s+5; end if;
  if c not like '%Category GS Date Quick rule%' then s:=s+5; end if;
  if s>100 then s:=100; end if;
  return s::smallint;
end;
$$;

create or replace function public.cp_normalize_ca_pdf_article_trigger()
returns trigger
language plpgsql
as $$
declare extracted_date text; parsed_date date;
begin
  if coalesce(new.quality_flags,'[]'::jsonb) ? 'ca_pdf_import' then
    if new.content is null or new.content not like '## FAST READ%' then
      new.content := public.cp_normalize_ca_pdf_body(coalesce(new.why_news,new.content),new.title);
    end if;
    new.quality_score := public.cp_ca_pdf_quality_score(new.content);
    if new.quality_score < 90 then
      if not (coalesce(new.quality_flags,'[]'::jsonb) ? 'quality_gate_failed') then
        new.quality_flags := coalesce(new.quality_flags,'[]'::jsonb) || '"quality_gate_failed"'::jsonb;
      end if;
    else
      if not (coalesce(new.quality_flags,'[]'::jsonb) ? 'structure_validated') then
        new.quality_flags := coalesce(new.quality_flags,'[]'::jsonb) || '"structure_validated"'::jsonb;
      end if;
    end if;
    extracted_date := substring(left(coalesce(new.why_news,''),1200) from '([0-9]{1,2} [A-Z][a-z]{2} 20[0-9]{2})');
    if extracted_date is not null then
      begin
        parsed_date := to_date(extracted_date,'DD Mon YYYY');
        if parsed_date between date '2020-01-01' and current_date + 7 then
          new.published_at := parsed_date::timestamp + interval '12 hours';
        end if;
      exception when others then null;
      end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cp_normalize_ca_pdf_article on public.articles;
create trigger trg_cp_normalize_ca_pdf_article
before insert or update of content, why_news, quality_flags
on public.articles
for each row
execute function public.cp_normalize_ca_pdf_article_trigger();
