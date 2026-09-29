-- Checks feed into status, parts can have an inspection interval, and the
-- whole after-race-weekend service can be logged in one go.

-- ---------------------------------------------------------------- columns
alter table public.components
  -- weekend-counted parts: should test days count as a weekend of use?
  add column count_test_days boolean not null default false,
  -- inspect every N weekends (null = no scheduled inspection)
  add column inspect_every int check (inspect_every is null or inspect_every between 1 and 50);

-- the outcome of a check: good / watch (amber) / replace (red)
alter table public.usage_log
  add column result text check (result in ('good', 'watch', 'replace'));

-- ---------------------------------------------------------------- read
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

create or replace function public.tracker_history(p_token text, p_component uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v jsonb;
begin
  perform private.require_session(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'action', h.action, 'measurement', h.measurement, 'cost', h.cost,
      'loggedBy', h.logged_by, 'notes', h.notes, 'at', h.created_at, 'result', h.result
    ) order by h.created_at desc), '[]'::jsonb)
  into v
  from (
    select * from public.usage_log u where u.component_id = p_component
    order by u.created_at desc limit 100
  ) h;
  return v;
end;
$$;

-- ---------------------------------------------------------------- write
-- Same as before plus an optional check result (only kept on checks).
drop function public.tracker_log_entry(text, uuid, text, numeric, numeric, text, text);
create function public.tracker_log_entry(
  p_token text, p_component uuid, p_action text, p_measurement numeric,
  p_cost numeric, p_logged_by text, p_notes text, p_result text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_session(p_token);
  if nullif(btrim(coalesce(p_logged_by, '')), '') is null then
    raise exception 'name_required';
  end if;
  if not exists (select 1 from public.components where id = p_component and not archived) then
    raise exception 'part_not_found';
  end if;
  insert into public.usage_log (component_id, action, measurement, cost, logged_by, notes, result)
  values (p_component, p_action, p_measurement, p_cost,
          btrim(p_logged_by), nullif(btrim(coalesce(p_notes, '')), ''),
          case when p_action = 'checked' then p_result end)
  returning id into v_id;
  return v_id;
end;
$$;

-- Inspection interval and whether test days count.
create function public.tracker_set_schedule(
  p_token text, p_component uuid, p_inspect_every int, p_count_test_days boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_session(p_token);
  update public.components
  set inspect_every = p_inspect_every, count_test_days = coalesce(p_count_test_days, false)
  where id = p_component and not archived;
  if not found then
    raise exception 'part_not_found';
  end if;
end;
$$;

-- After a race weekend: log every replaced part and every inspection at once.
-- p_checks = [{"id": "<part id>", "result": "good|watch|replace", "notes": "..."}]
create function public.tracker_after_weekend(
  p_token text, p_logged_by text, p_changed uuid[], p_checks jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_by text := nullif(btrim(coalesce(p_logged_by, '')), '');
begin
  perform private.require_session(p_token);
  if v_by is null then
    raise exception 'name_required';
  end if;
  if coalesce(cardinality(p_changed), 0) + coalesce(jsonb_array_length(p_checks), 0) = 0 then
    raise exception 'nothing_selected';
  end if;
  if coalesce(cardinality(p_changed), 0) > 100 or coalesce(jsonb_array_length(p_checks), 0) > 100 then
    raise exception 'too_many';
  end if;

  insert into public.usage_log (component_id, action, logged_by)
  select c.id, 'changed', v_by
  from public.components c
  where c.id = any(coalesce(p_changed, '{}')) and not c.archived;

  insert into public.usage_log (component_id, action, result, logged_by, notes)
  select c.id, 'checked', x.result, v_by, nullif(btrim(coalesce(x.notes, '')), '')
  from jsonb_to_recordset(coalesce(p_checks, '[]'::jsonb)) as x(id uuid, result text, notes text)
  join public.components c on c.id = x.id and not c.archived;
end;
$$;

revoke all on function public.tracker_log_entry(text, uuid, text, numeric, numeric, text, text, text) from public;
revoke all on function public.tracker_set_schedule(text, uuid, int, boolean) from public;
revoke all on function public.tracker_after_weekend(text, text, uuid[], jsonb) from public;
grant execute on function public.tracker_log_entry(text, uuid, text, numeric, numeric, text, text, text) to anon, authenticated;
grant execute on function public.tracker_set_schedule(text, uuid, int, boolean) to anon, authenticated;
grant execute on function public.tracker_after_weekend(text, text, uuid[], jsonb) to anon, authenticated;
