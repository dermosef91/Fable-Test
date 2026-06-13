# Platforming Plan — review of `platforming_concepts.md` against the live game

This is the result of checking every proposal in the concepts doc against the
current `world.js`, `game.js` and `test/check-world.js`. Verdicts first, then
detailed designs for what's in, then the reasoning for what's out.

> **Maintainer decisions (June 2026), shipped on this branch:** stonefall
> lands first at the **depot climb**, not the scree slope — the scree is too
> early in the game, and concepts are introduced one at a time. Crumbling
> ledges go **on the mandatory ridge path** (two former pillars, x86..88 and
> x107..109), with check-world taught to treat crumble slabs as valid hop
> support and to assert their fall recovery.

## 0. Corrections to the concepts doc

The doc was written against a stale checkout:

- Its `world.js` line references don't match (e.g. "Valley Floor L249-258" is
  the `PHASES` table today).
- Coordinates are pre-`Y_OFF` and pre-layout-changes: the pond is at
  **x143..150**, not x160..180; the cow stands at **x52**, not x72; the belay
  ledge is at **x67..69, y21**, not x91..93. All locations below use current
  coordinates (world-space, before `Y_OFF`).
- Several proposals re-invent shipped systems: warmth/exposure drain already
  exists (night, dark, swim, waterfall, nettles), the Gams already flees when
  crowded, marmots are already a wildlife mechanic — a *friendly* one.

## 1. Verdict summary

| Concept | Verdict | Why (short) |
|---|---|---|
| Hard ice / Blankeis | **In (Tier 1)** | Cheap new tile physics, fits the high ridge, recoverable by design |
| Stonefall / Steinschlag | **In (Tier 1)** — relocated to the scree slope | Livens the dullest zone; wide space = fair dodging |
| Cow as platform | **In (Tier 1)** | High charm, cow + wander AI already exist, pure story reward |
| Crumbling ledges | **In (Tier 2)** — optional routes only | Great forced-flow mechanic, but must not touch the tuned critical path |
| Föhn wind | **Adapted (Tier 2)** — glider valley only, not the ridge | Ridge wind invalidates ~30 tested jump arcs and the calm-dawn finale |
| Thermal turbulence / sink | **Adapted (Tier 2)** — sink pockets, no canopy collapse | Tactical, not punishing |
| Ice gear (Grödel/Eispickel), helmet | **Cut** | Gear creep; the 5-gear arc is complete and HUD-hardcoded |
| Mud / bogs | **Cut** | Slows the main walking corridor; friction without challenge |
| Marmot sentinels scaring the Gams | **Cut** | Contradicts shipped marmot/Gams design; needs a sneak verb that doesn't exist |
| Suspension bridge sag physics | **Cut** | High effort, low payoff; hoists already cover dynamic platforms |
| Rappel rope / anchors | **Deferred** | New verb; cable tiles already cover shortcuts. Noted how to do it later |
| Blizzard exposure zones | **Cut for now** | Warmth system already does exposure; weather is phase-scripted |

## 2. Tier 1 — high value, contained risk

### 2.1 Blankeis — hard-ice patches on the ridge saddles ✅ SHIPPED

Shipped on the two on-route knife-edge stances that survived the geometry
merge: the **high point (x95..98, y4)** — the most exposed crest, fittingly
glazed — and the **deep saddle (x102..104, y7)**. (The originally-planned
x116..119 saddle no longer exists; a parallel merge turned it into a
hoist-bridged gap.) Final tuning from headless playtest: idle friction
`vx *= 0.985`, forward accel **0.16** (sluggish), but **brake authority 0.30**
when pressing opposite to motion so a landing brake-tap reliably stops you on
the small patches — "ice but fair." No gear gate. A slip lands on the catch
band (verified soft + recoverable). 11-check headless playtest green.

Original design notes below (kept for reference):

### 2.1 Blankeis — hard-ice patches on the ridge saddles

- **What:** new tile code `7` (ice skin, drawn glassy blue-white over rock,
  same skin pattern as scree code 2). On ice: ground acceleration drops
  (0.55 → ~0.18), idle friction nearly vanishes (`vx *= 0.985` instead of
  0.72), skid turns barely bite. Jumps keep full horizontal speed — committing
  to a jump off ice is the skill test.
- **Where:** the floors of the two deep saddles on the ridge —
  **x102..104 (y7)** and **x116..119 (y8)**. Both already have rock-step
  escapes and the solid catch band at y14 below, so a slide-off is recoverable
  (satisfies the no-trapping rule). Keep every ledge ≤3 tiles wide ice-free.
- **No gear gate.** Ice is a skill test, not a Grödel gate — the 5-gear arc
  (boots → jacket → lamp → kit → glider) is complete, and the HUD gear strip
  is a hardcoded 5-slot list. Revisit only if a post-game glacier pocket is
  ever built.
- **Engine touch points:** `SOLID()` in game.js must accept 7; `drawTiles()`
  needs the ice skin; `physTick()` ground-info block (`tilesUnder`) gains an
  `onIce` flag next to `onScree`.
- **Tests:** `solid()` in check-world.js must accept 7; assert the patches
  exist, the escape steps stay ice-free, and the existing ridge-hop
  reachability list stays green (ice doesn't move geometry).

### 2.2 Steinschlag — rolling stones on the scree slope

- **What:** the Geröllfeld (x87..128) is currently one long boots-gated walk —
  the dullest stretch in the game. Add occasional stones that spawn near the
  top of the slope and bounce down the existing slope line, with a rattle SFX
  and dust ~1s before they reach the player's column. Getting hit = brief
  stagger (~25 frames of lost control) + warmth −8 + a toast, same family as
  the existing stumble penalty. Never a respawn.
- **Fairness rules:** generous cadence (one stone every ~6–9 s, only while the
  player is on the slope), suppressed during dialog and while the player is
  already bootless-sliding (no double punishment). Stones are dodgeable by
  walking, sheltering behind the Schartl saddle terrace, or jumping over.
- **Why here and not the chimney (doc's proposal):** the chimney is the tight
  funnel below the observer-post climb, which is already 8 precision hops;
  stacking a timing hazard there overloads one route. The scree is wide,
  readable, and has natural cover.
- **Engine touch points:** small `stones[]` array updated in the world tick
  (like `parts`, but with slope collision); player overlap check in
  `physTick`. No geometry change, so no check-world changes beyond nothing.

### 2.3 The Almkuh as a moving platform

- **What:** the cow (x52 on the Alm shelf) already wanders via
  `updateWander`. Make her back stand-on-able with the same one-way landing
  logic MOVERS use (the landing loop at the bottom of `physTick` generalizes —
  give her a `moverRef`-compatible carry). Then: once Norbert's Knödel quest
  is **done** (so the 3-chestnut economy is untouched), pressing E near her
  offers holding out a chestnut — she ambles east to a marked spot at the
  shelf's east end (~x80..82) under the headwall.
- **The reward:** carve a small nook in the headwall ~4 tiles above the shelf
  (reachable only from cow-back height, +2 tiles): inside, a carved
  "R + I 1974" heart and a short parchment vignette — story, not numbers, per
  the tone rules. Gate visibility via flags in `findInteract`/`drawEntity`,
  not by adding/removing entities.
- **Tests:** nook reachable from cow-back height under the real arc model,
  unreachable from the shelf floor; Alm-shelf walkability assertion updated
  for the carved nook; headwall seal assertion (no kit-free route to the
  ridge) **must stay green** — the nook must not breach y19..27 at x72..86.
- **Localization:** new strings in both `TX_DE` and `TX_EN`.

## 3. Tier 2 — after Tier 1 lands

### 3.1 Brüchiger Fels — crumbling ledges (optional routes only)

- **What:** a `CRUMBLE` list in world.js (`{x, y, w}` rects), treated like
  mover platforms for collision (one-way landings). On landing: crack SFX +
  rock particles, ~90-frame fuse, then the ledge drops out; it regenerates
  after ~4 s. Forces continuous movement.
- **Hard rule:** never on the gear-gated critical path. The gorge, observer
  post, depot climb and ridge are tuned and covered by reachability
  assertions; retrofitting crumble there changes their difficulty silently.
- **Concrete placement — the "Jägersteig":** three crumble ledges climbing
  from the solid catch band under the ridge (y14, around x92..100) up the
  flank of the knife-edge high point to a small viewpoint perch with a story
  reward (e.g. an old hunter's cartridge tin with a note). A fall lands on
  the catch band — no trapping, and the re-entry plank route back up already
  exists.
- **Tests:** crumble rects sit in open air; perch reachable via the rects
  under the arc model; the headwall-seal and scree-breach gate assertions
  stay green.

### 3.2 Wind in the Hinteres Tal — not on the ridge ✅ SHIPPED

Shipped as `SINK` force-field pockets (`inSink`) that drag a gliding player
down (vy → 2.2, or 3.4 diving) — placed clear of the thermal columns and ring
centres (asserted in check-world so the course can't soft-lock), plus a gentle
steady easterly (`valleyWind`, ~0.35–0.95) that nudges a glider east and now
drives the windsock angles. No canopy collapse; sinks are escapable (steer or
dive out, soft landing). 9-check headless playtest green. Design notes below.

### 3.2 Wind in the Hinteres Tal — not on the ridge

- **Why not the ridge (doc's proposal):** the ridge is precision platforming
  validated by ~30 reachability assertions derived from the exact jump
  physics; a horizontal force field invalidates all of them at once. And the
  summit finale is canonically calm ("Kaiserwetter", first light) — weather
  is phase-scripted, not zone-scripted.
- **What instead:** a gentle west→east breeze field across the glider valley:
  while gliding, drift +0.03 vx with the wind and −0.05 against it. Add 1–2
  marked **sink pockets** (cold air along the east face, drawn with downward
  streak particles) where glide sink rate increases — making the ring course
  tactical: ride the breeze out, fight it home via thermals.
- **No canopy collapse.** A punishing collapse contradicts the soft-fail
  tone; sink is enough of a cost.
- **Bonus:** the two windsocks already placed in the valley become live
  indicators — animate them from the actual wind strength instead of the
  current cosmetic sine.

## 4. Cut / deferred — reasoning

- **Mud / bogs (valley pond):** the valley floor is the game's main walking
  corridor; slowing walking there is friction without a decision. The pond
  crossing already teaches one-way platforms via the half-sunk log.
- **Marmot sentinels that scare the Gams:** contradicts shipped design twice
  over — marmots are friendly proximity collectibles (the 5/5 reward is that
  they *whistle greetings*), and the Gams already has flee behaviour tuned as
  a gentle "don't crowd wildlife" lesson. It would also need a sneak/crouch
  verb that doesn't exist (a new input is a real cost on the touch HUD).
- **Suspension bridge with sag physics:** soft-body simulation for one
  set-piece; the hoists already provide moving-platform gameplay. If the
  *look* is ever wanted, do a cosmetic sagging-plank drawing over ordinary
  one-way tiles.
- **Rappel rope / anchors:** a whole new verb plus UI. The cable tile (5)
  already covers "fixed line back down" (see the Hinteres Tal return cable).
  If revisited: an anchor entity that writes a temporary tile-5 column into
  the world grid at runtime would reuse all existing climbing code.
- **Blizzard exposure zones:** the warmth system already models exposure
  (night-outdoor drain, dark drain, swim, waterfall, nettles), and weather is
  driven by the weekend's `PHASES` script — a permanent storm zone fights the
  narrative clock. Revisit only alongside a post-game high-altitude area.
- **New gear (Grödel, Eispickel, Kletterhelm):** every proposal here works
  without a new gate, and each new gear item must follow challenge-before-
  reward placement, HUD slots, save fields and both text tables. Not worth it
  for one zone each.

## 4b. Shipped: the scree-run (glissade) — making the Scree Field play like a place

The Scree Field was flagged as the dullest stretch: with boots it was a flat
diagonal *walk*. Rather than re-terrace the slope (which would destabilise the
boots gate and three entangled tests — see below), the fix was a **new verb on
the existing geometry**:

- **With boots, hold DOWN on scree to scree-run** — a fast (`GLISS_MAX` 4.6 vs
  2.6 walk), steerable controlled glissade downhill; LEFT digs in to a
  self-arrest. `p.glissT` carries momentum across the staircase hops;
  `p.sliding === 2` drives a crouch pose + dust + scree rumble.
- **It inverts the boots meaning** (helpless slip → mastered descent) and turns
  the chestnut-quest backtrack (Alm → pond) into a fun shortcut — the run
  delivers you from Alm height straight down to the Larch Forest & Pond.
- **Pure physics, zero geometry change**, so the boots gate and all geometry
  assertions stayed green. Verified end-to-end in headless Chrome (10 checks):
  exceeds walk speed, reaches the valley soft (no stumble), self-arrest brakes,
  bootless players still can't enter it or climb the slope (gate holds), jump
  exits cleanly.

**Geometric switchbacks were deliberately deferred.** Terracing the diagonal
would have to rewrite the core scree generator, the test-6 slope formula, the
Schartl walk-sim (test 15), and reposition the saddle terrace / sign / marmot /
flowers — all while preserving "downhill = east" (the slide gate hardcodes it).
That's high risk for mostly cosmetic gain; the scree-run delivers the
"engaging + varied" goal on its own. Revisit terracing only as its own change.

## 4c. Shipped: the tunnel lamp-flicker draft — making the dark dynamic

The Stollen was a static lamp-gate (rubble hops in a fixed pool of light).
Now `lampTick` gives the lamp a constant gentle breath wherever it's lit, and
in the dark tunnel a periodic **draft** guts the flame — the pool of light
shrinks to a tight circle for ~0.5 s (low whoosh + sideways sparks + a
one-time hint), then recovers. You learn to wait for the flame to steady
before committing to a rubble hop. Pure rendering/atmosphere — no geometry,
clamped so the lamp never blacks out (darkness stays a *soft* gate). 8-check
headless playtest green (gust dips the pool, never below the floor, recovers,
natural gusts fire only in the dark zone, none in daylight).

## 5. Sequencing

One PR per mechanic, in this order (each independently shippable):

1. **PR 1 — Blankeis** (tile 7: engine + ridge patches + test updates)
2. **PR 2 — Steinschlag** on the scree (engine only, no geometry)
3. **PR 3 — Almkuh platform** + headwall nook secret (geometry + entity + texts)
4. **PR 4 — Crumble system** + Jägersteig route (new system + geometry)
5. **PR 5 — Valley wind + sink pockets** + live windsocks (glider polish)

Per repo rules, every PR: `npm test` green with geometry assertions updated
in the same commit, `npm run smoke` after renderer changes, a headless-Chrome
end-to-end playthrough of the affected route (with and without the relevant
gear), and before/after screenshots in the PR description.
