/* Headless sanity checks for the world geometry.
   Run: node test/check-world.js */
const { TILE, WORLD_W, WORLD_H, buildWorld, WATERFALL, THERMALS, RINGS, MOVERS, ZONES, ENTITIES, TREES } = require('../world.js');

const g = buildWorld();
const Y_OFF = WORLD_H - 80;
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
// 1. ferrata: two pitches; the two-row gap forces a stop at the lower anchor
ok(at(95, 12 + Y_OFF) === 5 && at(95, 18 + Y_OFF) === 5, 'ferrata upper pitch spans y12..18 at x95');
ok(at(95, 21 + Y_OFF) === 5 && at(95, 27 + Y_OFF) === 5, 'ferrata lower pitch spans y21..27 at x95');
ok(at(95, 19 + Y_OFF) === 0 && at(95, 20 + Y_OFF) === 0, 'two-row gap between the pitches (forced belay stop)');
ok(solid(at(91, 21 + Y_OFF)) && solid(at(92, 21 + Y_OFF)) && solid(at(93, 21 + Y_OFF)), 'belay ledge x91..93 at y21');
ok(!solid(at(91, 20 + Y_OFF)) && !solid(at(92, 20 + Y_OFF)) && !solid(at(93, 20 + Y_OFF)) && !solid(at(92, 19 + Y_OFF)) && !solid(at(93, 19 + Y_OFF)), 'belay ledge has headroom');
{
  let corridor = true;
  for (let y = 13 + Y_OFF; y <= 27 + Y_OFF; y++) if (solid(at(94, y))) corridor = false;
  ok(corridor, 'climb corridor beside the cable (x94) stays clear');
}
ok(solid(at(96, 12 + Y_OFF)), 'ridge floor next to cable top');
// 2. headwall seals the Hochband from the ridge except the cable
let sealed = true;
for (let x = 96; x <= 110; x++) for (let y = 19 + Y_OFF; y <= 27 + Y_OFF; y++) if (!solid(at(x, y))) sealed = false;
ok(sealed, 'headwall solid x96..110 y19..27 (no kit-free route up)');
// 3. tunnel corridor open y22..27 across x29..71, with ceiling above
let corridor = true, roofed = true;
for (let x = 30; x <= 71; x++) {
  let clear = 0;
  for (let y = 22 + Y_OFF; y <= 27 + Y_OFF; y++) if (!solid(at(x, y))) clear++;
  if (clear < 3) corridor = false;            // always at least 3 tiles to pass
  if (!solid(at(x, 21 + Y_OFF)) && !solid(at(x, 20 + Y_OFF))) roofed = false;
}
ok(corridor, 'tunnel corridor passable x30..71');
ok(roofed, 'tunnel has a ceiling');
// 4. notch carved (the Zinnensprung) with water far below
ok(!solid(at(172, 7 + Y_OFF)) && !solid(at(172, 12 + Y_OFF)), 'ridge notch carved at x172');
let clearDrop = true;
for (let y = 7 + Y_OFF; y < 70 + Y_OFF; y++) if (solid(at(172, y)) || at(172, y) === 3) clearDrop = false;
ok(clearDrop, 'notch drop column clear to the pond (no log in the way)');
ok(at(172, 70 + Y_OFF) === 4, 'pond under the notch');
// 5. gorge chimney carved through the upper band, lip at its mouth
ok(!solid(at(7, 30 + Y_OFF)) && !solid(at(7, 34 + Y_OFF)), 'chimney open at x7');
ok(solid(at(10, 28 + Y_OFF)) && !solid(at(9, 28 + Y_OFF)), 'landing lip at the chimney mouth, clear air west of it');
// 6. scree slope continuous from valley to Alm shelf
let prevTop = null, slopeOk = true, breachCols = 0;
for (let x = 111; x <= 152; x++) {
  let top = 36 + Y_OFF; // start below the solid mountain block (y14..35 + Y_OFF)
  while (top < WORLD_H && !solid(at(x, top))) top++;
  const expected = 48 + Y_OFF + Math.round(((x - 111) * 22) / 42);
  if (top !== expected || at(x, top) !== 2) { breachCols++; prevTop = top; continue; } // the Schartl breach
  if (prevTop !== null && Math.abs(top - prevTop) > 1) slopeOk = false;
  prevTop = top;
}
ok(slopeOk && breachCols <= 6, `scree slope continuous except the Schartl breach (${breachCols} cols)`);
ok(prevTop >= 69 + Y_OFF, 'scree base meets the valley');
// 7. Alm shelf walkable surface at y48 from x33..110 (minus entities)
let shelf = true;
for (let x = 33; x <= 110; x++) if (!solid(at(x, 48 + Y_OFF)) || solid(at(x, 47 + Y_OFF))) shelf = false;
ok(shelf, 'Alm shelf walkable x33..110 at y48');
// 8. valley floor continuous (solid at y70 or water) x2..261, both valleys
let valley = true;
for (let x = 2; x <= 261; x++) { const t = at(x, 70 + Y_OFF); if (!solid(t) && t !== 4 && t !== 3) valley = false; }
ok(valley, 'valley floor continuous (ground or water)');
// 9. lower gorge ledge ladder exists
for (const [x, y] of [[3, 66], [9, 63], [14, 60], [19, 57], [24, 54], [29, 51]]) ok(solid(at(x, y + Y_OFF)), `gorge ledge at ${x},${y + Y_OFF}`);
// 10. upper gorge ledge ladder exists
for (const [x, y] of [[26, 45], [21, 42], [8, 38], [4, 35], [8, 32], [4, 29]]) ok(solid(at(x, y + Y_OFF)), `upper ledge at ${x},${y + Y_OFF}`);
// the hoist bridges the removed middle step
{
  const m = MOVERS[0];
  ok(m && m.y === 40 + Y_OFF && m.y2 === 40 + Y_OFF && m.x === 13 && m.x2 === 18 && m.w === 3, 'hoist runs x13..21 at row 40');
  let clear = true; // its whole track must be open air
  for (let x = m.x; x < m.x2 + m.w; x++) for (let y = 38 + Y_OFF; y <= 41 + Y_OFF; y++) if (solid(at(x, y))) clear = false;
  ok(clear, 'hoist track is clear of rock');
}
// the observer post above the Stellung — a long, airy climb
for (const [x, y] of [[14, 25], [11, 23], [17, 21], [20, 19], [16, 15], [10, 13], [6, 10]]) ok(solid(at(x, y + Y_OFF)) || at(x, y + Y_OFF) === 3, `lookout ledge at ${x},${y + Y_OFF}`);
{
  let head = true;
  for (const [x, y] of [[14, 24], [11, 22], [17, 20], [20, 18], [16, 14], [10, 12], [6, 9]]) if (solid(at(x, y + Y_OFF)) || solid(at(x, y - 1 + Y_OFF))) head = false;
  ok(head, 'lookout ledges have headroom');
}
// no ledge sits in the jump arc directly above another (head-bonk guard)
{
  let clear = true;
  for (const [x0, x1, y] of [[14, 15, 25], [11, 12, 23], [17, 18, 21], [16, 17, 15], [10, 11, 13]])
    for (let x = x0; x <= x1; x++) for (let dy = 1; dy <= 4; dy++) if (solid(at(x, y + Y_OFF - dy))) clear = false;
  ok(clear, 'lookout ledges have 4 rows of open sky above');
}
ok(ENTITIES.some(e => e.t === 'gear' && e.gear === 'lamp' && e.r <= 10 + Y_OFF), 'lamp waits at the observer post (above the tunnel mouth level)');
// one-way plank adds commitment to the climb
ok(at(20, 19 + Y_OFF) === 3, 'observer post has a one-way plank at the midpoint');
// the depot above the tunnel's east mouth — a five-hop climb to the set
for (const [x, y] of [[78, 26], [84, 23], [81, 21], [63, 17], [58, 16], [54, 15]]) ok(solid(at(x, y + Y_OFF)), `depot ledge/floor at ${x},${y + Y_OFF}`);
ok(at(75, 19 + Y_OFF) === 3 && at(76, 19 + Y_OFF) === 3, 'depot plank at the nook mouth (one-way)');
ok(!reachable(80, 28 + Y_OFF, 84, 23 + Y_OFF) && !reachable(80, 28 + Y_OFF, 82, 21 + Y_OFF), 'depot climb cannot be skipped from the floor');
ok(!solid(at(54, 14 + Y_OFF)) && solid(at(54, 12 + Y_OFF)), 'depot nook carved with a roof');
ok(!solid(at(72, 17 + Y_OFF)) && !solid(at(72, 18 + Y_OFF)), 'depot nook opens east');
{
  let roofOk = true;
  for (let x = 52; x <= 72; x++) for (let y = 19 + Y_OFF; y <= 21 + Y_OFF; y++) if (!solid(at(x, y))) roofOk = false;
  ok(roofOk, 'tunnel roof stays 3 thick under the depot');
}
ok(ENTITIES.some(e => e.t === 'gear' && e.gear === 'kit' && e.r <= 19 + Y_OFF), 'ferrata set waits up at the depot');
ok(ENTITIES.some(e => e.t === 'gear' && e.gear === 'glider' && e.r <= 11 + Y_OFF), 'paraglider waits behind the flug sign');
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
  [[14, 25], [13, 23]],  // short step left
  [[13, 23], [17, 21]],  // long leap back right — precision
  [[19, 21], [19, 19]],  // straight up onto the one-way plank
  [[19, 19], [15, 17]],  // back left
  [[15, 17], [16, 15]],  // up the right edge
  [[16, 15], [12, 13]],  // long leap left near the top
  [[10, 13], [9, 10]],   // onto the lookout shelf
];
lookoutHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `lookout hop ${i} reachable`));
const depotHops = [
  [[80, 28], [79, 26]],   // off the Hochband floor
  [[80, 26], [84, 23]],   // a long rising leap right
  [[84, 23], [82, 21]],   // back left onto the one-tile perch
  [[81, 21], [77, 19]],   // perch -> one-way plank
  [[75, 19], [73, 19]],   // plank -> across the nook mouth
  [[68, 19], [64, 17]],   // nook floor -> Ledge A
  [[63, 17], [61, 16]],   // Ledge A -> Ledge B (one low step — the roof is close)
  [[56, 16], [55, 15]],   // Ledge B -> Ledge C (kit)
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
  // Stage 3 — The Summit Block (the supply hoist bridges the saddle)
  [[128, 7], [133, 5]],     // saddle -> ledge
  [[133, 5], [135, 3]],     // -> sub-peak
  [[137, 3], [139, 6]],     // -> the supply hoist at its west end
  [[144, 6], [146, 4]],     // off the hoist at its east end
  [[148, 4], [150, 2]],     // -> pinnacle
  [[153, 2], [157, 3]],     // -> summit plateau, the true high point
  // Stage 4 — East Ridge descent
  [[165, 3], [169, 5]],     // summit -> descent ledge
  [[169, 5], [173, 7]],     // -> pre-notch
  [[176, 7], [178, 7]],     // post-notch -> same level
  [[178, 7], [184, 9]],     // -> lower ledge
  [[184, 9], [189, 11]],    // -> final ledge
];
ridgeHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `ridge hop ${i} reachable`));
// summit plateau is solid and has headroom
ok(solid(at(159, 3 + Y_OFF)) && solid(at(163, 3 + Y_OFF)), 'summit plateau solid at key points');
ok(!solid(at(159, 2 + Y_OFF)) && !solid(at(163, 2 + Y_OFF)), 'summit has headroom');
// the Gipfel is the single highest ground in the Gamstal (walls excluded)
{
  let minTop = WORLD_H, cols = [];
  for (let x = 2; x <= 189; x++) {
    let top = WORLD_H;
    for (let y = 0; y < WORLD_H; y++) if (solid(at(x, y))) { top = y; break; }
    if (top < minTop) { minTop = top; cols = [x]; }
    else if (top === minTop) cols.push(x);
  }
  ok(minTop === 2 + Y_OFF && cols.every(x => x >= 150 && x <= 153),
    `summit plateau is the highest ground (row ${minTop} at x${cols[0]}..${cols[cols.length - 1]})`);
}
// the summit supply hoist bridges the saddle gap
{
  const m2 = MOVERS[1];
  ok(m2 && m2.y === 6 + Y_OFF && m2.y2 === 6 + Y_OFF && m2.x === 138 && m2.x2 === 142 && m2.w === 3, `summit hoist runs x138..145 at row ${6 + Y_OFF}`);
  let clear = true;
  for (let x = m2.x; x < m2.x2 + m2.w; x++) for (let y = 4 + Y_OFF; y <= 7 + Y_OFF; y++) if (solid(at(x, y))) clear = false;
  ok(clear, 'summit hoist track is clear of rock');
}
// the observer hoist
{
  const m3 = MOVERS[2];
  ok(m3 && m3.y === 17 + Y_OFF && m3.y2 === 17 + Y_OFF && m3.x === 11 && m3.x2 === 14 && m3.w === 2, `observer hoist runs x11..15 at row ${17 + Y_OFF}`);
  let clear = true;
  for (let x = m3.x; x < m3.x2 + m3.w; x++) for (let y = 15 + Y_OFF; y <= 18 + Y_OFF; y++) if (solid(at(x, y))) clear = false;
  ok(clear, 'observer hoist track is clear of rock');
}
// solid ground under the upper ridge catches falls and funnels back onto the route
ok(solid(at(111, 14 + Y_OFF)) && solid(at(128, 14 + Y_OFF)) && solid(at(145, 14 + Y_OFF)) && solid(at(156, 14 + Y_OFF)), 'solid ground under the upper ridge at y14');
ok(at(113, 11 + Y_OFF) !== 3 && !solid(at(113, 11 + Y_OFF)), 'catwalk west re-entry plank is removed');
ok(at(123, 11 + Y_OFF) === 3 && at(124, 11 + Y_OFF) === 3 && !solid(at(123, 10 + Y_OFF)) && !solid(at(124, 10 + Y_OFF)), 'catwalk east re-entry plank under the saddle');
ok(reachable(124, 14 + Y_OFF, 123, 11 + Y_OFF) && reachable(125, 11 + Y_OFF, 126, 7 + Y_OFF), 'catwalk -> saddle re-entry reachable');

// 14. pond crossing: bank -> log -> bank
ok(at(169, 69 + Y_OFF) === 3 && at(170, 69 + Y_OFF) === 3, 'pond log present');
ok(solid(at(166, 70 + Y_OFF)) && solid(at(174, 70 + Y_OFF)), 'pond banks solid');

// 15. das Schartl: walkable from the Lärchenschatten (x109) onto the scree,
//     every step at most 1 tile up / 2 down, with 2+ tiles of headroom
{
  // walk-sim: from the gallery floor, step east; each column must offer a
  // floor within +1 (hop up) / -3 (drop) of the current one, with headroom
  let walkable = true, f = 70 + Y_OFF, details = '';
  for (let x = 110; x <= 152; x++) {
    let next = null;
    for (let cand = f - 1; cand <= f + 3; cand++) {
      if (cand < 1 || cand >= WORLD_H) continue;
      if (solid(at(x, cand)) && !solid(at(x, cand - 1)) && !solid(at(x, cand - 2))) { next = cand; break; }
    }
    if (next === null) { walkable = false; details += ` blocked@x${x}(f${f})`; break; }
    f = next;
  }
  ok(walkable && f >= 69 + Y_OFF, `Schartl path walkable gallery->forest${details} (ends floor ${f})`);
  // and the Alm is still boots-gated: above the breach there must be 6+ rows of scree climb
  let breachX = 152;
  for (let x = 111; x <= 152; x++) { if (!solid(at(x, 48 + Y_OFF + Math.round(((x - 111) * 22) / 42)))) { breachX = x; break; } }
  ok(breachX >= 125, `scree climb above the Schartl breach still gates the Alm (breach at x${breachX})`);
}

// 16. Hinteres Tal
ok(!solid(at(190, 8 + Y_OFF)) && !solid(at(191, 8 + Y_OFF)), 'slip behind the Flugschule sign is open (y5..11)');
ok(solid(at(190, 12 + Y_OFF)) && solid(at(190, 4 + Y_OFF)), 'massif face solid above and below the slip');
ok(solid(at(192, 12 + Y_OFF)) && solid(at(197, 12 + Y_OFF)), 'launch ledge present');
ok(at(193, 13 + Y_OFF) === 5 && at(193, 69 + Y_OFF) === 5, 'return cable spans the east face');
ok(at(234, 70 + Y_OFF) === 4 && solid(at(230, 70 + Y_OFF)) && solid(at(239, 70 + Y_OFF)), 'lake carved with solid banks');
for (const [rx, ry] of RINGS) ok(!solid(at(rx, ry)), `ring at ${rx},${ry} hangs in air`);
for (const t of THERMALS) {
  let clear = true;
  const cxm = t.x + (t.w >> 1);
  for (let y = t.y + 2; y < t.y + t.h - 4; y++) if (solid(at(cxm, y))) clear = false;
  ok(clear, `thermal at x${t.x} has a clear core`);
}

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECKS FAILED`);
process.exit(fails ? 1 : 0);
