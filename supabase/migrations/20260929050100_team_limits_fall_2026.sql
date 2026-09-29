-- Team limits from the lead tech (Sep 2026). A season is 3 race weekends.

-- New parts: air filter (every weekend) and PPF (inspected every weekend).
insert into public.components (slug, name, part_group, tracking, model_keys, color, sort_order)
select 'air-filter', 'Air filter', 'consumable', 'weekends', '{airbox}', '#b18cff', 35
where not exists (select 1 from public.components where slug = 'air-filter');

insert into public.components (slug, name, part_group, tracking, model_keys, color, sort_order)
select 'ppf', 'PPF', 'wear', 'condition', '{ppf}', '#b18cff', 185
where not exists (select 1 from public.components where slug = 'ppf');

update public.components set name = 'Engine oil & filter' where slug = 'engine-oil';

-- Replaced every race weekend. Test days count too (no racing on used fluid).
update public.components
set tracking = 'weekends', limit_value = 1, new_value = null, count_test_days = true
where slug in ('engine-oil', 'trans-oil', 'diff-oil', 'air-filter', 'tires', 'pads-front', 'pads-rear');

-- Replaced once a season (3 race weekends).
update public.components
set tracking = 'weekends', limit_value = 3, new_value = null, count_test_days = false
where slug in ('rotors', 'clutch', 'dampers', 'control-arms');

-- Inspected after every race weekend: rotors (lip), suspension (inspect and
-- retorque), control arms, PPF (cracks).
update public.components set inspect_every = 1
where slug in ('rotors', 'dampers', 'control-arms', 'ppf');

-- Where the season stands: 2 of 3 race weekends done. Rotors and clutch have
-- run both; the suspension was just replaced, so it starts from zero.
update public.components set start_value = 2, start_at = now() where slug in ('rotors', 'clutch');
update public.components set start_value = 0, start_at = now() where slug in ('dampers', 'control-arms');
