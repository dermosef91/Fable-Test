# Agent Developer Guide (GIPFELBUCH)

Welcome! This document outlines guidelines and conventions for AI agents when modifying the **Gipfelbuch** codebase.

## 🛠 Core Development Rules

### 1. No External Assets
- **Do not introduce images, audio, or external fonts.** The entire project is procedural.
- All visuals must be drawn via plain HTML5 Canvas API in `game.js`.
- All sound effects (SFX) and ambient noise beds (rain, wind, crickets, etc.) must be synthesized programmatically using the browser's Web Audio API.

### 2. Localization (Bilingual German/Italian)
- All user-facing dialogue and labels in `world.js` under `TX` must provide both German (primary) and Italian (secondary) translations.
- Example: `"Wir sollten den Klettersteig probieren / Dovremmo provare la via ferrata"`
- Ensure any text changes or additions preserve this dual-language format.

### 3. Character Syncing
If you modify, add, or remove characters:
1. Update [CHARACTERS.md](file:///Users/moritzgrassy/Gipfelbuch/Fable-Test/CHARACTERS.md).
2. Sync the sprite colors/dimensions in `tools/generate_sprites.py`.
3. Update references in `game.js` / `world.js`.

### 4. World Geometry & Validation
- **Never skip tests.** Always run the validation suite after modifying `world.js`:
  ```bash
  npm test
  ```
- The suite checks 180+ assertions, including platforming reachability, player headroom, solid ground underneath spawnpoints, and logical progression gates. If the tests fail, the CI pipeline will block the deployment.

### 5. Local Running
- Use `npm run dev` (or `npm start`) to start the local static server (`http-server`) on port `8080` for live previewing.
