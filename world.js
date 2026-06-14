/* =========================================================================
   GIPFELBUCH — world data
   One handcrafted mountain in Südtirol, tile by tile.
   Tile codes: 0 air · 1 rock · 2 scree · 3 one-way plank · 4 water
               5 ferrata cable · 6 nettles · 7 hard ice (Blankeis)
   ========================================================================= */

const TILE = 16;

const WORLD_W = 330;   // x 0..167 the Gamstal · x 168..240 the Hinteres Tal · x 264..316 the Gamskofel
const WORLD_H = 90;    // Increased from 80 to 90 to prevent the artificial ceiling at the top
const Y_OFF = 10;      // Shift offset to push level geometry down

function buildWorld() {
  const g = new Uint8Array(WORLD_W * WORLD_H); // 0 = air

  const fill = (x, y, w, h, t) => {
    y += Y_OFF;
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++)
        if (i >= 0 && i < WORLD_W && j >= 0 && j < WORLD_H) g[j * WORLD_W + i] = t;
  };
  const carve = (x, y, w, h) => fill(x, y, w, h, 0);

  // --- big landforms -----------------------------------------------------
  fill(0, 70, WORLD_W, 10, 1);   // valley floor
  fill(32, 48, 55, 10, 1);       // Alm shelf (x32..86)
  fill(2, 28, 85, 9, 1);         // upper band: Stellung terrace / tunnel floor / Hochband (x2..86)
  carve(4, 28, 7, 9);            // chimney through the band, above the gorge (x4..10)
  fill(10, 28, 1, 1, 1);         // landing lip at the chimney mouth
  carve(11, 33, 21, 4);          // headroom over the gorge slot — full jumps need sky
  fill(28, 8, 33, 14, 1);        // tunnel ceiling massif (x28..60, passage stays open y22..27)
  fill(72, 12, 15, 16, 1);       // headwall above the Hochband (x72..86)

  // --- ridge path: a real climb to the peak --------------------------------
  // Platforms are THIN (3–4 tiles of rock) so sky shows between the crags.
  // Stage 1 — The Shoulder: flat entry from the ferrata, then first step up
  fill(72, 12, 9, 7, 1);         // entry platform (x72..80, floor y12) — thick, bonds to headwall
  fill(81, 10, 4, 4, 1);         // first step up (x81..84, y10..14) (top 10, bottom 14)

  // Stage 2 — The Knife Edge: narrow ledges stepping sharply upward
  // (the x86..88 ledge is a crumbling shale slab — see CRUMBLE below)
  fill(91, 6, 3, 8, 1);          // ledge (x91..93, y6..14)
  fill(95, 4, 4, 10, 1);         // high point (x95..98, y4..14)
  fill(95, 4, 4, 1, 7);          // Blankeis: the most exposed crest, glazed hard ice
  fill(102, 7, 3, 7, 1);         // deep saddle (x102..104, y7..14) — big drop!
  fill(102, 7, 3, 1, 7);         // Blankeis: the saddle floor, slick — control your stop

  // Stage 3 — The Summit Block: dramatic peaks and valleys
  // (the x107..109 ledge is a crumbling shale slab — see CRUMBLE below)
  fill(111, 3, 3, 11, 1);        // sub-peak (x111..113, y3..14) — first glimpse of the top
  // deep gap (x114..121) — nothing at jump height: ride the supply hoist
  // (see MOVERS), or drop to the solid ground and climb back via the steps
  fill(122, 4, 3, 10, 1);        // ledge (x122..124, y4..14)
  fill(126, 2, 4, 12, 1);        // the pinnacle (x126..129, y2..14) — second only to the Gipfel
  fill(133, 1, 9, 13, 1);        // summit plateau (x133..141, y1..14) — the Gipfel,
                                 // the highest ground on the whole mountain

  // Stage 4 — The East Ridge: small peaks stepping down to the east face.
  // Every crag bonds to the shoulder below — only the Scharte stays open air.
  fill(142, 6, 1, 8, 1);         // saddle column under the plateau rim (x142, top y6)
  fill(143, 4, 3, 10, 1);        // first peak east of the Gipfel (x143..145, top y4)
  fill(146, 7, 2, 7, 1);         // pre-notch rim (x146..147, top y7) — fence at x147
  // the Scharte (x148..149): a clean drop from the crest into the pond far below
  fill(150, 7, 5, 7, 1);         // post-notch peak (x150..154, top y7) — fence at x150
  fill(155, 10, 2, 4, 1);        // saddle (x155..156, top y10)
  fill(157, 9, 4, 5, 1);         // bench peak (x157..160, top y9)
  fill(161, 12, 1, 2, 1);        // step (x161, top y12)
  fill(162, 11, 4, 3, 1);        // final ledge at the east face (x162..165, top y11)
  // the east shoulder: solid ground under the peaks, split only by the Scharte
  fill(142, 14, 6, 22, 1);       // west of the drop (x142..147)
  fill(150, 14, 16, 22, 1);      // east of the drop (x150..165)

  // Solid ground under the upper ridge. A missed jump lands here on the solid
  // ground — climb back onto the route at the re-entry ledge (the deep saddle).
  fill(87, 14, 55, 22, 1);
  fill(99, 11, 2, 1, 3);        // re-entry plank: solid ground -> deep saddle

  // Rock steps serving as escapes in the deep drops of the ridge path
  fill(90, 11, 1, 3, 1);        // rock step in gap x90
  fill(94, 9, 1, 5, 1);         // rock step in gap x94
  fill(105, 10, 2, 4, 1);       // rock step in gap x105..106
  fill(110, 8, 1, 6, 1);        // rock step in gap x110
  fill(114, 11, 2, 3, 1);       // rock step in gap x114..115
  fill(120, 11, 2, 3, 1);       // rock step in gap x120..121
  fill(125, 7, 1, 7, 1);        // rock step in gap x125
  fill(130, 6, 3, 8, 1);        // rock step in gap x130..132

  // scree slope: valley (x128, y~70) climbing west to the Alm (x87, y48)
  for (let x = 87; x <= 128; x++) {
    const top = 48 + Math.round(((x - 87) * 22) / 41);
    fill(x, top, 1, Math.max(1, 70 - top), 1);
    fill(x, top, 1, 2, 2); // loose scree skin
  }
  // das Schartl: a stepped notch from the Lärchenschatten up through the rock,
  // opening onto a flat saddle terrace mid-slope — the boots-free way to the
  // east forest. The climb to the Alm continues above it: one deliberate jump
  // onto the scree slab at x128/129, which still demands proper boots.
  for (let i = 0; i <= 8; i++) carve(87 + 2 * i, 67 - i, 2, 3);
  carve(105, 58, 8, 3); // the saddle terrace (floor y61, slab roof at x105)

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
  // a gentle zig-zag: every hop is at most 3 tiles up and a couple across.
  // the middle step is the old material hoist (see MOVERS) — time your jump.
  fill(26, 45, 4, 1, 1);   // inside the waterfall, reaching dry air at x29
  fill(21, 42, 3, 1, 1);
  fill(8, 38, 4, 1, 1);
  fill(4, 35, 3, 1, 1);    // inside the chimney
  fill(8, 32, 3, 1, 1);    // inside the chimney
  fill(4, 29, 3, 1, 1);    // inside the chimney, one easy hop from the lip

  // --- the observer post: a long, airy climb above the Stellung -----------
  // Eight hops on narrow ledges with real exposure — the lamp is earned.
  // Misstep anywhere and the chimney swallows you back to the gorge.
  // No ledge sits in the jump arc above another: every takeoff has open sky.
  fill(14, 25, 2, 1, 1);   // 1. narrow first ledge — commits you to the climb
  fill(11, 23, 2, 1, 1);   // 2. short step left — the chimney yawns below
  fill(17, 21, 2, 1, 1);   // 3. long leap back right — precision landing
  fill(19, 19, 3, 1, 3);   // 4. one-way plank — no going back this way
  fill(16, 15, 2, 1, 1);   // 5. a full-stretch leap up the right edge
  // 6. moving platform oscillates at y:13 (see MOVERS) — the only bridge left
  fill(2, 10, 7, 1, 1);    // 7. the lookout shelf — you made it

  // --- the depot: a balcony nook above the tunnel's east mouth ------------
  // (the ferrata set waits here — the cable below sends you looking)
  // The route: Outer buttress (Hochband east face) -> Dark cavern (mud crossing)
  // -> Mud-chimney up to the Upper gallery (suspension bridge) -> Dropdown shaft
  // into the locked kit chamber. The West Mine Shaft + ventilation hoist are an
  // older dead-end working off the gallery (optional, not on the kit route).
  
  // 1. Carve the expanded internal mine system inside the massif
  carve(46, 15, 15, 4);    // Lower Cavern (x: 46..60, y: 15..18, floor y: 18)
  carve(28, 11, 12, 8);    // West Mine Shaft (x: 28..39, y: 11..18, floor y: 18)
  carve(32, 5, 4, 10);     // Ventilation Chimney (x: 32..35, y: 5..14)
  carve(36, 5, 25, 4);     // Upper Gallery (x: 36..60, y: 5..8, floor y: 8)
  carve(40, 5, 2, 10);     // Dropdown Shaft (x: 40..41, y: 5..14)
  carve(40, 13, 4, 6);     // Locked Depot Nook (x: 40..43, y: 13..18)
  carve(46, 9, 4, 6);      // Mud-Chimney: lifts the cavern up to the gallery,
                           // EAST of the divider so the kit nook stays sealed (x: 46..49, y: 9..14)
  
  // 2. Build Depot Nook & Wall
  fill(40, 15, 4, 4, 1);   // Kit Platform (floor y: 15)
  fill(44, 13, 2, 6, 1);   // Divider Wall between Nook and Caverns
  
  // 3. Stage 1: Outer Buttress Ledges (Hochband -> Cavern entrance)
  // A zigzag up the open east face. Ledges must sit WEST of the headwall (x72)
  // and clear of the belay shelf (x67..69,y21): a ledge buried in solid rock,
  // or tucked right under another, has no headroom and cannot be stood on.
  fill(66, 25, 2, 1, 1);   // 1. first step up off the Hochband (x66..67)
  fill(62, 23, 2, 1, 1);   // 2. a leap back left up the buttress (x62..63)
  // 3. the belay shelf (x67..69,y21, built with the ferrata below) is the next step
  fill(65, 19, 2, 1, 3);   // 4. one-way plank at the nook's mouth (x65..66)
  
  // 4. Stage 2: Lower Cavern & Mud Crossing (requires Stirnlampe)
  fill(45, 18, 8, 1, 8);   // Mud pit on the floor (x: 45..52, y: 18)
  fill(56, 17, 2, 1, 3);   // Plank 1 over mud (x: 56..57, y: 17)
  fill(51, 16, 2, 1, 3);   // Plank 2 over mud (x: 51..52, y: 16)
  fill(46, 17, 2, 1, 3);   // Plank 3 over mud (x: 46..47, y: 17)
  
  // 5. Stage 3: Mud-Chimney handholds — the dripping climb out of the cavern,
  // off the last mud plank, up to the suspension bridge in the gallery.
  fill(48, 14, 2, 1, 1);   // lower handhold (x: 48..49, y: 14)
  fill(46, 11, 2, 1, 1);   // upper handhold (x: 46..47, y: 11) — one hop onto the bridge
  // West Mine Shaft pocket (an old dead-end working, reachable from the gallery):
  fill(29, 17, 2, 1, 1);   // Rock step left (x: 29..30, y: 17)
  fill(34, 16, 2, 1, 1);   // Intermediate mine step (x: 34..35, y: 16)
  fill(29, 13, 2, 1, 1);   // Rock step upper left (x: 29..30, y: 13)
  // (Note: Crumble ledges are defined in the CRUMBLE array at x: 38, y: 15 and x: 33, y: 11)
  
  // 6. Stage 4: Upper Gallery & Suspension Bridge
  fill(38, 7, 2, 1, 3);    // Swaying bridge plank 1 (x: 38..39, y: 7)
  fill(42, 8, 3, 1, 3);    // Swaying bridge plank 2 (x: 42..44, y: 8)
  fill(47, 8, 3, 1, 3);    // Swaying bridge plank 3 (x: 47..49, y: 8)
  fill(52, 7, 2, 1, 3);    // Swaying bridge plank 4 (x: 52..53, y: 7)
  fill(55, 7, 3, 1, 1);    // High storage platform (x: 55..57, y: 7)
  
  // 7. Stage 5: Sky Catwalks (exposed scaffolding above the massif)
  fill(58, 6, 2, 1, 3);    // Exit to sky (x: 58..59, y: 6)
  fill(55, 4, 2, 1, 3);    // Plank in sky (x: 55..56, y: 4)
  fill(50, 3, 2, 1, 3);    // Plank in sky (x: 50..51, y: 3)
  fill(45, 4, 2, 1, 3);    // Plank in sky (x: 45..46, y: 4)

  // --- tunnel furniture ----------------------------------------------------
  fill(34, 26, 3, 2, 1);   // low rubble pile near the west mouth — hop over
  fill(40, 26, 2, 2, 1);   // rubble heap to hop
  carve(44, 27, 2, 1);     // narrow floor gap — a short jump
  fill(48, 23, 1, 3, 1);   // fallen timber, squeeze past on the right
  fill(52, 22, 2, 2, 1);   // collapsed lintel to duck past
  fill(59, 25, 3, 3, 1);   // cave-in mound near the east end — biggest hop

  // --- water ---------------------------------------------------------------
  fill(23, 70, 11, 3, 4);  // plunge pool under the falls
  fill(143, 70, 7, 3, 4);  // forest pond
  fill(145, 69, 2, 1, 3);  // half-sunk log across the pond (one-way)

  // the boots teaser: a steep scree buttress on an old plank just west of the
  // pond. The path passes under it (the plank is one-way). Without grip every
  // jump onto the scree slides straight back off; you can never gain the upper
  // steps to the chestnut on top. With boots you scramble up step by step.
  fill(137, 68, 5, 1, 3);  // one-way plank base (x137..141), passable from below
  fill(141, 67, 1, 1, 2);  // scree staircase, one tile up per column, rising west…
  fill(140, 66, 1, 2, 2);
  fill(139, 65, 1, 3, 2);
  fill(138, 64, 1, 4, 2);
  fill(137, 63, 1, 5, 2);  // …a solid pile so there is no launch pad in its lee

  // --- odds and ends -------------------------------------------------------
  fill(164, 69, 1, 1, 1);  // lone boulder, east end
  fill(82, 69, 2, 1, 6);   // nettles in the larch shade
  // via ferrata "Rosa": two pitches up the headwall. The two-row gap stops
  // the climb at the lower anchor — jump toward the wall to catch the upper
  // cable, or swing off LEFT onto the belay ledge to rest. The ledge sits
  // clear of the climb corridor (x94 must stay open, the body needs it).
  fill(71, 21, 1, 7, 5);   // lower pitch (y21..27)
  fill(67, 21, 3, 1, 1);   // belay ledge (x91..93)
  fill(71, 12, 1, 7, 5);   // upper pitch (y12..18) — anchored at the ridge lip
  fill(0, 0, 2, WORLD_H, 1);            // west wall

  // --- Hinteres Tal (post-finale glider country, x192..) --------------------
  fill(166, 2, 2, WORLD_H, 1);   // the massif's east face (top y2 — below the Gipfel)
  carve(166, 5, 2, 7);           // the slip behind the Flugschule sign (y5..11)
  fill(168, 12, 6, 1, 1);        // launch ledge / Startplatz
  fill(169, 13, 1, 57, 5);       // fixed cable back up the face (for the way home)
  fill(194, 68, 5, 2, 1);        // grassy knoll
  fill(220, 66, 4, 4, 1);        // chapel knoll
  fill(207, 70, 8, 3, 4);        // the lake (carved into valley floor)
  fill(WORLD_W - 2, 0, 2, WORLD_H, 1);  // east wall

  // --- Final Ascent: the Gamskofel (x264..316) --------------------------------
  // The hardest climb in the game. Thin ledges, crumbling rock, ice, air gusts,
  // and a one-way commit chimney. Summit at y1 — the highest point in the game.

  // Solid ground to catch falls in the lower half
  fill(264, 50, 52, 20, 1);   // catch floor x264..315, y50..69

  // Stage 1 — The Approach: valley floor up to the face
  fill(264, 66, 4, 4, 1);     // entry ramp (x264..267, y66..69)
  fill(270, 63, 3, 3, 1);     // ledge (x270..272, y63..65)
  fill(266, 60, 3, 2, 1);     // zig left (x266..268, y60..61)
  fill(272, 57, 3, 2, 1);     // zag right (x272..274, y57..58)
  fill(268, 54, 4, 2, 1);     // wider shelf (x268..271, y54..55)

  // Stage 2 — The Lower Face
  fill(274, 51, 3, 1, 1);     // narrow ledge (x274..276, y51)
  fill(278, 48, 3, 1, 1);     // ledge (x278..280, y48)
  fill(274, 45, 3, 1, 1);     // zig back (x274..276, y45)
  fill(280, 42, 3, 2, 1);     // pre-biwak ledge (x280..282, y42..43)
  fill(284, 39, 5, 2, 1);     // BIWAK shelf (x284..288, y39..40) — checkpoint

  // Stage 3 — The Ice Chimney: crumbling rock + ice + one-way commit
  fill(281, 36, 3, 1, 1);     // ledge (x281..283, y36)
  // x286..287, y33: CRUMBLING ledge — see CRUMBLE array (overlay, not tile)
  fill(282, 30, 3, 1, 1);     // recovery ledge (x282..284, y30)
  fill(287, 27, 2, 1, 3);     // ONE-WAY PLANK commit (x287..288, y27)
  fill(283, 24, 4, 1, 1);     // exit shelf (x283..286, y24)

  // Upper catch floor + re-entry plank
  fill(278, 25, 30, 5, 1);    // upper catch floor x278..307, y25..29
  carve(285, 25, 4, 8);       // carve chimney shaft through catch floor and above crumble (x285..288, y25..32)
  carve(283, 24, 4, 1);       // keep the exit shelf clear above the catch floor
  fill(281, 24, 2, 1, 3);     // re-entry plank from catch floor to route

  // Stage 4 — The Wind Ridge: exposed, air currents, ice
  fill(288, 21, 3, 1, 1);     // ledge (x288..290, y21)
  fill(293, 18, 2, 1, 7);     // ICE ledge (x293..294, y18) — slippery!
  fill(289, 15, 3, 1, 1);     // ledge (x289..291, y15)
  fill(295, 12, 3, 1, 1);     // ledge past the gust (x295..297, y12)
  fill(300, 9, 3, 1, 1);      // pre-summit shelf (x300..302, y9)
  fill(308, 9, 6, 1, 1);      // pre-summit catch shelf to support final crumble falls (x308..313, y9)

  // Stage 5 — The Summit Push
  fill(305, 6, 2, 1, 1);      // narrow perch (x305..306, y6)
  // x310..311, y3: CRUMBLING ledge — see CRUMBLE array (overlay, not tile)
  fill(308, 1, 8, 2, 1);      // THE SUMMIT (x308..315, y1..2) — highest point!
  carve(310, 1, 2, 2);        // carve gap for climbing through the summit (x310..311, y1..2)

  return g;
}

// The waterfall is a force-field rect, not tiles (it pours over ledges).
const WATERFALL = { x: 24, y: 29, w: 4, h: 41 }; // tiles

// Thermal columns in the Hinteres Tal — warm air that lifts a glider.
const THERMALS = [
  { x: 183, y: 16, w: 4, h: 52 },
  { x: 202, y: 14, w: 4, h: 54 },
  { x: 222, y: 18, w: 4, h: 50 },
];

// Horizontal air gusts on the Gamskofel — push the player sideways.
const GUSTS = [
  { x: 290, y: 10, w: 6, h: 10, dir: 1, force: 1.8 },  // pushes right
  { x: 296, y: 4, w: 5, h: 8, dir: -1, force: 1.5 },   // pushes left near summit
];

// Sink pockets — cold downdrafts between the thermals. A glider caught in one
// drops fast; dive straight through or steer around, then climb a thermal back
// up. Placed clear of the thermal columns and the ring centres so the course
// stays catchable but the high ring over the lake demands real altitude first.
const SINK = [
  { x: 192, y: 12, w: 3, h: 28 },   // a mild pocket early in the run
  { x: 214, y: 22, w: 4, h: 36 },   // guards the high line over the lake
];

// The flying course: five rings hung in the air. [tileX, tileY of center]
const RINGS = [[186, 36], [198, 24], [209, 46], [223, 30], [232, 55]];

// Moving platforms — the hut's old material hoist still runs in the gorge,
// the summit-cross supply hoist bridges the deep gap on the upper ridge, and
// the observer hoist is the last step up to the lookout shelf. Each one is
// load-bearing: no static ledge doubles its track.
// Oscillates between (x,y) and (x2,y2); w tiles wide; period in frames.
const MOVERS = [
  { x: 13, y: 40, x2: 18, y2: 40, w: 3, period: 300 },
  { x: 114, y: 6, x2: 118, y2: 6, w: 3, period: 260 },
  { x: 9, y: 13, x2: 13, y2: 13, w: 2, period: 220 },
  { x: 32, y: 14, x2: 32, y2: 7, w: 2, period: 240 }, // mine vertical hoist
];

// Crumbling ledges (brüchiger Fels) — one-way shale slabs on the ridge that
// crack ~1.5 s after the first landing, drop away, and regrow a few seconds
// later. They replace what used to be solid pillars; a fall lands on the
// catch band at y14 below, and the re-entry plank route leads back up.
// {x, y, w} in tiles; runtime state lives in game.js.
const CRUMBLE = [
  { x: 86,  y: 8, w: 3 },   // Knife Edge ledge (x86..88)
  { x: 107, y: 5, w: 3 },   // Summit Block ledge (x107..109)
  { x: 286, y: 33, w: 2 },  // Gamskofel Ice Chimney (x286..287)
  { x: 310, y: 3, w: 2 },   // Gamskofel near-summit (x310..311) — last test!
  { x: 38,  y: 15, w: 2 },  // Mine Shaft lower crumble (x:38..39, y:15)
  { x: 33,  y: 11, w: 3 },  // Mine Shaft upper crumble (x:33..35, y:11)
];

// Stonefall bands (Steinschlag) — loose rock rattles down these columns at
// intervals. Dust and a rattle telegraph each stone; stones shatter on the
// first solid or plank tile. A hit staggers and costs warmth, never more.
// {x, y: spawn row, w, floor: last row, period: frames between stones}.
const STONEFALL = [
  { x: 65, y: 13, w: 6, floor: 28, period: 420 },  // the exposed depot climb
];

// =========================================================================
// Zones — names show as banners, fill in the paper map, control ambience.
// First match wins; specific before general.
// =========================================================================
const ZONES = [
  { id: 'gamskofel', x: 304, y: 0, w: 26, h: 14, en: 'The True Summit', de: 'Der Gamskofel', it: 'Il Gamskofel', outdoor: true },
  { id: 'aufstieg', x: 262, y: 0, w: 66, h: 72, en: 'The Final Ascent', de: 'Der Schlussanstieg', it: "L'ultima salita", outdoor: true },
  { id: 'wache',    x: 2,   y: 2,  w: 26, h: 15, en: 'Observer Post',         de: 'Beobachterstand',       it: 'Posto di vedetta',      outdoor: true },
  { id: 'depot',    x: 40,  y: 13, w: 4,  h: 6,  en: 'The Depot',             de: 'Das Materialdepot',     it: 'Il deposito',           outdoor: true },
  { id: 'mine',     x: 28,  y: 5,  w: 32, h: 14, en: 'Mine Gallery',          de: 'Stollen-Galerie',       it: 'Galleria delle miniere', dark: true, covered: true },
  { id: 'start',    x: 164, y: 0,  w: 12, h: 14, en: 'Launch Site',           de: 'Startplatz',            it: 'Decollo',               outdoor: true },
  { id: 'hintertal', x: 168, y: 0, w: 72, h: 80, en: 'The Hidden Valley',     de: 'Hinteres Tal',          it: 'Valle nascosta',        outdoor: true },
  { id: 'gipfel',   x: 126, y: 0,  w: 24, h: 19, en: 'The Summit',            de: 'Gipfel',                it: 'Cima Gamsblick',        outdoor: true },
  { id: 'grat',     x: 72,  y: 0,  w: 94, h: 19, en: 'Ridge Path',            de: 'Gratweg',               it: 'Via di cresta',         outdoor: true },
  { id: 'ferrata',  x: 68,  y: 11, w: 6,  h: 18, en: 'Via Ferrata "Rosa"',    de: 'Klettersteig „Rosa“',   it: 'Via ferrata «Rosa»',    outdoor: true },
  { id: 'stellung', x: 2,   y: 17, w: 26, h: 20, en: 'Old Position 1916',     de: 'Alte Stellung 1916',    it: 'Vecchia postazione',    outdoor: true },
  { id: 'stollen',  x: 27,  y: 17, w: 35, h: 13, en: 'The Tunnel',            de: 'Der Stollen',           it: 'La galleria',           dark: true, covered: true },
  { id: 'hochband', x: 61,  y: 17, w: 11, h: 12, en: 'High-Ledge Bivouac',    de: 'Hochband-Biwak',        it: 'Cengia alta',           outdoor: true },
  { id: 'schlucht', x: 2,   y: 37, w: 31, h: 43, en: 'Waterfall Gorge',       de: 'Wasserfallschlucht',    it: 'Gola della cascata',    outdoor: true },
  { id: 'alm',      x: 32,  y: 37, w: 55, h: 21, en: 'Gamsblick Alm',         de: 'Gamsblick-Alm',         it: 'Malga Gamsblick',       outdoor: true },
  { id: 'galerie',  x: 73,  y: 56, w: 15, h: 24, en: 'Larch Shade',           de: 'Im Lärchenschatten',    it: "All'ombra dei larici",  covered: true },
  { id: 'geroell',  x: 87,  y: 38, w: 45, h: 34, en: 'The Scree Field',       de: 'Das Geröllfeld',        it: 'Il ghiaione',           outdoor: true },
  { id: 'wald',     x: 132, y: 56, w: 36, h: 24, en: 'Larch Forest & Pond',   de: 'Lärchenwald & Teich',   it: 'Bosco e laghetto',      outdoor: true },
  { id: 'camp',     x: 33,  y: 56, w: 40, h: 24, en: 'Campsite Gamsblick',    de: 'Campingplatz Gamsblick', it: 'Campeggio Gamsblick',  outdoor: true },
];

// =========================================================================
// Day phases — a weekend, not an epic.
// =========================================================================
const PHASES = [
  null,
  { caption: { de: 'Samstag, 6:50 · Sabato', en: 'Saturday, 6:50 am · Samstag' },
    sub: { de: 'Morgennebel im Tal — la nebbia del mattino', en: 'Morning mist in the valley' },
    skyTop: '#7fb2d9', skyBot: '#f4e3c2', sun: 0.18, ambient: 0.00, rain: false,
    peak0Color: '#bec8d7', peak0Opacity: 0.7,
    peak1Color: '#96a5b9', peak1Opacity: 0.8,
    hazeColor: '#d0dbe8', hazeOpacity: 0.5,
    silColor: '#a8b5c8', silOpacity: 0.85,
    roofColor: '#92a0b4', roofOpacity: 0.9,
    cloudColor: '#ffffff', cloudOpacity: 0.5,
    bgRockColor0: '#a8a394', bgRockColor1: '#8d897e',
    fc0Color: '#587262', fc0Opacity: 0.5,
    fc1Color: '#385446', fc1Opacity: 0.72 },
  { caption: { de: 'Samstag Nachmittag · pomeriggio', en: 'Saturday afternoon · pomeriggio' },
    sub: { de: 'Regen zieht auf — arriva la pioggia', en: 'Rain is rolling in' },
    skyTop: '#6b7d92', skyBot: '#aab4b6', sun: 0.55, ambient: 0.12, rain: true,
    peak0Color: '#bec8d7', peak0Opacity: 0.7,
    peak1Color: '#96a5b9', peak1Opacity: 0.8,
    hazeColor: '#aab6c6', hazeOpacity: 0.5,
    silColor: '#a8b5c8', silOpacity: 0.85,
    roofColor: '#92a0b4', roofOpacity: 0.9,
    cloudColor: '#7d8694', cloudOpacity: 0.45,
    bgRockColor0: '#a8a394', bgRockColor1: '#8d897e',
    fc0Color: '#566866', fc0Opacity: 0.5,
    fc1Color: '#3a504c', fc1Opacity: 0.72 },
  { caption: { de: 'Samstag Nacht · notte', en: 'Saturday night · notte' },
    sub: { de: 'Der Berg wird still — la montagna tace', en: 'The mountain goes quiet' },
    skyTop: '#0c1430', skyBot: '#27355c', sun: -1,   ambient: 0.66, rain: true,
    peak0Color: '#28345a', peak0Opacity: 0.9,
    peak1Color: '#1c2646', peak1Opacity: 0.95,
    hazeColor: '#161e3a', hazeOpacity: 0.35,
    silColor: '#222e52', silOpacity: 0.95,
    roofColor: '#1a2442', roofOpacity: 0.95,
    cloudColor: '#7d8694', cloudOpacity: 0.45,
    bgRockColor0: '#1d2747', bgRockColor1: '#141b33',
    fc0Color: '#1c2644', fc0Opacity: 0.8,
    fc1Color: '#121a32', fc1Opacity: 0.92 },
  { caption: { de: 'Sonntag, kurz vor sechs · domenica', en: 'Sunday, just before six · domenica' },
    sub: { de: 'Erstes Licht — la prima luce', en: 'First light' },
    skyTop: '#3b3a6e', skyBot: '#ffb37d', sun: 0.08, ambient: 0.18, rain: false,
    peak0Color: '#966e8c', peak0Opacity: 0.55,
    peak1Color: '#6e5578', peak1Opacity: 0.7,
    hazeColor: '#d4968c', hazeOpacity: 0.5,
    silColor: '#7e6080', silOpacity: 0.7,
    roofColor: '#684e6c', roofOpacity: 0.75,
    cloudColor: '#ffffff', cloudOpacity: 0.5,
    bgRockColor0: '#8a6478', bgRockColor1: '#5e4a62',
    fc0Color: '#6c5068', fc0Opacity: 0.55,
    fc1Color: '#463650', fc1Opacity: 0.75 },
  { caption: { de: 'Sonntag Vormittag · domenica', en: 'Sunday morning · domenica' },
    sub: { de: 'Kaiserwetter — che giornata', en: 'Not a cloud that matters' },
    skyTop: '#6fb0e0', skyBot: '#eaf4ef', sun: 0.40, ambient: 0.00, rain: false,
    peak0Color: '#bec8d7', peak0Opacity: 0.7,
    peak1Color: '#96a5b9', peak1Opacity: 0.8,
    hazeColor: '#d0dbe8', hazeOpacity: 0.5,
    silColor: '#a8b5c8', silOpacity: 0.85,
    roofColor: '#92a0b4', roofOpacity: 0.9,
    cloudColor: '#ffffff', cloudOpacity: 0.5,
    bgRockColor0: '#a8a394', bgRockColor1: '#8d897e',
    fc0Color: '#587262', fc0Opacity: 0.5,
    fc1Color: '#385446', fc1Opacity: 0.72 },
];

// =========================================================================
// Entities  (x = tile column, r = tile row of the floor they stand on)
// =========================================================================
const ENTITIES = [
  // -- Campingplatz ---------------------------------------------------------
  { t: 'spawn',    x: 41,  r: 70 },
  { t: 'tent',     x: 37,  r: 70 },
  { t: 'fire',     x: 44,  r: 70, id: 'camp', name: 'Lagerfeuer' },
  { t: 'photo',    x: 46,  r: 70, n: 1 },
  { t: 'sign',     x: 48,  r: 70, key: 'sign_camp' },
  { t: 'npc',      x: 54,  r: 70, who: 'greta' },
  { t: 'dog',      x: 56,  r: 70 },

  // -- Lärchenschatten-Galerie ----------------------------------------------
  { t: 'chestnut', x: 78,  r: 70 },
  { t: 'sign',     x: 85,  r: 70, key: 'sign_schartl' },
  { t: 'sign',     x: 110, r: 61, key: 'sign_sattel' },

  // -- Geröllfeld -------------------------------------------------------------
  { t: 'marmot',   x: 116, r: 64 },

  // -- Lärchenwald & Teich ----------------------------------------------------
  { t: 'chestnut', x: 137, r: 63 },  // capping the scree pile west of the pond — the boots teaser
  { t: 'photo',    x: 142, r: 70, n: 2 },
  { t: 'shelter',  x: 152, r: 70 },
  { t: 'gear',     x: 154, r: 70, gear: 'boots', key: 'get_boots' },
  { t: 'tin',      x: 147, r: 73 },  // shaken loose from the silt by the Zinnensprung
  { t: 'page',     x: 157, r: 70, n: 2 },
  { t: 'marmot',   x: 161, r: 70 },
  { t: 'page',     x: 164, r: 69, n: 0, hide: true }, // (slot kept free — page 2 sits on the path)

  // -- Gamsblick-Alm ----------------------------------------------------------
  { t: 'sign',     x: 36,  r: 48, key: 'sign_almweg' },
  { t: 'sign',     x: 44,  r: 48, key: 'sign_alm' },
  { t: 'cow',      x: 52,  r: 48 },
  { t: 'hut',      x: 64,  r: 48 },
  { t: 'photo',    x: 61,  r: 48, n: 3 },
  { t: 'npc',      x: 70,  r: 48, who: 'norbert' },
  { t: 'fire',     x: 76,  r: 48, id: 'alm', name: 'Feuerstelle der Alm' },
  { t: 'page',     x: 85,  r: 48, n: 3 },

  // -- Wasserfallschlucht -------------------------------------------------------
  { t: 'page',     x: 26,  r: 65, n: 4 }, // behind the falls
  { t: 'chestnut', x: 29,  r: 45 },       // on the platform partially covered by the waterfall

  // -- Alte Stellung 1916 ---------------------------------------------------------
  { t: 'sign',     x: 11,  r: 28, key: 'sign_wache' },
  { t: 'bunker',   x: 14,  r: 28 },
  { t: 'page',     x: 17,  r: 28, n: 5 },
  { t: 'fire',     x: 20,  r: 28, id: 'stellung', name: 'Feuerstelle an der Stellung' },
  { t: 'photo',    x: 22,  r: 28, n: 4 },
  { t: 'marmot',   x: 24,  r: 28 },

  // -- Beobachterstand --------------------------------------------------------------
  { t: 'lookout',  x: 3,   r: 10 },
  { t: 'gear',     x: 6,   r: 10, gear: 'lamp', key: 'get_lamp' },

  // -- Stollen ---------------------------------------------------------------------
  { t: 'relic',    x: 56,  r: 28 },
  { t: 'page',     x: 58,  r: 28, n: 6 },

  // -- Hochband ----------------------------------------------------------------------
  { t: 'fire',     x: 62,  r: 28, id: 'biwak', name: 'Biwak am Hochband', biwak: true },
  { t: 'marmot',   x: 70,  r: 28 },

  // -- Materialdepot -----------------------------------------------------------------
  { t: 'gear',     x: 42,  r: 15, gear: 'kit', key: 'get_kit' },
  { t: 'depot',    x: 58,  r: 19 },

  // -- Grat & Gipfel ---------------------------------------------------------------------
  { t: 'plaque',   x: 73,  r: 12 },  // "Steig der Rosa" — mounted where the ferrata tops out
  { t: 'sign',     x: 76,  r: 12, key: 'sign_grat' },
  { t: 'marmot',   x: 96,  r: 4 },
  { t: 'sign',     x: 144, r: 4, key: 'sign_notch' },
  { t: 'fence',    x: 147, r: 7 },
  { t: 'fence',    x: 150, r: 7 },
  { t: 'cross',    x: 312, r: 1 },
  { t: 'book',     x: 314, r: 1 },
  { t: 'sign',     x: 137, r: 1, key: 'sign_vorgipfel' },
  { t: 'photo',    x: 158, r: 9, n: 5 },
  { t: 'bench',    x: 159, r: 9 },
  { t: 'sign',     x: 162, r: 11, key: 'sign_flug' },
  { t: 'gear',     x: 164, r: 11, gear: 'glider', key: 'flug_unlock' },

  // -- Hinteres Tal ----------------------------------------------------------------------
  { t: 'windsock', x: 172, r: 12 },
  { t: 'npc',      x: 177, r: 70, who: 'vera' },
  { t: 'fire',     x: 180, r: 70, id: 'flug', name: 'Feuerstelle der Flugschule' },
  { t: 'windsock', x: 186, r: 70 },
  { t: 'chapel',   x: 222, r: 66 },
  { t: 'sign',     x: 232, r: 70, key: 'sign_talende' },

  // -- Gamskofel (Final Ascent) -------------------------------------------------
  { t: 'fire', x: 286, r: 39, id: 'kofelbiwak', name: 'Biwak am Kofel' },
  { t: 'bench', x: 308, r: 1 },
  { t: 'sign', x: 302, r: 9, key: 'sign_kofel' },
];

// page 1 lives inside the tent; page 7 inside the Gipfelbuch.

const TREES = [
  // [x, floorRow, kind(0 larch,1 spruce), scale]
  [34, 70, 0, 1.0], [60, 70, 0, 0.8], [73, 70, 1, 0.9],
  [75, 70, 1, 0.7], [85, 70, 0, 0.7],
  [132, 70, 0, 1.0], [140, 70, 1, 0.9], [152, 70, 0, 0.9], [160, 70, 0, 0.8],
  [34, 48, 1, 0.7], [36, 48, 0, 0.8], [78, 48, 0, 1.1],
  [42, 48, 0, 0.6],
  [189, 70, 1, 0.9], [200, 70, 0, 1.0], [218, 70, 1, 0.8], [221, 66, 1, 0.6], [235, 70, 0, 0.9],
];

const FLOWERS = [ // alpenrose & friends on the Alm, edelweiss up top
  [46, 48, 'rose'], [58, 48, 'rose'], [76, 48, 'rose'], [84, 48, 'rose'],
  [92, 6, 'gent'], [112, 4, 'gent'], [123, 5, 'gent'],
  [309, 1, 'edel'], [313, 1, 'edel'],
  [191, 70, 'gent'], [197, 68, 'rose'], [204, 70, 'gent'], [223, 66, 'gent'], [229, 70, 'rose'],
];

// Background rock faces (drawn faded, behind the action — they sell the mountain)
const BG_ROCK = [
  { x: 71, y: 9,  w: 7,  h: 12 },             // crag rising behind the ferrata-top plaque (so it isn't floating)
  { x: 72, y: 19, w: 94, h: 51 },             // the great south face under the ridge pillars
  { x: 2,  y: 37, w: 31, h: 33 },             // gorge wall
  { x: 2,  y: 0,  w: 26, h: 28 },             // shoulder above the Stellung
  { x: 27, y: 17, w: 35, h: 13, cave: true }, // backwall of the Stollen
  { x: 264, y: 20, w: 56, h: 50 },            // the great south face of the Gamskofel
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
    'Im Beobachterstand hängt eine Grubenlampe. Geputzt. Geölt.',
    'Jemand kommt seit Jahren hierher und hält sie bereit.',
    'STIRNLAMPE — Licht im Dunkel. Lampada: luce nel buio.',
  ],
  get_kit: [
    'In der Depotkiste: ein Klettersteigset, geölt und gepackt.',
    'Ein Anhänger: „Leihgabe der Bergfreunde. Zurückbringen — oder weitergeben.“',
    'KLETTERSTEIGSET — Seile sind jetzt Wege. Set da ferrata: le funi diventano sentieri.',
  ],
  depot: [
    ['', 'Eine wetterfeste Kiste der Bergfreunde: Reservschlingen, ein Seilring, Karbiddosen.'],
    ['', 'Wer das hier auffüllt, klettert jedes Mal den harten Weg herauf. Respekt.'],
  ],
  tin_find: [
    'Halb im Schlamm: eine Blechdose, mit Wachs verschlossen. Dein Sprung hat sie freigelegt.',
    'Darin: eine 10-Lire-Münze und ein Bleistiftzettel:',
    '„Ida — wenn du das findest, bist du gesprungen. Du schuldest mir zehn Lire. — R.“',
    'Der Zinnensprung war also schon IHRE Mutprobe. Natürlich war er das.',
  ],
  toast_tin: 'Idas Dose! Vom Grund des Teichs.',
  toast_marmots_all: 'Alle fünf Murmeltiere! Ab jetzt pfeifen sie dir zur Begrüßung.',
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
  sign_wache:   ['„Beobachterstand ↑ / Osservatorio ↑“', 'Mit Kreide darunter: „Die Lampe ist mit der Wache hinauf. Bring sie brennend zurück.“'],
  sign_almweg:  ['„Wasserfallsteig ↓ — nur für Gämsen und Sture.“', '„Sentiero della cascata — solo per camosci e testardi.“'],
  sign_alm:     ['„Gamsblick-Alm, 1924. Heute: Kastanienwochen!“', '„Malga Gamsblick — settimane della castagna!“'],
  sign_hochband:['„Klettersteig ‚Rosa‘ → · Biwak · Nur mit Set / solo con set!“', 'Mit Kreide: „Kein Set dabei? Die Bergfreunde lagern Ersatz im Depot — oben überm Stollenmaul.“'],
  sign_grat:    ['„Gipfel / Cima 20 min →“', 'Darunter, eingeritzt und fast verwittert: „R + I 1974“'],
  sign_notch:   ['„ACHTUNG SCHARTE! / ATTENZIONE!“', 'Kleiner, in Bleistift: „Der Zinnensprung. Unten ist der Teich. Angeblich.“'],
  sign_flug:    ['„Flugschule Gamstal — demnächst / prossimamente.“', 'Der Berg ist hier noch nicht fertig.'],
  sign_vorgipfel: ['„Vorgipfel — Rosa & Ida, 1974.“', 'Ein Steinmann markiert den alten Gipfel. Von hier ging es damals zurück. Du gehst weiter.'],
  sign_kofel:     ['„Gamskofel ↑ — Nur für Ausdauernde. / Solo per i tenaci.“', 'Das Holz ist neu, die Schrauben glänzen. Den Weg gibt es noch nicht lange.'],

  flug_unlock: [
    'Hinter dem Schild lehnt ein Paket in Wachstuch. Ein Zettel:',
    '„Für die Enkelin von der Rosa. Der Berg hat dir das Gehen gezeigt —',
    'jetzt zeigen wir dir das Fliegen. — Die Gamstaler Bergfreunde“',
    'GLEITSCHIRM — halte SPRINGEN in der Luft, RUNTER zum Sturzflug.',
    'Und: hinterm Schild ist ein schmaler Durchschlupf frei. Dahinter wartet das Hintere Tal.',
  ],
  gate_flug: 'Der Fels bricht hier ab. Ein schmaler Durchschlupf — mutig sein.',
  sign_talende: ['„Talende. / Fine valle.“', 'Kleiner, in Kreide: „Wer bis hierher fliegt, hat es verdient, kurz zu sitzen.“'],
  chapel: [
    ['', 'Eine winzige Kapelle, kaum größer als ein Heuschober.'],
    ['', 'Drinnen brennt eine Kerze, die niemand brennen sehen muss. Du lässt sie brennen.'],
  ],
  toast_thermal: 'THERMIK! Die warme Luft trägt dich nach oben. · Termica!',
  toast_sink: 'ABWIND! Kalte Luft zieht dich runter — durchtauchen oder ausweichen, dann Thermik suchen. · Aria che scende!',
  toast_ring: n => `Ring ${n}/5 · Anello ${n}/5`,
  toast_rings_done: 'ALLE RINGE! Zurück zu Vera. · Tutti gli anelli!',

  vera: {
    first: [
      ['Vera', 'Na sowas — bist du durchs Felsfenster geklettert? Ohne Schirm? Respekt.'],
      ['Vera', 'Vera. Flugschule Gamstal — bis jetzt bestand die aus mir und dem Windsack.'],
      ['Vera', 'Hier, nimm den. War mal Rosas. Der Berg hat dir das Gehen gezeigt — jetzt lernst du fliegen.'],
      ['Vera', 'GLEITSCHIRM — halte SPRINGEN in der Luft, RUNTER zum Sturzflug.'],
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
      ['Norbert', 'Wenn\'s dunkel wird: im Beobachterstand über der alten Stellung hängt seit Jahren eine Lampe. Frag nicht, wer sie ölt.'],
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
  lookout: [
    ['', 'Sandsäcke, ein verrostetes Fernrohr, Initialen im Holz.'],
    ['', 'Von hier oben siehst du jeden Weg, den du bis jetzt gegangen bist.'],
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
  toast_glissade: 'GERÖLLRUTSCH! Halte RUNTER, lehn dich rein — der Hang trägt dich. LINKS bremst. · Che discesa!',
  toast_ice: 'BLANKEIS! Glashart und glatt — kaum Halt, langsam bremsen. · Ghiaccio vivo!',
  toast_mud: 'NASSES MOOR! Zäher Schlamm bremst dich aus und zieht dich runter. · Fango!',
  toast_fall_water: 'Ohne Jacke drückt dich der Wasserfall einfach hinunter.',
  toast_dark: 'Stockfinster. Ohne Licht traust du dich kaum einen Schritt.',
  toast_draft: 'Ein Luftzug lässt die Lampe flackern — warte, bis die Flamme ruhig brennt, bevor du springst. · Spiffero!',
  toast_dark_turn: 'Zu dunkel. Du drehst um — ohne Lampe geht es hier nicht weiter.',
  toast_cable: 'Ein Stahlseil. Ohne Klettersteigset bleibt es nur Dekoration.',
  toast_cable_ok: 'HOCH drücken zum Einhängen · SU per agganciarsi',
  toast_cable_top: 'Seilende. SPRING ab! · Fine della fune: salta!',
  toast_cold: 'Dir wird kalt! Such ein Feuer. · Hai freddo!',
  toast_knoedel: 'KNÖDEL! Maximale Wärme erhöht. · Canederli: calore massimo +',
  toast_chestnut: n => `Kastanie! (${n}/3) · Castagna!`,
  toast_marmot: n => `Murmeltier entdeckt! (${n}/5) · Marmotta avvistata!`,
  toast_page: n => `Tagebuchseite ${n}/7 · Pagina ${n}/7`,
  toast_sprung: 'DER ZINNENSPRUNG! Oma wäre stolz. Und entsetzt. Aber stolz.',
  toast_stumble: 'Autsch. Das war kein Gämsensprung.',
  toast_steinschlag: 'STEINSCHLAG! Ein Brocken hat dich gestreift. · Caduta sassi!',
  toast_crumble: 'Der Fels bröckelt unter dir — schnell weiter! · La roccia si sgretola!',
  toast_saved: 'Gespeichert · Salvato',
  cold_respawn: 'Durchgefroren bis auf die Knochen kehrst du zum letzten Feuer zurück.',

  objectives: {
    start:    'Sieh dich am Campingplatz um (Zelt, Greta, Lagerfeuer)',
    boots:    'Nach OSTEN → durchs Schartl in den Wald: im Unterstand sollen Schuhe sein',
    alm:      'Der Geröllweg zur Gamsblick-Alm ist jetzt machbar',
    chestnut: 'Drei Kastanien für Norbert (Wald & Teich)',
    jacket:   'Der Wasserfallsteig — Gämsen und Sture',
    lamp:     'Der Stollen ist stockfinster — im Beobachterstand über der Stellung soll eine Lampe hängen',
    tunnel:   'Durch den Stollen von 1916',
    kit:      'Ohne Set kein Seil — die Bergfreunde lagern Ersatz im Depot überm Stollenmaul',
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
  map_close: 'M oder ✕ zum Schließen · chiudi',
  map_here: 'Du bist hier:',
  album_btn: 'Album',
  album_title: 'Omas Fotos · Le fotografie',
  album_hint: 'Antippen zum Ansehen · tocca per vedere',
  obj_prefix: 'Ziel: ',
  newobj_prefix: 'Neues Ziel: ',
  dlg_next: 'Weiter · continua',
  rested: 'Kurz gerastet. Wärme aufgefüllt, Spielstand gespeichert. · Riposato e salvato.',
  continue_caption: 'Weiter geht\'s · si continua',
  ctl_hint1: '← → laufen · Leertaste springen · E benutzen · M Karte · F Vollbild',
  ctl_hint2: 'Ein Spaziergang, kein Kampf. · Niente combattimenti, solo montagna.',
  lang_btn: 'Language: English?',
  photos_unlocked: 'In der Blechdose stecken noch fünf Fotos von 1974. Finde die Orte, an denen sie aufgenommen wurden!',
  st_time: m => `Wanderzeit: ${m} min`,
  st_pages: (a, b) => `Tagebuchseiten: ${a}/7 · Omas Fotos: ${b}/5`,
  st_animals: (a, b) => `Murmeltiere: ${a}/5 · Gams gesehen: ${b}×`,
  st_sprung: (y, tin) => `Zinnensprung: ${y ? (tin ? 'JA — und Idas Dose gefunden!' : 'JA!') : 'noch nicht…'}`,
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
    'A miner\'s lamp hangs at the observer post. Polished. Oiled.',
    'Someone has been coming up here for years, keeping it ready.',
    'HEADLAMP — light in the dark. Stirnlampe!',
  ],
  get_kit: [
    'In the depot crate: a via ferrata set, oiled and packed.',
    'A tag: "On loan from the mountain friends. Bring it back — or pass it on."',
    'FERRATA SET — cables are paths now. Klettersteigset!',
  ],
  depot: [
    ['', 'A weatherproof crate of the mountain friends: spare slings, a coil of rope, carbide tins.'],
    ['', 'Whoever restocks this climbs up here the hard way, every time. Respect.'],
  ],
  tin_find: [
    'Half-buried in the silt: a tin, sealed with wax. Your jump shook it loose.',
    'Inside: a 10-lire coin and a pencil note:',
    '"Ida — if you ever find this, you jumped. You owe me ten lire. — R."',
    'So the Zinnensprung was THEIR dare first. Of course it was.',
  ],
  toast_tin: "Ida's tin! From the bottom of the pond.",
  toast_marmots_all: 'All five marmots! From now on they whistle when you come by.',
  get_jacket: [
    'Norbert disappears into the hut and returns with a red',
    'rain jacket, patched a dozen times. Inside, faded: R.O.',
    '"It\'s been hanging here since 1974. I reckon it\'s yours."',
    'RAIN JACKET — the waterfall is a doorway now. Regenjacke!',
  ],

  sign_camp:    ['"Larch forest & pond → through the Schartl · Waterfall 20 min ←"', 'And in marker pen: "KNÖDEL!!"'],
  sign_schartl: ['"Through the Schartl → larch forest, pond, shelter."', 'The steps are worn smooth — everyone comes this way.'],
  sign_sattel:  ['"↖ Gamsblick Alm over the scree — ONLY with proper boots!"', '"↙ Schartl: campsite · → forest & pond"'],
  sign_wache:   ['"Observer post ↑ / Osservatorio ↑"', 'Chalked beneath: "The lamp went up with the watch. Bring it back lit."'],
  sign_almweg:  ['"Waterfall route ↓ — for chamois and the stubborn only."', '"Sentiero della cascata — solo per camosci e testardi."'],
  sign_alm:     ['"Gamsblick Alm, est. 1924. This week: chestnut weeks!"', '"Malga Gamsblick — settimane della castagna!"'],
  sign_hochband:['"Via ferrata \'Rosa\' → · Bivouac · Set required / solo con set!"', 'Chalked: "No set? The mountain friends keep spares in the depot — up over the tunnel mouth."'],
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
  toast_sink: 'SINKING AIR! A cold downdraft — dive through or steer clear, then find a thermal. · Aria che scende!',
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
      ['Norbert', 'When it gets dark: at the observer post above the old position a lamp has hung for years. Don\'t ask who oils it.'],
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
  lookout: [
    ['', 'Sandbags, a rusted scope, initials scratched into the wood.'],
    ['', 'From up here you can see every path you have walked so far.'],
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
  toast_glissade: 'SCREE-RUN! Hold DOWN and lean in — the slope carries you. LEFT digs in to brake. · Che discesa!',
  toast_ice: 'BLANKEIS! Glass-hard and slick — almost no grip, brake early. · Ghiaccio vivo!',
  toast_mud: 'WET MUD! Thick bog slows you down and dampens your jumps. · Fango!',
  toast_fall_water: 'Without a jacket, the waterfall simply hammers you down.',
  toast_dark: 'Pitch black. Without a light you hardly dare take a step.',
  toast_draft: 'A draft gutters your lamp — wait for the flame to steady before you leap. · Spiffero!',
  toast_dark_turn: 'Too dark. You turn back — no going further without a lamp.',
  toast_cable: 'A steel cable. Without a ferrata set it stays decoration.',
  toast_cable_ok: 'Press UP to clip in',
  toast_cable_top: 'End of the cable. JUMP off!',
  toast_cold: 'You\'re getting cold! Find a fire.',
  toast_knoedel: 'KNÖDEL! Maximum warmth increased.',
  toast_chestnut: n => `Chestnut! (${n}/3)`,
  toast_marmot: n => `Marmot spotted! (${n}/5)`,
  toast_page: n => `Journal page ${n}/7`,
  toast_sprung: 'THE ZINNENSPRUNG! Oma would be proud. And appalled. But proud.',
  toast_stumble: 'Ouch. That was no chamois landing.',
  toast_steinschlag: 'ROCKFALL! A loose stone clips you. · Steinschlag!',
  toast_crumble: 'The ledge is crumbling — keep moving! · Brüchiger Fels!',
  toast_saved: 'Saved',
  cold_respawn: 'Chilled to the bone, you turn back to the last fire.',

  objectives: {
    start:    'Look around the campsite (tent, Greta, campfire)',
    boots:    'Head EAST → through the Schartl into the forest: there should be boots in the shelter',
    alm:      'The scree path up to Gamsblick Alm is doable now',
    chestnut: 'Three chestnuts for Norbert (forest & pond)',
    jacket:   'The waterfall route — chamois and the stubborn',
    lamp:     'The tunnel is pitch dark — a lamp is said to hang at the observer post above the old position',
    tunnel:   'Through the tunnel of 1916',
    kit:      'No set, no cable — the mountain friends keep spares in a depot above the tunnel mouth',
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
  map_close: 'Press M or ✕ to close',
  map_here: 'You are at:',
  album_btn: 'Album',
  album_title: 'Oma\'s photos · Omas Fotos',
  album_hint: 'Tap a photo to view it',
  obj_prefix: 'Goal: ',
  newobj_prefix: 'New goal: ',
  dlg_next: 'Continue',
  rested: 'You rest a while. Warmth restored, game saved.',
  continue_caption: 'Onward · weiter geht\'s',
  ctl_hint1: '← → move · Space jump · E interact · M map · F fullscreen',
  ctl_hint2: 'A hike, not a fight. · Ein Spaziergang, kein Kampf.',
  lang_btn: 'Sprache: Deutsch?',
  photos_unlocked: 'Tucked in the tin box: five more photos from 1974. Find the places where they were taken!',
  st_time: m => `Hiking time: ${m} min`,
  st_pages: (a, b) => `Journal pages: ${a}/7 · Oma's photos: ${b}/5`,
  st_animals: (a, b) => `Marmots: ${a}/5 · Chamois seen: ${b}×`,
  st_sprung: (y, tin) => `Zinnensprung: ${y ? (tin ? "YES — and Ida's tin found!" : 'YES!') : 'not yet…'}`,
  st_knoedel: y => `Knödel: ${y ? 'the best of your life' : 'missed?!'}`,
  st_flug: (f, g, n) => `Flight school: ${f ? 'STUDENT NO. 1' : g ? `rings ${n}/5` : 'coming soon…'}`,
};

let TX = TX_EN; // English is the default; the title screen can switch

// Gear display
const GEAR_INFO = { // icons are drawn by drawIcon(key) in game.js
  boots:  { de: 'Wanderschuhe', en: 'Hiking boots' },
  jacket: { de: 'Regenjacke', en: 'Rain jacket' },
  lamp:   { de: 'Stirnlampe', en: 'Headlamp' },
  kit:    { de: 'Klettersteigset', en: 'Ferrata set' },
  glider: { de: 'Gleitschirm', en: 'Paraglider' },
};

// Shift all Y coordinates of static elements by Y_OFF
WATERFALL.y += Y_OFF;
for (const t of THERMALS) t.y += Y_OFF;
for (const s of SINK) s.y += Y_OFF;
for (const r of RINGS) r[1] += Y_OFF;
for (const m of MOVERS) { m.y += Y_OFF; m.y2 += Y_OFF; }
for (const c of CRUMBLE) c.y += Y_OFF;
for (const s of STONEFALL) { s.y += Y_OFF; s.floor += Y_OFF; }
for (const z of ZONES) z.y += Y_OFF;
for (const e of ENTITIES) e.r += Y_OFF;
for (const t of TREES) t[1] += Y_OFF;
for (const f of FLOWERS) f[1] += Y_OFF;
for (const r of BG_ROCK) r.y += Y_OFF;

if (typeof module !== 'undefined') {
  module.exports = { TILE, WORLD_W, WORLD_H, buildWorld, WATERFALL, THERMALS, SINK, RINGS, MOVERS, CRUMBLE, STONEFALL, ZONES, PHASES, ENTITIES, TREES, FLOWERS, BG_ROCK, TX_DE, TX_EN, GEAR_INFO };
}
