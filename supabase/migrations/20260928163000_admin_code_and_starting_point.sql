-- 1) Admin code: a second secret, needed to change the team passcode.
--    The first admin code is set outside this file so it never lands in git.
alter table public.team_account add column admin_code_hash text;

-- Change the team passcode. Needs a logged-in session AND the admin code.
-- Logs out every device, then returns a fresh session for the one that made the change.
create function public.team_change_passcode(
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

  delete from public.team_sessions;
  insert into public.login_attempts (client_key, success) values (v_key, true);

  return jsonb_build_object('ok', true, 'token', private.create_session());
end;
$$;

-- Change the admin code itself. Needs a session and the current admin code.
create function public.team_change_admin_code(
  p_token text, p_current text, p_new text, p_client_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'admin:' || coalesce(nullif(p_client_key, ''), 'unknown');
  v_admin text;
  v_pass text;
begin
  perform private.require_session(p_token);

  if private.rate_limited(v_key) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select admin_code_hash, passcode_hash into v_admin, v_pass from public.team_account where id = 1;
  if v_admin is null then
    return jsonb_build_object('ok', false, 'error', 'no_admin_code');
  end if;

  if extensions.crypt(coalesce(p_current, ''), v_admin) <> v_admin then
    insert into public.login_attempts (client_key, success) values (v_key, false);
    return jsonb_build_object('ok', false, 'error', 'bad_admin_code');
  end if;

  if p_new is null or length(p_new) < 10 or octet_length(p_new) > 72 then
    return jsonb_build_object('ok', false, 'error', 'weak_admin_code');
  end if;

  if extensions.crypt(p_new, v_pass) = v_pass then
    return jsonb_build_object('ok', false, 'error', 'same_as_passcode');
  end if;

  update public.team_account
  set admin_code_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = 1;
  insert into public.login_attempts (client_key, success) values (v_key, true);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.team_change_passcode(text, text, text, text) from public;
revoke all on function public.team_change_admin_code(text, text, text, text) from public;
grant execute on function public.team_change_passcode(text, text, text, text) to anon, authenticated;
grant execute on function public.team_change_admin_code(text, text, text, text) to anon, authenticated;

-- 2) Starting point: how much a part already had on it when the team started counting.
--    Setting it means "as of now, this part has X on it"; sessions after that add on.
--    Logging a change later resets the part to zero as usual.
alter table public.components
  add column start_value numeric check (start_value >= 0 and start_value <= 99999),
  add column start_at timestamptz;

create function public.tracker_set_start(p_token text, p_component uuid, p_value numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_session(p_token);
  update public.components
  set start_value = p_value, start_at = now()
  where id = p_component and not archived and tracking in ('hours', 'weekends');
  if not found then
    raise exception 'part_not_found';
  end if;
end;
$$;

revoke all on function public.tracker_set_start(text, uuid, numeric) from public;
grant execute on function public.tracker_set_start(text, uuid, numeric) to anon, authenticated;

-- tracker_state: same as before, but counting starts from the most recent of
-- (last change, starting point, part added), and a starting point adds its value.
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
      'lastChanged', lc.created_at,
      'lastEntry', le.created_at,
      'used', case c.tracking
        when 'hours' then b.offset_value + (
          select coalesce(sum(e.hours_run), 0) from public.events e
          where e.created_at > b.since)
        when 'weekends' then b.offset_value + (
          select count(*) from public.events e
          where e.event_type = 'race_weekend' and e.created_at > b.since)
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
