# Rescue Pack mission library: critical design review

## Current prototype update

Fourteen library entries are now playable with Bunny. The Town Library and Sports Center have separate buildings and entrances, and Sheep's six books are collected from three return boxes in the Suburbs, Downtown, and Industrial Yards. Some other mission settings are still mapped to labeled prototype sites in the existing city. The remaining 28 library entries and optional character switching are still drafts. The original collection scatter distances below are content-draft guidance; Sheep's authored three-district route intentionally exceeds that draft radius.

This review accompanies [the 42-mission library](rescue-pack-missions.json). The mission text is a **content draft**, not a claim that every destination, object, pickup, and character is already present in the game. The original mission JSON was recovered from Downloads. The earlier review Markdown was not available, so this document has been regenerated from the request and the current game project.

## Playable-character rule

Bunny is the default playable hero for every mission. Bunny can complete **Fire, Fix, Rescue, and Collect**, and Bunny is the **only** playable hero for Fire. Beaver and Hawk are optional choices on a small set of relevant missions: Beaver on `beaver_02`, `horse_02`, and `beaver_03`; Hawk on `hawk_02`, `crow_02`, and `hawk_03`. Every one of those missions still works with Bunny. `character_id` names the person offering a mission, while `playable_character_ids` names the available heroes. This distinction lets future heroes be added to selected missions without changing the requester or blocking the story.

Panda's `panda_03` is an optional eight-ring practice route. It is included in the 42 missions to preserve the original draft's three entries per character. It has no timer and is not required for story progress.

## Three decisions to make first

1. **Prototype three missions before building all 42.** Pig's burning shed (`pig_01`), Horse's jammed gym doors (`horse_02`), and Sheep's overdue books (`sheep_03`) cover Fire, Fix, and Collect. Add one Rescue next (`bunny_02`) so Bunny's full range is tested. Get these working with Bunny before building optional Beaver and Hawk controls.
2. **Measure routes before finalizing timers and pickup ranges.** The draft uses 180 seconds for Fire and 150 seconds for Fix and Rescue. These are placeholders. Time several actual runs from realistic spawn points, including a wrong turn and the interaction, then set a forgiving limit above the slowest reasonable completion. Collection and the ring route have no timer. The draft collection area is a 10–90 m radius, at least 12 m between items, and at most 140 m path distance back to its center; each value needs a map check.
3. **Give each mission a distinct action or decision.** Fourteen fires with only a different building name will feel repetitive. Vary safe-to-reach locations, number and position of fire spots, clues, route shapes, and follow-up actions. Keep the first implementation small enough to confirm that those differences are fun.

## Current project gaps to resolve

| Risk | What the project currently shows | Needed before a mission is playable |
| --- | --- | --- |
| Destinations | The city has named landmarks such as the school, hospital, town hall, museum, fire station, and town square. Most draft `destination_id` values, such as `sunny_farm`, `town_library`, and `sports_center`, have no mapped point in the current city. | Give each mission a real, reachable point of interest or revise its setting. Do not silently snap unrelated destinations to an existing landmark. |
| Fire objectives | Building fire visuals and per-building fire state exist, with 46 placed fireable buildings. The mission draft also names sheds, kitchens, parks, and other objects that are not established fire targets. | Map each Fire mission to a supported target and implement extinguishing and completion. Use the draft's `arrive_to_resolve` fallback only as a clearly labeled prototype behavior. |
| Fix and Rescue | The draft currently resolves these on arrival. The game has no mission-specific doors, elevator, trapped character, or repair interaction. | Make the arrival trigger clear and reachable. Add the described objects and interactions when those missions advance beyond the prototype. |
| Collection | The draft requests `reachable_ground_navmesh_only`, but the game does not have a collection spawn validator or demonstrated navigation mesh. | Spawn only on tested ground or accessible pavement. Reject roofs, building interiors, water, road traffic lanes, and points behind fences. Verify that Bunny can reach every pickup and return point. |
| Playable heroes | The current game is a firetruck driving scene; the mission roster is not a working character-selection system. | Ship Bunny's four mission types first. Add Beaver and Hawk only as choices on their named missions, with the same objectives and safe fallback. |

## Design and accessibility checks

- Start each timer **after** the player accepts the mission and regains control. Include travel, finding the target, the actual action, and recovery from one mistake. Avoid a red panic countdown for young players; the draft's gentle progress display is a sensible starting point.
- Keep timed failure kind. The original draft has backup characters resolve emergencies safely, without injury or permanent damage. Preserve that result on every timed mission. If a collection is abandoned or an item is unreachable, use its new failure dialogue and safe backup resolution; do not start a hidden collection timer.
- Keep the waypoint, collection marker, and return marker readable from the driver's view. When the last item is collected, guide the player to the actual return destination. Do not assume a radial distance means a short driving route.
- Test the 10–90 m collection ring against the city's boundaries and obstacles. A legal spawn must be reachable by the active playable hero; the minimum 12 m spacing should not scatter items across disconnected areas. Prefer authored pickup locations for the first three missions.
- Treat the Fire, Fix, and Rescue timers as placeholders until the relevant object and interaction exists. A timer based only on drive time will become unfair once an actual firefighting or repair step is added.
- Dialogue should work for pre-readers through voice, icons, and brief on-screen text. `Player` in the original dialogue is a placeholder for the selected hero; resolve that speaker name at runtime, while keeping the requester's lines unchanged.
- Dialogue lines in the mission library now point to transparent portraits in `visuals/processed/`. Requesters use a worried pose for fires and urgent rescues, mild frustration for missing items or broken objects, and a calm or task-specific pose after the outcome. `Player` lines use `sprite_by_playable_character_id` so the portrait follows the selected hero. Dispatcher lines are voice-only and have no character portrait.
- Make the ring route safe and obvious: eight ordered rings on passable roads, a visible next ring, an easy retry, and no mandatory race reward needed to unlock later missions.

## Content follow-up

The library preserves the original 14-character cast, mission IDs, titles, settings, and start and success dialogue. It adds playable-character rules and collection failure dialogue. Several original mission settings do not yet exist in the current city; review these with the map before implementing them. The fastest useful proof is one complete Bunny mission of each core type, followed by a pass over timing, pickup reachability, and mission variety.
