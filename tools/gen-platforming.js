#!/usr/bin/env node
/* =========================================================================
   GIPFELBUCH — platforming-section generator (dev tool, never shipped)

   Lays out a chain of reachable ledges inside a rectangle of the map and
   prints PASTE-READY source for both halves of a geometry change:

     1) a block of fill() / carve() calls for buildWorld() in world.js
     2) the matching ledge assertions + hop-reachability checks for
        test/check-world.js

   The mountain stays HANDCRAFTED — this just removes the tedious, bug-prone
   part: hand-verifying that every hop clears the real jump arc. Every hop it
   emits is validated against the SAME reachable() the tests use (mirrored
   below), and the script refuses to print a section with an unreachable hop.

   Usage:
     node tools/gen-platforming.js --area X,Y,W,H [options]
     npm run gen -- --area X,Y,W,H [options]

   Required:
     --area X,Y,W,H     tile rect to fill (X,Y top-left; W,H in tiles)

   Options:
     --difficulty NAME  easy | medium | hard            (default: medium)
     --types LIST       comma list of enabled types     (default: rock,plank)
                        rock   solid ledges (always on — the landings)
                        plank  one-way planks (jump up through, land on)
                        scree  loose scree cap on a ledge (still solid)
                        nettle soft hazard to hop over on wider ledges
                        water  hazard pool along the rect floor (the void)
                        mover  moving platform to bridge an over-long gap
     --dir DIR          up | across   net climb direction (default: auto)
     --seed N           integer RNG seed for reproducible layouts
     --name SLUG        label for comments + assertion var names (default: gen)
     --carve-sky        emit a leading carve() of the rect (guarantee air)

   Tile codes (must match world.js): 0 air · 1 rock · 2 scree · 3 plank
                                     4 water · 5 cable · 6 nettles
   ========================================================================= */

'use strict';

// --- the jump arc, mirrored verbatim from test/check-world.js -------------
// v0 8.4 px/f, g 0.42 up, vx 2.3 px/f. dy>0 = upward (tiles). Keep in sync.
function reachable(fromX, fromY, toX, toY) {
  const dx = Math.abs(toX - fromX), dy = fromY - toY;
  if (dy > 4.3) return false;
  const maxDx = dy >= 4 ? 4 : dy >= 3 ? 4.5 : dy >= 1 ? 5 : 5.5 + Math.min(2, -dy * 0.5);
  return dx <= maxDx;
}

// --- small seeded RNG (mulberry32) so layouts are reproducible ------------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)); // inclusive

// --- difficulty presets ----------------------------------------------------
// rise/gap are BIASES; reachable() is the hard gate and trims them in-bounds.
const DIFF = {
  easy:   { rise: [1, 2], gap: [2, 3], width: [3, 4], plank: 0.05, nettle: 0.00, scree: 0.30 },
  medium: { rise: [2, 3], gap: [3, 4], width: [2, 3], plank: 0.20, nettle: 0.10, scree: 0.25 },
  hard:   { rise: [2, 4], gap: [3, 5], width: [2, 2], plank: 0.35, nettle: 0.20, scree: 0.15 },
};

// =========================================================================
// Core: build a chain of ledges climbing/traversing across the rect.
// Returns { ledges, hops, movers } in TILE coordinates.
//   ledge: { x, y, w, tile, scree, nettleX|null }
//   hop:   [[takeoffX, takeoffY], [landX, landY]]  (ledge EDGES)
// =========================================================================
function generate(cfg) {
  const { area, types, dir } = cfg;
  const d = DIFF[cfg.difficulty];
  const rand = rng(cfg.seed);

  const left = area.x, right = area.x + area.w - 1;
  const top = area.y, bottom = area.y + area.h - 1;
  // leave a row of air above the top ledge so full arcs aren't eaten
  const yHi = top + 1, yLo = bottom - 1;

  const ledges = [];
  const hops = [];
  const movers = [];

  // starting ledge — bottom-left, a couple tiles wide
  let w0 = Math.min(pick(rand, d.width[0], d.width[1]), area.w);
  let cur = { x: left, y: yLo, w: w0, tile: 1, scree: false, nettleX: null };
  ledges.push(cur);

  const horizon = dir === 'up' ? right : right;     // both fill rightward
  let guard = 0;
  while (guard++ < 4000) {
    const curRightEdge = cur.x + cur.w - 1;
    if (curRightEdge >= right - 1) break;           // ran out of canvas

    // decide vertical intent: climb until near the top, then oscillate
    const climbing = cur.y > yHi + 2;

    // try candidate hops, smaller-gap fallbacks, until one is reachable + fits
    let placed = null, moverGap = null;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      let rise = pick(rand, d.rise[0], d.rise[1]);  // tiles upward
      if (!climbing) rise = pick(rand, -2, 3);       // oscillate at altitude
      let gap = pick(rand, d.gap[0], d.gap[1]);       // tiles between edges

      const landY = cur.y - rise;
      if (landY < yHi || landY > yLo) continue;       // stay in the band

      const w = Math.min(pick(rand, d.width[0], d.width[1]), Math.max(1, right - (curRightEdge + gap)));
      if (w < 1) continue;
      const landLeft = curRightEdge + gap;
      if (landLeft + w - 1 > right) continue;          // overruns the rect

      if (reachable(curRightEdge, cur.y, landLeft, landY)) {
        placed = { x: landLeft, y: landY, w, tile: 1, scree: false, nettleX: null };
      } else if (types.has('mover') && !moverGap && gap <= 9) {
        // remember a too-long-but-bridgeable gap as a mover fallback
        moverGap = { fromX: curRightEdge, fromY: cur.y, landLeft, landY, w, gap };
      }
    }

    // no static hop found — bridge with a mover if enabled, else stop
    if (!placed) {
      if (moverGap) {
        const m = moverGap;
        const mw = 3;
        const mx = m.fromX + 2;
        movers.push({ x: mx, y: m.fromY, x2: Math.min(mx + 3, m.landLeft - 1), y2: m.fromY, w: mw, period: 300 });
        // hop onto the mover, then off it onto the landing ledge
        const land = { x: m.landLeft, y: m.landY, w: m.w, tile: 1, scree: false, nettleX: null };
        hops.push([[m.fromX, m.fromY], [mx, m.fromY]]);
        hops.push([[mx + mw - 1, m.fromY], [land.x, land.y]]);
        ledges.push(land);
        cur = land;
        continue;
      }
      break;
    }

    // decorate the landing ledge with enabled obstacle types
    if (types.has('plank') && rand() < d.plank) placed.tile = 3;            // one-way
    if (placed.tile === 1 && types.has('scree') && rand() < d.scree) placed.scree = true;
    if (types.has('nettle') && placed.w >= 3 && rand() < d.nettle)
      placed.nettleX = placed.x + 1 + Math.floor(rand() * (placed.w - 2));  // mid-ledge hazard

    hops.push([[curRightEdge, cur.y], [placed.x, placed.y]]);
    ledges.push(placed);
    cur = placed;
  }

  return { ledges, hops, movers };
}

// =========================================================================
// Emitters
// =========================================================================
function emitWorld(cfg, out) {
  const L = [];
  L.push(`  // --- ${cfg.name}: generated platforming (${cfg.difficulty}) ` +
         `area ${cfg.area.x},${cfg.area.y} ${cfg.area.w}x${cfg.area.h} `.padEnd(8, '-'));
  L.push(`  // seed ${cfg.seed} · types ${[...cfg.types].join(',')} · ${out.ledges.length} ledges`);
  if (cfg.carveSky)
    L.push(`  carve(${cfg.area.x}, ${cfg.area.y}, ${cfg.area.w}, ${cfg.area.h});` +
           `   // sky for the section — full arcs need the headroom`);
  if (cfg.types.has('water'))
    L.push(`  fill(${cfg.area.x}, ${cfg.area.y + cfg.area.h - 2}, ${cfg.area.w}, 2, 4);` +
           `   // the void below`);
  for (const lg of out.ledges) {
    const tname = lg.tile === 3 ? 'one-way plank' : 'rock';
    L.push(`  fill(${lg.x}, ${lg.y}, ${lg.w}, 1, ${lg.tile});` +
           `   // ledge ${tname} (x${lg.x}..${lg.x + lg.w - 1}, y${lg.y})`);
    if (lg.scree)
      L.push(`  fill(${lg.x}, ${lg.y}, ${lg.w}, 1, 2);   // loose scree cap`);
    if (lg.nettleX !== null)
      L.push(`  fill(${lg.nettleX}, ${lg.y - 1}, 1, 1, 6);   // nettles to hop`);
  }
  return L.join('\n');
}

function emitMovers(cfg, out) {
  if (!out.movers.length) return '';
  const rows = out.movers.map(m =>
    `  { x: ${m.x}, y: ${m.y}, x2: ${m.x2}, y2: ${m.y2}, w: ${m.w}, period: ${m.period} },` +
    `   // ${cfg.name} bridge`);
  return `// add to MOVERS in world.js:\n${rows.join('\n')}`;
}

function emitTests(cfg, out) {
  const v = cfg.name.replace(/[^a-zA-Z0-9]/g, '') || 'gen';
  const L = [];
  L.push(`// --- ${cfg.name}: generated platforming run (keep in sync with world.js) ---`);
  // ledge-exists assertions
  for (const lg of out.ledges) {
    const cx = lg.x + (lg.w >> 1);
    const want = lg.tile === 3 ? `=== 3` : `=== 1 || at(${cx}, ${lg.y}) === 2`;
    if (lg.tile === 3) L.push(`ok(at(${cx}, ${lg.y}) === 3, '${cfg.name} plank at ${cx},${lg.y}');`);
    else L.push(`ok(solid(at(${cx}, ${lg.y})), '${cfg.name} ledge at ${cx},${lg.y}');`);
  }
  // hop-reachability assertions (use check-world's own reachable())
  const pairs = out.hops.map(([a, b]) => `[[${a[0]}, ${a[1]}], [${b[0]}, ${b[1]}]]`).join(',\n  ');
  L.push(`const ${v}Hops = [\n  ${pairs}\n];`);
  L.push(`${v}Hops.forEach(([a, b], i) => ok(reachable(...a, ...b), '${cfg.name} hop ' + i + ' reachable'));`);
  return L.join('\n');
}

function preview(cfg, out) {
  const a = cfg.area;
  const grid = Array.from({ length: a.h }, () => Array(a.w).fill('·'));
  const put = (x, y, ch) => {
    const gx = x - a.x, gy = y - a.y;
    if (gy >= 0 && gy < a.h && gx >= 0 && gx < a.w) grid[gy][gx] = ch;
  };
  if (cfg.types.has('water')) for (let x = a.x; x < a.x + a.w; x++) { put(x, a.y + a.h - 1, '~'); put(x, a.y + a.h - 2, '~'); }
  for (const lg of out.ledges)
    for (let x = lg.x; x < lg.x + lg.w; x++) put(x, lg.y, lg.tile === 3 ? '=' : (lg.scree ? ':' : '#'));
  for (const lg of out.ledges) if (lg.nettleX !== null) put(lg.nettleX, lg.y - 1, '*');
  for (const m of out.movers) for (let x = m.x; x < m.x + m.w; x++) put(x, m.y, '-');
  const head = `   ASCII preview  (# rock  = plank  : scree  * nettle  - mover  ~ water)`;
  const body = grid.map((row, i) => String(a.y + i).padStart(4, ' ') + ' ' + row.join('')).join('\n');
  return `${head}\n${body}`;
}

// =========================================================================
// CLI
// =========================================================================
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const key = t.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[key] = true;       // flag
    else { a[key] = next; i++; }
  }
  return a;
}

function buildConfig(args) {
  if (!args.area) throw new Error('missing --area X,Y,W,H');
  const [x, y, w, h] = String(args.area).split(',').map(Number);
  if ([x, y, w, h].some(n => !Number.isFinite(n)) || w < 2 || h < 2)
    throw new Error('bad --area: expected four numbers X,Y,W,H (W,H >= 2)');

  const difficulty = (args.difficulty || 'medium').toLowerCase();
  if (!DIFF[difficulty]) throw new Error(`bad --difficulty: ${difficulty} (easy|medium|hard)`);

  const typeList = String(args.types || 'rock,plank').split(',').map(s => s.trim()).filter(Boolean);
  const known = new Set(['rock', 'plank', 'scree', 'nettle', 'water', 'mover']);
  for (const t of typeList) if (!known.has(t)) throw new Error(`unknown type: ${t} (${[...known].join('|')})`);
  const types = new Set(typeList);
  types.add('rock'); // ledges are always rock landings

  let dir = (args.dir || 'auto').toLowerCase();
  if (dir === 'auto') dir = h > w ? 'up' : 'across';

  return {
    area: { x, y, w, h },
    difficulty,
    types,
    dir,
    seed: args.seed !== undefined ? (Number(args.seed) >>> 0) : (Date.now() >>> 0),
    name: (args.name || 'gen').toString(),
    carveSky: !!args['carve-sky'],
  };
}

function main() {
  let cfg;
  try {
    cfg = buildConfig(parseArgs(process.argv.slice(2)));
  } catch (e) {
    console.error('error:', e.message);
    console.error('\nrun with --help-style usage; example:');
    console.error('  node tools/gen-platforming.js --area 200,40,30,24 --difficulty hard --types rock,plank,nettle --seed 7 --name testfeld');
    process.exit(2);
  }

  const out = generate(cfg);

  // self-verify: never emit an unreachable section
  const bad = out.hops.filter(([a, b]) => !reachable(a[0], a[1], b[0], b[1]));
  if (bad.length) {
    console.error(`internal error: ${bad.length} unreachable hop(s) generated — refusing to emit.`);
    process.exit(1);
  }
  if (out.ledges.length < 2) {
    console.error('only one ledge fit in the area — widen --area or lower --difficulty.');
    process.exit(1);
  }

  const bar = '='.repeat(74);
  console.log(`${bar}\n  GIPFELBUCH platforming section — ${cfg.name} (${cfg.difficulty}, seed ${cfg.seed})`);
  console.log(`  ${out.ledges.length} ledges · ${out.hops.length} hops · ${out.movers.length} mover(s)\n${bar}\n`);
  console.log(preview(cfg, out));
  console.log(`\n${bar}\n  1) paste into buildWorld() in world.js:\n${bar}`);
  console.log(emitWorld(cfg, out));
  const mv = emitMovers(cfg, out);
  if (mv) console.log('\n' + mv);
  console.log(`\n${bar}\n  2) paste into test/check-world.js (same commit!):\n${bar}`);
  console.log(emitTests(cfg, out));
  console.log(`\n${bar}\n  Review, paste BOTH blocks, then: npm test\n${bar}`);
}

if (require.main === module) main();

module.exports = { reachable, generate, buildConfig, emitWorld, emitTests, DIFF };
