
-- Delete a history entry (check / change / issue). Session-checked.
create function public.tracker_delete_entry(p_token text, p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_session(p_token);
  delete from public.usage_log where id = p_entry;
  if not found then
    raise exception 'entry_not_found';
  end if;
end;
$$;

-- Delete a logged session. Its hours stop counting toward every part.
create function public.tracker_delete_session(p_token text, p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_session(p_token);
  delete from public.events where id = p_session;
  if not found then
    raise exception 'session_not_found';
  end if;
end;
$$;

revoke all on function public.tracker_delete_entry(text, uuid) from public;
revoke all on function public.tracker_delete_session(text, uuid) from public;
grant execute on function public.tracker_delete_entry(text, uuid) to anon, authenticated;
grant execute on function public.tracker_delete_session(text, uuid) to anon, authenticated;
