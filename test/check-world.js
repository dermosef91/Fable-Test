/* Headless sanity checks for the world geometry.
   Run: node test/check-world.js */
const { TILE, WORLD_W, WORLD_H, buildWorld, WATERFALL, THERMALS, SINK, RINGS, MOVERS, CRUMBLE, STONEFALL, ZONES, ENTITIES, TREES } = require('../world.js');

const g = buildWorld();
const Y_OFF = WORLD_H - 80;
const at = (x, y) => (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) ? 1 : g[y * WORLD_W + x];
const solid = t => t === 1 || t === 2 || t === 7;

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
ok(at(71, 12 + Y_OFF) === 5 && at(71, 18 + Y_OFF) === 5, 'ferrata upper pitch spans y12..18 at x71');
ok(at(71, 21 + Y_OFF) === 5 && at(71, 27 + Y_OFF) === 5, 'ferrata lower pitch spans y21..27 at x71');
ok(at(71, 19 + Y_OFF) === 0 && at(71, 20 + Y_OFF) === 0, 'two-row gap between the pitches (forced belay stop)');
ok(solid(at(67, 21 + Y_OFF)) && solid(at(68, 21 + Y_OFF)) && solid(at(69, 21 + Y_OFF)), 'belay ledge x67..69 at y21');
ok(!solid(at(67, 20 + Y_OFF)) && !solid(at(68, 20 + Y_OFF)) && !solid(at(69, 20 + Y_OFF)) && !solid(at(68, 19 + Y_OFF)) && !solid(at(69, 19 + Y_OFF)), 'belay ledge has headroom');
{
  let corridor = true;
  for (let y = 13 + Y_OFF; y <= 27 + Y_OFF; y++) if (solid(at(70, y))) corridor = false;
  ok(corridor, 'climb corridor beside the cable (x70) stays clear');
}
ok(solid(at(72, 12 + Y_OFF)), 'ridge floor next to cable top');
// 2. headwall seals the Hochband from the ridge except the cable
let sealed = true;
for (let x = 72; x <= 86; x++) for (let y = 19 + Y_OFF; y <= 27 + Y_OFF; y++) if (!solid(at(x, y))) sealed = false;
ok(sealed, 'headwall solid x72..86 y19..27 (no kit-free route up)');
// 3. tunnel corridor open y22..27 across x29..59, with ceiling above
let corridor = true, roofed = true;
for (let x = 30; x <= 59; x++) {
  let clear = 0;
  for (let y = 22 + Y_OFF; y <= 27 + Y_OFF; y++) if (!solid(at(x, y))) clear++;
  if (clear < 3) corridor = false;            // always at least 3 tiles to pass
  if (!solid(at(x, 21 + Y_OFF)) && !solid(at(x, 20 + Y_OFF))) roofed = false;
}
ok(corridor, 'tunnel corridor passable x30..59');
ok(roofed, 'tunnel has a ceiling');
// 4. the Scharte (the Zinnensprung): open from the crest straight into the pond
ok(!solid(at(148, 7 + Y_OFF)) && !solid(at(149, 7 + Y_OFF)), 'Scharte open at the crest (x148..149)');
let clearDrop = true;
for (const dropX of [148, 149])
  for (let y = 5 + Y_OFF; y < 70 + Y_OFF; y++) if (solid(at(dropX, y)) || at(dropX, y) === 3) clearDrop = false;
ok(clearDrop, 'Scharte drop column clear to the pond (no log in the way)');
ok(at(148, 70 + Y_OFF) === 4 && at(149, 70 + Y_OFF) === 4, 'pond directly under the Scharte');
ok(solid(at(147, 7 + Y_OFF)) && solid(at(150, 7 + Y_OFF)), 'solid rims on both sides of the Scharte');
// 5. gorge chimney carved through the upper band, lip at its mouth
ok(!solid(at(7, 30 + Y_OFF)) && !solid(at(7, 34 + Y_OFF)), 'chimney open at x7');
ok(solid(at(10, 28 + Y_OFF)) && !solid(at(9, 28 + Y_OFF)), 'landing lip at the chimney mouth, clear air west of it');
// 6. scree slope continuous from valley to Alm shelf
let prevTop = null, slopeOk = true, breachCols = 0;
for (let x = 87; x <= 128; x++) {
  let top = 36 + Y_OFF; // start below the solid mountain block (y14..35 + Y_OFF)
  while (top < WORLD_H && !solid(at(x, top))) top++;
  const expected = 48 + Y_OFF + Math.round(((x - 87) * 22) / 41);
  if (top !== expected || at(x, top) !== 2) { breachCols++; prevTop = top; continue; } // the Schartl breach
  if (prevTop !== null && Math.abs(top - prevTop) > 1) slopeOk = false;
  prevTop = top;
}
ok(slopeOk && breachCols <= 6, `scree slope continuous except the Schartl breach (${breachCols} cols)`);
ok(prevTop >= 69 + Y_OFF, 'scree base meets the valley');
// 7. Alm shelf walkable surface at y48 from x33..86 (minus entities)
let shelf = true;
for (let x = 33; x <= 86; x++) if (!solid(at(x, 48 + Y_OFF)) || solid(at(x, 47 + Y_OFF))) shelf = false;
ok(shelf, 'Alm shelf walkable x33..86 at y48');
// 8. valley floor continuous (solid at y70 or water) x2..237, both valleys
let valley = true;
for (let x = 2; x <= 237; x++) { const t = at(x, 70 + Y_OFF); if (!solid(t) && t !== 4 && t !== 3) valley = false; }
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
for (const [x, y] of [[14, 25], [11, 23], [17, 21], [20, 19], [16, 15], [6, 10]]) ok(solid(at(x, y + Y_OFF)) || at(x, y + Y_OFF) === 3, `lookout ledge at ${x},${y + Y_OFF}`);
{
  let head = true;
  for (const [x, y] of [[14, 24], [11, 22], [17, 20], [20, 18], [16, 13], [6, 9]]) if (solid(at(x, y + Y_OFF)) || solid(at(x, y - 1 + Y_OFF))) head = false;
  ok(head, 'lookout ledges have headroom');
}
// no ledge sits in the jump arc directly above another (head-bonk guard)
{
  let clear = true;
  for (const [x0, x1, y] of [[14, 15, 25], [11, 12, 23], [17, 18, 21], [16, 17, 14]])
    for (let x = x0; x <= x1; x++) for (let dy = 1; dy <= 4; dy++) if (solid(at(x, y + Y_OFF - dy))) clear = false;
  ok(clear, 'lookout ledges have 4 rows of open sky above');
}
ok(ENTITIES.some(e => e.t === 'gear' && e.gear === 'lamp' && e.r <= 10 + Y_OFF), 'lamp waits at the observer post (above the tunnel mouth level)');
// one-way plank adds commitment to the climb
ok(at(20, 19 + Y_OFF) === 3, 'observer post has a one-way plank at the midpoint');
// the depot above the tunnel's east mouth — a five-hop climb to the set
for (const [x, y] of [[66, 26], [72, 23], [69, 21], [51, 17], [46, 15], [40, 15]]) ok(solid(at(x, y + Y_OFF)), `depot ledge/floor at ${x},${y + Y_OFF}`);
ok(at(63, 19 + Y_OFF) === 3 && at(64, 19 + Y_OFF) === 3, 'depot plank at the nook mouth (one-way)');
ok(!reachable(68, 28 + Y_OFF, 72, 23 + Y_OFF) && !reachable(68, 28 + Y_OFF, 70, 21 + Y_OFF), 'depot climb cannot be skipped from the floor');
ok(!solid(at(42, 14 + Y_OFF)) && solid(at(42, 12 + Y_OFF)), 'depot nook carved with a roof');
ok(!solid(at(60, 17 + Y_OFF)) && !solid(at(60, 18 + Y_OFF)), 'depot nook opens east');
{
  let roofOk = true;
  for (let x = 40; x <= 60; x++) for (let y = 19 + Y_OFF; y <= 21 + Y_OFF; y++) if (!solid(at(x, y))) roofOk = false;
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
  [[19, 19], [17, 15]],  // the full-stretch leap up the right edge
  [[17, 15], [14, 13]],  // onto the hoist at its east end
  [[9, 13], [8, 10]],    // off the hoist at its west end, onto the shelf
];
lookoutHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `lookout hop ${i} reachable`));
const depotHops = [
  [[68, 28], [67, 26]],   // off the Hochband floor
  [[68, 26], [72, 23]],   // a long rising leap right
  [[72, 23], [70, 21]],   // back left onto the one-tile perch
  [[69, 21], [65, 19]],   // perch -> one-way plank
  [[63, 19], [61, 19]],   // plank -> across the nook mouth
  [[56, 19], [52, 17]],   // nook floor -> Ledge A
  [[51, 17], [47, 15]],   // Ledge A -> Ledge B
  [[46, 15], [43, 15]],   // Ledge B -> Ledge C (kit)
];
depotHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `depot hop ${i} reachable`));
// ridge hops: the climb from the shoulder to the summit and down the east side
const ridgeHops = [
  // Stage 1 — The Shoulder
  [[80, 12], [84, 10]],   // entry platform -> first step up
  // Stage 2 — The Knife Edge
  [[84, 10], [88, 8]],    // step -> ledge
  [[88, 8], [93, 6]],     // ledge -> higher
  [[93, 6], [98, 4]],     // -> knife edge high point
  [[98, 4], [104, 7]],    // -> deep saddle (big drop!)
  // Stage 3 — The Summit Block (the supply hoist bridges the saddle)
  [[104, 7], [109, 5]],    // saddle -> ledge
  [[109, 5], [111, 3]],    // -> sub-peak
  [[113, 3], [115, 6]],    // -> the supply hoist at its west end
  [[120, 6], [122, 4]],    // off the hoist at its east end
  [[122, 4], [126, 2]],    // -> pinnacle
  [[129, 2], [133, 1]],    // -> summit plateau, the true high point
  // Stage 4 — East Ridge: down over the peaks (climbable in both directions)
  [[141, 1], [143, 4]],    // summit -> first east peak
  [[143, 4], [141, 1]],    // ...and the return jump back to the Gipfel
  [[145, 4], [147, 7]],    // -> pre-notch rim
  [[147, 7], [150, 7]],    // across the Scharte (or drop in!)
  [[154, 7], [157, 9]],    // post-notch peak -> bench peak
  [[160, 9], [162, 11]],   // -> final ledge at the east face
];
// a hop endpoint may be supported by rock, a plank, a hoist track or a
// crumble slab (crumble platforms regrow, so the route is always passable)
const supportAt = (x, y) =>
  solid(at(x, y + Y_OFF)) || at(x, y + Y_OFF) === 3 ||
  MOVERS.some(m => m.y === y + Y_OFF && x >= m.x && x < m.x2 + m.w) ||
  CRUMBLE.some(c => c.y === y + Y_OFF && x >= c.x && x < c.x + c.w);
ridgeHops.forEach(([a, b], i) => {
  ok(reachable(...a, ...b), `ridge hop ${i} reachable`);
  ok(supportAt(...a) && supportAt(...b), `ridge hop ${i} endpoints supported (${a} -> ${b})`);
});
// crumbling slabs on the ridge: where the route expects them, hanging in
// open air with sky above for the arc, and recoverable ground below
ok(CRUMBLE.some(c => c.x === 86 && c.y === 8 + Y_OFF && c.w === 3), 'crumble slab spans the knife-edge gap (x86..88, y8)');
ok(CRUMBLE.some(c => c.x === 107 && c.y === 5 + Y_OFF && c.w === 3), 'crumble slab spans the summit-block gap (x107..109, y5)');
for (const c of CRUMBLE) {
  let air = true, sky = true, recover = true;
  for (let x = c.x; x < c.x + c.w; x++) {
    if (solid(at(x, c.y))) air = false;
    for (let dy = 1; dy <= 4; dy++) if (solid(at(x, c.y - dy))) sky = false;
    let d = 1;
    while (d <= 9 && !solid(at(x, c.y + d))) d++;
    if (d > 9) recover = false;
  }
  ok(air, `crumble@${c.x},${c.y} hangs in open air (slab replaces rock)`);
  ok(sky, `crumble@${c.x},${c.y} has 4 rows of open sky above`);
  ok(recover, `crumble@${c.x},${c.y} falls land on ground within 9 tiles (catch band)`);
}
// Blankeis: hard ice (tile 7) glazes the two on-route ridge stances. The ice
// is the standable surface (counts as solid), sits on a rock body, and a slip
// off lands on recoverable ground (the catch band / rock steps) within reach.
const ICE = [{ x0: 95, x1: 98, y: 4 }, { x0: 102, x1: 104, y: 7 }];
for (const ic of ICE) {
  let iced = true, rockBody = true, recover = true;
  for (let x = ic.x0; x <= ic.x1; x++) {
    if (at(x, ic.y + Y_OFF) !== 7) iced = false;          // surface is ice
    if (!solid(at(x, ic.y + 1 + Y_OFF))) rockBody = false; // bonded to rock below
    let d = 1;
    while (d <= 10 && !solid(at(x, ic.y + d + Y_OFF))) d++;
    if (d > 10) recover = false;
  }
  ok(iced, `Blankeis glazes the stance x${ic.x0}..${ic.x1} at y${ic.y}`);
  ok(rockBody, `ice stance x${ic.x0}..${ic.x1} is a glaze on solid rock (not floating)`);
  ok(recover, `a slip off the ice x${ic.x0}..${ic.x1} lands on ground within 10 tiles`);
}
// summit plateau is solid and has headroom
ok(solid(at(135, 1 + Y_OFF)) && solid(at(139, 1 + Y_OFF)), 'summit plateau solid at key points');
ok(!solid(at(135, 0 + Y_OFF)) && !solid(at(139, 0 + Y_OFF)), 'summit has headroom');
// the Gipfel is the single highest ground on the whole map (edge walls excluded)
{
  let minTop = WORLD_H, cols = [];
  for (let x = 2; x <= 237; x++) {
    let top = WORLD_H;
    for (let y = 0; y < WORLD_H; y++) if (solid(at(x, y))) { top = y; break; }
    if (top < minTop) { minTop = top; cols = [x]; }
    else if (top === minTop) cols.push(x);
  }
  ok(minTop === 1 + Y_OFF && cols.every(x => x >= 133 && x <= 141),
    `summit plateau is the highest ground (row ${minTop} at x${cols[0]}..${cols[cols.length - 1]})`);
}
// the summit supply hoist bridges the deep gap — and nothing else does
{
  const m2 = MOVERS[1];
  ok(m2 && m2.y === 6 + Y_OFF && m2.y2 === 6 + Y_OFF && m2.x === 114 && m2.x2 === 118 && m2.w === 3, `summit hoist runs x114..121 at row ${6 + Y_OFF}`);
  let clear = true;
  for (let x = m2.x; x < m2.x2 + m2.w; x++) for (let y = 4 + Y_OFF; y <= 7 + Y_OFF; y++) if (solid(at(x, y))) clear = false;
  ok(clear, 'summit hoist track is clear of rock');
  ok(!solid(at(117, 8 + Y_OFF)) && !solid(at(118, 11 + Y_OFF)), 'no crag under the summit hoist — the ride is required');
}
// the observer hoist — the last step up to the lookout shelf, and the only one
{
  const m3 = MOVERS[2];
  ok(m3 && m3.y === 13 + Y_OFF && m3.y2 === 13 + Y_OFF && m3.x === 9 && m3.x2 === 13 && m3.w === 2, `observer hoist runs x9..14 at row ${13 + Y_OFF}`);
  let clear = true;
  for (let x = m3.x; x < m3.x2 + m3.w; x++) for (let y = 11 + Y_OFF; y <= 14 + Y_OFF; y++) if (solid(at(x, y))) clear = false;
  ok(clear, 'observer hoist track is clear of rock (old static step removed)');
}
// solid ground under the upper ridge catches falls and funnels back onto the route
ok(solid(at(87, 14 + Y_OFF)) && solid(at(104, 14 + Y_OFF)) && solid(at(121, 14 + Y_OFF)) && solid(at(132, 14 + Y_OFF)), 'solid ground under the upper ridge at y14');
ok(at(89, 11 + Y_OFF) !== 3 && !solid(at(89, 11 + Y_OFF)), 'catwalk west re-entry plank is removed');
ok(at(99, 11 + Y_OFF) === 3 && at(100, 11 + Y_OFF) === 3 && !solid(at(99, 10 + Y_OFF)) && !solid(at(100, 10 + Y_OFF)), 'catwalk east re-entry plank under the saddle');
ok(reachable(100, 14 + Y_OFF, 99, 11 + Y_OFF) && reachable(101, 11 + Y_OFF, 102, 7 + Y_OFF), 'catwalk -> saddle re-entry reachable');

// stonefall band on the depot climb: spawn rows open so stones can fall,
// the band sweeps the exposed hops but spares the plank (x63..64), the
// nook and the ferrata cable column (x71), and the floor below is solid
ok(STONEFALL.some(s => s.x <= 66 && s.x + s.w >= 70 && s.y < 21 + Y_OFF), 'stonefall sweeps the exposed depot hops');
for (const s of STONEFALL) {
  let open = true;
  for (let x = s.x; x < s.x + s.w; x++) if (solid(at(x, s.y))) open = false;
  ok(open, `stonefall@x${s.x}..${s.x + s.w - 1} spawn row y${s.y} is open air`);
  ok(s.x > 64, `stonefall@x${s.x} spares the one-way plank haven (x63..64)`);
  ok(s.x + s.w <= 71, `stonefall@x${s.x} stays off the ferrata cable column (x71)`);
  ok(solid(at(s.x, s.floor)) && solid(at(s.x + s.w - 1, s.floor)), `stonefall@x${s.x} floor row y${s.floor} is solid`);
}

// 14. pond crossing: bank -> log -> bank
ok(at(145, 69 + Y_OFF) === 3 && at(146, 69 + Y_OFF) === 3, 'pond log present');
ok(solid(at(142, 70 + Y_OFF)) && solid(at(150, 70 + Y_OFF)), 'pond banks solid');

// 14b. east ridge: every peak bonds to the shoulder — no floating rock
for (const x of [142, 143, 147, 152, 158, 163]) {
  let top = 0;
  while (top < WORLD_H && !solid(at(x, top))) top++;
  let bonded = true;
  for (let y = top; y <= 35 + Y_OFF; y++) if (!solid(at(x, y))) bonded = false;
  ok(bonded, `east ridge column x${x} solid from crest (row ${top}) to the shoulder`);
}
// the forest below the east shoulder keeps its air (trees, walkable floor)
ok(!solid(at(145, 45 + Y_OFF)) && !solid(at(158, 50 + Y_OFF)) && !solid(at(163, 60 + Y_OFF)), 'air space below the east shoulder stays open');
// the saddles between the peaks are climbable — nobody gets trapped
ok(reachable(142, 6, 143, 4) && reachable(146, 7, 145, 4) && reachable(155, 10, 154, 7) && reachable(161, 12, 162, 11), 'east crest saddles climb back out');

// 15. das Schartl: walkable from the Lärchenschatten (x85) onto the scree,
//     every step at most 1 tile up / 2 down, with 2+ tiles of headroom
{
  // walk-sim: from the gallery floor, step east; each column must offer a
  // floor within +1 (hop up) / -3 (drop) of the current one, with headroom
  let walkable = true, f = 70 + Y_OFF, details = '';
  for (let x = 86; x <= 128; x++) {
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
  let breachX = 128;
  for (let x = 87; x <= 128; x++) { if (!solid(at(x, 48 + Y_OFF + Math.round(((x - 87) * 22) / 41)))) { breachX = x; break; } }
  ok(breachX >= 101, `scree climb above the Schartl breach still gates the Alm (breach at x${breachX})`);
}

// 16. Hinteres Tal
ok(!solid(at(166, 8 + Y_OFF)) && !solid(at(167, 8 + Y_OFF)), 'slip behind the Flugschule sign is open (y5..11)');
ok(solid(at(166, 12 + Y_OFF)) && solid(at(166, 4 + Y_OFF)), 'massif face solid above and below the slip');
ok(solid(at(168, 12 + Y_OFF)) && solid(at(173, 12 + Y_OFF)), 'launch ledge present');
ok(at(169, 13 + Y_OFF) === 5 && at(169, 69 + Y_OFF) === 5, 'return cable spans the east face');
ok(at(210, 70 + Y_OFF) === 4 && solid(at(206, 70 + Y_OFF)) && solid(at(215, 70 + Y_OFF)), 'lake carved with solid banks');
for (const [rx, ry] of RINGS) ok(!solid(at(rx, ry)), `ring at ${rx},${ry} hangs in air`);
for (const t of THERMALS) {
  let clear = true;
  const cxm = t.x + (t.w >> 1);
  for (let y = t.y + 2; y < t.y + t.h - 4; y++) if (solid(at(cxm, y))) clear = false;
  ok(clear, `thermal at x${t.x} has a clear core`);
}
// sink pockets: open air, clear of the thermal columns and ring centres so the
// course stays catchable (a sink that swallowed a ring would soft-lock the run)
for (const s of SINK) {
  let clearCore = true;
  const cxm = s.x + (s.w >> 1);
  for (let y = s.y + 1; y < s.y + s.h - 1; y++) if (solid(at(cxm, y))) clearCore = false;
  ok(clearCore, `sink pocket at x${s.x} has a clear core`);
  const noThermal = !THERMALS.some(t => s.x < t.x + t.w && s.x + s.w > t.x);
  ok(noThermal, `sink pocket at x${s.x} does not overlap a thermal column`);
  const noRing = !RINGS.some(([rx, ry]) => rx >= s.x && rx < s.x + s.w && ry >= s.y && ry < s.y + s.h);
  ok(noRing, `sink pocket at x${s.x} does not swallow a ring`);
}

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECKS FAILED`);
process.exit(fails ? 1 : 0);
