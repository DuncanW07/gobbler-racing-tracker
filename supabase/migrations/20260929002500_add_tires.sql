-- Tires: a consumable tracked by engine hours, lighting up all four tires on the car.
insert into public.components (slug, name, part_group, tracking, model_keys, color, sort_order)
select 'tires', 'Tires', 'consumable', 'hours', '{tire-FL,tire-FR,tire-RL,tire-RR}', '#22e5ff', 60
where not exists (select 1 from public.components where slug = 'tires');
