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
- Tests: `npm test` / `node test/check-world.js` — ~280 headless
  world-geometry
  assertions (floor/headroom under every entity, gear gates sealed except
  the intended route, jump arcs reachable under the real physics).
  Run after **any** change to `world.js` and before every push.
- `node test/smoke-render.js` — stubbed-DOM crash test that drives
  title → play → dialog → map frames; run it after renderer changes.
- **Geometry changes and their assertions land in the same commit.** If you
  move a ledge, update the ladder/hop lists in `check-world.js` too.
- For new gates or routes, verify in headless Chrome (puppeteer) like a
  player would: blocked **without** the gear, passable **with** it, and
  always the **whole** route end-to-end — a climb verified only partway
  once shipped impossible (the Wasserfallsteig incident).

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

## Engine conventions (game.js)

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
