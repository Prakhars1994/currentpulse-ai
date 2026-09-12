-- Keep the repository schema aligned with the production migration applied on 2026-09-12.
-- CA PDF/GitHub automation payloads carry the complete article in content; why_news
-- may intentionally be only a short preview. Always normalize from full content first.

create or replace function public.cp_normalize_ca_pdf_article_trigger()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare extracted_date text; parsed_date date; scored smallint; canonical text; failures text[]; topic_key text; prior_id bigint;
begin
 if coalesce(new.quality_flags,'[]'::jsonb) ? 'ca_pdf_import' then
  if tg_op='INSERT' then
    topic_key:=public.cp_ca_pdf_topic_key(new.title);
    if length(topic_key)>=8 then
      select a.id into prior_id
      from public.articles a
      where a.status='published'
        and coalesce(a.quality_flags,'[]'::jsonb) ? 'ca_pdf_import'
        and public.cp_ca_pdf_topic_key(a.title)=topic_key
        and a.published_at >= coalesce(new.published_at,now()) - interval '7 days'
        and a.published_at <= coalesce(new.published_at,now()) + interval '7 days'
      order by a.published_at desc
      limit 1;
      if prior_id is not null then
        raise exception 'CA PDF duplicate topic/event blocked: % already exists as article % within 7 days', split_part(coalesce(new.title,''),':',1), prior_id;
      end if;
    end if;
  end if;

  canonical:=coalesce(new.content,'');
  if canonical is null or canonical not like '## FAST READ%' then
    canonical:=public.cp_normalize_ca_pdf_body(coalesce(new.content,new.why_news),new.title);
  end if;
  canonical:=replace(canonical,E'\\n',E'\n');
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
  canonical:=regexp_replace(canonical,'(?mi)^\s*(?:\[\[CA_(?:START|END)\]\]|CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:.*|CURRENT AFFAIRS\s+[0-9]+)\s*$','','g');
  canonical:=regexp_replace(canonical,'(?mi)^.*Category\s+GS\s+Date\s+Quick rule.*$','','g');
  canonical:=regexp_replace(canonical,E'\n{3,}',E'\n\n','g');

  failures:=public.cp_ca_pdf_quality_failures(canonical);
  scored:=greatest(0,100-cardinality(failures)*15)::smallint;
  new.quality_score:=scored;
  new.quality_version:=6;
  if scored<90 then
   if not(coalesce(new.quality_flags,'[]'::jsonb)?'quality_gate_failed') then new.quality_flags:=coalesce(new.quality_flags,'[]'::jsonb)||jsonb_build_array('quality_gate_failed'); end if;
   if tg_op='INSERT' then raise exception 'CA PDF quality gate failed: score % (minimum 90). Failed checks: %',scored,array_to_string(failures,', '); end if;
  else
   new.quality_flags:=coalesce(new.quality_flags,'[]'::jsonb)-'quality_gate_failed';
   if not(new.quality_flags?'structure_validated') then new.quality_flags:=new.quality_flags||jsonb_build_array('structure_validated'); end if;
  end if;

  new.content:='CA_TITLE: '||coalesce(new.title,'Current Affairs')||E'\n'||public.cp_renderer_safe_ca_markdown(canonical);
  extracted_date:=substring(left(coalesce(new.why_news,''),1400) from '([0-9]{1,2} [A-Z][a-z]{2,8} 20[0-9]{2})');
  if extracted_date is not null then begin parsed_date:=to_date(extracted_date,'DD Mon YYYY'); if parsed_date between date '2020-01-01' and current_date+7 then new.published_at:=parsed_date::timestamp+interval '12 hours'; end if; exception when others then null; end; end if;
 end if;
 return new;
end;
$function$;
