# GIPFELBUCH

*Ein Wochenende in Südtirol · Un fine settimana in Alto Adige*

A mobile-friendly, story-driven 2D metroidvania demo — set not in a ruined
castle or an alien cave, but on **one ordinary mountain in modern-day
Südtirol, over one camping weekend**.

**▶ Play it:** open `index.html` in any browser (no build, no dependencies),
or serve the folder (`npx serve .`) and open it on your phone.

---

## What makes it different

| Genre convention | GIPFELBUCH |
|---|---|
| Double jump, dash, morph ball | **Camping gear**: Wanderschuhe, Regenjacke, Stirnlampe, Klettersteigset |
| Locked doors & keycards | **Weather and terrain**: scree you can't climb in sneakers, a waterfall that hammers you down without a rain jacket, a pitch-black WWI tunnel, a via ferrata cable that's "just decoration" without the kit |
| Health bar, enemies, combat | **No combat at all.** Your only resource is *Wärme* (warmth) — drained by cold water, spray, night air; restored at campfires and by Knödel |
| Epic world-ending plot | **A weekend.** Friday night to Sunday's first light, told through your Oma's 1974 hiking journal, seven scattered pages, and the summit's Gipfelbuch |
| Fast travel | A chimney you can drop through, a scree slope you can ski down on your boots, and one very ill-advised cliff dive (*der Zinnensprung*) |

The setting is textured with real South Tyrol: bilingual German/Italian
signage, red-white-red trail blazes, a Hüttenwirt who trades a quest for
three chestnuts (Törggelen!), marmots that whistle and dive, WWI
high-mountain positions and tunnels, alpenrose meadows and a golden-larch
valley — and a day/night/weather cycle bound to the story, ending with a
sunrise summit.

## The loop

1. **Saturday morning** — find proper boots in the forest shelter → the scree
   path to the Alm opens.
2. Collect **3 chestnuts** for Norbert the hut keeper → Knödel (max-warmth up)
   and Oma Rosa's old **rain jacket** → the waterfall gorge becomes a path
   (rain rolls in).
3. Behind the gorge, the old 1916 position holds a **headlamp** → night falls,
   the WWI **Stollen** becomes passable.
4. At the Hochband: a **via ferrata kit** beside a plaque — the route is named
   after your grandmother. Bivouac, first light, **climb to the summit**.
5. The Gipfelbuch knows the rest.

Optional: 7 journal pages, 5 marmots, one bench with a view of three pale
peaks, and the Zinnensprung.

## Controls

- **Desktop:** ← → / A D move · Space jump · W/↑ grab cable & climb ·
  E interact · M map
- **Mobile:** on-screen ◀ ▶ pads, **A** jump, **E** interact, 🗺 map; ▲▼
  appear when climbing or swimming. Tap to advance dialogue.

Autosaves at every campfire (localStorage). Resting restores warmth.

## Tech

- Plain HTML5 canvas + vanilla JS, zero dependencies, ~2 files of code.
  Everything (terrain, light, rain, characters) is drawn procedurally —
  no image assets.
- `world.js` — the whole mountain as data: tile geometry built from a few
  dozen fills, zones, entities, and every line of dialogue.
- `game.js` — engine: physics (coyote time, one-way planks, swimming,
  cable climbing, scree sliding, waterfall force fields), camera, day-phase
  sky, dynamic lighting (headlamp/campfires), particles, touch UI, dialog,
  paper map, save system, synth SFX (WebAudio, no audio files).
- `test/check-world.js` — 180+ headless assertions: every entity has floor
  and headroom, every gate is sealed except its intended route, every jump
  in the gorge ladders is reachable under the real physics arc.

```sh
node test/check-world.js
```

## Demo scope

This is a vertical slice: one interconnected mountain (12 named zones), four
gear gates, two NPCs with a full quest line, a complete story with ending and
stats screen, then free roam. *Flugschule Gamstal — demnächst.*
