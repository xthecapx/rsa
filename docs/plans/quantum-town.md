# Quantum Town: one world, two learning adventures

Status: **Implemented; awaiting the user’s playthrough. No tests or builds run.**

## 1. Goal and confirmed decisions

Replace the scenario selection screen with a small, walkable town. Learning adventures begin by interacting with places and people in that world. The first release establishes exploration, doors, conversations, mission acceptance, and returning to an unfinished mission.

Confirmed with the player:

- Both scenarios are available immediately. Recommend the coin lesson without locking RSA.
- RSA takes place directly on the town map, not in a separate street area.
- The coin lesson takes place inside its house, entered through the door.
- Two additional houses have closed doors and short dialogue for now.
- Retain English and Spanish, the shared laptop experience, and simulator-only execution for the coin lesson.
- The user will perform testing. Do not run tests, builds, servers, or automated playthroughs as part of this work unless requested.

## 2. Town layout

Build a compact town that is enjoyable to cross, rather than a large empty world. Reuse the existing pixel-art character, tiles, buildings, cars, and street props where possible. Add a readable coin-house entrance and distinct closed houses using the same visual style.

Conceptual layout, not final tile coordinates:

```text
NORTH
       [Future house A]                [Future house B]
          closed door                    closed door
               |                             |
 [Coin house]--+--------[Town plaza]----------+
  enter door                |                |
                            |       RSA street / learning district
                       [Signpost]   [Ale]──[Junction box]──[Brayan]
                            |                [Client + car]
                       [Town guide]          |
                            +----------------+
                       [Player spawn]
SOUTH
```

The three lesson houses are the coin house and the two future houses. RSA retains its outdoor buildings and wire as part of the same terrain. There is no scene transition at the RSA district boundary.

Use a camera that follows both axes with world bounds. Keep entrances, paths, and interaction prompts readable on desktop and mobile. Reserve most of the screen for the world; show the journal only when opened. Start with paths and nearby objective markers rather than adding a minimap.

## 3. First visit and exploration

1. Spawn the existing player character at the southern entrance, facing into town.
2. Give a short welcome that establishes the player as a newcomer who helps residents solve problems with computing. No character creator in this release.
3. The guide offers to point out the coin house or let the player explore. Highlight the path/house if they accept; do not automatically walk the character there.
4. Walking near a door or character reveals a compact interaction prompt. Dialogue starts only after an explicit interaction.
5. After dismissing the welcome, movement is immediately available. On later visits, restore the player’s location and do not repeat the introduction.

Example copy, to refine during implementation:

| Moment | English | Spanish |
| --- | --- | --- |
| Welcome | Welcome to Quantum Town! People here have problems you can help solve with computing. | ¡Bienvenido a Villa Cuántica! Aquí puedes ayudar a resolver problemas usando computación. |
| First suggestion | Ale and Brayan need to decide who goes first at game night. Start at their house? | Ale y Brayan necesitan decidir quién empieza la noche de juegos. ¿Quieres empezar por su casa? |
| Choices | Show me / I’ll explore | Muéstrame / Voy a explorar |
| RSA declined | No rush. If you want a first challenge, try the coin house by the plaza. | Sin prisa. Si quieres un primer reto, prueba la casa de la moneda junto a la plaza. |
| Future door | This house isn’t open yet. A new challenge will arrive here later. | Esta casa todavía no está abierta. Más adelante encontrarás un nuevo reto aquí. |

Guidance is optional and quiet: a journal suggestion and an in-world marker, not a repeated modal whenever the player approaches. Once the coin lesson is complete, suggest RSA instead. Declining a mission has no penalty.

## 4. Doors, NPCs, and mission flow

### Coin house

- At the door, show the lesson title, beginner difficulty, and Enter / Later; show Resume when a session exists.
- Entering loads the existing walkable room. The table conversation still starts the actual game-night challenge.
- Keep the implemented program puzzle, six-call seed comparison, H/measurement builder, experiments, achievements, and final toss.
- Add a usable exit door plus a Return to town control. Exiting saves the session and places the character immediately outside the entrance, facing away from it.
- Completing the lesson offers returning to town. It does not send the player to the RSA selection screen.
- Re-entry preserves results and progress; replay is an explicit choice and never silently rerolls the final toss.

### RSA on the town map

- Reuse the client/boss as the mission starter, visibly associated with a parked car in the RSA district.
- Interacting shows a short pitch and Accept / Later. Simply loading town or approaching the client never starts an act.
- On acceptance, begin the current RSA act in place. Adapt each opening so the existing prologue and briefing fit this encounter; remove the redundant instruction to find the client immediately after accepting from them.
- Keep Ale, Brayan, the junction box, the wire, packet animations, laptop challenges, reporting, suspicion, and existing backend execution behavior.
- Completing an act returns control to the world. The client offers the next act; no separate mission-selection route is required. Completed acts can be replayed through the client.
- Being caught ends the attempt and offers Retry / Return to exploring. Retry resets the RSA attempt, not the town or coin progress, and does not reload the page.

The client stays in a stable, discoverable location for the first town version. Existing random car colors may remain decorative, but the client should not relocate whenever a scene mounts. The town itself is not subject to suspicion: the meter and its effects apply only to an active RSA attempt.

### Switching activities

Allow one foreground mission at a time, with saved progress for both scenarios. A tracked destination is separate from an active mission: following the coin-house marker does not start its story.

The player can pause RSA and explore or enter the coin house. Suppress RSA story triggers, dialogue, and suspicion while paused. Returning to the client offers Resume. Entering the house pauses the outdoor scene; it must not leave a second engine processing movement or audio underneath it.

During a running computation or scripted sequence, temporarily disable leaving and explain that the current action must finish. Once the result or sequence settles, save a safe checkpoint and allow leaving. Do not silently cancel or repeat a backend operation.

## 5. A consistent game experience

- Keep `GameShell`, dialogue presentation, `LaptopShell`, mute preference, and language preference shared across town and lessons.
- Movement: arrows/WASD on keyboard; touch movement and the existing touch interaction control on mobile. Use the same interaction vocabulary and visible hints in both environments.
- Doors, NPC dialogue, laptop panels, and journal overlays capture input while open. Closing them requires a fresh interaction press, preventing accidental re-entry or skipped dialogue.
- Use a small contextual action label such as Enter, Talk, Resume, or Inspect. Avoid permanent panels listing all scenarios.
- Reuse Objectives as a small journal: current task, discovered lessons, completion, and one tracked destination. It guides walking; it is not a teleport menu.
- Differentiate available, paused, and completed missions with icons and text as well as color. Future doors should look closed, not like broken mission starters.
- Keep movement, transitions, and computation sounds separate so a scene change or resumed result does not play the same sound twice.
- Avoid showing duplicate versions of Ale and Brayan: hide their outdoor actors while the coin interior is active, and stage them for RSA when that story resumes.

All new prompts, journal text, NPC lines, status labels, and error messages need English and Spanish versions. Keep the existing distinction between a software simulation of quantum probabilities and physical quantum randomness.

## 6. Changes required in the current code

The current code has useful reusable pieces, but the street is tied to the RSA story. These are the main integration points:

| Area | Current behavior | Planned change |
| --- | --- | --- |
| `game/app/page.tsx` | Scenario cards | Town entry, first-visit welcome, and saved location restoration |
| `game/engine/createGame.ts` | Boots only the city scene | Boot town independently of missions; preserve the serialized engine lifecycle and custom loading UI |
| `game/engine/scenes/CityScene.ts` | Street terrain, cast, car randomization, and RSA commands together | Extract reusable movement/map behavior and mount the RSA district in a town scene |
| `game/engine/maps/street.ts` | Fixed street dimensions and mutable global landmarks | Map-specific collision, pathfinding, spawn points, and semantic mission anchors |
| `game/engine/bus.ts` | Only four RSA interaction targets | Add town interaction routing; retain RSA command support with scene/session ownership |
| `game/components/GameCanvas.tsx` | Calls `startAct()` on every mount | Separate engine readiness, mission acceptance, and restoring an existing mission |
| `game/game/dialog.ts` and RSA act content | Reset and start the story immediately; then send player to client | Explicit start/resume/pause and NPC-based openings |
| `game/components/PlayScreen.tsx` | RSA-only page host | Reusable mission UI within the world host |
| `game/components/CoinScenario.tsx` and `CoinHouse.tsx` | Standalone room with existing saved session | Door entry/exit, shared world context, and return position |
| `game/components/GameOver.tsx` | Reload to retry and navigate between act pages | Mission commands for retry, completion, next act, and return to exploration |
| `game/content/scenarios.ts` | Scenario catalog metadata and routes | Scenario metadata plus world entry points and availability |
| `game/game/progress.ts`, `state.ts`, and new town/session storage | Shared completion; saved coin session; RSA state only in memory | Preserve existing saves and add town persistence plus safe RSA checkpoints |
| `game/i18n/es.json` | Existing lesson/UI translations | Town dialogue, navigation, statuses, and revised RSA openings |

Add a small world-interaction registry for doors, NPCs, and signs. Each entry identifies its map position, interaction distance, display text, availability, and action. Keep future houses as world locations, not fake completed/available scenarios. A future lesson should need an entry, an interaction location, and start/resume hooks rather than new branches throughout the town engine.

Preserve mission targets such as `ale`, `brayan`, `tap`, and `car` as semantic names resolved by the active map. Move coordinates, collision dimensions, pathfinding bounds, and packet endpoints together; changing only the terrain would leave story animations targeting the old street.

Keep the coin interior’s existing renderer in this release. It does not need an Excalibur rewrite to support town entry. Share the shell, control conventions, transition behavior, and visual treatment; ensure only the active environment receives input.

## 7. Saves, transitions, and existing links

- Keep the current completion storage and `quantum-coin-session-v1` data. Existing players retain their achievements and coin results.
- Introduce versioned town data: welcome seen, location, safe player position/facing, tracked destination, and selected/paused mission. Validate restored positions against the current map and fall back to a safe spawn if needed.
- Add RSA checkpoints at settled dialogue/task boundaries. Store the act, story position, generated secret/variables, flags, tasks, suspicion, captured data, obtained results, and scene state needed to restore it. Do not store engine objects or running promises.
- Restore the state without rerunning node-entry effects: replaying those effects can submit requests again, reroll secrets, or duplicate animations and audio.
- Give async story work a session identity so stale callbacks cannot modify a different mission after switching or retrying.
- For refresh during an in-flight backend request, reconcile using an existing job identifier where supported. Otherwise restore the last safe checkpoint, explain that the operation was interrupted, and require an explicit retry. Never claim an unsaved result succeeded or automatically resubmit a quantum job.
- Preserve old coin links as direct interior entry with a valid town exit. Redirect RSA overview links to the town client. Old act links may select that act at the client, but must not automatically reset or overwrite an active attempt.
- Hydrate saved state after mounting with a stable initial loading view, retaining the fixes for portal hydration and engine cleanup.

## 8. Delivery sequence

1. **Walkable town:** map, southern spawn, two-axis camera, collision, welcome guide, signs, closed houses, contextual interaction prompts, shared shell, and bilingual copy. Keep lesson integrations behind the new interaction hooks while this foundation is built.
2. **Coin-house connection:** enter/resume via door, room exit, saved return position, town completion marker, and removal of scenario-picker navigation from the coin flow.
3. **RSA in town:** relocate street anchors and props, client acceptance, revised act openings, shared mission overlays, story input ownership, and explicit retry/next-act actions.
4. **Continuity:** pause/resume, RSA checkpoints, journal tracking, asynchronous-operation handling, existing-link compatibility, save migration, and final bilingual copy. These are part of the first release, not optional follow-ups.

Provide the implementation for the user to play through before publishing. Do not deploy as part of this plan.

## 9. User playthrough checklist

- A fresh player starts at the south entrance, receives a short welcome, and can move immediately afterward.
- Declining guidance still allows exploring; RSA is available before completing the coin lesson.
- Nearby prompts do not automatically start conversations or missions.
- The coin door enters the room; leaving and returning preserves puzzle state, experiments, and the final toss.
- The client starts RSA without loading another street or asking the player to find the same client again.
- All four RSA acts work at their new locations, including packet animations, reporting, suspicion, retry, and continuation.
- Pausing RSA to visit the coin house and returning resumes the correct task without duplicate requests or sounds.
- Refresh, direct links, and old saved progress lead to a sensible location and state.
- Both closed houses give their short dialogue and leave the player in control.
- Keyboard, touch, English, and Spanish remain usable; dialogue/laptop input does not move the character underneath.

## 10. Later additions

Combat, inventory, shops, procedural maps, day/night cycles, roaming NPC schedules, extra lessons, and a full minimap are outside this release. The first town should make walking, discovering, accepting, solving, and returning feel coherent. Those interactions provide the foundation for adding more learning mechanics later.

## Implementation notes

The home route now hosts the town. The existing engine renders the expanded map
and resolves RSA anchors inside it. The coin interior retains its renderer and
enters/exits through the town host. Legacy URLs normalize to the home route
after saving their entry hint.

Town saves use `quantum-town-v1`; existing completion and coin-session keys are
preserved. RSA checkpoints also retain the alphabet table, Caesar candidates,
and quantum readouts. Backend requests are associated with a mission generation
so responses from an abandoned attempt cannot modify the next one. The current
IBM flow reads recorded batches; it does not create a new hardware job.

The manual checklist above remains for the user. Publishing is separate.

The town guide now has a dedicated white-coat doctor sprite and matching
dialogue portrait. The welcome and journal name Who Goes First? as the first
challenge while explicitly offering RSA. Start over controls in the header and
laptop can clear one lesson, the current RSA act, all RSA acts, or the full game,
retaining language and audio preferences. No tests or builds were run.
