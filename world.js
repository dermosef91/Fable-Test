/* =========================================================================
   GIPFELBUCH — world data
   One handcrafted mountain in Südtirol, tile by tile.
   Tile codes: 0 air · 1 rock · 2 scree · 3 one-way plank · 4 water
               5 ferrata cable · 6 nettles
   ========================================================================= */

const TILE = 16;

const WORLD_W = 264;   // x 0..191 the Gamstal · x 192.. the Hinteres Tal (glider country)
const WORLD_H = 80;

function buildWorld() {
  const g = new Uint8Array(WORLD_W * WORLD_H); // 0 = air

  const fill = (x, y, w, h, t) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++)
        if (i >= 0 && i < WORLD_W && j >= 0 && j < WORLD_H) g[j * WORLD_W + i] = t;
  };
  const carve = (x, y, w, h) => fill(x, y, w, h, 0);

  // --- big landforms -----------------------------------------------------
  fill(0, 70, WORLD_W, 10, 1);   // valley floor
  fill(32, 48, 79, 10, 1);       // Alm shelf (x32..110)
  fill(2, 28, 109, 9, 1);        // upper band: Stellung terrace / tunnel floor / Hochband (x2..110)
  carve(4, 28, 7, 9);            // chimney through the band, above the gorge (x4..10)
  fill(10, 28, 1, 1, 1);         // landing lip at the chimney mouth
  carve(11, 33, 21, 4);          // headroom over the gorge slot — full jumps need sky
  fill(28, 8, 45, 14, 1);        // tunnel ceiling massif (x28..72, passage stays open y22..27)
  fill(96, 12, 15, 16, 1);       // headwall above the Hochband (x96..110)
  fill(96, 12, 94, 7, 1);        // ridge band (x96..189)
  carve(171, 12, 3, 7);          // the notch — a clean drop into the pond far below
  fill(156, 10, 11, 2, 1);       // summit cap (x156..166)

  // scree slope: valley (x152, y~70) climbing west to the Alm (x111, y48)
  for (let x = 111; x <= 152; x++) {
    const top = 48 + Math.round(((x - 111) * 22) / 42);
    fill(x, top, 1, Math.max(1, 70 - top), 1);
    fill(x, top, 1, 2, 2); // loose scree skin
  }
  // das Schartl: a stepped notch from the Lärchenschatten up through the rock,
  // opening onto a flat saddle terrace mid-slope — the boots-free way to the
  // east forest. The climb to the Alm continues above it: one deliberate jump
  // onto the scree slab at x128/129, which still demands proper boots.
  for (let i = 0; i <= 8; i++) carve(111 + 2 * i, 67 - i, 2, 3);
  carve(129, 58, 8, 3); // the saddle terrace (floor y61, slab roof at x129)

  // --- gorge ledges (lower climb: valley -> Alm shelf) --------------------
  // even 3-tile risers all the way up
  fill(3, 66, 4, 1, 1);
  fill(9, 63, 3, 1, 1);
  fill(14, 60, 3, 1, 1);
  fill(19, 57, 3, 1, 1);
  fill(24, 54, 3, 1, 1);   // inside the waterfall
  fill(29, 51, 2, 1, 1);
  fill(25, 65, 3, 1, 1);   // hidden ledge behind the falls (journal page)

  // --- gorge ledges (upper climb: Alm shelf -> Stellung terrace) ----------
  // a gentle zig-zag: every hop is at most 3 tiles up and a couple across
  fill(26, 45, 4, 1, 1);   // inside the waterfall, reaching dry air at x29
  fill(21, 42, 3, 1, 1);
  fill(15, 40, 3, 1, 1);
  fill(8, 38, 4, 1, 1);
  fill(4, 35, 3, 1, 1);    // inside the chimney
  fill(8, 32, 3, 1, 1);    // inside the chimney
  fill(4, 29, 3, 1, 1);    // inside the chimney, one easy hop from the lip

  // --- tunnel furniture ----------------------------------------------------
  fill(40, 26, 2, 2, 1);   // rubble heap to hop
  fill(52, 22, 2, 2, 1);   // collapsed lintel to duck past

  // --- water ---------------------------------------------------------------
  fill(23, 70, 11, 3, 4);  // plunge pool under the falls
  fill(167, 70, 7, 3, 4);  // forest pond
  fill(169, 69, 2, 1, 3);  // half-sunk log across the pond (one-way)

  // --- odds and ends -------------------------------------------------------
  fill(188, 69, 1, 1, 1);  // lone boulder, east end
  fill(106, 69, 2, 1, 6);  // nettles in the larch shade
  fill(95, 13, 1, 15, 5);  // via ferrata cable up the headwall
  fill(0, 0, 2, WORLD_H, 1);            // west wall

  // --- Hinteres Tal (post-finale glider country, x192..) --------------------
  fill(190, 0, 2, WORLD_H, 1);   // the massif's east face
  carve(190, 5, 2, 7);           // the slip behind the Flugschule sign (y5..11)
  fill(192, 12, 6, 1, 1);        // launch ledge / Startplatz
  fill(193, 13, 1, 57, 5);       // fixed cable back up the face (for the way home)
  fill(218, 68, 5, 2, 1);        // grassy knoll
  fill(244, 66, 4, 4, 1);        // chapel knoll
  fill(231, 70, 8, 3, 4);        // the lake (carved into valley floor)
  fill(WORLD_W - 2, 0, 2, WORLD_H, 1);  // east wall

  return g;
}

// The waterfall is a force-field rect, not tiles (it pours over ledges).
const WATERFALL = { x: 24, y: 29, w: 4, h: 41 }; // tiles

// Thermal columns in the Hinteres Tal — warm air that lifts a glider.
const THERMALS = [
  { x: 207, y: 16, w: 4, h: 52 },
  { x: 226, y: 14, w: 4, h: 54 },
  { x: 246, y: 18, w: 4, h: 50 },
];

// The flying course: five rings hung in the air. [tileX, tileY of center]
const RINGS = [[210, 36], [222, 24], [233, 46], [247, 30], [256, 55]];

// =========================================================================
// Zones — names show as banners, fill in the paper map, control ambience.
// First match wins; specific before general.
// =========================================================================
const ZONES = [
  { id: 'start',    x: 188, y: 0,  w: 12, h: 14, en: 'Launch Site',           de: 'Startplatz',            it: 'Decollo',               outdoor: true },
  { id: 'hintertal', x: 192, y: 0, w: 72, h: 80, en: 'The Hidden Valley',     de: 'Hinteres Tal',          it: 'Valle nascosta',        outdoor: true },
  { id: 'gipfel',   x: 150, y: 0,  w: 24, h: 12, en: 'The Summit',            de: 'Gipfel',                it: 'Cima Gamsblick',        outdoor: true },
  { id: 'grat',     x: 96,  y: 0,  w: 94, h: 12, en: 'Ridge Path',            de: 'Gratweg',               it: 'Via di cresta',         outdoor: true },
  { id: 'ferrata',  x: 92,  y: 11, w: 6,  h: 18, en: 'Via Ferrata "Rosa"',    de: 'Klettersteig „Rosa“',   it: 'Via ferrata «Rosa»',    outdoor: true },
  { id: 'stellung', x: 2,   y: 17, w: 26, h: 20, en: 'Old Position 1916',     de: 'Alte Stellung 1916',    it: 'Vecchia postazione',    outdoor: true },
  { id: 'stollen',  x: 27,  y: 17, w: 47, h: 13, en: 'The Tunnel',            de: 'Der Stollen',           it: 'La galleria',           dark: true, covered: true },
  { id: 'hochband', x: 73,  y: 17, w: 23, h: 12, en: 'High-Ledge Bivouac',    de: 'Hochband-Biwak',        it: 'Cengia alta',           outdoor: true },
  { id: 'schlucht', x: 2,   y: 37, w: 31, h: 43, en: 'Waterfall Gorge',       de: 'Wasserfallschlucht',    it: 'Gola della cascata',    outdoor: true },
  { id: 'alm',      x: 32,  y: 37, w: 79, h: 21, en: 'Gamsblick Alm',         de: 'Gamsblick-Alm',         it: 'Malga Gamsblick',       outdoor: true },
  { id: 'galerie',  x: 97,  y: 56, w: 15, h: 24, en: 'Larch Shade',           de: 'Im Lärchenschatten',    it: "All'ombra dei larici",  covered: true },
  { id: 'geroell',  x: 111, y: 38, w: 45, h: 34, en: 'The Scree Field',       de: 'Das Geröllfeld',        it: 'Il ghiaione',           outdoor: true },
  { id: 'wald',     x: 156, y: 56, w: 36, h: 24, en: 'Larch Forest & Pond',   de: 'Lärchenwald & Teich',   it: 'Bosco e laghetto',      outdoor: true },
  { id: 'camp',     x: 33,  y: 56, w: 64, h: 24, en: 'Campsite Gamsblick',    de: 'Campingplatz Gamsblick', it: 'Campeggio Gamsblick',  outdoor: true },
];

// =========================================================================
// Day phases — a weekend, not an epic.
// =========================================================================
const PHASES = [
  null,
  { caption: { de: 'Samstag, 6:50 · Sabato', en: 'Saturday, 6:50 am · Samstag' },
    sub: { de: 'Morgennebel im Tal — la nebbia del mattino', en: 'Morning mist in the valley' },
    skyTop: '#7fb2d9', skyBot: '#f4e3c2', sun: 0.18, ambient: 0.00, rain: false },
  { caption: { de: 'Samstag Nachmittag · pomeriggio', en: 'Saturday afternoon · pomeriggio' },
    sub: { de: 'Regen zieht auf — arriva la pioggia', en: 'Rain is rolling in' },
    skyTop: '#6b7d92', skyBot: '#aab4b6', sun: 0.55, ambient: 0.12, rain: true  },
  { caption: { de: 'Samstag Nacht · notte', en: 'Saturday night · notte' },
    sub: { de: 'Der Berg wird still — la montagna tace', en: 'The mountain goes quiet' },
    skyTop: '#0c1430', skyBot: '#27355c', sun: -1,   ambient: 0.66, rain: true  },
  { caption: { de: 'Sonntag, kurz vor sechs · domenica', en: 'Sunday, just before six · domenica' },
    sub: { de: 'Erstes Licht — la prima luce', en: 'First light' },
    skyTop: '#3b3a6e', skyBot: '#ffb37d', sun: 0.08, ambient: 0.18, rain: false },
  { caption: { de: 'Sonntag Vormittag · domenica', en: 'Sunday morning · domenica' },
    sub: { de: 'Kaiserwetter — che giornata', en: 'Not a cloud that matters' },
    skyTop: '#6fb0e0', skyBot: '#eaf4ef', sun: 0.40, ambient: 0.00, rain: false },
];

// =========================================================================
// Entities  (x = tile column, r = tile row of the floor they stand on)
// =========================================================================
const ENTITIES = [
  // -- Campingplatz ---------------------------------------------------------
  { t: 'spawn',    x: 61,  r: 70 },
  { t: 'tent',     x: 57,  r: 70 },
  { t: 'fire',     x: 64,  r: 70, id: 'camp', name: 'Lagerfeuer' },
  { t: 'photo',    x: 66,  r: 70, n: 1 },
  { t: 'sign',     x: 68,  r: 70, key: 'sign_camp' },
  { t: 'npc',      x: 74,  r: 70, who: 'greta' },
  { t: 'dog',      x: 76,  r: 70 },

  // -- Lärchenschatten-Galerie ----------------------------------------------
  { t: 'chestnut', x: 102, r: 70 },
  { t: 'sign',     x: 109, r: 70, key: 'sign_schartl' },
  { t: 'sign',     x: 134, r: 61, key: 'sign_sattel' },

  // -- Geröllfeld -------------------------------------------------------------
  { t: 'marmot',   x: 140, r: 63 },
  { t: 'chestnut', x: 154, r: 70 },

  // -- Lärchenwald & Teich ----------------------------------------------------
  { t: 'shelter',  x: 160, r: 70 },
  { t: 'photo',    x: 166, r: 70, n: 2 },
  { t: 'gear',     x: 162, r: 70, gear: 'boots', key: 'get_boots' },
  { t: 'chestnut', x: 178, r: 70 },
  { t: 'page',     x: 181, r: 70, n: 2 },
  { t: 'marmot',   x: 185, r: 70 },
  { t: 'page',     x: 188, r: 69, n: 0, hide: true }, // (slot kept free — page 2 sits on the path)

  // -- Gamsblick-Alm ----------------------------------------------------------
  { t: 'sign',     x: 56,  r: 48, key: 'sign_almweg' },
  { t: 'sign',     x: 64,  r: 48, key: 'sign_alm' },
  { t: 'cow',      x: 72,  r: 48 },
  { t: 'hut',      x: 84,  r: 48 },
  { t: 'photo',    x: 81,  r: 48, n: 3 },
  { t: 'npc',      x: 90,  r: 48, who: 'norbert' },
  { t: 'fire',     x: 96,  r: 48, id: 'alm', name: 'Feuerstelle der Alm' },
  { t: 'page',     x: 105, r: 48, n: 3 },

  // -- Wasserfallschlucht -------------------------------------------------------
  { t: 'page',     x: 26,  r: 65, n: 4 }, // behind the falls

  // -- Alte Stellung 1916 ---------------------------------------------------------
  { t: 'gear',     x: 11,  r: 28, gear: 'lamp', key: 'get_lamp' },
  { t: 'bunker',   x: 14,  r: 28 },
  { t: 'page',     x: 17,  r: 28, n: 5 },
  { t: 'fire',     x: 20,  r: 28, id: 'stellung', name: 'Feuerstelle an der Stellung' },
  { t: 'photo',    x: 22,  r: 28, n: 4 },
  { t: 'marmot',   x: 24,  r: 28 },

  // -- Stollen ---------------------------------------------------------------------
  { t: 'relic',    x: 56,  r: 28 },
  { t: 'page',     x: 58,  r: 28, n: 6 },

  // -- Hochband ----------------------------------------------------------------------
  { t: 'sign',     x: 75,  r: 28, key: 'sign_hochband' },
  { t: 'plaque',   x: 78,  r: 28 },
  { t: 'gear',     x: 80,  r: 28, gear: 'kit', key: 'get_kit' },
  { t: 'fire',     x: 87,  r: 28, id: 'biwak', name: 'Biwak am Hochband', biwak: true },
  { t: 'marmot',   x: 92,  r: 28 },

  // -- Grat & Gipfel ---------------------------------------------------------------------
  { t: 'sign',     x: 98,  r: 12, key: 'sign_grat' },
  { t: 'marmot',   x: 120, r: 12 },
  { t: 'sign',     x: 167, r: 12, key: 'sign_notch' },
  { t: 'fence',    x: 169, r: 12 },
  { t: 'fence',    x: 175, r: 12 },
  { t: 'cross',    x: 161, r: 10 },
  { t: 'book',     x: 159, r: 10 },
  { t: 'photo',    x: 180, r: 12, n: 5 },
  { t: 'bench',    x: 182, r: 12 },
  { t: 'sign',     x: 186, r: 12, key: 'sign_flug' },

  // -- Hinteres Tal ----------------------------------------------------------------------
  { t: 'windsock', x: 196, r: 12 },
  { t: 'npc',      x: 201, r: 70, who: 'vera' },
  { t: 'fire',     x: 204, r: 70, id: 'flug', name: 'Feuerstelle der Flugschule' },
  { t: 'windsock', x: 210, r: 70 },
  { t: 'chapel',   x: 246, r: 66 },
  { t: 'sign',     x: 256, r: 70, key: 'sign_talende' },
];

// page 1 lives inside the tent; page 7 inside the Gipfelbuch.

const TREES = [
  // [x, floorRow, kind(0 larch,1 spruce), scale]
  [54, 70, 0, 1.0], [80, 70, 0, 0.8], [93, 70, 1, 0.9],
  [99, 70, 1, 0.7], [109, 70, 0, 0.7],
  [156, 70, 0, 1.0], [164, 70, 1, 0.9], [176, 70, 0, 0.9], [184, 70, 0, 0.8],
  [38, 48, 1, 0.7], [46, 48, 0, 0.8], [102, 48, 0, 1.1],
  [62, 48, 0, 0.6],
  [213, 70, 1, 0.9], [224, 70, 0, 1.0], [242, 70, 1, 0.8], [245, 66, 1, 0.6], [259, 70, 0, 0.9],
];

const FLOWERS = [ // alpenrose & friends on the Alm, edelweiss up top
  [66, 48, 'rose'], [78, 48, 'rose'], [100, 48, 'rose'], [108, 48, 'rose'],
  [110, 12, 'gent'], [134, 12, 'gent'], [152, 12, 'gent'],
  [164, 10, 'edel'], [157, 10, 'edel'],
  [215, 70, 'gent'], [221, 68, 'rose'], [228, 70, 'gent'], [247, 66, 'gent'], [253, 70, 'rose'],
];

// Background rock faces (drawn faded, behind the action — they sell the mountain)
const BG_ROCK = [
  { x: 96, y: 19, w: 94, h: 51 },             // the great south face under the ridge
  { x: 2,  y: 37, w: 31, h: 33 },             // gorge wall
  { x: 73, y: 0,  w: 23, h: 17 },             // couloir above the Hochband
  { x: 2,  y: 0,  w: 26, h: 28 },             // shoulder above the Stellung
  { x: 27, y: 17, w: 47, h: 13, cave: true }, // backwall of the Stollen
];

// =========================================================================
// TEXTS — German original
// =========================================================================
const TX_DE = {
  title: 'GIPFELBUCH',
  subtitle: 'Ein Wochenende in Südtirol · Un fine settimana',
  pressStart: 'Tippen oder Taste drücken · tocca per iniziare',
  continueGame: 'Weiterwandern (Spielstand)',
  newGame: 'Neue Wanderung',

  intro: [
    'Freitag, 22:40. Campingplatz Gamsblick, Südtirol.',
    'Ein Wochenende. Ein Zelt. Kein Empfang.',
    'Und in der Seitentasche des Rucksacks: ein Tagebuch von 1974,',
    'das Oma Rosa dir vererbt hat. Erste Seite: „Fang irgendwo an.“',
  ],

  // ---- journal pages ----
  pages: [
    null,
    ['Tagebuch, Seite 1 — Fr., 12. Juli 1974',
     '„Ida und ich haben das Zelt dort aufgestellt, wo die Lärchen anfangen.',
     'Papa sagt, Mädchen haben auf der Gamswand nichts verloren.',
     'Wir werden ja sehen.“'],
    ['Tagebuch, Seite 2 — Sa. früh',
     '„Den alten Teich gefunden. Ida schwört, die Murmeltiere',
     'pfeifen im Dialekt. Eingepackt: Brot, Speck —',
     'und Mamas Regenjacke. Nur für den Fall.“'],
    ['Tagebuch, Seite 3 — Sa. mittag',
     '„Der Sohn vom Hüttenwirt hat uns Knödel gegeben und nicht',
     'über unseren Plan gelacht. Der Erste, der nicht lacht.',
     'Er heißt Toni.“'],
    ['Tagebuch, Seite 4 — Sa. nachmittag',
     '„Durch den Wasserfall! Nass bis auf die Knochen, trotzdem.',
     'Ida hat Tränen gelacht — oder es war das Wasser.',
     'Das ist der Weg, den die Gämsen nehmen.“'],
    ['Tagebuch, Seite 5 — Sa. abend',
     '„Unterschlupf in der alten Stellung. Großvater war 1916 hier oben.',
     'Ida hat eine Kerze angezündet, für die Buben auf beiden Seiten.',
     'Dem Berg sind Grenzen egal.“'],
    ['Tagebuch, Seite 6 — Sa. nacht',
     '„Durch den Stollen, bei Kerzenlicht. Hand in Hand, ehrlich gesagt.',
     'Wer das hier gegraben hat, hat den Himmel',
     'genauso vermisst wie wir.“'],
    ['Tagebuch, letzte Seite — So., Morgengrauen',
     '„…“',
     'Die Seite ist herausgerissen. Darunter, mit Bleistift:',
     '„Das Gipfelbuch weiß den Rest.“'],
  ],

  // ---- gear pickups ----
  get_boots: [
    'Im Unterstand: feste Wanderschuhe, fast deine Größe.',
    'Ein Zettel: „Mitnehmen, eingelaufen zurückbringen. — P.“',
    'WANDERSCHUHE — auf Geröll trittsicher. Scarponi: passo sicuro sul ghiaione.',
  ],
  get_lamp: [
    'In der Stellung hängt eine Grubenlampe. Geputzt. Geölt.',
    'Jemand kommt seit Jahren hierher und hält sie bereit.',
    'STIRNLAMPE — Licht im Dunkel. Lampada: luce nel buio.',
  ],
  get_kit: [
    'Am Einstieg hängt ein Klettersteigset über dem Anker, wie frisch geprüft.',
    'Daneben die Plakette: „Steig der Rosa, erbaut 1975 —',
    'für die, die zuerst oben war. Per chi arrivò prima.“',
    'KLETTERSTEIGSET — Seile sind jetzt Wege. Set da ferrata: le funi diventano sentieri.',
  ],
  get_jacket: [
    'Norbert verschwindet in der Hütte und kommt mit einer roten,',
    'x-mal geflickten Regenjacke zurück. Innen, verblasst: R.O.',
    '„Die hängt hier seit 1974. I glab, dö g\'hört dir.“',
    'REGENJACKE — der Wasserfall ist jetzt ein Weg. Giacca: la cascata è una porta.',
  ],

  // ---- signs ----
  sign_camp:    ['„Lärchenwald & Teich → durchs Schartl · Wasserfall 20 min ←“', '„Bosco e laghetto → · Cascata ←“ — und in Filzstift: „Knödel!!“'],
  sign_schartl: ['„Durchs Schartl → Lärchenwald, Teich, Unterstand.“', '„Attraverso la forcella → bosco e laghetto.“ Die Stufen sind ausgetreten — hier gehen alle durch.'],
  sign_sattel:  ['„↖ Gamsblick-Alm übers Geröll — NUR mit festen Schuhen! / solo con scarponi!“', '„↙ Schartl: Campingplatz · → Wald & Teich“'],
  sign_almweg:  ['„Wasserfallsteig ↓ — nur für Gämsen und Sture.“', '„Sentiero della cascata — solo per camosci e testardi.“'],
  sign_alm:     ['„Gamsblick-Alm, 1924. Heute: Kastanienwochen!“', '„Malga Gamsblick — settimane della castagna!“'],
  sign_hochband:['„Klettersteig ‚Rosa‘ → · Biwak · Nur mit Set / solo con set!“'],
  sign_grat:    ['„Gipfel / Cima 20 min →“', 'Darunter, eingeritzt und fast verwittert: „R + I 1974“'],
  sign_notch:   ['„ACHTUNG SCHARTE! / ATTENZIONE!“', 'Kleiner, in Bleistift: „Der Zinnensprung. Unten ist der Teich. Angeblich.“'],
  sign_flug:    ['„Flugschule Gamstal — demnächst / prossimamente.“', 'Der Berg ist hier noch nicht fertig.'],

  flug_unlock: [
    'Hinter dem Schild lehnt ein Paket in Wachstuch. Ein Zettel:',
    '„Für die Enkelin von der Rosa. Der Berg hat dir das Gehen gezeigt —',
    'jetzt zeigen wir dir das Fliegen. — Die Gamstaler Bergfreunde“',
    'GLEITSCHIRM — halte SPRINGEN in der Luft, RUNTER zum Sturzflug.',
    'Und: hinterm Schild ist ein schmaler Durchschlupf frei. Dahinter wartet das Hintere Tal.',
  ],
  gate_flug: 'Hinterm Schild geht es nur noch hinunter. Ohne Gleitschirm wäre das ein Abschied.',
  sign_talende: ['„Talende. / Fine valle.“', 'Kleiner, in Kreide: „Wer bis hierher fliegt, hat es verdient, kurz zu sitzen.“'],
  chapel: [
    ['', 'Eine winzige Kapelle, kaum größer als ein Heuschober.'],
    ['', 'Drinnen brennt eine Kerze, die niemand brennen sehen muss. Du lässt sie brennen.'],
  ],
  toast_thermal: 'THERMIK! Die warme Luft trägt dich nach oben. · Termica!',
  toast_ring: n => `Ring ${n}/5 · Anello ${n}/5`,
  toast_rings_done: 'ALLE RINGE! Zurück zu Vera. · Tutti gli anelli!',

  vera: {
    first: [
      ['Vera', 'Na sowas. Rosas Schirm! Den hab ich zuletzt überm Gamstal gesehen, da war ich zehn.'],
      ['Vera', 'Vera. Flugschule Gamstal — bis jetzt bestand die aus mir und dem Windsack.'],
      ['Vera', 'Hier hinten steigt die warme Luft in Säulen. Thermik. Flieg hinein und kreise — sie trägt dich nach oben.'],
      ['Vera', 'Magst eine Übung? Fünf Ringe hängen im Tal. Alle fünf, und du bist offiziell meine erste Flugschülerin.'],
    ],
    partial: [
      ['Vera', 'Noch nicht alle Ringe. Die Thermik ist deine Freundin: reinfliegen, steigen lassen, weiter.'],
      ['Vera', 'Der hohe Ring überm See ist gemein, ich weiß. Der ist mit Absicht gemein.'],
    ],
    done: [
      ['Vera', 'Alle fünf! Dann bist du hiermit Flugschülerin Nummer eins der Flugschule Gamstal.'],
      ['Vera', 'Diplom folgt per Post. Knödel gibt es sofort — und der Schirm gehört jetzt wirklich dir.'],
      ['Vera', 'Rosa wäre… na. Du weißt schon. Flieg noch eine Runde. Für sie.'],
    ],
    after: [
      ['Vera', 'Schöner Stil da oben. Der Windsack ist beeindruckt, und der lobt nie.'],
    ],
  },

  // ---- Omas Fotos: five 1974 photographs, found where they were taken ----
  photos: [
    null,
    { title: 'Zelt unter den Lärchen',
      back: 'Auf der Rückseite, Bleistift: „Tag eins. Ida hat die Heringe vergessen. Wir haben gelacht und Steine genommen.“' },
    { title: 'Ida am Teich, barfuß',
      back: 'Rückseite: „Sie sagt, das Wasser ist warm. Sie lügt.“' },
    { title: 'Toni vor der Hütte, verlegen',
      back: 'Rückseite: „Er hat uns Knödel eingepackt. Für den Gipfel, hat er gesagt. Als wäre es ausgemacht, dass wir ankommen.“' },
    { title: 'Eine Kerze in der Stellung',
      back: 'Rückseite: „Für die Buben, auf beiden Seiten. Ida war ganz still. Ich auch.“' },
    { title: 'Drei bleiche Zinnen im Abendlicht',
      back: 'Rückseite: „Drei Schwestern, sagt Ida. Wie wir, nur älter.“' },
  ],
  toast_photo: n => `Omas Foto gefunden! (${n}/5) · Fotografia trovata!`,
  photo_hint: 'Hier hat jemand fotografiert — das Licht stimmt genau.',
  photo_close: 'Tippen · tocca',

  // ---- the Gams ----
  toast_gams: 'Eine Gams! Sie kennt den Weg — Oma hat es geschrieben.',
  gams_rest: ['', 'Die Gams bleibt liegen und schaut dich an. Kein Fluchttier mehr, heute nicht. Ihr habt Zeit.'],

  // ---- the finale ----
  finale_arrive: [
    'Das Gipfelkreuz. Eine Blechdose, festgebunden mit Reepschnur.',
    'Darin: das Gipfelbuch — und etwas, das in Wachspapier gewickelt ist.',
  ],
  finale_book: [
    'Du blätterst zurück. Juli 1974. Da:',
    '„Rosa & Ida. Zwei Madln, erstes Licht. Wir waren hier.“',
    'Und darunter, in Omas Handschrift, an dich gerichtet:',
    '„Enkelkind — der Berg war nie das Schwere.',
    'Das Schwere ist anfangen. Fang irgendwo an.“',
    'Im Wachspapier: ein Foto. Zwei junge Frauen an genau diesem Kreuz,',
    'dazu ein gepresstes Edelweiß, noch immer weiß.',
  ],
  finale_ida: [
    'Ganz hinten im Buch, andere Tinte, 1999:',
    '„Bin allein zurückgekommen. Sie wäre mir davongerannt,',
    'die ganze Wand hinauf. — Ida.“',
  ],
  finale_write: [
    'Du nimmst den Stift, der an der Dose hängt, und schreibst:',
    '„Sonntag, erstes Licht. Ich war hier. Mit euch.“',
  ],

  // ---- NPC dialogue ----
  greta: {
    first: [
      ['Greta', 'Morgen! Du bist die vom blauen Zelt, oder? Kaffee ist noch heiß.'],
      ['Greta', 'Strolch hat heut Nacht dein Vorzelt bewacht. Unbezahlt, wie immer.'],
      ['Greta', 'Was hast denn da — ein Tagebuch? Zeig her… Rosa Oberhofer?'],
      ['Greta', 'Kind. Rosa Oberhofer und Ida Demetz waren die Ersten, die als Frauen über die Gamswand-Nordkante sind. Wusstest du das nicht?'],
      ['Du', '…Oma hat nie davon erzählt. Sie hat gesagt, sie sei „ein bisschen gewandert“.'],
      ['Greta', '„Ein bisschen gewandert.“ Typisch Rosa. — Geh nach OSTEN, durchs Schartl hinter dem Lärchenschatten. Im Wald steht ein Unterstand, da findet sich immer was.'],
      ['Greta', 'Denn mit Turnschuhen kommst du auf dem Geröll keine zwei Meter weit, das sag ich dir gleich.'],
    ],
    boots: [
      ['Greta', 'Schuhe hast du schon mal. Der Geröllweg zur Alm fängt hinterm Teichwald an — immer schön im Tritt bleiben.'],
      ['Greta', 'Und grüß den Norbert oben. Sag ihm, er schuldet mir noch ein Schnapsl.'],
    ],
    jacket: [
      ['Greta', 'Rosas Jacke! Die kenn ich von Fotos. Steht dir.'],
      ['Greta', 'Bei Regen geht der Wasserfallsteig — sagt man. Gämsen und Sture, du weißt schon.'],
    ],
    night: [
      ['Greta', 'Um die Zeit noch unterwegs? Na. Rosa hätt das gefallen.'],
    ],
    done: [
      ['Greta', 'Du warst oben. Man sieht\'s — ihr habt alle denselben Blick danach.'],
      ['Greta', 'Strolch! Platz. Er gratuliert nur.'],
    ],
  },

  norbert: {
    first: [
      ['Norbert', 'Griaß di! Selten, dass wer den Geröllweg rauf kommt statt mit dem Auto die Forststraße.'],
      ['Norbert', 'Hunger? Knödel hätt ich — aber die Kastanienwochen haben mich ruiniert. Drei Kastanien aus dem Tal, und ich mach dir Knödel UND einen Gefallen.'],
      ['Norbert', 'Drei Stück. Die guten liegen unten beim Wald und am Teich. Tre castagne, capito?'],
    ],
    partial: [
      ['Norbert', 'Das sind noch keine drei Kastanien. Schau beim Teich, unter den alten Lärchen.'],
    ],
    complete: [
      ['Norbert', 'Drei Kastanien! Ein Wort ist ein Wort. Knödelwasser ist schon auf.'],
      ['Du', '…die besten Knödel meines Lebens. Ehrlich.'],
      ['Norbert', 'I woaß. — Du, das Tagebuch da auf deinem Tisch. Darf ich? …Rosa.'],
      ['Norbert', 'Mein Vater Toni hat von der Rosa erzählt bis zu seinem letzten Tag. „Die zwei Madln“, hat er gesagt, „sind dem Berg davongelaufen.“'],
      ['Norbert', 'Wart. Wenn du Rosas Enkelin bist, dann gehört dir was aus der Hütte.'],
    ],
    after: [
      ['Norbert', 'Der Wasserfallsteig fängt drüben hinter der Brücke an, immer der Gischt nach.'],
      ['Norbert', 'Wenn\'s dunkel wird: in der alten Stellung oben hängt seit Jahren eine Lampe. Frag nicht, wer sie ölt.'],
    ],
    done: [
      ['Norbert', 'Du warst oben! Heut gehen die Knödel aufs Haus. Alle.'],
      ['Norbert', 'Und im Herbst, zum Törggelen, kommst wieder. Versprochen ist versprochen.'],
    ],
  },

  cow: [['Kuh', 'Muh.'], ['Kuh', '(Sie ist von deiner Mission sichtlich unbeeindruckt.)']],
  dog: [['Strolch', 'Wuff! Wuff!'], ['Greta', '(aus der Ferne) Strolch! Lass die Bergsteigerin in Ruh!']],
  bench: [
    ['', 'Ein Bankl, genau richtig gestellt. Du schaust lange ins Tal.'],
    ['', 'Drei Täler weiter stehen drei bleiche Zinnen im Licht, wie hingestellt und vergessen.'],
    ['', '(Ausruhen auf Bänken: wärmt fast wie ein Feuer.)'],
  ],
  relic: [
    ['', 'Eine Kiste, ein verrosteter Helm, ein Stück Telefondraht. 1916.'],
    ['', 'Jemand hat zwei Blumen daraufgelegt. Sie sind noch frisch.'],
  ],
  plaque: [
    ['', '„Steig der Rosa — erbaut 1975 von den Gamstaler Bergfreunden,'],
    ['', 'für die, die zuerst oben war. / Per chi arrivò prima.“'],
    ['', 'Oma. Sie haben ihn nach Oma benannt.'],
  ],
  bunker_look: [
    ['', 'Die alte Stellung. Schießscharten Richtung Süden, Stille Richtung überall.'],
    ['', 'Hundert Jahre, und der Beton riecht immer noch nach Winter.'],
  ],
  shelter_look: [['', 'Ein offener Unterstand: Brennholz, eine Bank, eine Blechkiste — „Nimm was, lass was“.']],

  // ---- tent / fires ----
  tent_first: [
    'Du kriechst ins Zelt. In der Seitentasche: Omas Tagebuch.',
    'Es riecht nach Harz und nach 1974.',
  ],
  tent_rest: 'Im Zelt rasten? Wärmt auf & speichert. · Riposare?',
  fire_rest: 'Am Feuer rasten? Wärmt auf & speichert. · Riposare al fuoco?',
  biwak_blocked: [
    'Der Einstieg ist zum Greifen nah — aber deine Arme sind Knödelteig',
    'und der Steig im Dunkeln lebensmüde. Erst biwakieren.',
  ],
  biwak_sleep: [
    'Du rollst die Matte unters Hochband. Irgendwo pfeift ein Murmeltier im Schlaf.',
    'Du träumst von zwei Frauen, die lachend eine Wand hinaufsteigen.',
  ],

  // ---- system / toasts ----
  toast_slip: 'Du rutschst ab! Ohne feste Schuhe kein Halt im Geröll. · Si scivola!',
  toast_fall_water: 'Ohne Jacke drückt dich der Wasserfall einfach hinunter.',
  toast_dark: 'Stockfinster. Ohne Licht traust du dich kaum einen Schritt.',
  toast_cable: 'Ein Stahlseil. Ohne Klettersteigset bleibt es nur Dekoration.',
  toast_cable_ok: 'HOCH drücken zum Einhängen · SU per agganciarsi',
  toast_cold: 'Dir wird kalt! Such ein Feuer. · Hai freddo!',
  toast_knoedel: 'KNÖDEL! Maximale Wärme erhöht. · Canederli: calore massimo +',
  toast_chestnut: n => `Kastanie! (${n}/3) · Castagna!`,
  toast_marmot: n => `Murmeltier entdeckt! (${n}/5) · Marmotta avvistata!`,
  toast_page: n => `Tagebuchseite ${n}/7 · Pagina ${n}/7`,
  toast_sprung: 'DER ZINNENSPRUNG! Oma wäre stolz. Und entsetzt. Aber stolz.',
  toast_stumble: 'Autsch. Das war kein Gämsensprung.',
  toast_saved: 'Gespeichert · Salvato',
  cold_respawn: 'Durchgefroren bis auf die Knochen kehrst du zum letzten Feuer zurück.',

  objectives: {
    start:    'Sieh dich am Campingplatz um (Zelt, Greta, Lagerfeuer)',
    boots:    'Nach OSTEN → durchs Schartl in den Wald: im Unterstand sollen Schuhe sein',
    alm:      'Der Geröllweg zur Gamsblick-Alm ist jetzt machbar',
    chestnut: 'Drei Kastanien für Norbert (Wald & Teich)',
    jacket:   'Der Wasserfallsteig — Gämsen und Sture',
    lamp:     'Hinter der Schlucht: die alte Stellung. Dort soll eine Lampe hängen',
    tunnel:   'Durch den Stollen von 1916',
    biwak:    'Zu dunkel zum Klettern — biwakiere am Hochband',
    summit:   'Der Klettersteig „Rosa“. Erstes Licht. Der Gipfel.',
    free:     'Das Wochenende gehört dir — finde die Orte von Omas fünf Fotos! (Und: Murmeltiere? Zinnensprung? Flugschule?)',
  },

  title_continue: 'Weiterwandern · continua',
  title_new: 'Neu beginnen · ricomincia',
  title_start: 'Los geht\'s · si parte',

  ending_title: 'GIPFELBUCH',
  ending_sub: 'Demo-Ende · Fine della demo',
  ending_thanks: 'Danke fürs Wandern! · Grazie per la camminata!',
  ending_freeroam: 'Weiter erkunden: Tippen · continua a esplorare',

  map_title: 'Wanderkarte Gamstal · Carta escursionistica',
  map_close: 'M / 🗺 zum Schließen · chiudi',
  map_here: 'Du bist hier:',
  album_btn: '📷 Album',
  album_title: 'Omas Fotos · Le fotografie',
  album_hint: 'Antippen zum Ansehen · tocca per vedere',
  obj_prefix: 'Ziel: ',
  newobj_prefix: 'Neues Ziel: ',
  rested: 'Kurz gerastet. Wärme aufgefüllt, Spielstand gespeichert. · Riposato e salvato.',
  continue_caption: 'Weiter geht\'s · si continua',
  ctl_hint1: '← → laufen · Leertaste springen · E benutzen · M Karte',
  ctl_hint2: 'Ein Spaziergang, kein Kampf. · Niente combattimenti, solo montagna.',
  lang_btn: '🌐 Language: English?',
  photos_unlocked: 'In der Blechdose stecken noch fünf Fotos von 1974. Finde die Orte, an denen sie aufgenommen wurden!',
  st_time: m => `Wanderzeit: ${m} min`,
  st_pages: (a, b) => `Tagebuchseiten: ${a}/7 · Omas Fotos: ${b}/5`,
  st_animals: (a, b) => `Murmeltiere: ${a}/5 · Gams gesehen: ${b}×`,
  st_sprung: y => `Zinnensprung: ${y ? 'JA!' : 'noch nicht…'}`,
  st_knoedel: y => `Knödel: ${y ? 'die besten deines Lebens' : 'verpasst?!'}`,
  st_flug: (f, g, n) => `Flugschule: ${f ? 'FLUGSCHÜLERIN NR. 1' : g ? `Ringe ${n}/5` : 'demnächst…'}`,
};

// =========================================================================
// TEXTS — English (default), keeping the valley's German & Italian voice
// =========================================================================
const TX_EN = {
  title: 'GIPFELBUCH',
  subtitle: 'A camping weekend in Südtirol · the summit book',
  pressStart: 'Tap or press any key to start',
  continueGame: 'Continue your hike',
  newGame: 'New hike',

  intro: [
    'Friday, 10:40 pm. Campsite Gamsblick, Südtirol, Italy.',
    'One weekend. One tent. No signal.',
    'And in the side pocket of your pack: a journal from 1974,',
    'left to you by Oma Rosa. First page: "Begin somewhere."',
  ],

  pages: [
    null,
    ['Journal, page 1 — Fri, July 12th, 1974',
     '"Ida and I pitched the tent where the larches begin.',
     'Papa says girls have no business on the Gamswand.',
     'We shall see about that."'],
    ['Journal, page 2 — Sat, early',
     '"Found the old pond. Ida swears the marmots',
     'whistle in dialect. Packed: bread, Speck —',
     'and Mama\'s rain jacket. Just in case."'],
    ['Journal, page 3 — Sat, noon',
     '"The hut keeper\'s son gave us Knödel and didn\'t laugh',
     'at our plan. The first one who hasn\'t laughed.',
     'His name is Toni."'],
    ['Journal, page 4 — Sat, afternoon',
     '"Through the waterfall! Soaked to the bone anyway.',
     'Ida laughed herself to tears — or it was the water.',
     'This is the way the chamois take."'],
    ['Journal, page 5 — Sat, evening',
     '"Shelter in the old position. Grandfather was up here in 1916.',
     'Ida lit a candle for the boys on both sides.',
     'The mountain does not care for borders."'],
    ['Journal, page 6 — Sat, night',
     '"Through the tunnel by candlelight. Hand in hand,',
     'to be honest. Whoever dug this missed the sky',
     'as much as we did."'],
    ['Journal, last page — Sun, first light',
     '"…"',
     'The page is torn out. Below, in pencil:',
     '"The Gipfelbuch knows the rest."'],
  ],

  get_boots: [
    'In the shelter: sturdy hiking boots, almost your size.',
    'A note: "Take them, bring them back broken in. — P."',
    'HIKING BOOTS — sure-footed on scree. Wanderschuhe!',
  ],
  get_lamp: [
    'A miner\'s lamp hangs in the old position. Polished. Oiled.',
    'Someone has been coming up here for years, keeping it ready.',
    'HEADLAMP — light in the dark. Stirnlampe!',
  ],
  get_kit: [
    'A via ferrata set hangs over the anchor, as if freshly checked.',
    'Beside it, the plaque: "Steig der Rosa, built 1975 —',
    'for the one who got up first. Per chi arrivò prima."',
    'FERRATA SET — cables are paths now. Klettersteigset!',
  ],
  get_jacket: [
    'Norbert disappears into the hut and returns with a red',
    'rain jacket, patched a dozen times. Inside, faded: R.O.',
    '"It\'s been hanging here since 1974. I reckon it\'s yours."',
    'RAIN JACKET — the waterfall is a doorway now. Regenjacke!',
  ],

  sign_camp:    ['"Larch forest & pond → through the Schartl · Waterfall 20 min ←"', 'And in marker pen: "KNÖDEL!!"'],
  sign_schartl: ['"Through the Schartl → larch forest, pond, shelter."', 'The steps are worn smooth — everyone comes this way.'],
  sign_sattel:  ['"↖ Gamsblick Alm over the scree — ONLY with proper boots!"', '"↙ Schartl: campsite · → forest & pond"'],
  sign_almweg:  ['"Waterfall route ↓ — for chamois and the stubborn only."', '"Sentiero della cascata — solo per camosci e testardi."'],
  sign_alm:     ['"Gamsblick Alm, est. 1924. This week: chestnut weeks!"', '"Malga Gamsblick — settimane della castagna!"'],
  sign_hochband:['"Via ferrata \'Rosa\' → · Bivouac · Set required / solo con set!"'],
  sign_grat:    ['"Summit / Cima 20 min →"', 'Below, carved and nearly weathered away: "R + I 1974"'],
  sign_notch:   ['"CAUTION — GAP! / ATTENZIONE!"', 'Smaller, in pencil: "The Zinnensprung. The pond is down there. Allegedly."'],
  sign_flug:    ['"Flight school Gamstal — coming soon / prossimamente."', 'The mountain is not finished here yet.'],

  flug_unlock: [
    'Behind the sign leans a parcel wrapped in waxed cloth. A note:',
    '"For Rosa\'s granddaughter. The mountain taught you to walk —',
    'now we teach you to fly. — The Gamstal mountain friends"',
    'PARAGLIDER — hold JUMP in mid-air. DOWN to dive.',
    'And: the narrow slip behind the sign is open. The hidden valley waits.',
  ],
  gate_flug: 'Behind the sign it only goes down. Without a paraglider, that would be goodbye.',
  sign_talende: ['"Valley\'s end. / Fine valle."', 'Smaller, in chalk: "Whoever flies this far has earned a moment on a bench."'],
  chapel: [
    ['', 'A tiny chapel, hardly bigger than a hay shed.'],
    ['', 'Inside burns a candle that nobody needs to see burning. You let it burn.'],
  ],
  toast_thermal: 'THERMAL! The warm air carries you upward.',
  toast_ring: n => `Ring ${n}/5!`,
  toast_rings_done: 'ALL FIVE RINGS! Back to Vera.',

  vera: {
    first: [
      ['Vera', 'Well now. Rosa\'s glider! Last time I saw that over the Gamstal, I was ten.'],
      ['Vera', 'Vera. Flight school Gamstal — until now it was just me and the windsock.'],
      ['Vera', 'Back here the warm air rises in columns. Thermals. Fly in and circle — they\'ll carry you up.'],
      ['Vera', 'Fancy an exercise? Five rings hang over the valley. All five, and you\'re officially my first student.'],
    ],
    partial: [
      ['Vera', 'Not all the rings yet. The thermal is your friend: fly in, let it lift you, carry on.'],
      ['Vera', 'The high one over the lake is mean, I know. It\'s mean on purpose.'],
    ],
    done: [
      ['Vera', 'All five! Then you are hereby student number one of flight school Gamstal.'],
      ['Vera', 'Diploma comes by post. Knödel come now — and the glider is truly yours.'],
      ['Vera', 'Rosa would be… well. You know. Fly one more round. For her.'],
    ],
    after: [
      ['Vera', 'Nice style up there. The windsock is impressed, and it never compliments anyone.'],
    ],
  },

  photos: [
    null,
    { title: 'Tent under the larches',
      back: 'On the back, in pencil: "Day one. Ida forgot the tent pegs. We laughed and used stones."' },
    { title: 'Ida at the pond, barefoot',
      back: 'On the back: "She says the water is warm. She lies."' },
    { title: 'Toni outside the hut, bashful',
      back: 'On the back: "He packed us Knödel. For the summit, he said. As if it were settled that we\'d make it."' },
    { title: 'A candle in the old position',
      back: 'On the back: "For the boys, on both sides. Ida was very quiet. So was I."' },
    { title: 'Three pale peaks in evening light',
      back: 'On the back: "Three sisters, Ida says. Like us, only older."' },
  ],
  toast_photo: n => `Found one of Oma's photos! (${n}/5)`,
  photo_hint: 'Someone took a photograph here — the light is exactly right.',
  photo_close: 'Tap to continue',

  toast_gams: 'A chamois! She knows the way — Oma wrote it.',
  gams_rest: ['', 'The chamois stays where she lies and watches you. Not a fleeing animal anymore — not today. You both have time.'],

  finale_arrive: [
    'The summit cross. A tin box, lashed on with cord.',
    'Inside: the Gipfelbuch — the summit book — and something wrapped in wax paper.',
  ],
  finale_book: [
    'You leaf back. July 1974. There:',
    '"Rosa & Ida. Two girls, first light. We were here."',
    'And beneath it, in Oma\'s handwriting, addressed to you:',
    '"Grandchild — the mountain was never the hard part.',
    'The hard part is beginning. Begin somewhere."',
    'In the wax paper: a photo. Two young women at this very cross,',
    'and a pressed Edelweiss, still white.',
  ],
  finale_ida: [
    'At the very back of the book, different ink, 1999:',
    '"Came back alone. She would have raced me',
    'all the way up the wall. — Ida."',
  ],
  finale_write: [
    'You take the pencil that hangs from the box and write:',
    '"Sunday, first light. I was here. With you both."',
  ],

  greta: {
    first: [
      ['Greta', 'Morning! You\'re the one from the blue tent, no? Coffee\'s still hot.'],
      ['Greta', 'Strolch guarded your porch all night. Unpaid, as always.'],
      ['Greta', 'What have you got there — a journal? Let me see… Rosa Oberhofer?'],
      ['Greta', 'Child. Rosa Oberhofer and Ida Demetz were the first women over the Gamswand north edge. You didn\'t know?'],
      ['You', '…Oma never told me. She said she used to "hike a little".'],
      ['Greta', '"Hike a little." Typical Rosa. — Go EAST, through the Schartl behind the larch shade. There\'s an open shelter in the forest; something useful always turns up there.'],
      ['Greta', 'Because in sneakers you won\'t get two metres up that scree, I\'ll tell you that for free.'],
    ],
    boots: [
      ['Greta', 'Boots — that\'s a start. The scree path to the Alm begins past the pond woods. Keep a steady step.'],
      ['Greta', 'And greet Norbert up there. Tell him he still owes me a Schnapsl.'],
    ],
    jacket: [
      ['Greta', 'Rosa\'s jacket! I know it from photographs. It suits you.'],
      ['Greta', 'In rain, the waterfall route goes — so they say. Chamois and the stubborn, you know.'],
    ],
    night: [
      ['Greta', 'Out at this hour? Well. Rosa would have liked that.'],
    ],
    done: [
      ['Greta', 'You were up there. One can tell — you all come down with the same look.'],
      ['Greta', 'Strolch! Sit. He\'s only congratulating you.'],
    ],
  },

  norbert: {
    first: [
      ['Norbert', 'Griaß di! Rare thing, someone coming up the scree path instead of driving the forest road.'],
      ['Norbert', 'Hungry? I\'d make Knödel — but the chestnut weeks have ruined me. Three chestnuts from the valley, and I\'ll make you Knödel AND do you a favour.'],
      ['Norbert', 'Three. The good ones lie down by the forest and the pond. Capito?'],
    ],
    partial: [
      ['Norbert', 'That\'s not three chestnuts yet. Look by the pond, under the old larches.'],
    ],
    complete: [
      ['Norbert', 'Three chestnuts! A word is a word. The Knödel water is already on.'],
      ['You', '…the best Knödel of my life. Honestly.'],
      ['Norbert', 'I know. — That journal on your table there. May I? …Rosa.'],
      ['Norbert', 'My father Toni talked about Rosa to his last day. "The two girls," he said, "outran the mountain."'],
      ['Norbert', 'Wait. If you\'re Rosa\'s granddaughter, then something in this hut belongs to you.'],
    ],
    after: [
      ['Norbert', 'The waterfall route starts over there past the bridge — follow the spray.'],
      ['Norbert', 'When it gets dark: in the old position up top a lamp has hung for years. Don\'t ask who oils it.'],
    ],
    done: [
      ['Norbert', 'You made the top! Today the Knödel are on the house. All of them.'],
      ['Norbert', 'And in autumn, for Törggelen, you come back. A promise is a promise.'],
    ],
  },

  cow: [['Cow', 'Muh.'], ['Cow', '(She is visibly unimpressed by your quest.)']],
  dog: [['Strolch', 'Woof! Woof!'], ['Greta', '(from afar) Strolch! Leave the mountaineer be!']],
  bench: [
    ['', 'A little bench, placed exactly right. You look into the valley for a long time.'],
    ['', 'Three valleys over, three pale peaks stand in the light, as if set down and forgotten.'],
    ['', '(Resting on benches warms you almost like a fire.)'],
  ],
  relic: [
    ['', 'A crate, a rusted helmet, a length of field telephone wire. 1916.'],
    ['', 'Someone has laid two flowers on it. They are still fresh.'],
  ],
  plaque: [
    ['', '"Steig der Rosa — built 1975 by the Gamstal mountain friends,'],
    ['', 'for the one who got up first. / Per chi arrivò prima."'],
    ['', 'Oma. They named it after Oma.'],
  ],
  bunker_look: [
    ['', 'The old position. Firing slits facing south, silence facing everywhere.'],
    ['', 'A hundred years on, the concrete still smells of winter.'],
  ],
  shelter_look: [['', 'An open shelter: firewood, a bench, a tin box — "take something, leave something".']],

  tent_first: [
    'You crawl into the tent. In the side pocket: Oma\'s journal.',
    'It smells of resin, and of 1974.',
  ],
  tent_rest: 'Rest in the tent? Warms you up & saves.',
  fire_rest: 'Rest at the fire? Warms you up & saves.',
  biwak_blocked: [
    'The start of the route is within reach — but your arms are Knödel dough',
    'and the climb in the dark would be suicide. Bivouac first.',
  ],
  biwak_sleep: [
    'You roll out the mat under the high ledge. Somewhere a marmot whistles in its sleep.',
    'You dream of two women climbing a wall, laughing.',
  ],

  toast_slip: 'You slip! No grip on scree without proper boots.',
  toast_fall_water: 'Without a jacket, the waterfall simply hammers you down.',
  toast_dark: 'Pitch black. Without a light you hardly dare take a step.',
  toast_cable: 'A steel cable. Without a ferrata set it stays decoration.',
  toast_cable_ok: 'Press UP to clip in',
  toast_cold: 'You\'re getting cold! Find a fire.',
  toast_knoedel: 'KNÖDEL! Maximum warmth increased.',
  toast_chestnut: n => `Chestnut! (${n}/3)`,
  toast_marmot: n => `Marmot spotted! (${n}/5)`,
  toast_page: n => `Journal page ${n}/7`,
  toast_sprung: 'THE ZINNENSPRUNG! Oma would be proud. And appalled. But proud.',
  toast_stumble: 'Ouch. That was no chamois landing.',
  toast_saved: 'Saved',
  cold_respawn: 'Chilled to the bone, you turn back to the last fire.',

  objectives: {
    start:    'Look around the campsite (tent, Greta, campfire)',
    boots:    'Head EAST → through the Schartl into the forest: there should be boots in the shelter',
    alm:      'The scree path up to Gamsblick Alm is doable now',
    chestnut: 'Three chestnuts for Norbert (forest & pond)',
    jacket:   'The waterfall route — chamois and the stubborn',
    lamp:     'Beyond the gorge: the old position. A lamp is said to hang there',
    tunnel:   'Through the tunnel of 1916',
    biwak:    'Too dark to climb — bivouac at the high ledge',
    summit:   'The via ferrata "Rosa". First light. The summit.',
    free:     'The weekend is yours — find where Oma\'s five photos were taken. (And: marmots? The Zinnensprung? The flight school?)',
  },

  title_continue: 'Continue · Weiterwandern',
  title_new: 'Start over · Neu beginnen',
  title_start: 'Let\'s go · Los geht\'s',

  ending_title: 'GIPFELBUCH',
  ending_sub: 'End of the demo',
  ending_thanks: 'Thank you for hiking! · Danke fürs Wandern!',
  ending_freeroam: 'Tap to keep exploring',

  map_title: 'Hiking map Gamstal · Wanderkarte',
  map_close: 'M / 🗺 to close',
  map_here: 'You are at:',
  album_btn: '📷 Album',
  album_title: 'Oma\'s photos · Omas Fotos',
  album_hint: 'Tap a photo to view it',
  obj_prefix: 'Goal: ',
  newobj_prefix: 'New goal: ',
  rested: 'You rest a while. Warmth restored, game saved.',
  continue_caption: 'Onward · weiter geht\'s',
  ctl_hint1: '← → move · Space jump · E interact · M map',
  ctl_hint2: 'A hike, not a fight. · Ein Spaziergang, kein Kampf.',
  lang_btn: '🌐 Sprache: Deutsch?',
  photos_unlocked: 'Tucked in the tin box: five more photos from 1974. Find the places where they were taken!',
  st_time: m => `Hiking time: ${m} min`,
  st_pages: (a, b) => `Journal pages: ${a}/7 · Oma's photos: ${b}/5`,
  st_animals: (a, b) => `Marmots: ${a}/5 · Chamois seen: ${b}×`,
  st_sprung: y => `Zinnensprung: ${y ? 'YES!' : 'not yet…'}`,
  st_knoedel: y => `Knödel: ${y ? 'the best of your life' : 'missed?!'}`,
  st_flug: (f, g, n) => `Flight school: ${f ? 'STUDENT NO. 1' : g ? `rings ${n}/5` : 'coming soon…'}`,
};

let TX = TX_EN; // English is the default; the title screen can switch

// Gear display
const GEAR_INFO = {
  boots:  { icon: '🥾', de: 'Wanderschuhe' },
  jacket: { icon: '🧥', de: 'Regenjacke' },
  lamp:   { icon: '🔦', de: 'Stirnlampe' },
  kit:    { icon: '🧗', de: 'Klettersteigset' },
  glider: { icon: '🪂', de: 'Gleitschirm' },
};

if (typeof module !== 'undefined') {
  module.exports = { TILE, WORLD_W, WORLD_H, buildWorld, WATERFALL, THERMALS, RINGS, ZONES, PHASES, ENTITIES, TREES, FLOWERS, BG_ROCK, TX_DE, TX_EN, GEAR_INFO };
}
