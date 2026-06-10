/* Headless sanity checks for the world geometry.
   Run: node test/check-world.js */
const { TILE, WORLD_W, WORLD_H, buildWorld, WATERFALL, THERMALS, RINGS, MOVERS, ZONES, ENTITIES, TREES } = require('../world.js');

const g = buildWorld();
const at = (x, y) => (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) ? 1 : g[y * WORLD_W + x];
const solid = t => t === 1 || t === 2;

let fails = 0;
const ok = (cond, msg) => {
  if (!cond) { fails++; console.error('FAIL:', msg); }
  else console.log(' ok :', msg);
};

// --- every entity stands on solid ground (or one-way) with headroom -------
for (const e of ENTITIES) {
  if (e.t === 'spawn' || e.hide) continue;
  const below = at(e.x, e.r);
  const body1 = at(e.x, e.r - 1), body2 = at(e.x, e.r - 2);
  ok(solid(below) || below === 3, `${e.t}@${e.x},${e.r} has floor (tile=${below})`);
  ok(!solid(body1) && !solid(body2), `${e.t}@${e.x},${e.r} has headroom (${body1},${body2})`);
}

// --- spawn ---
const sp = ENTITIES.find(e => e.t === 'spawn');
ok(solid(at(sp.x, sp.r)) && !solid(at(sp.x, sp.r - 1)), 'spawn on solid ground with headroom');

// --- trees rooted ---
for (const t of TREES) ok(solid(at(t[0], t[1])), `tree@${t[0]},${t[1]} rooted`);

// --- gating chokepoints ----------------------------------------------------
// 1. cable column exists and reaches from Hochband floor (28) to ridge (12/13)
ok(at(95, 13) === 5 && at(95, 27) === 5, 'ferrata cable spans y13..27 at x95');
ok(solid(at(96, 12)), 'ridge floor next to cable top');
// 2. headwall seals the Hochband from the ridge except the cable
let sealed = true;
for (let x = 96; x <= 110; x++) for (let y = 19; y <= 27; y++) if (!solid(at(x, y))) sealed = false;
ok(sealed, 'headwall solid x96..110 y19..27 (no kit-free route up)');
// 3. tunnel corridor open y22..27 across x29..71, with ceiling above
let corridor = true, roofed = true;
for (let x = 30; x <= 71; x++) {
  let clear = 0;
  for (let y = 22; y <= 27; y++) if (!solid(at(x, y))) clear++;
  if (clear < 3) corridor = false;            // always at least 3 tiles to pass
  if (!solid(at(x, 21)) && !solid(at(x, 20))) roofed = false;
}
ok(corridor, 'tunnel corridor passable x30..71');
ok(roofed, 'tunnel has a ceiling');
// 4. notch carved (the Zinnensprung) with water far below
ok(!solid(at(172, 7)) && !solid(at(172, 12)), 'ridge notch carved at x172');
let clearDrop = true;
for (let y = 7; y < 70; y++) if (solid(at(172, y)) || at(172, y) === 3) clearDrop = false;
ok(clearDrop, 'notch drop column clear to the pond (no log in the way)');
ok(at(172, 70) === 4, 'pond under the notch');
// 5. gorge chimney carved through the upper band, lip at its mouth
ok(!solid(at(7, 30)) && !solid(at(7, 34)), 'chimney open at x7');
ok(solid(at(10, 28)) && !solid(at(9, 28)), 'landing lip at the chimney mouth, clear air west of it');
// 6. scree slope continuous from valley to Alm shelf
let prevTop = null, slopeOk = true, breachCols = 0;
for (let x = 111; x <= 152; x++) {
  let top = 20; // start below the ridge band overhead
  while (top < WORLD_H && !solid(at(x, top))) top++;
  const expected = 48 + Math.round(((x - 111) * 22) / 42);
  if (top !== expected || at(x, top) !== 2) { breachCols++; prevTop = top; continue; } // the Schartl breach
  if (prevTop !== null && Math.abs(top - prevTop) > 1) slopeOk = false;
  prevTop = top;
}
ok(slopeOk && breachCols <= 6, `scree slope continuous except the Schartl breach (${breachCols} cols)`);
ok(prevTop >= 69, 'scree base meets the valley');
// 7. Alm shelf walkable surface at y48 from x33..110 (minus entities)
let shelf = true;
for (let x = 33; x <= 110; x++) if (!solid(at(x, 48)) || solid(at(x, 47))) shelf = false;
ok(shelf, 'Alm shelf walkable x33..110 at y48');
// 8. valley floor continuous (solid at y70 or water) x2..261, both valleys
let valley = true;
for (let x = 2; x <= 261; x++) { const t = at(x, 70); if (!solid(t) && t !== 4 && t !== 3) valley = false; }
ok(valley, 'valley floor continuous (ground or water)');
// 9. lower gorge ledge ladder exists
for (const [x, y] of [[3, 66], [9, 63], [14, 60], [19, 57], [24, 54], [29, 51]]) ok(solid(at(x, y)), `gorge ledge at ${x},${y}`);
// 10. upper gorge ledge ladder exists
for (const [x, y] of [[26, 45], [21, 42], [8, 38], [4, 35], [8, 32], [4, 29]]) ok(solid(at(x, y)), `upper ledge at ${x},${y}`);
// the hoist bridges the removed middle step
{
  const m = MOVERS[0];
  ok(m && m.y === 40 && m.y2 === 40 && m.x === 13 && m.x2 === 18 && m.w === 3, 'hoist runs x13..21 at row 40');
  let clear = true; // its whole track must be open air
  for (let x = m.x; x < m.x2 + m.w; x++) for (let y = 38; y <= 41; y++) if (solid(at(x, y))) clear = false;
  ok(clear, 'hoist track is clear of rock');
}
// the observer post above the Stellung — a long, airy climb
for (const [x, y] of [[14, 25], [9, 23], [14, 21], [18, 19], [13, 17], [7, 15], [12, 13], [6, 10]]) ok(solid(at(x, y)) || at(x, y) === 3, `lookout ledge at ${x},${y}`);
{
  let head = true;
  for (const [x, y] of [[14, 24], [9, 22], [14, 20], [18, 18], [13, 16], [7, 14], [12, 12], [6, 9]]) if (solid(at(x, y)) || solid(at(x, y - 1))) head = false;
  ok(head, 'lookout ledges have headroom');
}
ok(ENTITIES.some(e => e.t === 'gear' && e.gear === 'lamp' && e.r <= 10), 'lamp waits at the observer post (above the tunnel mouth level)');
// one-way plank adds commitment to the climb
ok(at(18, 19) === 3, 'observer post has a one-way plank at the midpoint');
// the depot above the tunnel's east mouth
for (const [x, y] of [[77, 25], [73, 22], [66, 19]]) ok(solid(at(x, y)), `depot ledge/floor at ${x},${y}`);
ok(!solid(at(66, 17)) && !solid(at(66, 14)) && solid(at(66, 12)), 'depot nook carved with a roof');
ok(!solid(at(72, 17)) && !solid(at(72, 18)), 'depot nook opens east');
{
  let roofOk = true;
  for (let x = 63; x <= 72; x++) for (let y = 19; y <= 21; y++) if (!solid(at(x, y))) roofOk = false;
  ok(roofOk, 'tunnel roof stays 3 thick under the depot');
}
ok(ENTITIES.some(e => e.t === 'gear' && e.gear === 'kit' && e.r <= 19), 'ferrata set waits up at the depot');
ok(ENTITIES.filter(e => e.t === 'chestnut' && e.x < 60).length >= 1, 'a chestnut waits west of the Alm — the quest sends you somewhere new');
// 11. waterfall column intersects both climbs
const wf = WATERFALL;
ok(wf.x <= 25 && wf.x + wf.w >= 27, 'waterfall covers the crossing ledges');
// 12. zones cover all entities
for (const e of ENTITIES) {
  if (e.hide) continue;
  const inZone = ZONES.some(z => e.x >= z.x && e.x < z.x + z.w && e.r - 1 >= z.y && e.r - 1 < z.y + z.h);
  ok(inZone, `${e.t}@${e.x},${e.r} inside a named zone`);
}
// 13. jump reachability between ledge EDGES, derived from the real arc:
//     v0 = 8.4 px/f, g = 0.42 px/f², vx = 2.3 px/f  =>  apex 5.25 tiles,
//     horizontal range while above +dy tiles shrinks as dy grows.
function reachable(fromX, fromY, toX, toY) {
  const dx = Math.abs(toX - fromX), dy = fromY - toY; // dy>0 = upward
  if (dy > 4.3) return false;
  const maxDx = dy >= 4 ? 4 : dy >= 3 ? 4.5 : dy >= 1 ? 5 : 5.5 + Math.min(2, -dy * 0.5);
  return dx <= maxDx;
}
// hop pairs: [takeoff edge] -> [landing edge]
const lowerHops = [
  [[5, 70], [4, 66]],    // valley -> A (straight up + a step)
  [[6, 66], [9, 63]],
  [[11, 63], [14, 60]],
  [[16, 60], [19, 57]],
  [[21, 57], [24, 54]],  // into the falls
  [[26, 54], [29, 51]],
  [[30, 51], [32, 48]],  // onto the Alm shelf
];
lowerHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `lower gorge hop ${i} reachable`));
const upperHops = [
  [[32, 48], [28, 45]],  // off the shelf into the falls
  [[26, 45], [23, 42]],
  [[21, 42], [20, 40]],  // onto the hoist at its east end
  [[13, 40], [11, 38]],  // off the hoist at its west end
  [[8, 38], [6, 35]],    // into the chimney
  [[6, 35], [8, 32]],
  [[8, 32], [6, 29]],
  [[6, 29], [10, 28]],   // onto the lip — top out
];
upperHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `upper gorge hop ${i} reachable`));
const lookoutHops = [
  [[16, 28], [15, 25]],  // Stellung → first narrow ledge
  [[14, 25], [10, 23]],  // left step
  [[10, 23], [15, 21]],  // back right — precision
  [[15, 21], [19, 19]],  // onto the one-way plank
  [[18, 19], [14, 17]],  // back left
  [[13, 17], [8, 15]],   // further left, exposed
  [[8, 15], [13, 13]],   // back right near the top
  [[12, 13], [9, 10]],   // onto the lookout shelf
];
lookoutHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `lookout hop ${i} reachable`));
const depotHops = [
  [[81, 28], [79, 25]],
  [[77, 25], [74, 22]],
  [[73, 22], [71, 19]],
];
depotHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `depot hop ${i} reachable`));
// ridge hops: the climb from the shoulder to the summit and down the east side
const ridgeHops = [
  // Stage 1 — The Shoulder
  [[104, 12], [108, 10]],   // entry platform -> first step up
  // Stage 2 — The Knife Edge
  [[108, 10], [112, 8]],    // step -> ledge
  [[112, 8], [117, 6]],     // ledge -> higher
  [[117, 6], [122, 4]],     // -> knife edge high point
  [[122, 4], [128, 7]],     // -> deep saddle (big drop!)
  // Stage 3 — The Summit Block
  [[128, 7], [133, 5]],     // saddle -> ledge
  [[133, 5], [137, 3]],     // -> sub-peak
  [[137, 3], [143, 6]],     // -> deep saddle (big drop!)
  [[143, 6], [148, 4]],     // -> ledge
  [[148, 4], [153, 2]],     // -> the pinnacle!
  [[153, 2], [157, 3]],     // pinnacle -> summit plateau (short drop, walk across)
  // Stage 4 — East Ridge descent
  [[165, 3], [169, 5]],     // summit -> descent ledge
  [[169, 5], [173, 7]],     // -> pre-notch
  [[176, 7], [178, 7]],     // post-notch -> same level
  [[178, 7], [184, 9]],     // -> lower ledge
  [[184, 9], [189, 11]],    // -> final ledge
];
ridgeHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `ridge hop ${i} reachable`));
// summit plateau is solid and has headroom
ok(solid(at(159, 3)) && solid(at(163, 3)), 'summit plateau solid at key points');
ok(!solid(at(159, 2)) && !solid(at(163, 2)), 'summit has headroom');

// 14. pond crossing: bank -> log -> bank
ok(at(169, 69) === 3 && at(170, 69) === 3, 'pond log present');
ok(solid(at(166, 70)) && solid(at(174, 70)), 'pond banks solid');

// 15. das Schartl: walkable from the Lärchenschatten (x109) onto the scree,
//     every step at most 1 tile up / 2 down, with 2+ tiles of headroom
{
  // walk-sim: from the gallery floor, step east; each column must offer a
  // floor within +1 (hop up) / -3 (drop) of the current one, with headroom
  let walkable = true, f = 70, details = '';
  for (let x = 110; x <= 152; x++) {
    let next = null;
    for (let cand = f - 1; cand <= f + 3; cand++) {
      if (cand < 1 || cand >= WORLD_H) continue;
      if (solid(at(x, cand)) && !solid(at(x, cand - 1)) && !solid(at(x, cand - 2))) { next = cand; break; }
    }
    if (next === null) { walkable = false; details += ` blocked@x${x}(f${f})`; break; }
    f = next;
  }
  ok(walkable && f >= 69, `Schartl path walkable gallery->forest${details} (ends floor ${f})`);
  // and the Alm is still boots-gated: above the breach there must be 6+ rows of scree climb
  let breachX = 152;
  for (let x = 111; x <= 152; x++) { if (!solid(at(x, 48 + Math.round(((x - 111) * 22) / 42)))) { breachX = x; break; } }
  ok(breachX >= 125, `scree climb above the Schartl breach still gates the Alm (breach at x${breachX})`);
}

// 16. Hinteres Tal
ok(!solid(at(190, 8)) && !solid(at(191, 8)), 'slip behind the Flugschule sign is open (y5..11)');
ok(solid(at(190, 12)) && solid(at(190, 4)), 'massif face solid above and below the slip');
ok(solid(at(192, 12)) && solid(at(197, 12)), 'launch ledge present');
ok(at(193, 13) === 5 && at(193, 69) === 5, 'return cable spans the east face');
ok(at(234, 70) === 4 && solid(at(230, 70)) && solid(at(239, 70)), 'lake carved with solid banks');
for (const [rx, ry] of RINGS) ok(!solid(at(rx, ry)), `ring at ${rx},${ry} hangs in air`);
for (const t of THERMALS) {
  let clear = true;
  const cxm = t.x + (t.w >> 1);
  for (let y = t.y + 2; y < t.y + t.h - 4; y++) if (solid(at(cxm, y))) clear = false;
  ok(clear, `thermal at x${t.x} has a clear core`);
}

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECKS FAILED`);
process.exit(fails ? 1 : 0);
