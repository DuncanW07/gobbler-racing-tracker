
-- Private schema for helpers that should never be callable through the API
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- The single shared team account (only one row allowed)
create table public.team_account (
  id smallint primary key default 1 check (id = 1),
  passcode_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One-time code required to create the team account
create table public.team_setup_code (
  id smallint primary key default 1 check (id = 1),
  code_hash text not null,
  used_at timestamptz
);

-- Login sessions (only a SHA-256 hash of each session token is stored)
create table public.team_sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Login attempts, used for rate limiting
create table public.login_attempts (
  id bigint generated always as identity primary key,
  client_key text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);
create index login_attempts_time_idx on public.login_attempts (attempted_at);
create index login_attempts_client_idx on public.login_attempts (client_key, attempted_at);

alter table public.team_account enable row level security;
alter table public.team_setup_code enable row level security;
alter table public.team_sessions enable row level security;
alter table public.login_attempts enable row level security;

revoke all on public.team_account, public.team_setup_code, public.team_sessions, public.login_attempts
  from anon, authenticated;

-- Helpers (private)
create function private.rate_limited(p_client_key text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    (select count(*) from public.login_attempts
      where client_key = p_client_key and not success
        and attempted_at > now() - interval '15 minutes') >= 5
    or
    (select count(*) from public.login_attempts
      where not success and attempted_at > now() - interval '15 minutes') >= 50;
$$;

create function private.create_session()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.team_sessions (token_hash, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '30 days');
  delete from public.team_sessions where expires_at < now();
  return v_token;
end;
$$;

-- Public API functions
create function public.team_status()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select case when exists (select 1 from public.team_account) then 'ready' else 'needs_setup' end;
$$;

create function public.team_setup(p_setup_code text, p_passcode text, p_client_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := coalesce(nullif(p_client_key, ''), 'unknown');
  v_code_hash text;
  v_used_at timestamptz;
begin
  if private.rate_limited(v_key) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if exists (select 1 from public.team_account) then
    return jsonb_build_object('ok', false, 'error', 'already_setup');
  end if;

  if p_passcode is null or length(p_passcode) < 10 or octet_length(p_passcode) > 72 then
    return jsonb_build_object('ok', false, 'error', 'weak_passcode');
  end if;

  select code_hash, used_at into v_code_hash, v_used_at
  from public.team_setup_code where id = 1;

  if v_code_hash is null or v_used_at is not null
     or extensions.crypt(coalesce(p_setup_code, ''), v_code_hash) <> v_code_hash then
    insert into public.login_attempts (client_key, success) values (v_key, false);
    return jsonb_build_object('ok', false, 'error', 'bad_setup_code');
  end if;

  insert into public.team_account (passcode_hash)
  values (extensions.crypt(p_passcode, extensions.gen_salt('bf', 10)));
  update public.team_setup_code set used_at = now() where id = 1;
  insert into public.login_attempts (client_key, success) values (v_key, true);

  return jsonb_build_object('ok', true, 'token', private.create_session());
end;
$$;

create function public.team_login(p_passcode text, p_client_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := coalesce(nullif(p_client_key, ''), 'unknown');
  v_hash text;
begin
  delete from public.login_attempts where attempted_at < now() - interval '1 day';

  if private.rate_limited(v_key) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select passcode_hash into v_hash from public.team_account where id = 1;
  if v_hash is null then
    return jsonb_build_object('ok', false, 'error', 'needs_setup');
  end if;

  if extensions.crypt(coalesce(p_passcode, ''), v_hash) = v_hash then
    insert into public.login_attempts (client_key, success) values (v_key, true);
    return jsonb_build_object('ok', true, 'token', private.create_session());
  end if;

  insert into public.login_attempts (client_key, success) values (v_key, false);
  return jsonb_build_object('ok', false, 'error', 'bad_passcode');
end;
$$;

create function public.team_validate_session(p_token text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.team_sessions
    where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and expires_at > now()
  );
$$;

create function public.team_logout(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.team_sessions
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Lock down execution: only the five public functions are callable through the API
revoke all on function private.rate_limited(text) from public, anon, authenticated;
revoke all on function private.create_session() from public, anon, authenticated;

revoke all on function public.team_status() from public;
revoke all on function public.team_setup(text, text, text) from public;
revoke all on function public.team_login(text, text) from public;
revoke all on function public.team_validate_session(text) from public;
revoke all on function public.team_logout(text) from public;

grant execute on function public.team_status() to anon, authenticated;
grant execute on function public.team_setup(text, text, text) to anon, authenticated;
grant execute on function public.team_login(text, text) to anon, authenticated;
grant execute on function public.team_validate_session(text) to anon, authenticated;
grant execute on function public.team_logout(text) to anon, authenticated;
