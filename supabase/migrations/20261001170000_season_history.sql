-- Season so far from real results instead of typed-in starting points:
-- Road Atlanta and Kentucky as logged race weekends, the service done after
-- Kentucky, and the suspension replacement after that. Dates are placeholders
-- (only the order matters); hours are the team's ~5 h per weekend estimate.

-- 1) Start clean: drop the starting-point wear and the test clicks.
update public.components set start_value = null, start_at = null where start_at is not null;
delete from public.usage_log where created_at < '2026-10-01 17:00+00'; -- test entries from setup (all logged as "dw")
delete from public.events where created_at < '2026-10-01 17:00+00';

-- Parts count from the start of the season, not from the day they were added to the tracker.
update public.components set created_at = '2026-08-01 12:00+00' where slug is not null;

-- 2) The two race weekends so far.
insert into public.events (name, event_date, event_type, hours_run, notes, created_at) values
  ('Road Atlanta', '2026-08-16', 'race_weekend', 5, 'Added from team records (date approximate)', '2026-08-16 22:00+00'),
  ('Kentucky',     '2026-09-13', 'race_weekend', 5, 'Added from team records (date approximate)', '2026-09-13 22:00+00');

-- 3) Service after each race weekend: every-weekend parts replaced.
insert into public.usage_log (component_id, action, logged_by, notes, created_at)
select c.id, 'changed', 'Team records', 'Replaced after ' || w.name || ' (added at setup)', w.at
from public.components c
cross join (values ('Road Atlanta', timestamptz '2026-08-17 15:00+00'), ('Kentucky', timestamptz '2026-09-14 15:00+00')) as w(name, at)
where c.due_after_race and not c.archived;

-- Inspections after Kentucky passed (otherwise every inspected part shows "inspection due").
insert into public.usage_log (component_id, action, result, logged_by, notes, created_at)
select c.id, 'checked', 'good', 'Team records', 'Post-Kentucky inspection (added at setup)', '2026-09-14 15:00+00'
from public.components c
where c.inspect_every is not null and not c.archived;

-- 4) Suspension replaced after Kentucky: dampers and control arms start the season count at zero.
insert into public.usage_log (component_id, action, logged_by, notes, created_at)
select c.id, 'changed', 'Team records', 'Suspension assembly replaced (added at setup)', '2026-09-20 15:00+00'
from public.components c
where c.slug in ('dampers', 'control-arms');
