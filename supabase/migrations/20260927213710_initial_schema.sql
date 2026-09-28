
-- Events: one row per race weekend or test day
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  event_type text not null check (event_type in ('race_weekend', 'test_day')),
  hours_run numeric(6,1),
  notes text,
  created_at timestamptz not null default now()
);

-- Components: master list of fluids, parts, and systems being tracked
create table components (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('consumable', 'system')),
  tracking_method text not null check (tracking_method in ('measured_wear', 'hours_based', 'weekend_counter')),
  full_value numeric,
  alert_threshold numeric,
  last_changed_date date,
  last_changed_event_id uuid references events(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Usage Log: one row per component checked/changed at a given event
create table usage_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  component_id uuid not null references components(id) on delete cascade,
  action text not null check (action in ('checked', 'changed', 'topped_off')),
  measurement numeric,
  cost numeric(10,2),
  logged_by text,
  notes text,
  created_at timestamptz not null default now()
);
create index usage_log_event_id_idx on usage_log(event_id);
create index usage_log_component_id_idx on usage_log(component_id);

-- Parts & Budget: inventory and reordering
create table parts_budget (
  id uuid primary key default gen_random_uuid(),
  part_name text not null,
  component_id uuid references components(id) on delete set null,
  vendor text,
  unit_cost numeric(10,2),
  quantity_on_hand numeric,
  reorder_threshold numeric,
  photo_url text,
  created_at timestamptz not null default now()
);

-- Lock down direct browser access. All reads/writes go through the app's
-- own server (using the service role key), never the anon key directly.
alter table events enable row level security;
alter table components enable row level security;
alter table usage_log enable row level security;
alter table parts_budget enable row level security;
