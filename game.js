/* =========================================================================
   GIPFELBUCH — engine
   A gentle metroidvania: no combat, just a mountain, weather and gear.
   ========================================================================= */
'use strict';

// ---------------------------------------------------------------- canvas --
const cv = document.getElementById('game');
const cx = cv.getContext('2d');
let VW = 0, VH = 0, ZOOM = 2.4, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  cv.width = Math.round(w * DPR);
  cv.height = Math.round(h * DPR);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  ZOOM = Math.max(1.7, Math.min(3.4, w / 420)) * DPR;
  VW = cv.width / ZOOM; VH = cv.height / ZOOM;
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------ fullscreen --
const fsEl = document.documentElement;
const fsSupported = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    } else {
      const req = fsEl.requestFullscreen || fsEl.webkitRequestFullscreen;
      if (!req) return;
      const p = req.call(fsEl, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) {}
}
function onFsChange() {
  try {
    if (isFullscreen()) {
      // side-scroller: on phones, fullscreen is best enjoyed in landscape
      if (isTouch && screen.orientation && screen.orientation.lock) {
        const l = screen.orientation.lock('landscape');
        if (l && l.catch) l.catch(() => {});
      }
    } else if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  } catch (e) {}
  resize();
}
document.addEventListener('fullscreenchange', onFsChange);
document.addEventListener('webkitfullscreenchange', onFsChange);

// ----------------------------------------------------------------- world --
const grid = buildWorld();
const tileAt = (tx, ty) => (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) ? 1 : grid[ty * WORLD_W + tx];
const SOLID = t => t === 1 || t === 2;

function zoneAt(px, py) {
  const tx = px / TILE, ty = py / TILE;
  for (const z of ZONES)
    if (tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h) return z;
  return null;
}
const inWaterfall = (px, py) =>
  px >= WATERFALL.x * TILE && px < (WATERFALL.x + WATERFALL.w) * TILE &&
  py >= WATERFALL.y * TILE && py < (WATERFALL.y + WATERFALL.h) * TILE;
const inThermal = (px, py) => THERMALS.some(t =>
  px >= t.x * TILE && px < (t.x + t.w) * TILE && py >= t.y * TILE && py < (t.y + t.h) * TILE);

// -------------------------------------------------------------- language --
let LANG = 'en';
try { LANG = localStorage.getItem('gipfelbuch_lang') || 'en'; } catch (e) {}
TX = LANG === 'de' ? TX_DE : TX_EN;
const L = v => (v && typeof v === 'object' && v.en !== undefined) ? (v[LANG] || v.en) : v;
function setLanguage(l) {
  LANG = l;
  TX = l === 'de' ? TX_DE : TX_EN;
  try { localStorage.setItem('gipfelbuch_lang', l); } catch (e) {}
  if (typeof G !== 'undefined') G.objective = TX.objectives[G.objKey] || G.objective;
}

// ------------------------------------------------------------------ state --
const G = {
  mode: 'title',              // title | play | dialog | map | sleep | end
  phase: 1,
  gear: {},                   // boots, jacket, lamp, kit, glider
  pages: {},                  // 1..7
  photos: {},                 // 1..5
  rings: {},                  // 0..4 — the flying course
  gamsSeen: 0,
  marmots: {},
  chestnuts: 0,
  chestnutsDone: false,
  knoedel: false,
  flags: {},                  // tentOpened, gretaMet, norbertMet, biwakDone, finale, zinnensprung...
  objKey: 'start',
  objective: TX.objectives.start,
  lastFire: 'camp',
  visited: {},
  playMin: 0,
  toasts: [],
  caption: null,              // {lines, t}
  fadeT: 0, fadeDir: 0, fadeCb: null,
  shake: 0,
};

const player = {
  x: 0, y: 0, vx: 0, vy: 0, w: 11, h: 21,
  face: 1, grounded: false, coyote: 0, jbuf: 0,
  climbing: false, swim: false, anim: 0, idle: 0,
  warmth: 100, maxWarmth: 100,
  stumbleY: 0, sliding: 0,
};

const spawnE = ENTITIES.find(e => e.t === 'spawn');
function placeAt(tx, r) { player.x = tx * TILE + TILE / 2; player.y = r * TILE - player.h; player.vx = player.vy = 0; }
placeAt(spawnE.x, spawnE.r);

const FIRES = {};
for (const e of ENTITIES) if (e.t === 'fire') FIRES[e.id] = e;
FIRES.tent = ENTITIES.find(e => e.t === 'tent');

// ------------------------------------------------------------------ save --
const SAVE_KEY = 'gipfelbuch_v1';
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      phase: G.phase, gear: G.gear, pages: G.pages, marmots: G.marmots,
      photos: G.photos, rings: G.rings, gamsSeen: G.gamsSeen,
      chestnuts: G.chestnuts, chestnutsDone: G.chestnutsDone, knoedel: G.knoedel,
      flags: G.flags, objKey: G.objKey, objective: G.objective, lastFire: G.lastFire,
      visited: G.visited, playMin: G.playMin, maxWarmth: player.maxWarmth,
      taken: [...takenIds],
    }));
    toast(TX.toast_saved);
  } catch (e) { /* private mode */ }
}
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d) return false;
    Object.assign(G, {
      phase: d.phase, gear: d.gear, pages: d.pages, marmots: d.marmots,
      photos: d.photos || {}, rings: d.rings || {}, gamsSeen: d.gamsSeen || 0,
      chestnuts: d.chestnuts, chestnutsDone: d.chestnutsDone, knoedel: d.knoedel,
      flags: d.flags, objKey: d.objKey, objective: d.objective, lastFire: d.lastFire,
      visited: d.visited, playMin: d.playMin,
    });
    if (!G.objKey) { // older saves: infer progress
      G.objKey = G.flags.finale ? 'free' : G.flags.biwakDone ? 'summit' : G.gear.kit ? 'biwak'
        : G.gear.lamp ? 'tunnel' : G.gear.jacket ? 'jacket' : G.chestnutsDone ? 'jacket'
        : G.gear.boots ? 'alm' : G.flags.tentOpened ? 'boots' : 'start';
    }
    G.objective = TX.objectives[G.objKey];
    player.maxWarmth = d.maxWarmth || 100;
    player.warmth = player.maxWarmth;
    for (const id of d.taken || []) takenIds.add(id);
    respawnAtFire();
    return true;
  } catch (e) { return false; }
}
const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };

const takenIds = new Set(); // picked-up entity keys "t:x:r"
const eid = e => `${e.t}:${e.x}:${e.r}`;

function respawnAtFire() {
  const f = FIRES[G.lastFire] || FIRES.camp;
  placeAt(f.x, f.r);
  player.warmth = player.maxWarmth;
}

// ----------------------------------------------------------------- input --
const keys = {};
const touchState = { left: false, right: false, up: false, down: false, jump: false, act: false };
let jumpEdge = false, actEdge = false, upEdge = false, mapEdge = false;
let prevJump = false, prevAct = false, prevUp = false, prevMap = false;

let pendJump = false, pendAct = false, pendUp = false, pendMap = false, pendUI = null;
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (!e.repeat) {
    anyInputEdge = true;
    if (k === ' ' || k === 'w' || k === 'arrowup') pendJump = true;
    if (k === 'w' || k === 'arrowup') pendUp = true;
    if (k === 'e' || k === 'enter') pendAct = true;
    if (k === 'f') toggleFullscreen();
  }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
let anyInputEdge = false;

const inp = {
  get left()  { return keys['arrowleft'] || keys['a'] || touchState.left; },
  get right() { return keys['arrowright'] || keys['d'] || touchState.right; },
  get up()    { return keys['arrowup'] || keys['w'] || touchState.up; },
  get down()  { return keys['arrowdown'] || keys['s'] || touchState.down; },
  get jump()  { return keys[' '] || keys['arrowup'] || keys['w'] || touchState.jump; },
  get act()   { return keys['e'] || keys['enter'] || touchState.act; },
  get map()   { return keys['m'] || touchState.map; },
};

// touch buttons (screen-space, defined each frame in HUD draw)
let BTNS = [];
const touches = new Map();
// floating analog joystick (device px). `r` is the knob travel radius; it is
// re-centred under the thumb on touchdown and springs back to rest on release.
const joy = { active: false, id: null, bx: 0, by: 0, kx: 0, ky: 0, r: 1, restx: 0, resty: 0 };
function inJoyZone(p) { return p.x < cv.width * 0.55 && p.y > cv.height * 0.32; }
function clampN(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function pointerXY(t) { return { x: t.clientX * DPR, y: t.clientY * DPR }; }
function hitBtn(p) {
  for (const b of BTNS) {
    const dx = p.x - b.x, dy = p.y - b.y;
    if (b.w) { if (Math.abs(dx) < b.w / 2 && Math.abs(dy) < b.h / 2) return b.id; }
    else if (dx * dx + dy * dy < b.r * b.r * 1.45) return b.id;
  }
  return null;
}
function refreshTouch() {
  touchState.left = touchState.right = touchState.up = touchState.down = false;
  touchState.jump = touchState.act = touchState.map = touchState.fs = false;
  // analog stick: derive 4-way state from the knob offset, with a deadzone
  if (joy.active) {
    const p = touches.get(joy.id);
    if (p) {
      let ox = p.x - joy.bx, oy = p.y - joy.by;
      const m = Math.hypot(ox, oy) || 1;
      if (m > joy.r) { ox *= joy.r / m; oy *= joy.r / m; }
      joy.kx = joy.bx + ox; joy.ky = joy.by + oy;
      const nx = ox / joy.r, ny = oy / joy.r;
      touchState.left = nx < -0.32; touchState.right = nx > 0.32;
      touchState.up = ny < -0.42; touchState.down = ny > 0.42;
    }
  }
  for (const [id, p] of touches) {
    if (id === joy.id) continue;         // the stick touch is not a button
    const b = hitBtn(p);
    if (b) touchState[b] = true;
  }
}
let isTouch = false;
cv.addEventListener('touchstart', e => {
  e.preventDefault(); isTouch = true; anyInputEdge = true; audioUnlock();
  for (const t of e.changedTouches) {
    const p = pointerXY(t);
    touches.set(t.identifier, p);
    const b = hitBtn(p);
    if (b === 'jump') pendJump = true;
    if (b === 'act') pendAct = true;
    if (b === 'mute') toggleMute();
    if (b === 'cont' || b === 'new' || b === 'start' || b === 'lang') pendTitle = b;
    if (b && (b === 'album' || b === 'albumBack' || b.startsWith('ph'))) pendUI = b;
    // a free touch in the lower-left grabs the joystick, re-centred under the thumb
    if (!b && joy.id === null && G.mode === 'play' && inJoyZone(p)) {
      joy.id = t.identifier; joy.active = true;
      joy.bx = clampN(p.x, joy.r, cv.width - joy.r);
      joy.by = clampN(p.y, joy.r, cv.height - joy.r);
      joy.kx = p.x; joy.ky = p.y;
    }
  }
  refreshTouch();
  tapAt(e.changedTouches[0]);
}, { passive: false });
cv.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) touches.set(t.identifier, pointerXY(t));
  refreshTouch();
}, { passive: false });
const touchEnd = e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    touches.delete(t.identifier);
    if (t.identifier === joy.id) { joy.id = null; joy.active = false; }
    // fullscreen must be requested from touchend — touchstart is not a
    // user activation in Chrome, so the request would be rejected there
    if (hitBtn(pointerXY(t)) === 'fs') toggleFullscreen();
  }
  refreshTouch();
};
cv.addEventListener('touchend', touchEnd, { passive: false });
cv.addEventListener('touchcancel', touchEnd, { passive: false });
cv.addEventListener('mousedown', e => {
  anyInputEdge = true; audioUnlock();
  const b = hitBtn({ x: e.clientX * DPR, y: e.clientY * DPR });
  if (b === 'map') pendMap = true;
  if (b === 'mute') toggleMute();
  if (b === 'fs') toggleFullscreen();
  if (b === 'cont' || b === 'new' || b === 'start' || b === 'lang') pendTitle = b;
  if (b && (b === 'album' || b === 'albumBack' || b.startsWith('ph'))) pendUI = b;
  tapAt(e);
});
window.addEventListener('contextmenu', e => e.preventDefault());

function tapAt(t) {
  // taps advance dialog / title / end screens even off-button
  if (G.mode === 'dialog' || G.mode === 'title' || G.mode === 'end') anyInputEdge = true;
}

// ----------------------------------------------------------------- audio --
let AC = null, muted = false;
try { muted = localStorage.getItem('gipfelbuch_mute') === '1'; } catch (e) {}
function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('gipfelbuch_mute', muted ? '1' : '0'); } catch (e) {}
}
function audioUnlock() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
}
function vib(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} }

// continuous ambience: one looping noise voice, morphed per zone & weather
let amb = null;
function ensureAmbient() {
  if (!AC || amb) return;
  const out = AC.createGain(); out.gain.value = 0; out.connect(AC.destination);
  const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const filt = AC.createBiquadFilter(); filt.type = 'bandpass'; filt.Q.value = 0.6;
  filt.frequency.value = 500;
  src.connect(filt).connect(out); src.start();
  amb = { out, filt };
}
function ambientTick(pc) {
  if (!AC) return;
  ensureAmbient();
  let gain = 0, freq = 500;
  if (!muted && (G.mode === 'play' || G.mode === 'dialog' || G.mode === 'map')) {
    const z = curZone;
    if (z && z.dark) { gain = 0.016; freq = 130; }                       // cave rumble
    else if (pc.rain && !(z && z.covered)) { gain = 0.05; freq = 2600; } // rain hiss
    else if (z && (z.id === 'grat' || z.id === 'gipfel' || z.id === 'ferrata' || z.id === 'hochband'))
      { gain = 0.045 + Math.sin(frame * 0.013) * 0.018; freq = 650 + Math.sin(frame * 0.007) * 180; } // ridge wind
    else if (z && z.id === 'schlucht') { gain = 0.05; freq = 1500; }     // falls roar
    else { gain = 0.018; freq = 480 + Math.sin(frame * 0.005) * 80; }    // valley breeze
  }
  amb.out.gain.value += (gain - amb.out.gain.value) * 0.03;
  amb.filt.frequency.value += (freq - amb.filt.frequency.value) * 0.04;

  // sprinkled one-shots: birds by day, crickets by night, drips in the dark
  if (muted || G.mode !== 'play' || frame % 24 !== 0 || Math.random() > 0.22) return;
  const z = curZone;
  if (z && z.dark) { blip(900 + Math.random() * 500, 0.05, 'sine', 0.03, -700); }
  else if (G.phase === 3 && z && z.outdoor) {
    for (let i = 0; i < 3; i++) setTimeout(() => blip(4300, 0.04, 'sine', 0.02), i * 90); // crickets
  } else if (G.phase !== 3 && z && (z.id === 'wald' || z.id === 'camp' || z.id === 'galerie')) {
    const f = 2000 + Math.random() * 1200;
    blip(f, 0.08, 'sine', 0.025, 500); setTimeout(() => blip(f * 1.2, 0.07, 'sine', 0.02, -400), 110); // bird
  } else if (z && z.id === 'alm' && Math.random() < 0.4) {
    blip(1320, 0.25, 'triangle', 0.018, -40); // a cowbell, somewhere
  }
}
function blip(freq, dur, type, vol, slide) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), AC.currentTime + dur);
  g.gain.value = (vol || 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g).connect(AC.destination);
  o.start(); o.stop(AC.currentTime + dur);
}
function noiseBurst(dur, vol, hp) {
  if (!AC || muted) return;
  const n = AC.sampleRate * dur, buf = AC.createBuffer(1, n, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = AC.createBufferSource(); s.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || 900;
  const g = AC.createGain(); g.gain.value = vol || 0.05;
  s.connect(f).connect(g).connect(AC.destination); s.start();
}
const sfx = {
  jump: () => blip(300, 0.12, 'square', 0.03, 240),
  land: () => noiseBurst(0.08, 0.04),
  pick: () => { blip(660, 0.09, 'triangle', 0.05); setTimeout(() => blip(880, 0.12, 'triangle', 0.05), 70); },
  page: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'sine', 0.05), i * 90)); },
  talk: () => blip(440 + Math.random() * 120, 0.04, 'sine', 0.025),
  marmot: () => { blip(1900, 0.18, 'sine', 0.06, -700); setTimeout(() => blip(1900, 0.14, 'sine', 0.05, -700), 220); },
  moo: () => blip(140, 0.5, 'sawtooth', 0.04, -40),
  splash: () => noiseBurst(0.25, 0.07),
  slip: () => noiseBurst(0.15, 0.05, 1400),
  fire: () => noiseBurst(0.3, 0.03),
  fanfare: () => [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.35, 'triangle', 0.06), i * 130)),
};

// ----------------------------------------------------------------- music --
// A generative alpine tune: plucked notes wandering a phase-tinted scale
// over a soft drone. No files, ~zero CPU, fades out in the dark.
const MUS = { next: 0, deg: 0, drone: null, droneGain: null, lastRoot: 0 };
const MUS_SCALES = [
  null,
  { root: 196.00, scale: [0, 2, 4, 7, 9, 12, 14], tempo: 0.95, rest: 0.25 },  // Sat morning: G major pent
  { root: 174.61, scale: [0, 3, 5, 7, 10, 12], tempo: 1.15, rest: 0.35 },     // rain: F dorian-ish
  { root: 110.00, scale: [0, 3, 7, 12, 15], tempo: 1.7, rest: 0.55 },         // night: sparse A minor
  { root: 130.81, scale: [0, 4, 6, 7, 11, 12], tempo: 1.0, rest: 0.2 },       // dawn: C lydian
  { root: 196.00, scale: [0, 2, 4, 7, 9, 12, 14], tempo: 0.9, rest: 0.25 },   // Sunday: home again
];
function pluck(freq, vol, when) {
  const o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain();
  o.type = 'triangle'; o.frequency.value = freq;
  o2.type = 'sine'; o2.frequency.value = freq * 2.01;
  const g2 = AC.createGain(); g2.gain.value = 0.3;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 1.1);
  o.connect(g); o2.connect(g2).connect(g); g.connect(AC.destination);
  o.start(when); o2.start(when);
  o.stop(when + 1.2); o2.stop(when + 1.2);
}
function musicTick() {
  if (!AC || muted) { if (MUS.droneGain) MUS.droneGain.gain.value *= 0.9; return; }
  const conf = MUS_SCALES[Math.min(G.phase, 5)] || MUS_SCALES[1];
  // drone: root + fifth, very quiet
  if (!MUS.drone) {
    MUS.drone = [AC.createOscillator(), AC.createOscillator()];
    MUS.droneGain = AC.createGain(); MUS.droneGain.gain.value = 0;
    MUS.drone[0].type = 'sine'; MUS.drone[1].type = 'sine';
    const dg2 = AC.createGain(); dg2.gain.value = 0.5;
    MUS.drone[0].connect(MUS.droneGain);
    MUS.drone[1].connect(dg2).connect(MUS.droneGain);
    MUS.droneGain.connect(AC.destination);
    MUS.drone[0].start(); MUS.drone[1].start();
  }
  const inDark = curZone && curZone.dark;
  const dTarget = (G.mode === 'play' || G.mode === 'dialog') ? (inDark ? 0.004 : 0.011) : 0.007;
  MUS.droneGain.gain.value += (dTarget - MUS.droneGain.gain.value) * 0.01;
  if (MUS.lastRoot !== conf.root) {
    MUS.lastRoot = conf.root;
    MUS.drone[0].frequency.setTargetAtTime(conf.root / 2, AC.currentTime, 1.5);
    MUS.drone[1].frequency.setTargetAtTime(conf.root * 0.75, AC.currentTime, 1.5);
  }
  // melody scheduler (skip in the dark — the mountain holds its breath)
  if (inDark || G.mode === 'title') return;
  const now = AC.currentTime;
  if (MUS.next < now - 1) MUS.next = now + 0.1;
  while (MUS.next < now + 0.35) {
    if (Math.random() > conf.rest) {
      MUS.deg += [(-2), -1, -1, 1, 1, 1, 2, 3][(Math.random() * 8) | 0];
      MUS.deg = Math.max(0, Math.min(conf.scale.length - 1, MUS.deg));
      const f = conf.root * Math.pow(2, conf.scale[MUS.deg] / 12);
      pluck(f, 0.035, MUS.next);
      if (Math.random() < 0.18) pluck(f * 1.5, 0.018, MUS.next + 0.07); // a shy fifth
    }
    MUS.next += (0.55 + Math.random() * 0.9) * conf.tempo;
  }
}

// ----------------------------------------------------------------- toast --
function toast(msg) { G.toasts.push({ msg, t: 240 }); if (G.toasts.length > 3) G.toasts.shift(); }

// ---------------------------------------------------------------- dialog --
const D = { queue: [], cb: null, line: 0, chars: 0 };
function say(lines, cb, style) {
  // lines: array of strings (narration) or [name, text] pairs
  D.queue = lines.map(l => Array.isArray(l) ? l : ['', l]);
  D.cb = cb || null; D.line = 0; D.chars = 0; D.style = style || null;
  G.mode = 'dialog';
}
function dialogTick() {
  const cur = D.queue[D.line];
  if (!cur) { endDialog(); return; }
  if (D.chars < cur[1].length) { D.chars += 2; if (D.chars % 6 === 0) sfx.talk(); }
  if (actEdge || jumpEdge || anyInputEdge) {
    anyInputEdge = false;
    if (D.chars < cur[1].length) D.chars = cur[1].length;
    else { D.line++; D.chars = 0; if (D.line >= D.queue.length) endDialog(); }
  }
}
function endDialog() {
  G.mode = 'play';
  const cb = D.cb; D.cb = null;
  if (cb) cb();
}

function caption(lines, t) { G.caption = { lines, t: t || 200, t0: t || 200 }; }

function setObjective(key) {
  G.objKey = key;
  G.objective = TX.objectives[key];
  toast(TX.newobj_prefix + G.objective);
}

function setPhase(p) {
  if (p <= G.phase) return;
  G.phase = p;
  const ph = PHASES[p];
  if (ph) caption([L(ph.caption), L(ph.sub)], 260);
}

// ---------------------------------------------------------------- movers --
// the old material hoist: platforms that drift between two anchor points
function moversTick() {
  for (const m of MOVERS) {
    const t = (Math.sin(frame * Math.PI * 2 / m.period + (m.phase || 0)) + 1) / 2;
    const nx = (m.x + (m.x2 - m.x) * t) * TILE;
    const ny = (m.y + (m.y2 - m.y) * t) * TILE;
    m.dx = m.px === undefined ? 0 : nx - m.px;
    m.dy = m.py === undefined ? 0 : ny - m.py;
    m.px = nx; m.py = ny;
  }
}
function drawMovers() {
  for (const m of MOVERS) {
    if (m.px === undefined) continue;
    const x = m.px - cam.x, y = m.py - cam.y, w = m.w * TILE;
    if (x > VW + 40 || x + w < -40) continue;
    const ropeTop = y - 7 * TILE;
    cx.strokeStyle = 'rgba(60,55,45,0.8)'; cx.lineWidth = 1.5;
    cx.beginPath();
    cx.moveTo(x + 5, y); cx.lineTo(x + 5, ropeTop);
    cx.moveTo(x + w - 5, y); cx.lineTo(x + w - 5, ropeTop);
    cx.stroke();
    cx.fillStyle = '#4a4e55';
    cx.fillRect(x + 2, ropeTop - 4, 6, 5); cx.fillRect(x + w - 8, ropeTop - 4, 6, 5); // pulleys
    cx.fillStyle = '#7a5a39'; cx.fillRect(x, y, w, 5);
    cx.fillStyle = '#5e4429'; cx.fillRect(x, y + 5, w, 2.5);
    cx.fillStyle = 'rgba(255,255,255,0.15)'; cx.fillRect(x, y, w, 1.2);
    cx.strokeStyle = '#5e4429'; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(x + w / 2 - 5, y); cx.lineTo(x + w / 2 + 5, y); cx.stroke();
  }
}

// ------------------------------------------------------------- particles --
const parts = [];
function spawnPart(p) { if (parts.length < 380) parts.push(p); }
function updParts() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; p.t--;
    if (p.t <= 0) parts.splice(i, 1);
  }
}

// ================================================================ PHYSICS =
function rectVsGrid(x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (SOLID(tileAt(tx, ty))) return true;
  return false;
}
function tilesUnder(x, y, w, h) {
  const ty = Math.floor((y + h + 1) / TILE);
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const out = [];
  for (let tx = x0; tx <= x1; tx++) out.push(tileAt(tx, ty));
  return out;
}
function overlapTile(code) { return overlapTileWide(code, 0); }
function overlapTileWide(code, pad) {
  const x0 = Math.floor((player.x - pad) / TILE), x1 = Math.floor((player.x + player.w + pad - 0.01) / TILE);
  const y0 = Math.floor(player.y / TILE), y1 = Math.floor((player.y + player.h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (tileAt(tx, ty) === code) return true;
  return false;
}

let slipToastCd = 0, darkToastCd = 0, coldToastCd = 0, fallToastCd = 0, cableToastCd = 0, gateToastCd = 0;
let fallStartY = 0, wasGrounded = true;

function physTick() {
  const p = player;
  const zone = zoneAt(p.x + p.w / 2, p.y + p.h / 2);
  const dark = zone && zone.dark;

  // ---- swim check (entry speed recorded before water physics caps it)
  p.swim = overlapTile(4);
  const vyEnter = p.vy;

  // ---- riding the hoist: get carried, stay planted
  if (p.moverRef) {
    const m = p.moverRef;
    if (p.x + p.w > m.px - 2 && p.x < m.px + m.w * TILE + 2 && Math.abs(p.y + p.h - m.py) < 6 && p.vy >= 0) {
      p.x += m.dx;
      p.y = m.py - p.h;
      if (frame % 100 === 0) blip(160, 0.18, 'sawtooth', 0.012, 25); // the old ropes creak
    } else p.moverRef = null;
  }

  // ---- cable / climbing (small horizontal tolerance for the grab)
  const onCableTile = overlapTile(5) || overlapTileWide(5, 5);
  if (p.climbing) {
    if (!onCableTile) p.climbing = false;
    p.vx = 0;
    if (inp.left) p.face = -1;
    if (inp.right) p.face = 1;
    p.vy = (inp.up ? -1.7 : 0) + (inp.down ? 1.7 : 0);
    // cling at the cable's top anchor instead of slipping off
    if (p.vy < 0) {
      const ty = Math.floor((p.y + p.vy) / TILE), txc = Math.floor((p.x + p.w / 2) / TILE);
      let anyCable = false;
      for (let dx = -1; dx <= 1; dx++) for (let dy2 = 0; dy2 <= 1; dy2++)
        if (tileAt(txc + dx, ty + dy2) === 5) anyCable = true;
      if (!anyCable) {
        p.vy = 0;
        if (inp.up && cableToastCd <= 0) { toast(TX.toast_cable_top); cableToastCd = 240; }
      }
    }
    // jumping off the cable briefly suppresses the glider, so a held jump
    // can catch the next pitch instead of deploying the canopy
    if (jumpEdge) { p.climbing = false; p.vy = -4.5; p.vx = p.face * 1.5; p.glideLock = 20; sfx.jump(); }
    p.anim += Math.abs(p.vy) * 0.06;
  } else if (onCableTile && (upEdge || (inp.up && p.vy > 0.5 && !p.gliding))) {
    // a held UP also catches the cable while falling past it — only the
    // deliberate edge press triggers dialogue, so a fall can't spam it
    if (!G.gear.kit) {
      if (cableToastCd <= 0) { toast(TX.toast_cable); cableToastCd = 180; }
      if (!G.flags.kitHint && player.x < 100 * TILE) { G.flags.kitHint = true; setObjective('kit'); }
    }
    else if (G.phase === 3 && !G.flags.biwakDone) { if (upEdge) say(TX.biwak_blocked); }
    else { p.climbing = true; p.vx = 0; p.vy = 0; }
  }

  // ---- ground info
  const under = tilesUnder(p.x, p.y, p.w, p.h);
  const onScree = p.grounded && under.includes(2) && !under.includes(1) ? true : (p.grounded && under.includes(2) && under.every(t => t === 2 || t === 0));
  const onOneway = under.includes(3);

  if (!p.climbing) {
    // horizontal: quick on the ground, floatier in the air, snappy turns
    const mx = p.swim ? 1.4 : 2.6;
    let acc = p.swim ? 0.3 : p.grounded ? 0.55 : 0.38;
    const want = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (want !== 0 && p.grounded && Math.sign(p.vx) === -want && Math.abs(p.vx) > 1.4) {
      acc = 0.95; // skid
      if (frame % 3 === 0) spawnPart({ x: p.x + (want > 0 ? 0 : p.w), y: p.y + p.h, vx: -want * 1.2, vy: -0.6, g: 0.07, t: 16, c: '#c9bb9d', s: 2 });
    }
    if (inp.left)  { p.vx = Math.max(p.vx - acc, -mx); p.face = -1; }
    if (inp.right) { p.vx = Math.min(p.vx + acc, mx); p.face = 1; }
    if (!inp.left && !inp.right) p.vx *= p.grounded ? 0.72 : 0.94;

    // scree slide (the boots gate)
    p.sliding = 0;
    if (onScree && !G.gear.boots) {
      p.vx = Math.min(p.vx + 0.55, 3.2); // downhill is east
      p.sliding = 1;
      if ((inp.left || jumpEdge) && slipToastCd <= 0) { toast(TX.toast_slip); sfx.slip(); slipToastCd = 160; }
      if (Math.random() < 0.3) spawnPart({ x: p.x + Math.random() * p.w, y: p.y + p.h, vx: 0.5 + Math.random(), vy: -0.5, g: 0.05, t: 25, c: '#b9a98c', s: 2 });
    } else if (onScree && G.gear.boots && Math.abs(p.vx) > 0.5 && Math.random() < 0.2) {
      spawnPart({ x: p.x + Math.random() * p.w, y: p.y + p.h, vx: -p.vx * 0.2, vy: -0.4, g: 0.04, t: 18, c: '#cfc1a5', s: 1.5 });
    }

    // jump (from ground, coyote, or straight out of the water)
    if (jumpEdge) p.jbuf = 8;
    if (p.jbuf > 0 && (p.grounded || p.coyote > 0 || p.swim) && !(p.sliding && !G.gear.boots)) {
      p.vy = p.swim ? -5.6 : -8.4;
      // jumping off a hoist keeps its drift — the arc matches what you see
      if (p.moverRef) { p.vx += p.moverRef.dx || 0; p.vy += Math.min(0, p.moverRef.dy || 0); }
      p.grounded = false; p.coyote = 0; p.jbuf = 0; p.moverRef = null;
      sfx.jump();
    }
    if (p.jbuf > 0) p.jbuf--;
    if (!inp.jump && p.vy < -2.5 && !p.swim) p.vy = -2.5; // variable height

    // gravity: hang at the apex, fall with intent
    if (p.swim) {
      p.vy += 0.12; p.vy = Math.min(p.vy, 1.3);
      if (inp.up) p.vy -= 0.3;
      if (p.vy < -2.2) p.vy = -2.2;
    } else {
      const apex = Math.abs(p.vy) < 1.3 && !p.grounded && inp.jump;
      p.vy += apex ? 0.24 : p.vy > 0 ? 0.5 : 0.42;
      if (p.vy > 9) p.vy = 9;
    }

    // paraglider: hold jump while falling; down = dive, thermals = lift
    if (p.glideLock > 0) p.glideLock--;
    if (!G.gear.glider || p.grounded || p.swim || !inp.jump || p.glideLock > 0) p.gliding = false;
    else if (!p.gliding && p.vy > 0.4) p.gliding = true;
    if (p.gliding) {
      p.vy = Math.min(p.vy, inp.down ? 2.4 : 1.05);
      if (inThermal(p.x + p.w / 2, p.y + p.h / 2)) {
        p.vy = Math.max(p.vy - 1.45, -1.6); // ride the warm air up
        if (!G.flags.thermalMet) { G.flags.thermalMet = true; toast(TX.toast_thermal); }
      }
      if (!inp.left && !inp.right) p.vx += p.face * 0.06; // forward trim, steering overrides
      p.vx = Math.max(-2.8, Math.min(2.8, p.vx));
      fallStartY = p.y; // a soft landing, always
      if (Math.random() < 0.25) spawnPart({ x: p.x + (p.face > 0 ? -6 : 14), y: p.y + Math.random() * p.h, vx: -p.face * 1.5, vy: 0, t: 12, c: 'rgba(255,255,255,0.4)', s: 1.5 });
      // ring course
      for (let i = 0; i < RINGS.length; i++) {
        if (G.rings[i]) continue;
        const rx = RINGS[i][0] * TILE + 8, ry = RINGS[i][1] * TILE;
        if (Math.abs(p.x + p.w / 2 - rx) < 16 && Math.abs(p.y + p.h / 2 - ry) < 18) {
          G.rings[i] = true; sfx.pick(); vib(25);
          const n = Object.keys(G.rings).length;
          toast(n >= 5 ? TX.toast_rings_done : TX.toast_ring(n));
          if (n >= 5) sfx.fanfare();
          for (let k = 0; k < 10; k++) spawnPart({ x: rx, y: ry, vx: Math.cos(k * 0.63) * 2, vy: Math.sin(k * 0.63) * 2, t: 28, c: '#ffd54f', s: 2 });
        }
      }
    }

    // the slip into the Hinteres Tal is glider-only
    if (!G.gear.glider && p.x + p.w > 189.6 * TILE && p.y < 20 * TILE) {
      p.x = 189.6 * TILE - p.w; p.vx = 0;
      if (gateToastCd <= 0) { toast(TX.gate_flug); gateToastCd = 240; }
    }

    // waterfall force
    if (inWaterfall(p.x + p.w / 2, p.y + p.h / 2)) {
      if (!G.gear.jacket) {
        p.vy = Math.max(p.vy, 3.4);
        p.warmth -= 0.5;
        if (fallToastCd <= 0) { toast(TX.toast_fall_water); fallToastCd = 200; }
      } else {
        p.vy += 0.06; // with the jacket it's just heavy spray
        p.warmth -= 0.04;
      }
      if (Math.random() < 0.5) spawnPart({ x: p.x + Math.random() * p.w, y: p.y + Math.random() * p.h, vx: (Math.random() - 0.5), vy: 2, t: 14, c: 'rgba(220,240,255,0.7)', s: 2 });
    }
  }

  // ---- integrate X
  let nx = p.x + p.vx;
  if (rectVsGrid(nx, p.y, p.w, p.h)) {
    const dir = Math.sign(p.vx);
    while (!rectVsGrid(p.x + dir, p.y, p.w, p.h)) p.x += dir;
    p.vx = 0;
  } else p.x = nx;

  // ---- integrate Y
  let ny = p.y + p.vy;
  p.grounded = false;
  // corner forgiveness: clipping a ceiling corner by a few pixels slides the
  // player sideways instead of killing the jump
  if (p.vy < 0 && rectVsGrid(p.x, ny, p.w, p.h)) {
    const pref = p.vx >= 0 ? 1 : -1;
    outer: for (let m = 1; m <= 4; m++) {
      for (const d of [pref * m, -pref * m]) {
        if (!rectVsGrid(p.x + d, ny, p.w, p.h) && !rectVsGrid(p.x + d, p.y, p.w, p.h)) {
          p.x += d; break outer;
        }
      }
    }
  }
  if (rectVsGrid(p.x, ny, p.w, p.h)) {
    const dir = Math.sign(p.vy);
    while (!rectVsGrid(p.x, p.y + dir, p.w, p.h)) p.y += dir;
    if (p.vy > 0) { landIfFalling(); p.grounded = true; }
    p.vy = 0;
  } else {
    // one-way planks (only when falling, feet crossing the plank, not pressing down)
    if (p.vy > 0 && !inp.down) {
      const feet0 = Math.floor((p.y + p.h - 0.01) / TILE);
      const feet1 = Math.floor((ny + p.h - 0.01) / TILE);
      let landed = false;
      for (let ty = feet0; ty <= feet1 && !landed; ty++) {
        const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.01) / TILE);
        for (let tx = x0; tx <= x1; tx++) {
          if (tileAt(tx, ty) === 3 && p.y + p.h <= ty * TILE + 0.01 + p.vy) {
            p.y = ty * TILE - p.h; landIfFalling(); p.grounded = true; p.vy = 0; landed = true; break;
          }
        }
      }
      // the hoist platforms catch you the same way
      if (!landed) for (const m of MOVERS) {
        if (m.px === undefined) continue;
        const top = m.py;
        if (p.x + p.w > m.px && p.x < m.px + m.w * TILE &&
            p.y + p.h <= top + 0.01 + p.vy + Math.abs(m.dy || 0) + 2 && ny + p.h >= top) {
          p.y = top - p.h; landIfFalling(); p.grounded = true; p.vy = 0;
          p.moverRef = m; landed = true; break;
        }
      }
      if (!landed) p.y = ny;
    } else p.y = ny;
  }
  if (p.grounded) { p.coyote = 8; fallStartY = p.y; }
  else if (p.coyote > 0) p.coyote--;
  if (p.climbing) fallStartY = p.y;

  function landIfFalling() {
    if (!wasGrounded) {
      const drop = (p.y - fallStartY) / TILE;
      sfx.land();
      p.landT = drop > 6 ? 9 : 5;
      if (drop > 24 && !p.swim) {
        p.warmth -= 22; G.shake = 10;
        toast(TX.toast_stumble); vib(60);
      }
      for (let i = 0; i < 5; i++) spawnPart({ x: p.x + Math.random() * p.w, y: p.y + p.h, vx: (Math.random() - 0.5) * 1.5, vy: -Math.random(), g: 0.06, t: 18, c: '#c9bb9d', s: 1.5 });
    }
  }
  wasGrounded = p.grounded || p.climbing;

  // splash on entering water
  if (p.swim && !p.wasSwim) { sfx.splash(); vib(25); G.shake = Math.max(G.shake, vyEnter > 6 ? 6 : 2);
    if (vyEnter > 6 && !G.flags.zinnensprung && zone && zone.id === 'wald' && fallStartY < 26 * TILE) {
      G.flags.zinnensprung = true; toast(TX.toast_sprung); sfx.fanfare();
    }
    for (let i = 0; i < 12; i++) spawnPart({ x: p.x + Math.random() * p.w, y: p.y + p.h / 2, vx: (Math.random() - 0.5) * 2.5, vy: -1 - Math.random() * 2, g: 0.12, t: 26, c: 'rgba(190,225,240,0.8)', s: 2 });
  }
  p.wasSwim = p.swim;

  // ---- warmth
  if (p.swim) p.warmth -= 0.22;
  if (overlapTile(6)) { p.warmth -= 0.3; if (Math.random() < 0.2) spawnPart({ x: p.x + Math.random() * p.w, y: p.y + Math.random() * p.h, vx: 0, vy: -0.5, t: 16, c: '#8bc34a', s: 1.5 }); }
  if (dark && !G.gear.lamp) {
    // hard gate: the player can peek a few tiles into the Stollen mouth but
    // gets turned around before going deep — the dark is impenetrable.
    const stol = ZONES.find(z => z.id === 'stollen');
    if (stol) {
      const westWall = stol.x * TILE + 4 * TILE;     // 4 tiles past the west mouth
      const eastWall = (stol.x + stol.w) * TILE - 4 * TILE; // 4 tiles past the east mouth
      if (p.x + p.w > westWall && p.x < eastWall) {
        // push the player back out of the deep dark
        if (p.x + p.w / 2 < (stol.x + stol.w / 2) * TILE) {
          p.x = westWall - p.w - 1; p.face = -1;  // came from the west → face back
        } else {
          p.x = eastWall + 1; p.face = 1;          // came from the east → face back
        }
        p.vx = 0;
        if (darkToastCd <= 0) { toast(TX.toast_dark_turn); darkToastCd = 240; }
      }
    }
    p.warmth -= 0.06;
    if (darkToastCd <= 0) { toast(TX.toast_dark); darkToastCd = 240; }
  }
  if (G.phase === 3 && zone && zone.outdoor) p.warmth -= 0.015;
  // near fire: warm up
  let nearFire = false;
  for (const id in FIRES) {
    const f = FIRES[id];
    if (Math.abs(p.x - f.x * TILE) < 40 && Math.abs(p.y - f.r * TILE) < 48) nearFire = true;
  }
  if (nearFire) p.warmth = Math.min(p.maxWarmth ?? 100, p.warmth + 0.5);
  else if (!p.swim && p.grounded && !dark) p.warmth = Math.min(player.maxWarmth, p.warmth + 0.02);
  p.warmth = Math.min(player.maxWarmth, p.warmth);

  if (p.warmth < 30 && coldToastCd <= 0) { toast(TX.toast_cold); coldToastCd = 300; }
  if (p.warmth <= 0) {
    fade(() => { respawnAtFire(); say([TX.cold_respawn]); });
  }

  // anim
  if (p.grounded && Math.abs(p.vx) > 0.4) p.anim += Math.abs(p.vx) * 0.09;
  else if (!p.grounded) p.anim += 0.04;
  p.idle += 0.05;
  if (p.landT > 0) p.landT--;

  // footsteps
  if (p.grounded && Math.abs(p.vx) > 1.2 && frame % 13 === 0)
    noiseBurst(0.03, onScree ? 0.028 : 0.014, onScree ? 800 : 2200);

  // breath in the cold
  if ((G.phase === 3 || G.phase === 4 || p.warmth < 40) && frame % 80 === 0 && !p.swim)
    spawnPart({ x: p.x + p.w / 2 + p.face * 6, y: p.y + 3, vx: p.face * 0.3, vy: -0.25, t: 38, c: 'rgba(235,240,250,0.45)', s: 2.5 });

  slipToastCd--; darkToastCd--; coldToastCd--; fallToastCd--; cableToastCd--; gateToastCd--;
}

// =============================================================== INTERACT =
let nearInteract = null;
function findInteract() {
  nearInteract = null;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  let best = 56;
  for (const e of ENTITIES) {
    if (takenIds.has(eid(e))) continue;
    if (e.hide) continue;
    const types = ['tent', 'fire', 'sign', 'npc', 'gear', 'page', 'chestnut', 'book', 'bench', 'relic', 'plaque', 'cow', 'dog', 'bunker', 'shelter', 'photo', 'chapel', 'lookout', 'depot', 'tin'];
    if (!types.includes(e.t) || e.present === false) continue;
    if (e.t === 'photo' && !G.flags.finale) continue; // the photo hunt unlocks at the summit
    if (e.t === 'tin' && !G.flags.zinnensprung) continue; // the silt keeps its secret until the jump
    const d = Math.hypot(e.x * TILE + 8 - px, e.r * TILE - 14 - py);
    if (d < best) { best = d; nearInteract = e; }
  }
}

function doInteract(e) {
  switch (e.t) {
    case 'tent': {
      if (!G.flags.tentOpened) {
        G.flags.tentOpened = true;
        say(TX.tent_first, () => { givePage(1); setObjective('boots'); });
      } else restAt('tent', TX.tent_rest);
      break;
    }
    case 'fire': {
      if (e.biwak && G.gear.kit && !G.flags.biwakDone) {
        fade(() => {
          G.flags.biwakDone = true; G.lastFire = e.id; player.warmth = player.maxWarmth;
          setPhase(4); save();
          say(TX.biwak_sleep, () => setObjective('summit'));
        });
      } else restAt(e.id, TX.fire_rest);
      break;
    }
    case 'sign': {
      if (e.key === 'sign_flug' && G.flags.finale && !G.gear.glider) {
        sfx.pick(); vib(40);
        say(TX.flug_unlock, () => { G.gear.glider = true; save(); });
      } else say(TX[e.key]);
      break;
    }
    case 'gear': {
      takenIds.add(eid(e)); sfx.pick();
      G.gear[e.gear] = true;
      say(TX[e.key], () => {
        if (e.gear === 'boots') { setObjective('alm'); }
        if (e.gear === 'lamp') { setPhase(3); setObjective('tunnel'); }
        if (e.gear === 'kit') { setObjective('biwak'); }
        save();
      });
      break;
    }
    case 'page': takenIds.add(eid(e)); givePage(e.n); break;
    case 'chestnut': {
      takenIds.add(eid(e)); sfx.pick();
      G.chestnuts++; toast(TX.toast_chestnut(G.chestnuts));
      break;
    }
    case 'npc': talkTo(e.who); break;
    case 'cow': sfx.moo(); say(TX.cow); break;
    case 'dog': say(TX.dog); break;
    case 'bench': say(TX.bench, () => { player.warmth = Math.min(player.maxWarmth, player.warmth + 50); }); break;
    case 'relic': say(TX.relic); break;
    case 'plaque': say(TX.plaque); break;
    case 'chapel': say(TX.chapel); break;
    case 'lookout': say(TX.lookout); break;
    case 'depot': say(TX.depot); break;
    case 'tin': {
      takenIds.add(eid(e)); sfx.page(); vib([20, 40, 20]);
      G.flags.tinFound = true;
      toast(TX.toast_tin);
      say(TX.tin_find, () => save(), 'journal');
      break;
    }
    case 'bunker': say(TX.bunker_look); break;
    case 'shelter': say(TX.shelter_look); break;
    case 'book': finale(); break;
    case 'photo': {
      takenIds.add(eid(e)); sfx.page(); vib(20);
      G.photos[e.n] = true;
      toast(TX.toast_photo(Object.keys(G.photos).length));
      G.mode = 'photo'; G.photoN = e.n; G.photoT = 0;
      break;
    }
  }
}

function restAt(id, prompt) {
  G.lastFire = id;
  player.warmth = player.maxWarmth;
  sfx.fire();
  save();
  say([TX.rested]);
  for (let i = 0; i < 8; i++) spawnPart({ x: player.x, y: player.y, vx: (Math.random() - 0.5), vy: -1 - Math.random(), t: 40, c: '#ffd54f', s: 2 });
}

function givePage(n) {
  if (G.pages[n]) return;
  G.pages[n] = true; sfx.page(); vib([20, 40, 20]);
  toast(TX.toast_page(Object.keys(G.pages).length));
  say(TX.pages[n], null, 'journal');
}

function talkTo(who) {
  if (who === 'greta') {
    const t = TX.greta;
    if (G.flags.finale) say(t.done);
    else if (!G.flags.gretaMet) { G.flags.gretaMet = true; say(t.first); }
    else if (G.phase === 3) say(t.night);
    else if (G.gear.jacket) say(t.jacket);
    else if (G.gear.boots) say(t.boots);
    else say(t.first.slice(5));
  } else if (who === 'norbert') {
    const t = TX.norbert;
    if (G.flags.finale) say(t.done);
    else if (!G.flags.norbertMet) {
      G.flags.norbertMet = true;
      say(t.first, () => setObjective('chestnut'));
    } else if (G.gear.jacket) say(t.after);
    else if (G.chestnuts >= 3 && !G.chestnutsDone) {
      G.chestnutsDone = true;
      say(t.complete, () => {
        G.knoedel = true; player.maxWarmth = 130; player.warmth = 130;
        toast(TX.toast_knoedel); sfx.pick();
        say(TX.get_jacket, () => {
          G.gear.jacket = true; setPhase(2); setObjective('jacket'); save();
        });
      });
    } else say(t.partial);
  } else if (who === 'vera') {
    const t = TX.vera;
    const n = Object.keys(G.rings).length;
    if (G.flags.flugschein) say(t.after);
    else if (!G.flags.veraMet) { G.flags.veraMet = true; say(t.first); }
    else if (n >= 5) {
      say(t.done, () => {
        G.flags.flugschein = true;
        player.warmth = player.maxWarmth;
        sfx.fanfare(); save();
      });
    } else say(t.partial);
  }
}

function finale() {
  if (G.flags.finale) { say(TX.finale_write); return; }
  G.flags.finale = true;
  sfx.fanfare();
  say(TX.finale_arrive, () => {
    givePageSilent(7);
    say(TX.finale_book, () => {
      const all = Object.keys(G.pages).length >= 7;
      const next = () => say(TX.finale_write, () => { G.mode = 'end'; G.endT = 0; save(); });
      if (all) say(TX.finale_ida, next); else next();
    });
  });
}
function givePageSilent(n) { if (!G.pages[n]) { G.pages[n] = true; toast(TX.toast_page(Object.keys(G.pages).length)); } }

// ---- rings & thermals (Hinteres Tal) ---------------------------------------
function drawRings() {
  for (let i = 0; i < RINGS.length; i++) {
    if (G.rings[i]) continue;
    const x = RINGS[i][0] * TILE + 8 - cam.x, y = RINGS[i][1] * TILE - cam.y;
    if (x < -30 || x > VW + 30) continue;
    const bob = Math.sin(frame * 0.05 + i * 1.3) * 3;
    cx.strokeStyle = '#ffd54f'; cx.lineWidth = 3;
    cx.globalAlpha = 0.9;
    cx.beginPath(); cx.ellipse(x, y + bob, 11, 14, 0, 0, 7); cx.stroke();
    cx.strokeStyle = 'rgba(255,213,79,0.35)'; cx.lineWidth = 7;
    cx.beginPath(); cx.ellipse(x, y + bob, 11, 14, 0, 0, 7); cx.stroke();
    cx.globalAlpha = 1;
  }
}
function drawThermals() {
  if (cam.x + VW < THERMALS[0].x * TILE) return;
  cx.save();
  for (const t of THERMALS) {
    const x = t.x * TILE - cam.x, w = t.w * TILE;
    if (x > VW || x + w < 0) continue;
    const y0 = t.y * TILE - cam.y, y1 = (t.y + t.h) * TILE - cam.y;
    cx.strokeStyle = 'rgba(255,255,255,0.18)'; cx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const px2 = x + w * (0.25 + i * 0.25);
      cx.beginPath();
      for (let yy = Math.max(0, y0); yy < Math.min(VH, y1); yy += 8) {
        const sway = Math.sin(yy * 0.05 + frame * 0.06 + i * 2) * 5;
        if (yy === Math.max(0, y0)) cx.moveTo(px2 + sway, yy); else cx.lineTo(px2 + sway, yy);
      }
      cx.stroke();
    }
    if (Math.random() < 0.25) spawnPart({ x: t.x * TILE + Math.random() * w, y: Math.min((t.y + t.h) * TILE, cam.y + VH), vx: 0, vy: -1.6 - Math.random(), t: 50, c: 'rgba(255,250,230,0.5)', s: 2 });
  }
  cx.restore();
}

// ---- NPC day schedules ------------------------------------------------------
const NPCS = {};
for (const e of ENTITIES) {
  if (e.t === 'npc') NPCS[e.who] = e;
  if (e.t === 'dog') NPCS.dog = e;
  if (e.t === 'cow') NPCS.cow = e;
}
function npcTick() {
  const ph = G.phase;
  // Greta: mornings by the fire, gone at night, strolls with Strolch after the storm
  const g = NPCS.greta;
  if (ph >= 4) g.x = 100 + Math.sin(frame * 0.004) * 11;
  else if (ph === 3) g.x = 73;
  else g.x = 74;
  // Strolch trails her
  NPCS.dog.x = g.x + 2.5 + Math.sin(frame * 0.013) * 1.2;
  // Norbert: in the hut at night (windows lit), chopping wood on Sunday
  const n = NPCS.norbert;
  n.present = ph !== 3;
  n.x = ph >= 5 ? 79 : ph === 4 ? 93 : 90;
  // the cow drifts, unbothered
  NPCS.cow.x = 72 + Math.sin(frame * 0.0025) * 4;
}

// ---- the Gams: appears near your next objective, bounds away when crowded --
const gams = { x: 0, y: 0, stage: '', fleeT: 0, hidden: false, met: false, restSaid: false };
function gamsSpot() {
  if (G.flags.finale) return { x: 184, r: 15, stage: 'rest' };
  if (!G.gear.boots) return player.x < 118 * TILE ? { x: 108, r: 76, stage: 'boots1' } : null;
  if (!G.chestnutsDone) return { x: 108, r: 54, stage: 'alm' };
  // once you're up at the Stellung, she waits at the base of the observer-post climb
  if (G.gear.jacket && !G.gear.lamp && player.y < 38 * TILE && player.x < 32 * TILE)
    return { x: 16, r: 34, stage: 'lamp2' };
  return null;
}
function gamsTick() {
  const spot = gamsSpot();
  if (!spot) { gams.stage = 'none'; gams.hidden = true; return; }
  if (spot.stage !== gams.stage) {
    gams.stage = spot.stage; gams.hidden = false; gams.fleeT = 0; gams.met = false;
    gams.x = spot.x * TILE + 8; gams.y = spot.r * TILE;
  }
  if (gams.hidden) return;
  const d = Math.hypot(player.x - gams.x, player.y + player.h - gams.y);
  if (gams.fleeT > 0) {
    gams.fleeT--;
    gams.x += gams.dir * 2.6;
    gams.y -= Math.abs(Math.sin(gams.fleeT * 0.45)) * 2.2 - 1.4;
    if (Math.random() < 0.3) spawnPart({ x: gams.x, y: gams.y, vx: -gams.dir, vy: -0.3, g: 0.04, t: 14, c: '#cfc4a8', s: 1.5 });
    if (gams.fleeT === 0) gams.hidden = true;
    return;
  }
  if (gams.stage === 'rest') {
    if (d < 60 && !gams.restSaid && G.mode === 'play') { gams.restSaid = true; say([TX.gams_rest]); }
    return;
  }
  if (d < 200 && !gams.met) { gams.met = true; G.gamsSeen++; sfx.marmot(); }
  if (d < 64) { gams.fleeT = 55; gams.dir = player.x < gams.x ? 1 : -1; }
}
function drawGams() {
  if (gams.hidden || gams.stage === 'none' || !gams.stage) return;
  const x = gams.x - cam.x, y = gams.y - cam.y;
  if (x < -40 || x > VW + 40) return;
  const rest = gams.stage === 'rest';
  cx.save(); cx.translate(x, y);
  if (gams.fleeT > 0 && gams.dir < 0) cx.scale(-1, 1);
  cx.fillStyle = '#8a6f50';
  if (rest) { // lying down
    cx.beginPath(); cx.ellipse(0, -5, 11, 5, 0, 0, 7); cx.fill();
    cx.beginPath(); cx.arc(9, -10, 3.5, 0, 7); cx.fill();
  } else {
    cx.fillRect(-9, -14, 16, 7);                                  // body
    cx.fillRect(-8, -7, 2.5, 7); cx.fillRect(4, -7, 2.5, 7);      // legs
    cx.fillRect(5, -19, 3, 6);                                    // neck
    cx.beginPath(); cx.arc(7, -20, 3.2, 0, 7); cx.fill();         // head
  }
  // the hooked horns
  cx.strokeStyle = '#3d3327'; cx.lineWidth = 1.4;
  const hx = rest ? 9 : 7, hy = rest ? -12 : -22;
  cx.beginPath(); cx.moveTo(hx - 1, hy); cx.quadraticCurveTo(hx - 1, hy - 5, hx - 3.5, hy - 5.5); cx.stroke();
  cx.beginPath(); cx.moveTo(hx + 1, hy); cx.quadraticCurveTo(hx + 1, hy - 5, hx - 1.5, hy - 6); cx.stroke();
  // eye stripe
  cx.strokeStyle = '#2c2a25'; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(hx + 2.5, hy + (rest ? 1 : 1)); cx.lineTo(hx - 1, hy - 2); cx.stroke();
  cx.restore();
}

// ---- marmots (proximity, not interaction) ----
function marmotTick() {
  const all5 = Object.keys(G.marmots).length >= 5;
  for (const e of ENTITIES) {
    if (e.t !== 'marmot') continue;
    const k = eid(e);
    const d = Math.abs(player.x - e.x * TILE);
    e.alert = d < 90 && Math.abs(player.y - e.r * TILE) < 80;
    if (e.alert && !G.marmots[k]) {
      G.marmots[k] = true; sfx.marmot();
      const n = Object.keys(G.marmots).length;
      toast(TX.toast_marmot(n));
      if (n >= 5) { toast(TX.toast_marmots_all); sfx.fanfare(); }
      e.diveT = 40;
    }
    if (e.diveT > 0) e.diveT--;
    // once you know all five, they stay out and whistle hello
    if (all5) {
      if (e.greetCd > 0) e.greetCd--;
      if (e.alert && (e.greetCd === undefined || e.greetCd <= 0)) {
        e.greetCd = 260;
        blip(1900, 0.12, 'sine', 0.03, -600);
        setTimeout(() => blip(2100, 0.1, 'sine', 0.025, -500), 160);
        for (let i = 0; i < 3; i++) spawnPart({ x: e.x * TILE + 8, y: e.r * TILE - 16, vx: (i - 1) * 0.4, vy: -0.7, t: 30, c: '#ffd54f', s: 1.8 });
      }
    }
  }
}

// ---- zone discovery / banners ----
let bannerZone = null, bannerT = 0, curZone = null;
function zoneTick() {
  const z = zoneAt(player.x + player.w / 2, player.y + player.h / 2);
  curZone = z;
  if (z && !G.visited[z.id]) {
    G.visited[z.id] = true;
    bannerZone = z; bannerT = 220;
    if (z.id === 'grat' || z.id === 'gipfel') { if (G.phase === 3) setPhase(4); }
  }
  if (z && (z.id === 'grat' || z.id === 'gipfel') && G.phase < 4) setPhase(4);
  if (bannerT > 0) bannerT--;
}

// ================================================================= CAMERA =
const cam = { x: 0, y: 0, groundY: 0, look: 0 };
function camTick() {
  const p = player;

  // vertical anchor: the camera follows the last place the player stood,
  // so ordinary jumps don't bob the horizon. Airborne, the anchor only
  // moves once the player leaves a window around it.
  if (p.grounded || p.climbing || p.swim || p.moverRef) {
    cam.groundY = p.y;
  } else {
    const upWin = Math.min(96, VH * 0.34); // taller than a full jump where the screen allows
    if (p.y < cam.groundY - upWin) cam.groundY = p.y + upWin;
    if (p.y > cam.groundY) cam.groundY = p.y; // falling below the anchor: follow down
  }

  // look down: lead the camera when falling fast or gliding, and let a
  // grounded player peek over an edge by holding DOWN
  let lookT = 0;
  if (G.mode === 'play') {
    if (!p.swim && !p.grounded && p.vy > 3.5) lookT = Math.min(1, (p.vy - 3.5) / 3);
    if (p.gliding) lookT = Math.max(lookT, 0.55);
    if (p.grounded && !p.climbing && inp.down) lookT = 1;
  }
  cam.look += (lookT * 64 - cam.look) * 0.06;

  const tx = p.x + p.w / 2 + p.face * 24 - VW / 2;
  const ty = cam.groundY + p.h / 2 - VH / 2 - 14 + cam.look;
  cam.x += (tx - cam.x) * 0.08;
  // catch up faster the further behind the camera is (long drops)
  const ky = Math.min(0.3, 0.1 + Math.abs(ty - cam.y) * 0.002);
  cam.y += (ty - cam.y) * ky;
  cam.x = Math.max(0, Math.min(WORLD_W * TILE - VW, cam.x));
  cam.y = Math.max(0, Math.min(WORLD_H * TILE - VH, cam.y));
}

// ================================================================== FADE ==
function fade(cb) { if (G.fadeDir === 0) { G.fadeDir = 1; G.fadeCb = cb; } }
function fadeTick() {
  if (G.fadeDir === 1) { G.fadeT += 0.05; if (G.fadeT >= 1) { G.fadeT = 1; G.fadeDir = -1; if (G.fadeCb) { const c = G.fadeCb; G.fadeCb = null; c(); } } }
  else if (G.fadeDir === -1) { G.fadeT -= 0.04; if (G.fadeT <= 0) { G.fadeT = 0; G.fadeDir = 0; } }
}

// ================================================================ DRAWING =
const lerp = (a, b, t) => a + (b - a) * t;
function hexLerp(h1, h2, t) {
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = p(h1), b = p(h2);
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;
}
let skyBlend = { top: PHASES[1].skyTop, bot: PHASES[1].skyBot, t: 1, from: 1, to: 1 };
let phaseLerpT = 1, phasePrev = 1;
function phaseColors() {
  if (phasePrev !== G.phase) { phaseLerpT = 0; }
  phaseLerpT = Math.min(1, phaseLerpT + 0.01);
  const a = PHASES[phasePrev] || PHASES[G.phase], b = PHASES[G.phase];
  const out = {
    top: hexLerp(a.skyTop, b.skyTop, phaseLerpT),
    bot: hexLerp(a.skyBot, b.skyBot, phaseLerpT),
    ambient: lerp(a.ambient, b.ambient, phaseLerpT),
    rain: b.rain, sun: b.sun,
  };
  if (phaseLerpT >= 1) phasePrev = G.phase;
  return out;
}

let frame = 0;

function drawSky(pc) {
  const gr = cx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, pc.top); gr.addColorStop(1, pc.bot);
  cx.fillStyle = gr; cx.fillRect(0, 0, VW, VH);

  // stars at night
  if (G.phase === 3) {
    cx.fillStyle = 'rgba(255,255,240,0.8)';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5 + 40) % VW, sy = (i * 89.7) % (VH * 0.7);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.02 + i));
      cx.globalAlpha = tw * 0.8;
      cx.fillRect(sx, sy, 1.5, 1.5);
    }
    cx.globalAlpha = 1;
    // moon
    cx.fillStyle = '#f5f1dc'; cx.beginPath(); cx.arc(VW * 0.78, VH * 0.16, 14, 0, 7); cx.fill();
    cx.fillStyle = pc.top; cx.beginPath(); cx.arc(VW * 0.78 - 6, VH * 0.16 - 3, 12, 0, 7); cx.fill();
  } else if (pc.sun >= 0) {
    const sx = VW * (0.25 + pc.sun * 0.5), sy = VH * (0.14 + (1 - Math.sin(pc.sun * Math.PI)) * 0.2);
    const glow = cx.createRadialGradient(sx, sy, 2, sx, sy, 60);
    const warm = G.phase === 4 ? 'rgba(255,150,80,' : 'rgba(255,235,170,';
    glow.addColorStop(0, warm + '0.95)'); glow.addColorStop(0.25, warm + '0.5)'); glow.addColorStop(1, warm + '0)');
    cx.fillStyle = glow; cx.fillRect(sx - 60, sy - 60, 120, 120);
  }

  // far peaks — the three pale sisters (homage, parallax)
  const px = cam.x * 0.06, py = cam.y * 0.05;
  cx.fillStyle = G.phase === 3 ? 'rgba(40,52,90,0.9)' : G.phase === 4 ? 'rgba(150,110,140,0.55)' : 'rgba(190,200,215,0.7)';
  drawPeaks(px, py, 0);
  drawChurch();
  cx.fillStyle = G.phase === 3 ? 'rgba(28,38,70,0.95)' : G.phase === 4 ? 'rgba(110,85,120,0.7)' : 'rgba(150,165,185,0.8)';
  drawPeaks(cam.x * 0.12 + 200, cam.y * 0.08, 1);

  // valley haze — the far layers dissolve into the air
  const hzc = G.phase === 3 ? '22,30,58' : G.phase === 4 ? '212,150,140' : G.phase === 2 ? '170,182,198' : '208,219,232';
  const hg = cx.createLinearGradient(0, VH * 0.34, 0, VH * 0.95);
  hg.addColorStop(0, `rgba(${hzc},0)`); hg.addColorStop(1, `rgba(${hzc},${G.phase === 3 ? 0.35 : 0.5})`);
  cx.fillStyle = hg; cx.fillRect(0, VH * 0.34, VW, VH * 0.66);

  // mid-distance conifer ridges, only down in the valley
  const fc = G.phase === 3 ? ['rgba(28,38,68,0.8)', 'rgba(18,26,50,0.92)']
    : G.phase === 4 ? ['rgba(108,80,104,0.55)', 'rgba(70,54,80,0.75)']
    : G.phase === 2 ? ['rgba(86,104,102,0.5)', 'rgba(58,80,76,0.72)']
    : ['rgba(88,114,98,0.5)', 'rgba(56,84,70,0.72)'];
  drawForestBand(0.2, 0.83, fc[0], 0.8);
  drawForestBand(0.3, 0.96, fc[1], 1.15);

  // clouds
  const dull = G.phase === 2 || G.phase === 3;
  for (let i = 0; i < 6; i++) {
    const cxp = ((i * 260 + frame * (0.1 + i * 0.02) - cam.x * 0.15) % (VW + 200)) - 100;
    const cyp = 30 + (i * 47) % 80 - cam.y * 0.1;
    cloud(cxp, cyp, 30 + (i % 3) * 14, dull ? '125,134,148' : '255,255,255', dull ? 0.45 : 0.5);
  }
}
const hash01 = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function drawForestBand(par, baseFrac, color, scale) {
  const base = VH * baseFrac + (WORLD_H * TILE - VH - cam.y) * par * 0.28;
  if (base - 50 * scale > VH) return;
  const ox = cam.x * par, step = 13 * scale;
  cx.fillStyle = color;
  cx.beginPath();
  cx.moveTo(-30, VH + 20); cx.lineTo(-30, base + 2);
  const i0 = Math.floor((ox - 30) / step), i1 = Math.ceil((ox + VW + 30) / step);
  for (let i = i0; i <= i1; i++) {
    const x = i * step - ox;
    const th = (14 + hash01(i) * 30) * scale, tw = (4.5 + hash01(i * 7 + 3) * 4) * scale;
    cx.lineTo(x - tw, base + 2);
    cx.lineTo(x - tw * 0.42, base - th * 0.48);
    cx.lineTo(x - tw * 0.6, base - th * 0.46);
    cx.lineTo(x, base - th);
    cx.lineTo(x + tw * 0.6, base - th * 0.46);
    cx.lineTo(x + tw * 0.42, base - th * 0.48);
    cx.lineTo(x + tw, base + 2);
  }
  cx.lineTo(VW + 30, base + 2); cx.lineTo(VW + 30, VH + 20);
  cx.closePath(); cx.fill();
}
function drawChurch() {
  // the village church across the valley, on its little knoll
  const par = 0.09, cycle = 1500;
  const sx = ((480 - cam.x * par) % cycle + cycle) % cycle - 150;
  if (sx < -60 || sx > VW + 60) return;
  const base = VH * 0.66 + (WORLD_H * TILE - VH - cam.y) * par * 0.3;
  if (base - 40 > VH) return;
  const sil = G.phase === 3 ? 'rgba(34,46,82,0.95)' : G.phase === 4 ? 'rgba(126,96,128,0.7)' : 'rgba(168,181,200,0.85)';
  const roof = G.phase === 3 ? 'rgba(26,36,66,0.95)' : G.phase === 4 ? 'rgba(104,78,108,0.75)' : 'rgba(146,160,180,0.9)';
  cx.fillStyle = sil;
  cx.beginPath(); cx.ellipse(sx + 5, base + 16, 46, 18, 0, Math.PI, 0); cx.fill(); // knoll
  cx.fillRect(sx - 2, base - 8, 16, 10);                                          // nave
  cx.fillRect(sx - 9, base - 18, 7, 20);                                          // tower
  cx.fillRect(sx + 20, base + 2, 9, 7); cx.fillRect(sx - 20, base + 1, 8, 8);     // houses at its foot
  cx.fillStyle = roof;
  cx.beginPath(); cx.moveTo(sx - 3, base - 8); cx.lineTo(sx + 6, base - 13); cx.lineTo(sx + 15, base - 8); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(sx - 10.5, base - 18); cx.lineTo(sx - 5.5, base - 27); cx.lineTo(sx - 0.5, base - 18); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(sx + 19, base + 2); cx.lineTo(sx + 24.5, base - 2); cx.lineTo(sx + 30, base + 2); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(sx - 21, base + 1); cx.lineTo(sx - 16, base - 3); cx.lineTo(sx - 11, base + 1); cx.closePath(); cx.fill();
  cx.strokeStyle = roof; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(sx - 5.5, base - 27); cx.lineTo(sx - 5.5, base - 30.5); cx.stroke();
  cx.beginPath(); cx.moveTo(sx - 7, base - 28.5); cx.lineTo(sx - 4, base - 28.5); cx.stroke();
  // belfry openings — lit after dark, like home
  cx.fillStyle = G.phase === 3 ? 'rgba(255,216,122,0.85)' : roof;
  cx.fillRect(sx - 7.5, base - 14, 1.6, 2.4); cx.fillRect(sx - 4.6, base - 14, 1.6, 2.4);
}
function drawPeaks(ox, oy, layer) {
  const base = VH * 0.78 - oy * 0.3;
  const pts = layer === 0
    ? [[0, 120], [90, 30], [150, 95], [230, 10], [260, 90], [300, 12], [340, 88], [430, 40], [520, 110], [620, 25], [720, 100], [820, 45], [950, 115]]
    : [[0, 150], [120, 70], [240, 130], [380, 60], [520, 140], [680, 80], [820, 150], [980, 90]];
  const sc = (VW + 100) / 1000;
  const screen = pts
    .map(([x, h]) => [(((x - ox * 0.8) % 1000 + 1000) % 1000) * sc - 50, base - h * (VH / 420)])
    .sort((a, b) => a[0] - b[0]);
  cx.beginPath(); cx.moveTo(-60, VH);
  cx.lineTo(-60, screen[0][1]);
  for (const [sx, sy] of screen) cx.lineTo(sx, sy);
  cx.lineTo(VW + 60, screen[screen.length - 1][1]);
  cx.lineTo(VW + 60, VH); cx.closePath(); cx.fill();
}
function cloud(x, y, r, rgb, a) {
  rgb = rgb || '255,255,255'; a = a || 0.5;
  for (const [dx, dy, rr] of [[-0.1, 0.05, 0.62], [0.45, -0.22, 0.5], [0.95, 0, 0.55], [0.4, 0.16, 0.58]]) {
    const bx = x + dx * r, by = y + dy * r, br = r * rr * 1.35;
    const g = cx.createRadialGradient(bx, by - br * 0.15, br * 0.12, bx, by, br);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(0.6, `rgba(${rgb},${a * 0.5})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    cx.fillStyle = g;
    cx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
}

function drawBgRock() {
  for (const r of BG_ROCK) {
    const x = r.x * TILE - cam.x, y = r.y * TILE - cam.y;
    const w = r.w * TILE, h = r.h * TILE;
    if (x > VW || y > VH || x + w < 0 || y + h < 0) continue;
    const gr = cx.createLinearGradient(0, y, 0, y + h);
    if (r.cave) { gr.addColorStop(0, '#2e2a24'); gr.addColorStop(1, '#1c1916'); }
    else if (G.phase === 3) { gr.addColorStop(0, '#1d2747'); gr.addColorStop(1, '#141b33'); }
    else if (G.phase === 4) { gr.addColorStop(0, '#8a6478'); gr.addColorStop(1, '#5e4a62'); }
    else { gr.addColorStop(0, '#a8a394'); gr.addColorStop(1, '#8d897e'); }
    cx.fillStyle = gr;
    cx.fillRect(x, y, w, h);
    // strata
    cx.strokeStyle = 'rgba(0,0,0,0.08)'; cx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      cx.beginPath();
      cx.moveTo(x, y + (h * i) / 6 + Math.sin(i * 3.1) * 6);
      cx.lineTo(x + w, y + (h * i) / 6 - Math.sin(i * 2.3) * 8);
      cx.stroke();
    }
  }
}

// biome for grass tint
function biomeAt(tx, ty) {
  if (ty <= 25) return 'ridge';
  if (ty <= 43) return 'high';
  if (ty <= 64) return 'alm';
  return 'valley';
}
const GRASS = { ridge: '#9fae7e', high: '#8fa37a', alm: '#6fae57', valley: '#5d9148' };
const ROCKC = { ridge: '#b8b2a4', high: '#a8a094', alm: '#97907f', valley: '#8c8577' };

function drawTiles() {
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(WORLD_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(WORLD_H - 1, Math.ceil((cam.y + VH) / TILE) + 1);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = grid[ty * WORLD_W + tx];
      if (!t) continue;
      const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
      const bio = biomeAt(tx, ty);
      if (t === 1) {
        cx.fillStyle = ROCKC[bio];
        cx.fillRect(x, y, TILE, TILE);
        // speckle
        if ((tx * 7 + ty * 13) % 5 === 0) { cx.fillStyle = 'rgba(0,0,0,0.07)'; cx.fillRect(x + (tx % 3) * 4, y + (ty % 3) * 4, 3, 3); }
        // grass cap if air above
        if (!SOLID(tileAt(tx, ty - 1)) && tileAt(tx, ty - 1) !== 4) {
          cx.fillStyle = GRASS[bio];
          cx.fillRect(x, y - 1, TILE, 5);
          cx.fillRect(x + 2, y - 3, 2, 2); cx.fillRect(x + 9, y - 3, 2, 2);
        }
        if (tileAt(tx, ty + 1) === 0) {
          cx.fillStyle = 'rgba(0,0,0,0.18)'; cx.fillRect(x, y + TILE - 3, TILE, 3);
          // hanging fringe under overhangs
          cx.fillStyle = 'rgba(86,118,68,0.8)';
          if ((tx * 13 + ty * 7) % 3 !== 2) {
            cx.fillRect(x + (tx % 5) * 3, y + TILE, 2, 3 + (tx % 3) * 2);
            cx.fillRect(x + 8 + (ty % 4) * 2, y + TILE, 2, 2 + (ty % 3) * 2);
          }
        }
      } else if (t === 2) {
        cx.fillStyle = '#b3a88e'; cx.fillRect(x, y, TILE, TILE);
        cx.fillStyle = '#998d72';
        cx.fillRect(x + ((tx * 3) % 8), y + ((ty * 5) % 8), 4, 3);
        cx.fillRect(x + ((tx * 5 + 7) % 10), y + ((ty * 3 + 4) % 10), 3, 3);
        cx.fillStyle = '#cfc4a8'; cx.fillRect(x + ((tx * 7 + 3) % 11), y + ((ty * 7 + 2) % 11), 3, 2);
      } else if (t === 3) {
        cx.fillStyle = '#7a5a39'; cx.fillRect(x, y, TILE, 5);
        cx.fillStyle = '#5e4429'; cx.fillRect(x, y + 5, TILE, 2);
        cx.fillStyle = 'rgba(255,255,255,0.15)'; cx.fillRect(x, y, TILE, 1);
      } else if (t === 4) {
        const wob = Math.sin(frame * 0.08 + tx * 0.9) * 1.5;
        cx.fillStyle = 'rgba(70,140,180,0.75)';
        cx.fillRect(x, y + (tileAt(tx, ty - 1) === 4 ? 0 : 2 + wob * 0.5), TILE, TILE);
        if (tileAt(tx, ty - 1) !== 4) { cx.fillStyle = 'rgba(220,245,255,0.6)'; cx.fillRect(x, y + 1 + wob * 0.5, TILE, 2); }
      } else if (t === 5) {
        // ferrata cable + rungs
        cx.strokeStyle = '#d8dde2'; cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(x + TILE - 4, y); cx.lineTo(x + TILE - 4, y + TILE); cx.stroke();
        if (ty % 3 === 0) { cx.fillStyle = '#c0c8cf'; cx.fillRect(x + TILE - 8, y + 4, 8, 3); }
      } else if (t === 6) {
        cx.strokeStyle = '#4e7d32'; cx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const bx = x + 2 + i * 4, sway = Math.sin(frame * 0.05 + tx + i) * 1.5;
          cx.beginPath(); cx.moveTo(bx, y + TILE); cx.quadraticCurveTo(bx + sway, y + 8, bx + sway, y + 3); cx.stroke();
          cx.fillStyle = '#6da34c'; cx.fillRect(bx + sway - 1.5, y + 2, 3, 3);
        }
      }
    }
  }
}

function drawWaterfall() {
  const x = WATERFALL.x * TILE - cam.x, y = WATERFALL.y * TILE - cam.y;
  const w = WATERFALL.w * TILE, h = WATERFALL.h * TILE;
  if (x > VW || x + w < 0) return;
  cx.fillStyle = 'rgba(190,220,240,0.34)';
  cx.fillRect(x, y, w, h);
  cx.fillStyle = 'rgba(235,250,255,0.5)';
  for (let i = 0; i < 7; i++) {
    const sx = x + ((i * 11 + 3) % (w - 4));
    const off = (frame * (4 + (i % 3)) + i * 47) % h;
    cx.fillRect(sx, y + off, 3, 22);
    cx.fillRect(sx + 1, y + ((off + h / 2) % h), 2, 14);
  }
  // mist at pool
  cx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 4; i++) {
    const mx = x + w / 2 + Math.sin(frame * 0.03 + i * 2) * (8 + i * 4);
    cloudAt(mx, y + h - 3 - i * 2, 4 + i);
  }
  // spring spout at top
  cx.fillStyle = '#7d766a'; cx.fillRect(x - 3, y - 8, w + 6, 8);
}
function cloudAt(x, y, r) { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }

// ------------------------------------------------------- decor & friends --
function drawTree(x, fr, kind, s) {
  const bx = x * TILE + 8 - cam.x, by = fr * TILE - cam.y;
  if (bx < -60 || bx > VW + 60) return;
  const H = 70 * s;
  cx.strokeStyle = '#6b4a2c'; cx.lineWidth = 3 * s;
  cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx, by - H); cx.stroke();
  if (kind === 0) { // larch: feathery, golden-green
    cx.fillStyle = G.phase === 3 ? '#2c4434' : '#7fa05a';
    for (let i = 0; i < 6; i++) {
      const ly = by - H * (0.35 + i * 0.12), lw = (38 - i * 5) * s;
      cx.beginPath(); cx.moveTo(bx - lw / 2, ly); cx.quadraticCurveTo(bx, ly - 9 * s, bx + lw / 2, ly); cx.quadraticCurveTo(bx, ly + 4 * s, bx - lw / 2, ly); cx.fill();
    }
  } else { // spruce
    cx.fillStyle = G.phase === 3 ? '#1f3328' : '#39614a';
    for (let i = 0; i < 4; i++) {
      const ly = by - H * (0.3 + i * 0.18), lw = (42 - i * 8) * s;
      cx.beginPath(); cx.moveTo(bx - lw / 2, ly); cx.lineTo(bx, ly - 16 * s); cx.lineTo(bx + lw / 2, ly); cx.closePath(); cx.fill();
    }
  }
}

function drawFlower(fx, fr, kind) {
  const x = fx * TILE + 8 - cam.x, y = fr * TILE - cam.y;
  if (x < -20 || x > VW + 20) return;
  cx.strokeStyle = '#557d3a'; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y - 6); cx.stroke();
  if (kind === 'rose') { cx.fillStyle = '#d9577a'; cx.beginPath(); cx.arc(x, y - 7, 3, 0, 7); cx.fill(); }
  else if (kind === 'gent') { cx.fillStyle = '#2b5fb8'; cx.beginPath(); cx.arc(x, y - 7, 2.5, 0, 7); cx.fill(); }
  else { // edelweiss
    cx.fillStyle = '#f2f0e4';
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cx.beginPath(); cx.ellipse(x + Math.cos(a) * 3, y - 7 + Math.sin(a) * 3, 2.5, 1.2, a, 0, 7); cx.fill(); }
    cx.fillStyle = '#d9c75e'; cx.beginPath(); cx.arc(x, y - 7, 1.5, 0, 7); cx.fill();
  }
}

function drawEntity(e) {
  const x = e.x * TILE + 8 - cam.x, y = e.r * TILE - cam.y; // y = floor line
  if (x < -80 || x > VW + 80) return;
  const taken = takenIds.has(eid(e));
  const bob = Math.sin(frame * 0.06 + e.x) * 2;

  switch (e.t) {
    case 'tent': {
      cx.fillStyle = '#27538f';
      cx.beginPath(); cx.moveTo(x - 20, y); cx.lineTo(x, y - 22); cx.lineTo(x + 20, y); cx.closePath(); cx.fill();
      cx.fillStyle = '#1b3c69';
      cx.beginPath(); cx.moveTo(x + 4, y); cx.lineTo(x, y - 22); cx.lineTo(x + 20, y); cx.closePath(); cx.fill();
      cx.fillStyle = '#0e2138'; cx.beginPath(); cx.moveTo(x - 4, y); cx.lineTo(x, y - 14); cx.lineTo(x + 4, y); cx.closePath(); cx.fill();
      break;
    }
    case 'fire': {
      cx.fillStyle = '#5e4429';
      cx.fillRect(x - 7, y - 3, 14, 3);
      cx.fillRect(x - 5, y - 5, 10, 3);
      const f1 = Math.sin(frame * 0.25 + e.x) * 2, f2 = Math.cos(frame * 0.31) * 1.5;
      cx.fillStyle = '#ff9d2e';
      cx.beginPath(); cx.moveTo(x - 5, y - 4); cx.quadraticCurveTo(x - 4 + f1, y - 14, x, y - 17 + f2); cx.quadraticCurveTo(x + 4 - f1, y - 13, x + 5, y - 4); cx.closePath(); cx.fill();
      cx.fillStyle = '#ffd54f';
      cx.beginPath(); cx.moveTo(x - 3, y - 4); cx.quadraticCurveTo(x + f2, y - 10, x, y - 12 + f1); cx.quadraticCurveTo(x + 2, y - 9, x + 3, y - 4); cx.closePath(); cx.fill();
      if (Math.random() < 0.15) spawnPart({ x: e.x * TILE + 8 + (Math.random() - 0.5) * 6, y: e.r * TILE - 14, vx: (Math.random() - 0.5) * 0.3, vy: -0.6, t: 35, c: '#ffb74d', s: 1.5 });
      // a lazy column of smoke drifting off with the wind
      if (Math.random() < 0.12) spawnPart({ x: e.x * TILE + 8 + (Math.random() - 0.5) * 5, y: e.r * TILE - 18, vx: 0.12 + Math.random() * 0.18, vy: -0.45 - Math.random() * 0.25, t: 90, c: 'rgba(192,196,206,0.28)', s: 2.5 + Math.random() * 2 });
      break;
    }
    case 'sign': {
      cx.fillStyle = '#7a5a39'; cx.fillRect(x - 1.5, y - 22, 3, 22);
      cx.fillStyle = '#e8c84f'; // yellow alpine pointer
      cx.beginPath(); cx.moveTo(x - 14, y - 22); cx.lineTo(x + 10, y - 22); cx.lineTo(x + 15, y - 18.5); cx.lineTo(x + 10, y - 15); cx.lineTo(x - 14, y - 15); cx.closePath(); cx.fill();
      cx.fillStyle = '#b03a2e'; cx.fillRect(x - 13, y - 21, 3, 5); // red-white-red blaze
      cx.fillStyle = '#fff'; cx.fillRect(x - 10, y - 21, 3, 5);
      cx.fillStyle = '#b03a2e'; cx.fillRect(x - 7, y - 21, 3, 5);
      break;
    }
    case 'hut': {
      cx.fillStyle = '#9b9486'; cx.fillRect(x - 26, y - 26, 52, 26); // stone base
      cx.fillStyle = '#7a5a39'; cx.fillRect(x - 26, y - 34, 52, 9);  // timber
      cx.fillStyle = '#5e4429';
      cx.beginPath(); cx.moveTo(x - 32, y - 33); cx.lineTo(x, y - 48); cx.lineTo(x + 32, y - 33); cx.closePath(); cx.fill();
      cx.fillStyle = G.phase >= 3 ? '#ffd87a' : '#3d3327';
      cx.fillRect(x - 16, y - 22, 9, 9); cx.fillRect(x + 8, y - 22, 9, 9); // windows
      cx.fillStyle = '#4a3826'; cx.fillRect(x - 4, y - 18, 9, 18); // door
      cx.fillStyle = '#fff'; cx.font = '6px sans-serif'; cx.textAlign = 'center';
      cx.fillText('GAMSBLICK-ALM 1924', x, y - 37);
      // smoke
      if (Math.random() < 0.1) spawnPart({ x: e.x * TILE + 8 + 20, y: e.r * TILE - 50, vx: 0.2, vy: -0.4, t: 60, c: 'rgba(200,200,200,0.5)', s: 3 });
      break;
    }
    case 'lookout': {
      // sandbag parapet
      cx.fillStyle = '#a89a78';
      cx.beginPath(); cx.ellipse(x - 6, y - 3, 5, 3, 0, 0, 7); cx.fill();
      cx.beginPath(); cx.ellipse(x + 1, y - 3, 5, 3, 0, 0, 7); cx.fill();
      cx.beginPath(); cx.ellipse(x - 2.5, y - 8, 5, 3, 0, 0, 7); cx.fill();
      cx.strokeStyle = '#8a7c5e'; cx.lineWidth = 0.8;
      cx.beginPath(); cx.moveTo(-9 + x, y - 3); cx.lineTo(x + 6, y - 3); cx.stroke();
      // rusted scope on a tripod
      cx.strokeStyle = '#6b5a40'; cx.lineWidth = 1.6;
      cx.beginPath();
      cx.moveTo(x + 10, y); cx.lineTo(x + 13, y - 9);
      cx.moveTo(x + 16, y); cx.lineTo(x + 13, y - 9);
      cx.moveTo(x + 13, y); cx.lineTo(x + 13, y - 9);
      cx.stroke();
      cx.save(); cx.translate(x + 13, y - 11); cx.rotate(-0.35);
      cx.fillStyle = '#5f6259'; cx.fillRect(-5, -2, 12, 4);
      cx.fillStyle = '#3d4046'; cx.fillRect(6, -2.5, 2.5, 5);
      cx.restore();
      break;
    }
    case 'depot': {
      // weatherproof crate with a coil of rope and spare slings on a peg
      cx.fillStyle = '#6b5a40'; cx.fillRect(x - 9, y - 9, 18, 9);
      cx.strokeStyle = '#4a3e2c'; cx.lineWidth = 1; cx.strokeRect(x - 9, y - 9, 18, 9);
      cx.beginPath(); cx.moveTo(x - 9, y - 9); cx.lineTo(x + 9, y); cx.stroke();
      cx.fillStyle = '#8a7c5e'; cx.fillRect(x - 7, y - 12, 14, 3); // lid
      cx.strokeStyle = '#c9a96a'; cx.lineWidth = 2;
      cx.beginPath(); cx.arc(x + 13, y - 12, 4, 0, 7); cx.stroke(); // rope coil
      cx.strokeStyle = '#e07b30'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.ellipse(x - 13, y - 13, 2, 3, 0.3, 0, 7); cx.stroke(); // sling on a peg
      break;
    }
    case 'tin': {
      if (taken || !G.flags.zinnensprung) return;
      const shimmer = 0.5 + Math.sin(frame * 0.08) * 0.3;
      cx.fillStyle = '#9c3d2e'; cx.fillRect(x - 5, y - 5, 10, 5);
      cx.fillStyle = '#d8d2bd'; cx.fillRect(x - 4, y - 7, 8, 2);
      cx.fillStyle = `rgba(255,250,210,${0.2 * shimmer})`;
      cx.beginPath(); cx.arc(x, y - 5, 9, 0, 7); cx.fill();
      if (Math.random() < 0.06) spawnPart({ x: e.x * TILE + 8, y: e.r * TILE - 8, vx: 0, vy: -0.4, t: 40, c: 'rgba(220,240,255,0.6)', s: 2 }); // a bubble
      break;
    }
    case 'bunker': {
      cx.fillStyle = '#8e8d85';
      cx.beginPath(); cx.moveTo(x - 18, y); cx.lineTo(x - 18, y - 16); cx.quadraticCurveTo(x, y - 30, x + 18, y - 16); cx.lineTo(x + 18, y); cx.closePath(); cx.fill();
      cx.fillStyle = '#2c2a25'; cx.fillRect(x - 5, y - 14, 10, 14);
      cx.fillStyle = '#3a3833'; cx.fillRect(x - 13, y - 18, 6, 3); cx.fillRect(x + 7, y - 18, 6, 3); // slits
      break;
    }
    case 'shelter': {
      cx.fillStyle = '#7a5a39';
      cx.fillRect(x - 16, y - 20, 3, 20); cx.fillRect(x + 13, y - 14, 3, 14);
      cx.beginPath(); cx.moveTo(x - 20, y - 20); cx.lineTo(x + 20, y - 13); cx.lineTo(x + 20, y - 10); cx.lineTo(x - 20, y - 17); cx.closePath(); cx.fill();
      cx.fillStyle = '#5e4429'; cx.fillRect(x - 12, y - 8, 20, 3); // bench
      cx.fillRect(x - 10, y - 5, 2, 5); cx.fillRect(x + 4, y - 5, 2, 5);
      break;
    }
    case 'relic': {
      cx.fillStyle = '#6b5a40'; cx.fillRect(x - 10, y - 8, 20, 8);
      cx.strokeStyle = '#4a3e2c'; cx.strokeRect(x - 10, y - 8, 20, 8);
      cx.fillStyle = '#5f6259'; cx.beginPath(); cx.arc(x + 14, y - 3, 4.5, Math.PI, 0); cx.fill(); // helmet
      cx.fillStyle = '#d9577a'; cx.fillRect(x - 6, y - 11, 2, 3); cx.fillStyle = '#e8e4d0'; cx.fillRect(x - 2, y - 11, 2, 3); // two flowers
      break;
    }
    case 'plaque': {
      cx.fillStyle = '#8a8576'; cx.fillRect(x - 7, y - 18, 14, 10);
      cx.fillStyle = '#c9b46a'; cx.fillRect(x - 5, y - 16, 10, 6);
      break;
    }
    case 'cross': {
      cx.strokeStyle = G.phase === 4 ? '#e8c84f' : '#8a6f4d'; cx.lineWidth = 4;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y - 40); cx.moveTo(x - 12, y - 30); cx.lineTo(x + 12, y - 30); cx.stroke();
      if (G.phase === 4) { cx.fillStyle = 'rgba(255,200,90,0.25)'; cx.beginPath(); cx.arc(x, y - 30, 26, 0, 7); cx.fill(); }
      break;
    }
    case 'book': {
      cx.fillStyle = '#9c3d2e'; cx.fillRect(x - 6, y - 7, 12, 7); // tin box
      cx.fillStyle = '#d8d2bd'; cx.fillRect(x - 4, y - 9, 8, 2);
      if (!G.flags.finale) { cx.fillStyle = 'rgba(255,235,170,0.7)'; cx.beginPath(); cx.arc(x, y - 8 + bob, 9 + Math.sin(frame * 0.1) * 2, 0, 7); cx.globalAlpha = 0.25; cx.fill(); cx.globalAlpha = 1; }
      break;
    }
    case 'bench': {
      cx.fillStyle = '#7a5a39'; cx.fillRect(x - 12, y - 8, 24, 3); cx.fillRect(x - 12, y - 16, 3, 8);
      cx.fillRect(x - 10, y - 5, 2, 5); cx.fillRect(x + 8, y - 5, 2, 5);
      cx.fillRect(x - 12, y - 18, 24, 3);
      break;
    }
    case 'fence': {
      cx.strokeStyle = '#7a5a39'; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(x - 6, y); cx.lineTo(x - 6, y - 12); cx.moveTo(x + 6, y); cx.lineTo(x + 6, y - 12);
      cx.moveTo(x - 8, y - 9); cx.lineTo(x + 8, y - 9); cx.moveTo(x - 8, y - 4); cx.lineTo(x + 8, y - 4); cx.stroke();
      break;
    }
    case 'gear': {
      if (taken) return;
      const gy = y - 10 + bob;
      cx.fillStyle = 'rgba(255,255,255,0.2)'; cx.beginPath(); cx.arc(x, gy, 10, 0, 7); cx.fill();
      if (e.gear === 'boots') {
        cx.fillStyle = '#7a4a26'; cx.fillRect(x - 7, gy - 4, 8, 7); cx.fillRect(x - 7, gy + 1, 12, 4);
        cx.fillStyle = '#4a2e16'; cx.fillRect(x - 7, gy + 4, 12, 2);
      } else if (e.gear === 'lamp') {
        cx.fillStyle = '#4a4e55'; cx.fillRect(x - 5, gy - 4, 10, 8);
        cx.fillStyle = '#ffe27a'; cx.beginPath(); cx.arc(x + 3, gy, 3, 0, 7); cx.fill();
        cx.fillStyle = 'rgba(255,226,122,0.3)'; cx.beginPath(); cx.arc(x + 3, gy, 7 + bob, 0, 7); cx.fill();
      } else if (e.gear === 'kit') {
        cx.strokeStyle = '#e07b30'; cx.lineWidth = 2.5;
        cx.beginPath(); cx.arc(x - 3, gy, 4, 0, 7); cx.stroke();
        cx.beginPath(); cx.arc(x + 4, gy + 2, 3.5, 0, 7); cx.stroke();
        cx.strokeStyle = '#c9c9c9'; cx.beginPath(); cx.moveTo(x - 3, gy - 6); cx.lineTo(x + 4, gy - 2); cx.stroke();
      }
      break;
    }
    case 'page': {
      if (taken || e.hide) return;
      cx.save(); cx.translate(x, y - 12 + bob); cx.rotate(Math.sin(frame * 0.04 + e.x) * 0.15);
      cx.fillStyle = '#f3ecd2'; cx.fillRect(-5, -7, 10, 14);
      cx.strokeStyle = '#b9ac82'; cx.lineWidth = 1;
      for (let i = -4; i <= 4; i += 3) { cx.beginPath(); cx.moveTo(-3, i); cx.lineTo(3, i); cx.stroke(); }
      cx.restore();
      cx.fillStyle = 'rgba(255,250,210,0.25)'; cx.beginPath(); cx.arc(x, y - 12 + bob, 11, 0, 7); cx.fill();
      break;
    }
    case 'chestnut': {
      if (taken) return;
      cx.fillStyle = '#7c4a21'; cx.beginPath(); cx.arc(x, y - 4 + bob * 0.5, 4, 0, 7); cx.fill();
      cx.fillStyle = '#5a3315'; cx.beginPath(); cx.arc(x, y - 4 + bob * 0.5, 4, Math.PI * 1.1, Math.PI * 1.9); cx.fill();
      cx.strokeStyle = '#9a7c4f'; cx.lineWidth = 1;
      cx.beginPath(); cx.arc(x, y - 4 + bob * 0.5, 6, Math.PI * 1.2, Math.PI * 1.8); cx.stroke(); // burr hint
      break;
    }
    case 'windsock': {
      const wind = Math.sin(frame * 0.04 + e.x) * 0.25 + 0.75;
      cx.strokeStyle = '#8a8576'; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y - 26); cx.stroke();
      cx.fillStyle = '#e07b30';
      cx.beginPath();
      cx.moveTo(x, y - 26); cx.lineTo(x + 14 * wind, y - 24 + Math.sin(frame * 0.1) * 1.5);
      cx.lineTo(x + 14 * wind, y - 21); cx.lineTo(x, y - 20); cx.closePath(); cx.fill();
      cx.fillStyle = '#fff';
      cx.fillRect(x + 4 * wind, y - 25, 3, 4.5);
      break;
    }
    case 'chapel': {
      cx.fillStyle = '#d8d2c2'; cx.fillRect(x - 10, y - 18, 20, 18);
      cx.fillStyle = '#7a5a39';
      cx.beginPath(); cx.moveTo(x - 13, y - 17); cx.lineTo(x, y - 28); cx.lineTo(x + 13, y - 17); cx.closePath(); cx.fill();
      cx.strokeStyle = '#7a5a39'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(x, y - 28); cx.lineTo(x, y - 33); cx.moveTo(x - 2.5, y - 31); cx.lineTo(x + 2.5, y - 31); cx.stroke();
      cx.fillStyle = '#3d3327'; cx.fillRect(x - 3, y - 11, 6, 11);
      cx.fillStyle = 'rgba(255,216,122,0.9)'; cx.fillRect(x - 1, y - 8, 2, 3); // the candle, always lit
      break;
    }
    case 'npc': {
      if (e.present === false) return;
      if (e.who === 'vera') {
        cx.fillStyle = '#b8483a'; cx.fillRect(x - 5, y - 16, 10, 12);  // flight suit
        cx.fillStyle = '#e8b88a'; cx.beginPath(); cx.arc(x, y - 20, 4.5, 0, 7); cx.fill();
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x, y - 23, 4.2, Math.PI, 0); cx.fill(); // helmet
        cx.fillStyle = '#3d3327'; cx.fillRect(x - 4, y - 5, 3, 5); cx.fillRect(x + 1, y - 5, 3, 5);
        cx.strokeStyle = '#888'; cx.lineWidth = 1; // sunglasses
        cx.beginPath(); cx.moveTo(x - 3, y - 21); cx.lineTo(x + 3, y - 21); cx.stroke();
        break;
      }

      // --- Fallback: procedural NPC drawing (Greta / Norbert without sprites) ---
      const isG = e.who === 'greta';
      const px2 = x, py2 = y;
      // body
      cx.fillStyle = isG ? '#6f5a7d' : '#3f5e3a';
      cx.fillRect(px2 - 5, py2 - 16, 10, 12);
      // apron for Norbert
      if (!isG) { cx.fillStyle = '#2b3a66'; cx.fillRect(px2 - 4, py2 - 11, 8, 7); }
      // head
      cx.fillStyle = '#e8b88a'; cx.beginPath(); cx.arc(px2, py2 - 20, 4.5, 0, 7); cx.fill();
      if (isG) { cx.fillStyle = '#cfcfcf'; cx.beginPath(); cx.arc(px2, py2 - 24, 3, 0, 7); cx.fill(); } // grey bun
      else { cx.fillStyle = '#4a5e3a'; cx.fillRect(px2 - 5, py2 - 26, 10, 3); cx.fillRect(px2 - 3, py2 - 28, 6, 3); cx.fillStyle = '#d9577a'; cx.fillRect(px2 + 3, py2 - 28, 2, 4); } // tyrolean hat + feather
      // legs
      cx.fillStyle = '#3d3327'; cx.fillRect(px2 - 4, py2 - 5, 3, 5); cx.fillRect(px2 + 1, py2 - 5, 3, 5);
      break;
    }
    case 'dog': {
      if (e.present === false) return;
      const wag = Math.sin(frame * 0.3) * 3;
      cx.fillStyle = '#8a6a44';
      cx.fillRect(x - 7, y - 7, 13, 5);
      cx.beginPath(); cx.arc(x + 7, y - 8, 3.5, 0, 7); cx.fill();
      cx.fillRect(x + 7, y - 12, 2, 3); // ear
      cx.strokeStyle = '#8a6a44'; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(x - 7, y - 6); cx.lineTo(x - 11, y - 9 + wag); cx.stroke();
      cx.fillRect(x - 6, y - 3, 2, 3); cx.fillRect(x + 3, y - 3, 2, 3);
      break;
    }
    case 'cow': {
      cx.fillStyle = '#9a6f4a';
      cx.fillRect(x - 12, y - 14, 24, 9);
      cx.fillStyle = '#e8e0cd'; cx.fillRect(x - 4, y - 14, 7, 9); // patch
      cx.fillStyle = '#9a6f4a'; cx.beginPath(); cx.arc(x + 14, y - 14, 4.5, 0, 7); cx.fill();
      cx.fillStyle = '#3d3327';
      cx.fillRect(x - 10, y - 5, 3, 5); cx.fillRect(x - 2, y - 5, 3, 5); cx.fillRect(x + 6, y - 5, 3, 5);
      cx.fillStyle = '#d8d2bd'; cx.fillRect(x + 11, y - 20, 2, 4); cx.fillRect(x + 16, y - 20, 2, 4); // horns
      // bell
      cx.fillStyle = '#c9b46a'; cx.fillRect(x + 12, y - 10, 4, 4);
      break;
    }
    case 'photo': {
      if (taken || !G.flags.finale) return;
      const a = 0.45 + Math.sin(frame * 0.07 + e.x) * 0.25;
      cx.save(); cx.globalAlpha = a;
      cx.strokeStyle = '#ffe9a8'; cx.lineWidth = 1.2; cx.setLineDash([3, 3]);
      cx.strokeRect(x - 10, y - 30 + bob, 20, 15);
      cx.setLineDash([]);
      cx.fillStyle = '#ffe9a8';
      const sa = (frame * 0.05 + e.x) % 6.28;
      cx.fillRect(x - 10 + Math.cos(sa) * 12 + 9, y - 23 + Math.sin(sa) * 9 + bob, 2, 2);
      cx.restore();
      break;
    }
    case 'marmot': {
      const k = eid(e);
      const all5 = Object.keys(G.marmots).length >= 5;
      const hidden = !all5 && G.marmots[k] && e.diveT === 0;
      // burrow
      cx.fillStyle = '#5a4a35'; cx.beginPath(); cx.ellipse(x, y, 8, 3.5, 0, 0, 7); cx.fill();
      if (!hidden) {
        const greeting = all5 && e.greetCd > 200;
        const up = greeting ? -2 - Math.sin(frame * 0.5) * 1.5 : e.alert ? 0 : Math.sin(frame * 0.05 + e.x) * 1;
        cx.fillStyle = '#b08a55';
        cx.fillRect(x - 4, y - 12 + up, 8, 11);
        cx.beginPath(); cx.arc(x, y - 13 + up, 4, 0, 7); cx.fill();
        cx.fillStyle = '#2c2a25'; cx.fillRect(x + 1, y - 14 + up, 1.5, 1.5);
        cx.fillStyle = '#d8c9a8'; cx.fillRect(x - 2, y - 6 + up, 4, 4); // belly
        if (greeting) { // tiny raised paw
          cx.fillStyle = '#b08a55'; cx.fillRect(x + 4, y - 13 + up, 2, 4);
        }
      }
      break;
    }
  }
}

function drawPlayer() {
  const p = player;
  const x = p.x + p.w / 2 - cam.x, y = p.y - cam.y; // y = head top
  const run = Math.abs(p.vx) > 0.4 && p.grounded;
  const leg = Math.sin(p.anim * 2.2) * (run ? 4 : 0);
  const breathe = Math.sin(p.idle) * 0.6;

  cx.save();
  cx.translate(x, y + 10);
  // squash on landing, stretch in fast air
  let sy = 1;
  if (p.landT > 0) sy = 1 - (p.landT / 9) * 0.16;
  else if (!p.grounded && !p.climbing && Math.abs(p.vy) > 5 && !p.gliding) sy = 1.08;
  cx.scale((p.face === -1 ? -1 : 1) * (2 - sy), sy);
  cx.translate(0, -10);

  // legs
  cx.fillStyle = '#41475c';
  if (p.climbing) {
    cx.fillRect(-4, 13, 3, 7); cx.fillRect(2, 11, 3, 7);
  } else if (!p.grounded && !p.swim) {
    cx.fillRect(-4, 13, 3, 7); cx.fillRect(1, 14, 3, 6);
  } else {
    cx.fillRect(-4 + leg * 0.5, 14, 3, 7); cx.fillRect(1 - leg * 0.5, 14, 3, 7);
  }
  // boots
  cx.fillStyle = G.gear.boots ? '#7a4a26' : '#888';
  cx.fillRect(-4 + (p.grounded ? leg * 0.5 : 0), 19, 4, 2.5);
  cx.fillRect(1 - (p.grounded ? leg * 0.5 : 0), 19, 4, 2.5);
  // body / jacket
  cx.fillStyle = G.gear.jacket ? '#c0392b' : '#2e7d6b';
  cx.fillRect(-5, 4 + breathe, 10, 11);
  // backpack
  cx.fillStyle = '#a06a2c';
  cx.fillRect(-9, 5 + breathe, 4, 9);
  cx.fillStyle = '#7c4f1d'; cx.fillRect(-9, 8 + breathe, 4, 2);
  // arms
  cx.fillStyle = G.gear.jacket ? '#a93226' : '#246355';
  if (p.climbing) {
    const arm = Math.sin(p.anim * 3) * 3;
    cx.fillRect(2, 2 + arm, 3, 8); cx.fillRect(-5, 5 - arm, 3, 8);
  } else {
    cx.fillRect(3, 6 + breathe + (run ? -leg * 0.4 : 0), 3, 8);
  }
  // paraglider canopy
  if (p.gliding) {
    cx.strokeStyle = 'rgba(230,235,240,0.9)'; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(-3, 6); cx.lineTo(-13, -12); cx.moveTo(3, 6); cx.lineTo(13, -12); cx.stroke();
    cx.fillStyle = '#c0392b';
    cx.beginPath(); cx.moveTo(-15, -11);
    cx.quadraticCurveTo(0, -22 - Math.sin(p.idle * 2) * 1.5, 15, -11);
    cx.quadraticCurveTo(0, -14, -15, -11); cx.closePath(); cx.fill();
    cx.fillStyle = '#e8e4d0';
    cx.beginPath(); cx.moveTo(-5, -16.6); cx.quadraticCurveTo(0, -21, 5, -16.6);
    cx.quadraticCurveTo(0, -18.5, -5, -16.6); cx.closePath(); cx.fill();
  }
  // head
  cx.fillStyle = '#e8b88a'; cx.beginPath(); cx.arc(0, 0 + breathe, 4.5, 0, 7); cx.fill();
  // beanie
  cx.fillStyle = '#d98032';
  cx.beginPath(); cx.arc(0, -1 + breathe, 4.5, Math.PI, 0); cx.fill();
  cx.fillRect(-4.5, -1.5 + breathe, 9, 2);
  // headlamp
  if (G.gear.lamp) {
    cx.fillStyle = '#4a4e55'; cx.fillRect(2, -3 + breathe, 3.5, 2.5);
    if (lampOn()) { cx.fillStyle = 'rgba(255,235,150,0.8)'; cx.beginPath(); cx.arc(4, -2 + breathe, 1.8, 0, 7); cx.fill(); }
  }
  cx.restore();
}
function lampOn() { return G.gear.lamp && (G.phase === 3 || (curZone && curZone.dark)); }

function drawParts() {
  for (const p of parts) {
    cx.fillStyle = p.c;
    cx.fillRect(p.x - cam.x, p.y - cam.y, p.s || 2, p.s || 2);
  }
}

// ---- critters: butterflies on the Alm, birds over the valley, larch needles
const critters = [];
const CROW_PERCH = { sign: 24, fence: 14, bench: 20, shelter: 22, hut: 50, chapel: 30, windsock: 28 };
function critterTick() {
  if (G.mode !== 'play' || !curZone) return;
  // a crow, perched somewhere sensible until you come too close
  if (Math.random() < 0.004 && !critters.some(c => c.k === 'crow')) {
    const opts = ENTITIES.filter(e => CROW_PERCH[e.t] !== undefined
      && Math.abs(e.x * TILE + 8 - player.x) < VW && Math.abs(e.r * TILE - player.y) < VH
      && Math.abs(e.x * TILE + 8 - player.x) > 70);
    if (opts.length) {
      const e = opts[(Math.random() * opts.length) | 0];
      critters.push({ k: 'crow', x: e.x * TILE + 8, y: e.r * TILE - CROW_PERCH[e.t], t: 1800, fly: false, vx: 0, vy: 0 });
    }
  }
  if (critters.length < 12 && Math.random() < 0.03) {
    const z = curZone;
    if ((z.id === 'alm' || z.id === 'gipfel') && G.phase !== 3 && FLOWERS.length) {
      const f = FLOWERS[(Math.random() * FLOWERS.length) | 0];
      if (Math.abs(f[0] * TILE - player.x) < VW)
        critters.push({ k: 'fly', x: f[0] * TILE + 8, y: f[1] * TILE - 12, t: 600, a: Math.random() * 7, hue: Math.random() < 0.5 ? '#e8e4d0' : '#d9a13d' });
    } else if ((z.id === 'wald' || z.id === 'camp') && G.phase !== 3 && Math.random() < 0.35) {
      critters.push({ k: 'bird', x: cam.x - 20, y: cam.y + 20 + Math.random() * VH * 0.3, vx: 1 + Math.random(), t: 900 });
    } else if ((z.id === 'wald' || z.id === 'galerie' || z.id === 'camp') && Math.random() < 0.6) {
      critters.push({ k: 'needle', x: cam.x + Math.random() * VW, y: cam.y - 8, vy: 0.3 + Math.random() * 0.3, a: Math.random() * 7, t: 700 });
    }
  }
  for (let i = critters.length - 1; i >= 0; i--) {
    const c = critters[i];
    c.t--;
    if (c.k === 'fly') { c.a += 0.07; c.x += Math.sin(c.a) * 0.8; c.y += Math.cos(c.a * 1.7) * 0.5; }
    else if (c.k === 'bird') { c.x += c.vx; c.y += Math.sin(frame * 0.05 + c.x * 0.01) * 0.3; }
    else if (c.k === 'crow') {
      if (!c.fly) {
        if (Math.abs(player.x - c.x) < 55 && Math.abs(player.y - c.y) < 70) {
          c.fly = true; c.vx = (player.x > c.x ? -1 : 1) * 1.7; c.vy = -1.3;
        }
      } else { c.x += c.vx; c.y += c.vy; c.vy = Math.max(-1.7, c.vy - 0.015); }
    }
    else { c.y += c.vy; c.x += Math.sin(frame * 0.04 + c.a) * 0.4; }
    if (c.t <= 0 || c.x < cam.x - 60 || c.x > cam.x + VW + 60 || c.y > cam.y + VH + 20 || c.y < cam.y - 100) critters.splice(i, 1);
  }
}
function drawCritters() {
  for (const c of critters) {
    const x = c.x - cam.x, y = c.y - cam.y;
    if (c.k === 'fly') {
      const flap = Math.sin(frame * 0.5 + c.a) * 2.5;
      cx.fillStyle = c.hue;
      cx.beginPath(); cx.ellipse(x - 1.6, y, 2, 1 + Math.abs(flap) * 0.4, -0.5, 0, 7); cx.fill();
      cx.beginPath(); cx.ellipse(x + 1.6, y, 2, 1 + Math.abs(flap) * 0.4, 0.5, 0, 7); cx.fill();
    } else if (c.k === 'bird') {
      const flap = Math.sin(frame * 0.25 + c.x * 0.05) * 2.5;
      cx.strokeStyle = G.phase === 3 ? 'rgba(180,190,210,0.5)' : 'rgba(60,65,75,0.7)'; cx.lineWidth = 1.2;
      cx.beginPath(); cx.moveTo(x - 4, y - flap); cx.quadraticCurveTo(x, y + 1, x + 4, y - flap); cx.stroke();
    } else if (c.k === 'crow') {
      const f = player.x > c.x ? 1 : -1;
      cx.fillStyle = G.phase === 3 ? '#3a4258' : '#23262e';
      if (!c.fly) {
        const peck = Math.sin(frame * 0.03 + c.x) > 0.92 ? 1.5 : 0;
        cx.beginPath(); cx.ellipse(x - f * 0.5, y - 3, 3.4, 2.3, 0, 0, 7); cx.fill();   // body
        cx.beginPath(); cx.moveTo(x - f * 2.5, y - 3.5); cx.lineTo(x - f * 6.5, y - 5.5); cx.lineTo(x - f * 5, y - 2.2); cx.closePath(); cx.fill(); // tail
        cx.beginPath(); cx.arc(x + f * 2.4, y - 5.8 + peck, 1.9, 0, 7); cx.fill();      // head
        cx.fillStyle = '#d9a13d';
        cx.fillRect(x + (f > 0 ? 4.2 : -6.3), y - 6 + peck, 2.1, 1.1);                  // beak
      } else {
        const flap = Math.sin(frame * 0.45) * 3.2;
        cx.beginPath(); cx.arc(x, y, 1.9, 0, 7); cx.fill();
        cx.strokeStyle = G.phase === 3 ? '#3a4258' : '#23262e'; cx.lineWidth = 1.6;
        cx.beginPath(); cx.moveTo(x - 5.5, y - flap); cx.quadraticCurveTo(x, y + 1.5, x + 5.5, y - flap); cx.stroke();
      }
    } else {
      cx.strokeStyle = 'rgba(196,168,90,0.8)'; cx.lineWidth = 1;
      cx.save(); cx.translate(x, y); cx.rotate(Math.sin(frame * 0.04 + c.a) * 0.8);
      cx.beginPath(); cx.moveTo(-2, 0); cx.lineTo(2, 0); cx.stroke(); cx.restore();
    }
  }
}

// rain
const drops = [];
function rainTick(pc) {
  if (!pc.rain) return;
  if (curZone && curZone.covered) return;
  if (drops.length < 90) drops.push({ x: cam.x + Math.random() * VW, y: cam.y - 10, v: 7 + Math.random() * 3 });
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.y += d.v; d.x += 1.2;
    if (d.y > cam.y + VH) drops.splice(i, 1);
  }
}
function drawRain(pc) {
  if (!pc.rain || (curZone && curZone.covered)) { drops.length = 0; return; }
  cx.strokeStyle = 'rgba(180,200,225,0.45)'; cx.lineWidth = 1;
  cx.beginPath();
  for (const d of drops) {
    cx.moveTo(d.x - cam.x, d.y - cam.y);
    cx.lineTo(d.x - cam.x - 1.5, d.y - cam.y - 9);
  }
  cx.stroke();
}

// light shafts slanting through the larches
function drawLightShafts(pc) {
  if (pc.rain || G.phase === 3 || !curZone) return;
  if (curZone.id !== 'wald' && curZone.id !== 'camp' && curZone.id !== 'galerie') return;
  const warm = G.phase === 4 ? '255,176,110' : '255,244,200';
  const slope = 0.55;
  const k0 = Math.floor((cam.x - slope * VH) / 120) - 1, k1 = Math.floor((cam.x + VW) / 120) + 1;
  for (let k = k0; k <= k1; k++) {
    const h = hash01(k * 13.7 + 5);
    if (h < 0.4) continue;
    const a = (0.045 + 0.05 * Math.sin(frame * 0.008 + k * 2.1)) * (0.5 + h * 0.8);
    if (a <= 0.015) continue;
    const topX = k * 120 + h * 70 - cam.x, w = 12 + h * 26;
    const g = cx.createLinearGradient(topX, 0, topX + slope * VH, VH);
    g.addColorStop(0, `rgba(${warm},${a})`);
    g.addColorStop(1, `rgba(${warm},0)`);
    cx.fillStyle = g;
    cx.beginPath();
    cx.moveTo(topX, -8); cx.lineTo(topX + w, -8);
    cx.lineTo(topX + w + slope * VH, VH + 8); cx.lineTo(topX + slope * VH, VH + 8);
    cx.closePath(); cx.fill();
  }
}

// --------------------------------------------------------------- lighting --
const lightCv = document.createElement('canvas');
const lcx = lightCv.getContext('2d');
function drawLighting(pc) {
  let amb = pc.ambient;
  if (curZone && curZone.dark) amb = Math.max(amb, G.gear.lamp ? 0.86 : 0.94);
  if (amb <= 0.01) return;
  const s = 0.35;
  lightCv.width = Math.ceil(VW * s); lightCv.height = Math.ceil(VH * s);
  lcx.setTransform(s, 0, 0, s, 0, 0);
  lcx.fillStyle = `rgba(8,10,30,${amb})`;
  lcx.fillRect(0, 0, VW, VH);
  lcx.globalCompositeOperation = 'destination-out';
  const punch = (x, y, r, a) => {
    const g = lcx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lcx.fillStyle = g;
    lcx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // player lamp
  const px = player.x + player.w / 2 - cam.x, py = player.y + 6 - cam.y;
  punch(px, py, lampOn() ? 95 : 26, lampOn() ? 0.97 : 0.5);
  // fires
  for (const id in FIRES) {
    const f = FIRES[id];
    const fx = f.x * TILE + 8 - cam.x, fy = f.r * TILE - 10 - cam.y;
    if (fx > -100 && fx < VW + 100 && fy > -100 && fy < VH + 100)
      punch(fx, fy, 70 + Math.sin(frame * 0.2) * 5, 0.95);
  }
  // hut windows
  const hut = ENTITIES.find(e => e.t === 'hut');
  const hx = hut.x * TILE + 8 - cam.x, hy = hut.r * TILE - 18 - cam.y;
  if (hx > -100 && hx < VW + 100) punch(hx, hy, 55, 0.8);
  lcx.globalCompositeOperation = 'source-over';
  cx.imageSmoothingEnabled = true;
  cx.drawImage(lightCv, 0, 0, VW, VH);
  cx.imageSmoothingEnabled = false;
}

// ============================================================ vector icons =
// every former emoji, redrawn in the game's own flat style.
// drawn centered at (x,y) into an s×s box (design space is 16 units).
function drawIcon(name, x, y, s) {
  cx.save();
  cx.translate(x, y);
  cx.scale(s / 16, s / 16);
  cx.lineCap = 'round'; cx.lineJoin = 'round';
  switch (name) {
    case 'fire': {
      cx.fillStyle = '#ff9d2e';
      cx.beginPath(); cx.moveTo(-4, 7); cx.quadraticCurveTo(-7.5, 2, -3.5, -2);
      cx.quadraticCurveTo(-1, -4.5, 0.5, -8); cx.quadraticCurveTo(1, -3.5, 4, -0.5);
      cx.quadraticCurveTo(7, 3, 4, 7); cx.closePath(); cx.fill();
      cx.fillStyle = '#ffd54f';
      cx.beginPath(); cx.moveTo(-1.8, 7); cx.quadraticCurveTo(-3.2, 3, 0, -0.5);
      cx.quadraticCurveTo(3, 3, 1.8, 7); cx.closePath(); cx.fill();
      break;
    }
    case 'boots': {
      cx.fillStyle = '#7a4a26';
      cx.fillRect(-5, -7, 6, 9);
      cx.fillRect(-5, -1, 11, 7);
      cx.fillStyle = '#4a2e16'; cx.fillRect(-6, 4, 12, 3);
      cx.fillStyle = '#c9a96a'; cx.fillRect(-3.6, -6, 1.4, 6);
      break;
    }
    case 'jacket': {
      cx.fillStyle = '#c0392b';
      cx.beginPath(); cx.arc(0, -4, 4.2, Math.PI, 0); cx.fill();    // hood
      cx.fillRect(-4.2, -4, 8.4, 10);                               // torso
      cx.fillRect(-7.8, -3.5, 2.6, 7.5); cx.fillRect(5.2, -3.5, 2.6, 7.5); // arms, set off a touch
      cx.fillStyle = '#8e2a20'; cx.fillRect(-0.8, -4, 1.6, 10);     // zip
      cx.fillStyle = '#e8b88a'; cx.fillRect(-7.6, 3, 2.2, 1.6); cx.fillRect(5.4, 3, 2.2, 1.6); // cuffs
      break;
    }
    case 'lamp': {
      cx.fillStyle = '#2c2e33'; cx.fillRect(-8, -1.5, 16, 3);       // strap
      cx.fillStyle = '#4a4e55'; cx.fillRect(-5, -4.5, 9, 9);
      cx.fillStyle = '#ffe27a'; cx.beginPath(); cx.arc(1, 0, 3, 0, 7); cx.fill();
      cx.fillStyle = 'rgba(255,226,122,0.45)';
      cx.beginPath(); cx.moveTo(3.5, -2.5); cx.lineTo(8, -5.5); cx.lineTo(8, 5.5); cx.lineTo(3.5, 2.5); cx.closePath(); cx.fill();
      break;
    }
    case 'kit': { // carabiner
      cx.strokeStyle = '#e07b30'; cx.lineWidth = 2.6;
      cx.beginPath(); cx.ellipse(0, 0, 4.6, 6.8, 0.35, 0, 7); cx.stroke();
      cx.strokeStyle = '#d4d4d4'; cx.lineWidth = 1.8;
      cx.beginPath(); cx.moveTo(2.4, -5.2); cx.lineTo(4.6, -0.5); cx.stroke();
      break;
    }
    case 'glider': {
      cx.fillStyle = '#c0392b';
      cx.beginPath(); cx.moveTo(-8, -2); cx.quadraticCurveTo(0, -8.5, 8, -2);
      cx.quadraticCurveTo(0, -4.5, -8, -2); cx.closePath(); cx.fill();
      cx.strokeStyle = 'rgba(230,235,240,0.9)'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(-6, -3); cx.lineTo(0, 5.5); cx.moveTo(6, -3); cx.lineTo(0, 5.5); cx.stroke();
      cx.fillStyle = '#e8b88a'; cx.beginPath(); cx.arc(0, 6, 1.9, 0, 7); cx.fill();
      break;
    }
    case 'knoedel': {
      cx.fillStyle = '#e3c490'; cx.beginPath(); cx.arc(0, -0.5, 5.8, 0, 7); cx.fill();
      cx.fillStyle = '#9a7c4f';
      cx.fillRect(-2.5, -3, 1.6, 1.6); cx.fillRect(1, -1.5, 1.6, 1.6); cx.fillRect(-1, 1, 1.6, 1.6);
      cx.fillStyle = '#7a5a39'; cx.fillRect(-7, 5.5, 14, 2);
      break;
    }
    case 'book': {
      cx.fillStyle = '#7a5a39'; // cover, so the pages read on any background
      cx.beginPath(); cx.moveTo(0, -4); cx.quadraticCurveTo(-5, -8.5, -9.5, -6.5);
      cx.lineTo(-9.5, 5.5); cx.quadraticCurveTo(-5, 4, 0, 6.5);
      cx.quadraticCurveTo(5, 4, 9.5, 5.5); cx.lineTo(9.5, -6.5);
      cx.quadraticCurveTo(5, -8.5, 0, -4); cx.closePath(); cx.fill();
      cx.fillStyle = '#f3ecd2';
      cx.beginPath(); cx.moveTo(0, -5); cx.quadraticCurveTo(-4, -7, -8, -5.5);
      cx.lineTo(-8, 4.5); cx.quadraticCurveTo(-4, 3, 0, 5); cx.closePath(); cx.fill();
      cx.beginPath(); cx.moveTo(0, -5); cx.quadraticCurveTo(4, -7, 8, -5.5);
      cx.lineTo(8, 4.5); cx.quadraticCurveTo(4, 3, 0, 5); cx.closePath(); cx.fill();
      cx.strokeStyle = '#b9ac82'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, -5); cx.lineTo(0, 5); cx.stroke();
      cx.beginPath(); cx.moveTo(-6, -2.5); cx.lineTo(-2, -2); cx.moveTo(-6, 0.5); cx.lineTo(-2, 1);
      cx.moveTo(2, -2); cx.lineTo(6, -2.5); cx.moveTo(2, 1); cx.lineTo(6, 0.5); cx.stroke();
      break;
    }
    case 'camera': {
      cx.fillStyle = '#3d4046';
      cx.fillRect(-7, -4, 14, 9.5);
      cx.fillRect(-2.5, -6, 5, 2.5);
      cx.fillStyle = '#8fb6c9'; cx.beginPath(); cx.arc(0, 0.8, 3, 0, 7); cx.fill();
      cx.strokeStyle = '#23252a'; cx.lineWidth = 1.2;
      cx.beginPath(); cx.arc(0, 0.8, 3, 0, 7); cx.stroke();
      cx.fillStyle = '#d9577a'; cx.fillRect(4, -2.8, 1.8, 1.6);
      break;
    }
    case 'map': {
      cx.fillStyle = '#ece3c8';
      cx.beginPath(); cx.moveTo(-7, -4.5); cx.lineTo(-2.3, -6.5); cx.lineTo(2.3, -4.5); cx.lineTo(7, -6.5);
      cx.lineTo(7, 4.5); cx.lineTo(2.3, 6.5); cx.lineTo(-2.3, 4.5); cx.lineTo(-7, 6.5); cx.closePath(); cx.fill();
      cx.strokeStyle = '#b9ac82'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(-2.3, -6.5); cx.lineTo(-2.3, 4.5); cx.moveTo(2.3, -4.5); cx.lineTo(2.3, 6.5); cx.stroke();
      cx.strokeStyle = '#c0392b'; cx.setLineDash([1.6, 1.6]);
      cx.beginPath(); cx.moveTo(-5, 3.5); cx.quadraticCurveTo(0, -1, 5, -3); cx.stroke();
      cx.setLineDash([]);
      break;
    }
    case 'sound': case 'mute': {
      cx.fillStyle = '#f3ecd2';
      cx.beginPath(); cx.moveTo(-7, -2.5); cx.lineTo(-3.5, -2.5); cx.lineTo(0.5, -6); cx.lineTo(0.5, 6);
      cx.lineTo(-3.5, 2.5); cx.lineTo(-7, 2.5); cx.closePath(); cx.fill();
      if (name === 'sound') {
        cx.strokeStyle = '#f3ecd2'; cx.lineWidth = 1.4;
        cx.beginPath(); cx.arc(1.5, 0, 3.4, -0.85, 0.85); cx.stroke();
        cx.beginPath(); cx.arc(1.5, 0, 5.8, -0.85, 0.85); cx.stroke();
      } else {
        cx.strokeStyle = '#e74c3c'; cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(-7, -7); cx.lineTo(7, 7); cx.stroke();
      }
      break;
    }
    case 'tent': {
      cx.fillStyle = '#27538f';
      cx.beginPath(); cx.moveTo(-8, 6); cx.lineTo(0, -6); cx.lineTo(8, 6); cx.closePath(); cx.fill();
      cx.fillStyle = '#0e2138';
      cx.beginPath(); cx.moveTo(-2.5, 6); cx.lineTo(0, 1); cx.lineTo(2.5, 6); cx.closePath(); cx.fill();
      break;
    }
    case 'globe': {
      cx.strokeStyle = '#9fc3e0'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.arc(0, 0, 6.5, 0, 7); cx.stroke();
      cx.beginPath(); cx.ellipse(0, 0, 3, 6.5, 0, 0, 7); cx.stroke();
      cx.beginPath(); cx.moveTo(-6.5, 0); cx.lineTo(6.5, 0); cx.stroke();
      break;
    }
    case 'marmot': {
      cx.fillStyle = '#b08a55';
      cx.fillRect(-3.5, -2, 7, 9);
      cx.beginPath(); cx.arc(0, -3.5, 3.6, 0, 7); cx.fill();
      cx.fillStyle = '#d8c9a8'; cx.fillRect(-1.8, 1, 3.6, 4.5);
      cx.fillStyle = '#2c2a25'; cx.fillRect(0.8, -4.5, 1.3, 1.3);
      break;
    }
    case 'chestnut': {
      cx.fillStyle = '#7c4a21';
      cx.beginPath(); cx.arc(0, 0.5, 5.5, 0, 7); cx.fill();
      cx.fillStyle = '#5a3315';
      cx.beginPath(); cx.arc(0, 0.5, 5.5, Math.PI * 1.1, Math.PI * 1.9); cx.fill();
      cx.fillStyle = '#e8e0cd'; cx.beginPath(); cx.arc(-1.8, 2.2, 1.4, 0, 7); cx.fill();
      break;
    }
    case 'ring': {
      cx.strokeStyle = 'rgba(255,213,79,0.4)'; cx.lineWidth = 4;
      cx.beginPath(); cx.ellipse(0, 0, 4.5, 6, 0, 0, 7); cx.stroke();
      cx.strokeStyle = '#ffd54f'; cx.lineWidth = 2;
      cx.beginPath(); cx.ellipse(0, 0, 4.5, 6, 0, 0, 7); cx.stroke();
      break;
    }
    case 'drop': {
      cx.fillStyle = '#5b9fd4';
      cx.beginPath(); cx.moveTo(0, -7);
      cx.quadraticCurveTo(5.5, 0.5, 3.5, 4); cx.arc(0, 4, 3.6, -0.3, Math.PI + 0.3);
      cx.quadraticCurveTo(-5.5, 0.5, 0, -7); cx.closePath(); cx.fill();
      cx.fillStyle = 'rgba(255,255,255,0.55)';
      cx.beginPath(); cx.arc(-1.4, 2.8, 1.2, 0, 7); cx.fill();
      break;
    }
    case 'cable': {
      cx.strokeStyle = '#5f6a72'; cx.lineWidth = 2.2;
      cx.beginPath(); cx.moveTo(0, -7); cx.lineTo(0, 7); cx.stroke();
      cx.fillStyle = '#7d8891';
      cx.fillRect(-3.5, -4.5, 7, 2); cx.fillRect(-3.5, -0.5, 7, 2); cx.fillRect(-3.5, 3.5, 7, 2);
      break;
    }
    case 'cross': {
      cx.strokeStyle = '#8a6f4d'; cx.lineWidth = 2.2;
      cx.beginPath(); cx.moveTo(0, -7); cx.lineTo(0, 7); cx.moveTo(-4.5, -2.5); cx.lineTo(4.5, -2.5); cx.stroke();
      break;
    }
    case 'x': {
      cx.strokeStyle = 'rgba(255,255,255,0.85)'; cx.lineWidth = 2.2;
      cx.beginPath(); cx.moveTo(-4.5, -4.5); cx.lineTo(4.5, 4.5); cx.moveTo(4.5, -4.5); cx.lineTo(-4.5, 4.5); cx.stroke();
      break;
    }
    case 'expand': case 'shrink': {
      cx.strokeStyle = 'rgba(255,255,255,0.85)'; cx.lineWidth = 1.8;
      const out = name === 'expand';
      for (const [sx2, sy2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const tipX = sx2 * (out ? 6 : 1.8), tipY = sy2 * (out ? 6 : 1.8);   // arrow tip
        const tailX = sx2 * (out ? 1.8 : 6), tailY = sy2 * (out ? 1.8 : 6); // arrow tail
        const hd = out ? sx2 * 3 : -sx2 * 3, hv = out ? sy2 * 3 : -sy2 * 3;
        cx.beginPath();
        cx.moveTo(tailX, tailY); cx.lineTo(tipX, tipY);
        cx.moveTo(tipX - hd, tipY); cx.lineTo(tipX, tipY); cx.lineTo(tipX, tipY - hv);
        cx.stroke();
      }
      break;
    }
    case 'jump': { // a hop arc lifting off the ground
      cx.strokeStyle = 'rgba(243,236,210,0.92)'; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(-6.5, 5); cx.quadraticCurveTo(0, -10, 6.5, 0); cx.stroke();
      cx.beginPath(); cx.moveTo(6.5, 0); cx.lineTo(3, -0.6); cx.moveTo(6.5, 0); cx.lineTo(6.2, -3.8); cx.stroke();
      cx.strokeStyle = 'rgba(243,236,210,0.5)'; cx.lineWidth = 1.6;
      cx.beginPath(); cx.moveTo(-7.5, 6.5); cx.lineTo(7.5, 6.5); cx.stroke();
      break;
    }
    case 'chat': { // speech bubble with a tail and three dots
      cx.fillStyle = 'rgba(243,236,210,0.92)';
      roundRect(-7, -6, 14, 10, 3.2); cx.fill();
      cx.beginPath(); cx.moveTo(-3, 4); cx.lineTo(-5.5, 7.5); cx.lineTo(0, 4); cx.closePath(); cx.fill();
      cx.fillStyle = '#2a2310';
      for (const dx of [-3.2, 0, 3.2]) { cx.beginPath(); cx.arc(dx, -1, 1.1, 0, 7); cx.fill(); }
      break;
    }
    case 'hand': { // an open hand reaching up to pick something up
      cx.fillStyle = 'rgba(255,213,79,0.85)'; cx.beginPath(); cx.arc(0, -6.6, 2, 0, 7); cx.fill();
      cx.fillStyle = 'rgba(243,236,210,0.92)';
      roundRect(-4.4, -0.5, 8.8, 6, 1.5); cx.fill();
      cx.beginPath(); cx.arc(0, 5, 4.4, 0, Math.PI); cx.fill();
      for (let i = 0; i < 4; i++) { cx.fillRect(-4.4 + i * 2.7, -3.6, 1.8, 4); }
      break;
    }
    case 'look': { // an eye, for reading signs and taking in views
      cx.strokeStyle = 'rgba(243,236,210,0.92)'; cx.lineWidth = 1.8;
      cx.beginPath(); cx.moveTo(-7.5, 0); cx.quadraticCurveTo(0, -6.5, 7.5, 0);
      cx.quadraticCurveTo(0, 6.5, -7.5, 0); cx.closePath(); cx.stroke();
      cx.fillStyle = 'rgba(243,236,210,0.92)'; cx.beginPath(); cx.arc(0, 0, 2.6, 0, 7); cx.fill();
      cx.fillStyle = '#2a2310'; cx.beginPath(); cx.arc(0, 0, 1.1, 0, 7); cx.fill();
      break;
    }
    case 'rest': { // a bench to sit and warm up on
      cx.strokeStyle = 'rgba(243,236,210,0.92)'; cx.lineWidth = 1.8;
      cx.beginPath(); cx.moveTo(-7, -1.5); cx.lineTo(7, -1.5); cx.stroke();
      cx.beginPath(); cx.moveTo(-7, 1.5); cx.lineTo(7, 1.5); cx.stroke();
      cx.beginPath(); cx.moveTo(-5, 1.5); cx.lineTo(-5, 6); cx.moveTo(5, 1.5); cx.lineTo(5, 6); cx.stroke();
      break;
    }
  }
  cx.restore();
}

// icon+text stat rows, centered as a group
function drawIconStats(segs, cxX, y) {
  cx.font = '12px Georgia, serif';
  const iw = 13, gap = 4, pad = 13;
  let total = -pad;
  for (const [, t] of segs) total += iw + gap + cx.measureText(t).width + pad;
  let x = cxX - total / 2;
  cx.textAlign = 'left';
  for (const [ic, t] of segs) {
    drawIcon(ic, x + iw / 2, y, iw);
    cx.fillText(t, x + iw + gap, y);
    x += iw + gap + cx.measureText(t).width + pad;
  }
  cx.textAlign = 'center';
}

// ===================================================================== HUD =
function px(n) { return n; } // logical px in zoomed space

// shared HUD chrome: dark panels, brass borders, small-caps serif
const UI_GOLD = '#e0b86a', UI_GOLD_DIM = 'rgba(224,184,106,0.5)', UI_GOLD_FAINT = 'rgba(224,184,106,0.18)';
const UI_CREAM = '#f3ecd2', UI_DARK = 'rgba(13,16,26,0.78)';
function setTracking(v) { try { cx.letterSpacing = v + 'px'; } catch (e) {} }
// framed panel: dark fill, brass border, inner hairline, corner ticks
function panel(x, y, w, h, r, plain) {
  r = r || 7;
  cx.fillStyle = UI_DARK; roundRect(x, y, w, h, r); cx.fill();
  cx.strokeStyle = UI_GOLD_DIM; cx.lineWidth = 1; roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r); cx.stroke();
  if (plain) return;
  cx.strokeStyle = UI_GOLD_FAINT; roundRect(x + 3, y + 3, w - 6, h - 6, Math.max(2, r - 3)); cx.stroke();
  cx.strokeStyle = UI_GOLD; cx.lineWidth = 1.4;
  const c = Math.min(7, w * 0.2, h * 0.2);
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const ax = sx > 0 ? x + 2.5 : x + w - 2.5, ay = sy > 0 ? y + 2.5 : y + h - 2.5;
    cx.beginPath(); cx.moveTo(ax + sx * c, ay); cx.lineTo(ax, ay); cx.lineTo(ax, ay + sy * c); cx.stroke();
  }
  cx.lineWidth = 1;
}

// portraits for the dialog box and the stat cluster — same flat style as the sprites
function portraitKey(name) {
  switch ((name || '').toLowerCase()) {
    case 'greta': return 'greta';
    case 'norbert': return 'norbert';
    case 'vera': return 'vera';
    case 'du': case 'you': return 'player';
    case 'strolch': return 'dog';
    case 'kuh': case 'cow': return 'cow';
  }
  return null;
}
function drawPortrait(who, x, y, s) {

  // Fallback: procedural portrait
  cx.save();
  cx.translate(x, y); cx.scale(s / 32, s / 32);
  cx.beginPath(); cx.rect(-16, -16, 32, 32); cx.clip();
  const bg = cx.createLinearGradient(0, -16, 0, 16);
  bg.addColorStop(0, '#37425c'); bg.addColorStop(1, '#1f2638');
  cx.fillStyle = bg; cx.fillRect(-16, -16, 32, 32);
  const skin = '#e8b88a', eye = '#2c2a25';
  const shoulders = c => { cx.fillStyle = c; cx.beginPath(); cx.moveTo(-13, 16); cx.quadraticCurveTo(0, 4, 13, 16); cx.lineTo(16, 16); cx.lineTo(-16, 16); cx.closePath(); cx.fill(); };
  const head = hy => { cx.fillStyle = skin; cx.beginPath(); cx.arc(0, hy, 7.5, 0, 7); cx.fill(); };
  const eyes = hy => { cx.fillStyle = eye; cx.fillRect(-3.6, hy, 2, 2); cx.fillRect(1.6, hy, 2, 2); };
  switch (who) {
    case 'player': {
      shoulders(G.gear.jacket ? '#c0392b' : '#2e7d6b');
      head(-1); eyes(-1);
      cx.fillStyle = '#d98032';                                        // beanie
      cx.beginPath(); cx.arc(0, -3.5, 7.6, Math.PI, 0); cx.fill();
      cx.fillRect(-7.6, -5, 15.2, 2.6);
      cx.fillStyle = '#b96a24'; cx.fillRect(-7.6, -3.2, 15.2, 1);
      break;
    }
    case 'greta': {
      shoulders('#6f5a7d');
      head(-1); eyes(-1);
      cx.fillStyle = '#cfcfcf';                                        // grey hair + bun
      cx.beginPath(); cx.arc(0, -3.5, 7.6, Math.PI, 0); cx.fill();
      cx.beginPath(); cx.arc(0, -12, 3.2, 0, 7); cx.fill();
      break;
    }
    case 'norbert': {
      shoulders('#3f5e3a');
      cx.fillStyle = '#2b3a66'; cx.fillRect(-4, 10, 8, 6);             // apron bib
      head(-1); eyes(-1);
      cx.fillStyle = '#4a5e3a';                                        // tyrolean hat
      cx.fillRect(-8.5, -7.5, 17, 2.6);
      cx.fillRect(-5.5, -13.5, 11, 6.5);
      cx.fillStyle = '#d9577a'; cx.fillRect(4, -14, 2, 5);             // feather
      break;
    }
    case 'vera': {
      shoulders('#b8483a');
      head(-1);
      cx.fillStyle = '#f0f0ea';                                        // flight helmet
      cx.beginPath(); cx.arc(0, -2.5, 7.8, Math.PI, 0); cx.fill();
      cx.fillStyle = '#33363d'; cx.fillRect(-5.5, -2, 11, 2.4);        // sunglasses
      cx.fillStyle = '#8fb6c9'; cx.fillRect(-4, -1.6, 2, 1.2);
      break;
    }
    case 'dog': {
      shoulders('#8a6a44');
      cx.fillStyle = '#8a6a44';
      cx.fillRect(-8.5, -10, 4, 7); cx.fillRect(4.5, -10, 4, 7);       // ears
      cx.beginPath(); cx.arc(0, -1, 7.2, 0, 7); cx.fill();             // head
      cx.fillStyle = '#a8845a'; cx.beginPath(); cx.ellipse(0, 2.5, 4.2, 3, 0, 0, 7); cx.fill(); // muzzle
      cx.fillStyle = eye; cx.beginPath(); cx.arc(0, 1.2, 1.7, 0, 7); cx.fill(); // nose
      eyes(-4);
      break;
    }
    case 'cow': {
      cx.fillStyle = '#d8d2bd';                                        // horns
      cx.fillRect(-8.5, -12, 2.6, 5); cx.fillRect(5.9, -12, 2.6, 5);
      cx.fillStyle = '#9a6f4a';
      cx.fillRect(-11.5, -6, 3.5, 4); cx.fillRect(8, -6, 3.5, 4);      // ears
      cx.beginPath(); cx.arc(0, -1, 8, 0, 7); cx.fill();               // head
      cx.fillStyle = '#e8e0cd'; cx.beginPath(); cx.arc(3.2, -3, 3.6, 0, 7); cx.fill(); // patch
      cx.fillStyle = '#d8c9a8'; cx.beginPath(); cx.ellipse(0, 4.5, 5.2, 3.2, 0, 0, 7); cx.fill(); // muzzle
      cx.fillStyle = eye; cx.fillRect(-2, 3.8, 1.4, 1.4); cx.fillRect(0.8, 3.8, 1.4, 1.4); // nostrils
      eyes(-4);
      break;
    }
  }
  cx.restore();
}

function drawHUD() {
  cx.save();
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const W = cv.width / DPR, H = cv.height / DPR;
  cx.textBaseline = 'middle';

  // top-left stat cluster: who you are, how warm, how much of the story found
  const bw = Math.min(140, W * 0.28);
  panel(12, 12, bw + 82, 54, 8);
  cx.fillStyle = '#10141f'; roundRect(19, 19, 40, 40, 4); cx.fill();
  drawPortrait('player', 39, 39, 38);
  cx.strokeStyle = UI_GOLD_DIM; cx.lineWidth = 1; roundRect(19.5, 19.5, 39, 39, 4); cx.stroke();
  const wx = 68;
  cx.textAlign = 'left';
  drawIcon('fire', wx + 6, 27, 13);
  cx.fillStyle = 'rgba(255,255,255,0.13)'; roundRect(wx + 15, 21, bw, 11, 4); cx.fill();
  const warm = Math.max(0, player.warmth / player.maxWarmth);
  if (warm > 0.005) {
    const wg = cx.createLinearGradient(wx + 15, 0, wx + 15 + bw, 0);
    if (warm > 0.35) { wg.addColorStop(0, '#e2641e'); wg.addColorStop(1, '#ffd54f'); }
    else { wg.addColorStop(0, '#b93226'); wg.addColorStop(1, '#e74c3c'); }
    cx.fillStyle = wg; roundRect(wx + 15, 21, bw * warm, 11, 4); cx.fill();
  }
  cx.strokeStyle = UI_GOLD_FAINT; roundRect(wx + 15.5, 21.5, bw - 1, 10, 4); cx.stroke();
  drawIcon('book', wx + 6, 47, 13);
  cx.fillStyle = UI_CREAM; cx.font = '11.5px Georgia, serif';
  cx.fillText(`${Object.keys(G.pages).length}/7`, wx + 15, 47.5);

  // gear chips
  let gx = 12, gy = 74;
  for (const g of ['boots', 'jacket', 'lamp', 'kit', 'glider']) {
    if (G.gear[g]) {
      panel(gx, gy, 26, 26, 6, true);
      drawIcon(g, gx + 13, gy + 13, 17);
      gx += 31;
    }
  }
  if (G.knoedel) { panel(gx, gy, 26, 26, 6, true); drawIcon('knoedel', gx + 13, gy + 13, 17); }


  // map, mute & fullscreen buttons
  BTNS = [];
  addBtn('map', W - 49, 60, 20, 'i:map');
  addBtn('mute', W - 49, 106, 20, muted ? 'i:mute' : 'i:sound');
  if (fsSupported) addBtn('fs', W - 49, 152, 20, isFullscreen() ? 'i:shrink' : 'i:expand');

  // touch controls: analog joystick (left) + adaptive action buttons (right)
  if (isTouch && (G.mode === 'play' || G.mode === 'dialog')) {
    const { jR, r, jx, by } = touchCtrls(W, H);
    joy.r = jR * DPR;
    joy.restx = (28 + jR) * DPR; joy.resty = (H - 28 - jR) * DPR;
    if (!joy.active) { joy.bx = joy.restx; joy.by = joy.resty; joy.kx = joy.bx; joy.ky = joy.by; }
    drawJoystick(jR);

    addBtn('jump', jx, by, r, 'i:' + jumpIcon());
    // secondary button only appears when an interaction is in reach
    if (nearInteract && G.mode === 'play') addBtn('act', jx - r * 1.78, by - r * 0.62, r * 0.84, 'i:' + actIcon());
  }
  for (const b of BTNS) drawBtn(b);

  // interact hint
  if (nearInteract && G.mode === 'play' && !isTouch) {
    const ex = (nearInteract.x * TILE + 8 - cam.x) * (ZOOM / DPR), ey = (nearInteract.r * TILE - 38 - cam.y) * (ZOOM / DPR);
    cx.fillStyle = UI_DARK; roundRect(ex - 11, ey - 11, 22, 22, 6); cx.fill();
    cx.strokeStyle = UI_GOLD_DIM; cx.lineWidth = 1; roundRect(ex - 10.5, ey - 10.5, 21, 21, 6); cx.stroke();
    cx.fillStyle = UI_GOLD; cx.font = 'bold 12px Georgia, serif'; cx.textAlign = 'center';
    cx.fillText('E', ex, ey + 0.5);
  }

  // toasts
  let ty = H - (isTouch ? 130 : 60);
  for (const t of G.toasts) {
    const a = Math.min(1, t.t / 40);
    cx.globalAlpha = a;
    cx.font = '12.5px Georgia, serif';
    const w = cx.measureText(t.msg).width + 26;
    cx.fillStyle = UI_DARK; roundRect(W / 2 - w / 2, ty - 13, w, 26, 9); cx.fill();
    cx.strokeStyle = UI_GOLD_FAINT; cx.lineWidth = 1; roundRect(W / 2 - w / 2 + 0.5, ty - 12.5, w - 1, 25, 9); cx.stroke();
    cx.fillStyle = UI_CREAM; cx.textAlign = 'center'; cx.fillText(t.msg, W / 2, ty);
    cx.globalAlpha = 1;
    ty -= 32;
  }

  // zone banner
  if (bannerT > 120 && bannerZone) {
    const a = Math.min(1, (220 - bannerT) / 30);
    cx.globalAlpha = a;
    setTracking(2);
    cx.fillStyle = UI_CREAM; cx.font = 'bold 18px Georgia, serif'; cx.textAlign = 'center';
    const bn = (LANG === 'en' ? bannerZone.en : bannerZone.de).toUpperCase();
    cx.fillText(bn, W / 2, H * 0.2);
    setTracking(0);
    const bnw = cx.measureText(bn).width;
    cx.strokeStyle = UI_GOLD; cx.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      cx.save(); cx.translate(W / 2 + s * (bnw / 2 + 18), H * 0.2); cx.rotate(Math.PI / 4);
      cx.strokeRect(-2.4, -2.4, 4.8, 4.8); cx.restore();
    }
    cx.font = 'italic 13px Georgia, serif'; cx.fillStyle = 'rgba(243,236,210,0.8)';
    cx.fillText(LANG === 'en' ? `${bannerZone.de} · ${bannerZone.it}` : bannerZone.it, W / 2, H * 0.2 + 22);
    cx.globalAlpha = 1;
  }

  // caption card (phase change)
  if (G.caption) {
    const c = G.caption;
    const a = Math.min(1, (c.t0 - c.t) / 25, c.t / 25);
    cx.globalAlpha = Math.max(0, Math.min(1, a));
    cx.fillStyle = 'rgba(12,14,28,0.6)'; cx.fillRect(0, H * 0.34, W, 64);
    cx.fillStyle = '#f3ecd2'; cx.font = 'bold 17px Georgia, serif'; cx.textAlign = 'center';
    cx.fillText(c.lines[0], W / 2, H * 0.34 + 24);
    cx.font = 'italic 12px Georgia, serif';
    cx.fillText(c.lines[1] || '', W / 2, H * 0.34 + 46);
    cx.globalAlpha = 1;
    c.t--; if (c.t <= 0) G.caption = null;
  }

  // dialog box
  if (G.mode === 'dialog') drawDialog(W, H);

  cx.restore();
}

function addBtn(id, x, y, r, label) { BTNS.push({ id, x: x * DPR, y: y * DPR, r: r * DPR, label, lx: x, ly: y, lr: r }); }
function drawBtn(b) {
  if (!isTouch && b.id !== 'map' && b.id !== 'mute' && b.id !== 'fs') return;
  if (!b.lr || b.lr < 1) return;
  const on = touchState[b.id];
  cx.fillStyle = on ? 'rgba(224,184,106,0.42)' : 'rgba(13,16,26,0.55)';
  cx.beginPath(); cx.arc(b.lx, b.ly, b.lr, 0, 7); cx.fill();
  cx.strokeStyle = on ? UI_GOLD : UI_GOLD_DIM; cx.lineWidth = 1.5;
  cx.beginPath(); cx.arc(b.lx, b.ly, b.lr, 0, 7); cx.stroke();
  cx.strokeStyle = UI_GOLD_FAINT; cx.lineWidth = 1;
  cx.beginPath(); cx.arc(b.lx, b.ly, b.lr - 2.5, 0, 7); cx.stroke();
  if (b.label && b.label.startsWith('i:')) {
    drawIcon(b.label.slice(2), b.lx, b.ly, b.lr * 1.25);
  } else {
    cx.fillStyle = on ? '#1a1408' : UI_CREAM; cx.font = `bold ${Math.round(b.lr * 0.7)}px Georgia, serif`; cx.textAlign = 'center';
    cx.fillText(b.label, b.lx, b.ly + 1);
  }
}

function roundRect(x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
}

// shared geometry for the on-screen controls, so the joystick, the action
// buttons and the dialog box that tucks between them all agree (CSS px)
function touchCtrls(W, H) {
  const jR = Math.min(52, W * 0.08 + 32);
  const r = Math.min(34, W * 0.06 + 20);
  const jx = W - r - 22, by = H - r - 24;
  const left = 28 + jR * 2 + 10;                       // right edge of the stick
  const right = W - (r + 22 + r * 1.78 + r * 0.84) - 10; // left edge of the buttons
  return { jR, r, jx, by, left, right };
}

// semi-transparent floating thumbstick — a recessed base ring with directional
// ticks and a glassy knob that tracks the thumb (drawn in CSS px)
function drawJoystick(jR) {
  const bx = joy.bx / DPR, by = joy.by / DPR, kx = joy.kx / DPR, ky = joy.ky / DPR;
  const knobR = jR * 0.46, live = joy.active;
  // base well
  const g = cx.createRadialGradient(bx, by, jR * 0.2, bx, by, jR);
  g.addColorStop(0, 'rgba(8,10,18,0.16)'); g.addColorStop(1, 'rgba(8,10,18,0.40)');
  cx.fillStyle = g; cx.beginPath(); cx.arc(bx, by, jR, 0, 7); cx.fill();
  cx.strokeStyle = live ? 'rgba(224,184,106,0.55)' : 'rgba(224,184,106,0.28)'; cx.lineWidth = 1.5;
  cx.beginPath(); cx.arc(bx, by, jR, 0, 7); cx.stroke();
  // four directional ticks, lit on the side the stick is pushed toward
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const pushed = live && ((i === 0 && touchState.right) || (i === 1 && touchState.down) ||
      (i === 2 && touchState.left) || (i === 3 && touchState.up));
    cx.fillStyle = pushed ? 'rgba(224,184,106,0.9)' : 'rgba(243,236,210,0.32)';
    const tx = bx + dx * (jR - 8), ty = by + dy * (jR - 8);
    cx.save(); cx.translate(tx, ty); cx.rotate(a);
    cx.beginPath(); cx.moveTo(2.6, 0); cx.lineTo(-1.4, -2.8); cx.lineTo(-1.4, 2.8); cx.closePath(); cx.fill();
    cx.restore();
  }
  // knob
  const kg = cx.createRadialGradient(kx, ky - knobR * 0.4, knobR * 0.2, kx, ky, knobR);
  kg.addColorStop(0, live ? 'rgba(238,206,140,0.6)' : 'rgba(224,184,106,0.34)');
  kg.addColorStop(1, live ? 'rgba(176,128,58,0.55)' : 'rgba(120,92,46,0.30)');
  cx.fillStyle = kg; cx.beginPath(); cx.arc(kx, ky, knobR, 0, 7); cx.fill();
  cx.strokeStyle = live ? UI_GOLD : UI_GOLD_DIM; cx.lineWidth = 1.5;
  cx.beginPath(); cx.arc(kx, ky, knobR, 0, 7); cx.stroke();
  cx.fillStyle = 'rgba(255,255,255,0.18)';
  cx.beginPath(); cx.arc(kx, ky - knobR * 0.32, knobR * 0.52, 0, 7); cx.fill();
}

// the primary button reads the air: glide when the canopy is (or can be) open
function jumpIcon() {
  const p = player;
  if (G.gear.glider && !p.grounded && !p.swim && (p.gliding || p.vy > 0.35)) return 'glider';
  return 'jump';
}
// the secondary button mirrors whatever the player can do right here
function actIcon() {
  const e = nearInteract;
  if (!e) return 'look';
  switch (e.t) {
    case 'npc': case 'cow': case 'dog': return 'chat';
    case 'gear': case 'page': case 'chestnut': case 'tin': return 'hand';
    case 'photo': return 'camera';
    case 'fire': return 'fire';
    case 'tent': return 'tent';
    case 'bench': return 'rest';
    case 'book': return 'book';
    default: return 'look';
  }
}

function drawDialog(W, H) {
  const cur = D.queue[D.line];
  if (!cur) return;
  const journal = D.style === 'journal';
  const pk = journal ? null : portraitKey(cur[0]);
  const bh = 96;
  let bw = Math.min(W - 28, 680);
  let bcx = W / 2, by = H - bh - (isTouch ? 96 : 18);
  if (isTouch) {
    // on touch the box shares the bottom strip with the joystick and action
    // buttons; when there is room between them, tuck it in there instead of
    // floating it above the controls
    const { left, right } = touchCtrls(W, H);
    if (right - left >= 290) {
      bw = Math.min(680, right - left);
      bcx = (left + right) / 2;
      by = H - bh - 16;
    }
  }
  const bx = bcx - bw / 2;
  if (journal) {
    cx.fillStyle = 'rgba(238,228,198,0.96)'; roundRect(bx, by, bw, bh, 10); cx.fill();
    cx.strokeStyle = 'rgba(122,90,57,0.5)'; cx.lineWidth = 1; cx.stroke();
    // faded ruling, like an old notebook
    cx.strokeStyle = 'rgba(122,90,57,0.12)';
    for (let ly = by + 24; ly < by + bh - 10; ly += 17) { cx.beginPath(); cx.moveTo(bx + 12, ly); cx.lineTo(bx + bw - 12, ly); cx.stroke(); }
  } else {
    panel(bx, by, bw, bh, 9);
  }
  let tx = bx + 18, ty2 = by + 23;
  if (pk) {
    const ps = bh - 22, px0 = bx + 11, py0 = by + 11;
    cx.fillStyle = '#10141f'; roundRect(px0, py0, ps, ps, 5); cx.fill();
    drawPortrait(pk, px0 + ps / 2, py0 + ps / 2, ps - 4);
    cx.strokeStyle = UI_GOLD_DIM; cx.lineWidth = 1; roundRect(px0 + 0.5, py0 + 0.5, ps - 1, ps - 1, 5); cx.stroke();
    tx = px0 + ps + 14;
  }
  if (cur[0]) {
    setTracking(1.5);
    cx.fillStyle = journal ? '#7a5a39' : UI_GOLD; cx.font = 'bold 14px Georgia, serif'; cx.textAlign = 'left';
    cx.fillText(cur[0].toUpperCase(), tx, ty2); ty2 += 20;
    setTracking(0);
  }
  cx.fillStyle = journal ? '#4a3c28' : UI_CREAM;
  cx.font = journal ? 'italic 13px Georgia, serif' : '13.5px Georgia, serif';
  cx.textAlign = 'left';
  wrapText(cur[1].slice(0, Math.floor(D.chars)), tx, ty2, bx + bw - 24 - tx, 17);
  // once the line has finished typing: bobbing arrow + continue prompt
  if (D.chars >= cur[1].length) {
    const dim = journal ? 'rgba(90,74,53,0.75)' : 'rgba(243,236,210,0.7)';
    cx.fillStyle = journal ? '#7a5a39' : UI_GOLD; cx.font = '11px Georgia, serif'; cx.textAlign = 'center';
    cx.fillText('▼', bx + bw / 2, by + bh - 9 + Math.sin(frame * 0.12) * 1.5);
    setTracking(1);
    cx.font = '10.5px Georgia, serif'; cx.textAlign = 'right';
    const label = TX.dlg_next.toUpperCase();
    cx.fillStyle = dim;
    cx.fillText(label, bx + bw - 16, by + bh - 13);
    if (!isTouch) {
      const kx = bx + bw - 16 - cx.measureText(label).width - 22;
      cx.strokeStyle = journal ? 'rgba(122,90,57,0.6)' : UI_GOLD_DIM; cx.lineWidth = 1;
      roundRect(kx, by + bh - 20.5, 15, 15, 3); cx.stroke();
      cx.textAlign = 'center'; cx.font = 'bold 9.5px Georgia, serif';
      cx.fillText('E', kx + 7.5, by + bh - 12.5);
    }
    setTracking(0);
  }
}
function wrapText(text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    if (cx.measureText(line + w).width > maxW && line) { cx.fillText(line, x, y); line = w + ' '; y += lh; }
    else line += w + ' ';
  }
  cx.fillText(line, x, y);
}

// ------------------------------------------------------------- map screen --
function drawMap() {
  cx.save();
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const W = cv.width / DPR, H = cv.height / DPR;
  cx.fillStyle = 'rgba(10,12,24,0.85)'; cx.fillRect(0, 0, W, H);
  cx.textBaseline = 'middle';

  // paper fills the screen sensibly on any orientation
  const pw = Math.min(W - 24, 700), ph = Math.min(H - 48, 480);
  const mx = (W - pw) / 2, my = (H - ph) / 2;
  cx.fillStyle = '#ece3c8'; roundRect(mx, my, pw, ph, 10); cx.fill();
  cx.strokeStyle = '#b9ac82'; cx.lineWidth = 2; cx.stroke();
  cx.fillStyle = '#5a4a35'; cx.textAlign = 'center';
  cx.font = `bold ${Math.max(12, Math.min(16, pw * 0.032))}px Georgia, serif`;
  cx.fillText(TX.map_title, mx + pw / 2, my + 20);

  // view crops to the explored world, so the map fills in as you wander
  let b = null;
  for (const z of ZONES) {
    if (!G.visited[z.id]) continue;
    if (!b) b = { x0: z.x, y0: z.y, x1: z.x + z.w, y1: z.y + z.h };
    else {
      b.x0 = Math.min(b.x0, z.x); b.y0 = Math.min(b.y0, z.y);
      b.x1 = Math.max(b.x1, z.x + z.w); b.y1 = Math.max(b.y1, z.y + z.h);
    }
  }
  if (!b) b = { x0: 30, y0: 40, x1: 100, y1: 80 };
  b.x0 -= 4; b.y0 -= 4; b.x1 += 4; b.y1 += 4;
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const areaY = my + 34, areaH = ph - 110;
  const sc = Math.min((pw - 36) / bw, areaH / bh, 4.5);
  const ox = mx + (pw - bw * sc) / 2 - b.x0 * sc;
  const oy = areaY + (areaH - bh * sc) / 2 - b.y0 * sc;

  for (const z of ZONES) {
    if (!G.visited[z.id]) continue;
    const zx = ox + z.x * sc, zy = oy + z.y * sc, zw = z.w * sc, zh = z.h * sc;
    cx.fillStyle = z.dark ? 'rgba(90,74,53,0.45)' : 'rgba(111,174,87,0.32)';
    roundRect(zx, zy, zw, zh, 4); cx.fill();
    cx.strokeStyle = 'rgba(90,74,53,0.55)'; cx.lineWidth = 1; cx.stroke();
    // label only where it actually fits — one line, or two, or not at all
    const name = LANG === 'en' ? z.en : z.de;
    let lcx = zx + zw / 2, lcy = zy + zh / 2;
    if (z.id === 'grat') lcx = ox + (z.x + 26) * sc;   // clear of the nested summit
    if (z.id === 'gipfel') lcy = zy + zh + 9;          // beneath its little box
    cx.fillStyle = '#5a4a35'; cx.font = '10px Georgia, serif';
    if (cx.measureText(name).width <= zw - 8 || z.id === 'gipfel') cx.fillText(name, lcx, lcy);
    else if (zh > 30) {
      const words = name.split(' ');
      const half = Math.ceil(words.length / 2);
      const l1 = words.slice(0, half).join(' '), l2 = words.slice(half).join(' ');
      if (words.length > 1 && cx.measureText(l1).width <= zw - 6 && cx.measureText(l2).width <= zw - 6) {
        cx.fillText(l1, lcx, lcy - 6);
        cx.fillText(l2, lcx, lcy + 6);
      }
    }
  }
  // landmarks at a fixed, modest size
  for (const id in FIRES) {
    const f = FIRES[id];
    const fz = ZONES.find(z => f.x >= z.x && f.x < z.x + z.w && f.r - 1 >= z.y && f.r - 1 < z.y + z.h);
    if (fz && G.visited[fz.id]) drawIcon('fire', ox + f.x * sc, oy + (f.r - 1) * sc, 11);
  }
  if (G.visited.schlucht) drawIcon('drop', ox + 26 * sc, oy + 52 * sc, 11);
  if (G.visited.ferrata) drawIcon('cable', ox + 95 * sc, oy + 20 * sc, 11);
  if (G.visited.gipfel) drawIcon('cross', ox + 161 * sc, oy + 9 * sc, 11);
  // player
  cx.fillStyle = '#c0392b';
  cx.beginPath(); cx.arc(ox + (player.x / TILE) * sc, oy + (player.y / TILE) * sc, 4 + Math.sin(frame * 0.15), 0, 7); cx.fill();

  // footer: where you are, current goal, the tally
  cx.fillStyle = '#5a4a35'; cx.textAlign = 'center';
  cx.font = 'italic 12px Georgia, serif';
  const here = curZone ? (LANG === 'en' ? curZone.en : curZone.de) : '';
  cx.fillText(`${TX.map_here} ${here}`, mx + pw / 2, my + ph - 56);
  let of2 = 12;
  cx.font = `${of2}px Georgia, serif`;
  while (cx.measureText(TX.obj_prefix + G.objective).width > pw - 28 && of2 > 8) { of2--; cx.font = `${of2}px Georgia, serif`; }
  cx.fillText(TX.obj_prefix + G.objective, mx + pw / 2, my + ph - 38);
  const stats = [['book', `${Object.keys(G.pages).length}/7`]];
  if (G.flags.finale) stats.push(['camera', `${Object.keys(G.photos).length}/5`]);
  stats.push(['marmot', `${Object.keys(G.marmots).length}/5`]);
  if (!G.chestnutsDone) stats.push(['chestnut', `${G.chestnuts}/3`]);
  if (G.gear.glider) stats.push(['ring', `${Object.keys(G.rings).length}/5`]);
  drawIconStats(stats, mx + pw / 2, my + ph - 18);

  cx.fillStyle = 'rgba(243,236,210,0.7)'; cx.font = '11px sans-serif';
  cx.fillText(TX.map_close, W / 2, Math.min(H - 10, my + ph + 14));

  BTNS = [];
  addBtn('map', W - 49, 60, 20, 'i:x');
  drawBtn(BTNS[0]);
  if (fsSupported) { addBtn('fs', W - 49, 106, 20, isFullscreen() ? 'i:shrink' : 'i:expand'); drawBtn(BTNS[1]); }
  if (G.flags.finale && Object.keys(G.photos).length) {
    cx.textBaseline = 'middle';
    panel(mx + pw - 100, my + 32, 90, 24, 8, true);
    drawIcon('camera', mx + pw - 86, my + 44, 13);
    cx.fillStyle = UI_CREAM; cx.font = '12px Georgia, serif'; cx.textAlign = 'center';
    cx.fillText(TX.album_btn, mx + pw - 48, my + 44);
    BTNS.push({ id: 'album', x: (mx + pw - 55) * DPR, y: (my + 44) * DPR, w: 100 * DPR, h: 32 * DPR, lr: 0 });
  }
  cx.restore();
  if (pendUI === 'album') { G.mode = 'album'; }
  pendUI = null;
}

// ------------------------------------------------------------ photo mode --
function drawPhoto() {
  cx.save();
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const W = cv.width / DPR, H = cv.height / DPR;
  G.photoT = (G.photoT || 0) + 1;
  const a = Math.min(1, G.photoT / 25);
  cx.fillStyle = `rgba(10,12,24,${0.78 * a})`; cx.fillRect(0, 0, W, H);
  cx.globalAlpha = a;

  const pw = Math.min(280, W - 60), ph = pw * 1.18;
  cx.translate(W / 2, H / 2 - 10);
  cx.rotate(-0.03 + Math.sin(G.photoT * 0.01) * 0.005);
  // polaroid frame
  cx.fillStyle = '#f4efe2';
  cx.shadowColor = 'rgba(0,0,0,0.5)'; cx.shadowBlur = 18;
  cx.fillRect(-pw / 2, -ph / 2, pw, ph);
  cx.shadowBlur = 0;
  // sepia picture
  const ix = -pw / 2 + 14, iy = -ph / 2 + 14, iw = pw - 28, ih = ph - 74;
  cx.fillStyle = '#c9b28a'; cx.fillRect(ix, iy, iw, ih);
  const gr2 = cx.createLinearGradient(0, iy, 0, iy + ih);
  gr2.addColorStop(0, 'rgba(255,250,230,0.35)'); gr2.addColorStop(1, 'rgba(90,70,40,0.45)');
  cx.fillStyle = gr2; cx.fillRect(ix, iy, iw, ih);
  drawPhotoScene(G.photoN, ix, iy, iw, ih);
  // vignette
  cx.strokeStyle = 'rgba(90,70,40,0.4)'; cx.lineWidth = 6; cx.strokeRect(ix + 3, iy + 3, iw - 6, ih - 6);
  // caption
  cx.fillStyle = '#5a4a35'; cx.font = `italic ${Math.max(11, pw * 0.048)}px Georgia, serif`; cx.textAlign = 'center';
  const t = TX.photos[G.photoN];
  cx.fillText(t.title, 0, ph / 2 - 36);
  cx.font = `${Math.max(9, pw * 0.038)}px Georgia, serif`; cx.fillStyle = 'rgba(90,74,53,0.7)';
  cx.fillText('Juli 1974', 0, ph / 2 - 18);
  cx.restore();

  cx.save(); cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G.photoT > 40 && Math.sin(frame * 0.08) > -0.3) {
    cx.fillStyle = 'rgba(243,236,210,0.8)'; cx.font = '12px sans-serif'; cx.textAlign = 'center';
    cx.fillText(TX.photo_close, W / 2, H - 28);
  }
  cx.restore();

  // in album view, the handwriting on the back shows right away
  if (G.fromAlbum) {
    cx.save(); cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx.fillStyle = 'rgba(238,228,198,0.9)'; cx.font = 'italic 12px Georgia, serif'; cx.textAlign = 'center';
    wrapTextCentered(TX.photos[G.photoN].back, W / 2, H - 64, Math.min(W - 60, 460), 16);
    cx.restore();
  }

  if (G.photoT > 30 && (anyInputEdge || actEdge || jumpEdge)) {
    anyInputEdge = false;
    const n = G.photoN;
    if (G.fromAlbum) { G.fromAlbum = false; G.mode = 'album'; }
    else { G.mode = 'play'; say([TX.photos[n].back], () => save()); }
  }
}
function wrapTextCentered(text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    if (cx.measureText(line + w).width > maxW && line) { lines.push(line); line = w + ' '; }
    else line += w + ' ';
  }
  lines.push(line);
  for (const l of lines) { cx.fillText(l.trim(), x, y); y += lh; }
}

// ------------------------------------------------------------ album mode --
function drawAlbum() {
  cx.save();
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const W = cv.width / DPR, H = cv.height / DPR;
  cx.fillStyle = 'rgba(10,12,24,0.88)'; cx.fillRect(0, 0, W, H);
  cx.fillStyle = '#f3ecd2'; cx.font = 'bold 18px Georgia, serif'; cx.textAlign = 'center';
  cx.fillText(TX.album_title, W / 2, 36);

  BTNS = [];
  const tw = Math.min(96, (W - 60) / 3.4), th = tw * 1.18;
  const cols = W > 560 ? 5 : 3;
  const rows = Math.ceil(5 / cols);
  const gridW = cols * (tw + 14) - 14;
  const x0 = (W - gridW) / 2, y0 = Math.max(56, (H - rows * (th + 16)) / 2);
  cx.textBaseline = 'middle';
  for (let n = 1; n <= 5; n++) {
    const c = (n - 1) % cols, r = (n - 1 - c) / cols;
    const px2 = x0 + c * (tw + 14), py2 = y0 + r * (th + 16);
    if (G.photos[n]) {
      cx.save(); cx.translate(px2 + tw / 2, py2 + th / 2); cx.rotate((n % 2 ? -1 : 1) * 0.03);
      cx.fillStyle = '#f4efe2';
      cx.shadowColor = 'rgba(0,0,0,0.4)'; cx.shadowBlur = 8;
      cx.fillRect(-tw / 2, -th / 2, tw, th);
      cx.shadowBlur = 0;
      cx.fillStyle = '#c9b28a';
      const ix = -tw / 2 + 6, iy = -th / 2 + 6, iw = tw - 12, ih = th - 30;
      cx.fillRect(ix, iy, iw, ih);
      cx.save(); cx.beginPath(); cx.rect(ix, iy, iw, ih); cx.clip();
      cx.save(); cx.scale(0.42, 0.42); drawPhotoScene(n, ix / 0.42, iy / 0.42, iw / 0.42, ih / 0.42); cx.restore();
      cx.restore();
      cx.fillStyle = '#5a4a35'; cx.font = '9px Georgia, serif';
      cx.fillText('1974 · ' + n, 0, th / 2 - 12);
      cx.restore();
      BTNS.push({ id: 'ph' + n, x: (px2 + tw / 2) * DPR, y: (py2 + th / 2) * DPR, w: tw * DPR, h: th * DPR, lr: 0 });
    } else {
      cx.strokeStyle = 'rgba(243,236,210,0.3)'; cx.lineWidth = 1.5; cx.setLineDash([4, 4]);
      cx.strokeRect(px2, py2, tw, th); cx.setLineDash([]);
      cx.fillStyle = 'rgba(243,236,210,0.4)'; cx.font = '22px Georgia, serif';
      cx.fillText('?', px2 + tw / 2, py2 + th / 2);
    }
  }
  cx.fillStyle = 'rgba(243,236,210,0.6)'; cx.font = '12px sans-serif';
  cx.fillText(TX.album_hint, W / 2, H - 22);
  addBtn('albumBack', W - 49, 60, 20, 'i:x');
  drawBtn(BTNS[BTNS.length - 1]);
  cx.restore();

  if (pendUI === 'albumBack' || mapEdge) { G.mode = 'play'; }
  else if (pendUI && pendUI.startsWith('ph')) {
    const n = +pendUI.slice(2);
    if (G.photos[n]) { G.mode = 'photo'; G.photoN = n; G.photoT = 0; G.fromAlbum = true; }
  }
  pendUI = null;
}
function drawPhotoScene(n, ix, iy, iw, ih) {
  // tiny sepia dioramas, drawn like memories
  const cxm = ix + iw / 2, cym = iy + ih / 2;
  const dark = '#6b5638', mid = '#8a7250';
  cx.fillStyle = mid;
  const figure = (fx, fy, s) => {
    cx.fillStyle = dark;
    cx.beginPath(); cx.arc(fx, fy - 14 * s, 4 * s, 0, 7); cx.fill();
    cx.fillRect(fx - 3 * s, fy - 11 * s, 6 * s, 11 * s);
  };
  if (n === 1) {        // tent under larches
    cx.fillStyle = mid;
    cx.beginPath(); cx.moveTo(cxm - 50, cym + 30); cx.lineTo(cxm - 25, cym - 10); cx.lineTo(cxm, cym + 30); cx.closePath(); cx.fill();
    figure(cxm + 20, cym + 30, 1.1); figure(cxm + 36, cym + 30, 1.05);
    cx.strokeStyle = dark; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(cxm + 55, cym + 30); cx.lineTo(cxm + 55, cym - 35); cx.stroke();
    for (let i = 0; i < 4; i++) { cx.beginPath(); cx.moveTo(cxm + 55 - 10 + i, cym - 12 - i * 6); cx.lineTo(cxm + 55 + 10 - i, cym - 12 - i * 6); cx.stroke(); }
  } else if (n === 2) { // Ida at the pond
    cx.fillStyle = 'rgba(120,110,80,0.6)';
    cx.beginPath(); cx.ellipse(cxm, cym + 26, 52, 10, 0, 0, 7); cx.fill();
    figure(cxm - 18, cym + 20, 1.15);
    cx.fillStyle = 'rgba(120,110,80,0.5)';
    cx.beginPath(); cx.ellipse(cxm - 18, cym + 27, 9, 2.5, 0, 0, 7); cx.fill(); // reflection
  } else if (n === 3) { // Toni at the hut
    cx.fillStyle = mid; cx.fillRect(cxm - 45, cym - 12, 56, 42);
    cx.fillStyle = dark;
    cx.beginPath(); cx.moveTo(cxm - 50, cym - 10); cx.lineTo(cxm - 17, cym - 30); cx.lineTo(cxm + 16, cym - 10); cx.closePath(); cx.fill();
    figure(cxm + 28, cym + 30, 1.15);
    cx.fillStyle = dark; cx.fillRect(cxm + 23, cym + 12, 10, 2.5); // the hat
  } else if (n === 4) { // candle in the dark
    cx.fillStyle = 'rgba(40,30,18,0.75)'; cx.fillRect(ix + 4, iy + 4, iw - 8, ih - 8);
    cx.fillStyle = '#e8d49a';
    cx.beginPath(); cx.arc(cxm, cym + 4, 16, 0, 7); cx.globalAlpha = 0.3; cx.fill(); cx.globalAlpha = 1;
    cx.fillRect(cxm - 1.5, cym + 2, 3, 12);
    cx.beginPath(); cx.ellipse(cxm, cym - 2, 2, 4.5, 0, 0, 7); cx.fill();
  } else {              // three pale peaks
    cx.fillStyle = dark;
    cx.beginPath(); cx.moveTo(ix + 8, cym + 34);
    cx.lineTo(cxm - 38, cym - 22); cx.lineTo(cxm - 18, cym + 6);
    cx.lineTo(cxm + 2, cym - 30); cx.lineTo(cxm + 22, cym + 4);
    cx.lineTo(cxm + 44, cym - 18); cx.lineTo(ix + iw - 8, cym + 34);
    cx.closePath(); cx.fill();
  }
}

// ------------------------------------------------------------ title / end --
// dedicated title backdrop: dusk over the Gamstal — warm light in the saddle,
// layered ridges, a winding trail, flowering meadow, chapel on the east hill
function drawTitleBg(W, H) {
  const hor = H * 0.62, mY = H * 0.74;
  const sky = cx.createLinearGradient(0, 0, 0, hor);
  sky.addColorStop(0, '#3b4765'); sky.addColorStop(0.5, '#76869f');
  sky.addColorStop(0.82, '#d8a87e'); sky.addColorStop(1, '#f0cf9c');
  cx.fillStyle = sky; cx.fillRect(0, 0, W, hor + 2);
  // hazy valley floor receding into the light between far ridges and meadow
  const haze = cx.createLinearGradient(0, hor - 8, 0, mY + 12);
  haze.addColorStop(0, '#e7c79c'); haze.addColorStop(0.5, '#b6a892'); haze.addColorStop(1, '#6f7e5e');
  cx.fillStyle = haze; cx.fillRect(0, hor - 8, W, mY - hor + 20);
  // low sun glowing through the pass
  const glow = cx.createRadialGradient(W * 0.5, hor * 0.99, 6, W * 0.5, hor * 0.99, W * 0.34);
  glow.addColorStop(0, 'rgba(255,236,188,0.95)'); glow.addColorStop(0.5, 'rgba(255,224,168,0.4)'); glow.addColorStop(1, 'rgba(255,224,168,0)');
  cx.fillStyle = glow; cx.fillRect(0, 0, W, mY);
  // a few birds drifting home
  cx.strokeStyle = 'rgba(42,50,74,0.6)'; cx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const bx = W * (0.3 + i * 0.1 + Math.sin(i * 7.3) * 0.04), by = H * (0.14 + Math.sin(i * 3.7) * 0.045), s = 3 + (i % 3);
    cx.beginPath(); cx.moveTo(bx - s, by); cx.quadraticCurveTo(bx - s * 0.3, by - s * 0.9, bx, by);
    cx.quadraticCurveTo(bx + s * 0.3, by - s * 0.9, bx + s, by); cx.stroke();
  }
  // ridge layers, far to near, with a saddle in the middle for the light
  const ridge = (pts, color) => {
    cx.fillStyle = color; cx.beginPath(); cx.moveTo(-4, hor + 4);
    for (const [t, r] of pts) cx.lineTo(t * W, hor - r * H);
    cx.lineTo(W + 4, hor + 4); cx.closePath(); cx.fill();
  };
  ridge([[0, 0.20], [0.1, 0.27], [0.2, 0.16], [0.3, 0.23], [0.42, 0.10], [0.5, 0.13], [0.6, 0.09], [0.72, 0.22], [0.84, 0.14], [0.95, 0.25], [1, 0.18]], '#93a2bd');
  ridge([[0, 0.30], [0.12, 0.38], [0.24, 0.20], [0.34, 0.27], [0.45, 0.07], [0.5, 0.05], [0.56, 0.08], [0.68, 0.25], [0.8, 0.33], [0.92, 0.21], [1, 0.29]], '#647596');
  ridge([[0, 0.16], [0.1, 0.21], [0.22, 0.08], [0.34, 0.02], [0.5, -0.01], [0.66, 0.02], [0.78, 0.09], [0.88, 0.13], [1, 0.10]], '#414f6e');
  // meadow foreground
  const mg = cx.createLinearGradient(0, mY - 20, 0, H);
  mg.addColorStop(0, '#566041'); mg.addColorStop(1, '#2b3422');
  cx.fillStyle = mg;
  cx.beginPath(); cx.moveTo(-4, mY + 10);
  cx.quadraticCurveTo(W * 0.3, mY - 18, W * 0.55, mY - 4);
  cx.quadraticCurveTo(W * 0.8, mY + 8, W + 4, mY - 8);
  cx.lineTo(W + 4, H + 4); cx.lineTo(-4, H + 4); cx.closePath(); cx.fill();
  // the trail, switchbacking up toward the saddle
  cx.strokeStyle = 'rgba(238,222,182,0.7)'; cx.lineCap = 'round';
  cx.lineWidth = 13; cx.beginPath(); cx.moveTo(W * 0.45, H + 8); cx.quadraticCurveTo(W * 0.6, H * 0.92, W * 0.5, H * 0.85); cx.stroke();
  cx.lineWidth = 7; cx.beginPath(); cx.moveTo(W * 0.5, H * 0.85); cx.quadraticCurveTo(W * 0.38, H * 0.79, W * 0.49, H * 0.74); cx.stroke();
  cx.lineWidth = 3.5; cx.strokeStyle = 'rgba(238,222,182,0.55)';
  cx.beginPath(); cx.moveTo(W * 0.49, H * 0.74); cx.quadraticCurveTo(W * 0.56, H * 0.69, W * 0.5, hor + 6); cx.stroke();
  // chapel silhouette on the east shoulder
  const chx = W * 0.84, chy = hor - H * 0.105;
  cx.fillStyle = '#323d59';
  cx.fillRect(chx - 8, chy - 8, 16, 8);
  cx.beginPath(); cx.moveTo(chx - 10, chy - 8); cx.lineTo(chx, chy - 14); cx.lineTo(chx + 10, chy - 8); cx.closePath(); cx.fill();
  cx.fillRect(chx + 4, chy - 20, 6, 12);
  cx.beginPath(); cx.moveTo(chx + 3, chy - 20); cx.lineTo(chx + 7, chy - 27); cx.lineTo(chx + 11, chy - 20); cx.closePath(); cx.fill();
  cx.strokeStyle = '#323d59'; cx.lineWidth = 1.2;
  cx.beginPath(); cx.moveTo(chx + 7, chy - 27); cx.lineTo(chx + 7, chy - 31); cx.moveTo(chx + 5, chy - 29.5); cx.lineTo(chx + 9, chy - 29.5); cx.stroke();
  // larches framing the meadow
  cx.fillStyle = '#222d1d';
  for (const [tx2, ts] of [[0.06, 1], [0.115, 0.7], [0.95, 0.85]]) {
    const x0 = tx2 * W, yb = mY + 14, h2 = H * 0.16 * ts;
    cx.fillRect(x0 - 1.5, yb - h2 * 0.25, 3, h2 * 0.3);
    for (let k = 0; k < 3; k++) {
      const w2 = (16 - k * 4) * ts, yk = yb - h2 * (0.22 + k * 0.26);
      cx.beginPath(); cx.moveTo(x0 - w2, yk); cx.lineTo(x0, yk - h2 * 0.34); cx.lineTo(x0 + w2, yk); cx.closePath(); cx.fill();
    }
  }
  // flowers in the grass
  const fcols = ['#e8e2cc', '#d9577a', '#ffd54f', '#9fc3e0'];
  for (let i = 0; i < 26; i++) {
    const fx = ((i * 0.79 + 0.13) % 1) * W, fy = mY + 18 + ((i * 0.37) % 1) * (H - mY - 26);
    cx.strokeStyle = 'rgba(122,140,96,0.8)'; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(fx, fy + 4); cx.lineTo(fx, fy); cx.stroke();
    cx.fillStyle = fcols[i % 4]; cx.beginPath(); cx.arc(fx, fy - 1, 1.6, 0, 7); cx.fill();
  }
  // resting boot and the summit book, bottom left
  drawIcon('boots', W * 0.1, H * 0.88, Math.min(56, W * 0.12));
  drawIcon('book', W * 0.19, H * 0.93, Math.min(40, W * 0.085));
  // gentle vignette so the title and corner buttons read
  const vg = cx.createLinearGradient(0, 0, 0, H * 0.3);
  vg.addColorStop(0, 'rgba(18,22,38,0.4)'); vg.addColorStop(1, 'rgba(18,22,38,0)');
  cx.fillStyle = vg; cx.fillRect(0, 0, W, H * 0.3);
}

function drawTitle() {
  cx.save();
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const W = cv.width / DPR, H = cv.height / DPR;
  drawTitleBg(W, H);
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.save();
  cx.shadowColor = 'rgba(20,22,36,0.55)'; cx.shadowBlur = 10; cx.shadowOffsetY = 2;
  setTracking(Math.min(6, W * 0.012));
  cx.fillStyle = '#f3ecd2';
  cx.font = `bold ${Math.min(50, W * 0.095)}px Georgia, serif`;
  cx.fillText(TX.title, W / 2, H * 0.27);
  setTracking(0);
  cx.font = `italic ${Math.min(15, W * 0.033)}px Georgia, serif`;
  cx.fillStyle = 'rgba(243,236,210,0.9)';
  cx.fillText(TX.subtitle, W / 2, H * 0.27 + 32);
  cx.restore();
  // thin rules flanking the subtitle
  const sw = Math.min(W * 0.8, cx.measureText(TX.subtitle).width);
  cx.strokeStyle = 'rgba(243,236,210,0.45)'; cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(W / 2 - sw / 2 - 44, H * 0.27 + 32); cx.lineTo(W / 2 - sw / 2 - 14, H * 0.27 + 32);
  cx.moveTo(W / 2 + sw / 2 + 14, H * 0.27 + 32); cx.lineTo(W / 2 + sw / 2 + 44, H * 0.27 + 32);
  cx.stroke();

  // menu: one clear primary action, a quiet secondary, language as a text link
  BTNS = [];
  if (fsSupported) { addBtn('fs', W - 49, 60, 20, isFullscreen() ? 'i:shrink' : 'i:expand'); drawBtn(BTNS[0]); }
  const bw2 = Math.min(270, W * 0.72);
  const prim = (id, label, y) => {
    const x = W / 2 - bw2 / 2;
    const pg = cx.createLinearGradient(0, y - 20, 0, y + 20);
    pg.addColorStop(0, '#f0d9a2'); pg.addColorStop(1, '#d8ae6c');
    cx.fillStyle = pg; roundRect(x, y - 20, bw2, 40, 12); cx.fill();
    cx.strokeStyle = 'rgba(70,50,18,0.5)'; cx.lineWidth = 1; roundRect(x + 0.5, y - 19.5, bw2 - 1, 39, 12); cx.stroke();
    cx.fillStyle = '#2a2210'; cx.font = 'bold 15px Georgia, serif'; cx.fillText(label, W / 2, y + 1);
    BTNS.push({ id, x: (W / 2) * DPR, y: y * DPR, w: bw2 * DPR, h: 44 * DPR, lr: 0 });
  };
  const seco = (id, label, y) => {
    cx.fillStyle = 'rgba(14,17,30,0.62)'; roundRect(W / 2 - bw2 / 2, y - 16, bw2, 32, 10); cx.fill();
    cx.strokeStyle = 'rgba(243,236,210,0.38)'; cx.lineWidth = 1; cx.stroke();
    cx.fillStyle = 'rgba(243,236,210,0.92)'; cx.font = '13.5px Georgia, serif'; cx.fillText(label, W / 2, y + 1);
    BTNS.push({ id, x: (W / 2) * DPR, y: y * DPR, w: bw2 * DPR, h: 36 * DPR, lr: 0 });
  };
  const tert = (id, label, y) => {
    cx.fillStyle = 'rgba(243,236,210,0.7)'; cx.font = '12.5px Georgia, serif'; cx.fillText(label, W / 2, y);
    const lw2 = cx.measureText(label).width;
    cx.strokeStyle = 'rgba(243,236,210,0.3)'; cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(W / 2 - lw2 / 2, y + 8); cx.lineTo(W / 2 + lw2 / 2, y + 8); cx.stroke();
    BTNS.push({ id, x: (W / 2) * DPR, y: y * DPR, w: (lw2 + 44) * DPR, h: 30 * DPR, lr: 0 });
  };
  let rowY = H * 0.52;
  if (hasSave()) {
    prim('cont', TX.title_continue, rowY); rowY += 52;
    seco('new', TX.title_new, rowY); rowY += 42;
  } else {
    prim('start', TX.title_start, rowY); rowY += 52;
  }
  tert('lang', TX.lang_btn, rowY); rowY += 34;
  cx.fillStyle = 'rgba(243,236,210,0.55)'; cx.font = '11.5px Georgia, serif';
  const hy = Math.max(rowY + 12, H - 38);
  cx.fillText(TX.ctl_hint1, W / 2, hy);
  cx.fillText(TX.ctl_hint2, W / 2, hy + 18);
  cx.restore();

  if (pendTitle === 'lang') {
    pendTitle = null;
    setLanguage(LANG === 'en' ? 'de' : 'en');
    return;
  }
  if (pendTitle === 'new') {
    pendTitle = null;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
    return;
  }
  const wantStart = pendTitle === 'cont' || pendTitle === 'start' ||
    (!isTouch && (jumpEdge || actEdge || keys['enter']));
  pendTitle = null;
  if (wantStart) {
    audioUnlock();
    if (hasSave() && loadSave()) {
      G.mode = 'play';
      caption([TX.continue_caption, G.objective], 200);
    } else {
      G.mode = 'play';
      startIntro();
    }
  }
}
let pendTitle = null;

function startIntro() {
  say(TX.intro.map(l => ['', l]), () => {
    setPhase(1);
    G.phase = 1;
    caption([L(PHASES[1].caption), L(PHASES[1].sub)], 240);
    setObjective('start');
  });
}

function drawEnd() {
  G.endT = (G.endT || 0) + 1;
  cx.save();
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const W = cv.width / DPR, H = cv.height / DPR;
  const a = Math.min(1, G.endT / 80);
  cx.fillStyle = `rgba(12,14,28,${0.85 * a})`; cx.fillRect(0, 0, W, H);
  cx.globalAlpha = a;
  cx.textAlign = 'center';
  cx.fillStyle = '#f3ecd2'; cx.font = 'bold 38px Georgia, serif';
  cx.fillText(TX.ending_title, W / 2, H * 0.26);
  cx.font = 'italic 15px Georgia, serif';
  cx.fillText(TX.ending_sub, W / 2, H * 0.26 + 30);

  cx.font = '14px sans-serif';
  const mins = Math.round(G.playMin);
  const lines = [
    TX.st_time(mins),
    TX.st_pages(Object.keys(G.pages).length, Object.keys(G.photos).length),
    TX.st_animals(Object.keys(G.marmots).length, G.gamsSeen),
    TX.st_sprung(G.flags.zinnensprung, G.flags.tinFound),
    TX.st_knoedel(G.knoedel),
    TX.st_flug(G.flags.flugschein, G.gear.glider, Object.keys(G.rings).length),
  ];
  lines.forEach((l, i) => cx.fillText(l, W / 2, H * 0.42 + i * 24));
  cx.fillStyle = '#ffd54f';
  cx.fillText(TX.ending_thanks, W / 2, H * 0.42 + lines.length * 24 + 20);
  if (G.endT > 140 && Math.sin(frame * 0.07) > -0.3) {
    cx.fillStyle = 'rgba(243,236,210,0.8)'; cx.font = '13px sans-serif';
    cx.fillText(TX.ending_freeroam, W / 2, H * 0.42 + lines.length * 24 + 48);
  }
  cx.globalAlpha = 1;
  cx.restore();
  if (G.endT > 150 && (anyInputEdge || jumpEdge || actEdge)) {
    anyInputEdge = false;
    G.mode = 'play';
    setPhase(5);
    G.objKey = 'free';
    G.objective = TX.objectives.free;
    if (!G.flags.photosIntro) {
      G.flags.photosIntro = true;
      say([TX.photos_unlocked]); // the photo hunt begins
      save();
    }
  }
}

// ================================================================== LOOP ==
// The simulation advances on a fixed 60 Hz step, decoupled from the display:
// at 120/144 Hz the game renders every frame but steps at the speed all the
// physics constants (and the test suite's jump arcs) were tuned for.
const STEP = 1000 / 60;
let lastT = 0, acc = 0;

function pollEdges() {
  // edges (event-queued so a fast tap never falls between frames)
  jumpEdge = (inp.jump && !prevJump) || pendJump; prevJump = inp.jump; pendJump = false;
  actEdge = (inp.act && !prevAct) || pendAct; prevAct = inp.act; pendAct = false;
  upEdge = (inp.up && !prevUp) || pendUp; prevUp = inp.up; pendUp = false;
  mapEdge = (inp.map && !prevMap) || pendMap; prevMap = inp.map; pendMap = false;
}

function step() {
  frame++;
  pollEdges();

  if (mapEdge && (G.mode === 'play' || G.mode === 'map')) G.mode = G.mode === 'map' ? 'play' : 'map';

  if (G.mode === 'play') {
    G.playMin += 1 / 3600;
    moversTick();
    physTick();
    findInteract();
    if (actEdge && nearInteract) doInteract(nearInteract);
    marmotTick();
    gamsTick();
    npcTick();
    zoneTick();
    critterTick();
  } else if (G.mode === 'dialog') {
    dialogTick();
  }

  camTick();
  fadeTick();
  updParts();
  for (const t of G.toasts) t.t--;
  G.toasts = G.toasts.filter(t => t.t > 0);
  if (G.shake > 0) G.shake--;
  anyInputEdge = false;
}

function tick(now) {
  // UI screens poll input per display frame — the world is not simulated
  if (G.mode === 'title' || G.mode === 'end' || G.mode === 'photo' || G.mode === 'album') {
    lastT = now; acc = 0;
    frame++;
    pollEdges();
    render();
    if (G.mode === 'end') drawEnd();
    else if (G.mode === 'photo') drawPhoto();
    else if (G.mode === 'album') drawAlbum();
    if (G.mode !== 'title') anyInputEdge = false;
    requestAnimationFrame(tick);
    return;
  }

  if (!Number.isFinite(now)) now = lastT + STEP;
  acc += Math.max(0, Math.min(now - (lastT || now), 100)); // clamp away tab-hidden gaps and clock jumps
  lastT = now;
  let n = 0;
  while (acc >= STEP && n < 4) { step(); acc -= STEP; n++; }
  if (acc >= STEP) acc %= STEP; // can't keep up — drop the backlog

  render();
  requestAnimationFrame(tick);
}

function render() {
  cx.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);
  cx.imageSmoothingEnabled = false;
  const pc = phaseColors();

  if (G.mode === 'title') { drawTitle(); drawHUDFrame(); return; }

  const shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  const shy = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  cx.save();
  cx.translate(shx, shy);

  drawSky(pc);
  drawBgRock();
  for (const t of TREES) drawTree(t[0], t[1], t[2], t[3]);
  for (const f of FLOWERS) drawFlower(f[0], f[1], f[2]);
  drawTiles();
  drawMovers();
  drawThermals();
  for (const e of ENTITIES) drawEntity(e);
  drawRings();
  drawGams();
  drawCritters();
  drawPlayer();
  drawWaterfall();
  drawLightShafts(pc);
  rainTick(pc);
  drawRain(pc);
  drawParts();
  drawLighting(pc);
  cx.restore();
  ambientTick(pc);
  musicTick();

  drawVignette();
  if (G.mode === 'map') drawMap();
  else drawHUD();

  drawHUDFrame();
}

// soft darkened corners, cached per canvas size
const vigCv = document.createElement('canvas');
let vigKey = '';
function drawVignette() {
  const key = cv.width + 'x' + cv.height;
  if (vigKey !== key) {
    vigKey = key;
    vigCv.width = 240; vigCv.height = Math.max(1, Math.round(240 * cv.height / cv.width));
    const vx = vigCv.getContext('2d');
    const g = vx.createRadialGradient(
      vigCv.width / 2, vigCv.height / 2, Math.min(vigCv.width, vigCv.height) * 0.42,
      vigCv.width / 2, vigCv.height / 2, Math.max(vigCv.width, vigCv.height) * 0.72);
    g.addColorStop(0, 'rgba(8,10,20,0)'); g.addColorStop(1, 'rgba(8,10,20,0.32)');
    vx.fillStyle = g; vx.fillRect(0, 0, vigCv.width, vigCv.height);
  }
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.imageSmoothingEnabled = true;
  cx.drawImage(vigCv, 0, 0, cv.width, cv.height);
  cx.imageSmoothingEnabled = false;
}

function drawHUDFrame() {
  // fade overlay
  if (G.fadeT > 0) {
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx.fillStyle = `rgba(8,10,20,${G.fadeT})`;
    cx.fillRect(0, 0, cv.width / DPR, cv.height / DPR);
  }
}

requestAnimationFrame(tick);
