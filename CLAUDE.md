# CLAUDE.md

GIPFELBUCH — a story-driven 2D metroidvania set on one mountain in Südtirol.
Plain HTML5 canvas + vanilla JS. **No build step, no dependencies, no image
or audio assets** — everything is drawn and synthesized procedurally.

## Run & test

- Play locally: open `index.html` in a browser (or any static server).
- Tests: `node test/check-world.js` — 180+ headless world-geometry
  assertions (floor/headroom under every entity, gear gates sealed except
  the intended route, jump arcs reachable under the real physics).
  Run this after **any** change to `world.js` and before every push.

## Deploy

Merging/pushing to `main` runs `.github/workflows/pages.yml`: tests first,
then a force-push of `HEAD` to the `gh-pages` branch, which serves
https://dermosef91.github.io/Fable-Test/. There is no other deploy step.

## Files

- `world.js` — the whole mountain as data: tile fills, `ZONES`, `ENTITIES`,
  and all dialogue/UI text in `TX` (bilingual: German first, Italian second —
  keep both when adding text).
- `game.js` — the engine, one file: canvas/resize, fullscreen, input,
  WebAudio (SFX + ambience), save (localStorage `gipfelbuch_v1`), physics,
  NPCs/critters, rendering, HUD, map/album/photo/title/end screens, main loop.
- `test/check-world.js` — must stay green; CI blocks deploy on failure.

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
- **User activation gotcha:** `requestFullscreen` (and other
  gesture-gated APIs) must be triggered from `touchend`, *not*
  `touchstart` — Chrome does not count `touchstart` as a user activation.
  The `fs` button is handled in the `touchEnd` listener for this reason.
  Fullscreen also locks landscape orientation on touch devices and the
  button is hidden when the API is unsupported (iPhone Safari).
- **Touch state:** `isTouch` flips true on first touch and switches the HUD
  to on-screen controls. New momentary buttons must be reset in
  `refreshTouch()` or they stay visually "pressed".
- **Saves:** bump `SAVE_KEY` only if the save shape breaks compatibility;
  `loadSave` must tolerate missing fields from older saves (`|| {}` pattern).

## Tone

German-first bilingual flavor text, gentle and concrete, real South Tyrol
texture. No combat — gates are weather, gear and terrain. Keep it that way.
