-- Draft how-to guides (shown as "Draft: needs lead tech review" until reviewed).
-- Inserted only for parts that don't have a guide yet, so team edits are never overwritten.
insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- **5W-30** racing oil (Cup spec), about **4.5 qt** with the filter (stock ND number; a cooler or sandwich plate takes more, so go by the dipstick)
- Oil filter **PE01-14-320A**
- New drain plug crush washer
- Drain pan, 17 mm socket for the plug (confirm), filter wrench, funnel, rags, gloves

## Steps
1. Warm the engine for a couple of minutes so the oil drains fully. Shut it off and let it sit a minute.
2. Car on jack stands or a lift, level. Never work under a car held only by a jack.
3. Put the pan under the drain plug, remove the plug, let it drain completely (5 to 10 min).
4. Clean the plug and fit a **new crush washer**. Reinstall the plug.
5. Move the pan under the filter. Remove the old filter; make sure the old rubber gasket came off with it.
6. Wipe the filter mount clean. Put a thin film of fresh oil on the new filter's gasket.
7. Spin the new filter on by hand until the gasket touches, then **3/4 turn more** by hand.
8. Fill with about 4 qt, wait a minute, check the dipstick, then add slowly up to the full mark.
9. Start the engine, idle 30 seconds, check the plug and filter for leaks.
10. Shut off, wait 5 minutes, recheck the dipstick and top up to full.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Drain plug | 23 to 30 ft-lb |
| Oil filter | Hand tight + 3/4 turn |
| Oil filter sandwich plate nut | 35 ft-lb |

## Before you're done
- No drips at the plug or filter after the engine has run
- Dipstick at the full mark
- Old oil and filter go in the team's recycling container
- Log the change in the tracker (the race weekend checklist does it for you)

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance). Capacities and plug torques: Mazda ND 2.0 service data (AMSOIL / Mazda).$g$, false, 'Claude (draft)' from public.components
where slug = 'engine-oil' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- **75W-90** gear oil (Cup spec). Stock ND 6-speed holds about **2.1 L (4.2 pt)**; the Cup pump and cooler loop holds more, so fill by the method below, not by the number
- New drain and fill plug washers (confirm)
- Fluid pump or squeeze bottle with hose, drain pan, rags
- Transmission filter **000-08-5032** (service it each event, replace yearly)

## Steps
1. Car level on stands. A tilted car gives a wrong fill level.
2. **Remove the fill plug first.** If it won't come out, stop: never drain a gearbox you can't refill.
3. Remove the drain plug, drain fully. Wipe the magnet on the plug clean and look at what's on it: fine paste is normal, chunks or flakes mean tell the lead tech.
4. Service the transmission filter on the cooler circuit (clean or replace per the Cup schedule).
5. Reinstall the drain plug with a new washer.
6. Pump oil into the fill hole until it **starts running back out**. That's full.
7. Reinstall the fill plug.
8. Run the car briefly so the cooler pump circulates the oil, then recheck the level at the fill hole and top up.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Drain plug | 29 to 43 ft-lb |
| Fill plug | 30 to 43 ft-lb |

## Before you're done
- Both plugs tight, no drips
- Note anything unusual on the drain plug magnet in the part's history

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance). Capacities and plug torques: Mazda ND 2.0 service data (AMSOIL / Mazda).$g$, false, 'Claude (draft)' from public.components
where slug = 'trans-oil' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- **75W-90** gear oil (Cup spec). Stock ND diff holds about **0.6 L (1.3 pt)**; the Cup pump and cooler add more, so fill to the fill hole
- New plug washers (confirm)
- Fluid pump or squeeze bottle, drain pan, rags
- Differential filter **000-08-5032** (service each event, replace yearly)

## Steps
1. Car level on stands.
2. **Remove the fill plug first.** If it won't come out, don't drain.
3. Remove the drain plug and drain. Check the magnet: fine paste is normal, metal chunks mean tell the lead tech.
4. Service the diff filter on the cooler circuit.
5. Reinstall the drain plug with a new washer.
6. Fill until oil **starts running back out** of the fill hole.
7. Reinstall the fill plug.
8. Run the car briefly so the pump circulates, recheck the level and top up.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Drain plug | Lead tech to confirm |
| Fill plug | Lead tech to confirm |

## Before you're done
- No drips at either plug
- Note anything unusual on the magnet

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance). Capacities and plug torques: Mazda ND 2.0 service data (AMSOIL / Mazda).$g$, false, 'Claude (draft)' from public.components
where slug = 'diff-oil' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- Air filter **PEES-13-3A0**
- Shop vacuum or clean rag
- Flat screwdriver if the clamps need it

## Steps
1. Engine off and cool.
2. Release the clips on the airbox lid and lift the lid.
3. Lift out the old filter. Look at it: oil on it or holes in it mean tell the lead tech.
4. Vacuum or wipe out the bottom of the airbox. Nothing should be left loose inside: anything in there goes into the engine.
5. Drop in the new filter with the rubber edge seated all the way around.
6. Close the lid and snap every clip. Check the duct clamps are tight and the sensor plug is connected.

## Before you're done
- All clips closed, filter edge sealed (no gaps)
- Intake duct clamps tight

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'air-filter' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- Front racing pads (team spec)
- Pad spreader or large C-clamp, needle-nose pliers
- Brake cleaner, rags, torque wrench

## Steps
1. Loosen the lug nuts, raise the car onto stands, remove the wheel.
2. Look at the brake fluid reservoir: pushing the pistons back raises the level. Remove some fluid first if it's near full.
3. On the Brembo 4-piston caliper, remove the clips on the pad pins, slide the pins out and take off the anti-rattle spring.
4. Pull the old pads out. Check them: uneven wear side to side, or cracks, means tell the lead tech.
5. Push all pistons back evenly with the spreader. Don't twist or tilt them.
6. Look at the rotor for a lip, cracks and blue heat spots while it's open.
7. Fit the new pads with the friction side facing the rotor. Reinstall the spring, pins and clips.
8. Refit the wheel and torque the lugs in a star pattern.
9. **Pump the brake pedal until it's firm before moving the car.** The first press goes to the floor.
10. Check the fluid level and top up with the team's brake fluid (DOT 4 or higher).
11. Bed in the pads: several stops from speed, getting harder, without stopping completely, then a cool-down lap.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Wheel lug nuts | 80 ft-lb |
| Front caliper bolts (if removed) | 59 to 74 ft-lb |
| Bleeder screw | 107 to 141 in-lb |

## Before you're done
- Pedal firm, no fluid leaks
- Pins and clips on both sides
- Lugs torqued

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'pads-front' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- Rear racing pads (team spec)
- Caliper piston wind-back tool (confirm: ND rear pistons turn back, they don't just push)
- Brake cleaner, rags, torque wrench

## Steps
1. Loosen the lugs, raise the car onto stands, remove the wheel. Release the parking brake.
2. Check the brake fluid reservoir level; remove some if it's near full.
3. Remove the caliper bolts and lift the caliper off the bracket. Hang it with wire; don't let it hang on the brake hose.
4. Remove the old pads and their clips. Check for uneven wear.
5. Wind the piston back with the tool until it's flush (confirm direction with the lead tech).
6. Check the rotor for a lip, cracks or heat spots.
7. Fit new clips and pads, put the caliper back on and torque the bolts.
8. Refit the wheel and torque the lugs in a star pattern.
9. **Pump the brake pedal until firm before moving the car.**
10. Check the fluid level. Check the parking brake works.
11. Bed in the pads.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Wheel lug nuts | 80 ft-lb |
| Rear caliper bolts | 15 to 18 ft-lb |
| Rear caliper bracket (if removed) | 38 to 48 ft-lb |
| Bleeder screw | 54 to 70 in-lb |

## Before you're done
- Pedal firm, parking brake holds
- Lugs torqued

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'pads-rear' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- New set: BFGoodrich g-Force slicks 215/610R17 on the forged 17x7.5 wheels (Cup spec)
- Torque wrench, socket for the lugs, tire pressure gauge
- Team's cold pressure target: ______ (fill in)

## Steps
1. Loosen all four lugs on each wheel while the car is on the ground.
2. Raise the car onto stands and swap the wheels.
3. Snug the lugs by hand, then lower the car so the tire touches the ground.
4. Torque every lug in a **star pattern** in two passes.
5. Set cold pressures to the team target.
6. After the first session, check hot pressures and adjust. Write them in the car notes.
7. **Retorque the lugs after the first session.**

## Torque specs
| Fastener | Torque |
| --- | --- |
| Wheel lug nuts (16 total) | 80 ft-lb |

## Before you're done
- Every lug torqued twice (now and after the first session)
- Old tires checked for cords, flat spots or cuts before they're stored

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'tires' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- Rotors (grooved, Cup spec), front and/or rear
- New pads are usually fitted at the same time
- Brake cleaner, wire to hang the caliper, torque wrench, impact or screwdriver for the rotor screw

## How to inspect (every race weekend)
- Run a fingernail across the edge: a lip you can catch means it's wearing
- Look for cracks running from the edge, and blue or dark heat spots
- Minimum thickness is stamped on the rotor hat; measure with a micrometer if in doubt

## Steps (replace, post-season)
1. Loosen lugs, raise the car, remove the wheel.
2. Front: remove the two Brembo caliper bolts and hang the caliper with wire. Rear: remove the caliper and then the caliper bracket.
3. Remove the rotor retaining screw (if fitted) and pull off the old rotor.
4. Clean rust off the hub face so the new rotor sits flat.
5. Clean the new rotor with brake cleaner and fit it.
6. Reinstall the bracket, caliper and pads and torque everything.
7. Refit the wheel, torque the lugs, **pump the pedal firm** before moving.
8. Bed in the pads on the new rotors.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Front caliper bolts | 59 to 74 ft-lb |
| Rear caliper bracket | 38 to 48 ft-lb |
| Rear caliper bolts | 15 to 18 ft-lb |
| Wheel lug nuts | 80 ft-lb |

## Before you're done
- Pedal firm, no fluid leaks
- New rotors bedded in

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'rotors' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$Big job. Do the first one with the lead tech.

## What you need
- Clutch disc, pressure plate (and flywheel service per lead tech)
- Clutch alignment tool
- Transmission jack, full socket set, torque wrench, thread locker as specified

## Steps (outline)
1. Car on a lift or tall stands, battery disconnected.
2. Remove the exhaust sections in the way.
3. Remove the driveshaft and the PPF (power plant frame).
4. Remove the shifter from inside the car, disconnect the clutch slave and sensors.
5. Support the transmission on the jack, remove the bellhousing bolts and slide the transmission straight back.
6. Remove the pressure plate bolts evenly, a little at a time, and take off the plate and disc.
7. Inspect the flywheel for heat cracks and glazing. Resurface or replace per lead tech.
8. Fit the new disc (correct side facing the flywheel) on the alignment tool, then the pressure plate. Tighten evenly in a star pattern.
9. Refit the transmission, PPF, driveshaft, exhaust and shifter.
10. Bleed the clutch hydraulics. Check the pedal engagement point.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Driveshaft | 37 to 43 ft-lb |
| PPF, transmission end | 100 to 120 ft-lb |
| PPF, differential end | 121 to 147 ft-lb |
| Pressure plate bolts | Lead tech to confirm |
| Flywheel bolts | Lead tech to confirm |

## Before you're done
- Clutch engages smoothly, no slip on a test drive
- Every PPF and driveshaft bolt torqued

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'clutch' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- Dampers (DSSV two-way adjustable coilovers) and springs per team spec
- Spring compressor only if separating spring and damper (confirm)
- Torque wrench, the team's damper click settings

## How to inspect (every race weekend)
- Oil on the body or shaft means a leaking seal
- Check the top mounts and lower bolts for torque (retorque)
- Look for bent shafts or damaged adjusters

## Steps (replace, post-season)
1. Raise the car onto stands, remove the wheel.
2. Support the lower arm with a jack, remove the lower damper bolt.
3. Remove the top mount nuts and lower the damper out.
4. Fit the new damper, start all nuts and bolts by hand.
5. Torque the top nuts. Torque the **lower bolt with the car at ride height** (on ramps or with the arm jacked to ride height) so the bushing isn't twisted.
6. Set the damper clicks to the team baseline and write them in the car notes.
7. Ride height, corner balance and alignment after any damper change.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Front upper damper nut | 37 to 43 ft-lb |
| Front lower damper bolt | 40 to 47 ft-lb |
| Rear top mount nut | 34 to 40 ft-lb |
| Rear lower damper bolt | 49 to 59 ft-lb |

## Before you're done
- Clicks recorded, alignment booked

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'dampers' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- Control arms with bushings and ball joints (team spec)
- Ball joint separator, torque wrench, new cotter pins or nuts as required

## How to inspect (every race weekend)
- Cracked or torn bushings, grease leaking from ball joint boots
- With the wheel off the ground, pry gently at the joint: any clunk or play means tell the lead tech
- Retorque the mounting bolts

## Steps (replace, post-season)
1. Raise the car onto stands, remove the wheel.
2. Separate the ball joint from the upright.
3. Remove the inner pivot bolts and the arm.
4. Fit the new arm, start the pivot bolts by hand.
5. Connect and torque the ball joint (new cotter pin if used).
6. **Final-tighten the pivot bolts with the car at ride height**, not hanging, or the bushings wear out fast.
7. Alignment after.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Front upper control arm | 40 to 47 ft-lb |
| Other arm and ball joint bolts | Lead tech to confirm |

## Before you're done
- Pivot bolts tightened at ride height
- Alignment booked

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'control-arms' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- Hub and bearing assembly (team spec)
- Torque wrench, large socket for the axle nut (rear), new axle nut
- Brake tools to remove the caliper and rotor

## How to inspect (every race weekend)
- Wheel off the ground: grab it at 12 and 6 o'clock and rock it. Any clunk or play is a worn bearing.
- Spin it: grinding or roughness means replace.

## Steps (replace, post-season)
1. Loosen the rear axle nut while the car is on the ground (rear only).
2. Raise the car, remove the wheel, caliper (hang it) and rotor.
3. Unplug the ABS sensor and remove it.
4. Remove the hub bolts and the old hub. Rear: push the axle out of the hub.
5. Clean the mounting face, fit the new hub, torque the bolts.
6. Refit the ABS sensor, rotor, caliper and wheel.
7. Rear: **new axle nut**, torque with the car on the ground, then stake it.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Hub bolts (front and rear) | 91 to 100 ft-lb |
| Rear axle nut | 175 to 202 ft-lb |
| ABS sensor | 71 to 88 in-lb |
| Wheel lug nuts | 80 ft-lb |

## Before you're done
- No play when rocking the wheel
- ABS light off on startup

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'bearings' and not exists (select 1 from public.part_guides g where g.component_id = components.id);

insert into public.part_guides (component_id, body, reviewed, updated_by)
select id, $g$## What you need
- CV axles (team spec), new axle nuts, new inner circlips
- Pry bar, torque wrench, drain pan (diff oil can leak when the axle comes out)

## How to inspect (every race weekend)
- Torn or leaking boots: grease thrown around the inside of the wheel well
- Grab the axle and twist: clunks or play at the joints mean replace

## Steps (replace, post-season)
1. Loosen the axle nut with the car on the ground.
2. Raise the car, remove the wheel and the axle nut.
3. Push the outer end out of the hub.
4. Pop the inner end out of the diff with a pry bar (short, sharp pull). Catch any diff oil.
5. Fit a new circlip on the new axle, push it into the diff until it clicks.
6. Slide the outer end into the hub, fit a **new axle nut**.
7. Wheel on, car on the ground, torque the axle nut and stake it.
8. Top up the diff oil.

## Torque specs
| Fastener | Torque |
| --- | --- |
| Rear axle nut | 175 to 202 ft-lb |
| Wheel lug nuts | 80 ft-lb |

## Before you're done
- Axle locked into the diff (pull on it: it shouldn't come out)
- Diff oil topped up

Specs: Global MX-5 Cup ND.2 user guide (Flis Performance).$g$, false, 'Claude (draft)' from public.components
where slug = 'axles' and not exists (select 1 from public.part_guides g where g.component_id = components.id);
