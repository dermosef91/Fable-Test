// Headless smoke test: stub the DOM + 2D canvas, load the real engine, and
// drive it through title -> play -> dialog -> map frames. Any exception in a
// draw path fails the run. Not a pixel test — a "does it crash" test.
'use strict';

function makeCtx() {
  const gradient = { addColorStop() {} };
  const target = {
    canvas: null,
    measureText: t => ({ width: (t || '').length * 6 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  };
  return new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p];
      return t[p] = () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
function makeCanvas() {
  const c = { width: 1280, height: 720, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const ctx = makeCtx();
  ctx.canvas = c;
  c.getContext = () => ctx;
  return c;
}

const cv = makeCanvas();
global.document = {
  getElementById: () => cv,
  createElement: () => makeCanvas(),
  addEventListener() {},
  documentElement: {},
};
global.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener() {},
};
global.screen = { orientation: null };
Object.defineProperty(global, 'navigator', { value: {}, configurable: true });
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.Image = class {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._src = '';
  }
  set src(v) {
    this._src = v;
    setTimeout(() => { if (this.onload) this.onload(); }, 1);
  }
  get src() { return this._src; }
};
const rafQueue = [];
global.requestAnimationFrame = cb => { rafQueue.push(cb); return rafQueue.length; };

const fs = require('fs'), path = require('path'), vm = require('vm');
const ctxGlobal = global;
for (const f of ['world.js', 'game.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  vm.runInThisContext(src, { filename: f });
}

function frames(n, label) {
  for (let i = 0; i < n; i++) {
    const q = rafQueue.splice(0);
    if (!q.length) throw new Error(`render loop died during: ${label}`);
    for (const cb of q) cb(i * 16);
  }
  console.log(` ok : ${n} frames — ${label}`);
}

// title screen
frames(30, 'title screen');

// start a fresh game at the camp fire, same as the intro path
G.mode = 'play';
respawnAtFire();
startIntro();
frames(60, 'intro dialog');
endDialog();
frames(120, 'play (camp, HUD + sky)');

// a spoken dialog with a portrait for every speaker we know
for (const who of ['Greta', 'Norbert', 'Vera', 'Du', 'You', 'Strolch', 'Kuh', 'Cow', '']) {
  say([[who, 'Ein Satz zum Rendern, lang genug zum Umbrechen und Tippen. Una frase per il test.']]);
  frames(40, `dialog (${who || 'narration'})`);
  endDialog();
}
// journal style
say(['Seite eins aus Rosas Tagebuch, kursiv auf Papier.'], null, 'journal');
frames(40, 'dialog (journal)');
endDialog();

// every phase, to cover all sky/forest/church/haze tints
for (const p of [2, 3, 4]) { G.phase = p; frames(30, `phase ${p} sky`); }
G.phase = 1;

// gear chips + tracker variants
G.gear = { boots: true, jacket: true, lamp: true, kit: true, glider: true };
G.knoedel = true;
G.objKey = 'chestnut'; G.objective = TX.objectives.chestnut; G.chestnuts = 2;
frames(30, 'full gear + chestnut tracker');

// walk the player into the forest zone for light shafts
const wald = ZONES.find(z => z.id === 'wald');
player.x = (wald.x + 5) * TILE; player.y = (wald.y + 10) * TILE;
frames(60, 'wald (light shafts, critters)');

// force a perched crow + flush
critters.push({ k: 'crow', x: player.x + 80, y: player.y, t: 600, fly: false, vx: 0, vy: 0 });
frames(30, 'crow perched');
critters.forEach(c => { if (c.k === 'crow') { c.fly = true; c.vx = 1.7; c.vy = -1.3; } });
frames(30, 'crow flying off');

// map screen
G.mode = 'map';
frames(20, 'map screen');
G.mode = 'play';

// touch HUD
isTouch = true;
frames(20, 'touch controls');
say([['Greta', 'Touch-Variante der Dialogbox.']]);
frames(20, 'dialog on touch');
endDialog();

console.log('\nSMOKE RENDER PASSED');
