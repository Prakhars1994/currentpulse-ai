do $$
declare ddl text;
begin
  select pg_get_functiondef('public.cp_ca_pdf_quality_failures(text)'::regprocedure) into ddl;
  ddl := replace(
    ddl,
    'if c not like ''%**Answer:**%'' or c not like ''%**Explanation:**%'' then f:=array_append(f,''MCQ ANSWER/EXPLANATION''); end if;',
    'if not (c like ''%**Answer:**%'' or c ~ ''(?m)^Answer:[[:space:]]*'') or not (c like ''%**Explanation:**%'' or c ~ ''(?m)^Explanation:[[:space:]]*'') then f:=array_append(f,''MCQ ANSWER/EXPLANATION''); end if;'
  );
  ddl := replace(
    ddl,
    'if c ~* ''(Use a measurable implementation framework|Governance lens:|UPSC answer technique:)'' then f:=array_append(f,''GENERIC FILLER''); end if;',
    'if c ~* ''(Use a measurable implementation framework|Governance lens:|UPSC answer technique:|Current developments in this area show how a focused policy instrument|The durable policy test is whether implementation produces reliable|Track implementation through public dashboards, independent evaluation and disaggregated outcome indicators)'' then f:=array_append(f,''GENERIC FILLER''); end if;'
  );
  execute ddl;
end $$;
