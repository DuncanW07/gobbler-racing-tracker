
-- ---------------------------------------------------------------- tables
-- components: reshaped for the dashboard (table was empty)
alter table public.components
  drop column category,
  drop column tracking_method,
  drop column full_value,
  drop column alert_threshold,
  drop column last_changed_date,
  drop column last_changed_event_id;

alter table public.components
  add column slug text unique,
  add column part_group text not null default 'custom' check (part_group in ('consumable', 'wear', 'custom')),
  add column tracking text not null default 'condition' check (tracking in ('hours', 'weekends', 'measured', 'condition')),
  add column model_keys text[] not null default '{}',
  add column color text not null default '#22e5ff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  add column marker double precision[] check (marker is null or array_length(marker, 1) = 3),
  add column corner text check (corner in ('FL', 'FR', 'RL', 'RR')),
  add column limit_value numeric check (limit_value is null or limit_value > 0),
  add column new_value numeric check (new_value is null or new_value > 0),
  add column sort_order int not null default 1000,
  add column archived boolean not null default false;
alter table public.components add constraint components_name_len check (char_length(name) between 1 and 60);

-- usage_log: issues too, entries don't need an event, text limits
alter table public.usage_log drop constraint usage_log_action_check;
alter table public.usage_log add constraint usage_log_action_check
  check (action in ('checked', 'changed', 'topped_off', 'issue'));
alter table public.usage_log alter column event_id drop not null;
alter table public.usage_log add constraint usage_log_notes_len check (notes is null or char_length(notes) <= 1000);
alter table public.usage_log add constraint usage_log_by_len check (logged_by is null or char_length(logged_by) <= 60);
alter table public.usage_log add constraint usage_log_measurement_range check (measurement is null or (measurement >= 0 and measurement < 100000));
alter table public.usage_log add constraint usage_log_cost_range check (cost is null or (cost >= 0 and cost < 1000000));

-- events (sessions): limits
alter table public.events add constraint events_name_len check (char_length(name) between 1 and 80);
alter table public.events add constraint events_hours_range check (hours_run is null or (hours_run >= 0 and hours_run <= 100));
alter table public.events add constraint events_notes_len check (notes is null or char_length(notes) <= 1000);

-- starting parts
insert into public.components (slug, name, part_group, tracking, model_keys, color, sort_order) values
  ('engine-oil',   'Engine oil',              'consumable', 'hours',     '{oil-pan,engine-block}', '#ffe14d', 10),
  ('trans-oil',    'Transmission oil',        'consumable', 'hours',     '{transmission}',         '#4d8dff', 20),
  ('diff-oil',     'Differential oil',        'consumable', 'hours',     '{differential}',         '#3dff8a', 30),
  ('pads-front',   'Brake pads (front)',      'consumable', 'measured',  '{pad-FL,pad-FR}',        '#ff4fd8', 40),
  ('pads-rear',    'Brake pads (rear)',       'consumable', 'measured',  '{pad-RL,pad-RR}',        '#ff4fd8', 50),
  ('rotors',       'Brake rotors',            'wear',       'measured',  '{rotor-FL,rotor-FR,rotor-RL,rotor-RR}', '#22e5ff', 110),
  ('clutch',       'Clutch',                  'wear',       'hours',     '{clutch}',               '#22e5ff', 120),
  ('engine',       'Engine',                  'wear',       'hours',     '{engine-block,engine-head}', '#ffe14d', 130),
  ('transmission', 'Transmission',            'wear',       'hours',     '{transmission}',         '#4d8dff', 140),
  ('differential', 'Differential',            'wear',       'hours',     '{differential}',         '#3dff8a', 150),
  ('dampers',      'Dampers',                 'wear',       'hours',     '{damper-FL,damper-FR,damper-RL,damper-RR}', '#ff4fd8', 160),
  ('bearings',     'Wheel bearings',          'wear',       'hours',     '{hub-FL,hub-FR,hub-RL,hub-RR}', '#ffe14d', 170),
  ('control-arms', 'Control arms / bushings', 'wear',       'condition', '{arm-upper-FL,arm-upper-FR,arm-upper-RL,arm-upper-RR,arm-lower-FL,arm-lower-FR,arm-lower-RL,arm-lower-RR}', '#22e5ff', 180),
  ('axles',        'Axles / CV joints',       'wear',       'hours',     '{axle-L,axle-R}',        '#3dff8a', 190);

-- ---------------------------------------------------------------- helpers
create function private.require_session(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.team_validate_session(p_token) then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
end;
$$;
revoke all on function private.require_session(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- read
-- Everything the dashboard needs, with usage computed per part:
--   hours:    session hours logged since the last change (or since the part was added)
--   weekends: race weekends logged since then
--   measured: latest measurement
create function public.tracker_state(p_token text)
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
      'lastChanged', lc.created_at,
      'lastEntry', le.created_at,
      'used', case c.tracking
        when 'hours' then (
          select coalesce(sum(e.hours_run), 0) from public.events e
          where e.created_at > coalesce(lc.created_at, c.created_at))
        when 'weekends' then (
          select count(*) from public.events e
          where e.event_type = 'race_weekend' and e.created_at > coalesce(lc.created_at, c.created_at))
        else null end,
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

create function public.tracker_history(p_token text, p_component uuid)
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
      'loggedBy', h.logged_by, 'notes', h.notes, 'at', h.created_at
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
create function public.tracker_log_session(
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
  insert into public.events (name, event_date, event_type, hours_run, notes)
  values (btrim(p_name), p_date, p_type, p_hours, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.tracker_log_entry(
  p_token text, p_component uuid, p_action text, p_measurement numeric,
  p_cost numeric, p_logged_by text, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_session(p_token);
  if not exists (select 1 from public.components where id = p_component and not archived) then
    raise exception 'part_not_found';
  end if;
  insert into public.usage_log (component_id, action, measurement, cost, logged_by, notes)
  values (p_component, p_action, p_measurement, p_cost,
          nullif(btrim(coalesce(p_logged_by, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.tracker_set_limit(
  p_token text, p_component uuid, p_limit numeric, p_new_value numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_session(p_token);
  update public.components
  set limit_value = p_limit, new_value = p_new_value
  where id = p_component and not archived;
  if not found then
    raise exception 'part_not_found';
  end if;
end;
$$;

create function public.tracker_add_part(
  p_token text, p_name text, p_tracking text, p_corner text, p_color text, p_marker double precision[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_session(p_token);
  insert into public.components (name, part_group, tracking, corner, color, marker, sort_order)
  values (btrim(p_name), 'custom', p_tracking, p_corner, p_color, p_marker, 2000)
  returning id into v_id;
  return v_id;
end;
$$;

-- Only parts the team added can be removed. They're archived, not deleted,
-- so their history is kept.
create function public.tracker_remove_part(p_token text, p_component uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_session(p_token);
  update public.components set archived = true
  where id = p_component and part_group = 'custom' and not archived;
  if not found then
    raise exception 'cannot_remove';
  end if;
end;
$$;

-- ---------------------------------------------------------------- access
revoke all on function public.tracker_state(text) from public;
revoke all on function public.tracker_history(text, uuid) from public;
revoke all on function public.tracker_log_session(text, text, date, text, numeric, text) from public;
revoke all on function public.tracker_log_entry(text, uuid, text, numeric, numeric, text, text) from public;
revoke all on function public.tracker_set_limit(text, uuid, numeric, numeric) from public;
revoke all on function public.tracker_add_part(text, text, text, text, text, double precision[]) from public;
revoke all on function public.tracker_remove_part(text, uuid) from public;

grant execute on function public.tracker_state(text) to anon, authenticated;
grant execute on function public.tracker_history(text, uuid) to anon, authenticated;
grant execute on function public.tracker_log_session(text, text, date, text, numeric, text) to anon, authenticated;
grant execute on function public.tracker_log_entry(text, uuid, text, numeric, numeric, text, text) to anon, authenticated;
grant execute on function public.tracker_set_limit(text, uuid, numeric, numeric) to anon, authenticated;
grant execute on function public.tracker_add_part(text, text, text, text, text, double precision[]) to anon, authenticated;
grant execute on function public.tracker_remove_part(text, uuid) to anon, authenticated;
