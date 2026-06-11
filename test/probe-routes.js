// Physics route probe (dev-only, needs headless Chrome + puppeteer — see
// CLAUDE.md for the per-session setup). Drives every hop of the gated
// routes like a player: place, hold jump through the arc, vary the
// direction hold, assert the landing. Run: node test/probe-routes.js
//
// Found the hard way: the engine out-jumps the reachable() table in
// check-world.js — apex hang reaches a 5-up ledge and ~7 tiles flat.
// Anti-skip gates need 6-up / 8-across margins, asserted here for real.
//
// All coordinates below are REAL grid rows (world.js values + Y_OFF).
const puppeteer = (() => { try { return require('puppeteer'); } catch (e) { return require('/tmp/node_modules/puppeteer'); } })();
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--mute-audio'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  await page.goto('file://' + __dirname + '/../index.html');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.keyboard.press('Enter');
  await sleep(600);
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Enter'); await sleep(120); }
  await page.evaluate(() => { G.mode = 'play'; });

  // one attempt: stand at (fx,fr), jump toward dir, hold for holdMs, then
  // report where we stand ~1.4s later
  async function attempt(fx, fr, dir, holdMs, gear) {
    await page.evaluate((fx, fr, gear) => {
      Object.assign(G.gear, gear || {});
      G.mode = 'play';
      player.warmth = player.maxWarmth; // pond swims between attempts add up
      placeAt(fx, fr);
      keys['arrowleft'] = keys['arrowright'] = false;
    }, fx, fr, gear);
    await sleep(150); // settle, get grounded
    // hold JUMP through the arc (variable height + apex hang need it);
    // the direction hold is the knob that varies per attempt
    await page.evaluate(dir => { keys[' '] = true; keys[dir < 0 ? 'arrowleft' : 'arrowright'] = true; pendJump = true; }, dir);
    await sleep(Math.min(holdMs, 600));
    await page.evaluate(h => { if (h >= 600) keys[' '] = false; keys['arrowleft'] = keys['arrowright'] = false; }, holdMs);
    if (holdMs < 600) { await sleep(600 - holdMs); await page.evaluate(() => { keys[' '] = false; }); }
    await sleep(Math.max(0, 1400 - Math.max(holdMs, 600)));
    return page.evaluate(() => ({
      tx: Math.floor((player.x + player.w / 2) / TILE),
      fr: Math.round((player.y + player.h) / TILE),
      grounded: player.grounded,
    }));
  }

  let fails = 0;
  const ok = (cond, msg) => { console.log((cond ? ' ok : ' : 'FAIL: ') + msg); if (!cond) fails++; };

  // hop: from (fx,fr) to floor row tr with feet x in [x0..x1]
  async function hop(name, fx, fr, dir, tr, x0, x1, gear) {
    const holds = [120, 220, 350, 500, 700, 1000];
    for (const h of holds) {
      const p = await attempt(fx, fr, dir, h, gear);
      if (p.grounded && p.fr === tr && p.tx >= x0 && p.tx <= x1) { ok(true, `${name} (hold ${h}ms -> x${p.tx},r${p.fr})`); return true; }
    }
    ok(false, `${name} — no hold duration landed on r${tr} x${x0}..${x1}`);
    return false;
  }
  // walk-off (no jump): hold a direction, drop, land
  async function walk(name, fx, fr, dir, tr, x0, x1, gear) {
    for (const h of [120, 180, 250, 400, 600, 900]) {
      await page.evaluate((fx, fr, gear) => {
        Object.assign(G.gear, gear || {}); G.mode = 'play';
        player.warmth = player.maxWarmth;
        placeAt(fx, fr);
        keys['arrowleft'] = keys['arrowright'] = false;
      }, fx, fr, gear);
      await sleep(150);
      await page.evaluate(dir => { keys[dir < 0 ? 'arrowleft' : 'arrowright'] = true; }, dir);
      await sleep(h);
      await page.evaluate(() => { keys['arrowleft'] = keys['arrowright'] = false; });
      await sleep(900);
      const p = await page.evaluate(() => ({
        tx: Math.floor((player.x + player.w / 2) / TILE),
        fr: Math.round((player.y + player.h) / TILE),
        grounded: player.grounded,
      }));
      if (p.grounded && p.fr === tr && p.tx >= x0 && p.tx <= x1) { ok(true, `${name} (walk ${h}ms -> x${p.tx},r${p.fr})`); return true; }
      console.log(`      [walk ${h}ms ended x${p.tx},r${p.fr},g=${p.grounded}]`);
    }
    ok(false, `${name} — walk-off never landed on r${tr} x${x0}..${x1}`);
    return false;
  }
  // a hop that must NOT be possible with any hold
  async function noHop(name, fx, fr, dir, tr, x0, x1, gear) {
    const holds = [120, 220, 350, 500, 700, 1000];
    for (const h of holds) {
      const p = await attempt(fx, fr, dir, h, gear);
      if (p.grounded && p.fr === tr && p.tx >= x0 && p.tx <= x1) { ok(false, `${name} — REACHED with hold ${h}ms`); return; }
    }
    ok(true, name);
  }

  console.log('--- gorge chestnut: one hop off the Alm shelf, NO jacket ---');
  await hop('shelf -> chestnut ledge (dry of the falls)', 33, 58, -1, 55, 28, 29, { boots: true });
  await hop('chestnut ledge -> back onto the shelf', 29, 55, 1, 58, 32, 40, { boots: true });

  console.log('--- depot path: Hochband -> ferrata set ---');
  await hop('1. floor -> first step', 76, 38, 1, 36, 78, 79);
  await hop('2. -> long rising leap toward the headwall', 79, 36, 1, 33, 84, 85);
  await hop('3. -> single-tile perch', 84, 33, -1, 31, 81, 81);
  await hop('4. -> one-way plank at the nook mouth', 81, 31, -1, 29, 75, 76);
  await hop('5. plank -> across the nook mouth', 75, 29, -1, 29, 65, 72);
  await hop('6. nook floor -> ledge A', 66, 29, -1, 27, 63, 64);
  await hop('7. ledge A -> ledge B', 63, 27, -1, 26, 56, 61);
  await hop('8. ledge B -> the kit platform', 56, 26, -1, 25, 52, 55);
  await noHop('anti-skip: floor (7 up) cannot reach the perch', 80, 38, 1, 31, 81, 81);
  await noHop('anti-skip: floor (9 up) cannot reach the plank', 78, 38, -1, 29, 75, 76);

  console.log('--- ridge: shoulder -> summit -> east end ---');
  const R = [
    ['entry -> first step', 103, 22, 1, 20, 105, 108],
    ['step -> ledge', 107, 20, 1, 18, 110, 112],
    ['ledge -> higher', 111, 18, 1, 16, 115, 117],
    ['-> knife edge high point', 116, 16, 1, 14, 119, 122],
    ['-> deep saddle', 121, 14, 1, 17, 126, 128],
    ['saddle -> ledge', 127, 17, 1, 15, 131, 133],
    ['-> sub-peak', 132, 15, 1, 13, 135, 137],
    ['mid-saddle floor -> east ledge (fallback w/o hoist)', 142, 18, 1, 14, 146, 148],
    ['-> the pinnacle', 147, 14, 1, 12, 150, 153],
    ['pinnacle -> summit plateau', 152, 12, 1, 13, 157, 165],
    ['summit jump has headroom (jump up, land back)', 160, 13, 1, 13, 157, 165],
    ['summit -> descent ledge', 164, 13, 1, 15, 167, 169],
    null, // pre-notch is a walk-down step, probed separately below
    ['the Zinnensprung leap across the notch', 171, 17, 1, 17, 176, 178],
    ['-> lower ledge', 177, 17, 1, 19, 181, 184],
    ['-> final ledge', 183, 19, 1, 21, 186, 189],
  ];
  for (const e of R) {
    // accept x172: feet on the ledge lip can put the body center over the notch
    if (!e) { await walk('-> pre-notch ledge (walk down)', 169, 15, 1, 17, 170, 172, { kit: true }); continue; }
    const [n, fx, fr, d, tr, x0, x1] = e; await hop(n, fx, fr, d, tr, x0, x1, { kit: true });
  }

  console.log('--- ridge fall recovery: solid ground funnels back to the route ---');
  await hop('solid ground -> up through the re-entry plank', 124, 24, -1, 21, 123, 124, { kit: true });
  await hop('re-entry plank -> the deep saddle', 124, 21, 1, 17, 126, 128, { kit: true });

  console.log(fails === 0 ? '\nALL PROBES PASSED' : `\n${fails} PROBES FAILED`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
