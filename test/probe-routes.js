// Physics route probe (dev-only, needs headless Chrome + puppeteer — see
// CLAUDE.md for the per-session setup). Drives every hop of the gated
// routes like a player: place, hold jump through the arc, vary the
// direction hold, assert the landing. Run: node test/probe-routes.js
//
// Found the hard way: the engine out-jumps the reachable() table in
// check-world.js — apex hang reaches a 5-up ledge and ~7 tiles flat.
// Anti-skip gates need 6-up / 8-across margins, asserted here for real.
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
        Object.assign(G.gear, gear || {}); G.mode = 'play'; placeAt(fx, fr);
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
  await hop('shelf -> chestnut ledge (dry of the falls)', 33, 54, -1, 51, 28, 29, { boots: true });
  await hop('chestnut ledge -> back onto the shelf', 28, 51, 1, 54, 32, 40, { boots: true });

  console.log('--- depot path: biwak -> ferrata set ---');
  await hop('1. floor -> first step', 87, 34, 1, 32, 89, 90);
  await hop('2. step -> rising leap west', 90, 32, -1, 29, 84, 85);
  await hop('3. -> ledge under the high wall', 84, 29, -1, 27, 80, 81);
  await hop('4. -> 4-up spring to the high perch', 81, 27, 1, 23, 84, 84);
  await hop('5. -> top perch', 84, 23, -1, 21, 80, 80);
  await hop('6. -> one-way plank', 80, 21, -1, 21, 75, 76);
  await walk('7. plank -> walk off into the nook', 75, 21, -1, 25, 63, 72);
  await noHop('anti-skip: ledge (6 below) cannot reach the plank', 80, 27, -1, 21, 75, 76);
  await noHop('anti-skip: high perch (8 across) cannot reach the plank', 84, 23, -1, 21, 75, 76);

  console.log('--- ridge: shoulder -> summit -> east end (no hoist hops) ---');
  const R = [
    ['entry -> first step', 103, 18, 1, 16, 105, 108],
    ['step -> peak', 107, 16, 1, 14, 110, 112],
    ['peak -> higher', 111, 14, 1, 12, 115, 117],
    ['-> high point', 116, 12, 1, 10, 119, 122],
    ['-> deep saddle', 121, 10, 1, 13, 123, 128],
    ['saddle -> peak', 127, 13, 1, 11, 131, 133],
    ['-> sub-peak', 132, 11, 1, 10, 135, 137],
    ['hoist gap floor -> east peak (fallback w/o hoist)', 144, 14, 1, 11, 146, 148],
    ['-> fore-summit', 147, 11, 1, 9, 151, 153],
    ['-> summit plateau', 152, 9, 1, 8, 157, 165],
    ['summit jump has headroom (jump up, land back)', 160, 8, 1, 8, 157, 165],
    ['summit -> descent peak', 164, 8, 1, 11, 166, 169],
    null, // pre-notch is a walk-down, probed separately
    ['the leap across the notch', 171, 13, 1, 13, 176, 178],
    ['-> lower ledge', 177, 13, 1, 15, 181, 184],
    ['-> final ledge', 183, 15, 1, 17, 186, 189],
  ];
  for (const e of R) { if (!e) { await walk('-> pre-notch ledge (walk down)', 168, 11, 1, 13, 170, 171, { kit: true }); continue; } const [n, fx, fr, d, tr, x0, x1] = e; await hop(n, fx, fr, d, tr, x0, x1, { kit: true }); }

  console.log('--- ridge fall recovery: gap floors climb back west ---');
  await hop('saddle-approach floor -> high point', 123, 13, -1, 10, 119, 122, { kit: true });
  await hop('gap x113 -> knife-edge peak', 113, 17, -1, 14, 110, 112, { kit: true });

  console.log(fails === 0 ? '\nALL PROBES PASSED' : `\n${fails} PROBES FAILED`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
