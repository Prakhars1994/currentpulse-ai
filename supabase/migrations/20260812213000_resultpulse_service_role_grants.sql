-- CurrentPulse / ResultPulse: explicit backend privileges for Data API service_role.
-- Needed when default privileges for newly created public tables are absent.
-- Safe to run repeatedly.

begin;

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.exam_updates to service_role;
grant select, insert, update, delete on table public.notification_subscriptions to service_role;
grant select, insert, update, delete on table public.notification_events to service_role;
grant select, insert, update, delete on table public.notification_deliveries to service_role;

-- Identity-backed bigint primary keys use sequences. Grant only the sequences
-- used by ResultPulse/notification backend inserts, if they exist.
do $$
begin
  if to_regclass('public.exam_updates_id_seq') is not null then
    execute 'grant usage, select on sequence public.exam_updates_id_seq to service_role';
  end if;
  if to_regclass('public.notification_events_id_seq') is not null then
    execute 'grant usage, select on sequence public.notification_events_id_seq to service_role';
  end if;
  if to_regclass('public.notification_deliveries_id_seq') is not null then
    execute 'grant usage, select on sequence public.notification_deliveries_id_seq to service_role';
  end if;
end
$$;

commit;
