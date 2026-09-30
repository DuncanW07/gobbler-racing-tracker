-- Every lifespan is in hours now. Parts replaced every race weekend also turn
-- red as soon as a race weekend is logged, while test days still add hours.

alter table public.components add column due_after_race boolean not null default false;

create or replace function public.tracker_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_parts jsonb;
  v_sessions jsonb;
begin
  perform private.require_session(p_token);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'name', c.name,
      'group', c.part_group,
      'tracking', c.tracking,
      'model', to_jsonb(c.model_keys),
      'color', c.color,
      'marker', to_jsonb(c.marker),
      'corner', c.corner,
      'limit', c.limit_value,
      'newValue', c.new_value,
      'countTestDays', c.count_test_days,
      'inspectEvery', c.inspect_every,
      'dueAfterRace', c.due_after_race,
      -- race weekends since the last change (turns every-weekend parts red)
      'racesSince', (select count(*) from public.events e
          where e.event_type = 'race_weekend' and e.created_at > b.since),
      'lastChanged', lc.created_at,
      'lastEntry', le.created_at,
      'lastChecked', lk.created_at,
      -- a check result only counts until the part is changed
      'checkResult', case when lk.created_at > coalesce(lc.created_at, '-infinity') then lk.result end,
      'used', case c.tracking
        when 'hours' then b.offset_value + (
          select coalesce(sum(e.hours_run), 0) from public.events e
          where e.created_at > b.since)
        when 'weekends' then b.offset_value + (
          select count(*) from public.events e
          where (e.event_type = 'race_weekend' or c.count_test_days) and e.created_at > b.since)
        else null end,
      -- weekends run since the last check or change (for the inspection interval)
      'sinceCheck', case when c.inspect_every is not null then (
          select count(*) from public.events e
          where (e.event_type = 'race_weekend' or c.count_test_days)
            and e.created_at > greatest(lk.created_at, lc.created_at, c.created_at))
        end,
      'current', (
        select u.measurement from public.usage_log u
        where u.component_id = c.id and u.measurement is not null
        order by u.created_at desc limit 1)
    ) order by c.sort_order, c.created_at), '[]'::jsonb)
  into v_parts
  from public.components c
  left join lateral (
    select u.created_at from public.usage_log u
    where u.component_id = c.id and u.action = 'changed'
    order by u.created_at desc limit 1) lc on true
  left join lateral (
    select u.created_at from public.usage_log u
    where u.component_id = c.id
    order by u.created_at desc limit 1) le on true
  left join lateral (
    select u.created_at, u.result from public.usage_log u
    where u.component_id = c.id and u.action = 'checked'
    order by u.created_at desc limit 1) lk on true
  cross join lateral (
    select
      case when c.start_at is not null and (lc.created_at is null or c.start_at > lc.created_at)
        then c.start_at else coalesce(lc.created_at, c.created_at) end as since,
      case when c.start_at is not null and (lc.created_at is null or c.start_at > lc.created_at)
        then coalesce(c.start_value, 0) else 0 end as offset_value) b
  where not c.archived;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'date', s.event_date, 'type', s.event_type,
      'hours', s.hours_run, 'notes', s.notes
    ) order by s.event_date desc, s.created_at desc), '[]'::jsonb)
  into v_sessions
  from (select * from public.events order by event_date desc, created_at desc limit 20) s;

  return jsonb_build_object('parts', v_parts, 'sessions', v_sessions);
end;
$$;


-- Sessions need hours (test days count toward lifespans).
create or replace function public.tracker_log_session(
  p_token text, p_name text, p_date date, p_type text, p_hours numeric, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_session(p_token);
  if p_hours is null then
    raise exception 'hours_required';
  end if;
  insert into public.events (name, event_date, event_type, hours_run, notes)
  values (btrim(p_name), p_date, p_type, p_hours, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Schedule: inspection interval, test days (kept for weekend-counted parts), and
-- red-after-race. A null leaves that setting as it was.
drop function public.tracker_set_schedule(text, uuid, int, boolean);
create function public.tracker_set_schedule(
  p_token text, p_component uuid, p_inspect_every int, p_count_test_days boolean,
  p_due_after_race boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_session(p_token);
  update public.components
  set inspect_every = p_inspect_every,
      count_test_days = coalesce(p_count_test_days, count_test_days),
      due_after_race = coalesce(p_due_after_race, due_after_race)
  where id = p_component and not archived;
  if not found then
    raise exception 'part_not_found';
  end if;
end;
$$;
revoke all on function public.tracker_set_schedule(text, uuid, int, boolean, boolean) from public;
grant execute on function public.tracker_set_schedule(text, uuid, int, boolean, boolean) to anon, authenticated;

-- ---------------------------------------------------------------- limits in hours
-- Every race weekend: 6 hours on track, and red after each race weekend.
update public.components
set tracking = 'hours', limit_value = 6, due_after_race = true, count_test_days = false,
    start_value = 0, start_at = now()
where slug in ('engine-oil', 'trans-oil', 'diff-oil', 'air-filter', 'tires', 'pads-front', 'pads-rear');

-- Season parts: 3 race weekends x 6 hours + 2 hours of test days = 20 hours.
update public.components
set tracking = 'hours', limit_value = 20, due_after_race = false, count_test_days = false
where slug in ('rotors', 'clutch', 'dampers', 'control-arms');

-- Where the season stands: rotors and clutch have run 2 race weekends (12 hours);
-- the suspension is new.
update public.components set start_value = 12, start_at = now() where slug in ('rotors', 'clutch');
update public.components set start_value = 0, start_at = now() where slug in ('dampers', 'control-arms');

-- Inspections stay "after every race weekend" (test days don't count toward them).
update public.components set count_test_days = false where inspect_every is not null;
