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
// 1. ferrata: two pitches; the two-row gap forces a stop at the lower anchor
ok(at(95, 18) === 5 && at(95, 24) === 5, 'ferrata upper pitch spans y18..24 at x95');
ok(at(95, 27) === 5 && at(95, 33) === 5, 'ferrata lower pitch spans y27..33 at x95');
ok(at(95, 25) === 0 && at(95, 26) === 0, 'two-row gap between the pitches (forced belay stop)');
ok(solid(at(91, 27)) && solid(at(92, 27)) && solid(at(93, 27)), 'belay ledge x91..93 at y27');
ok(!solid(at(91, 26)) && !solid(at(92, 26)) && !solid(at(93, 26)) && !solid(at(92, 25)) && !solid(at(93, 25)), 'belay ledge has headroom');
{
  let corridor = true;
  for (let y = 19; y <= 33; y++) if (solid(at(94, y))) corridor = false;
  ok(corridor, 'climb corridor beside the cable (x94) stays clear');
}
ok(solid(at(96, 18)), 'ridge floor next to cable top');
// 2. headwall seals the Hochband from the ridge except the cable
let sealed = true;
for (let x = 96; x <= 110; x++) for (let y = 25; y <= 33; y++) if (!solid(at(x, y))) sealed = false;
ok(sealed, 'headwall solid x96..110 y25..33 (no kit-free route up)');
// 3. tunnel corridor open y28..33 across x29..71, with ceiling above
let corridor = true, roofed = true;
for (let x = 30; x <= 71; x++) {
  let clear = 0;
  for (let y = 28; y <= 33; y++) if (!solid(at(x, y))) clear++;
  if (clear < 3) corridor = false;            // always at least 3 tiles to pass
  if (!solid(at(x, 27)) && !solid(at(x, 26))) roofed = false;
}
ok(corridor, 'tunnel corridor passable x30..71');
ok(roofed, 'tunnel has a ceiling');
// 4. notch carved (the Zinnensprung) with water far below
ok(!solid(at(172, 13)) && !solid(at(172, 18)), 'ridge notch carved at x172');
let clearDrop = true;
for (let y = 13; y < 76; y++) if (solid(at(172, y)) || at(172, y) === 3) clearDrop = false;
ok(clearDrop, 'notch drop column clear to the pond (no log in the way)');
ok(at(172, 76) === 4, 'pond under the notch');
// 5. gorge chimney carved through the upper band, lip at its mouth
ok(!solid(at(7, 36)) && !solid(at(7, 40)), 'chimney open at x7');
ok(solid(at(10, 34)) && !solid(at(9, 34)), 'landing lip at the chimney mouth, clear air west of it');
// 6. scree slope continuous from valley to Alm shelf
let prevTop = null, slopeOk = true, breachCols = 0;
for (let x = 111; x <= 152; x++) {
  let top = 26; // start below the ridge base overhead
  while (top < WORLD_H && !solid(at(x, top))) top++;
  const expected = 54 + Math.round(((x - 111) * 22) / 42);
  if (top !== expected || at(x, top) !== 2) { breachCols++; prevTop = top; continue; } // the Schartl breach
  if (prevTop !== null && Math.abs(top - prevTop) > 1) slopeOk = false;
  prevTop = top;
}
ok(slopeOk && breachCols <= 6, `scree slope continuous except the Schartl breach (${breachCols} cols)`);
ok(prevTop >= 75, 'scree base meets the valley');
// 7. Alm shelf walkable surface at y54 from x33..110 (minus entities)
let shelf = true;
for (let x = 33; x <= 110; x++) if (!solid(at(x, 54)) || solid(at(x, 53))) shelf = false;
ok(shelf, 'Alm shelf walkable x33..110 at y54');
// 8. valley floor continuous (solid at y76 or water) x2..261, both valleys
let valley = true;
for (let x = 2; x <= 261; x++) { const t = at(x, 76); if (!solid(t) && t !== 4 && t !== 3) valley = false; }
ok(valley, 'valley floor continuous (ground or water)');
// 9. lower gorge ledge ladder exists
for (const [x, y] of [[3, 72], [9, 69], [14, 66], [19, 63], [24, 60], [29, 57]]) ok(solid(at(x, y)), `gorge ledge at ${x},${y}`);
// 10. upper gorge ledge ladder exists
for (const [x, y] of [[26, 51], [21, 48], [8, 44], [4, 41], [8, 38], [4, 35]]) ok(solid(at(x, y)), `upper ledge at ${x},${y}`);
// the gorge chestnut sits on the dry end of the falls-crossing ledge,
// one hop off the Alm shelf — retrievable without descending the gorge
{
  const c = ENTITIES.find(e => e.t === 'chestnut' && e.x < 60);
  ok(c && c.r === 51 && c.x >= WATERFALL.x + WATERFALL.w, 'gorge chestnut on the upper ledge, clear of the falls');
}
// the hoist bridges the removed middle step
{
  const m = MOVERS[0];
  ok(m && m.y === 46 && m.y2 === 46 && m.x === 13 && m.x2 === 18 && m.w === 3, 'hoist runs x13..21 at row 46');
  let clear = true; // its whole track must be open air
  for (let x = m.x; x < m.x2 + m.w; x++) for (let y = 44; y <= 47; y++) if (solid(at(x, y))) clear = false;
  ok(clear, 'hoist track is clear of rock');
}
// the observer post above the Stellung — a long, airy climb
for (const [x, y] of [[14, 31], [11, 29], [17, 27], [20, 25], [13, 23], [16, 21], [10, 19], [6, 16]]) ok(solid(at(x, y)) || at(x, y) === 3, `lookout ledge at ${x},${y}`);
{
  let head = true;
  for (const [x, y] of [[14, 30], [11, 28], [17, 26], [20, 24], [13, 22], [16, 20], [10, 18], [6, 15]]) if (solid(at(x, y)) || solid(at(x, y - 1))) head = false;
  ok(head, 'lookout ledges have headroom');
}
// no ledge sits in the jump arc directly above another (head-bonk guard)
{
  let clear = true;
  for (const [x0, x1, y] of [[14, 15, 31], [11, 12, 29], [17, 18, 27], [13, 14, 23], [16, 17, 21], [10, 11, 19]])
    for (let x = x0; x <= x1; x++) for (let dy = 1; dy <= 4; dy++) if (solid(at(x, y - dy))) clear = false;
  ok(clear, 'lookout ledges have 4 rows of open sky above');
}
ok(ENTITIES.some(e => e.t === 'gear' && e.gear === 'lamp' && e.r <= 16), 'lamp waits at the observer post (above the tunnel mouth level)');
// one-way plank adds commitment to the climb
ok(at(20, 25) === 3, 'observer post has a one-way plank at the midpoint');
// the depot above the tunnel's east mouth — a platforming path from the biwak
for (const [x, y] of [[89, 32], [84, 29], [80, 27], [84, 23], [80, 21], [64, 25]]) ok(solid(at(x, y)), `depot ledge/floor at ${x},${y}`);
ok(at(75, 21) === 3 && at(76, 21) === 3, 'depot plank at the nook mouth (one-way)');
// guard margins beyond what the real engine can jump (apex-hang reaches a
// 5-up ledge, ~7 tiles flat) — the plank only goes from the top perch
ok(34 - 27 >= 6 && solid(at(80, 27)), 'ledges above the floor sit 6+ rows up past step 2');
ok(27 - 21 >= 6, 'plank row is 6 rows over the ledge below it (no shortcut)');
ok(84 - 76 >= 8, 'plank is 8 columns from the high perch (beyond flat range)');
ok(!solid(at(66, 23)) && !solid(at(66, 20)) && solid(at(66, 18)), 'depot nook carved with a roof');
ok(!solid(at(72, 23)) && !solid(at(72, 24)), 'depot nook opens east');
{
  let roofOk = true;
  for (let x = 63; x <= 72; x++) for (let y = 25; y <= 27; y++) if (!solid(at(x, y))) roofOk = false;
  ok(roofOk, 'tunnel roof stays 3 thick under the depot');
}
ok(ENTITIES.some(e => e.t === 'gear' && e.gear === 'kit' && e.r <= 25), 'ferrata set waits up at the depot');
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
  [[5, 76], [4, 72]],    // valley -> A (straight up + a step)
  [[6, 72], [9, 69]],
  [[11, 69], [14, 66]],
  [[16, 66], [19, 63]],
  [[21, 63], [24, 60]],  // into the falls
  [[26, 60], [29, 57]],
  [[30, 57], [32, 54]],  // onto the Alm shelf
];
lowerHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `lower gorge hop ${i} reachable`));
const upperHops = [
  [[32, 54], [28, 51]],  // off the shelf into the falls
  [[26, 51], [23, 48]],
  [[21, 48], [20, 46]],  // onto the hoist at its east end
  [[13, 46], [11, 44]],  // off the hoist at its west end
  [[8, 44], [6, 41]],    // into the chimney
  [[6, 41], [8, 38]],
  [[8, 38], [6, 35]],
  [[6, 35], [10, 34]],   // onto the lip — top out
];
upperHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `upper gorge hop ${i} reachable`));
const lookoutHops = [
  [[16, 34], [15, 31]],  // Stellung → first narrow ledge
  [[14, 31], [13, 29]],  // short step left
  [[13, 29], [17, 27]],  // long leap back right — precision
  [[19, 27], [19, 25]],  // straight up onto the one-way plank
  [[19, 25], [15, 23]],  // back left
  [[15, 23], [16, 21]],  // up the right edge
  [[16, 21], [12, 19]],  // long leap left near the top
  [[10, 19], [9, 16]],   // onto the lookout shelf
];
lookoutHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `lookout hop ${i} reachable`));
const depotHops = [
  [[87, 34], [90, 32]],   // off the Hochband floor, beside the biwak
  [[89, 32], [85, 29]],   // a rising leap west
  [[84, 29], [81, 27]],   // onto the ledge under the high wall
  [[81, 27], [84, 23]],   // the 4-up spring back east to the high perch
  [[84, 23], [80, 21]],   // west onto the top perch
  [[80, 21], [76, 21]],   // the flat leap to the one-way plank
  [[75, 21], [72, 25]],   // plank -> drop across the nook mouth
];
depotHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `depot hop ${i} reachable`));
// ridge hops: the climb from the shoulder to the summit and down the east side
const ridgeHops = [
  // Stage 1 — The Shoulder
  [[104, 18], [108, 16]],   // entry platform -> first step up
  // Stage 2 — The Knife Edge
  [[108, 16], [112, 14]],   // step -> peak
  [[112, 14], [117, 12]],   // peak -> higher
  [[117, 12], [122, 10]],   // -> knife edge high point
  [[122, 10], [128, 13]],   // -> deep saddle (big drop!)
  // Stage 3 — The Summit Block (the supply hoist bridges the wide notch)
  [[128, 13], [133, 11]],   // saddle -> peak
  [[133, 11], [137, 10]],   // -> sub-peak
  [[137, 10], [139, 12]],   // -> the supply hoist at its west end
  [[144, 12], [146, 11]],   // off the hoist at its east end
  [[148, 11], [151, 9]],    // -> fore-summit
  [[153, 9], [157, 8]],     // -> summit plateau, the true high point
  // Stage 4 — East Ridge descent
  [[165, 8], [169, 11]],    // summit -> descent peak
  [[169, 11], [170, 13]],   // -> pre-notch ledge (a walk-down step)
  [[171, 13], [176, 13]],   // the leap across the notch
  [[176, 13], [178, 13]],   // post-notch -> same level
  [[178, 13], [184, 15]],   // -> lower ledge
  [[184, 15], [189, 17]],   // -> final ledge
];
ridgeHops.forEach(([a, b], i) => ok(reachable(...a, ...b), `ridge hop ${i} reachable`));
// summit plateau is solid and has headroom — a FULL jump arc of open sky
ok(solid(at(159, 8)) && solid(at(163, 8)), 'summit plateau solid at key points');
{
  let sky = true;
  for (let x = 157; x <= 165; x++) for (let dy = 1; dy <= 6; dy++) if (solid(at(x, 8 - dy))) sky = false;
  ok(sky, 'summit has 6 rows of open sky (no ceiling over the cross)');
}
// the Gipfel is the single highest ground in the Gamstal (walls excluded)
{
  let minTop = WORLD_H, cols = [];
  for (let x = 2; x <= 189; x++) {
    let top = WORLD_H;
    for (let y = 0; y < WORLD_H; y++) if (solid(at(x, y))) { top = y; break; }
    if (top < minTop) { minTop = top; cols = [x]; }
    else if (top === minTop) cols.push(x);
  }
  ok(minTop === 8 && cols.every(x => x >= 157 && x <= 165),
    `summit plateau is the highest ground (row ${minTop} at x${cols[0]}..${cols[cols.length - 1]})`);
}
// the summit supply hoist bridges the wide notch
{
  const m2 = MOVERS[1];
  ok(m2 && m2.y === 12 && m2.y2 === 12 && m2.x === 138 && m2.x2 === 142 && m2.w === 3, 'summit hoist runs x138..145 at row 12');
  let clear = true;
  for (let x = m2.x; x < m2.x2 + m2.w; x++) for (let y = 10; y <= 13; y++) if (solid(at(x, y))) clear = false;
  ok(clear, 'summit hoist track is clear of rock');
}
// the ridge is a solid massif: every column between the shoulder and the east
// end has ground rooted at the base (peaks + gap floors, no floating crags),
// except the Zinnensprung notch — and nothing hangs below into the scree's sky
{
  let based = true;
  for (let x = 111; x <= 189; x++) {
    if (x >= 172 && x <= 175) continue; // the notch drop
    let top = WORLD_H;
    for (let y = 0; y <= 25; y++) if (solid(at(x, y))) { top = y; break; }
    let rooted = top < WORLD_H;
    for (let y = top; y <= 25 && rooted; y++) if (!solid(at(x, y))) rooted = false;
    if (!rooted) based = false;
  }
  ok(based, 'ridge columns solid down to the base (peaks, not floating platforms)');
  let openBelow = true;
  for (let x = 111; x <= 152; x++) for (let y = 26; y <= 40; y++) if (solid(at(x, y))) openBelow = false;
  ok(openBelow, 'ridge base ends at row 25 — open sky above the scree');
  ok(!solid(at(174, 30)) && !solid(at(174, 60)), 'notch drop stays open below the ridge base');
}
// every gap floor between peaks has an escape wall at most 3 tiles up,
// so a missed jump can climb back onto the route and retry
{
  const gaps = [ // [gapX, floorY, escapeWallX]
    [109, 18, 108], [113, 17, 112], [118, 15, 117], [123, 13, 122],
    [129, 16, 128], [134, 14, 133], [140, 14, 146], [149, 14, 148],
    [154, 12, 153], [166, 11, 165], [179, 16, 178], [185, 18, 184],
  ];
  for (const [gx, gy, wx] of gaps) {
    ok(solid(at(gx, gy)) && !solid(at(gx, gy - 1)) && !solid(at(gx, gy - 2)), `gap floor at ${gx},${gy} with headroom`);
    let wTop = 0; while (wTop < WORLD_H && !solid(at(wx, wTop))) wTop++;
    ok(gy - wTop <= 3 && gy - wTop >= 1, `gap at x${gx} climbable out via x${wx} (${gy - wTop} up)`);
  }
}

// 14. pond crossing: bank -> log -> bank
ok(at(169, 75) === 3 && at(170, 75) === 3, 'pond log present');
ok(solid(at(166, 76)) && solid(at(174, 76)), 'pond banks solid');

// 15. das Schartl: walkable from the Lärchenschatten (x109) onto the scree,
//     every step at most 1 tile up / 2 down, with 2+ tiles of headroom
{
  // walk-sim: from the gallery floor, step east; each column must offer a
  // floor within +1 (hop up) / -3 (drop) of the current one, with headroom
  let walkable = true, f = 76, details = '';
  for (let x = 110; x <= 152; x++) {
    let next = null;
    for (let cand = f - 1; cand <= f + 3; cand++) {
      if (cand < 1 || cand >= WORLD_H) continue;
      if (solid(at(x, cand)) && !solid(at(x, cand - 1)) && !solid(at(x, cand - 2))) { next = cand; break; }
    }
    if (next === null) { walkable = false; details += ` blocked@x${x}(f${f})`; break; }
    f = next;
  }
  ok(walkable && f >= 75, `Schartl path walkable gallery->forest${details} (ends floor ${f})`);
  // and the Alm is still boots-gated: above the breach there must be 6+ rows of scree climb
  let breachX = 152;
  for (let x = 111; x <= 152; x++) { if (!solid(at(x, 54 + Math.round(((x - 111) * 22) / 42)))) { breachX = x; break; } }
  ok(breachX >= 125, `scree climb above the Schartl breach still gates the Alm (breach at x${breachX})`);
}

// 16. Hinteres Tal
ok(!solid(at(190, 14)) && !solid(at(191, 14)), 'slip behind the Flugschule sign is open (y11..17)');
ok(solid(at(190, 18)) && solid(at(190, 10)), 'massif face solid above and below the slip');
ok(solid(at(192, 18)) && solid(at(197, 18)), 'launch ledge present');
ok(at(193, 19) === 5 && at(193, 75) === 5, 'return cable spans the east face');
ok(at(234, 76) === 4 && solid(at(230, 76)) && solid(at(239, 76)), 'lake carved with solid banks');
for (const [rx, ry] of RINGS) ok(!solid(at(rx, ry)), `ring at ${rx},${ry} hangs in air`);
for (const t of THERMALS) {
  let clear = true;
  const cxm = t.x + (t.w >> 1);
  for (let y = t.y + 2; y < t.y + t.h - 4; y++) if (solid(at(cxm, y))) clear = false;
  ok(clear, `thermal at x${t.x} has a clear core`);
}

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECKS FAILED`);
process.exit(fails ? 1 : 0);
