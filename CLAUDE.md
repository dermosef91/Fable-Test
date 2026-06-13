# CLAUDE.md

GIPFELBUCH — a story-driven 2D metroidvania set on one mountain in Südtirol
(plus a hidden glider valley). Plain HTML5 canvas + vanilla JS. **No build
step, no runtime dependencies, no image or audio assets** — everything is
drawn and synthesized procedurally. Keep it that way. Test/dev-only tooling
(puppeteer, http-server) is fine but must never be needed to play.
This file is the **single source of truth** for working on this repo.

## Keep this file alive

When a session produces a **major learning** — a shipped bug whose root
cause a rule would have prevented, a new mechanic/convention, a design
principle the maintainer states in feedback, a workflow gotcha — update
CLAUDE.md **in the same PR** and call the change out in the PR
description so the maintainer can veto it. Write rules, not history
("full arcs need ~5.5 tiles of headroom", not "once upon a time…"), keep
it terse, and delete guidance that stopped being true — stale rules are
worse than missing ones. Routine work doesn't belong here.

## Run & test

- Play locally: open `index.html` in a browser, or `npm run dev`
  (http-server on port 8080).
- Tests: `npm test` (or `node test/check-world.js`) — ~280 headless
  world-geometry
  assertions (floor/headroom under every entity, gear gates sealed except
  the intended route, jump arcs reachable under the real physics).
  Run after **any** change to `world.js` and before every push.
- `npm run smoke` (or `node test/smoke-render.js`) — stubbed-DOM crash test that drives
  title → play → dialog → map frames; run it after renderer changes.
- **Geometry changes and their assertions land in the same commit.** If you
  move a ledge, update the ladder/hop lists in `check-world.js` too.
- For new gates or routes, verify in headless Chrome (puppeteer) like a
  player would: blocked **without** the gear, passable **with** it, and
  always the **whole** route end-to-end — a climb verified only partway
  once shipped impossible (the Wasserfallsteig incident).

## Screenshots & playtest bots (headless Chrome)

Sessions are ephemeral — set up once per session (needs a network policy
that allows npm and Chrome's download host; if blocked, fall back to
`test/smoke-render.js`):

    cd /tmp && npm init -y && npm i puppeteer
    npx puppeteer browsers install chrome

Then in Node: `puppeteer.launch({ headless: 'new', args: ['--no-sandbox',
'--mute-audio'] })`, `page.goto('file:///…/index.html')` (no server
needed), drive with `page.keyboard` / `page.touchscreen` (use
`page.emulate` with `hasTouch` for phone shots), and
`page.screenshot(...)`. Game state lives in plain script globals — set up
any scene via `page.evaluate(() => { G.gear = {...}; player.x = …; })`.
Real keyboard presses can fall between frames in headless runs; the
engine's `pend*` event queue exists for exactly that.

- **Add screenshots/media** to the verification/walkthrough documentation (e.g. `walkthrough.md` or PR details) for all visual, layout, or level-design changes. Use the headless browser script or manual captures to show the before/after states where feasible.

## Deploy & collaboration

- Merging to `main` runs `.github/workflows/pages.yml`: tests, then a
  force-push of `HEAD` to `gh-pages`, which serves
  https://dermosef91.github.io/Fable-Test/. No other deploy step.
- Multiple Claude sessions work on this repo in parallel. **Fetch and merge
  `origin/main` before opening/merging a PR.** When resolving conflicts,
  treat content trims from other sessions as deliberate design decisions —
  prefer their cut over your addition unless it breaks a gate.

## Files

- `world.js` — the whole mountain as data: tile fills in `buildWorld()`,
  force-field rects (`WATERFALL`, `THERMALS`), `MOVERS` (platforms),
  `RINGS`, `ZONES`, `ENTITIES`, and every line of text in `TX_DE` / `TX_EN`.
- `game.js` — the engine, one file: canvas/resize, fullscreen, input,
  WebAudio (SFX + generative music + ambience), save (localStorage
  `gipfelbuch_v1`), physics, NPCs/critters/Gams, rendering, lighting,
  `drawIcon`, HUD, map/album/photo/title/end screens, main loop.
- `test/check-world.js` — must stay green; CI blocks deploy on failure.

## Localization

- **English is the default**; German is one tap away on the title screen.
  Every new string goes into **both** `TX_DE` and `TX_EN` (keep the
  Italian/German local color — signs stay bilingual, Knödel stay Knödel).
- Zones carry `en`/`de`/`it` names; `PHASES` captions are `{de, en}`
  objects resolved with `L()`. Objectives are stored as **keys**
  (`G.objKey`) so saves survive a language switch.

## Level-design rules (hard-won)

- **Jump budget:** v0 8.4, gravity 0.42 up / 0.5 down, apex hang. Between
  ledge *edges*: at most **3 tiles up and ~4 across** is comfortable;
  4 up is a deliberate set-piece. Full arcs need **~5.5 tiles of headroom**
  — a ceiling 1–2 tiles above head height silently eats jumps (carve sky,
  as over the gorge slot).
- **Summit Headroom & Y-Shifting**: The world height is `90` tiles (originally `80`), with all level geometry shifted down by `Y_OFF = 10` tiles. This leaves a 10-tile buffer of open air above the summit. All absolute Y lookups and boundaries in `game.js` and `test/check-world.js` must be dynamically shifted by adding `Y_OFF` to match this layout.
- **Challenge before reward:** place gear so the player meets its obstacle
  first and backtracks (lamp at the Observer Post after the dark tunnel;
  ferrata set at the Depot after the bare cable). Quest collectibles must
  require a detour, not line the critical path (Norbert's gorge chestnut).
- **Late-game unlocks** invite return trips: photo spots appear after the
  finale, Ida's tin after the Zinnensprung. Gate via flags in
  `findInteract`/`drawEntity`, not by deleting entities.
- Zones are first-match in `ZONES` order (specific before general);
  `dark`/`covered`/`outdoor` flags drive lighting, rain and ambience.
  Darkness is a *soft* gate (drains warmth, passable for the determined).
- One-way drops and shortcut loops (chimney, Schartl, scree-run) are part
  of the metroidvania feel — add them when a new area would force a slog.
- **No trapping drops/gaps:** Avoid creating deep gaps where the player can fall and get stuck. Any platforming section must have a maximum drop depth of ~4 tiles to the nearest exit/climbable platform, or have clear re-entry/escape routes (e.g. wooden planks/one-way steps, or walkable horizontal exit tunnels).
- **Movers must be load-bearing:** if a static ledge can substitute for a
  moving platform's ride (or sit under its track at jump height), the mover
  is decoration — remove the ledge, not the mover.
- **No floating rock:** every ledge/crag bonds to a face or shoulder below
  (extend the fill down). Only deliberate openings stay pure air, and a drop
  gap (the Scharte) must line up with its landing (the pond).
- **The Gipfel is the highest point on the map** — no crag, wall top or
  massif face may poke above the summit plateau (map-edge walls excepted).

- **Vector Asset Design Guidelines:** For structures (like the Alm hut redesign) and visual elements, favor high-quality hand-coded details over simple blocks:
  - *Dimensionality:* Add steep roofs, eaves/overhangs, and outline strokes (`cx.strokeStyle`) for structural depth.
  - *Texturing:* Use pattern line-work (e.g. horizontal plank lines, brick overlays, wood grains) rather than flat fills.
  - *Vibrant Contrast:* Accent earthy or neutral bases with high-contrast color pops (e.g., green shutters, colorful flower boxes) to guide interest.
  - *Micro-Particles:* Attach ambient details like chimney smoke particle generators or interactive elements (e.g. sitting benches).


## Engine conventions (game.js)

- **Rendering layers (in `render`):** sky → bg-rock → decor → tiles → entities
  → actors → weather/particles → `drawLighting` (warm light) → `drawColorGrade`
  → `drawVignette` → HUD. The grade and vignette are device-space post passes
  drawn *after* `cx.restore()`, so they wash the world but never the HUD.
- **Art-direct phases from `GRADE`, not ternaries.** Each phase has one
  `{top,bot,a}` multiply wash (lerped like `phaseColors`). Tune time-of-day mood
  there instead of adding `G.phase === n ? …` branches across draw functions.
- **Lighting is two passes in `drawLighting`:** a low-res darkness overlay with
  cut-outs, then a `'lighter'` warm glow keyed to `amb` (so fires/lamp tint what
  they light at night/dusk but stay neutral in daylight). One `lights[]` list
  feeds both — add a source there, don't duplicate coords.
- **Baked textures, never asset files.** `ensureTex()` paints a 512×512 detail
  sheet once into an offscreen canvas — **4× supersampled** (64-px sub-tiles for
  16-px world tiles); `texTile`/`texRect` blit a sub-tile keyed to **world tile
  index** (`tx%8,ty%8`) so grain is world-locked and never swims with the camera.
  Blit it with **`imageSmoothingEnabled = true`** (scoped to `drawTiles`/`texRect`,
  restored to `false` after) so the world's ZOOM upscale resamples the high-res
  grain cleanly — without that, nearest-neighbour magnifies the sheet into blocks
  and the texture looks low-res. Source crop is inset 0.5px to stop bilinear
  bleed across sub-tiles. Extend the sheet, don't load images.
- **Break tile uniformity at three scales, never per-tile decoration grids.**
  Large tonal variation lives in the *baked sheet* (broad blotches) + a subtle
  per-tile colour jitter (`hexLerp` ~0.15, stronger reveals the grid); small
  accents (lichen, moss, veins, quartz) come from `drawRockDecor`, gated *rare*
  (`h(seed) > ~0.9`) and offset off-grid. A frequent per-tile element (one oval
  per tile) just re-creates the grid you were hiding — keep those in the sheet.
- **Edge AO:** thin dark strips on air-facing tile sides + a band under the
  grass cap carve depth; keep them subtle so they don't fight the organic edge
  bumps.
- **Contact shadows:** `groundShadow(x, floorY, hw, a)` grounds actors/objects;
  draw it before the body, at the floor line, only when grounded. Add new
  shadow-worthy entity types to `SHADOW_ENTS`.
- **Rim light (`rimLight`):** a warm sun-side edge catch on figures, only at
  first light / dawn (`rimK`). Drawn in screen space *after* the figure so it's
  independent of `cx.scale(face,1)`; character entity boxes live in `RIM_ENTS`.
- **Ambient motes (`drawMotes`):** decorative per-zone air life (dust in shafts,
  pollen on the Alm, wind-grit on the ridge, mist in the gorge), keyed off
  `curZone.id` in `moteKind`. A separate pool from gameplay `parts`, drawn
  *before* `drawLighting` so night/lamp dim them (dust only glows in the lamp
  pool underground).
- **Coordinate spaces:** world pixels are drawn under `setTransform(ZOOM,...)`;
  HUD/UI is drawn under `setTransform(DPR,...)` where `W = cv.width / DPR`,
  `H = cv.height / DPR` are CSS pixels. Touch hit-testing happens in
  *device* pixels (`clientX * DPR`).
- **UI buttons:** `BTNS` is rebuilt every frame by whichever screen draws
  (`drawHUD`, `drawMap`, `drawAlbum`, `drawTitle`). Add buttons with
  `addBtn(id, x, y, r, label)` (circular) or push `{id, x, y, w, h}` (rect,
  device px) directly. Input handlers resolve taps/clicks via `hitBtn` and
  set `pend*` flags; edges are consumed once per frame in `tick()`.
  `drawBtn` hides everything except `map`/`mute`/`fs` for non-touch users.
- **No emoji in UI.** Emoji render differently per platform (a map fire
  once rendered building-sized on Android). Use `drawIcon(name, x, y, s)`
  — procedural vector icons; `'i:<name>'` as a button label draws one.
- **User activation gotcha:** `requestFullscreen` (and other gesture-gated
  APIs) must be triggered from `touchend`, *not* `touchstart` — Chrome does
  not count `touchstart` as a user activation. Fullscreen also locks
  landscape on touch devices; the button hides when unsupported (iPhone).
- **Touch state:** `isTouch` flips true on first touch and switches the HUD
  to on-screen controls. New momentary buttons must be reset in
  `refreshTouch()` or they stay visually "pressed". Jump/act/up edges are
  also event-queued (`pendJump`/`pendAct`/`pendUp`) so a fast tap never
  falls between frames.
- **Movers:** platforms in `MOVERS` are one-way landings; standing players
  are carried via `p.moverRef` (set on landing, cleared on jump/walk-off).
- **Crumble & stonefall:** `CRUMBLE` rects (world.js) are one-way shale slabs
  that crack ~1.5 s after first landing and regrow ~4 s later; collision rides
  the same one-way landing loop as `MOVERS`. Place them only where a fall
  lands on recoverable ground with a tested way back. `STONEFALL` bands drop
  telegraphed stones (dust + rattle before the drop); hits stagger
  (`p.stunT`) and cost warmth — never a respawn. Keep bands off cable columns
  and plank havens; ledges inside a band intercept stones, so the exposed
  stances are the ledges themselves. Mirror both in check-world.js (open-air
  track, sky above, recoverable fall, band placement).
- **NPC & Animal Rendering**: Characters and animals are drawn procedurally, supporting a horizontal facing direction (`face = 1` or `-1`) via context scaling: `cx.scale(face, 1)`. When in motion (i.e. horizontal velocity `vx` is non-zero), apply a sinusoidal leg/hoof walking swing offset (`swing = Math.sin(...) * scale`) to convey movement naturally.
- **Organic Tile Rendering:** Solid tiles (rock, scree) use coordinate-seeded pseudo-random hashes `h(seed)` in `drawTiles()` to procedurally draw stable organic edge bumps, grassy humps/blades, and rounded corners, avoiding straight rectangular bounds.
- **Saves:** bump `SAVE_KEY` only if the save shape breaks compatibility;
  `loadSave` must tolerate missing fields from older saves (`|| {}`,
  inferred `objKey`).

## Tone

Gentle and concrete, real South Tyrol texture: bilingual signage,
red-white-red blazes, Knödel, Törggelen, WWI traces treated with respect.
English-first prose with German/Italian color; journal pages read in the
parchment dialog style. No combat — gates are weather, gear and terrain.
Rewards are story (a note in a tin, a named route, a marmot that waves),
never numbers. Keep it that way.

## Characters

`CHARACTERS.md` is the character reference (name, background, personality,
visual description with the hex colours used by the procedural drawing in
`drawEntity`/`drawPlayer`). **Keep it in sync** when adding, altering or
removing a character. Characters are drawn procedurally — a PNG sprite
experiment was tried and deliberately removed; don't reintroduce assets.
