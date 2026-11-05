-- Deploy together with clients that send _syncExpectedUpdatedAt.
-- Existing clients are rejected instead of overwriting a newer snapshot.
create or replace function public.isabela_guard_app_state()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare expected text;
begin
  expected := new.data->>'_syncExpectedUpdatedAt';
  if tg_op = 'UPDATE' then
    if expected is null or expected::timestamptz is distinct from old.updated_at then
      raise exception 'ISABELA_SYNC_CONFLICT' using errcode='P0001';
    end if;
    new.updated_at := greatest(clock_timestamp(),old.updated_at + interval '1 microsecond');
  else
    if expected is not null then
      raise exception 'ISABELA_SYNC_CONFLICT' using errcode='P0001';
    end if;
    new.updated_at := clock_timestamp();
  end if;
  new.data := new.data - '_syncExpectedUpdatedAt';
  return new;
end;
$$;

drop trigger if exists isabela_guard_app_state_trigger on public.app_state;
create trigger isabela_guard_app_state_trigger
before insert or update on public.app_state
for each row execute function public.isabela_guard_app_state();
