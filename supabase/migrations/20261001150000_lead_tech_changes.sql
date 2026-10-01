-- 1) Fix: changing the passcode failed through the website. The API refuses a
--    DELETE with no WHERE clause, so logging out every device needs "where true".
create or replace function public.team_change_passcode(
  p_token text, p_admin_code text, p_new_passcode text, p_client_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'admin:' || coalesce(nullif(p_client_key, ''), 'unknown');
  v_admin text;
begin
  perform private.require_session(p_token);

  if private.rate_limited(v_key) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select admin_code_hash into v_admin from public.team_account where id = 1;
  if v_admin is null then
    return jsonb_build_object('ok', false, 'error', 'no_admin_code');
  end if;

  if extensions.crypt(coalesce(p_admin_code, ''), v_admin) <> v_admin then
    insert into public.login_attempts (client_key, success) values (v_key, false);
    return jsonb_build_object('ok', false, 'error', 'bad_admin_code');
  end if;

  if p_new_passcode is null or length(p_new_passcode) < 10 or octet_length(p_new_passcode) > 72 then
    return jsonb_build_object('ok', false, 'error', 'weak_passcode');
  end if;

  if extensions.crypt(p_new_passcode, v_admin) = v_admin then
    return jsonb_build_object('ok', false, 'error', 'same_as_admin');
  end if;

  update public.team_account
  set passcode_hash = extensions.crypt(p_new_passcode, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = 1;

  delete from public.team_sessions where true; -- log out every device (the API refuses a bare delete)
  insert into public.login_attempts (client_key, success) values (v_key, true);

  return jsonb_build_object('ok', true, 'token', private.create_session());
end;
$$;


-- 2) Parts, per the lead tech (Oct 2026)
-- Engine is a lifetime part: hidden (history kept).
update public.components set archived = true where slug = 'engine';

-- Seasonal parts count race weekends only (test days never touch them): 3 per season.
update public.components
set tracking = 'weekends', limit_value = 3, new_value = null, count_test_days = false, due_after_race = false
where slug in ('rotors', 'clutch', 'dampers', 'control-arms', 'bearings', 'axles');

-- 2 of 3 race weekends run this season, except the suspension, which was just replaced.
update public.components set start_value = 2, start_at = now() where slug in ('rotors', 'clutch', 'bearings', 'axles');
update public.components set start_value = 0, start_at = now() where slug in ('dampers', 'control-arms');

-- Transmission and diff: no lifespan, inspected for play after every race weekend.
update public.components
set tracking = 'condition', limit_value = null, new_value = null, start_value = null, start_at = null
where slug in ('transmission', 'differential');

-- Inspected after every race weekend.
update public.components set inspect_every = 1
where slug in ('rotors', 'dampers', 'control-arms', 'ppf', 'bearings', 'axles', 'transmission', 'differential');

-- 3) Notes for the whole car
create table public.car_notes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 2000),
  logged_by text not null check (char_length(logged_by) between 1 and 60),
  created_at timestamptz not null default now()
);
alter table public.car_notes enable row level security;
revoke all on public.car_notes from anon, authenticated;

create function public.tracker_add_note(p_token text, p_body text, p_logged_by text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_session(p_token);
  if nullif(btrim(coalesce(p_logged_by, '')), '') is null then raise exception 'name_required'; end if;
  insert into public.car_notes (body, logged_by) values (btrim(p_body), btrim(p_logged_by)) returning id into v_id;
  return v_id;
end; $$;

create function public.tracker_delete_note(p_token text, p_note uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  delete from public.car_notes where id = p_note;
  if not found then raise exception 'note_not_found'; end if;
end; $$;

-- 4) How-to guides, one per part, editable on the site; Draft until reviewed.
create table public.part_guides (
  component_id uuid primary key references public.components(id) on delete cascade,
  body text not null check (char_length(body) <= 20000),
  reviewed boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz
);
alter table public.part_guides enable row level security;
revoke all on public.part_guides from anon, authenticated;

create function public.tracker_guide(p_token text, p_component uuid)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
begin
  perform private.require_session(p_token);
  return (select jsonb_build_object('body', g.body, 'reviewed', g.reviewed, 'updatedBy', g.updated_by,
            'updatedAt', g.updated_at, 'reviewedBy', g.reviewed_by, 'reviewedAt', g.reviewed_at)
          from public.part_guides g where g.component_id = p_component);
end; $$;

create function public.tracker_save_guide(p_token text, p_component uuid, p_body text, p_by text, p_reviewed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_by text := nullif(btrim(coalesce(p_by, '')), '');
begin
  perform private.require_session(p_token);
  if v_by is null then raise exception 'name_required'; end if;
  if not exists (select 1 from public.components where id = p_component and not archived) then raise exception 'part_not_found'; end if;
  insert into public.part_guides as g (component_id, body, reviewed, updated_by, updated_at, reviewed_by, reviewed_at)
  values (p_component, p_body, coalesce(p_reviewed, false), v_by, now(),
          case when p_reviewed then v_by end, case when p_reviewed then now() end)
  on conflict (component_id) do update set
    body = excluded.body, reviewed = excluded.reviewed, updated_by = excluded.updated_by, updated_at = now(),
    reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at;
end; $$;

-- 5) Live backup: after every change the database itself sends a full snapshot to
--    the team's backup spreadsheet (independent of the website being up).
create extension if not exists pg_net;

create table private.backup_config (
  id smallint primary key default 1 check (id = 1),
  url text,        -- where snapshots are sent (the spreadsheet's receiver)
  secret text,     -- shared secret the receiver checks
  sheet_url text   -- link shown on the site
);
insert into private.backup_config (id) values (1);
revoke all on private.backup_config from public, anon, authenticated;

create function private.state_json()
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

  return jsonb_build_object(
    'parts', v_parts,
    'sessions', v_sessions,
    'notes', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'loggedBy', n.logged_by, 'at', n.created_at)
                order by n.created_at desc), '[]'::jsonb)
              from (select * from public.car_notes order by created_at desc limit 30) n),
    'backupUrl', (select sheet_url from private.backup_config where id = 1));
end;
$$;



create or replace function public.tracker_state(p_token text)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
begin
  perform private.require_session(p_token);
  return private.state_json();
end; $$;

-- Everything in one snapshot: part status, every history entry, every session, notes, guides.
create function private.backup_snapshot()
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'at', now(),
    'parts', private.state_json() -> 'parts',
    'history', (select coalesce(jsonb_agg(jsonb_build_object(
        'at', u.created_at, 'part', c.name, 'action', u.action, 'result', u.result, 'measurement', u.measurement,
        'cost', u.cost, 'loggedBy', u.logged_by, 'notes', u.notes) order by u.created_at desc), '[]'::jsonb)
      from public.usage_log u join public.components c on c.id = u.component_id),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object(
        'date', e.event_date, 'name', e.name, 'type', e.event_type, 'hours', e.hours_run, 'notes', e.notes, 'loggedAt', e.created_at)
        order by e.event_date desc, e.created_at desc), '[]'::jsonb) from public.events e),
    'notes', (select coalesce(jsonb_agg(jsonb_build_object('at', n.created_at, 'by', n.logged_by, 'note', n.body)
        order by n.created_at desc), '[]'::jsonb) from public.car_notes n),
    'guides', (select coalesce(jsonb_agg(jsonb_build_object('part', c.name, 'reviewed', g.reviewed, 'by', g.updated_by,
        'updated', g.updated_at, 'guide', g.body) order by c.sort_order), '[]'::jsonb)
      from public.part_guides g join public.components c on c.id = g.component_id)
  );
$$;

create function private.push_backup()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select url, secret into v_url, v_secret from private.backup_config where id = 1;
  if v_url is not null then
    -- async: never slows down or blocks the save itself
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('secret', v_secret, 'data', private.backup_snapshot()),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 20000);
  end if;
  return null;
end; $$;

create trigger backup_events after insert or update or delete on public.events for each statement execute function private.push_backup();
create trigger backup_usage after insert or update or delete on public.usage_log for each statement execute function private.push_backup();
create trigger backup_parts after insert or update or delete on public.components for each statement execute function private.push_backup();
create trigger backup_notes after insert or update or delete on public.car_notes for each statement execute function private.push_backup();
create trigger backup_guides after insert or update or delete on public.part_guides for each statement execute function private.push_backup();

revoke all on function private.state_json() from public, anon, authenticated;
revoke all on function private.backup_snapshot() from public, anon, authenticated;
revoke all on function private.push_backup() from public, anon, authenticated;
revoke all on function public.tracker_add_note(text, text, text) from public;
revoke all on function public.tracker_delete_note(text, uuid) from public;
revoke all on function public.tracker_guide(text, uuid) from public;
revoke all on function public.tracker_save_guide(text, uuid, text, text, boolean) from public;
grant execute on function public.tracker_add_note(text, text, text) to anon, authenticated;
grant execute on function public.tracker_delete_note(text, uuid) to anon, authenticated;
grant execute on function public.tracker_guide(text, uuid) to anon, authenticated;
grant execute on function public.tracker_save_guide(text, uuid, text, text, boolean) to anon, authenticated;
