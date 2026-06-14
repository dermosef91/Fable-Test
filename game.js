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
const SOLID = t => t === 1 || t === 2 || t === 7;

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
const inSink = (px, py) => SINK.some(s =>
  px >= s.x * TILE && px < (s.x + s.w) * TILE && py >= s.y * TILE && py < (s.y + s.h) * TILE);
// the Hinteres Tal breeze: a gentle, steady easterly the windsocks show and a
// glider drifts on (ride it out to the far rings, work a little to come back)
let valleyWind = 0.7;

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
  stumbleY: 0, sliding: 0, stunT: 0, glissT: 0, screeCoyote: 0,
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
let mpos = { x: -1000, y: -1000 };
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
cv.addEventListener('mousemove', e => {
  if (isTouch) return;
  const rect = cv.getBoundingClientRect();
  mpos.x = (e.clientX - rect.left) * (cv.width / rect.width);
  mpos.y = (e.clientY - rect.top) * (cv.height / rect.height);
});
cv.addEventListener('mouseleave', () => {
  mpos = { x: -1000, y: -1000 };
});

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
    else if (pc.rain > 0.05 && !(z && z.covered)) { gain = 0.05 * pc.rain; freq = 2600; } // rain hiss
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
  else if (curPC.night > 0.5 && z && z.outdoor) {
    for (let i = 0; i < 3; i++) setTimeout(() => blip(4300, 0.04, 'sine', 0.02), i * 90); // crickets
  } else if (curPC.night < 0.5 && z && (z.id === 'wald' || z.id === 'camp' || z.id === 'galerie')) {
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
  crack: () => { noiseBurst(0.12, 0.05, 600); blip(180, 0.15, 'square', 0.03, -60); },
  rumble: () => { noiseBurst(0.35, 0.08); blip(90, 0.3, 'sawtooth', 0.04, -30); },
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

// ------------------------------------------------------------ crumbling --
// brüchiger Fels: one-way shale slabs that crack after the first landing,
// drop away, and regrow. Collision rides the same one-way landing loop as
// the hoists (see physTick); fuse/regen state lives on the CRUMBLE entries.
const CRUMBLE_FUSE = 90, CRUMBLE_REGROW = 240;
for (const c of CRUMBLE) { c.fuse = -1; c.regen = 0; }

function crumbleTick() {
  for (const c of CRUMBLE) {
    if (c.regen > 0) {
      if (--c.regen === 0) {
        c.fuse = -1; // the mountain settles new shale into the gap
        for (let i = 0; i < 6; i++) spawnPart({
          x: (c.x + Math.random() * c.w) * TILE, y: c.y * TILE + 3,
          vx: (Math.random() - 0.5) * 0.6, vy: -0.4, g: 0.03, t: 22, c: '#b5ada0', s: 1.5,
        });
      }
      continue;
    }
    if (c.fuse < 0) continue;
    c.fuse--;
    // grit trickles off the underside while the fuse burns
    if (c.fuse % 5 === 0) spawnPart({
      x: (c.x + Math.random() * c.w) * TILE, y: c.y * TILE + 5,
      vx: (Math.random() - 0.5) * 0.5, vy: 0.6, g: 0.06, t: 20, c: '#9b9486', s: 1.5,
    });
    if (c.fuse === 30) sfx.crack();
    if (c.fuse <= 0) { // it lets go
      c.regen = CRUMBLE_REGROW;
      sfx.rumble(); vib(35); G.shake = Math.max(G.shake, 3);
      for (let i = 0; i < 12; i++) spawnPart({
        x: (c.x + Math.random() * c.w) * TILE, y: c.y * TILE + Math.random() * 5,
        vx: (Math.random() - 0.5) * 1.2, vy: 0.5 + Math.random() * 1.5, g: 0.12, t: 40,
        c: i % 3 ? '#a8a094' : '#7d7668', s: 2 + Math.random() * 2,
      });
    }
  }
}

function drawCrumble() {
  for (const c of CRUMBLE) {
    if (c.regen > 0) continue; // gone — the falling chunks already told the story
    const w = c.w * TILE;
    let x = c.x * TILE - cam.x, y = c.y * TILE - cam.y;
    if (x > VW + 40 || x + w < -40) continue;
    const prog = c.fuse >= 0 ? 1 - c.fuse / CRUMBLE_FUSE : 0;
    if (prog > 0) { x += (Math.random() - 0.5) * 2 * prog; y += (Math.random() - 0.5) * prog; }
    const hashVal = Math.abs(Math.sin(c.x * 12.9898 + c.y * 78.233) * 43758.5453) % 1;
    const h = (s) => (hashVal * 123.456 + s * 23.719) % 1;
    // layered shale slab with a jagged underside
    cx.fillStyle = '#a8a094';
    cx.beginPath();
    cx.moveTo(x, y);
    cx.lineTo(x + w, y);
    cx.lineTo(x + w - 1 - h(1) * 3, y + 5 + h(2) * 3);
    for (let i = 3; i >= 0; i--)
      cx.lineTo(x + 2 + i * (w - 6) / 3, y + 7 + h(i + 3) * 4);
    cx.closePath(); cx.fill();
    cx.strokeStyle = '#7d7668'; cx.lineWidth = 1; cx.stroke();
    // strata line-work and a worn top light
    cx.strokeStyle = 'rgba(90,84,72,0.55)';
    cx.beginPath();
    cx.moveTo(x + 2, y + 3.5); cx.lineTo(x + w - 3, y + 3 + h(8) * 2);
    cx.moveTo(x + 4, y + 6.5); cx.lineTo(x + w - 6, y + 6 + h(9) * 2);
    cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,0.18)'; cx.fillRect(x, y, w, 1.2);
    // cracks spread as the fuse burns
    if (prog > 0) {
      cx.strokeStyle = `rgba(45,40,33,${0.4 + 0.5 * prog})`;
      const n = 1 + Math.floor(prog * 3);
      cx.beginPath();
      for (let i = 0; i < n; i++) {
        const cxx = x + 4 + h(i + 10) * (w - 8);
        cx.moveTo(cxx, y);
        cx.lineTo(cxx + (h(i + 14) - 0.5) * 6, y + 4);
        cx.lineTo(cxx + (h(i + 18) - 0.5) * 9, y + 9);
      }
      cx.stroke();
    }
  }
}

// ------------------------------------------------------------- stonefall --
// Steinschlag: dust and a rattle from above, then a stone bounds down the
// band and shatters on the first solid or plank tile. A hit staggers
// (p.stunT) and costs warmth — a scare, never a respawn.
const stones = [];
function stonefallTick() {
  const p = player;
  for (const s of STONEFALL) {
    s.timer = (s.timer === undefined ? s.period >> 1 : s.timer) - 1;
    if (s.timer <= 0) {
      s.timer = s.period + Math.floor(Math.random() * 120);
      // only cut loose when somebody is on the face to hear it
      const ptx = p.x / TILE, pty = p.y / TILE;
      if (ptx > s.x - 14 && ptx < s.x + s.w + 14 && pty > s.y - 4 && pty < s.floor + 6) {
        stones.push({
          x: (s.x + Math.floor(Math.random() * s.w)) * TILE + TILE / 2,
          y: s.y * TILE, vy: 0, warnT: 55, r: 2.5 + Math.random() * 1.5, spin: Math.random() * 6,
        });
      }
    }
  }
  for (let i = stones.length - 1; i >= 0; i--) {
    const st = stones[i];
    if (st.warnT > 0) { // the telegraph: trickling dust, a dry rattle
      st.warnT--;
      if (st.warnT % 4 === 0) spawnPart({
        x: st.x + (Math.random() - 0.5) * 8, y: st.y,
        vx: (Math.random() - 0.5) * 0.4, vy: 0.7, g: 0.05, t: 22, c: '#b9a98c', s: 1.5,
      });
      if (st.warnT % 18 === 0) noiseBurst(0.06, 0.03, 900);
      continue;
    }
    st.vy = Math.min(st.vy + 0.32, 5.2);
    st.y += st.vy;
    st.spin += 0.35;
    const t = tileAt(Math.floor(st.x / TILE), Math.floor((st.y + st.r) / TILE));
    if (SOLID(t) || t === 3) { shatterStone(st); stones.splice(i, 1); continue; }
    if (p.stunT <= 0 &&
        st.x > p.x - st.r && st.x < p.x + p.w + st.r &&
        st.y + st.r > p.y && st.y - st.r < p.y + p.h) {
      p.warmth -= 8; p.stunT = 25;
      p.vx += (st.x < p.x + p.w / 2 ? 1 : -1) * 1.2;
      G.shake = Math.max(G.shake, 6); vib(50); noiseBurst(0.2, 0.07);
      toast(TX.toast_steinschlag);
      shatterStone(st); stones.splice(i, 1);
    }
  }
}
function shatterStone(st) {
  noiseBurst(0.1, 0.04, 500);
  for (let k = 0; k < 6; k++) spawnPart({
    x: st.x, y: st.y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.5,
    g: 0.1, t: 22, c: k % 2 ? '#8c8577' : '#6e6759', s: 1.5,
  });
}
function drawStones() {
  for (const st of stones) {
    if (st.warnT > 0) continue; // only the dust gives it away
    const x = st.x - cam.x, y = st.y - cam.y;
    if (x < -20 || x > VW + 20) continue;
    cx.save();
    cx.translate(x, y); cx.rotate(st.spin);
    cx.fillStyle = '#7d7668';
    cx.beginPath();
    cx.moveTo(-st.r, -st.r * 0.6); cx.lineTo(st.r * 0.2, -st.r);
    cx.lineTo(st.r, -st.r * 0.1); cx.lineTo(st.r * 0.5, st.r);
    cx.lineTo(-st.r * 0.7, st.r * 0.8);
    cx.closePath(); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,0.2)';
    cx.fillRect(-st.r * 0.5, -st.r * 0.6, st.r, st.r * 0.4);
    cx.restore();
  }
}

// ------------------------------------------------------------- particles --
const parts = [];
function spawnPart(p) { if (parts.length < 380) parts.push(p); }
function updParts() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; p.t--;
    if (p.t <= 0 || (p.bubble && tileAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) !== 4)) {
      parts.splice(i, 1);
    }
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
const GLISS_MAX = 4.6; // top scree-run speed (vs 2.6 walk): a real glissade

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
  if (p.grounded) p.screeCoyote = under.includes(2) ? 8 : 0;
  const onIce = p.grounded && under.includes(7); // Blankeis: glassy, almost no grip
  const onOneway = under.includes(3);

  // a stonefall hit staggers: controls drop out for a moment
  const stunned = p.stunT > 0;
  if (stunned) p.stunT--;

  if (!p.climbing) {
    // scree-run (glissade): with boots, hold DOWN to ride the scree downhill,
    // fast and steerable; LEFT digs in to a self-arrest. The glissT window
    // keeps the momentum across the little hops between the staircase steps.
    // Without boots, DOWN still just slips you helplessly (the gate below).
    const glissActive = onScree && G.gear.boots && inp.down && !stunned;
    if (glissActive) p.glissT = 8; else if (p.glissT > 0) p.glissT--;
    const gliss = (glissActive || p.glissT > 0) && G.gear.boots;

    // horizontal: quick on the ground, floatier in the air, snappy turns
    const mx = p.swim ? 1.4 : gliss ? GLISS_MAX : 2.6;
    let acc = p.swim ? 0.3 : p.grounded ? 0.55 : 0.38;
    const want = (stunned || gliss) ? 0 : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (onIce && p.grounded && !p.swim) {
      // Blankeis: slow to build speed, but you can dig the edges in to brake
      const braking = want !== 0 && Math.sign(p.vx) === -want && Math.abs(p.vx) > 0.2;
      acc = braking ? 0.30 : 0.11;
    }
    if (want !== 0 && p.grounded && !onIce && Math.sign(p.vx) === -want && Math.abs(p.vx) > 1.4) {
      acc = 0.95; // skid (no biting edge on ice)
      if (frame % 3 === 0) spawnPart({ x: p.x + (want > 0 ? 0 : p.w), y: p.y + p.h, vx: -want * 1.2, vy: -0.6, g: 0.07, t: 16, c: '#c9bb9d', s: 2 });
    }
    if (want < 0) { p.vx = Math.max(p.vx - acc, -mx); p.face = -1; }
    if (want > 0) { p.vx = Math.min(p.vx + acc, mx); p.face = 1; }
    if (want === 0 && !gliss) p.vx *= p.grounded ? (onIce ? 0.993 : 0.72) : 0.94; // ice barely slows you

    // scree surface: the boots gate, or — with boots + DOWN — the scree-run
    p.sliding = 0;
    if (gliss) {
      const target = inp.left ? -0.6 : GLISS_MAX; // LEFT digs in: a self-arrest
      p.vx += (target - p.vx) * 0.14;
      if (p.vx > GLISS_MAX) p.vx = GLISS_MAX;
      if (p.vx < -1) p.vx = -1;
      p.sliding = 2;
      p.face = p.vx < -0.05 ? -1 : 1;
      if (p.grounded && Math.abs(p.vx) > 1.2) {
        if (frame % 2 === 0) spawnPart({ x: p.x + (p.vx > 0 ? 0 : p.w), y: p.y + p.h, vx: -p.vx * 0.3 + (Math.random() - 0.5), vy: -0.5 - Math.random(), g: 0.06, t: 26, c: Math.random() < 0.5 ? '#cfc1a5' : '#b9a98c', s: 2 + Math.random() * 1.5 });
        if (frame % 8 === 0) noiseBurst(0.07, 0.02, 700);
      }
      if (!G.flags.glissadeMet && p.vx > 2.8) { G.flags.glissadeMet = true; toast(TX.toast_glissade); }
    } else if (onScree && !G.gear.boots) {
      p.vx = Math.min(p.vx + 0.55, 3.2); // downhill is east
      p.sliding = 1;
      if ((inp.left || jumpEdge) && slipToastCd <= 0) { toast(TX.toast_slip); sfx.slip(); slipToastCd = 160; }
      if (Math.random() < 0.3) spawnPart({ x: p.x + Math.random() * p.w, y: p.y + p.h, vx: 0.5 + Math.random(), vy: -0.5, g: 0.05, t: 25, c: '#b9a98c', s: 2 });
    } else if (onScree && G.gear.boots && Math.abs(p.vx) > 0.5 && Math.random() < 0.2) {
      spawnPart({ x: p.x + Math.random() * p.w, y: p.y + p.h, vx: -p.vx * 0.2, vy: -0.4, g: 0.04, t: 18, c: '#cfc1a5', s: 1.5 });
    }
    // Blankeis: a one-time warning, and ice crystals kicked up as you skate
    if (onIce) {
      if (!G.flags.iceMet) { G.flags.iceMet = true; toast(TX.toast_ice); }
      if (Math.abs(p.vx) > 0.6 && Math.random() < 0.18)
        spawnPart({ x: p.x + Math.random() * p.w, y: p.y + p.h, vx: -p.vx * 0.15, vy: -0.3, g: 0.03, t: 16, c: 'rgba(224,240,252,0.8)', s: 1.4 });
    }

    // jump (from ground, coyote, or straight out of the water)
    if (jumpEdge && !stunned) p.jbuf = 8;
    if (p.jbuf > 0 && (p.grounded || p.coyote > 0 || p.swim)) {
      if ((p.sliding || p.screeCoyote > 0) && !G.gear.boots && !p.swim) {
        if (slipToastCd <= 0) { toast(TX.toast_slip); sfx.slip(); slipToastCd = 160; }
        p.jbuf = 0;
      } else {
        p.vy = p.swim ? -5.6 : -8.4;
        // jumping off a hoist keeps its drift — the arc matches what you see
        if (p.moverRef) { p.vx += p.moverRef.dx || 0; p.vy += Math.min(0, p.moverRef.dy || 0); }
        p.grounded = false; p.coyote = 0; p.jbuf = 0; p.moverRef = null;
        p.screeCoyote = 0;
        sfx.jump();
      }
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
      const cx2 = p.x + p.w / 2, cy2 = p.y + p.h / 2;
      if (inThermal(cx2, cy2)) {
        p.vy = Math.max(p.vy - 1.45, -1.6); // ride the warm air up
        if (!G.flags.thermalMet) { G.flags.thermalMet = true; toast(TX.toast_thermal); }
      } else if (inSink(cx2, cy2)) {
        p.vy = inp.down ? Math.min(p.vy + 0.5, 3.4) : Math.max(p.vy, 2.2); // cold air drags you down
        if (!G.flags.sinkMet) { G.flags.sinkMet = true; toast(TX.toast_sink); }
        if (Math.random() < 0.3) spawnPart({ x: p.x + Math.random() * p.w, y: p.y, vx: 0, vy: 2 + Math.random(), t: 30, c: 'rgba(200,216,232,0.5)', s: 2 });
      }
      if (!inp.left && !inp.right) p.vx += p.face * 0.06; // forward trim, steering overrides
      p.vx += valleyWind * 0.03; // the steady easterly nudges you along
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
    if (!G.gear.glider && p.x + p.w > 189.6 * TILE && p.y < (14 + Y_OFF) * TILE) {
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
      // ...and the crumble slabs, which start their fuse on first contact
      if (!landed) for (const c of CRUMBLE) {
        if (c.regen > 0) continue;
        const top = c.y * TILE;
        if (p.x + p.w > c.x * TILE && p.x < (c.x + c.w) * TILE &&
            p.y + p.h <= top + 0.01 + p.vy && ny + p.h >= top) {
          p.y = top - p.h; landIfFalling(); p.grounded = true; p.vy = 0; landed = true;
          if (c.fuse < 0) {
            c.fuse = CRUMBLE_FUSE; sfx.crack(); vib(20);
            if (!G.flags.crumbleMet) { G.flags.crumbleMet = true; toast(TX.toast_crumble); }
          }
          break;
        }
      }
      if (!landed) p.y = ny;
    } else p.y = ny;
  }
  if (p.grounded) { p.coyote = 8; fallStartY = p.y; }
  else {
    if (p.coyote > 0) p.coyote--;
    if (p.screeCoyote > 0) p.screeCoyote--;
  }
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
    if (vyEnter > 6 && !G.flags.zinnensprung && zone && zone.id === 'wald' && fallStartY < (20 + Y_OFF) * TILE) {
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
  if (zone && zone.outdoor) p.warmth -= 0.015 * curPC.night;
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
    if (e.gear === 'glider' && !G.flags.finale) continue; // the glider is hidden until the summit/finale
    const d = Math.hypot(e.x * TILE + 8 - px, e.r * TILE - 14 - py);
    if (d < best) { best = d; nearInteract = e; }
  }
}

function doInteract(e) {
  if (e.x !== undefined && e.face !== undefined) {
    const px = player.x + player.w / 2;
    e.face = px < e.x * TILE + 8 ? -1 : 1;
  }
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
      say(TX[e.key]);
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
      if (G.chestnuts >= 3) {
        G.chestnutsDone = true;
        say(t.first, () => {
          say(t.complete, () => {
            G.knoedel = true; player.maxWarmth = 130; player.warmth = 130;
            toast(TX.toast_knoedel); sfx.pick();
            say(TX.get_jacket, () => {
              G.gear.jacket = true; setPhase(2); setObjective('jacket'); save();
            });
          });
        });
      } else {
        say(t.first, () => setObjective('chestnut'));
      }
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
function drawSink() {
  if (!SINK.length || cam.x + VW < SINK[0].x * TILE) return;
  cx.save();
  for (const s of SINK) {
    const x = s.x * TILE - cam.x, w = s.w * TILE;
    if (x > VW || x + w < 0) continue;
    const y0 = s.y * TILE - cam.y, y1 = (s.y + s.h) * TILE - cam.y;
    cx.strokeStyle = 'rgba(150,170,195,0.16)'; cx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const px2 = x + w * (0.25 + i * 0.25);
      cx.beginPath();
      for (let yy = Math.max(0, y0); yy < Math.min(VH, y1); yy += 8) {
        const sway = Math.sin(yy * 0.06 - frame * 0.06 + i * 2) * 4;
        if (yy === Math.max(0, y0)) cx.moveTo(px2 + sway, yy); else cx.lineTo(px2 + sway, yy);
      }
      cx.stroke();
    }
    // falling motes telegraph the downdraft
    if (Math.random() < 0.25) spawnPart({ x: s.x * TILE + Math.random() * w, y: Math.max(s.y * TILE, cam.y), vx: 0, vy: 1.4 + Math.random(), t: 50, c: 'rgba(190,206,224,0.45)', s: 2 });
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

  // Track prevX for all NPCs and animals so we can calculate velocity and animate legs
  const npcsToTrack = [NPCS.greta, NPCS.norbert, NPCS.vera, NPCS.cow, NPCS.dog].filter(Boolean);
  for (const e of npcsToTrack) {
    e.prevX = e.x;
  }

  // Wander helper function
  function updateWander(e, baseX, rangeTiles = 3, moveSpeed = 0.02, idleMin = 200, idleMax = 500) {
    if (!e.wander) {
      e.wander = {
        state: 'idle',
        timer: 100 + Math.random() * 200,
        offset: 0,
        targetOffset: 0
      };
    }
    const w = e.wander;
    if (w.state === 'idle') {
      w.timer--;
      // occasionally look around
      if (Math.random() < 0.005) {
        e.face = Math.random() < 0.5 ? 1 : -1;
      }
      if (w.timer <= 0) {
        w.targetOffset = (Math.random() - 0.5) * 2 * rangeTiles;
        w.state = 'walk';
      }
    } else if (w.state === 'walk') {
      const diff = w.targetOffset - w.offset;
      if (Math.abs(diff) < moveSpeed) {
        w.offset = w.targetOffset;
        w.state = 'idle';
        w.timer = idleMin + Math.random() * (idleMax - idleMin);
      } else {
        w.offset += Math.sign(diff) * moveSpeed;
        e.face = diff > 0 ? 1 : -1;
      }
    }
    e.x = baseX + w.offset;
  }

  // Greta: mornings by the fire, gone at night, strolls with Strolch after the storm
  const g = NPCS.greta;
  if (ph >= 4) {
    g.x = 76 + Math.sin(frame * 0.004) * 11;
    if (g.prevX !== undefined) {
      const dx = g.x - g.prevX;
      if (Math.abs(dx) > 0.0001) g.face = dx > 0 ? 1 : -1;
    }
  } else {
    const gretaBaseX = ph === 3 ? 53 : 54;
    updateWander(g, gretaBaseX, 1.5, 0.02, 180, 450);
  }

  // Strolch (dog) trails Greta when she walks, wanders/sniffs when she is idle
  const dog = NPCS.dog;
  if (dog && dog.present !== false) {
    if (ph >= 4) {
      const dogNewX = g.x + 2.5 + Math.sin(frame * 0.013) * 1.2;
      if (dog.prevX !== undefined) {
        const dx = dogNewX - dog.prevX;
        if (Math.abs(dx) > 0.0001) dog.face = dx > 0 ? 1 : -1;
      }
      dog.x = dogNewX;
    } else {
      const dogBaseX = g.x + (g.face === 1 ? -2.5 : 2.5);
      updateWander(dog, dogBaseX, 2.0, 0.04, 80, 240);
    }
  }

  // Norbert: in the hut at night (windows lit), chopping wood on Sunday
  const n = NPCS.norbert;
  n.present = ph !== 3;
  if (n.present) {
    const norbertBaseX = ph >= 5 ? 59 : ph === 4 ? 73 : 70;
    updateWander(n, norbertBaseX, 1.5, 0.018, 200, 500);
  }

  // the cow drifts, unbothered
  const cow = NPCS.cow;
  if (cow) {
    updateWander(cow, 52, 4.5, 0.008, 400, 900);
  }

  // Vera: flight school
  const v = NPCS.vera;
  if (v) {
    updateWander(v, 177, 2.0, 0.02, 220, 550);
  }

  // Calculate final velocities (e.vx) for all NPCs to trigger step animations in drawEntity
  for (const e of npcsToTrack) {
    if (e.prevX !== undefined) {
      e.vx = e.x - e.prevX;
    }
  }
}

// ---- the Gams: appears near your next objective, bounds away when crowded --
const gams = { x: 0, y: 0, stage: '', fleeT: 0, hidden: false, met: false, restSaid: false };
function gamsSpot() {
  if (G.flags.finale) return { x: 160, r: 9 + Y_OFF, stage: 'rest' };
  if (!G.gear.boots) return player.x < 94 * TILE ? { x: 84, r: 70 + Y_OFF, stage: 'boots1' } : null;
  if (!G.chestnutsDone) return { x: 88, r: 48 + Y_OFF, stage: 'alm' };
  // once you're up at the Stellung, she waits at the base of the observer-post climb
  if (G.gear.jacket && !G.gear.lamp && player.y < (32 + Y_OFF) * TILE && player.x < 32 * TILE)
    return { x: 16, r: 28 + Y_OFF, stage: 'lamp2' };
  return null;
}
function gamsTick() {
  const spot = gamsSpot();
  if (!spot) { gams.stage = 'none'; gams.hidden = true; return; }
  if (spot.stage !== gams.stage) {
    gams.stage = spot.stage; gams.hidden = false; gams.fleeT = 0; gams.met = false;
    gams.x = spot.x * TILE + 8; gams.y = spot.r * TILE;
    gams.face = 1;
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
  // Idle look around occasionally
  if (Math.random() < 0.005) {
    gams.face = Math.random() < 0.5 ? 1 : -1;
  }
  if (d < 200 && !gams.met) { gams.met = true; G.gamsSeen++; sfx.marmot(); }
  if (d < 64) { gams.fleeT = 55; gams.dir = player.x < gams.x ? 1 : -1; }
}
function drawGams() {
  if (gams.hidden || gams.stage === 'none' || !gams.stage) return;
  const x = gams.x - cam.x, y = gams.y - cam.y;
  if (x < -40 || x > VW + 40) return;
  const rest = gams.stage === 'rest';
  groundShadow(x, y, rest ? 12 : 10, 0.18);
  cx.save(); cx.translate(x, y);
  const face = gams.fleeT > 0 ? (gams.dir < 0 ? -1 : 1) : (gams.face || 1);
  cx.scale(face, 1);
  
  // Body fur color (#8a6f50)
  cx.fillStyle = '#8a6f50';
  if (rest) { // lying down
    // body base
    cx.beginPath(); cx.ellipse(0, -4.5, 11.5, 5, 0, 0, 7); cx.fill();
    // chest/neck angle
    cx.beginPath(); cx.moveTo(4, -4.5); cx.lineTo(8, -9); cx.lineTo(10.5, -9); cx.lineTo(7.5, -3); cx.closePath(); cx.fill();
    // head
    cx.beginPath(); cx.arc(9.2, -10.5, 2.6, 0, 7); cx.fill();
    // light colored underbelly patch
    cx.fillStyle = '#c5b59a';
    cx.beginPath(); cx.ellipse(-2, -2.5, 7, 2, 0, 0, 7); cx.fill();
  } else { // standing
    // legs & hooves
    cx.fillStyle = '#3d3327'; // dark legs
    cx.fillRect(-7.5, -7, 2, 7);
    cx.fillRect(3.5, -7, 2, 7);
    cx.fillStyle = '#1c1b18'; // hooves
    cx.fillRect(-8.2, -1.2, 3, 1.2);
    cx.fillRect(2.8, -1.2, 3, 1.2);

    // body
    cx.fillStyle = '#8a6f50';
    cx.beginPath();
    cx.moveTo(-9, -14);
    cx.lineTo(6, -14);
    cx.quadraticCurveTo(6.5, -10, 6, -7);
    cx.lineTo(-9, -7);
    cx.quadraticCurveTo(-9.5, -10, -9, -14);
    cx.closePath(); cx.fill();
    
    // light chest patch
    cx.fillStyle = '#c5b59a';
    cx.beginPath(); cx.moveTo(-4, -13.5); cx.lineTo(3, -13.5); cx.lineTo(1, -7.5); cx.lineTo(-3, -7.5); cx.closePath(); cx.fill();

    // neck
    cx.fillStyle = '#8a6f50';
    cx.beginPath();
    cx.moveTo(4, -13); cx.lineTo(6.5, -19.5); cx.lineTo(9.5, -18.5); cx.lineTo(7, -11);
    cx.closePath(); cx.fill();
    
    // head
    cx.beginPath(); cx.arc(8.2, -20.2, 2.8, 0, 7); cx.fill();
    
    // ears (pointed sideways/back)
    cx.beginPath(); cx.ellipse(6.2, -21.8, 2, 0.8, -0.5, 0, 7); cx.fill();
  }
  
  // the hooked horns (charcoal dark)
  cx.strokeStyle = '#2c2a25'; cx.lineWidth = 1.4;
  const hx = rest ? 9.2 : 8.2, hy = rest ? -12.5 : -22.2;
  // horn 1 (front)
  cx.beginPath(); cx.moveTo(hx - 0.8, hy); cx.quadraticCurveTo(hx - 0.8, hy - 5.5, hx - 3.2, hy - 6.2); cx.stroke();
  // horn 2 (back)
  cx.beginPath(); cx.moveTo(hx + 0.8, hy); cx.quadraticCurveTo(hx + 0.8, hy - 5.5, hx - 1.2, hy - 6.5); cx.stroke();
  
  // eye stripe (signature chamois look)
  cx.strokeStyle = '#1a1916'; cx.lineWidth = 0.8;
  cx.beginPath(); cx.moveTo(hx + 2.4, hy + 1.2); cx.lineTo(hx - 1.2, hy - 1.5); cx.stroke();

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
let phaseLerpT = 1, phasePrev = 1, phaseCur = 1;
let curPC = {
  top: PHASES[1].skyTop,
  bot: PHASES[1].skyBot,
  ambient: PHASES[1].ambient,
  rain: PHASES[1].rain ? 1 : 0,
  sun: PHASES[1].sun,
  night: 0,
  dawn: 0,
  peak0Color: PHASES[1].peak0Color,
  peak0Opacity: PHASES[1].peak0Opacity,
  peak1Color: PHASES[1].peak1Color,
  peak1Opacity: PHASES[1].peak1Opacity,
  hazeColor: PHASES[1].hazeColor,
  hazeOpacity: PHASES[1].hazeOpacity,
  silColor: PHASES[1].silColor,
  silOpacity: PHASES[1].silOpacity,
  roofColor: PHASES[1].roofColor,
  roofOpacity: PHASES[1].roofOpacity,
  cloudColor: PHASES[1].cloudColor,
  cloudOpacity: PHASES[1].cloudOpacity,
  bgRockColor0: PHASES[1].bgRockColor0,
  bgRockColor1: PHASES[1].bgRockColor1,
  fc0Color: PHASES[1].fc0Color,
  fc0Opacity: PHASES[1].fc0Opacity,
  fc1Color: PHASES[1].fc1Color,
  fc1Opacity: PHASES[1].fc1Opacity,
};

function phaseColors() {
  // Edge-detect the phase change so the lerp resets exactly once. (Resetting
  // every frame while phasePrev !== G.phase deadlocks: phaseLerpT can never
  // reach 1, so phasePrev never catches up and transitions freeze — which is
  // what stalled the weather/sky once `rain` started lerping through it.)
  if (phaseCur !== G.phase) { phasePrev = phaseCur; phaseCur = G.phase; phaseLerpT = 0; }
  phaseLerpT = Math.min(1, phaseLerpT + 0.0025); // ~6.6 seconds transition at 60fps
  const a = PHASES[phasePrev] || PHASES[G.phase], b = PHASES[G.phase];
  const out = {
    top: hexLerp(a.skyTop, b.skyTop, phaseLerpT),
    bot: hexLerp(a.skyBot, b.skyBot, phaseLerpT),
    ambient: lerp(a.ambient, b.ambient, phaseLerpT),
    rain: lerp(a.rain ? 1 : 0, b.rain ? 1 : 0, phaseLerpT),
    sun: lerp(a.sun, b.sun, phaseLerpT),
    night: lerp(phasePrev === 3 ? 1 : 0, G.phase === 3 ? 1 : 0, phaseLerpT),
    dawn: lerp(phasePrev === 4 ? 1 : 0, G.phase === 4 ? 1 : 0, phaseLerpT),
    peak0Color: hexLerp(a.peak0Color, b.peak0Color, phaseLerpT),
    peak0Opacity: lerp(a.peak0Opacity, b.peak0Opacity, phaseLerpT),
    peak1Color: hexLerp(a.peak1Color, b.peak1Color, phaseLerpT),
    peak1Opacity: lerp(a.peak1Opacity, b.peak1Opacity, phaseLerpT),
    hazeColor: hexLerp(a.hazeColor, b.hazeColor, phaseLerpT),
    hazeOpacity: lerp(a.hazeOpacity, b.hazeOpacity, phaseLerpT),
    silColor: hexLerp(a.silColor, b.silColor, phaseLerpT),
    silOpacity: lerp(a.silOpacity, b.silOpacity, phaseLerpT),
    roofColor: hexLerp(a.roofColor, b.roofColor, phaseLerpT),
    roofOpacity: lerp(a.roofOpacity, b.roofOpacity, phaseLerpT),
    cloudColor: hexLerp(a.cloudColor, b.cloudColor, phaseLerpT),
    cloudOpacity: lerp(a.cloudOpacity, b.cloudOpacity, phaseLerpT),
    bgRockColor0: hexLerp(a.bgRockColor0, b.bgRockColor0, phaseLerpT),
    bgRockColor1: hexLerp(a.bgRockColor1, b.bgRockColor1, phaseLerpT),
    fc0Color: hexLerp(a.fc0Color, b.fc0Color, phaseLerpT),
    fc0Opacity: lerp(a.fc0Opacity, b.fc0Opacity, phaseLerpT),
    fc1Color: hexLerp(a.fc1Color, b.fc1Color, phaseLerpT),
    fc1Opacity: lerp(a.fc1Opacity, b.fc1Opacity, phaseLerpT),
  };
  if (phaseLerpT >= 1) phasePrev = G.phase;
  curPC = out;
  return out;
}

// Per-phase color grade — one cheap post-process wash that ties the whole
// palette together (warm sky / cool valley by time of day). Art-direct a phase
// from HERE instead of scattering ternaries through every draw function.
const GRADE = [null,
  { top: '#ffe9cc', bot: '#d6e0ee', a: 0.10 }, // 1 morning mist — warm light, cool valley
  { top: '#9aa6b0', bot: '#8893a0', a: 0.18 }, // 2 rain — cool, muted
  { top: '#2f3c66', bot: '#161f3c', a: 0.16 }, // 3 night — deep blue
  { top: '#ffd0ab', bot: '#b6a2c6', a: 0.18 }, // 4 first light — alpenglow pink → mauve
  { top: '#fff6e6', bot: '#edf4f3', a: 0.05 }, // 5 clear morning — near-neutral
];
function gradeNow() {
  const b = GRADE[G.phase]; if (!b) return null;
  const a = GRADE[phasePrev] || b;
  return { top: hexLerp(a.top, b.top, phaseLerpT), bot: hexLerp(a.bot, b.bot, phaseLerpT), a: lerp(a.a, b.a, phaseLerpT) };
}
function drawColorGrade() {
  const g = gradeNow(); if (!g || g.a <= 0.001) return;
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.imageSmoothingEnabled = true;
  cx.globalCompositeOperation = 'multiply';
  cx.globalAlpha = g.a;
  const grad = cx.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, g.top); grad.addColorStop(1, g.bot);
  cx.fillStyle = grad; cx.fillRect(0, 0, cv.width, cv.height);
  cx.globalCompositeOperation = 'source-over';
  cx.globalAlpha = 1;
  cx.imageSmoothingEnabled = false;
}

let frame = 0;

function drawSky(pc) {
  const gr = cx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, pc.top); gr.addColorStop(1, pc.bot);
  cx.fillStyle = gr; cx.fillRect(0, 0, VW, VH);

  // stars at night
  if (pc.night > 0.01) {
    cx.fillStyle = 'rgba(255,255,240,0.8)';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5 + 40) % VW, sy = (i * 89.7) % (VH * 0.7);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.02 + i));
      cx.globalAlpha = tw * 0.8 * pc.night;
      cx.fillRect(sx, sy, 1.5, 1.5);
    }
    cx.globalAlpha = 1;
    // moon
    cx.globalAlpha = pc.night;
    cx.fillStyle = '#f5f1dc'; cx.beginPath(); cx.arc(VW * 0.78, VH * 0.16, 14, 0, 7); cx.fill();
    cx.fillStyle = pc.top; cx.beginPath(); cx.arc(VW * 0.78 - 6, VH * 0.16 - 3, 12, 0, 7); cx.fill();
    cx.globalAlpha = 1;
  } else if (pc.sun >= 0) {
    const sx = VW * (0.25 + pc.sun * 0.5), sy = VH * (0.14 + (1 - Math.sin(pc.sun * Math.PI)) * 0.2);
    const glow = cx.createRadialGradient(sx, sy, 2, sx, sy, 60);
    const warm = G.phase === 4 ? 'rgba(255,150,80,' : 'rgba(255,235,170,';
    const sunOpacity = pc.sun < 0.2 ? pc.sun / 0.2 : 1;
    glow.addColorStop(0, warm + (0.95 * sunOpacity) + ')');
    glow.addColorStop(0.25, warm + (0.5 * sunOpacity) + ')');
    glow.addColorStop(1, warm + '0)');
    cx.fillStyle = glow; cx.fillRect(sx - 60, sy - 60, 120, 120);
  }

  // far peaks — the three pale sisters (homage, parallax)
  const px = cam.x * 0.06, py = cam.y * 0.05;
  cx.fillStyle = pc.peak0Color.replace('rgb', 'rgba').replace(')', `,${pc.peak0Opacity}`);
  drawPeaks(px, py, 0);
  drawChurch(pc);
  cx.fillStyle = pc.peak1Color.replace('rgb', 'rgba').replace(')', `,${pc.peak1Opacity}`);
  drawPeaks(cam.x * 0.12 + 200, cam.y * 0.08, 1);

  // valley haze — the far layers dissolve into the air
  const hg = cx.createLinearGradient(0, VH * 0.34, 0, VH * 0.95);
  const hazeRgba = pc.hazeColor.replace('rgb', 'rgba').replace(')', `,${pc.hazeOpacity}`);
  const hazeRgba0 = pc.hazeColor.replace('rgb', 'rgba').replace(')', `,0`);
  hg.addColorStop(0, hazeRgba0);
  hg.addColorStop(1, hazeRgba);
  cx.fillStyle = hg; cx.fillRect(0, VH * 0.34, VW, VH * 0.66);

  // mid-distance conifer ridges, only down in the valley
  const fc0 = pc.fc0Color.replace('rgb', 'rgba').replace(')', `,${pc.fc0Opacity}`);
  const fc1 = pc.fc1Color.replace('rgb', 'rgba').replace(')', `,${pc.fc1Opacity}`);
  drawForestBand(0.2, 0.83, fc0, 0.8);
  drawForestBand(0.3, 0.96, fc1, 1.15);

  // clouds
  const cloudRGB = pc.cloudColor.replace('rgb(', '').replace(')', '');
  for (let i = 0; i < 6; i++) {
    const cxp = ((i * 260 + frame * (0.1 + i * 0.02) - cam.x * 0.15) % (VW + 200)) - 100;
    const cyp = 30 + (i * 47) % 80 - cam.y * 0.1;
    cloud(cxp, cyp, 30 + (i % 3) * 14, cloudRGB, pc.cloudOpacity);
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
function drawChurch(pc) {
  // the village church across the valley, on its little knoll
  const par = 0.09, cycle = 1500;
  const sx = ((480 - cam.x * par) % cycle + cycle) % cycle - 150;
  if (sx < -60 || sx > VW + 60) return;
  const base = VH * 0.66 + (WORLD_H * TILE - VH - cam.y) * par * 0.3;
  if (base - 40 > VH) return;
  const sil = pc.silColor.replace('rgb', 'rgba').replace(')', `,${pc.silOpacity}`);
  const roof = pc.roofColor.replace('rgb', 'rgba').replace(')', `,${pc.roofOpacity}`);
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
  cx.fillStyle = pc.night > 0.01
    ? hexLerp(pc.roofColor, '#ffd87a', pc.night).replace('rgb', 'rgba').replace(')', `,${lerp(pc.roofOpacity, 0.85, pc.night)}`)
    : roof;
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

function drawBgRock(pc) {
  for (const r of BG_ROCK) {
    const x = r.x * TILE - cam.x, y = r.y * TILE - cam.y;
    const w = r.w * TILE, h = r.h * TILE;
    if (x > VW || y > VH || x + w < 0 || y + h < 0) continue;
    const gr = cx.createLinearGradient(0, y, 0, y + h);
    if (r.cave) { gr.addColorStop(0, '#2e2a24'); gr.addColorStop(1, '#1c1916'); }
    else { gr.addColorStop(0, pc.bgRockColor0); gr.addColorStop(1, pc.bgRockColor1); }
    cx.fillStyle = gr;
    cx.fillRect(x, y, w, h);
    texRect(ensureTex().rock, x, y, w, h);
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
  if (ty <= 19 + Y_OFF) return 'ridge';
  if (ty <= 37 + Y_OFF) return 'high';
  if (ty <= 58 + Y_OFF) return 'alm';
  return 'valley';
}
const GRASS = { ridge: '#9fae7e', high: '#8fa37a', alm: '#6fae57', valley: '#5d9148' };
const ROCKC = { ridge: '#b8b2a4', high: '#a8a094', alm: '#97907f', valley: '#8c8577' };

// ----- baked procedural surface textures (no asset files; drawn once) -----
// A 512×512 detail sheet is 8×8 tiles of organic grain, supersampled at 4× (each
// sub-tile is 64px of source for a 16px world tile). We blit a sub-tile per
// terrain tile keyed to its world index, so detail is world-locked and never
// swims with the camera, and the 8×8 spread means the base grain only repeats
// every 8 tiles. Blitted with smoothing ON (see drawTiles/texRect) so the world's
// ZOOM upscale resamples the high-res grain cleanly instead of nearest-neighbour
// magnifying a low-res sheet into blocks. Translucent over the biome fill; the
// per-tile colour jitter + drawRockDecor break up whatever periodicity is left.
let TEX = null;
function ensureTex() {
  if (TEX) return TEX;
  const SS = 4, SUB = 16 * SS, SZ = SUB * 8;   // 64-px sub-tiles, 512² sheet
  const mk = paint => {
    const c = document.createElement('canvas'); c.width = SZ; c.height = SZ;
    paint(c.getContext('2d')); return c;
  };
  const R = Math.random;
  TEX = {
    SUB,
    rock: mk(g => {
      // broad soft blotches — large-scale tonal variation (scaled with SS)
      for (let i = 0; i < 100; i++) {
        const x = R() * SZ, y = R() * SZ, r = (4 + R() * 12) * SS;
        g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${0.03 + R() * 0.05})` : `rgba(255,255,255,${0.02 + R() * 0.04})`;
        g.beginPath(); g.ellipse(x, y, r, r * (0.55 + R() * 0.4), R() * 3, 0, 7); g.fill();
      }
      g.lineWidth = 1.3;                                               // cracks
      for (let i = 0; i < 360; i++) {
        g.strokeStyle = `rgba(0,0,0,${0.1 + R() * 0.08})`;
        const x = R() * SZ, y = R() * SZ;
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + (R() - 0.5) * 22 * SS, y + (R() - 0.5) * 22 * SS);
        g.lineTo(x + (R() - 0.5) * 30 * SS, y + (R() - 0.5) * 30 * SS); g.stroke();
      }
      for (let i = 0; i < 5600; i++) {                                 // fine pits + flecks
        const x = R() * SZ, y = R() * SZ, s = R() < 0.62 ? 1 : 2;
        g.fillStyle = R() < 0.62 ? `rgba(0,0,0,${0.05 + R() * 0.1})` : `rgba(255,255,255,${0.04 + R() * 0.08})`;
        g.fillRect(x, y, s, s);
      }
    }),
    dirt: mk(g => {
      for (let i = 0; i < 8800; i++) {                                 // grain
        const x = R() * SZ, y = R() * SZ, s = R() < 0.72 ? 1 : 2;
        g.fillStyle = R() < 0.55 ? `rgba(58,44,28,${0.06 + R() * 0.1})` : `rgba(232,222,196,${0.05 + R() * 0.1})`;
        g.fillRect(x, y, s, s);
      }
      g.fillStyle = 'rgba(120,104,80,0.28)';                           // pebbles
      for (let i = 0; i < 190; i++) { g.beginPath(); g.arc(R() * SZ, R() * SZ, (1 + R() * 1.4) * SS * 0.6, 0, 7); g.fill(); }
    }),
  };
  return TEX;
}
function texTile(sheet, tx, ty, x, y) {
  const SUB = TEX.SUB, cols = sheet.width / SUB;
  // 0.5px inset so bilinear sampling never bleeds across sub-tile boundaries
  cx.drawImage(sheet, (tx % cols + cols) % cols * SUB + 0.5, (ty % cols + cols) % cols * SUB + 0.5, SUB - 1, SUB - 1, x, y, TILE, TILE);
}
// cover a big background rect (cliff face) with world-locked detail, clipped to
// the rect and clamped to the viewport so the cost stays bounded
function texRect(sheet, sx, sy, w, h) {
  const vx0 = Math.max(sx, 0), vy0 = Math.max(sy, 0);
  const vx1 = Math.min(sx + w, VW), vy1 = Math.min(sy + h, VH);
  if (vx1 <= vx0 || vy1 <= vy0) return;
  cx.save();
  cx.imageSmoothingEnabled = true; // resample the high-res grain cleanly (restored by restore())
  cx.beginPath(); cx.rect(sx, sy, w, h); cx.clip();
  const tx0 = Math.floor((vx0 + cam.x) / TILE), ty0 = Math.floor((vy0 + cam.y) / TILE);
  const tx1 = Math.ceil((vx1 + cam.x) / TILE), ty1 = Math.ceil((vy1 + cam.y) / TILE);
  for (let ty = ty0; ty < ty1; ty++)
    for (let tx = tx0; tx < tx1; tx++)
      texTile(sheet, tx, ty, tx * TILE - cam.x, ty * TILE - cam.y);
  cx.restore();
}
// soft elliptical contact shadow at a floor line (screen space) — grounds
// characters and loose objects so they read as resting on the terrain
function groundShadow(x, floorY, hw, a) {
  cx.fillStyle = `rgba(18,22,28,${a})`;
  cx.beginPath(); cx.ellipse(x, floorY, hw, hw * 0.34, 0, 0, 7); cx.fill();
}
const SHADOW_ENTS = new Set(['npc', 'dog', 'cow', 'marmot', 'gear', 'chestnut', 'tin', 'relic', 'book', 'bench', 'page']);

// Per-tile rock decoration keyed to a world-stable hash so the spread is
// non-repeating: lichen rosettes, moss, mineral veins, quartz. Sparse accents
// over the baked grain, gated low and offset off-grid so they never read as a
// grid.
function drawRockDecor(x, y, h, bio) {
  if (h(70) > 0.9) {                                    // lichen rosette
    const lx = x + h(71) * TILE, ly = y + h(72) * TILE;
    const col = (bio === 'valley' || bio === 'alm') ? '182,196,150' : '176,186,168';
    const n = 3 + Math.floor(h(76) * 3);
    for (let i = 0; i < n; i++) {
      const a = i / n * 7 + h(73) * 6;
      cx.fillStyle = `rgba(${col},${0.14 + h(74 + i) * 0.12})`;
      cx.beginPath(); cx.arc(lx + Math.cos(a) * (1.5 + h(78) * 2), ly + Math.sin(a) * (1.5 + h(79) * 2), 1 + h(75 + i), 0, 7); cx.fill();
    }
    cx.fillStyle = `rgba(${col},0.2)`; cx.beginPath(); cx.arc(lx, ly, 1.2, 0, 7); cx.fill();
  }
  if (h(80) > 0.92) {                                   // moss tuft
    cx.fillStyle = 'rgba(74,104,60,0.3)';
    const mx = x + h(81) * TILE, my = y + h(82) * TILE;
    for (let i = 0; i < 3; i++) { cx.beginPath(); cx.arc(mx + (h(83 + i) - 0.5) * 6, my + (h(86 + i) - 0.5) * 5, 1.2 + h(89 + i) * 1.2, 0, 7); cx.fill(); }
  }
  if (h(92) > 0.91) {                                   // mineral vein (can run off-tile)
    cx.strokeStyle = 'rgba(222,216,198,0.45)'; cx.lineWidth = 0.8;
    const vy0 = y + h(93) * TILE;
    cx.beginPath(); cx.moveTo(x - 2, vy0); cx.lineTo(x + TILE + 2, vy0 + (h(94) - 0.5) * TILE * 1.6); cx.stroke();
  }
  if (h(96) > 0.95) {                                   // quartz fleck
    cx.fillStyle = 'rgba(255,255,250,0.65)';
    cx.fillRect(x + h(97) * TILE, y + h(98) * TILE, 1.4, 1.4);
  }
  if (h(100) > 0.985) {                                 // embedded boulder (rare accent)
    drawBoulder(x + 3 + h(101) * (TILE - 6), y + 4 + h(102) * (TILE - 8), 2.4 + h(103) * 2.4, h, 104, 120 + h(105) * 24, false);
  }
}

// Decorative rock & plant objects, sprinkled ~1/10 as often as the original
// pass so they read as occasional accents over the baked grain, not a carpet.
// Keyed to the per-tile hash + air flags, drawn over the edge bumps so they sit
// on the silhouette. Vegetation thins out with altitude (vegK).
function drawWallVeg(x, y, h, bio, upAir, downAir, leftAir, rightAir) {
  const vegK = bio === 'valley' ? 1 : bio === 'alm' ? 0.95 : bio === 'high' ? 0.5 : 0.22;
  const gcol = bio === 'valley' ? '#5d9148' : bio === 'alm' ? '#6fae57' : bio === 'high' ? '#7e8f5e' : '#8a9468';
  if (upAir && h(150) > 0.99) {                         // boulder resting on a ledge
    const r = 3 + h(151) * 3.2;
    drawBoulder(x + 3 + h(152) * (TILE - 6), y - r * 0.55, r, h, 153, 150 + h(154) * 26, true);
  }
  if (upAir && h(155) > 1 - 0.034 * vegK) {             // shrub on a ledge
    const bcol = bio === 'valley' ? '#4d7d3c' : bio === 'alm' ? '#5a9446' : '#647a4e';
    drawBush(x + 3 + h(156) * (TILE - 6), y + 1, 2.6 + h(157) * 2.4, h, 158, bcol);
  }
  if (leftAir && h(120) > 1 - 0.034 * vegK) drawTuft(x + 0.5, y + 3 + h(121) * (TILE - 6), -1, 0.9 + h(122) * 0.4, gcol, h, 123);
  if (rightAir && h(126) > 1 - 0.034 * vegK) drawTuft(x + TILE - 0.5, y + 3 + h(127) * (TILE - 6), 1, 0.9 + h(128) * 0.4, gcol, h, 129);
  if (downAir && h(132) > 1 - 0.03 * vegK) {            // hanging vine under an overhang
    const vcol = (bio === 'valley' || bio === 'alm') ? 'rgba(86,118,68,0.85)' : 'rgba(96,104,72,0.8)';
    drawVine(x + 2 + h(133) * (TILE - 4), y + TILE, 4 + h(134) * 7, vcol, h, 135);
  }
  if ((leftAir || rightAir || upAir) && h(138) > 0.993) {  // alpine flower in a crevice / on a ledge
    const fx = x + (leftAir ? 2 : rightAir ? TILE - 2 : 3 + h(139) * (TILE - 6));
    const fy = y + (upAir ? 0 : 3 + h(140) * (TILE - 6));
    cx.fillStyle = h(141) > 0.5 ? '#d9577a' : '#5a7fd0';   // alpenrose / gentian
    cx.beginPath(); cx.arc(fx, fy, 1.5, 0, 7); cx.fill();
    cx.fillStyle = '#e9c84a'; cx.beginPath(); cx.arc(fx, fy, 0.6, 0, 7); cx.fill();
  }
}
// a shaded, lit rounded boulder. by = vertical centre; resting adds a contact
// shadow and means it's sitting on the surface rather than set into the face.
function drawBoulder(bx, by, r, h, seed, tone, resting) {
  if (resting) { cx.fillStyle = 'rgba(18,22,28,0.18)'; cx.beginPath(); cx.ellipse(bx, by + r * 0.82, r * 1.05, r * 0.32, 0, 0, 7); cx.fill(); }
  const t = Math.round(tone);
  cx.fillStyle = `rgb(${t},${t - 5},${t - 13})`;
  cx.beginPath();
  const pts = 8;
  for (let i = 0; i < pts; i++) {
    const a = i / pts * 6.283, rr = r * (0.8 + h(seed + i) * 0.3);
    const px = bx + Math.cos(a) * rr, py = by + Math.sin(a) * rr * 0.9;
    i ? cx.lineTo(px, py) : cx.moveTo(px, py);
  }
  cx.closePath(); cx.fill();
  cx.fillStyle = 'rgba(255,255,255,0.13)';
  cx.beginPath(); cx.ellipse(bx - r * 0.25, by - r * 0.36, r * 0.5, r * 0.3, -0.4, 0, 7); cx.fill();
  cx.fillStyle = 'rgba(0,0,0,0.2)';
  cx.beginPath(); cx.ellipse(bx + r * 0.1, by + r * 0.4, r * 0.7, r * 0.3, 0, 0, 7); cx.fill();
  cx.strokeStyle = 'rgba(0,0,0,0.22)'; cx.lineWidth = 0.6;
  cx.beginPath(); cx.moveTo(bx - r * 0.35, by - r * 0.12); cx.lineTo(bx + r * 0.05, by + r * 0.12); cx.lineTo(bx + r * 0.18, by + r * 0.42); cx.stroke();
}
// a leafy shrub sitting on (bx, baseY) — overlapping blobs, base shadow + top light
function drawBush(bx, baseY, r, h, seed, col) {
  cx.fillStyle = 'rgba(18,22,28,0.14)'; cx.beginPath(); cx.ellipse(bx, baseY, r * 1.1, r * 0.3, 0, 0, 7); cx.fill();
  cx.fillStyle = col;
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * 6.283;
    cx.beginPath(); cx.arc(bx + Math.cos(a) * r * 0.45, baseY - r * 0.5 + Math.sin(a) * r * 0.35, r * (0.55 + h(seed + i) * 0.25), 0, 7); cx.fill();
  }
  cx.fillStyle = 'rgba(255,255,255,0.13)';
  cx.beginPath(); cx.arc(bx - r * 0.2, baseY - r * 0.85, r * 0.4, 0, 7); cx.fill();
}
function drawTuft(ax, ay, dir, scale, col, h, seed) {
  cx.strokeStyle = col; cx.lineWidth = 0.8;
  const n = 3 + Math.floor(h(seed) * 3);
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1) - 0.5;
    const len = (3 + h(seed + 1 + i) * 3.5) * scale;
    cx.beginPath(); cx.moveTo(ax, ay + t * 2);
    cx.quadraticCurveTo(ax + dir * 2 + t, ay - len * 0.5, ax + dir * (2 + Math.abs(t) * 2.5) + t * 1.5, ay - len + Math.abs(t) * 1.5);
    cx.stroke();
  }
}
function drawVine(ax, ay, len, col, h, seed) {
  cx.strokeStyle = col; cx.lineWidth = 0.9;
  const sway = (h(seed) - 0.5) * 5;
  cx.beginPath(); cx.moveTo(ax, ay);
  cx.quadraticCurveTo(ax + sway * 0.5, ay + len * 0.5, ax + sway, ay + len);
  cx.stroke();
  cx.fillStyle = col;
  for (let i = 1; i <= 2; i++) {
    const f = i / 3, lx = ax + sway * f, ly = ay + len * f;
    cx.beginPath(); cx.ellipse(lx + (i % 2 ? 1.6 : -1.6), ly, 1.7, 0.9, i % 2 ? 0.6 : -0.6, 0, 7); cx.fill();
  }
}

function drawTiles() {
  const tex = ensureTex();
  cx.imageSmoothingEnabled = true; // smooth the supersampled grain blits (restored at end)
  const SEAM = 0.5; // overlap to hide sub-pixel gridlines between tiles
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(WORLD_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(WORLD_H - 1, Math.ceil((cam.y + VH) / TILE) + 1);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = grid[ty * WORLD_W + tx];
      if (!t) continue;
      const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
      const bio = biomeAt(tx, ty);
      if (t === 1) {
        const hashVal = Math.abs(Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453) % 1;
        const h = (s) => (hashVal * 123.456 + s * 23.719) % 1;
        // per-tile colour jitter so the flat fill never reads as one slab
        const jit = hashVal - 0.5;
        const rockColor = hexLerp(ROCKC[bio], jit > 0 ? '#cbc7b9' : '#6e6a5f', Math.abs(jit) * 0.15);
        cx.fillStyle = rockColor;
        cx.fillRect(x - SEAM, y - SEAM, TILE + SEAM * 2, TILE + SEAM * 2);
        texTile(tex.rock, tx, ty, x, y);
        drawRockDecor(x, y, h, bio);
        // speckle
        if ((tx * 7 + ty * 13) % 5 === 0) { cx.fillStyle = 'rgba(0,0,0,0.07)'; cx.fillRect(x + (tx % 3) * 4, y + (ty % 3) * 4, 3, 3); }

        const up = tileAt(tx, ty - 1);
        const down = tileAt(tx, ty + 1);
        const left = tileAt(tx - 1, ty);
        const right = tileAt(tx + 1, ty);
        const upAir = !SOLID(up) && up !== 4;
        const downAir = !SOLID(down);
        const leftAir = !SOLID(left);
        const rightAir = !SOLID(right);

        // inner-edge ambient occlusion on air-facing sides — carves depth
        if (leftAir) { cx.fillStyle = 'rgba(0,0,0,0.08)'; cx.fillRect(x, y, 2, TILE); }
        if (rightAir) { cx.fillStyle = 'rgba(0,0,0,0.08)'; cx.fillRect(x + TILE - 2, y, 2, TILE); }

        cx.fillStyle = rockColor;
        // Left Edge Bumps
        if (leftAir) {
          const numBumps = 2;
          for (let i = 0; i < numBumps; i++) {
            const by = y + (i + 0.5) * (TILE / numBumps) + (h(i + 1) - 0.5) * 2;
            const bx = x;
            const br = 2.5 + h(i + 5) * 1.5;
            cx.beginPath(); cx.arc(bx, by, br, Math.PI * 0.5, Math.PI * 1.5); cx.fill();
          }
        }
        // Right Edge Bumps
        if (rightAir) {
          const numBumps = 2;
          for (let i = 0; i < numBumps; i++) {
            const by = y + (i + 0.5) * (TILE / numBumps) + (h(i + 10) - 0.5) * 2;
            const bx = x + TILE;
            const br = 2.5 + h(i + 15) * 1.5;
            cx.beginPath(); cx.arc(bx, by, br, Math.PI * 1.5, Math.PI * 0.5); cx.fill();
          }
        }
        // Bottom Edge Bumps
        if (downAir) {
          const numBumps = 2;
          for (let i = 0; i < numBumps; i++) {
            const bx = x + (i + 0.5) * (TILE / numBumps) + (h(i + 20) - 0.5) * 2;
            const by = y + TILE;
            const br = 2.5 + h(i + 25) * 1.5;
            cx.beginPath(); cx.arc(bx, by, br, 0, Math.PI); cx.fill();
            // shadow overlay on bump
            cx.fillStyle = 'rgba(0,0,0,0.18)';
            cx.beginPath(); cx.arc(bx, by, br, 0, Math.PI); cx.fill();
            cx.fillStyle = rockColor;
          }
        }

        // Corners
        if (upAir && leftAir) {
          cx.beginPath(); cx.arc(x, y, 3 + h(30) * 1.5, 0, Math.PI * 2); cx.fill();
        }
        if (upAir && rightAir) {
          cx.beginPath(); cx.arc(x + TILE, y, 3 + h(31) * 1.5, 0, Math.PI * 2); cx.fill();
        }
        if (downAir && leftAir) {
          cx.beginPath(); cx.arc(x, y + TILE, 3 + h(32) * 1.5, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = 'rgba(0,0,0,0.18)';
          cx.beginPath(); cx.arc(x, y + TILE, 3 + h(32) * 1.5, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = rockColor;
        }
        if (downAir && rightAir) {
          cx.beginPath(); cx.arc(x + TILE, y + TILE, 3 + h(33) * 1.5, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = 'rgba(0,0,0,0.18)';
          cx.beginPath(); cx.arc(x + TILE, y + TILE, 3 + h(33) * 1.5, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = rockColor;
        }

        // Grass cap
        if (upAir) {
          // contact AO just under the turf so the grass sits on the rock
          cx.fillStyle = 'rgba(0,0,0,0.07)'; cx.fillRect(x, y + 3, TILE, 2);
          cx.fillStyle = GRASS[bio];
          const numHumps = 3;
          for (let i = 0; i < numHumps; i++) {
            const hx = x + (i + 0.5) * (TILE / numHumps) + (h(i + 40) - 0.5) * 1.5;
            const hy = y + 0.5;
            const hr = (TILE / numHumps) * (0.65 + h(i + 45) * 0.35);
            cx.beginPath(); cx.arc(hx, hy, hr, Math.PI, 0); cx.fill();
          }
          // vertical grass blades
          const blades = 1 + Math.floor(h(50) * 2);
          for (let i = 0; i < blades; i++) {
            const bx = x + h(51 + i) * TILE;
            const bh = 1.5 + h(52 + i) * 2.5;
            const bw = 1 + h(53 + i) * 1;
            cx.beginPath();
            cx.moveTo(bx - bw / 2, y + 0.5);
            cx.lineTo(bx, y + 0.5 - bh);
            cx.lineTo(bx + bw / 2, y + 0.5);
            cx.fill();
          }
        }

        // Overhang shadow & fringe
        if (downAir) {
          cx.fillStyle = 'rgba(0,0,0,0.18)';
          cx.fillRect(x, y + TILE - 3, TILE, 3);

          cx.fillStyle = 'rgba(86,118,68,0.8)';
          if ((tx * 13 + ty * 7) % 3 !== 2) {
            cx.fillRect(x + (tx % 5) * 3, y + TILE, 2, 3 + (tx % 3) * 2);
            cx.fillRect(x + 8 + (ty % 4) * 2, y + TILE, 2, 2 + (ty % 3) * 2);
          }
        }

        // rare decorative rocks & plants, drawn last so they sit on the silhouette
        if (upAir || downAir || leftAir || rightAir) drawWallVeg(x, y, h, bio, upAir, downAir, leftAir, rightAir);
      } else if (t === 2) {
        const dh = Math.abs(Math.sin(tx * 41.3 + ty * 9.71) * 4117.7) % 1;
        const rockColor = hexLerp('#b3a88e', dh > 0.5 ? '#c6bca2' : '#928871', Math.abs(dh - 0.5) * 0.2);
        cx.fillStyle = rockColor;
        cx.fillRect(x - SEAM, y - SEAM, TILE + SEAM * 2, TILE + SEAM * 2);
        texTile(tex.dirt, tx, ty, x, y);
        cx.fillStyle = '#998d72';
        cx.fillRect(x + ((tx * 3) % 8), y + ((ty * 5) % 8), 4, 3);
        cx.fillRect(x + ((tx * 5 + 7) % 10), y + ((ty * 3 + 4) % 10), 3, 3);
        cx.fillStyle = '#cfc4a8'; cx.fillRect(x + ((tx * 7 + 3) % 11), y + ((ty * 7 + 2) % 11), 3, 2);
        // occasional embedded stone, world-stable so the scree never tiles
        if (dh > 0.72) {
          cx.fillStyle = 'rgba(108,98,80,0.5)';
          cx.beginPath(); cx.ellipse(x + (dh * 53 % 1) * TILE, y + (dh * 91 % 1) * TILE, 1.6 + (dh * 31 % 1) * 1.8, 1.2 + (dh * 17 % 1) * 1.2, dh * 6, 0, 7); cx.fill();
        }

        const up = tileAt(tx, ty - 1);
        const down = tileAt(tx, ty + 1);
        const left = tileAt(tx - 1, ty);
        const right = tileAt(tx + 1, ty);
        const upAir = !SOLID(up) && up !== 4;
        const downAir = !SOLID(down);
        const leftAir = !SOLID(left);
        const rightAir = !SOLID(right);

        const hashVal = Math.abs(Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453) % 1;
        const h = (s) => (hashVal * 123.456 + s * 23.719) % 1;

        cx.fillStyle = rockColor;

        // Top Edge Bumps (scree)
        if (upAir) {
          const numBumps = 2;
          for (let i = 0; i < numBumps; i++) {
            const bx = x + (i + 0.5) * (TILE / numBumps) + (h(i + 1) - 0.5) * 2;
            const by = y;
            const br = 2.5 + h(i + 5) * 1.5;
            cx.beginPath(); cx.arc(bx, by, br, Math.PI, 0); cx.fill();
          }
        }
        // Left Edge Bumps
        if (leftAir) {
          const numBumps = 2;
          for (let i = 0; i < numBumps; i++) {
            const by = y + (i + 0.5) * (TILE / numBumps) + (h(i + 10) - 0.5) * 2;
            const bx = x;
            const br = 2.5 + h(i + 15) * 1.5;
            cx.beginPath(); cx.arc(bx, by, br, Math.PI * 0.5, Math.PI * 1.5); cx.fill();
          }
        }
        // Right Edge Bumps
        if (rightAir) {
          const numBumps = 2;
          for (let i = 0; i < numBumps; i++) {
            const by = y + (i + 0.5) * (TILE / numBumps) + (h(i + 20) - 0.5) * 2;
            const bx = x + TILE;
            const br = 2.5 + h(i + 25) * 1.5;
            cx.beginPath(); cx.arc(bx, by, br, Math.PI * 1.5, Math.PI * 0.5); cx.fill();
          }
        }
        // Bottom Edge Bumps
        if (downAir) {
          const numBumps = 2;
          for (let i = 0; i < numBumps; i++) {
            const bx = x + (i + 0.5) * (TILE / numBumps) + (h(i + 30) - 0.5) * 2;
            const by = y + TILE;
            const br = 2.5 + h(i + 35) * 1.5;
            cx.beginPath(); cx.arc(bx, by, br, 0, Math.PI); cx.fill();
            cx.fillStyle = 'rgba(0,0,0,0.12)';
            cx.beginPath(); cx.arc(bx, by, br, 0, Math.PI); cx.fill();
            cx.fillStyle = rockColor;
          }
        }

        // Corners
        if (upAir && leftAir) {
          cx.beginPath(); cx.arc(x, y, 3 + h(40) * 1.5, 0, Math.PI * 2); cx.fill();
        }
        if (upAir && rightAir) {
          cx.beginPath(); cx.arc(x + TILE, y, 3 + h(41) * 1.5, 0, Math.PI * 2); cx.fill();
        }
        if (downAir && leftAir) {
          cx.beginPath(); cx.arc(x, y + TILE, 3 + h(42) * 1.5, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = 'rgba(0,0,0,0.12)';
          cx.beginPath(); cx.arc(x, y + TILE, 3 + h(42) * 1.5, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = rockColor;
        }
        if (downAir && rightAir) {
          cx.beginPath(); cx.arc(x + TILE, y + TILE, 3 + h(43) * 1.5, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = 'rgba(0,0,0,0.12)';
          cx.beginPath(); cx.arc(x + TILE, y + TILE, 3 + h(43) * 1.5, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = rockColor;
        }

        // Scree shadow
        if (downAir) {
          cx.fillStyle = 'rgba(0,0,0,0.12)';
          cx.fillRect(x, y + TILE - 3, TILE, 3);
        }
      } else if (t === 7) {
        // Blankeis — hard glacier ice glazing the saddle: smooth, glassy, slick.
        const up = tileAt(tx, ty - 1);
        const upAir = !SOLID(up) && up !== 4;
        const hashVal = Math.abs(Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453) % 1;
        // cool rock base so the ice reads as a thin glaze bonded to the saddle
        cx.fillStyle = hexLerp(ROCKC[bio], '#9fb6c4', 0.55);
        cx.fillRect(x - SEAM, y - SEAM, TILE + SEAM * 2, TILE + SEAM * 2);
        // glassy sheet with a vertical sheen
        const ig = cx.createLinearGradient(0, y, 0, y + TILE);
        ig.addColorStop(0, 'rgba(228,242,251,0.92)');
        ig.addColorStop(0.5, 'rgba(184,212,231,0.80)');
        ig.addColorStop(1, 'rgba(152,184,207,0.72)');
        cx.fillStyle = ig;
        cx.fillRect(x - SEAM, y - SEAM, TILE + SEAM * 2, TILE + SEAM * 2);
        // world-stable facet cracks
        cx.strokeStyle = 'rgba(116,148,170,0.45)'; cx.lineWidth = 0.7;
        cx.beginPath();
        cx.moveTo(x + hashVal * TILE, y);
        cx.lineTo(x + ((hashVal * 1.7) % 1) * TILE, y + TILE);
        cx.moveTo(x, y + ((hashVal * 2.3) % 1) * TILE);
        cx.lineTo(x + TILE, y + ((hashVal * 3.1) % 1) * TILE);
        cx.stroke();
        // specular glints
        cx.fillStyle = 'rgba(255,255,255,0.6)';
        cx.fillRect(x + 2 + (tx % 4) * 2, y + 3 + (ty % 3) * 2, 3, 1.3);
        cx.fillRect(x + 9 - (ty % 3), y + 8 + (tx % 2) * 2, 2, 1.1);
        // a crisp bright rim along the exposed top edge
        if (upAir) { cx.fillStyle = 'rgba(255,255,255,0.85)'; cx.fillRect(x - SEAM, y - SEAM, TILE + SEAM * 2, 1.6); }
        if (!SOLID(tileAt(tx, ty + 1))) { cx.fillStyle = 'rgba(40,60,80,0.18)'; cx.fillRect(x, y + TILE - 3, TILE, 3); }
      } else if (t === 3) {
        cx.fillStyle = '#7a5a39'; cx.fillRect(x, y, TILE, 5);
        cx.fillStyle = '#5e4429'; cx.fillRect(x, y + 5, TILE, 2);
        cx.fillStyle = 'rgba(255,255,255,0.15)'; cx.fillRect(x, y, TILE, 1);
      } else if (t === 4) {
        const wob = Math.sin(frame * 0.08 + tx * 0.9) * 1.5;
        const grad = cx.createLinearGradient(0, y, 0, y + TILE);
        if (tileAt(tx, ty - 1) !== 4) {
          grad.addColorStop(0, '#3b82a6');
          grad.addColorStop(1, '#2a6585');
        } else {
          grad.addColorStop(0, '#2a6585');
          grad.addColorStop(1, '#1e4c66');
        }
        cx.fillStyle = grad;
        cx.fillRect(x - SEAM, y + (tileAt(tx, ty - 1) === 4 ? -SEAM : 2 + wob * 0.5), TILE + SEAM * 2, TILE + SEAM * 2);
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

function drawWaterOverlay() {
  const SEAM = 0.5;
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(WORLD_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(WORLD_H - 1, Math.ceil((cam.y + VH) / TILE) + 1);
  
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = grid[ty * WORLD_W + tx];
      if (t !== 4) continue;
      
      const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
      const wob = Math.sin(frame * 0.08 + tx * 0.9) * 1.5;
      const hasWaterAbove = tileAt(tx, ty - 1) === 4;
      
      const grad = cx.createLinearGradient(0, y, 0, y + TILE);
      if (!hasWaterAbove) {
        grad.addColorStop(0, 'rgba(90, 175, 215, 0.35)');
        grad.addColorStop(1, 'rgba(60, 140, 180, 0.45)');
      } else {
        grad.addColorStop(0, 'rgba(60, 140, 180, 0.45)');
        grad.addColorStop(1, 'rgba(30, 95, 130, 0.55)');
      }
      
      cx.fillStyle = grad;
      cx.fillRect(x - SEAM, y + (hasWaterAbove ? -SEAM : 2 + wob * 0.5), TILE + SEAM * 2, TILE + SEAM * 2);
      
      if (!hasWaterAbove) {
        const surfY = y + 2 + wob * 0.5;
        
        // Dynamic double wave foam rendering
        cx.fillStyle = 'rgba(215, 245, 255, 0.65)';
        cx.fillRect(x, surfY, TILE, 2);
        
        const wob2 = Math.sin(frame * 0.05 + tx * 1.3) * 1.0;
        cx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(x, surfY + 1.2 + wob2 * 0.5);
        cx.lineTo(x + TILE, surfY + 1.2 + wob2 * 0.5);
        cx.stroke();
      }
      
      // Specular reflections/shimmer lines inside the body
      if ((tx + ty) % 3 === 0) {
        const shimmerX = Math.sin(frame * 0.02 + ty * 0.5) * 3;
        cx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        cx.fillRect(x + 2 + shimmerX, y + TILE / 2, TILE - 4, 1.5);
      }
    }
  }
  cx.imageSmoothingEnabled = false; // back to crisp nearest-neighbour for the rest of the frame
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

  // Helper for quadratic bezier points
  const getQuadPoint = (p0x, p0y, p1x, p1y, p2x, p2y, t) => {
    const mt = 1 - t;
    return {
      x: mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x,
      y: mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y
    };
  };

  // 1. Calculate Trunk Points (Tapered & Flared base)
  const steps = 6;
  const trunkPoints = [];
  const baseW = 5.5 * s;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const currH = H * t;
    // Larches have a slight organic bend
    const tx = (kind === 0) ? bx + Math.sin(t * Math.PI * 1.25) * 2.5 * s + t * 2 * s : bx;
    const ty = by - currH;
    let tw = baseW * (1 - t * 0.76);
    if (i === 0) tw = baseW * 1.55; // Root flare
    else if (i === 1) tw = baseW * 1.15;
    trunkPoints.push({ x: tx, y: ty, w: tw });
  }

  // 2. Draw Trunk (Light and shadow halves for 3D depth)
  // Left half (light)
  cx.beginPath();
  for (let i = 0; i <= steps; i++) {
    cx.lineTo(trunkPoints[i].x - trunkPoints[i].w / 2, trunkPoints[i].y);
  }
  for (let i = steps; i >= 0; i--) {
    cx.lineTo(trunkPoints[i].x, trunkPoints[i].y);
  }
  cx.closePath();
  cx.fillStyle = hexLerp('#6b4b32', '#1c130d', curPC.night);
  cx.fill();

  // Right half (shadow)
  cx.beginPath();
  for (let i = 0; i <= steps; i++) {
    cx.lineTo(trunkPoints[i].x, trunkPoints[i].y);
  }
  for (let i = steps; i >= 0; i--) {
    cx.lineTo(trunkPoints[i].x + trunkPoints[i].w / 2, trunkPoints[i].y);
  }
  cx.closePath();
  cx.fillStyle = hexLerp('#442f1f', '#100c07', curPC.night);
  cx.fill();

  // Bark grooves (subtle texture, low contrast)
  cx.strokeStyle = hexLerp('#523925', '#140e09', curPC.night);
  cx.lineWidth = 0.6 * s;
  cx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const p = trunkPoints[i];
    const gx = p.x - p.w * 0.15;
    if (i === 0) cx.moveTo(gx, p.y);
    else cx.lineTo(gx, p.y);
  }
  cx.stroke();

  cx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const p = trunkPoints[i];
    const gx = p.x + p.w * 0.2;
    if (i === 0) cx.moveTo(gx, p.y);
    else cx.lineTo(gx, p.y);
  }
  cx.stroke();

  // 3. Draw Foliage
  if (kind === 0) { // larch: feathery, golden-green
    // Low-contrast foliage colors
    const shadowCol = hexLerp('#5f8247', '#1b2a1a', curPC.night);
    const mainCol = hexLerp('#7fa05a', '#223625', curPC.night);
    const highCol = hexLerp('#99ba73', '#2b4733', curPC.night);

    for (let i = 0; i < 6; i++) {
      const t = 0.35 + i * 0.12;
      const tx = bx + Math.sin(t * Math.PI * 1.25) * 2.5 * s + t * 2 * s;
      const ly = by - H * t;
      const lw = (39 - i * 5) * s;

      // Draw branch structure
      cx.strokeStyle = hexLerp('#4e3523', '#130d09', curPC.night);
      cx.lineWidth = (2.0 - i * 0.2) * s;
      cx.beginPath();
      cx.moveTo(tx, ly);
      cx.quadraticCurveTo(tx - lw * 0.3, ly + 6 * s, tx - lw / 2, ly - 3 * s);
      cx.moveTo(tx, ly);
      cx.quadraticCurveTo(tx + lw * 0.3, ly + 6 * s, tx + lw / 2, ly - 3 * s);
      cx.stroke();

      // Collect puff positions to draw them in cohesive layers (all shadows, then all mains, then all highlights)
      const numPuffs = 3;
      const positions = [];
      positions.push({ x: tx, y: ly, r: 7.2 * s });

      for (let k = 1; k <= numPuffs; k++) {
        const pt = k / numPuffs;
        const radius = (7.2 - pt * 3.4) * s;

        const lp = getQuadPoint(tx, ly, tx - lw * 0.3, ly + 6 * s, tx - lw / 2, ly - 3 * s, pt);
        positions.push({ x: lp.x, y: lp.y, r: radius });

        const rp = getQuadPoint(tx, ly, tx + lw * 0.3, ly + 6 * s, tx + lw / 2, ly - 3 * s, pt);
        positions.push({ x: rp.x, y: rp.y, r: radius });
      }

      // Draw shadow layer first
      cx.fillStyle = shadowCol;
      for (const pos of positions) {
        cx.beginPath(); cx.arc(pos.x, pos.y + 0.7 * s, pos.r, 0, 7); cx.fill();
      }

      // Draw main layer
      cx.fillStyle = mainCol;
      for (const pos of positions) {
        cx.beginPath(); cx.arc(pos.x, pos.y, pos.r, 0, 7); cx.fill();
      }

      // Draw highlight layer (subtly shifted, larger size ratio to blend better)
      cx.fillStyle = highCol;
      for (const pos of positions) {
        cx.beginPath(); cx.arc(pos.x - 0.4 * s, pos.y - 0.4 * s, pos.r * 0.88, 0, 7); cx.fill();
      }
    }
  } else { // spruce: structured, tiered, deep forest green
    // Low-contrast evergreen colors
    const spShadowCol = hexLerp('#203f30', '#0a1510', curPC.night);
    const spMainCol = hexLerp('#2b523c', '#102018', curPC.night);
    const spHighCol = hexLerp('#38684d', '#162b20', curPC.night);

    // Helper for drawing scalloped spruce tier path (shallower scallops)
    const drawSpruceTierPath = (tx, ly, lw, topH) => {
      cx.beginPath();
      cx.moveTo(tx, ly - topH);
      cx.quadraticCurveTo(tx - lw * 0.2, ly - topH * 0.4, tx - lw / 2, ly);
      const numScallops = 6;
      for (let j = 0; j < numScallops; j++) {
        const xStart = tx - lw / 2 + (lw / numScallops) * j;
        const xEnd = tx - lw / 2 + (lw / numScallops) * (j + 1);
        const xMid = (xStart + xEnd) / 2;
        // Shallower scallop depth (2.5 instead of 4)
        const hangY = ly + 2.5 * s * (1 - Math.abs(xMid - tx) / (lw / 2));
        cx.lineTo(xMid, hangY);
        cx.lineTo(xEnd, ly);
      }
      cx.quadraticCurveTo(tx + lw * 0.2, ly - topH * 0.4, tx, ly - topH);
      cx.closePath();
    };

    // Helper for drawing a hanging pinecone
    const drawPinecone = (px, py) => {
      const pcW = 3 * s, pcH = 6.5 * s;
      const coneCol = hexLerp('#734829', '#1d120a', curPC.night);
      const coneColD = hexLerp('#52321c', '#140c06', curPC.night);
      cx.fillStyle = coneCol;
      cx.beginPath(); cx.ellipse(px, py + pcH / 2, pcW / 2, pcH / 2, 0, 0, 7); cx.fill();
      cx.fillStyle = coneColD;
      cx.beginPath(); cx.ellipse(px, py + pcH / 2, pcW / 2, pcH / 2, 0, 0, Math.PI); cx.fill();
      cx.strokeStyle = hexLerp('#442f1f', '#100b07', curPC.night);
      cx.lineWidth = 0.8 * s;
      cx.beginPath(); cx.moveTo(px, py); cx.lineTo(px, py - 2 * s); cx.stroke();
    };

    for (let i = 0; i < 5; i++) {
      const t = 0.24 + i * 0.16;
      const tx = bx;
      const ly = by - H * t;
      const lw = (45 - i * 7) * s;
      const topH = 17 * s;

      // Shadow tier (narrower offset)
      cx.fillStyle = spShadowCol;
      drawSpruceTierPath(tx, ly + 1 * s, lw + 1 * s, topH);
      cx.fill();

      // Main tier
      cx.fillStyle = spMainCol;
      drawSpruceTierPath(tx, ly, lw, topH);
      cx.fill();

      // Highlight tier (shifted less for softer contrast)
      cx.fillStyle = spHighCol;
      drawSpruceTierPath(tx - 0.4 * s, ly - 0.6 * s, lw * 0.92, topH * 0.9);
      cx.fill();

      // Needle texturing lines (very soft, lower weight)
      cx.strokeStyle = hexLerp('#1c3b2b', '#0a1410', curPC.night);
      cx.lineWidth = 0.5 * s;
      cx.beginPath();
      const numScallops = 6;
      for (let j = 0; j < numScallops; j++) {
        const xMid = tx - lw / 2 + (lw / numScallops) * (j + 0.5);
        const yMid = ly + 2.5 * s * (1 - Math.abs(xMid - tx) / (lw / 2));
        cx.moveTo(tx + (xMid - tx) * 0.35, ly - topH * 0.35);
        cx.lineTo(xMid, yMid);
      }
      cx.stroke();

      // Hanging cones from lower tiers
      if (i < 3) {
        drawPinecone(tx - lw / 2 + 1 * s, ly + 1 * s);
        drawPinecone(tx + lw / 2 - 1 * s, ly + 1 * s);
      }
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

  if (!taken && SHADOW_ENTS.has(e.t)) groundShadow(x, y, e.t === 'cow' ? 14 : 9, 0.2);

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
      const dir = e.dir || 1;
      cx.save();
      cx.translate(x, y);
      cx.scale(dir, 1);
      cx.fillStyle = '#7a5a39'; cx.fillRect(-1.5, -22, 3, 22);
      cx.fillStyle = '#e8c84f'; // yellow alpine pointer
      cx.beginPath(); cx.moveTo(-14, -22); cx.lineTo(10, -22); cx.lineTo(15, -18.5); cx.lineTo(10, -15); cx.lineTo(-14, -15); cx.closePath(); cx.fill();
      cx.fillStyle = '#b03a2e'; cx.fillRect(-13, -21, 3, 5); // red-white-red blaze
      cx.fillStyle = '#fff'; cx.fillRect(-10, -21, 3, 5);
      cx.fillStyle = '#b03a2e'; cx.fillRect(-7, -21, 3, 5);
      cx.restore();
      break;
    }
    case 'hut': {
      // --- Alpine wooden cabin (Gamsblick-Alm) ---
      const hutW = 56, hutH = 28;
      const hw = hutW / 2, roofOver = 8;

      // wooden log walls — warm brown base
      cx.fillStyle = '#a07040';
      cx.fillRect(x - hw, y - hutH, hutW, hutH);
      // darker lower foundation strip
      cx.fillStyle = '#6b4a2c';
      cx.fillRect(x - hw, y - 4, hutW, 4);
      // horizontal plank / log lines
      cx.strokeStyle = 'rgba(60,30,10,0.25)'; cx.lineWidth = 0.7;
      for (let i = 1; i < 8; i++) {
        const ly = y - hutH + i * (hutH / 8);
        cx.beginPath(); cx.moveTo(x - hw, ly); cx.lineTo(x + hw, ly); cx.stroke();
      }
      // subtle wood grain highlight
      cx.strokeStyle = 'rgba(255,220,160,0.12)'; cx.lineWidth = 0.5;
      for (let i = 0; i < 6; i++) {
        const ly = y - hutH + i * (hutH / 6) + 2;
        cx.beginPath(); cx.moveTo(x - hw + 2, ly); cx.lineTo(x + hw - 2, ly); cx.stroke();
      }

      // --- roof (dark brown, steep pitch) ---
      const roofPeak = 24;
      cx.fillStyle = '#5e3a1e';
      cx.beginPath();
      cx.moveTo(x - hw - roofOver, y - hutH);
      cx.lineTo(x, y - hutH - roofPeak);
      cx.lineTo(x + hw + roofOver, y - hutH);
      cx.closePath(); cx.fill();
      // roof shading — lighter left slope
      cx.fillStyle = 'rgba(255,220,160,0.1)';
      cx.beginPath();
      cx.moveTo(x - hw - roofOver, y - hutH);
      cx.lineTo(x, y - hutH - roofPeak);
      cx.lineTo(x, y - hutH);
      cx.closePath(); cx.fill();
      // roof edge line
      cx.strokeStyle = '#4a2a12'; cx.lineWidth = 1;
      cx.beginPath();
      cx.moveTo(x - hw - roofOver, y - hutH);
      cx.lineTo(x, y - hutH - roofPeak);
      cx.lineTo(x + hw + roofOver, y - hutH);
      cx.stroke();

      // --- gable decoration (inverted-V crossbeam) ---
      cx.strokeStyle = '#7a5030'; cx.lineWidth = 1.5;
      const gx = x, gy = y - hutH;
      cx.beginPath();
      cx.moveTo(gx - 8, gy - 5); cx.lineTo(gx, gy - 15); cx.lineTo(gx + 8, gy - 5);
      cx.stroke();
      // small ridge finial
      cx.strokeStyle = '#5e3a1e'; cx.lineWidth = 1.2;
      cx.beginPath(); cx.moveTo(gx, gy - roofPeak); cx.lineTo(gx, gy - roofPeak - 4); cx.stroke();

      // --- chimney (right side) ---
      cx.fillStyle = '#8a8074';
      cx.fillRect(x + 14, y - hutH - roofPeak + 4, 7, 16);
      // chimney cap
      cx.fillStyle = '#6e645a';
      cx.fillRect(x + 13, y - hutH - roofPeak + 3, 9, 2);
      // smoke from chimney
      if (Math.random() < 0.12) spawnPart({ x: e.x * TILE + 8 + 17, y: e.r * TILE - hutH - roofPeak + 2, vx: 0.15 + Math.random() * 0.1, vy: -0.5 - Math.random() * 0.2, t: 70, c: 'rgba(200,200,210,0.45)', s: 2.5 + Math.random() * 1.5 });

      // --- windows with green shutters ---
      const winW = 8, winH = 8;
      // left window
      const lwx = x - 18, lwy = y - 20;
cx.fillStyle = hexLerp('#3d3327', '#ffd87a', curPC.night);
      cx.fillRect(lwx, lwy, winW, winH);
      // window cross-frame
      cx.strokeStyle = '#5e3a1e'; cx.lineWidth = 0.8;
      cx.beginPath(); cx.moveTo(lwx + winW / 2, lwy); cx.lineTo(lwx + winW / 2, lwy + winH); cx.stroke();
      cx.beginPath(); cx.moveTo(lwx, lwy + winH / 2); cx.lineTo(lwx + winW, lwy + winH / 2); cx.stroke();
      // left shutters (green)
      cx.fillStyle = '#4a8a3a';
      cx.fillRect(lwx - 3, lwy, 3, winH);
      cx.fillRect(lwx + winW, lwy, 3, winH);

      // right window
      const rwx = x + 10, rwy = y - 20;
cx.fillStyle = hexLerp('#3d3327', '#ffd87a', curPC.night);
      cx.fillRect(rwx, rwy, winW, winH);
      cx.strokeStyle = '#5e3a1e'; cx.lineWidth = 0.8;
      cx.beginPath(); cx.moveTo(rwx + winW / 2, rwy); cx.lineTo(rwx + winW / 2, rwy + winH); cx.stroke();
      cx.beginPath(); cx.moveTo(rwx, rwy + winH / 2); cx.lineTo(rwx + winW, rwy + winH / 2); cx.stroke();
      // right shutters (green)
      cx.fillStyle = '#4a8a3a';
      cx.fillRect(rwx - 3, rwy, 3, winH);
      cx.fillRect(rwx + winW, rwy, 3, winH);

      // --- flower box under right window ---
      cx.fillStyle = '#6b4a2c';
      cx.fillRect(rwx - 2, rwy + winH + 1, winW + 4, 3);
      // little red flowers
      cx.fillStyle = '#d94060';
      cx.fillRect(rwx, rwy + winH + 0, 2, 2);
      cx.fillRect(rwx + 3, rwy + winH - 1, 2, 2);
      cx.fillRect(rwx + 6, rwy + winH + 0, 2, 2);
      // green leaves
      cx.fillStyle = '#3a7a2a';
      cx.fillRect(rwx + 1, rwy + winH + 1, 1, 1);
      cx.fillRect(rwx + 5, rwy + winH + 1, 1, 1);

      // --- door (center) ---
      cx.fillStyle = '#5a3a20';
      cx.fillRect(x - 4, y - 16, 9, 16);
      // door frame
      cx.strokeStyle = '#4a2a12'; cx.lineWidth = 0.8;
      cx.strokeRect(x - 4, y - 16, 9, 16);
      // door handle
      cx.fillStyle = '#c9b46a';
      cx.fillRect(x + 3, y - 9, 1.5, 2);

      // --- bench on the left side ---
      cx.fillStyle = '#7a5a39';
      cx.fillRect(x - hw - 4, y - 6, 12, 2); // seat
      cx.fillRect(x - hw - 2, y - 4, 2, 4);  // left leg
      cx.fillRect(x - hw + 4, y - 4, 2, 4);  // right leg

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
      // Dirt/base mound around the bunker
      cx.fillStyle = '#6e6153';
      cx.beginPath();
      cx.ellipse(x, y, 22, 3.5, 0, 0, 7);
      cx.fill();

      // Main concrete bunker structure (weather-worn dark concrete)
      cx.fillStyle = '#7a7870';
      cx.beginPath();
      cx.moveTo(x - 18, y);
      cx.lineTo(x - 18, y - 16);
      cx.quadraticCurveTo(x, y - 30, x + 18, y - 16);
      cx.lineTo(x + 18, y);
      cx.closePath(); cx.fill();

      // Shadow side (left/bottom curve shading)
      cx.fillStyle = '#5c5a53';
      cx.beginPath();
      cx.moveTo(x - 18, y);
      cx.lineTo(x - 18, y - 16);
      cx.quadraticCurveTo(x - 6, y - 25, x, y - 18);
      cx.lineTo(x, y);
      cx.closePath(); cx.fill();

      // Concrete forming board lines (shuttering textures, horizontal)
      cx.strokeStyle = '#4e4c47'; cx.lineWidth = 0.6;
      for (let ly = -24; ly <= 0; ly += 4) {
        cx.beginPath();
        // project coordinates along the dome curvature
        const leftX = ly < -16 ? -18 * Math.sqrt(1 - Math.pow((-ly - 16) / 14, 2)) : -18;
        const rightX = ly < -16 ? 18 * Math.sqrt(1 - Math.pow((-ly - 16) / 14, 2)) : 18;
        cx.moveTo(x + leftX, y + ly);
        cx.lineTo(x + rightX, y + ly);
        cx.stroke();
      }

      // Concrete outline/border
      cx.strokeStyle = '#3a3934'; cx.lineWidth = 1;
      cx.beginPath();
      cx.moveTo(x - 18, y);
      cx.lineTo(x - 18, y - 16);
      cx.quadraticCurveTo(x, y - 30, x + 18, y - 16);
      cx.lineTo(x + 18, y);
      cx.closePath(); cx.stroke();

      // Overgrown moss and grass on the roof dome
      cx.fillStyle = '#6e8550'; // moss green
      cx.beginPath();
      cx.moveTo(x - 14, y - 20);
      cx.quadraticCurveTo(x, y - 32, x + 14, y - 20);
      cx.quadraticCurveTo(x + 8, y - 22, x, y - 24);
      cx.quadraticCurveTo(x - 8, y - 22, x - 14, y - 20);
      cx.closePath(); cx.fill();
      
      // Individual blades of wild mountain grass on top
      cx.fillStyle = '#8fa37a';
      cx.beginPath();
      cx.moveTo(x - 4, y - 26); cx.lineTo(x - 6, y - 30); cx.lineTo(x - 2, y - 26);
      cx.moveTo(x + 2, y - 27); cx.lineTo(x + 1, y - 31); cx.lineTo(x + 4, y - 27);
      cx.fill();

      // Deep dark recessed doorway
      cx.fillStyle = '#1c1b18';
      cx.fillRect(x - 5, y - 14, 10, 14);
      // Door frame stroke
      cx.strokeStyle = '#2c2a25'; cx.lineWidth = 0.8;
      cx.strokeRect(x - 5, y - 14, 10, 14);

      // Gun slits (viewports)
      cx.fillStyle = '#1a1917'; // inside of slits
      cx.fillRect(x - 13, y - 18, 6, 3);
      cx.fillRect(x + 7, y - 18, 6, 3);
      // Rusty iron plate surrounds for the slits
      cx.strokeStyle = '#6b4731'; cx.lineWidth = 0.6;
      cx.strokeRect(x - 13, y - 18, 6, 3);
      cx.strokeRect(x + 7, y - 18, 6, 3);

      // A small crack in the concrete dome
      cx.strokeStyle = '#2c2a25'; cx.lineWidth = 0.5;
      cx.beginPath();
      cx.moveTo(x - 10, y - 10);
      cx.lineTo(x - 7, y - 6);
      cx.lineTo(x - 8, y - 2);
      cx.stroke();

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
      cx.strokeStyle = hexLerp('#8a6f4d', '#e8c84f', curPC.dawn); cx.lineWidth = 4;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y - 40); cx.moveTo(x - 12, y - 30); cx.lineTo(x + 12, y - 30); cx.stroke();
      if (curPC.dawn > 0.01) {
        cx.fillStyle = `rgba(255,200,90,${0.25 * curPC.dawn})`;
        cx.beginPath(); cx.arc(x, y - 30, 26, 0, 7); cx.fill();
      }
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
      if (e.gear === 'glider' && !G.flags.finale) return;
      const gy = y - 10 + bob;
      cx.fillStyle = 'rgba(255,255,255,0.2)'; cx.beginPath(); cx.arc(x, gy, 10, 0, 7); cx.fill();
      if (e.gear === 'boots') {
        const bx1 = x - 6;
        const by1 = gy;
        
        // Rugged Vibram sole
        cx.fillStyle = '#212121';
        cx.beginPath();
        cx.moveTo(bx1 - 1, by1 + 5.5);
        cx.lineTo(bx1 + 10, by1 + 5.5);
        cx.lineTo(bx1 + 10, by1 + 7);
        cx.lineTo(bx1 - 1, by1 + 7);
        cx.closePath(); cx.fill();
        
        // Sole tread marks
        cx.fillStyle = '#0a0a0a';
        cx.fillRect(bx1, by1 + 6.5, 2, 0.7);
        cx.fillRect(bx1 + 4, by1 + 6.5, 2, 0.7);
        cx.fillRect(bx1 + 7, by1 + 6.5, 2, 0.7);

        // Boot body
        cx.fillStyle = '#7a4a26';
        cx.beginPath();
        cx.moveTo(bx1, by1 + 5.5);
        cx.quadraticCurveTo(bx1 - 1, by1 + 1, bx1, by1 - 3); // heel to collar
        cx.lineTo(bx1 + 4.5, by1 - 3);                       // collar top
        cx.quadraticCurveTo(bx1 + 4, by1 + 1, bx1 + 6, by1 + 2); // collar to tongue
        cx.quadraticCurveTo(bx1 + 10.2, by1 + 2.5, bx1 + 9.8, by1 + 5.5); // toe box
        cx.closePath(); cx.fill();

        // Boot highlights
        cx.fillStyle = '#9c6239';
        cx.beginPath(); cx.arc(bx1 + 8.5, by1 + 4.2, 1.3, 0, 7); cx.fill(); // toe highlights
        cx.beginPath(); cx.arc(bx1 + 0.8, by1 + 4.5, 1.2, 0, 7); cx.fill(); // heel highlights
        
        // Inner collar lining
        cx.fillStyle = '#4a2e16';
        cx.fillRect(bx1 + 0.8, by1 - 2.8, 3, 0.8);

        // Red laces
        cx.strokeStyle = '#c0392b'; cx.lineWidth = 0.8;
        cx.beginPath();
        cx.moveTo(bx1 + 3, by1 - 1.5); cx.lineTo(bx1 + 5.2, by1 + 0.5);
        cx.moveTo(bx1 + 5.2, by1 - 1.5); cx.lineTo(bx1 + 3, by1 + 0.5);
        cx.moveTo(bx1 + 3, by1 + 0.5); cx.lineTo(bx1 + 6, by1 + 2.5);
        cx.stroke();
        
        // Loops
        cx.fillStyle = '#c0392b';
        cx.beginPath();
        cx.arc(bx1 + 2.5, by1 - 1.5, 0.6, 0, 7);
        cx.arc(bx1 + 5.7, by1 - 1.5, 0.6, 0, 7);
        cx.fill();
      } else if (e.gear === 'lamp') {
        // Detailed woven headband strap (dark charcoal with a vibrant blue-cyan stripe)
        cx.strokeStyle = '#2c2e33'; cx.lineWidth = 2.2;
        cx.beginPath(); cx.ellipse(x, gy + 1, 9.5, 3.8, 0, 0, 2 * Math.PI); cx.stroke();
        cx.strokeStyle = '#3498db'; cx.lineWidth = 0.8;
        cx.beginPath(); cx.ellipse(x, gy + 1, 9.5, 3.8, 0, 0, 2 * Math.PI); cx.stroke();
        
        // Strap adjustment buckles on the left and right sides
        cx.fillStyle = '#7f8c8d';
        cx.fillRect(x - 8.5, gy - 0.5, 1.2, 3);
        cx.fillRect(x + 7.3, gy - 0.5, 1.2, 3);

        // Black mounting bracket behind the housing
        cx.fillStyle = '#1e2022'; cx.fillRect(x - 6, gy - 3.5, 12, 7);

        // Main lamp housing (slate-grey with rounded corners)
        cx.fillStyle = '#4a4e55';
        roundRect(x - 4.5, gy - 4.5, 9, 9, 1.5); cx.fill();
        
        // Red power button on top
        cx.fillStyle = '#e74c3c'; cx.fillRect(x - 2, gy - 5.5, 4, 1.2);

        // Chrome reflector/bezel on the front
        cx.fillStyle = '#bdc3c7'; cx.beginPath(); cx.arc(x + 1.2, gy + 0.5, 3, 0, 7); cx.fill();

        // Bright LED lens/bulb
        cx.fillStyle = '#ffe27a'; cx.beginPath(); cx.arc(x + 1.2, gy + 0.5, 1.8, 0, 7); cx.fill();

        // Pulsing yellow glow aura
        cx.fillStyle = 'rgba(255,226,122,0.3)'; cx.beginPath(); cx.arc(x + 1.2, gy + 0.5, 6.5 + bob, 0, 7); cx.fill();

        // Translucent headlight beam to the right (dynamic light rays)
        cx.fillStyle = 'rgba(255,226,122,0.18)';
        cx.beginPath();
        cx.moveTo(x + 3.2, gy - 1.5);
        cx.lineTo(x + 11.5, gy - 5);
        cx.lineTo(x + 11.5, gy + 6);
        cx.lineTo(x + 3.2, gy + 2.5);
        cx.closePath(); cx.fill();
      } else if (e.gear === 'kit') {
        cx.strokeStyle = '#e07b30'; cx.lineWidth = 2.5;
        cx.beginPath(); cx.arc(x - 3, gy, 4, 0, 7); cx.stroke();
        cx.beginPath(); cx.arc(x + 4, gy + 2, 3.5, 0, 7); cx.stroke();
        cx.strokeStyle = '#c9c9c9'; cx.beginPath(); cx.moveTo(x - 3, gy - 6); cx.lineTo(x + 4, gy - 2); cx.stroke();
      } else if (e.gear === 'glider') {
        // Red canopy arc
        cx.fillStyle = '#c0392b';
        cx.beginPath();
        cx.moveTo(x - 8, gy + 2);
        cx.quadraticCurveTo(x, gy - 9, x + 8, gy + 2);
        cx.quadraticCurveTo(x, gy - 3, x - 8, gy + 2);
        cx.closePath(); cx.fill();
        
        // Cream stripe
        cx.fillStyle = '#e8e4d0';
        cx.beginPath();
        cx.moveTo(x - 3, gy - 1.5);
        cx.quadraticCurveTo(x, gy - 5, x + 3, gy - 1.5);
        cx.quadraticCurveTo(x, gy - 3.5, x - 3, gy - 1.5);
        cx.closePath(); cx.fill();
        
        // Strings/Lines
        cx.strokeStyle = 'rgba(230,235,240,0.8)'; cx.lineWidth = 0.8;
        cx.beginPath();
        cx.moveTo(x - 7, gy + 1); cx.lineTo(x, gy + 5);
        cx.moveTo(x + 7, gy + 1); cx.lineTo(x, gy + 5);
        cx.stroke();
        
        // Small backpack/pack at the center
        cx.fillStyle = '#a06a2c'; // leather color
        cx.fillRect(x - 2.5, gy + 3, 5, 4);
      }
      break;
    }
    case 'page': {
      if (taken || e.hide) return;
      const py = y - 12 + bob;
      
      // Glowing aura: pulsing and soft
      const pulse = Math.sin(frame * 0.08 + e.x) * 1.5;
      cx.fillStyle = 'rgba(255, 235, 150, 0.12)';
      cx.beginPath(); cx.arc(x, py, 13 + pulse, 0, 7); cx.fill();
      cx.fillStyle = 'rgba(255, 250, 210, 0.22)';
      cx.beginPath(); cx.arc(x, py, 9 + pulse * 0.5, 0, 7); cx.fill();
      
      // Floating sparkles
      cx.fillStyle = '#fff';
      const sp1 = (frame * 0.03 + e.x) % 6.28;
      const sp2 = (frame * 0.045 + e.x * 2) % 6.28;
      cx.fillRect(x + Math.cos(sp1) * 9 - 0.5, py + Math.sin(sp1 * 1.5) * 7 - 0.5, 1, 1);
      cx.fillRect(x + Math.sin(sp2) * 7 - 0.5, py + Math.cos(sp2 * 2) * 9 - 0.5, 1, 1);
      
      cx.save();
      cx.translate(x, py);
      cx.rotate(Math.sin(frame * 0.04 + e.x) * 0.15);
      
      // Page shadow
      cx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      cx.fillRect(-4.5, -6.5, 10, 14);

      // Main paper sheet (warm aged parchment color)
      cx.fillStyle = '#fdfbf0';
      cx.fillRect(-5, -7, 10, 14);
      
      // Aged paper borders
      cx.strokeStyle = '#b9ac82'; cx.lineWidth = 0.6;
      cx.strokeRect(-5, -7, 10, 14);

      // Red notebook margin line
      cx.strokeStyle = 'rgba(192, 57, 43, 0.35)'; cx.lineWidth = 0.4;
      cx.beginPath(); cx.moveTo(-3, -7); cx.lineTo(-3, 7); cx.stroke();

      // Written text lines (dark grey/brown pencil text lines)
      cx.strokeStyle = '#5c5440'; cx.lineWidth = 0.5;
      for (let i = -5; i <= 5; i += 2.2) {
        cx.beginPath();
        cx.moveTo(-2, i);
        cx.lineTo(3.5, i);
        cx.stroke();
      }

      // Small sketch scribble in bottom-left corner
      cx.strokeStyle = '#7f6b4d'; cx.lineWidth = 0.4;
      cx.beginPath();
      cx.moveTo(1.5, 2.5); cx.lineTo(3, 4); cx.lineTo(2, 5);
      cx.stroke();

      // Curled corner overlay (bottom right)
      cx.fillStyle = '#dbce9f';
      cx.beginPath();
      cx.moveTo(3, 7); cx.lineTo(5, 5); cx.lineTo(5, 7);
      cx.closePath(); cx.fill();
      cx.strokeStyle = '#b9ac82'; cx.lineWidth = 0.4;
      cx.beginPath(); cx.moveTo(3, 7); cx.lineTo(5, 5); cx.stroke();

      cx.restore();
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
      // the sock streams with the live valley breeze, fluttering a little
      const wind = Math.max(0.18, Math.min(1, valleyWind + Math.sin(frame * 0.12 + e.x) * 0.08));
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
      const face = e.face || 1;
      cx.save();
      cx.translate(x, y);
      cx.scale(face, 1);
      const px2 = 0, py2 = 0;
      const swing = (e.vx && Math.abs(e.vx) > 0.005) ? Math.sin(frame * 0.22) * 1.5 : 0;

      if (e.who === 'vera') {
        // Legs & boots
        cx.fillStyle = '#3d3327';
        cx.fillRect(px2 - 4 + swing, py2 - 5, 2.6, 5);
        cx.fillRect(px2 + 1.4 - swing, py2 - 5, 2.6, 5);
        cx.fillStyle = '#231e17'; // soles
        cx.fillRect(px2 - 4.5 + swing, py2 - 1.5, 3.5, 1.2);
        cx.fillRect(px2 + 1 - swing, py2 - 1.5, 3.5, 1.2);
        
        // Body / Jumpsuit
        cx.fillStyle = '#b8483a'; // deep rust-red
        cx.beginPath();
        cx.moveTo(px2 - 5, py2 - 16);
        cx.lineTo(px2 + 5, py2 - 16);
        cx.quadraticCurveTo(px2 + 5.5, py2 - 10, px2 + 5, py2 - 5);
        cx.lineTo(px2 - 5, py2 - 5);
        cx.quadraticCurveTo(px2 - 5.5, py2 - 10, px2 - 5, py2 - 16);
        cx.closePath(); cx.fill();
        // Suit zipper line
        cx.strokeStyle = '#982c1f'; cx.lineWidth = 0.6;
        cx.beginPath(); cx.moveTo(px2, py2 - 16); cx.lineTo(px2, py2 - 5); cx.stroke();
        // Belt
        cx.fillStyle = '#333';
        cx.fillRect(px2 - 5.2, py2 - 9, 10.4, 1.2);
        
        // Head
        cx.fillStyle = '#e8b88a';
        cx.beginPath(); cx.arc(px2, py2 - 20, 4.5, 0, 7); cx.fill();
        
        // Hair peeking
        cx.fillStyle = '#4a3e2c';
        cx.fillRect(px2 - 4.5, py2 - 19.5, 1.2, 3);
        cx.fillRect(px2 + 3.3, py2 - 19.5, 1.2, 3);
        
        // Helmet
        cx.fillStyle = '#fff';
        cx.beginPath(); cx.arc(px2, py2 - 22.5, 4.4, Math.PI, 0); cx.fill();
        // Helmet chin strap hint
        cx.strokeStyle = '#222'; cx.lineWidth = 0.5;
        cx.beginPath(); cx.moveTo(px2 - 4, py2 - 21); cx.lineTo(px2 - 3, py2 - 17.5); cx.stroke();

        // Aviator sunglasses
        cx.strokeStyle = '#444'; cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(px2 - 3.5, py2 - 21); cx.lineTo(px2 + 3.5, py2 - 21); cx.stroke();
        cx.fillStyle = '#222';
        cx.fillRect(px2 - 3.2, py2 - 21.8, 2, 1.5);
        cx.fillRect(px2 + 1.2, py2 - 21.8, 2, 1.5);
      }
      if (e.who === 'greta') {
        // Legs & sturdy shoes
        cx.fillStyle = '#3d3327';
        cx.fillRect(px2 - 4 + swing, py2 - 5, 3, 5);
        cx.fillRect(px2 + 1 - swing, py2 - 5, 3, 5);
        // Shoe soles
        cx.fillStyle = '#231e17';
        cx.fillRect(px2 - 5 + swing, py2 - 1.5, 4.5, 1.2);
        cx.fillRect(px2 + 0.5 - swing, py2 - 1.5, 4.5, 1.2);
        
        // Body / plum-purple blouse
        cx.fillStyle = '#6f5a7d';
        cx.beginPath();
        cx.moveTo(px2 - 5, py2 - 16);
        cx.lineTo(px2 + 5, py2 - 16);
        cx.quadraticCurveTo(px2 + 5.5, py2 - 10, px2 + 5, py2 - 5);
        cx.lineTo(px2 - 5, py2 - 5);
        cx.quadraticCurveTo(px2 - 5.5, py2 - 10, px2 - 5, py2 - 16);
        cx.closePath(); cx.fill();

        // Knitted shawl draped over shoulders
        cx.fillStyle = '#8f79a3';
        cx.beginPath();
        cx.moveTo(px2 - 5, py2 - 15);
        cx.lineTo(px2 + 5, py2 - 15);
        cx.quadraticCurveTo(px2, py2 - 10, px2 - 5, py2 - 9);
        cx.closePath(); cx.fill();

        // White collar peek
        cx.fillStyle = '#fff';
        cx.beginPath();
        cx.moveTo(px2 - 1.5, py2 - 16);
        cx.lineTo(px2 + 1.5, py2 - 16);
        cx.lineTo(px2, py2 - 13.5);
        cx.closePath(); cx.fill();

        // Head
        cx.fillStyle = '#e8b88a';
        cx.beginPath(); cx.arc(px2, py2 - 20, 4.5, 0, 7); cx.fill();

        // Hair (silver-grey bun & side sweeps)
        cx.fillStyle = '#cfcfcf';
        cx.beginPath(); cx.arc(px2, py2 - 21.2, 4.7, Math.PI, 0); cx.fill();
        cx.beginPath(); cx.arc(px2, py2 - 25.5, 2.5, 0, 7); cx.fill();
        // Hair pin
        cx.strokeStyle = '#d9a13d'; cx.lineWidth = 0.5;
        cx.beginPath(); cx.moveTo(px2 - 3, py2 - 26); cx.lineTo(px2 + 2, py2 - 24); cx.stroke();

        // Glasses
        cx.strokeStyle = '#d9a13d'; cx.lineWidth = 0.5;
        cx.beginPath(); cx.arc(px2 + 1.5, py2 - 20, 1.2, 0, 7); cx.stroke();

        // Eye
        cx.fillStyle = '#2c2a25';
        cx.fillRect(px2 + 1.5, py2 - 20.5, 1, 1);
      }

      if (e.who === 'norbert') {
        // Legs & boots
        cx.fillStyle = '#3d3327';
        cx.fillRect(px2 - 4.5 + swing, py2 - 5, 3, 5);
        cx.fillRect(px2 + 1.5 - swing, py2 - 5, 3, 5);
        // Boot soles
        cx.fillStyle = '#231e17';
        cx.fillRect(px2 - 5.5 + swing, py2 - 1.5, 4.5, 1.2);
        cx.fillRect(px2 + 0.5 - swing, py2 - 1.5, 4.5, 1.2);
        
        // Body / Moss-green loden jacket
        cx.fillStyle = '#3f5e3a';
        cx.beginPath();
        cx.moveTo(px2 - 5.5, py2 - 16);
        cx.lineTo(px2 + 5.5, py2 - 16);
        cx.quadraticCurveTo(px2 + 6, py2 - 10, px2 + 5.5, py2 - 5);
        cx.lineTo(px2 - 5.5, py2 - 5);
        cx.quadraticCurveTo(px2 - 6, py2 - 10, px2 - 5.5, py2 - 16);
        cx.closePath(); cx.fill();
        
        // Blue work apron tied over it
        cx.fillStyle = '#2b3a66';
        cx.fillRect(px2 - 4, py2 - 11, 8, 7.5);
        // Apron tie string around waist
        cx.strokeStyle = '#1d2747'; cx.lineWidth = 0.6;
        cx.beginPath(); cx.moveTo(px2 - 5.5, py2 - 10); cx.lineTo(px2 + 5.5, py2 - 10); cx.stroke();
        // Apron strap around neck
        cx.beginPath(); cx.moveTo(px2 - 2, py2 - 15); cx.lineTo(px2 - 2, py2 - 11); cx.stroke();
        cx.beginPath(); cx.moveTo(px2 + 2, py2 - 15); cx.lineTo(px2 + 2, py2 - 11); cx.stroke();

        // Head
        cx.fillStyle = '#e8b88a';
        cx.beginPath(); cx.arc(px2, py2 - 20, 4.8, 0, 7); cx.fill();

        // Tyrolean loden beard/mustache (#4a3e2c)
        cx.fillStyle = '#4a3e2c';
        cx.fillRect(px2 - 3.5, py2 - 19, 7, 2.5); // beard
        cx.fillRect(px2 - 2.5, py2 - 17, 5, 2.5); // chin beard
        
        // Eyes
        cx.fillStyle = '#2c2a25';
        cx.fillRect(px2 + 1.2, py2 - 20.5, 1, 1);

        // Tyrolean hat (olive green)
        cx.fillStyle = '#4a5e3a';
        cx.fillRect(px2 - 6, py2 - 25, 12, 2); // brim
        cx.fillRect(px2 - 4, py2 - 28, 8, 4); // crown
        // Red feather
        cx.fillStyle = '#d9577a';
        cx.beginPath();
        cx.moveTo(px2 + 3, py2 - 29);
        cx.lineTo(px2 + 4.5, py2 - 25);
        cx.lineTo(px2 + 3, py2 - 25);
        cx.closePath(); cx.fill();
      }
      cx.restore();
      break;
    }
    case 'dog': {
      if (e.present === false) return;
      const wag = Math.sin(frame * 0.3) * 3;
      const face = e.face || 1;
      cx.save();
      cx.translate(x, y);
      cx.scale(face, 1);
      
      const swing = (e.vx && Math.abs(e.vx) > 0.005) ? Math.sin(frame * 0.25) * 1.5 : 0;

      // Legs
      cx.fillStyle = '#8a6a44';
      cx.fillRect(-5.5 + swing, -3, 2, 3);
      cx.fillRect(3.5 - swing, -3, 2, 3);
      // Dark paws
      cx.fillStyle = '#6b4f30';
      cx.fillRect(-6 + swing, -1, 2.5, 1.2);
      cx.fillRect(3 - swing, -1, 2.5, 1.2);

      // Body (warm tawny-brown)
      cx.fillStyle = '#8a6a44';
      cx.fillRect(-7, -8, 13, 5.5);
      
      // Cream belly patch
      cx.fillStyle = '#c8a880';
      cx.fillRect(-4, -4.5, 8, 2);

      // Leather collar (dark brown) & small gold bell tag
      cx.fillStyle = '#4a3826';
      cx.fillRect(4, -8.2, 1.8, 3.2);
      cx.fillStyle = '#d9a13d';
      cx.beginPath(); cx.arc(4.9, -5, 0.9, 0, 7); cx.fill();

      // Head
      cx.fillStyle = '#8a6a44';
      cx.beginPath(); cx.arc(7, -8, 3.8, 0, 7); cx.fill();
      
      // Ears: left floppy, right pointed up
      cx.fillStyle = '#6b4f30'; // darker brown ears
      cx.fillRect(8.5, -12, 1.8, 3.5); // ear up
      cx.beginPath(); // floppy ear down
      cx.moveTo(5, -10);
      cx.lineTo(3.8, -7);
      cx.lineTo(6, -8);
      cx.closePath(); cx.fill();
      
      // Tail
      cx.strokeStyle = '#8a6a44'; cx.lineWidth = 2.2;
      cx.beginPath(); cx.moveTo(-7, -7); cx.lineTo(-11, -9.5 + wag); cx.stroke();
      
      cx.restore();
      break;
    }
    case 'cow': {
      const face = e.face || 1;
      cx.save();
      cx.translate(x, y);
      cx.scale(face, 1);
      
      const swing = (e.vx && Math.abs(e.vx) > 0.005) ? Math.sin(frame * 0.18) * 1.2 : 0;

      // Legs (sturdier structure with defined hooves)
      cx.fillStyle = '#3d3327';
      cx.fillRect(-10 + swing, -5, 3, 5);
      cx.fillRect(-2 - swing, -5, 3, 5);
      cx.fillRect(6 + swing, -5, 3, 5);
      // Hooves (dark slate/grey)
      cx.fillStyle = '#1c1b18';
      cx.fillRect(-10.5 + swing, -1.5, 4, 1.5);
      cx.fillRect(-2.5 - swing, -1.5, 4, 1.5);
      cx.fillRect(5.5 + swing, -1.5, 4, 1.5);

      // Boxy body (warm tawny-brown)
      cx.fillStyle = '#9a6f4a';
      cx.fillRect(-12, -14, 24, 9.5);
      
      // Cream-white patch on flank
      cx.fillStyle = '#e8e0cd';
      cx.beginPath();
      cx.moveTo(-4, -14);
      cx.lineTo(3, -14);
      cx.quadraticCurveTo(3, -9, 3, -4.5);
      cx.lineTo(-3, -4.5);
      cx.quadraticCurveTo(-3, -9, -4, -14);
      cx.closePath(); cx.fill();

      // Neck
      cx.fillStyle = '#9a6f4a';
      cx.fillRect(10, -17, 3.5, 6);

      // Head
      cx.beginPath(); cx.arc(14, -14, 4.5, 0, 7); cx.fill();
      // Snout (cream-white)
      cx.fillStyle = '#d8c9a8';
      cx.beginPath(); cx.ellipse(15.5, -12.5, 2.8, 1.8, 0, 0, 7); cx.fill();

      // Ears (point sideways/down)
      cx.fillStyle = '#9a6f4a';
      cx.beginPath(); cx.ellipse(11.2, -14.5, 2.5, 1, -0.4, 0, 7); cx.fill();

      // Off-white horns
      cx.fillStyle = '#d8d2bd';
      cx.fillRect(11, -20, 1.8, 4.2);
      cx.fillRect(15.5, -20, 1.8, 4.2);
      
      // Bell collar (leather strap) & cowbell
      cx.fillStyle = '#3d3327'; // leather strap
      cx.fillRect(10.5, -12.2, 1.6, 4.2);
      cx.fillStyle = '#c9b46a'; // cowbell
      cx.fillRect(9.5, -8, 3.6, 3.6);
      cx.fillStyle = '#d9a13d'; // clapper
      cx.fillRect(11, -4.4, 0.8, 1);
      
      cx.restore();
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
        
        // Body (sandy-gold fur #b08a55)
        cx.fillStyle = '#b08a55';
        cx.fillRect(x - 4, y - 11.5 + up, 8, 10.5);
        
        // head
        cx.beginPath(); cx.arc(x, y - 12.8 + up, 3.8, 0, 7); cx.fill();
        
        // belly (pale cream #d8c9a8)
        cx.fillStyle = '#d8c9a8';
        cx.fillRect(x - 2.2, y - 6 + up, 4.4, 4);
        
        // paws (resting on belly)
        cx.fillStyle = '#9e7945';
        cx.fillRect(x - 3.2, y - 7.5 + up, 1.2, 1.8);
        cx.fillRect(x + 2, y - 7.5 + up, 1.2, 1.8);

        // tiny ears
        cx.fillStyle = '#9e7945';
        cx.beginPath(); cx.arc(x - 3, y - 15.5 + up, 1, 0, 7); cx.fill();
        cx.beginPath(); cx.arc(x + 3, y - 15.5 + up, 1, 0, 7); cx.fill();

        // eye
        cx.fillStyle = '#2c2a25';
        cx.fillRect(x + 1, y - 13.8 + up, 1, 1);
        
        // nose
        cx.fillRect(x + 2.5, y - 12.8 + up, 0.8, 0.8);

        if (greeting) { // tiny raised waving paw
          cx.fillStyle = '#b08a55';
          cx.fillRect(x + 4, y - 14 + up, 2, 3.8);
          cx.fillStyle = '#d8c9a8';
          cx.fillRect(x + 4, y - 15.2 + up, 2, 1.2); // paw tip
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
  const jacketColor = G.gear.jacket ? '#c0392b' : '#2e7d6b';
  const jacketDark = G.gear.jacket ? '#a93226' : '#246355';
  const jacketLight = G.gear.jacket ? '#d04a3d' : '#3a9980';
  const bootColor = G.gear.boots ? '#7a4a26' : '#888';
  const bootSole = G.gear.boots ? '#4a2e16' : '#555';
  const bootHighlight = G.gear.boots ? '#9a6a3a' : '#aaa';

  if (p.grounded && !p.climbing && !p.gliding)
    groundShadow(p.x + p.w / 2 - cam.x, p.y + p.h - cam.y, p.w * 0.6, 0.22);

  cx.save();
  cx.translate(x, y + 10);
  // squash on landing, stretch in fast air
  let sy = 1;
  if (p.landT > 0) sy = 1 - (p.landT / 9) * 0.16;
  else if (!p.grounded && !p.climbing && Math.abs(p.vy) > 5 && !p.gliding) sy = 1.08;
  if (p.sliding === 2) sy = Math.min(sy, 0.84); // crouch low into the scree-run
  cx.scale((p.face === -1 ? -1 : 1) * (2 - sy), sy);
  cx.translate(0, -10);

  // === LEGS (dark slate-blue trousers, slightly baggy, cuffed) ===
  const legL = p.climbing ? 0 : (p.grounded ? leg * 0.5 : 0);
  const legR = p.climbing ? 0 : (p.grounded ? -leg * 0.5 : 0);
  const legLy = p.climbing ? 13 : (!p.grounded && !p.swim ? 13 : 14);
  const legRy = p.climbing ? 11 : (!p.grounded && !p.swim ? 14 : 14);
  const legH = p.climbing ? 7 : (!p.grounded && !p.swim ? 7 : 7);
  // left leg
  cx.fillStyle = '#41475c';
  cx.beginPath();
  cx.moveTo(-4.5 + legL, legLy);
  cx.lineTo(-1.5 + legL, legLy);
  cx.lineTo(-1 + legL, legLy + legH - 1.5);
  cx.lineTo(-1.5 + legL, legLy + legH);
  cx.lineTo(-5 + legL, legLy + legH);
  cx.lineTo(-5.5 + legL, legLy + legH - 1.5);
  cx.closePath(); cx.fill();
  // right leg
  cx.beginPath();
  cx.moveTo(1 + legR, legRy);
  cx.lineTo(4 + legR, legRy);
  cx.lineTo(4.5 + legR, legRy + legH - 1.5);
  cx.lineTo(4 + legR, legRy + legH);
  cx.lineTo(0.5 + legR, legRy + legH);
  cx.lineTo(0 + legR, legRy + legH - 1.5);
  cx.closePath(); cx.fill();
  // trouser cuff highlights
  cx.fillStyle = '#4d536a';
  cx.fillRect(-5 + legL, legLy + legH - 1.5, 4.5, 1.5);
  cx.fillRect(0.5 + legR, legRy + legH - 1.5, 4.5, 1.5);
  // inner seam hint
  cx.strokeStyle = '#363b4d'; cx.lineWidth = 0.4;
  cx.beginPath();
  cx.moveTo(-2.5 + legL, legLy + 1); cx.lineTo(-2.5 + legL, legLy + legH - 1);
  cx.moveTo(2 + legR, legRy + 1); cx.lineTo(2 + legR, legRy + legH - 1);
  cx.stroke();

  // === BOOTS / SHOES ===
  const bLx = -5 + (p.grounded ? leg * 0.5 : 0);
  const bRx = 0.5 - (p.grounded ? leg * 0.5 : 0);
  const bY = p.climbing ? 19 : (!p.grounded && !p.swim ? 19 : 19.5);
  // shoe body
  cx.fillStyle = bootColor;
  cx.beginPath();
  cx.moveTo(bLx, bY); cx.lineTo(bLx + 5.5, bY); cx.lineTo(bLx + 6, bY + 1.2);
  cx.lineTo(bLx + 5.5, bY + 2.8); cx.lineTo(bLx - 0.5, bY + 2.8); cx.lineTo(bLx - 0.5, bY + 0.5);
  cx.closePath(); cx.fill();
  cx.beginPath();
  cx.moveTo(bRx, bY); cx.lineTo(bRx + 5.5, bY); cx.lineTo(bRx + 6, bY + 1.2);
  cx.lineTo(bRx + 5.5, bY + 2.8); cx.lineTo(bRx - 0.5, bY + 2.8); cx.lineTo(bRx - 0.5, bY + 0.5);
  cx.closePath(); cx.fill();
  // sole
  cx.fillStyle = bootSole;
  cx.fillRect(bLx - 0.5, bY + 2.2, 6.5, 1);
  cx.fillRect(bRx - 0.5, bY + 2.2, 6.5, 1);
  // lace/highlight
  cx.fillStyle = bootHighlight;
  cx.fillRect(bLx + 1, bY + 0.3, 2.5, 0.6);
  cx.fillRect(bRx + 1, bY + 0.3, 2.5, 0.6);

  // === BODY / JACKET (layered construction with hood, collar, zipper) ===
  const jY = 4 + breathe;
  // main jacket body — slightly rounded shape
  cx.fillStyle = jacketColor;
  cx.beginPath();
  cx.moveTo(-5.5, jY + 1);
  cx.lineTo(-5.5, jY + 10);
  cx.quadraticCurveTo(-5.5, jY + 11.5, -4, jY + 11.5);
  cx.lineTo(4, jY + 11.5);
  cx.quadraticCurveTo(5.5, jY + 11.5, 5.5, jY + 10);
  cx.lineTo(5.5, jY + 1);
  cx.quadraticCurveTo(5.5, jY, 4.5, jY);
  cx.lineTo(-4.5, jY);
  cx.quadraticCurveTo(-5.5, jY, -5.5, jY + 1);
  cx.closePath(); cx.fill();
  // jacket lower hem — slightly darker band
  cx.fillStyle = jacketDark;
  cx.fillRect(-5, jY + 9.5, 10.5, 2);
  // zipper line
  cx.strokeStyle = jacketDark; cx.lineWidth = 0.7;
  cx.beginPath(); cx.moveTo(0.5, jY + 0.5); cx.lineTo(0.5, jY + 11); cx.stroke();
  // zipper pull
  cx.fillStyle = '#ccc'; cx.fillRect(0, jY + 2, 1.2, 1.5);
  // collar / hood peeking up behind head
  cx.fillStyle = jacketColor;
  cx.beginPath();
  cx.moveTo(-5, jY);
  cx.quadraticCurveTo(-5.5, jY - 3, -3.5, jY - 4);
  cx.lineTo(3.5, jY - 4);
  cx.quadraticCurveTo(5.5, jY - 3, 5, jY);
  cx.closePath(); cx.fill();
  // collar rim
  cx.fillStyle = jacketLight;
  cx.beginPath();
  cx.moveTo(-4, jY - 0.5);
  cx.quadraticCurveTo(-5, jY - 2.5, -3.5, jY - 3.5);
  cx.lineTo(3.5, jY - 3.5);
  cx.quadraticCurveTo(5, jY - 2.5, 4, jY - 0.5);
  cx.lineTo(4, jY + 0.8);
  cx.lineTo(-4, jY + 0.8);
  cx.closePath(); cx.fill();
  // jacket pocket hint (front pocket)
  cx.strokeStyle = jacketDark; cx.lineWidth = 0.5;
  cx.beginPath();
  cx.moveTo(1.5, jY + 5.5); cx.lineTo(4.5, jY + 5.5);
  cx.lineTo(4.5, jY + 8.5); cx.lineTo(1.5, jY + 8.5);
  cx.stroke();

  // === BACKPACK (tan leather, darker strap, rolled sleeping mat on top) ===
  cx.fillStyle = '#a06a2c';
  // main pack body — rounded rectangle
  cx.beginPath();
  cx.moveTo(-10, jY + 1);
  cx.lineTo(-10, jY + 9);
  cx.quadraticCurveTo(-10, jY + 10.5, -8.5, jY + 10.5);
  cx.lineTo(-6, jY + 10.5);
  cx.lineTo(-6, jY + 0.5);
  cx.lineTo(-8.5, jY + 0.5);
  cx.quadraticCurveTo(-10, jY + 0.5, -10, jY + 1);
  cx.closePath(); cx.fill();
  // pack flap (top)
  cx.fillStyle = '#8a5520';
  cx.beginPath();
  cx.moveTo(-10.5, jY + 0.5);
  cx.lineTo(-5.5, jY + 0.5);
  cx.lineTo(-5.5, jY + 2.5);
  cx.lineTo(-10.5, jY + 2.5);
  cx.closePath(); cx.fill();
  // buckle on flap
  cx.fillStyle = '#c9a96a';
  cx.fillRect(-8.5, jY + 2, 1.5, 1.2);
  // strap (darker band across pack)
  cx.fillStyle = '#7c4f1d';
  cx.fillRect(-10, jY + 5, 4.5, 1.5);
  // rolled sleeping mat on top of pack — olive green cylinder
  cx.fillStyle = '#5a6e4a';
  cx.beginPath();
  cx.ellipse(-8, jY - 0.5, 2.5, 1.5, 0, 0, Math.PI * 2);
  cx.fill();
  cx.fillStyle = '#4a5e3a';
  cx.beginPath();
  cx.ellipse(-8, jY - 0.5, 2.5, 1.5, 0, Math.PI * 0.9, Math.PI * 2.1);
  cx.fill();
  // mat strap
  cx.strokeStyle = '#7c4f1d'; cx.lineWidth = 0.5;
  cx.beginPath();
  cx.moveTo(-9.5, jY - 0.5); cx.lineTo(-6.5, jY - 0.5);
  cx.stroke();
  // diamond logo on pack
  cx.strokeStyle = '#c9a96a'; cx.lineWidth = 0.6;
  cx.beginPath();
  cx.moveTo(-8, jY + 4); cx.lineTo(-7, jY + 5.5);
  cx.lineTo(-8, jY + 7); cx.lineTo(-9, jY + 5.5);
  cx.closePath(); cx.stroke();

  // === BACKPACK CHEST STRAP (visible on front of jacket) ===
  cx.strokeStyle = '#7c4f1d'; cx.lineWidth = 0.8;
  cx.beginPath();
  cx.moveTo(-5, jY + 3.5); cx.lineTo(2, jY + 3.5);
  cx.stroke();
  // strap buckle
  cx.fillStyle = '#c9a96a';
  cx.fillRect(-2, jY + 3, 1.5, 1.2);

  // === ARMS ===
  cx.fillStyle = jacketColor;
  if (p.climbing) {
    const arm = Math.sin(p.anim * 3) * 3;
    // right arm up
    cx.beginPath();
    cx.moveTo(3, 3 + arm); cx.lineTo(6, 3 + arm);
    cx.lineTo(6.5, 10 + arm); cx.lineTo(2.5, 10 + arm);
    cx.closePath(); cx.fill();
    // left arm up
    cx.beginPath();
    cx.moveTo(-6, 5 - arm); cx.lineTo(-3, 5 - arm);
    cx.lineTo(-2.5, 12 - arm); cx.lineTo(-6.5, 12 - arm);
    cx.closePath(); cx.fill();
    // hands
    cx.fillStyle = '#e8b88a';
    cx.beginPath(); cx.arc(4.5, 2.5 + arm, 1.5, 0, 7); cx.fill();
    cx.beginPath(); cx.arc(-4.5, 4.5 - arm, 1.5, 0, 7); cx.fill();
  } else {
    const armSwing = run ? -leg * 0.5 : 0;
    // front arm (visible)
    cx.fillStyle = jacketColor;
    cx.beginPath();
    cx.moveTo(4, jY + 1.5 + armSwing);
    cx.lineTo(7, jY + 1.5 + armSwing);
    cx.lineTo(7, jY + 8.5 + armSwing);
    cx.lineTo(4, jY + 8.5 + armSwing);
    cx.closePath(); cx.fill();
    // sleeve cuff
    cx.fillStyle = jacketDark;
    cx.fillRect(4, jY + 7 + armSwing, 3.5, 1.5);
    // hand
    cx.fillStyle = '#e8b88a';
    cx.beginPath(); cx.arc(5.5, jY + 9.5 + armSwing, 1.5, 0, 7); cx.fill();
  }

  // === PARAGLIDER CANOPY ===
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

  // === HAIR (dark, messy, peeking out from under beanie) ===
  const hY = breathe;
  cx.fillStyle = '#3a2a1a';
  // hair tufts on sides
  cx.beginPath();
  cx.moveTo(-5, -1 + hY); cx.quadraticCurveTo(-6.5, -3 + hY, -5.5, -4 + hY);
  cx.lineTo(-4.5, -1 + hY); cx.closePath(); cx.fill();
  cx.beginPath();
  cx.moveTo(5, -1 + hY); cx.quadraticCurveTo(6.5, -3 + hY, 5.5, -4 + hY);
  cx.lineTo(4.5, -1 + hY); cx.closePath(); cx.fill();
  // fringe peeking under beanie front
  cx.beginPath();
  cx.moveTo(-3, -1.5 + hY); cx.quadraticCurveTo(-2, -3 + hY, -0.5, -2 + hY);
  cx.quadraticCurveTo(1, -3 + hY, 2.5, -1.5 + hY);
  cx.lineTo(-3, -1.5 + hY); cx.closePath(); cx.fill();
  // back hair visible behind neck
  cx.fillRect(-4, 1 + hY, 8, 2);

  // === HEAD ===
  cx.fillStyle = '#e8b88a';
  cx.beginPath(); cx.arc(0, 0 + hY, 5, 0, 7); cx.fill();
  // subtle ear
  cx.fillStyle = '#d9a87a';
  cx.beginPath(); cx.arc(4.5, 0.5 + hY, 1.2, 0, 7); cx.fill();
  // eye (simple dot)
  cx.fillStyle = '#2c2a25';
  cx.fillRect(2, -0.5 + hY, 1.5, 1.5);
  // mouth hint
  cx.fillStyle = '#c99070';
  cx.fillRect(1.5, 2 + hY, 2, 0.6);

  // === BEANIE (orange, rolled brim, mountain logo) ===
  cx.fillStyle = '#d98032';
  // beanie dome
  cx.beginPath();
  cx.arc(0, -1.5 + hY, 5.2, Math.PI, 0);
  cx.fill();
  // beanie top bump
  cx.beginPath();
  cx.arc(0, -6.5 + hY, 1.5, 0, 7);
  cx.fill();
  // rolled brim — thicker band with ribbed texture
  cx.fillStyle = '#c87028';
  cx.fillRect(-5.2, -2.5 + hY, 10.4, 2.5);
  // brim ribbing
  cx.strokeStyle = '#b86020'; cx.lineWidth = 0.4;
  for (let i = -4.5; i <= 4.5; i += 1.2) {
    cx.beginPath();
    cx.moveTo(i, -2.5 + hY); cx.lineTo(i, -0.2 + hY);
    cx.stroke();
  }
  // mountain logo on beanie (small triangle)
  cx.fillStyle = '#fff';
  cx.beginPath();
  cx.moveTo(0, -5.5 + hY); cx.lineTo(-1.5, -3.5 + hY); cx.lineTo(1.5, -3.5 + hY);
  cx.closePath(); cx.fill();
  // logo snow cap
  cx.fillStyle = '#e0e8f0';
  cx.beginPath();
  cx.moveTo(0, -5.5 + hY); cx.lineTo(-0.7, -4.5 + hY); cx.lineTo(0.7, -4.5 + hY);
  cx.closePath(); cx.fill();

  // === HEADLAMP ===
  if (G.gear.lamp) {
    // Tiny headband strap wrapping around the head/beanie
    cx.fillStyle = '#2c2e33';
    cx.fillRect(-4.5, -3 + hY, 7.5, 1);
    
    // Tiny lamp housing
    cx.fillStyle = '#4a4e55';
    cx.fillRect(3, -3.5 + hY, 3.5, 2.5);
    cx.fillStyle = '#3a3e45';
    cx.fillRect(3, -3.5 + hY, 3.5, 0.8);
    if (lampOn()) {
      cx.fillStyle = 'rgba(255,235,150,0.9)';
      cx.beginPath(); cx.arc(5, -2.5 + hY, 1.8, 0, 7); cx.fill();
      cx.fillStyle = `rgba(255,235,150,${0.15 * lampFlicker})`;
      cx.beginPath(); cx.arc(5, -2.5 + hY, 5 * (0.7 + 0.3 * lampFlicker), 0, 7); cx.fill();
    }
  }

  cx.restore();
}
function lampOn() { return G.gear.lamp && (curPC.night > 0.1 || (curZone && curZone.dark)); }

// ---- lamp flicker & tunnel draft ------------------------------------------
// The lamp breathes a little wherever it's lit; in the Stollen a periodic
// draft guts the flame — the pool of light shrinks for a beat, telegraphed by
// a low whoosh and sideways sparks, so you wait for it to steady before a hop.
// It never goes fully dark (clamped), so darkness stays a soft gate.
let lampFlicker = 1, draftT = 0, draftCd = 120;
const DRAFT_LEN = 34;
function lampTick() {
  let target = 0.97 + Math.sin(frame * 0.4) * 0.02 + (Math.random() - 0.5) * 0.03; // base liveliness
  const inTunnel = lampOn() && curZone && curZone.dark;
  if (inTunnel && draftCd > 0) draftCd--;
  if (draftT > 0) {
    draftT--;
    const k = Math.sin((draftT / DRAFT_LEN) * Math.PI); // 0 → 1 → 0 across the gust
    target = 0.97 - 0.52 * k;                            // dips to ~0.45 mid-gust
    if (frame % 3 === 0) // sparks pulled sideways by the draft
      spawnPart({ x: player.x + player.w / 2, y: player.y + 4, vx: -0.8 - Math.random(), vy: -0.2 - Math.random() * 0.4, g: 0.02, t: 18, c: 'rgba(255,210,130,0.7)', s: 1.4 });
  } else if (inTunnel && draftCd <= 0 && Math.random() < 0.013) {
    draftT = DRAFT_LEN; draftCd = 150;                   // a fresh gust through the stollen
    noiseBurst(0.32, 0.035, 380);
    if (!G.flags.draftMet) { G.flags.draftMet = true; toast(TX.toast_draft); }
  } else if (!inTunnel && draftT > 0) {
    draftT--;
  }
  lampFlicker += (target - lampFlicker) * 0.45;
  lampFlicker = Math.max(0.4, Math.min(1, lampFlicker));
}

function drawParts() {
  for (const p of parts) {
    cx.fillStyle = p.c;
    cx.fillRect(p.x - cam.x, p.y - cam.y, p.s || 2, p.s || 2);
  }
}

// ---- ambient motes: per-zone air life (dust in shafts, pollen on the Alm,
// wind-grit on the ridge, mist in the gorge). Decorative only — a separate
// pool from gameplay `parts`, drawn before lighting so night/lamp dim them.
const motes = [];
const MOTE = {
  dust:   { cap: 24, vx: 0.14, vy: 0.05,  r: [0.8, 1.9], col: '255,240,200', a: [0.10, 0.28], wob: 0.5 },
  pollen: { cap: 18, vx: 0.10, vy: -0.10, r: [1.0, 2.2], col: '255,250,224', a: [0.16, 0.38], wob: 0.7 },
  grit:   { cap: 28, vx: 0.85, vy: 0.02,  r: [0.6, 1.4], col: '208,202,186', a: [0.08, 0.22], wob: 0.2 },
  mist:   { cap: 11, vx: 0.22, vy: -0.05, r: [6.0, 12.0], col: '228,234,240', a: [0.04, 0.10], wob: 0.3 },
};
function moteKind() {
  const z = curZone; if (!z) return null;
  if (z.dark) return 'dust';
  if (z.id === 'wald' || z.id === 'galerie' || z.id === 'camp') return 'dust';
  if (z.id === 'alm') return 'pollen';
  if (z.id === 'schlucht' || z.id === 'hintertal') return 'mist';
  if (z.id === 'grat' || z.id === 'gipfel' || z.id === 'geroell' || z.id === 'wache'
    || z.id === 'hochband' || z.id === 'start' || z.id === 'stellung') return 'grit';
  return null;
}
function mkMote(kind, cfg) {
  const dir = Math.random() < 0.5 ? -1 : 1, ml = 130 + Math.random() * 160;
  return {
    kind, x: cam.x + Math.random() * VW, y: cam.y + Math.random() * VH,
    vx: cfg.vx * dir * (0.5 + Math.random()), vy: cfg.vy * (0.5 + Math.random()),
    r: cfg.r[0] + Math.random() * (cfg.r[1] - cfg.r[0]), col: cfg.col,
    a: cfg.a[0] + Math.random() * (cfg.a[1] - cfg.a[0]),
    wob: cfg.wob, ph: Math.random() * 7, life: ml, maxLife: ml,
  };
}
function drawMotes() {
  if (G.mode !== 'play') return;
  const kind = moteKind(), cfg = kind && MOTE[kind];
  if (cfg) while (motes.length < cfg.cap) motes.push(mkMote(kind, cfg));
  for (let i = motes.length - 1; i >= 0; i--) {
    const m = motes[i];
    m.x += m.vx + Math.sin(frame * 0.02 + m.ph) * m.wob * 0.3;
    m.y += m.vy; m.life--;
    if (m.life <= 0 || m.kind !== kind || m.x < cam.x - 30 || m.x > cam.x + VW + 30
      || m.y < cam.y - 30 || m.y > cam.y + VH + 30) { motes.splice(i, 1); continue; }
    const fade = Math.min(1, m.life / 45, (m.maxLife - m.life) / 45);
    cx.fillStyle = `rgba(${m.col},${m.a * fade})`;
    if (m.r > 3) { cx.beginPath(); cx.arc(m.x - cam.x, m.y - cam.y, m.r, 0, 7); cx.fill(); }
    else cx.fillRect(m.x - cam.x, m.y - cam.y, m.r, m.r);
  }
}

// ---- critters: butterflies on the Alm, birds over the valley, larch needles
const critters = [];
const CROW_PERCH = { sign: 24, fence: 14, bench: 20, shelter: 22, hut: 54, chapel: 30, windsock: 28 };
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
    if ((z.id === 'alm' || z.id === 'gipfel') && curPC.night < 0.5 && FLOWERS.length) {
      const f = FLOWERS[(Math.random() * FLOWERS.length) | 0];
      if (Math.abs(f[0] * TILE - player.x) < VW)
        critters.push({ k: 'fly', x: f[0] * TILE + 8, y: f[1] * TILE - 12, t: 600, a: Math.random() * 7, hue: Math.random() < 0.5 ? '#e8e4d0' : '#d9a13d' });
    } else if ((z.id === 'wald' || z.id === 'camp') && curPC.night < 0.5 && Math.random() < 0.35) {
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
      cx.strokeStyle = hexLerp('#3c414b', '#b4bcd2', curPC.night).replace('rgb', 'rgba').replace(')', `,${lerp(0.7, 0.5, curPC.night)}`); cx.lineWidth = 1.2;
      cx.beginPath(); cx.moveTo(x - 4, y - flap); cx.quadraticCurveTo(x, y + 1, x + 4, y - flap); cx.stroke();
    } else if (c.k === 'crow') {
      const f = player.x > c.x ? 1 : -1;
      cx.fillStyle = hexLerp('#23262e', '#3a4258', curPC.night);
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
        cx.strokeStyle = hexLerp('#23262e', '#3a4258', curPC.night); cx.lineWidth = 1.6;
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
  const maxDrops = Math.round(pc.rain * 90);
  if (drops.length < maxDrops && !(curZone && curZone.covered)) {
    drops.push({ x: cam.x + Math.random() * VW, y: cam.y - 10, v: 7 + Math.random() * 3 });
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.y += d.v; d.x += 1.2;
    if (d.y > cam.y + VH) drops.splice(i, 1);
  }
}
function drawRain(pc) {
  if (drops.length === 0 || (curZone && curZone.covered)) { drops.length = 0; return; }
  cx.strokeStyle = `rgba(180,200,225,${0.45 * pc.rain})`; cx.lineWidth = 1;
  cx.beginPath();
  for (const d of drops) {
    cx.moveTo(d.x - cam.x, d.y - cam.y);
    cx.lineTo(d.x - cam.x - 1.5, d.y - cam.y - 9);
  }
  cx.stroke();
}

// light shafts slanting through the larches
function drawLightShafts(pc) {
  if (pc.rain >= 1.0 || !curZone) return;
  if (curZone.id !== 'wald' && curZone.id !== 'camp' && curZone.id !== 'galerie') return;
  const warm = G.phase === 4 ? '255,176,110' : '255,244,200';
  const slope = 0.55;
  const k0 = Math.floor((cam.x - slope * VH) / 120) - 1, k1 = Math.floor((cam.x + VW) / 120) + 1;
  const fadeFactor = (1 - pc.rain) * Math.max(0, 1 - pc.ambient / 0.66);
  if (fadeFactor <= 0.01) return;
  for (let k = k0; k <= k1; k++) {
    const h = hash01(k * 13.7 + 5);
    if (h < 0.4) continue;
    const a = (0.045 + 0.05 * Math.sin(frame * 0.008 + k * 2.1)) * (0.5 + h * 0.8) * fadeFactor;
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

  // Gather every light source once: [x, y, radius, cutAlpha, warmRGB, warmAlpha].
  // The same list feeds the darkness cut-outs and the warm additive glow, so a
  // lamp/fire/window both clears the gloom AND tints what it lights.
  const lights = [];
  const px = player.x + player.w / 2 - cam.x, py = player.y + 6 - cam.y;
  const lf = lampOn() ? lampFlicker : 1; // the lamp gutters in the tunnel draft
  lights.push([px, py, (lampOn() ? 95 : 26) * lf, lampOn() ? 0.97 : 0.5, '255,226,150', (lampOn() ? 0.34 : 0) * lf]);
  for (const id in FIRES) {
    const f = FIRES[id];
    const fx = f.x * TILE + 8 - cam.x, fy = f.r * TILE - 10 - cam.y;
    if (fx > -100 && fx < VW + 100 && fy > -100 && fy < VH + 100)
      lights.push([fx, fy, 70 + Math.sin(frame * 0.2) * 5, 0.95, '255,150,60', 0.55]);
  }
  const hut = ENTITIES.find(e => e.t === 'hut');
  if (hut) {
    const hx = hut.x * TILE + 8 - cam.x, hy = hut.r * TILE - 18 - cam.y;
    if (hx > -100 && hx < VW + 100) lights.push([hx, hy, 55, 0.8, '255,196,110', 0.42]);
  }

  // darkness layer with cut-outs, composited as a low-res overlay
  if (amb > 0.01) {
    const s = 0.35;
    lightCv.width = Math.ceil(VW * s); lightCv.height = Math.ceil(VH * s);
    lcx.setTransform(s, 0, 0, s, 0, 0);
    lcx.fillStyle = `rgba(8,10,30,${amb})`;
    lcx.fillRect(0, 0, VW, VH);
    lcx.globalCompositeOperation = 'destination-out';
    for (const [x, y, r, a] of lights) {
      const g = lcx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lcx.fillStyle = g; lcx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    lcx.globalCompositeOperation = 'source-over';
    cx.imageSmoothingEnabled = true;
    cx.drawImage(lightCv, 0, 0, VW, VH);
    cx.imageSmoothingEnabled = false;
  }

  // warm additive glow — only reads once it's dark enough to matter, so fires
  // in daylight stay neutral but lamplight and hearths go amber after dusk
  const warmK = Math.min(1, amb * 1.5);
  if (warmK > 0.05) {
    cx.globalCompositeOperation = 'lighter';
    for (const [x, y, r, , rgb, wa] of lights) {
      if (!wa) continue;
      const rr = r * 1.05, g = cx.createRadialGradient(x, y, r * 0.1, x, y, rr);
      g.addColorStop(0, `rgba(${rgb},${wa * warmK})`);
      g.addColorStop(0.5, `rgba(${rgb},${wa * warmK * 0.4})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      cx.fillStyle = g; cx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    cx.globalCompositeOperation = 'source-over';
  }
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
      // Logs underneath (closer to the in-game campfire)
      cx.fillStyle = '#5e4429';
      cx.fillRect(-7, 5, 14, 3);
      cx.fillRect(-5, 2.5, 10, 3);

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
      // Rugged black sole
      cx.fillStyle = '#212121';
      cx.beginPath();
      cx.moveTo(-7, 4.5);
      cx.lineTo(6, 4.5);
      cx.lineTo(6, 6.5);
      cx.lineTo(-7, 6.5);
      cx.closePath(); cx.fill();
      
      // Sole heel details
      cx.fillStyle = '#0a0a0a';
      cx.fillRect(-5, 6, 2, 0.8);
      cx.fillRect(0, 6, 2, 0.8);
      cx.fillRect(3, 6, 2, 0.8);

      // Boot body
      cx.fillStyle = '#7a4a26';
      cx.beginPath();
      cx.moveTo(-6, 4.5);
      cx.quadraticCurveTo(-7, 0, -6, -5); // heel to collar
      cx.lineTo(-1, -5);                  // collar top
      cx.quadraticCurveTo(-1.5, 0, 1, 1); // collar to tongue
      cx.quadraticCurveTo(6.2, 1.5, 5.8, 4.5); // toe box
      cx.closePath(); cx.fill();

      // Highlights
      cx.fillStyle = '#9c6239';
      cx.beginPath(); cx.arc(4.2, 3.2, 1.2, 0, 7); cx.fill();
      cx.beginPath(); cx.arc(-4.8, 3.5, 1.1, 0, 7); cx.fill();
      
      // Collar padding
      cx.fillStyle = '#4a2e16';
      cx.fillRect(-5.2, -4.8, 3.8, 1);

      // Red laces
      cx.strokeStyle = '#c0392b'; cx.lineWidth = 0.8;
      cx.beginPath();
      cx.moveTo(-3, -3.2); cx.lineTo(-0.2, -0.8);
      cx.moveTo(-0.2, -3.2); cx.lineTo(-3, -0.8);
      cx.moveTo(-3, -0.8); cx.lineTo(1, 1.2);
      cx.stroke();
      
      // Loops
      cx.fillStyle = '#c0392b';
      cx.beginPath();
      cx.arc(-3.5, -3.2, 0.6, 0, 7);
      cx.arc(0.3, -3.2, 0.6, 0, 7);
      cx.fill();
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
      // Woven headband strap (charcoal with vibrant blue accent stripe)
      cx.fillStyle = '#2c2e33'; cx.fillRect(-8, -1.8, 16, 3.6);       // strap base
      cx.fillStyle = '#3498db'; cx.fillRect(-8, -0.8, 16, 0.8);       // stripe accent
      
      // Strap adjustment buckles/sliders on the sides
      cx.fillStyle = '#7f8c8d';
      cx.fillRect(-6, -2.5, 1.5, 5);
      cx.fillRect(4.5, -2.5, 1.5, 5);

      // Black plastic mounting plate behind the housing
      cx.fillStyle = '#1e2022'; cx.fillRect(-5.5, -4, 11, 8);

      // Main headlight housing (slate-grey with rounded corners)
      cx.fillStyle = '#4a4e55';
      roundRect(-4.5, -4.5, 9, 9, 1.5); cx.fill();
      
      // Red power button on top
      cx.fillStyle = '#e74c3c'; cx.fillRect(-2, -5.7, 4, 1.2);

      // Chrome reflector/bezel on the front
      cx.fillStyle = '#bdc3c7'; cx.beginPath(); cx.arc(1, 0.5, 3, 0, 7); cx.fill();

      // Bright LED lens/bulb
      cx.fillStyle = '#ffe27a'; cx.beginPath(); cx.arc(1, 0.5, 1.8, 0, 7); cx.fill();

      // Detailed double-layered light beam/cone pointing forward
      // Outer soft beam
      cx.fillStyle = 'rgba(255,226,122,0.18)';
      cx.beginPath();
      cx.moveTo(3, -2);
      cx.lineTo(8, -6.5);
      cx.lineTo(8, 7.5);
      cx.lineTo(3, 3);
      cx.closePath(); cx.fill();
      
      // Core bright beam
      cx.fillStyle = 'rgba(255,226,122,0.38)';
      cx.beginPath();
      cx.moveTo(3, -1);
      cx.lineTo(7.5, -3.5);
      cx.lineTo(7.5, 4.5);
      cx.lineTo(3, 2);
      cx.closePath(); cx.fill();
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
    case 'lock': {
      cx.strokeStyle = '#5a4a35'; cx.lineWidth = 1.6;
      cx.beginPath(); cx.arc(0, -1.5, 3.2, Math.PI, 0); cx.lineTo(3.2, 2.5); cx.moveTo(-3.2, -1.5); cx.lineTo(-3.2, 2.5); cx.stroke();
      cx.fillStyle = '#d0a73b'; cx.strokeStyle = '#5a4a35'; cx.lineWidth = 1.2;
      roundRect(-4.8, 1, 9.6, 6.5, 1.5); cx.fill(); cx.stroke();
      cx.fillStyle = '#5a4a35'; cx.beginPath(); cx.arc(0, 3.5, 1, 0, 7); cx.fill();
      cx.fillRect(-0.5, 4.2, 1, 2.2);
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
      const hy = -1;
      // Detailed jacket details on shoulders (collars, zip, backpack straps)
      const jacketD = G.gear.jacket ? '#a93226' : '#246355';
      const jacketL = G.gear.jacket ? '#d04a3d' : '#3a9980';
      // Collar rim
      cx.fillStyle = jacketL;
      cx.beginPath();
      cx.moveTo(-5, 6); cx.quadraticCurveTo(0, 11, 5, 6);
      cx.lineTo(5, 9); cx.quadraticCurveTo(0, 14, -5, 9);
      cx.closePath(); cx.fill();
      // Zipper line
      cx.strokeStyle = jacketD; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, 8); cx.lineTo(0, 16); cx.stroke();
      // Zipper pull
      cx.fillStyle = '#ccc'; cx.fillRect(-0.7, 9, 1.4, 2);
      // Backpack straps
      cx.fillStyle = '#7c4f1d'; // dark brown leather straps
      cx.fillRect(-10.5, 6, 2.8, 10);
      cx.fillRect(7.7, 6, 2.8, 10);
      // Chest strap
      cx.fillRect(-7.7, 10, 15.4, 1.8);
      cx.fillStyle = '#c9a96a'; // buckle
      cx.fillRect(-1, 9.5, 2, 2.8);

      head(hy);
      
      // Hair (dark messy #3a2a1a peeking out)
      cx.fillStyle = '#3a2a1a';
      // Side sweeps
      cx.beginPath();
      cx.moveTo(-7.6, hy - 2.5); cx.quadraticCurveTo(-9.2, hy + 2, -6, hy + 3.5);
      cx.lineTo(-6, hy - 2.5); cx.closePath(); cx.fill();
      cx.beginPath();
      cx.moveTo(7.6, hy - 2.5); cx.quadraticCurveTo(9.2, hy + 2, 6, hy + 3.5);
      cx.lineTo(6, hy - 2.5); cx.closePath(); cx.fill();
      // Fringe
      cx.beginPath();
      cx.moveTo(-5, hy - 3.5); cx.quadraticCurveTo(-3, hy - 5.5, -0.8, hy - 4);
      cx.quadraticCurveTo(1.5, hy - 5.5, 3.8, hy - 3.5);
      cx.lineTo(-5, hy - 3.5); cx.closePath(); cx.fill();

      // Eyes
      eyes(hy);
      
      // Beanie (orange, rolled ribbed brim, mountain logo)
      cx.fillStyle = '#d98032';
      // Dome
      cx.beginPath(); cx.arc(0, hy - 3.2, 7.8, Math.PI, 0); cx.fill();
      // Beanie top bump
      cx.beginPath(); cx.arc(0, hy - 11, 2.2, 0, 7); cx.fill();
      // Rolled brim
      cx.fillStyle = '#c87028';
      cx.fillRect(-7.8, hy - 5.5, 15.6, 3.8);
      // Brim ribbing
      cx.strokeStyle = '#b86020'; cx.lineWidth = 0.6;
      for (let i = -7; i <= 7; i += 1.8) {
        cx.beginPath(); cx.moveTo(i, hy - 5.5); cx.lineTo(i, hy - 2); cx.stroke();
      }
      // Mountain logo (white triangle)
      cx.fillStyle = '#fff';
      cx.beginPath();
      cx.moveTo(0, hy - 9.5); cx.lineTo(-2.2, hy - 6.5); cx.lineTo(2.2, hy - 6.5);
      cx.closePath(); cx.fill();
      // Snow cap
      cx.fillStyle = '#e0e8f0';
      cx.beginPath();
      cx.moveTo(0, hy - 9.5); cx.lineTo(-1, hy - 8); cx.lineTo(1, hy - 8);
      cx.closePath(); cx.fill();

      // Headlamp (if acquired)
      if (G.gear.lamp) {
        // Headlamp strap wrapping around the beanie (charcoal with blue accent stripe)
        cx.fillStyle = '#2c2e33';
        cx.fillRect(-7.5, hy - 8, 12, 2.2);
        cx.fillStyle = '#3498db';
        cx.fillRect(-7.5, hy - 7.5, 12, 0.6);

        // Main housing (slate-grey with black mounting bracket plate)
        cx.fillStyle = '#1e2022';
        cx.fillRect(3.8, hy - 8.5, 1, 3.8); // mounting bracket peeking out
        cx.fillStyle = '#4a4e55';
        cx.fillRect(4.8, hy - 8.5, 4.5, 3.8); // main housing
        
        // Red power button on top
        cx.fillStyle = '#e74c3c';
        cx.fillRect(5.8, hy - 9.3, 2, 0.8);

        // Chrome reflector/bezel on the front
        cx.fillStyle = '#bdc3c7';
        cx.beginPath(); cx.arc(7.6, hy - 6.6, 1.4, 0, 7); cx.fill();

        // Bright LED lens/bulb
        cx.fillStyle = '#ffe27a';
        cx.beginPath(); cx.arc(7.6, hy - 6.6, 0.8, 0, 7); cx.fill();

        if (lampOn()) {
          cx.fillStyle = 'rgba(255,235,150,0.9)';
          cx.beginPath(); cx.arc(7.6, hy - 6.6, 2.5, 0, 7); cx.fill();
          cx.fillStyle = 'rgba(255,235,150,0.25)';
          cx.beginPath(); cx.arc(7.6, hy - 6.6, 6, 0, 7); cx.fill();
        }
      }
      break;
    }
    case 'greta': {
      // shoulders in plum-purple blouse
      shoulders('#6f5a7d');
      const hy = -1;
      // Knitted shawl draped over shoulders
      cx.fillStyle = '#8f79a3';
      cx.beginPath();
      cx.moveTo(-13, 16);
      cx.quadraticCurveTo(0, 7, 13, 16);
      cx.lineTo(13, 13);
      cx.quadraticCurveTo(0, 4, -13, 13);
      cx.closePath(); cx.fill();
      // White collar peeking at the center
      cx.fillStyle = '#fff';
      cx.beginPath();
      cx.moveTo(-3, 6);
      cx.lineTo(3, 6);
      cx.lineTo(0, 11);
      cx.closePath(); cx.fill();
      
      head(hy);
      
      // Hair (silver-grey with bun & sweeps)
      cx.fillStyle = '#cfcfcf';
      // main hair dome
      cx.beginPath(); cx.arc(0, hy - 2.5, 7.6, Math.PI, 0); cx.fill();
      // hair bun on top
      cx.beginPath(); cx.arc(0, hy - 11, 3.5, 0, 7); cx.fill();
      // bun details (shading)
      cx.strokeStyle = '#b0b0b0'; cx.lineWidth = 0.8;
      cx.beginPath(); cx.arc(0, hy - 11, 2, 0, Math.PI); cx.stroke();
      // hair pin in bun
      cx.strokeStyle = '#d9a13d'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(-4, hy - 12); cx.lineTo(4, hy - 9.5); cx.stroke();
      // side hair wisps
      cx.fillStyle = '#cfcfcf';
      cx.beginPath();
      cx.moveTo(-7.6, hy - 2.5); cx.quadraticCurveTo(-9, hy + 2, -6, hy + 3);
      cx.lineTo(-6, hy - 2.5); cx.closePath(); cx.fill();
      cx.beginPath();
      cx.moveTo(7.6, hy - 2.5); cx.quadraticCurveTo(9, hy + 2, 6, hy + 3);
      cx.lineTo(6, hy - 2.5); cx.closePath(); cx.fill();

      // Rosy cheeks (adds warmth/love)
      cx.fillStyle = '#e8a085';
      cx.beginPath(); cx.arc(-4.5, hy + 3, 1.5, 0, 7); cx.fill();
      cx.beginPath(); cx.arc(4.5, hy + 3, 1.5, 0, 7); cx.fill();

      // Eyes
      eyes(hy);
      
      // Glasses (thin gold loops with bridge)
      cx.strokeStyle = '#d9a13d'; cx.lineWidth = 0.8;
      cx.beginPath(); cx.arc(-2.6, hy + 1, 2.5, 0, 7); cx.stroke();
      cx.beginPath(); cx.arc(2.6, hy + 1, 2.5, 0, 7); cx.stroke();
      cx.beginPath(); cx.moveTo(-0.5, hy + 1); cx.lineTo(0.5, hy + 1); cx.stroke();
      break;
    }
    case 'norbert': {
      // Moss green jacket
      shoulders('#3f5e3a');
      const hy = -1;
      // Apron bib tied over
      cx.fillStyle = '#2b3a66';
      cx.beginPath();
      cx.moveTo(-7, 16); cx.lineTo(-6, 9);
      cx.lineTo(6, 9); cx.lineTo(7, 16);
      cx.closePath(); cx.fill();
      // Apron straps with tiny silver buckle dots
      cx.strokeStyle = '#1d2747'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(-4, 9); cx.lineTo(-5, 4); cx.stroke();
      cx.beginPath(); cx.moveTo(4, 9); cx.lineTo(5, 4); cx.stroke();
      cx.fillStyle = '#ccc';
      cx.beginPath(); cx.arc(-4, 9, 0.8, 0, 7); cx.fill();
      cx.beginPath(); cx.arc(4, 9, 0.8, 0, 7); cx.fill();

      head(hy);

      // Tyrolean full beard/mustache (adds massive character)
      cx.fillStyle = '#4a3e2c';
      cx.beginPath();
      cx.moveTo(-5.5, hy + 2.5);
      cx.quadraticCurveTo(-6.5, hy + 8, 0, hy + 9.5);
      cx.quadraticCurveTo(6.5, hy + 8, 5.5, hy + 2.5);
      cx.lineTo(4, hy + 1.5);
      cx.quadraticCurveTo(0, hy + 3.5, -4, hy + 1.5);
      cx.closePath(); cx.fill();
      // Mustache front overlap
      cx.beginPath();
      cx.moveTo(-3.5, hy + 2.2); cx.quadraticCurveTo(0, hy + 3.8, 3.5, hy + 2.2);
      cx.quadraticCurveTo(0, hy + 1.2, -3.5, hy + 2.2);
      cx.closePath(); cx.fill();

      // Rosy cheeks
      cx.fillStyle = '#e8a085';
      cx.beginPath(); cx.arc(-4, hy + 1.5, 1.2, 0, 7); cx.fill();
      cx.beginPath(); cx.arc(4, hy + 1.5, 1.2, 0, 7); cx.fill();

      eyes(hy);

      // Tyrolean hat (olive-green felt with hatband and red-pink feather)
      cx.fillStyle = '#4a5e3a';
      // Brim
      cx.fillRect(-10, hy - 6.5, 20, 2);
      // Crown (tapered)
      cx.beginPath();
      cx.moveTo(-7, hy - 6.5); cx.lineTo(-5.2, hy - 14);
      cx.lineTo(5.2, hy - 14); cx.lineTo(7, hy - 6.5);
      cx.closePath(); cx.fill();
      // Dark hatband
      cx.fillStyle = '#2a3a22';
      cx.fillRect(-7.4, hy - 6.5, 14.8, 1.2);
      // Red-pink feather
      cx.fillStyle = '#d9577a';
      cx.beginPath();
      cx.moveTo(4.5, hy - 15);
      cx.quadraticCurveTo(6.8, hy - 10, 5.5, hy - 6.5);
      cx.lineTo(3.5, hy - 6.5);
      cx.quadraticCurveTo(4.5, hy - 10, 3.5, hy - 14.5);
      cx.closePath(); cx.fill();
      // White highlight on feather
      cx.strokeStyle = '#ff9ebb'; cx.lineWidth = 0.5;
      cx.beginPath(); cx.moveTo(4.5, hy - 14); cx.quadraticCurveTo(5.5, hy - 10, 4.5, hy - 7.5); cx.stroke();
      break;
    }
    case 'vera': {
      // Rust-red flight jumpsuit shoulders
      shoulders('#b8483a');
      const hy = -1;
      // Suit collar & zipper details
      cx.fillStyle = '#982c1f';
      cx.beginPath();
      cx.moveTo(-4, 6); cx.lineTo(0, 13); cx.lineTo(4, 6);
      cx.closePath(); cx.fill();
      cx.strokeStyle = '#fff'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, 10); cx.lineTo(0, 16); cx.stroke();
      // Silver zip tab
      cx.fillStyle = '#ccc'; cx.fillRect(-0.8, 9, 1.6, 2.5);

      head(hy);

      // Hair strands peeking out from under helmet
      cx.fillStyle = '#4a3e2c';
      cx.beginPath();
      cx.moveTo(-7.5, hy - 1); cx.quadraticCurveTo(-9, hy + 4, -6.5, hy + 5.5);
      cx.lineTo(-5.5, hy - 1); cx.closePath(); cx.fill();
      cx.beginPath();
      cx.moveTo(7.5, hy - 1); cx.quadraticCurveTo(9, hy + 4, 6.5, hy + 5.5);
      cx.lineTo(5.5, hy - 1); cx.closePath(); cx.fill();

      // Rosy cheeks
      cx.fillStyle = '#e8a085';
      cx.beginPath(); cx.arc(-4.5, hy + 3, 1.3, 0, 7); cx.fill();
      cx.beginPath(); cx.arc(4.5, hy + 3, 1.3, 0, 7); cx.fill();

      // Flight Helmet (white half-dome with visor line, strap, and badge)
      cx.fillStyle = '#f0f0ea';
      cx.beginPath(); cx.arc(0, hy - 3.2, 7.8, Math.PI, 0); cx.fill();
      // Helmet side protector pods
      cx.beginPath(); cx.ellipse(-7.5, hy - 2, 1.8, 3, 0.1, 0, 7); cx.fill();
      cx.beginPath(); cx.ellipse(7.5, hy - 2, 1.8, 3, -0.1, 0, 7); cx.fill();
      // Black chin strap
      cx.strokeStyle = '#333'; cx.lineWidth = 1.2;
      cx.beginPath();
      cx.moveTo(-7.4, hy - 1); cx.lineTo(-4.8, hy + 6);
      cx.lineTo(0, hy + 8);
      cx.stroke();

      // Visor shield at top
      cx.fillStyle = '#222';
      cx.beginPath();
      cx.arc(0, hy - 4, 6.5, Math.PI * 1.15, Math.PI * 1.85);
      cx.closePath(); cx.fill();

      // Sunglasses (sleek aviators with blue lens glare reflections)
      cx.fillStyle = '#1b1d22';
      // Left lens
      cx.beginPath(); cx.ellipse(-3.2, hy - 0.5, 3.4, 2.5, 0.1, 0, 7); cx.fill();
      // Right lens
      cx.beginPath(); cx.ellipse(3.2, hy - 0.5, 3.4, 2.5, -0.1, 0, 7); cx.fill();
      // Bridge & frame
      cx.strokeStyle = '#333'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(-6.6, hy - 1.2); cx.lineTo(6.6, hy - 1.2); cx.stroke();
      cx.beginPath(); cx.moveTo(-1, hy - 0.8); cx.lineTo(1, hy - 0.8); cx.stroke();
      // Lens glare reflections
      cx.fillStyle = '#8fb6c9';
      cx.beginPath(); cx.moveTo(-5.2, hy - 1.8); cx.lineTo(-3.8, hy - 0.2); cx.lineTo(-4.6, hy - 0.2); cx.closePath(); cx.fill();
      cx.beginPath(); cx.moveTo(1.2, hy - 1.8); cx.lineTo(2.6, hy - 0.2); cx.lineTo(1.8, hy - 0.2); cx.closePath(); cx.fill();
      break;
    }
    case 'dog': {
      // Shoulders/chest in dog fur
      shoulders('#8a6a44');
      const hy = -1;
      
      // Cream-colored chest patch in background
      cx.fillStyle = '#c8a880';
      cx.beginPath();
      cx.moveTo(-6, 16); cx.quadraticCurveTo(0, 7, 6, 16);
      cx.closePath(); cx.fill();
      
      // Leather collar & brass tag
      cx.fillStyle = '#4a3826';
      cx.beginPath();
      cx.moveTo(-9.5, 8); cx.quadraticCurveTo(0, 11, 9.5, 8);
      cx.lineTo(9.5, 10.5); cx.quadraticCurveTo(0, 13.5, -9.5, 10.5);
      cx.closePath(); cx.fill();
      // Brass tag
      cx.fillStyle = '#d9a13d';
      cx.beginPath(); cx.arc(0, 12, 1.6, 0, 7); cx.fill();
      cx.fillStyle = '#fff'; // shiny highlight on tag
      cx.beginPath(); cx.arc(-0.6, 11.4, 0.5, 0, 7); cx.fill();

      // Dog Head
      cx.fillStyle = '#8a6a44';
      cx.beginPath(); cx.arc(0, hy, 7.8, 0, 7); cx.fill();

      // Muzzle (cream)
      cx.fillStyle = '#c8a880';
      cx.beginPath(); cx.ellipse(0, hy + 3.2, 4.6, 3.4, 0, 0, 7); cx.fill();
      
      // Dog Nose
      cx.fillStyle = '#2c2a25';
      cx.beginPath(); cx.arc(0, hy + 1.8, 1.8, 0, 7); cx.fill();
      
      // Mouth line
      cx.strokeStyle = '#6b4f30'; cx.lineWidth = 0.8;
      cx.beginPath(); cx.moveTo(0, hy + 3.6); cx.lineTo(0, hy + 5.5); cx.stroke();
      
      // Eyes
      eyes(hy - 1.5);
      
      // Eyebrows (adds cute dog expression!)
      cx.fillStyle = '#c8a880';
      cx.fillRect(-4.5, hy - 4, 2, 1);
      cx.fillRect(2.5, hy - 4, 2, 1);

      // Ears: Left floppy (folded), Right alert/pointed
      cx.fillStyle = '#6b4f30';
      // Floppy ear (left)
      cx.beginPath();
      cx.moveTo(-7.8, hy - 2);
      cx.bezierCurveTo(-11.5, hy - 6, -11.5, hy + 1, -8, hy + 3.5);
      cx.closePath(); cx.fill();
      // Alert pointed ear (right)
      cx.beginPath();
      cx.moveTo(6.5, hy - 4);
      cx.lineTo(10.5, hy - 11);
      cx.lineTo(8.5, hy - 1);
      cx.closePath(); cx.fill();
      break;
    }
    case 'cow': {
      const hy = -1;
      
      // Off-white horns (behind ears)
      cx.fillStyle = '#d8d2bd';
      cx.beginPath();
      cx.moveTo(-7.5, hy - 9); cx.quadraticCurveTo(-9, hy - 14, -6.5, hy - 14.5);
      cx.lineTo(-5.5, hy - 9); cx.closePath(); cx.fill();
      cx.beginPath();
      cx.moveTo(7.5, hy - 9); cx.quadraticCurveTo(9, hy - 14, 6.5, hy - 14.5);
      cx.lineTo(5.5, hy - 9); cx.closePath(); cx.fill();

      // Shoulders/neck in cow fur
      shoulders('#9a6f4a');
      
      // Cow leather collar & brass bell
      cx.fillStyle = '#3d3327';
      cx.beginPath();
      cx.moveTo(-8, 9); cx.quadraticCurveTo(0, 12, 8, 9);
      cx.lineTo(8, 12.5); cx.quadraticCurveTo(0, 15.5, -8, 12.5);
      cx.closePath(); cx.fill();
      // Brass bell
      cx.fillStyle = '#c9b46a';
      cx.fillRect(-3.5, 12, 7, 6.5);
      // Shading on bell
      cx.fillStyle = '#d9a13d';
      cx.fillRect(1.5, 12, 2, 6.5);

      // Cow Head (pointy ears on sides)
      cx.fillStyle = '#9a6f4a';
      cx.beginPath(); cx.arc(0, hy - 1, 8.2, 0, 7); cx.fill();

      // Ears (sideways, drooping)
      cx.beginPath(); cx.ellipse(-10.2, hy - 2, 4.5, 2, 0.4, 0, 7); cx.fill();
      cx.beginPath(); cx.ellipse(10.2, hy - 2, 4.5, 2, -0.4, 0, 7); cx.fill();
      // Inner ear pink highlights
      cx.fillStyle = '#e8a085';
      cx.beginPath(); cx.ellipse(-9.5, hy - 1.8, 3.2, 1.2, 0.4, 0, 7); cx.fill();
      cx.beginPath(); cx.ellipse(9.5, hy - 1.8, 3.2, 1.2, -0.4, 0, 7); cx.fill();

      // Cream patches on head
      cx.fillStyle = '#e8e0cd';
      cx.beginPath(); cx.arc(4, hy - 3.8, 3.8, 0, 7); cx.fill();

      // Large muzzle
      cx.fillStyle = '#d8c9a8';
      cx.beginPath(); cx.ellipse(0, hy + 4.8, 6.2, 3.8, 0, 0, 7); cx.fill();

      // Nostril slits
      cx.fillStyle = eye;
      cx.beginPath(); cx.ellipse(-2.2, hy + 4.4, 0.8, 1.4, 0.2, 0, 7); cx.fill();
      cx.beginPath(); cx.ellipse(2.2, hy + 4.4, 0.8, 1.4, -0.2, 0, 7); cx.fill();

      // Large gentle eyes
      eyes(hy - 2.5);
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
  const bh = 118;
  let bw = Math.min(W - 40, 720);
  let bcx = W / 2, by = H - bh - (isTouch ? 96 : 24);
  if (isTouch) {
    // on touch the box shares the bottom strip with the joystick and action
    // buttons; when there is room between them, tuck it in there instead of
    // floating it above the controls
    const { left, right } = touchCtrls(W, H);
    if (right - left >= 290) {
      bw = Math.min(720, right - left);
      bcx = (left + right) / 2;
      by = H - bh - 16;
    }
  }
  const bx = bcx - bw / 2;
  if (journal) {
    // Parchment paper gradient
    const g = cx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, '#f5ecd2');
    g.addColorStop(1, '#e7dba4');
    cx.fillStyle = g;
    roundRect(bx, by, bw, bh, 10);
    cx.fill();

    // Hand-drawn sketchy outer border
    cx.strokeStyle = 'rgba(90, 68, 44, 0.45)';
    cx.lineWidth = 1.2;
    roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, 10);
    cx.stroke();

    // Inner sketched hairline border (slightly offset, hand-drawn look)
    cx.strokeStyle = 'rgba(90, 68, 44, 0.2)';
    cx.lineWidth = 0.6;
    roundRect(bx + 2, by + 2, bw - 4, bh - 4, 8);
    cx.stroke();

    // Left dashed binding stitches
    cx.strokeStyle = 'rgba(90, 68, 44, 0.25)';
    cx.lineWidth = 1.2;
    cx.setLineDash([3, 3]);
    cx.beginPath();
    cx.moveTo(bx + 14, by + 6);
    cx.lineTo(bx + 14, by + bh - 6);
    cx.stroke();
    cx.setLineDash([]); // Reset dashed lines

    // Vertical red margin rule
    cx.strokeStyle = 'rgba(190, 70, 70, 0.22)';
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(bx + 42, by + 6);
    cx.lineTo(bx + 42, by + bh - 6);
    cx.stroke();

    // Horizontal school ruled lines (spaced by 20px, matching text line height!)
    cx.strokeStyle = 'rgba(85, 110, 150, 0.14)';
    for (let ly = by + 34; ly < by + bh - 12; ly += 20) {
      cx.beginPath();
      cx.moveTo(bx + 43, ly);
      cx.lineTo(bx + bw - 12, ly);
      cx.stroke();
    }
  } else {
    // Rich gradient background for depth
    const g = cx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, 'rgba(20, 24, 40, 0.94)');
    g.addColorStop(1, 'rgba(10, 12, 22, 0.98)');
    cx.fillStyle = g;
    roundRect(bx, by, bw, bh, 12);
    cx.fill();

    // Outer border (refined gold brass border)
    cx.strokeStyle = UI_GOLD_DIM;
    cx.lineWidth = 1;
    roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, 12);
    cx.stroke();

    // Inner glowing/translucent hairline highlight
    cx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    cx.lineWidth = 1;
    roundRect(bx + 3.5, by + 3.5, bw - 7, bh - 7, 8.5);
    cx.stroke();

    // Ornamental brass corners with diamond dots
    cx.strokeStyle = UI_GOLD;
    cx.lineWidth = 1.5;
    const c = 8; // length of corner ticks
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ax = sx > 0 ? bx + 3.5 : bx + bw - 3.5;
      const ay_val = sy > 0 ? by + 3.5 : by + bh - 3.5;
      cx.beginPath();
      cx.moveTo(ax + sx * c, ay_val);
      cx.lineTo(ax, ay_val);
      cx.lineTo(ax, ay_val + sy * c);
      cx.stroke();

      // Tiny hand-crafted brass diamond dot rivet
      cx.fillStyle = UI_GOLD;
      cx.beginPath();
      const dotX = ax + sx * 10, dotY = ay_val + sy * 10;
      cx.moveTo(dotX, dotY - 2);
      cx.lineTo(dotX + 2, dotY);
      cx.lineTo(dotX, dotY + 2);
      cx.lineTo(dotX - 2, dotY);
      cx.closePath();
      cx.fill();
    }
  }

  let tx = bx + 18, ty2 = by + 23;
  if (pk) {
    const ps = bh - 24, px0 = bx + 12, py0 = by + 12;
    cx.fillStyle = '#0d0f18'; roundRect(px0, py0, ps, ps, 6); cx.fill();
    drawPortrait(pk, px0 + ps / 2, py0 + ps / 2, ps - 4);
    cx.strokeStyle = UI_GOLD_DIM; cx.lineWidth = 1; roundRect(px0 + 0.5, py0 + 0.5, ps - 1, ps - 1, 6); cx.stroke();
    tx = px0 + ps + 18;
    ty2 = by + 28;
  } else {
    tx = journal ? bx + 48 : bx + 24;
    ty2 = journal ? by + 29 : by + 28;
  }

  if (cur[0]) {
    setTracking(1.8);
    cx.fillStyle = journal ? '#5a3f25' : '#ffd57d';
    cx.font = 'bold 13.5px "Lora", Georgia, serif';
    cx.textAlign = 'left';
    cx.fillText(cur[0].toUpperCase(), tx, ty2);
    ty2 += journal ? 21 : 22;
    setTracking(0);
  }

  cx.fillStyle = journal ? '#2c1e12' : UI_CREAM;
  cx.font = journal ? 'italic 17px "Caveat", "Kalam", Georgia, serif' : '14.5px "Lora", Georgia, serif';
  cx.textAlign = 'left';
  wrapText(cur[1].slice(0, Math.floor(D.chars)), tx, ty2, bx + bw - 24 - tx, journal ? 20 : 21);

  // once the line has finished typing: bobbing arrow + continue prompt
  if (D.chars >= cur[1].length) {
    const dim = journal ? 'rgba(90,74,53,0.75)' : 'rgba(243,236,210,0.7)';
    // Bouncing chevron instead of unicode ▼
    const arrowY = by + bh - 12 + Math.sin(frame * 0.12) * 2;
    cx.strokeStyle = journal ? 'rgba(122, 90, 57, 0.8)' : UI_GOLD;
    cx.lineWidth = 2;
    cx.lineCap = 'round';
    cx.lineJoin = 'round';
    cx.beginPath();
    cx.moveTo(bx + bw / 2 - 5, arrowY - 2);
    cx.lineTo(bx + bw / 2, arrowY + 2);
    cx.lineTo(bx + bw / 2 + 5, arrowY - 2);
    cx.stroke();

    setTracking(1.2);
    cx.font = journal ? '11px "Caveat", "Kalam", Georgia, serif' : '10.5px "Lora", Georgia, serif';
    cx.textAlign = 'right';
    const label = TX.dlg_next.toUpperCase();
    cx.fillStyle = dim;
    cx.fillText(label, bx + bw - 16, by + bh - 14);

    if (!isTouch) {
      const lw = cx.measureText(label).width;
      const kx = bx + bw - 16 - lw - 24;
      const ky_cap = by + bh - 22;
      if (journal) {
        cx.strokeStyle = 'rgba(122,90,57,0.7)';
        cx.lineWidth = 1;
        roundRect(kx + 0.5, ky_cap + 0.5, 15, 15, 3);
        cx.stroke();
      } else {
        // 3D keycap effect
        cx.fillStyle = 'rgba(20, 24, 40, 0.6)';
        roundRect(kx, ky_cap, 16, 16, 3);
        cx.fill();
        cx.strokeStyle = UI_GOLD_DIM;
        cx.lineWidth = 1;
        roundRect(kx + 0.5, ky_cap + 0.5, 15, 15, 3);
        cx.stroke();
        // bottom/right shadow line
        cx.strokeStyle = UI_GOLD;
        cx.lineWidth = 1.2;
        cx.beginPath();
        cx.moveTo(kx + 2, ky_cap + 16);
        cx.lineTo(kx + 16, ky_cap + 16);
        cx.lineTo(kx + 16, ky_cap + 2);
        cx.stroke();
      }
      cx.fillStyle = journal ? '#5a3f25' : UI_GOLD;
      cx.textAlign = 'center';
      cx.font = 'bold 9.5px "Lora", Georgia, serif';
      cx.fillText('E', kx + 8, ky_cap + 11.5);
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

// ------------------------------------------------------------- map helpers --
const MAP_EDGES = [
  ['wache', 'stellung'],
  ['stellung', 'stollen'],
  ['stellung', 'schlucht'],
  ['stollen', 'alm'],
  ['stollen', 'hochband'],
  ['hochband', 'ferrata'],
  ['ferrata', 'grat'],
  ['ferrata', 'alm'],
  ['grat', 'gipfel'],
  ['grat', 'start'],
  ['start', 'hintertal'],
  ['alm', 'camp'],
  ['alm', 'depot'],
  ['camp', 'galerie'],
  ['galerie', 'geroell'],
  ['geroell', 'wald']
];

function drawMapTree(tx, ty, tscale) {
  cx.save();
  cx.translate(tx, ty);
  cx.scale(tscale, tscale);
  
  // Trunk (tapered and shaded)
  cx.fillStyle = '#66533c'; // light trunk
  cx.beginPath();
  cx.moveTo(-1.2, 5); cx.lineTo(-0.4, 0); cx.lineTo(0, 0); cx.lineTo(0, 5);
  cx.closePath(); cx.fill();
  cx.fillStyle = '#473929'; // shadow trunk
  cx.beginPath();
  cx.moveTo(0, 5); cx.lineTo(0, 0); cx.lineTo(0.4, 0); cx.lineTo(1.2, 5);
  cx.closePath(); cx.fill();

  // Foliage Helper
  const drawMapTier = (topY, bottomY, w) => {
    // shadow layer
    cx.fillStyle = '#2f4b26';
    cx.beginPath();
    cx.moveTo(0, topY);
    cx.lineTo(-w - 0.5, bottomY + 0.5);
    cx.lineTo(w + 0.5, bottomY + 0.5);
    cx.closePath(); cx.fill();

    // main layer
    cx.fillStyle = '#4c6e43';
    cx.beginPath();
    cx.moveTo(0, topY);
    cx.lineTo(-w, bottomY);
    cx.lineTo(w, bottomY);
    cx.closePath(); cx.fill();

    // highlight layer
    cx.fillStyle = '#719d67';
    cx.beginPath();
    cx.moveTo(-0.3, topY + 0.2);
    cx.lineTo(-w + 0.4, bottomY - 0.4);
    cx.lineTo(w - 0.8, bottomY - 0.4);
    cx.closePath(); cx.fill();
  };

  // 3 overlapping detailed tiers
  drawMapTier(-6, -1.5, 3.8);
  drawMapTier(-9, -4.5, 3.0);
  drawMapTier(-11.5, -7.5, 2.2);

  cx.restore();
}

function drawMapPond(x, y, w, h) {
  cx.save();
  cx.fillStyle = '#8fb6c9';
  cx.beginPath();
  cx.ellipse(x, y, w, h, 0, 0, 7);
  cx.fill();
  cx.strokeStyle = '#5a4a35'; cx.lineWidth = 1;
  cx.stroke();
  cx.strokeStyle = '#5b9fd4'; cx.lineWidth = 0.8;
  cx.beginPath();
  cx.moveTo(x - w * 0.5, y + h * 0.2); cx.lineTo(x + w * 0.3, y + h * 0.2);
  cx.moveTo(x - w * 0.2, y - h * 0.3); cx.lineTo(x + w * 0.4, y - h * 0.3);
  cx.stroke();
  cx.restore();
}

function drawMapTent(x, y, scale) {
  cx.save();
  cx.translate(x, y);
  cx.scale(scale, scale);
  cx.strokeStyle = '#5a4a35'; cx.lineWidth = 1.2;
  cx.fillStyle = '#4c6e43';
  cx.beginPath();
  cx.moveTo(-7, 6); cx.lineTo(0, -6); cx.lineTo(7, 6);
  cx.closePath(); cx.fill(); cx.stroke();
  cx.fillStyle = '#3d4046';
  cx.beginPath();
  cx.moveTo(-2.5, 6); cx.lineTo(0, 1.5); cx.lineTo(2.5, 6);
  cx.closePath(); cx.fill(); cx.stroke();
  cx.beginPath();
  cx.moveTo(-7, 6); cx.lineTo(-9, 8);
  cx.moveTo(7, 6); cx.lineTo(9, 8);
  cx.stroke();
  cx.restore();
}

function drawMapMountains(x, y, w, h) {
  cx.save();
  cx.strokeStyle = '#5a4a35'; cx.lineWidth = 1;
  // Left mountain
  cx.fillStyle = '#dce3cb';
  cx.beginPath();
  cx.moveTo(x, y + h); cx.lineTo(x + w * 0.4, y); cx.lineTo(x + w * 0.8, y + h);
  cx.closePath(); cx.fill(); cx.stroke();
  cx.beginPath();
  cx.moveTo(x + w * 0.4, y);
  cx.lineTo(x + w * 0.45, y + h * 0.25);
  cx.lineTo(x + w * 0.5, y + h * 0.5);
  cx.lineTo(x + w * 0.6, y + h);
  cx.stroke();
  for (let i = 1; i <= 4; i++) {
    cx.beginPath();
    cx.moveTo(x + w * 0.4 + (w * 0.4 / 5) * i, y + (h / 5) * i);
    cx.lineTo(x + w * 0.4 + (w * 0.4 / 5) * i - 3, y + (h / 5) * i + 3);
    cx.stroke();
  }
  // Right mountain
  cx.fillStyle = '#dce3cb';
  cx.beginPath();
  cx.moveTo(x + w * 0.3, y + h); cx.lineTo(x + w * 0.7, y + h * 0.2); cx.lineTo(x + w * 1.1, y + h);
  cx.closePath(); cx.fill(); cx.stroke();
  cx.beginPath();
  cx.moveTo(x + w * 0.7, y + h * 0.2);
  cx.lineTo(x + w * 0.9, y + h);
  cx.stroke();
  for (let i = 1; i <= 4; i++) {
    cx.beginPath();
    cx.moveTo(x + w * 0.7 + (w * 0.4 / 5) * i, y + h * 0.2 + (h * 0.8 / 5) * i);
    cx.lineTo(x + w * 0.7 + (w * 0.4 / 5) * i - 3, y + h * 0.2 + (h * 0.8 / 5) * i + 3);
    cx.stroke();
  }
  cx.restore();
}

function drawMapEye(x, y, s) {
  cx.save();
  cx.translate(x, y);
  cx.scale(s / 16, s / 16);
  cx.strokeStyle = '#5a4a35'; cx.lineWidth = 1.8;
  cx.beginPath();
  cx.moveTo(-7.5, 0); cx.quadraticCurveTo(0, -6.5, 7.5, 0);
  cx.quadraticCurveTo(0, 6.5, -7.5, 0);
  cx.closePath(); cx.stroke();
  cx.fillStyle = '#5a4a35';
  cx.beginPath(); cx.arc(0, 0, 2.6, 0, 7); cx.fill();
  cx.fillStyle = '#dce3cb';
  cx.beginPath(); cx.arc(0, 0, 1.1, 0, 7); cx.fill();
  cx.restore();
}

function drawMapPin(x, y, s) {
  cx.save();
  cx.translate(x, y);
  cx.scale(s / 16, s / 16);
  cx.fillStyle = 'rgba(0,0,0,0.15)';
  cx.beginPath(); cx.ellipse(0, 7, 3, 1.5, 0, 0, 7); cx.fill();
  cx.fillStyle = '#c0392b';
  cx.beginPath();
  cx.arc(0, -3, 4.5, -Math.PI * 0.8, -Math.PI * 0.2);
  cx.quadraticCurveTo(0.5, 2, 0, 7);
  cx.quadraticCurveTo(-0.5, 2, -4.5, -3);
  cx.closePath(); cx.fill();
  cx.strokeStyle = '#7f231a'; cx.lineWidth = 1; cx.stroke();
  cx.fillStyle = '#f5ebd5';
  cx.beginPath(); cx.arc(0, -3, 1.8, 0, 7); cx.fill();
  cx.restore();
}

function drawMapLeaf(x, y, scale, flip) {
  cx.save();
  cx.translate(x, y);
  cx.scale(flip ? -scale : scale, scale);
  cx.rotate(-Math.PI * 0.15);
  cx.fillStyle = '#4c6e43';
  cx.strokeStyle = '#3d5236'; cx.lineWidth = 0.8;
  cx.beginPath(); cx.moveTo(-8, 2); cx.quadraticCurveTo(0, 0, 8, -2); cx.stroke();
  cx.beginPath(); cx.ellipse(4, -2, 4, 1.8, -0.2, 0, 7); cx.fill(); cx.stroke();
  cx.beginPath(); cx.ellipse(0, 0, 3.5, 1.6, 0.2, 0, 7); cx.fill(); cx.stroke();
  cx.beginPath(); cx.ellipse(-4, 1.5, 3, 1.4, -0.1, 0, 7); cx.fill(); cx.stroke();
  cx.restore();
}

function drawCornerDecorations(x, y, w, h) {
  cx.save();
  cx.strokeStyle = '#b9ac82'; cx.lineWidth = 1;
  const d = 12;
  // Top Left
  cx.beginPath();
  cx.moveTo(x + d, y); cx.quadraticCurveTo(x, y, x, y + d);
  cx.moveTo(x + d + 4, y + 4); cx.quadraticCurveTo(x + 4, y + 4, x + 4, y + d + 4);
  cx.stroke();
  // Top Right
  cx.beginPath();
  cx.moveTo(x + w - d, y); cx.quadraticCurveTo(x + w, y, x + w, y + d);
  cx.moveTo(x + w - d - 4, y + 4); cx.quadraticCurveTo(x + w - 4, y + 4, x + w - 4, y + d + 4);
  cx.stroke();
  // Bottom Left
  cx.beginPath();
  cx.moveTo(x + d, y + h); cx.quadraticCurveTo(x, y + h, x, y + h - d);
  cx.moveTo(x + d + 4, y + h - 4); cx.quadraticCurveTo(x + 4, y + h - 4, x + 4, y + h - d - 4);
  cx.stroke();
  // Bottom Right
  cx.beginPath();
  cx.moveTo(x + w - d, y + h); cx.quadraticCurveTo(x + w, y + h, x + w, y + h - d);
  cx.moveTo(x + w - d - 4, y + h - 4); cx.quadraticCurveTo(x + w - 4, y + h - 4, x + w - 4, y + h - d - 4);
  cx.stroke();
  cx.restore();
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

  // Draw paper card shadow
  cx.fillStyle = 'rgba(10, 12, 24, 0.45)';
  roundRect(mx + 4, my + 4, pw, ph, 12); cx.fill();

  // Draw main paper card background
  cx.fillStyle = '#f2edd9';
  roundRect(mx, my, pw, ph, 12); cx.fill();

  // Draw double borders
  cx.strokeStyle = '#b9ac82'; cx.lineWidth = 1.2;
  roundRect(mx + 6, my + 6, pw - 12, ph - 12, 8); cx.stroke();
  cx.strokeStyle = '#a69970'; cx.lineWidth = 0.6;
  roundRect(mx + 9, my + 9, pw - 18, ph - 18, 6); cx.stroke();

  // Corner decorations
  drawCornerDecorations(mx + 9, my + 9, pw - 18, ph - 18);

  // Header Title
  const centerX = mx + pw / 2;
  cx.fillStyle = '#5a4a35'; cx.textAlign = 'center';
  const parts = TX.map_title.split('·');
  const mainTitle = parts[0].trim();
  const subTitleText = parts[1] ? parts[1].trim() : '';

  // Draw main title
  cx.font = `bold ${Math.max(14, Math.min(18, pw * 0.035))}px Georgia, serif`;
  const titleY = my + 24;
  cx.fillText(mainTitle, centerX, titleY);

  // Draw leaf ornaments next to main title
  const titleW = cx.measureText(mainTitle).width;
  drawMapLeaf(centerX - titleW / 2 - 20, titleY, 0.9, true);
  drawMapLeaf(centerX + titleW / 2 + 20, titleY, 0.9, false);

  // Draw subtitle
  cx.font = 'italic 11px Georgia, serif';
  const subtitleY = my + 42;
  const subText = `◆ ${subTitleText} ◆`;
  cx.fillText(subText, centerX, subtitleY);

  // Draw horizontal lines extending from subtitle
  const subW = cx.measureText(subText).width;
  cx.strokeStyle = '#b9ac82'; cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(mx + 40, subtitleY);
  cx.lineTo(centerX - subW / 2 - 12, subtitleY);
  cx.moveTo(centerX + subW / 2 + 12, subtitleY);
  cx.lineTo(mx + pw - 40, subtitleY);
  cx.stroke();

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
  const areaY = my + 54, areaH = ph - 164; // Adjusted to leave room for header/footer
  const sc = Math.min((pw - 36) / bw, areaH / bh, 4.5);
  const ox = mx + (pw - bw * sc) / 2 - b.x0 * sc;
  const oy = areaY + (areaH - bh * sc) / 2 - b.y0 * sc;

  // Draw Dashed connection paths
  cx.save();
  cx.strokeStyle = '#8a6f4d';
  cx.lineWidth = 2.2;
  cx.setLineDash([4, 4]);
  for (const [id1, id2] of MAP_EDGES) {
    const z1 = ZONES.find(z => z.id === id1);
    const z2 = ZONES.find(z => z.id === id2);
    if (z1 && z2 && G.visited[z1.id] && G.visited[z2.id]) {
      const p1x = ox + (z1.x + z1.w / 2) * sc;
      const p1y = oy + (z1.y + z1.h / 2) * sc;
      const p2x = ox + (z2.x + z2.w / 2) * sc;
      const p2y = oy + (z2.y + z2.h / 2) * sc;

      const midX = (p1x + p2x) / 2;
      const midY = (p1y + p2y) / 2;
      const dx = p2x - p1x;
      const dy = p2y - p1y;
      const cpX = midX - dy * 0.12;
      const cpY = midY + dx * 0.12;

      cx.beginPath();
      cx.moveTo(p1x, p1y);
      cx.quadraticCurveTo(cpX, cpY, p2x, p2y);
      cx.stroke();
    }
  }
  cx.restore();

  // Draw zones
  for (const z of ZONES) {
    if (!G.visited[z.id]) continue;
    const zx = ox + z.x * sc, zy = oy + z.y * sc, zw = z.w * sc, zh = z.h * sc;
    const isCurrent = curZone && z.id === curZone.id;

    // Fill color
    if (isCurrent) {
      cx.fillStyle = '#fbf6eb'; // highlighted warm cream
    } else if (z.dark) {
      cx.fillStyle = '#a6af95'; // slightly darker sage
    } else {
      cx.fillStyle = '#d8e2c3'; // sage green
    }

    // Double-border rounded card
    const rad = Math.max(4, 10 * sc / 4.5);
    roundRect(zx, zy, zw, zh, rad); cx.fill();

    cx.strokeStyle = isCurrent ? '#7f1c0d' : '#5a4a35';
    cx.lineWidth = isCurrent ? 1.8 : 1.2;
    roundRect(zx, zy, zw, zh, rad); cx.stroke();

    cx.strokeStyle = isCurrent ? 'rgba(127, 28, 13, 0.4)' : 'rgba(90, 74, 53, 0.4)';
    cx.lineWidth = 0.6;
    roundRect(zx + 2, zy + 2, zw - 4, zh - 4, Math.max(2, rad - 2)); cx.stroke();

    // Zone Illustrations
    if (z.id === 'schlucht') {
      // Winding river
      cx.strokeStyle = '#5b9fd4'; cx.lineWidth = 3.5;
      cx.beginPath();
      cx.moveTo(zx + zw * 0.7, zy + zh * 0.2);
      cx.bezierCurveTo(zx + zw * 0.3, zy + zh * 0.4, zx + zw * 0.8, zy + zh * 0.7, zx + zw * 0.4, zy + zh * 0.95);
      cx.stroke();
      // Trees
      drawMapTree(zx + zw * 0.25, zy + zh * 0.3, 0.7);
      drawMapTree(zx + zw * 0.8, zy + zh * 0.8, 0.65);
    } else if (z.id === 'camp') {
      // Tent
      drawMapTent(zx + zw * 0.72, zy + zh * 0.6, 0.8);
      // Trees
      drawMapTree(zx + zw * 0.15, zy + zh * 0.7, 0.7);
      drawMapTree(zx + zw * 0.88, zy + zh * 0.75, 0.7);
    } else if (z.id === 'alm') {
      // Mountains
      drawMapMountains(zx + zw * 0.45, zy + zh * 0.45, zw * 0.45, zh * 0.45);
      // Trees
      drawMapTree(zx + zw * 0.18, zy + zh * 0.7, 0.75);
      drawMapTree(zx + zw * 0.28, zy + zh * 0.75, 0.65);
    } else if (z.id === 'galerie') {
      // Trees
      drawMapTree(zx + zw * 0.35, zy + zh * 0.75, 0.7);
      drawMapTree(zx + zw * 0.65, zy + zh * 0.8, 0.6);
    } else if (z.id === 'geroell') {
      // Mountains
      drawMapMountains(zx + zw * 0.15, zy + zh * 0.5, zw * 0.35, zh * 0.45);
      drawMapMountains(zx + zw * 0.55, zy + zh * 0.45, zw * 0.4, zh * 0.5);
    } else if (z.id === 'wald') {
      // Pond
      drawMapPond(zx + zw * 0.6, zy + zh * 0.75, zw * 0.25, zh * 0.18);
      // Trees
      drawMapTree(zx + zw * 0.2, zy + zh * 0.55, 0.8);
      drawMapTree(zx + zw * 0.38, zy + zh * 0.65, 0.95);
      drawMapTree(zx + zw * 0.85, zy + zh * 0.7, 0.75);
    } else if (z.id === 'wache') {
      drawMapEye(zx + zw * 0.5, zy + zh * 0.38, 12);
      drawMapTree(zx + zw * 0.2, zy + zh * 0.75, 0.7);
      drawMapTree(zx + zw * 0.8, zy + zh * 0.75, 0.7);
    } else if (z.id === 'stellung') {
      drawMapMountains(zx + zw * 0.15, zy + zh * 0.6, zw * 0.35, zh * 0.35);
    } else if (z.id === 'gipfel') {
      drawMapMountains(zx + zw * 0.15, zy + zh * 0.45, zw * 0.7, zh * 0.5);
    } else if (z.id === 'grat') {
      drawMapMountains(zx + zw * 0.1, zy + zh * 0.5, zw * 0.2, zh * 0.45);
      drawMapMountains(zx + zw * 0.7, zy + zh * 0.5, zw * 0.2, zh * 0.45);
    } else if (z.id === 'hintertal') {
      drawMapPond(zx + zw * 0.5, zy + zh * 0.6, zw * 0.3, zh * 0.2);
      drawMapTree(zx + zw * 0.2, zy + zh * 0.7, 0.7);
      drawMapTree(zx + zw * 0.8, zy + zh * 0.7, 0.7);
      drawMapMountains(zx + zw * 0.1, zy + zh * 0.4, zw * 0.2, zh * 0.3);
    } else if (z.id === 'depot') {
      cx.fillStyle = '#7a5a39';
      cx.fillRect(zx + zw * 0.4, zy + zh * 0.6, 6, 4);
      cx.strokeStyle = '#5a4a35'; cx.lineWidth = 0.8;
      cx.strokeRect(zx + zw * 0.4, zy + zh * 0.6, 6, 4);
    } else if (z.id === 'start') {
      cx.strokeStyle = '#c0392b'; cx.lineWidth = 1.2;
      cx.beginPath(); cx.moveTo(zx + zw * 0.5, zy + zh * 0.3); cx.lineTo(zx + zw * 0.5, zy + zh * 0.75); cx.stroke();
      cx.fillStyle = '#c0392b';
      cx.beginPath(); cx.moveTo(zx + zw * 0.5, zy + zh * 0.35); cx.lineTo(zx + zw * 0.7, zy + zh * 0.4); cx.lineTo(zx + zw * 0.5, zy + zh * 0.45); cx.closePath(); cx.fill();
    }

    // Label only where it fits
    const name = LANG === 'en' ? z.en : z.de;
    let lcx = zx + zw / 2, lcy = zy + zh / 2;
    if (z.id === 'grat') lcx = ox + (z.x + 26) * sc;
    if (z.id === 'gipfel') lcy = zy + zh + 9;

    // Shift labels up if there are illustrations
    const hasIllust = ['camp', 'alm', 'geroell', 'wald', 'schlucht', 'galerie', 'wache', 'stellung', 'grat', 'hintertal', 'start', 'depot'].includes(z.id);
    if (hasIllust && z.id !== 'gipfel') {
      lcy = zy + Math.max(12, zh * 0.35);
    }

    cx.textAlign = 'center';
    if (isCurrent && z.id !== 'gipfel') {
      cx.font = 'bold 10px Georgia, serif';
      const nameW = cx.measureText(name).width;
      const pinW = 10, pinGap = 4;
      const totalW = pinW + pinGap + nameW;
      const startX = lcx - totalW / 2;
      drawMapPin(startX + pinW / 2, lcy, 10);
      cx.fillStyle = '#7f1c0d';
      cx.fillText(name, startX + pinW + pinGap + nameW / 2, lcy);
    } else {
      cx.fillStyle = '#5a4a35';
      cx.font = '10px Georgia, serif';
      if (cx.measureText(name).width <= zw - 8 || z.id === 'gipfel') {
        cx.fillText(name, lcx, lcy);
      } else if (zh > 30) {
        const words = name.split(' ');
        const half = Math.ceil(words.length / 2);
        const l1 = words.slice(0, half).join(' '), l2 = words.slice(half).join(' ');
        if (words.length > 1 && cx.measureText(l1).width <= zw - 6 && cx.measureText(l2).width <= zw - 6) {
          cx.fillText(l1, lcx, lcy - 6);
          cx.fillText(l2, lcx, lcy + 6);
        }
      }
    }
  }

  // Landmarks at fixed, modest size
  for (const id in FIRES) {
    if (id === 'tent') continue;
    const f = FIRES[id];
    const fz = ZONES.find(z => f.x >= z.x && f.x < z.x + z.w && f.r - 1 >= z.y && f.r - 1 < z.y + z.h);
    if (fz && G.visited[fz.id]) drawIcon('fire', ox + f.x * sc, oy + (f.r - 1) * sc, 11);
  }
  if (G.visited.schlucht) drawIcon('drop', ox + 26 * sc, oy + 52 * sc, 11);
  if (G.visited.ferrata) drawIcon('cable', ox + 95 * sc, oy + 20 * sc, 11);
  if (G.visited.gipfel) drawIcon('cross', ox + 161 * sc, oy + 9 * sc, 11);

  // Player pulsing beacon
  const px_x = ox + (player.x / TILE) * sc;
  const px_y = oy + (player.y / TILE) * sc;
  cx.fillStyle = '#c0392b';
  cx.beginPath(); cx.arc(px_x, px_y, 3.5, 0, 7); cx.fill();
  cx.strokeStyle = 'rgba(192, 57, 43, 0.4)'; cx.lineWidth = 1.5;
  cx.beginPath(); cx.arc(px_x, px_y, 6 + Math.sin(frame * 0.15) * 2.5, 0, 7); cx.stroke();

  // Legend Box (bottom-left)
  const legW = 120, legH = 75;
  const legX = mx + 20, legY = my + ph - legH - 20;
  cx.fillStyle = '#f5ebd5';
  roundRect(legX, legY, legW, legH, 6); cx.fill();
  cx.strokeStyle = '#b9ac82'; cx.lineWidth = 1;
  roundRect(legX, legY, legW, legH, 6); cx.stroke();
  roundRect(legX + 2, legY + 2, legW - 4, legH - 4, 4); cx.stroke();

  cx.textAlign = 'left'; cx.font = '10px Georgia, serif'; cx.fillStyle = '#5a4a35';
  const startItemY = legY + 15, itemSpacing = 20;

  // Legend Item 1: You are here
  drawMapPin(legX + 12, startItemY, 9);
  cx.fillText(LANG === 'en' ? 'You are here' : 'Du bist hier', legX + 26, startItemY);

  // Legend Item 2: Points of interest
  drawIcon('fire', legX + 12, startItemY + itemSpacing, 9);
  cx.fillText(LANG === 'en' ? 'Points of interest' : 'Sehenswürdigkeiten', legX + 26, startItemY + itemSpacing);

  // Legend Item 3: Water
  drawIcon('drop', legX + 12, startItemY + itemSpacing * 2, 9);
  cx.fillText(LANG === 'en' ? 'Water' : 'Wasser', legX + 26, startItemY + itemSpacing * 2);

  // Compass Rose (bottom-center)
  const compX = mx + pw / 2, compY = my + ph - 96;
  cx.save();
  cx.strokeStyle = '#5a4a35'; cx.lineWidth = 0.8;
  cx.beginPath();
  cx.moveTo(compX - 16, compY); cx.lineTo(compX + 16, compY);
  cx.moveTo(compX, compY - 16); cx.lineTo(compX, compY + 16);
  cx.stroke();

  cx.fillStyle = '#5a4a35';
  cx.beginPath(); cx.moveTo(compX, compY - 16); cx.lineTo(compX - 3, compY - 8); cx.lineTo(compX + 3, compY - 8); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(compX, compY + 16); cx.lineTo(compX - 2, compY + 8); cx.lineTo(compX + 2, compY + 8); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(compX - 16, compY); cx.lineTo(compX - 8, compY - 2); cx.lineTo(compX - 8, compY + 2); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(compX + 16, compY); cx.lineTo(compX + 8, compY - 2); cx.lineTo(compX + 8, compY + 2); cx.closePath(); cx.fill();

  cx.fillStyle = '#f2edd9';
  cx.beginPath(); cx.arc(compX, compY, 7.5, 0, 7); cx.fill();
  cx.strokeStyle = '#5a4a35'; cx.stroke();

  cx.fillStyle = '#5a4a35'; cx.font = 'bold 9px Georgia, serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('N', compX, compY);
  cx.restore();

  // Bottom Center Status Text
  cx.fillStyle = '#5a4a35'; cx.textAlign = 'center';
  cx.font = 'italic 12px Georgia, serif';
  const here = curZone ? (LANG === 'en' ? curZone.en : curZone.de) : '';
  cx.fillText(`${TX.map_here} ${here}`, mx + pw / 2, my + ph - 70);

  let of2 = 12;
  cx.font = `${of2}px Georgia, serif`;
  while (cx.measureText(TX.obj_prefix + G.objective).width > pw - 240 && of2 > 8) { of2--; cx.font = `${of2}px Georgia, serif`; }
  cx.fillText(TX.obj_prefix + G.objective, mx + pw / 2, my + ph - 52);

  // Stats counter (book, lock replacing marmot)
  const stats = [['book', `${Object.keys(G.pages).length}/7`]];
  if (G.flags.finale) stats.push(['camera', `${Object.keys(G.photos).length}/5`]);
  stats.push(['lock', `${Object.keys(G.marmots).length}/5`]);
  if (!G.chestnutsDone) stats.push(['chestnut', `${G.chestnuts}/3`]);
  if (G.gear.glider) stats.push(['ring', `${Object.keys(G.rings).length}/5`]);
  drawIconStats(stats, mx + pw / 2, my + ph - 30);

  // Forest Mound Decoration (bottom-right)
  const ox_orn = mx + pw - 85, oy_orn = my + ph - 24;
  cx.fillStyle = '#dce3cb';
  cx.beginPath();
  cx.ellipse(ox_orn + 30, oy_orn + 8, 40, 10, 0, 0, 7);
  cx.fill();
  cx.strokeStyle = '#5a4a35'; cx.lineWidth = 1;
  cx.beginPath();
  cx.ellipse(ox_orn + 30, oy_orn + 8, 40, 10, 0, Math.PI, 0);
  cx.stroke();
  cx.fillStyle = '#b9ac82';
  cx.beginPath();
  cx.moveTo(ox_orn + 10, oy_orn + 6); cx.lineTo(ox_orn + 18, oy_orn - 2); cx.lineTo(ox_orn + 26, oy_orn + 8);
  cx.closePath(); cx.fill(); cx.stroke();
  drawMapTree(ox_orn + 20, oy_orn + 6, 0.7);
  drawMapTree(ox_orn + 35, oy_orn + 8, 1.0);
  drawMapTree(ox_orn + 48, oy_orn + 9, 0.8);

  // Close prompt under paper
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
// helper to draw detailed trees on the title screen meadow
// Reuses the same rendering as the in-game drawTree but with absolute coords + nightVal
function drawTitleTree(bx, by, kind, s, nightVal) {
  const H = 70 * s;

  // Helper for quadratic bezier points
  const getQuadPoint = (p0x, p0y, p1x, p1y, p2x, p2y, t) => {
    const mt = 1 - t;
    return {
      x: mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x,
      y: mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y
    };
  };

  // 1. Calculate Trunk Points (Tapered & Flared base)
  const steps = 6;
  const trunkPoints = [];
  const baseW = 5.5 * s;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const currH = H * t;
    // Larches have a slight organic bend
    const tx = (kind === 0) ? bx + Math.sin(t * Math.PI * 1.25) * 2.5 * s + t * 2 * s : bx;
    const ty = by - currH;
    let tw = baseW * (1 - t * 0.76);
    if (i === 0) tw = baseW * 1.55; // Root flare
    else if (i === 1) tw = baseW * 1.15;
    trunkPoints.push({ x: tx, y: ty, w: tw });
  }

  // 2. Draw Trunk (Light and shadow halves for 3D depth)
  // Left half (light)
  cx.beginPath();
  for (let i = 0; i <= steps; i++) {
    cx.lineTo(trunkPoints[i].x - trunkPoints[i].w / 2, trunkPoints[i].y);
  }
  for (let i = steps; i >= 0; i--) {
    cx.lineTo(trunkPoints[i].x, trunkPoints[i].y);
  }
  cx.closePath();
  cx.fillStyle = hexLerp('#6b4b32', '#1c130d', nightVal);
  cx.fill();

  // Right half (shadow)
  cx.beginPath();
  for (let i = 0; i <= steps; i++) {
    cx.lineTo(trunkPoints[i].x, trunkPoints[i].y);
  }
  for (let i = steps; i >= 0; i--) {
    cx.lineTo(trunkPoints[i].x + trunkPoints[i].w / 2, trunkPoints[i].y);
  }
  cx.closePath();
  cx.fillStyle = hexLerp('#442f1f', '#100c07', nightVal);
  cx.fill();

  // Bark grooves (subtle texture, low contrast)
  cx.strokeStyle = hexLerp('#523925', '#140e09', nightVal);
  cx.lineWidth = 0.6 * s;
  cx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const p = trunkPoints[i];
    const gx = p.x - p.w * 0.15;
    if (i === 0) cx.moveTo(gx, p.y);
    else cx.lineTo(gx, p.y);
  }
  cx.stroke();

  cx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const p = trunkPoints[i];
    const gx = p.x + p.w * 0.2;
    if (i === 0) cx.moveTo(gx, p.y);
    else cx.lineTo(gx, p.y);
  }
  cx.stroke();

  // 3. Draw Foliage
  if (kind === 0) { // larch: feathery, golden-green
    const shadowCol = hexLerp('#5f8247', '#1b2a1a', nightVal);
    const mainCol = hexLerp('#7fa05a', '#223625', nightVal);
    const highCol = hexLerp('#99ba73', '#2b4733', nightVal);

    for (let i = 0; i < 6; i++) {
      const t = 0.35 + i * 0.12;
      const tx = bx + Math.sin(t * Math.PI * 1.25) * 2.5 * s + t * 2 * s;
      const ly = by - H * t;
      const lw = (39 - i * 5) * s;

      // Draw branch structure
      cx.strokeStyle = hexLerp('#4e3523', '#130d09', nightVal);
      cx.lineWidth = (2.0 - i * 0.2) * s;
      cx.beginPath();
      cx.moveTo(tx, ly);
      cx.quadraticCurveTo(tx - lw * 0.3, ly + 6 * s, tx - lw / 2, ly - 3 * s);
      cx.moveTo(tx, ly);
      cx.quadraticCurveTo(tx + lw * 0.3, ly + 6 * s, tx + lw / 2, ly - 3 * s);
      cx.stroke();

      // Collect puff positions
      const numPuffs = 3;
      const positions = [];
      positions.push({ x: tx, y: ly, r: 7.2 * s });

      for (let k = 1; k <= numPuffs; k++) {
        const pt = k / numPuffs;
        const radius = (7.2 - pt * 3.4) * s;

        const lp = getQuadPoint(tx, ly, tx - lw * 0.3, ly + 6 * s, tx - lw / 2, ly - 3 * s, pt);
        positions.push({ x: lp.x, y: lp.y, r: radius });

        const rp = getQuadPoint(tx, ly, tx + lw * 0.3, ly + 6 * s, tx + lw / 2, ly - 3 * s, pt);
        positions.push({ x: rp.x, y: rp.y, r: radius });
      }

      // Draw shadow layer first
      cx.fillStyle = shadowCol;
      for (const pos of positions) {
        cx.beginPath(); cx.arc(pos.x, pos.y + 0.7 * s, pos.r, 0, 7); cx.fill();
      }

      // Draw main layer
      cx.fillStyle = mainCol;
      for (const pos of positions) {
        cx.beginPath(); cx.arc(pos.x, pos.y, pos.r, 0, 7); cx.fill();
      }

      // Draw highlight layer
      cx.fillStyle = highCol;
      for (const pos of positions) {
        cx.beginPath(); cx.arc(pos.x - 0.4 * s, pos.y - 0.4 * s, pos.r * 0.88, 0, 7); cx.fill();
      }
    }
  } else { // spruce: structured, tiered, deep forest green
    const spShadowCol = hexLerp('#203f30', '#0a1510', nightVal);
    const spMainCol = hexLerp('#2b523c', '#102018', nightVal);
    const spHighCol = hexLerp('#38684d', '#162b20', nightVal);

    // Helper for drawing scalloped spruce tier path
    const drawSpruceTierPath = (tx, ly, lw, topH) => {
      cx.beginPath();
      cx.moveTo(tx, ly - topH);
      cx.quadraticCurveTo(tx - lw * 0.2, ly - topH * 0.4, tx - lw / 2, ly);
      const numScallops = 6;
      for (let j = 0; j < numScallops; j++) {
        const xStart = tx - lw / 2 + (lw / numScallops) * j;
        const xEnd = tx - lw / 2 + (lw / numScallops) * (j + 1);
        const xMid = (xStart + xEnd) / 2;
        const hangY = ly + 2.5 * s * (1 - Math.abs(xMid - tx) / (lw / 2));
        cx.lineTo(xMid, hangY);
        cx.lineTo(xEnd, ly);
      }
      cx.quadraticCurveTo(tx + lw * 0.2, ly - topH * 0.4, tx, ly - topH);
      cx.closePath();
    };

    // Helper for drawing a hanging pinecone
    const drawPinecone = (px, py) => {
      const pcW = 3 * s, pcH = 6.5 * s;
      const coneCol = hexLerp('#734829', '#1d120a', nightVal);
      const coneColD = hexLerp('#52321c', '#140c06', nightVal);
      cx.fillStyle = coneCol;
      cx.beginPath(); cx.ellipse(px, py + pcH / 2, pcW / 2, pcH / 2, 0, 0, 7); cx.fill();
      cx.fillStyle = coneColD;
      cx.beginPath(); cx.ellipse(px, py + pcH / 2, pcW / 2, pcH / 2, 0, 0, Math.PI); cx.fill();
      cx.strokeStyle = hexLerp('#442f1f', '#100b07', nightVal);
      cx.lineWidth = 0.8 * s;
      cx.beginPath(); cx.moveTo(px, py); cx.lineTo(px, py - 2 * s); cx.stroke();
    };

    for (let i = 0; i < 5; i++) {
      const t = 0.24 + i * 0.16;
      const tx = bx;
      const ly = by - H * t;
      const lw = (45 - i * 7) * s;
      const topH = 17 * s;

      // Shadow tier
      cx.fillStyle = spShadowCol;
      drawSpruceTierPath(tx, ly + 1 * s, lw + 1 * s, topH);
      cx.fill();

      // Main tier
      cx.fillStyle = spMainCol;
      drawSpruceTierPath(tx, ly, lw, topH);
      cx.fill();

      // Highlight tier
      cx.fillStyle = spHighCol;
      drawSpruceTierPath(tx - 0.4 * s, ly - 0.6 * s, lw * 0.92, topH * 0.9);
      cx.fill();

      // Needle texturing lines
      cx.strokeStyle = hexLerp('#1c3b2b', '#0a1410', nightVal);
      cx.lineWidth = 0.5 * s;
      cx.beginPath();
      const numScallops = 6;
      for (let j = 0; j < numScallops; j++) {
        const xMid = tx - lw / 2 + (lw / numScallops) * (j + 0.5);
        const yMid = ly + 2.5 * s * (1 - Math.abs(xMid - tx) / (lw / 2));
        cx.moveTo(tx + (xMid - tx) * 0.35, ly - topH * 0.35);
        cx.lineTo(xMid, yMid);
      }
      cx.stroke();

      // Hanging cones from lower tiers
      if (i < 3) {
        drawPinecone(tx - lw / 2 + 1 * s, ly + 1 * s);
        drawPinecone(tx + lw / 2 - 1 * s, ly + 1 * s);
      }
    }
  }
}

// helper to draw detailed flowers on the title screen meadow
function drawTitleFlower(x, y, kind) {
  cx.strokeStyle = '#557d3a'; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y - 6); cx.stroke();
  if (kind === 'rose') { cx.fillStyle = '#d9577a'; cx.beginPath(); cx.arc(x, y - 7, 3, 0, 7); cx.fill(); }
  else if (kind === 'gent') { cx.fillStyle = '#2b5fb8'; cx.beginPath(); cx.arc(x, y - 7, 2.5, 0, 7); cx.fill(); }
  else { // edelweiss
    cx.fillStyle = '#f2f0e4';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      cx.beginPath(); cx.ellipse(x + Math.cos(a) * 3, y - 7 + Math.sin(a) * 3, 2.5, 1.2, a, 0, 7); cx.fill();
    }
    cx.fillStyle = '#d9c75e'; cx.beginPath(); cx.arc(x, y - 7, 1.5, 0, 7); cx.fill();
  }
}

// dynamic title backdrop using in-game peaks, church, conifer bands, and bg rock
function drawTitleBg(W, H) {
  // slowly pan camera on title screen
  cam.x = 816 + Math.sin(frame * 0.001) * 80;
  cam.y = 1030 + Math.cos(frame * 0.001) * 10;
  
  const pc = phaseColors();

  // Draw in-game background under ZOOM scale
  cx.save();
  cx.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);
  
  drawSky(pc);
  
  // Draw foreground meadow hill under ZOOM scale
  const mY = VH * 0.72;
  const mg = cx.createLinearGradient(0, mY - 10, 0, VH);
  const grassCol0 = hexLerp('#5d9148', '#1b2a14', pc.night);
  const grassCol1 = hexLerp('#2b3422', '#0a1007', pc.night);
  mg.addColorStop(0, grassCol0);
  mg.addColorStop(1, grassCol1);
  cx.fillStyle = mg;
  cx.beginPath();
  cx.moveTo(-10, mY + 6);
  cx.quadraticCurveTo(VW * 0.3, mY - 12, VW * 0.55, mY - 3);
  cx.quadraticCurveTo(VW * 0.8, mY + 5, VW + 10, mY - 5);
  cx.lineTo(VW + 10, VH + 10);
  cx.lineTo(-10, VH + 10);
  cx.closePath(); cx.fill();

  // Draw swaying organic grass blades along the hill edge
  cx.strokeStyle = grassCol0;
  cx.lineWidth = 1.2;
  cx.beginPath();
  for (let x = 0; x < VW; x += 3.5) {
    let y = mY - 3;
    if (x < VW * 0.55) {
      const t = x / (VW * 0.55);
      y = (1-t)*(1-t)*(mY+6) + 2*(1-t)*t*(mY-12) + t*t*(mY-3);
    } else {
      const t = (x - VW * 0.55) / (VW * 0.45);
      y = (1-t)*(1-t)*(mY-3) + 2*(1-t)*t*(mY+5) + t*t*(mY-5);
    }
    const sway = Math.sin(x + frame * 0.035) * 1.5;
    cx.moveTo(x, y + 2);
    cx.lineTo(x + sway, y - 1 - (x % 3));
  }
  cx.stroke();

  // Draw hiking path winding up the hill
  cx.save();
  cx.globalAlpha = 0.75;
  const pg = cx.createLinearGradient(0, mY, 0, VH);
  pg.addColorStop(0, hexLerp('#ceb68f', '#463728', pc.night));
  pg.addColorStop(1, hexLerp('#a68a67', '#322619', pc.night));
  cx.fillStyle = pg;
  cx.beginPath();
  cx.moveTo(VW * 0.45, VH + 5);
  cx.quadraticCurveTo(VW * 0.52, VH - 20, VW * 0.49, VH - 32);
  cx.lineTo(VW * 0.51, VH - 32);
  cx.quadraticCurveTo(VW * 0.54, VH - 20, VW * 0.48, VH + 5);
  cx.closePath(); cx.fill();
  cx.restore();

  // Draw detailed tree assets framing the meadow
  drawTitleTree(VW * 0.08, mY + 6, 0, 0.85, pc.night); // Larch left
  drawTitleTree(VW * 0.16, mY + 4, 1, 0.65, pc.night); // Spruce left
  drawTitleTree(VW * 0.92, mY + 5, 1, 0.82, pc.night); // Spruce right
  drawTitleTree(VW * 0.84, mY + 8, 0, 0.62, pc.night); // Larch right

  // Draw flowers scattered in the grass
  drawTitleFlower(VW * 0.32, mY + 8, 'edel');
  drawTitleFlower(VW * 0.38, mY + 14, 'gent');
  drawTitleFlower(VW * 0.62, mY + 10, 'rose');
  drawTitleFlower(VW * 0.70, mY + 16, 'edel');

  // Re-use detailed boot and book assets
  drawIcon('boots', VW * 0.28, mY + 8, 24);
  drawIcon('book', VW * 0.38, mY + 14, 18);

  // Apply night shading/vignette overlay
  if (pc.night > 0.01) {
    cx.fillStyle = `rgba(12, 16, 34, ${pc.night * 0.42})`;
    cx.fillRect(0, 0, VW, VH);
  }

  // Draw glowing fireflies at night
  if (pc.night > 0.05) {
    for (let i = 0; i < 6; i++) {
      const fx = ((i * 127 + frame * 0.15) % (VW * 0.8)) + VW * 0.1;
      const fy = mY - 10 - ((i * 93 + frame * 0.08) % 40) + Math.sin(frame * 0.04 + i) * 3.5;
      
      cx.fillStyle = `rgba(255, 230, 140, ${0.4 * pc.night * (0.6 + 0.4 * Math.sin(frame * 0.05 + i))})`;
      cx.beginPath(); cx.arc(fx, fy, 1.4, 0, 7); cx.fill();
      
      const rg = cx.createRadialGradient(fx, fy, 0.2, fx, fy, 7);
      rg.addColorStop(0, `rgba(255, 235, 170, ${0.2 * pc.night * (0.6 + 0.4 * Math.sin(frame * 0.05 + i))})`);
      rg.addColorStop(1, 'rgba(255, 235, 170, 0)');
      cx.fillStyle = rg; cx.fillRect(fx - 7, fy - 7, 14, 14);
    }
  }

  // Draw rain overlay if active
  if (pc.rain > 0.01) {
    cx.strokeStyle = `rgba(174,194,224,${0.25 * pc.rain})`;
    cx.lineWidth = 1.0;
    cx.beginPath();
    for (let i = 0; i < 20; i++) {
      const rx = (i * 97 + frame * 3.5) % VW;
      const ry = (i * 137 + frame * 5.5) % VH;
      cx.moveTo(rx, ry); cx.lineTo(rx - 3, ry + 12);
    }
    cx.stroke();
  }

  cx.restore();

  // Subtle top/bottom overlay vignette for reading elements
  const vg = cx.createLinearGradient(0, 0, 0, H * 0.32);
  vg.addColorStop(0, 'rgba(12,14,28,0.45)');
  vg.addColorStop(1, 'rgba(12,14,28,0)');
  cx.fillStyle = vg; cx.fillRect(0, 0, W, H * 0.32);

  const vg2 = cx.createLinearGradient(0, H, 0, H * 0.72);
  vg2.addColorStop(0, 'rgba(12,14,28,0.35)');
  vg2.addColorStop(1, 'rgba(12,14,28,0)');
  cx.fillStyle = vg2; cx.fillRect(0, H * 0.72, W, H * 0.28);
}

function drawTitle() {
  // cycle day phase on the title screen every 15 seconds; phaseColors() detects
  // the change and eases the sky/weather across to the next phase
  if (frame > 0 && frame % 900 === 0) {
    G.phase = (G.phase % 5) + 1;
  }

  cx.save();
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const W = cv.width / DPR, H = cv.height / DPR;
  drawTitleBg(W, H);
  
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  
  // Set pointer cursor on hover
  const hoveredId = hitBtn(mpos);
  cv.style.cursor = hoveredId ? 'pointer' : 'default';

  cx.save();
  
  // Title text gold gradient
  const titleY = H * 0.27;
  setTracking(Math.min(6, W * 0.012));
  
  const tg = cx.createLinearGradient(W / 2, titleY - 25, W / 2, titleY + 25);
  tg.addColorStop(0, '#fefaf0');
  tg.addColorStop(0.5, '#f3ecd2');
  tg.addColorStop(1, '#d0bd92');
  cx.fillStyle = tg;
  cx.font = `bold ${Math.min(50, W * 0.095)}px Georgia, serif`;
  cx.fillText(TX.title, W / 2, titleY);

  setTracking(0);
  cx.font = `italic ${Math.min(15, W * 0.033)}px Georgia, serif`;
  cx.fillStyle = 'rgba(243,236,210,0.95)';
  cx.fillText(TX.subtitle, W / 2, titleY + 34);
  cx.restore();

  // thin rules flanking the subtitle
  const sw = Math.min(W * 0.8, cx.measureText(TX.subtitle).width);
  cx.strokeStyle = 'rgba(243,236,210,0.55)'; cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(W / 2 - sw / 2 - 44, titleY + 34); cx.lineTo(W / 2 - sw / 2 - 14, titleY + 34);
  cx.moveTo(W / 2 + sw / 2 + 14, titleY + 34); cx.lineTo(W / 2 + sw / 2 + 44, titleY + 34);
  cx.stroke();

  // menu: one clear primary action, a quiet secondary, language as a text link
  BTNS = [];
  if (fsSupported) { addBtn('fs', W - 49, 60, 20, isFullscreen() ? 'i:shrink' : 'i:expand'); drawBtn(BTNS[0]); }
  
  const bw2 = Math.min(270, W * 0.72);
  let rowY = H * 0.52;
  const menuCount = hasSave() ? 3 : 2;
  const cardW = bw2 + 40;
  const cardH = (menuCount * 50) + 20;
  const cardX = W / 2 - cardW / 2;
  const cardY = rowY - 30;
  
  // Glassmorphic panel for the menu
  cx.save();
  cx.fillStyle = 'rgba(18, 22, 38, 0.45)';
  cx.strokeStyle = 'rgba(243, 236, 210, 0.18)';
  cx.lineWidth = 1.2;
  cx.shadowColor = 'rgba(10, 10, 18, 0.3)';
  cx.shadowBlur = 10;
  cx.shadowOffsetY = 4;
  roundRect(cardX, cardY, cardW, cardH, 16);
  cx.fill(); cx.stroke();
  cx.restore();

  const prim = (id, label, y) => {
    const isHovered = hoveredId === id;
    const x = W / 2 - bw2 / 2;
    
    cx.save();
    if (isHovered) {
      cx.translate(W / 2, y);
      cx.scale(1.03, 1.03);
      cx.translate(-W / 2, -y);
      cx.shadowColor = 'rgba(240, 217, 162, 0.4)';
      cx.shadowBlur = 8;
      cx.shadowOffsetY = 0;
    }
    
    const pg = cx.createLinearGradient(0, y - 20, 0, y + 20);
    if (isHovered) {
      pg.addColorStop(0, '#fff0c7'); pg.addColorStop(1, '#e2bd7e');
    } else {
      pg.addColorStop(0, '#f0d9a2'); pg.addColorStop(1, '#d8ae6c');
    }
    
    cx.fillStyle = pg; roundRect(x, y - 20, bw2, 40, 12); cx.fill();
    cx.strokeStyle = isHovered ? 'rgba(90,70,30,0.8)' : 'rgba(70,50,18,0.5)';
    cx.lineWidth = isHovered ? 1.5 : 1;
    roundRect(x + 0.5, y - 19.5, bw2 - 1, 39, 12); cx.stroke();
    
    cx.fillStyle = '#2a2210'; cx.font = 'bold 15px Georgia, serif'; cx.fillText(label, W / 2, y + 1);
    cx.restore();
    
    BTNS.push({ id, x: (W / 2) * DPR, y: y * DPR, w: bw2 * DPR, h: 44 * DPR, lr: 0 });
  };
  
  const seco = (id, label, y) => {
    const isHovered = hoveredId === id;
    cx.save();
    if (isHovered) {
      cx.translate(W / 2, y);
      cx.scale(1.03, 1.03);
      cx.translate(-W / 2, -y);
    }
    
    cx.fillStyle = isHovered ? 'rgba(28, 32, 54, 0.82)' : 'rgba(14,17,30,0.62)';
    roundRect(W / 2 - bw2 / 2, y - 16, bw2, 32, 10); cx.fill();
    cx.strokeStyle = isHovered ? 'rgba(243,236,210,0.72)' : 'rgba(243,236,210,0.38)';
    cx.lineWidth = 1; cx.stroke();
    
    cx.fillStyle = isHovered ? '#ffffff' : 'rgba(243,236,210,0.92)';
    cx.font = '13.5px Georgia, serif'; cx.fillText(label, W / 2, y + 1);
    cx.restore();
    
    BTNS.push({ id, x: (W / 2) * DPR, y: y * DPR, w: bw2 * DPR, h: 36 * DPR, lr: 0 });
  };

  const tert = (id, label, y) => {
    const isHovered = hoveredId === id;
    cx.fillStyle = isHovered ? '#ffffff' : 'rgba(243,236,210,0.7)';
    cx.font = '12.5px Georgia, serif'; cx.fillText(label, W / 2, y);
    const lw2 = cx.measureText(label).width;
    cx.strokeStyle = isHovered ? 'rgba(243,236,210,0.7)' : 'rgba(243,236,210,0.3)';
    cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(W / 2 - lw2 / 2, y + 8); cx.lineTo(W / 2 + lw2 / 2, y + 8); cx.stroke();
    BTNS.push({ id, x: (W / 2) * DPR, y: y * DPR, w: (lw2 + 44) * DPR, h: 30 * DPR, lr: 0 });
  };

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
      G.phase = 1;
      G.mode = 'play';
      startIntro();
    }
    // start settled on the current phase — no transition bleeding in from the
    // title screen's phase-cycling
    phasePrev = phaseCur = G.phase;
    phaseLerpT = 1;
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
    valleyWind = 0.65 + Math.sin(frame * 0.006) * 0.3; // gentle, always easterly
    moversTick();
    crumbleTick();
    stonefallTick();
    physTick();
    findInteract();
    if (actEdge && nearInteract) doInteract(nearInteract);
    marmotTick();
    gamsTick();
    npcTick();
    zoneTick();
    lampTick();
    critterTick();

    // Spawn ambient water bubbles rising from bottom of water bodies in view
    if (frame % 12 === 0) {
      const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(WORLD_W - 1, Math.ceil((cam.x + VW) / TILE));
      const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(WORLD_H - 1, Math.ceil((cam.y + VH) / TILE));
      for (let attempt = 0; attempt < 4; attempt++) {
        const tx = Math.floor(x0 + Math.random() * (x1 - x0 + 1));
        const ty = Math.floor(y0 + Math.random() * (y1 - y0 + 1));
        if (grid[ty * WORLD_W + tx] === 4) {
          const bx = tx * TILE + Math.random() * TILE;
          const by = (ty + 1) * TILE - 2;
          spawnPart({
            x: bx,
            y: by,
            vx: (Math.random() - 0.5) * 0.1,
            vy: -0.25 - Math.random() * 0.35,
            t: 60 + Math.random() * 40,
            c: 'rgba(230, 245, 255, 0.55)',
            s: 1.5 + Math.random() * 1.5,
            bubble: true
          });
          break;
        }
      }
    }
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
  drawBgRock(pc);
  for (const t of TREES) drawTree(t[0], t[1], t[2], t[3]);
  for (const f of FLOWERS) drawFlower(f[0], f[1], f[2]);
  drawTiles();
  drawMovers();
  drawCrumble();
  drawStones();
  drawThermals();
  drawSink();
  for (const e of ENTITIES) drawEntity(e);
  drawRings();
  drawGams();
  drawCritters();
  drawPlayer();
  drawWaterOverlay();
  drawWaterfall();
  drawLightShafts(pc);
  rainTick(pc);
  drawRain(pc);
  drawMotes();
  drawParts();
  drawLighting(pc);
  cx.restore();
  ambientTick(pc);
  musicTick();

  drawColorGrade();
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
