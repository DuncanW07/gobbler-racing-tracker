
-- Every history entry needs a name (free text, since the team shares one login).
create or replace function public.tracker_log_entry(
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
  if nullif(btrim(coalesce(p_logged_by, '')), '') is null then
    raise exception 'name_required';
  end if;
  if not exists (select 1 from public.components where id = p_component and not archived) then
    raise exception 'part_not_found';
  end if;
  insert into public.usage_log (component_id, action, measurement, cost, logged_by, notes)
  values (p_component, p_action, p_measurement, p_cost,
          btrim(p_logged_by), nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.tracker_log_entry(text, uuid, text, numeric, numeric, text, text) from public;
grant execute on function public.tracker_log_entry(text, uuid, text, numeric, numeric, text, text) to anon, authenticated;
