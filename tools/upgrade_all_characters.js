const fs = require('fs');
const path = require('path');

const GAME_JS_PATH = path.join(__dirname, '..', 'game.js');

function upgradeAll() {
  console.log('Upgrading all remaining character assets to high-fidelity...');
  
  if (!fs.existsSync(GAME_JS_PATH)) {
    console.error(`Error: game.js not found at ${GAME_JS_PATH}`);
    process.exit(1);
  }

  let code = fs.readFileSync(GAME_JS_PATH, 'utf8');

  // =========================================================================
  // 1. LUKAS PORTRAIT
  // =========================================================================
  const oldLukasPortraitTarget = `    case 'player': {
      shoulders(G.gear.jacket ? '#c0392b' : '#2e7d6b');
      head(-1); eyes(-1);
      cx.fillStyle = '#d98032';                                        // beanie
      cx.beginPath(); cx.arc(0, -3.5, 7.6, Math.PI, 0); cx.fill();
      cx.fillRect(-7.6, -5, 15.2, 2.6);
      cx.fillStyle = '#b96a24'; cx.fillRect(-7.6, -3.2, 15.2, 1);
      break;
    }`;

  const newLukasPortraitReplacement = `    case 'player': {
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
        cx.fillStyle = '#4a4e55';
        cx.fillRect(4.5, hy - 8.5, 5, 3.8);
        cx.fillStyle = '#3a3e45';
        cx.fillRect(4.5, hy - 8.5, 5, 1.2);
        if (lampOn()) {
          cx.fillStyle = 'rgba(255,235,150,0.9)';
          cx.beginPath(); cx.arc(7, hy - 6.6, 2.5, 0, 7); cx.fill();
          cx.fillStyle = 'rgba(255,235,150,0.25)';
          cx.beginPath(); cx.arc(7, hy - 6.6, 6, 0, 7); cx.fill();
        }
      }
      break;
    }`;

  if (code.includes(oldLukasPortraitTarget)) {
    code = code.replace(oldLukasPortraitTarget, newLukasPortraitReplacement);
    console.log('  [+] Upgraded Lukas portrait code');
  } else {
    console.log('  [~] Lukas portrait target already updated or not found');
  }

  // =========================================================================
  // 2. NORBERT IN-GAME SPRITE & PORTRAIT
  // =========================================================================
  const oldNorbertSpriteTarget = `      // --- Fallback: procedural NPC drawing (Norbert without sprites) ---
      const px2 = x, py2 = y;
      // body
      cx.fillStyle = '#3f5e3a';
      cx.fillRect(px2 - 5, py2 - 16, 10, 12);
      // apron for Norbert
      cx.fillStyle = '#2b3a66'; cx.fillRect(px2 - 4, py2 - 11, 8, 7);
      // head
      cx.fillStyle = '#e8b88a'; cx.beginPath(); cx.arc(px2, py2 - 20, 4.5, 0, 7); cx.fill();
      // Tyrolean hat + feather
      cx.fillStyle = '#4a5e3a'; cx.fillRect(px2 - 5, py2 - 26, 10, 3); cx.fillRect(px2 - 3, py2 - 28, 6, 3);
      cx.fillStyle = '#d9577a'; cx.fillRect(px2 + 3, py2 - 28, 2, 4);
      // legs
      cx.fillStyle = '#3d3327'; cx.fillRect(px2 - 4, py2 - 5, 3, 5); cx.fillRect(px2 + 1, py2 - 5, 3, 5);
      break;`;

  const newNorbertSpriteReplacement = `      if (e.who === 'norbert') {
        const px2 = x, py2 = y;
        // Legs & boots
        cx.fillStyle = '#3d3327';
        cx.fillRect(px2 - 4.5, py2 - 5, 3, 5);
        cx.fillRect(px2 + 1.5, py2 - 5, 3, 5);
        // Boot soles
        cx.fillStyle = '#231e17';
        cx.fillRect(px2 - 5.5, py2 - 1.5, 4.5, 1.2);
        cx.fillRect(px2 + 0.5, py2 - 1.5, 4.5, 1.2);
        
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
        break;
      }`;

  const oldNorbertPortraitTarget = `    case 'norbert': {
      shoulders('#3f5e3a');
      cx.fillStyle = '#2b3a66'; cx.fillRect(-4, 10, 8, 6);             // apron bib
      head(-1); eyes(-1);
      cx.fillStyle = '#4a5e3a';                                        // tyrolean hat
      cx.fillRect(-8.5, -7.5, 17, 2.6);
      cx.fillRect(-5.5, -13.5, 11, 6.5);
      cx.fillStyle = '#d9577a'; cx.fillRect(4, -14, 2, 5);             // feather
      break;
    }`;

  const newNorbertPortraitReplacement = `    case 'norbert': {
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
    }`;

  if (code.includes(oldNorbertSpriteTarget)) {
    code = code.replace(oldNorbertSpriteTarget, newNorbertSpriteReplacement);
    console.log('  [+] Upgraded Norbert in-game sprite code');
  } else {
    console.log('  [~] Norbert sprite target already updated or not found');
  }

  if (code.includes(oldNorbertPortraitTarget)) {
    code = code.replace(oldNorbertPortraitTarget, newNorbertPortraitReplacement);
    console.log('  [+] Upgraded Norbert portrait code');
  } else {
    console.log('  [~] Norbert portrait target already updated or not found');
  }

  // =========================================================================
  // 3. VERA IN-GAME SPRITE & PORTRAIT
  // =========================================================================
  const oldVeraSpriteTarget = `      if (e.who === 'vera') {
        const px2 = x, py2 = y;
        // Legs & boots
        cx.fillStyle = '#3d3327';
        cx.fillRect(px2 - 4, py2 - 5, 2.6, 5);
        cx.fillRect(px2 + 1.4, py2 - 5, 2.6, 5);
        cx.fillStyle = '#231e17'; // soles
        cx.fillRect(px2 - 4.5, py2 - 1.5, 3.5, 1.2);
        cx.fillRect(px2 + 1, py2 - 1.5, 3.5, 1.2);
        
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
        break;
      }`;

  if (code.includes(oldVeraSpriteTarget)) {
    console.log('  [~] Vera sprite target already updated or not found');
  } else {
    // Check if we need to do the initial upgrade
    const initialVeraSpriteTarget = `      if (e.who === 'vera') {
        cx.fillStyle = '#b8483a'; cx.fillRect(x - 5, y - 16, 10, 12);  // flight suit
        cx.fillStyle = '#e8b88a'; cx.beginPath(); cx.arc(x, y - 20, 4.5, 0, 7); cx.fill();
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x, y - 23, 4.2, Math.PI, 0); cx.fill(); // helmet
        cx.fillStyle = '#3d3327'; cx.fillRect(x - 4, y - 5, 3, 5); cx.fillRect(x + 1, y - 5, 3, 5);
        cx.strokeStyle = '#888'; cx.lineWidth = 1; // sunglasses
        cx.beginPath(); cx.moveTo(x - 3, y - 21); cx.lineTo(x + 3, y - 21); cx.stroke();
        break;
      }`;
    if (code.includes(initialVeraSpriteTarget)) {
      code = code.replace(initialVeraSpriteTarget, newVeraSpriteReplacement);
      console.log('  [+] Upgraded Vera in-game sprite code (fallback branch)');
    }
  }

  // =========================================================================
  // 4. STROLCH (DOG) IN-GAME SPRITE & PORTRAIT
  // =========================================================================
  const oldDogSpriteTarget = `    case 'dog': {
      if (e.present === false) return;
      const wag = Math.sin(frame * 0.3) * 3;
      const face = e.face || 1;
      cx.save();
      cx.translate(x, y);
      cx.scale(face, 1);
      cx.fillStyle = '#8a6a44';
      cx.fillRect(-7, -7, 13, 5);
      cx.beginPath(); cx.arc(7, -8, 3.5, 0, 7); cx.fill();
      cx.fillRect(7, -12, 2, 3); // ear
      cx.strokeStyle = '#8a6a44'; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(-7, -6); cx.lineTo(-11, -9 + wag); cx.stroke();
      cx.fillRect(-6, -3, 2, 3); cx.fillRect(3, -3, 2, 3);
      cx.restore();
      break;
    }`;

  const newDogSpriteReplacement = `    case 'dog': {
      if (e.present === false) return;
      const wag = Math.sin(frame * 0.3) * 3;
      const face = e.face || 1;
      cx.save();
      cx.translate(x, y);
      cx.scale(face, 1);
      
      // Legs
      cx.fillStyle = '#8a6a44';
      cx.fillRect(-5.5, -3, 2, 3);
      cx.fillRect(3.5, -3, 2, 3);
      // Dark paws
      cx.fillStyle = '#6b4f30';
      cx.fillRect(-6, -1, 2.5, 1.2);
      cx.fillRect(3, -1, 2.5, 1.2);

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
    }`;

  const oldDogPortraitTarget = `    case 'dog': {
      shoulders('#8a6a44');
      cx.fillStyle = '#8a6a44';
      cx.fillRect(-8.5, -10, 4, 7); cx.fillRect(4.5, -10, 4, 7);       // ears
      cx.beginPath(); cx.arc(0, -1, 7.2, 0, 7); cx.fill();             // head
      cx.fillStyle = '#a8845a'; cx.beginPath(); cx.ellipse(0, 2.5, 4.2, 3, 0, 0, 7); cx.fill(); // muzzle
      cx.fillStyle = eye; cx.beginPath(); cx.arc(0, 1.2, 1.7, 0, 7); cx.fill(); // nose
      eyes(-4);
      break;
    }`;

  const newDogPortraitReplacement = `    case 'dog': {
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
    }`;

  if (code.includes(oldDogSpriteTarget)) {
    code = code.replace(oldDogSpriteTarget, newDogSpriteReplacement);
    console.log('  [+] Upgraded Strolch in-game sprite code');
  } else {
    console.log('  [~] Strolch sprite target already updated or not found');
  }

  if (code.includes(oldDogPortraitTarget)) {
    code = code.replace(oldDogPortraitTarget, newDogPortraitReplacement);
    console.log('  [+] Upgraded Strolch portrait code');
  } else {
    console.log('  [~] Strolch portrait target already updated or not found');
  }

  // =========================================================================
  // 5. KUH (COW) IN-GAME SPRITE & PORTRAIT
  // =========================================================================
  const oldCowSpriteTarget = `    case 'cow': {
      const face = e.face || 1;
      cx.save();
      cx.translate(x, y);
      cx.scale(face, 1);
      cx.fillStyle = '#9a6f4a';
      cx.fillRect(-12, -14, 24, 9);
      cx.fillStyle = '#e8e0cd'; cx.fillRect(-4, -14, 7, 9); // patch
      cx.fillStyle = '#9a6f4a'; cx.beginPath(); cx.arc(14, -14, 4.5, 0, 7); cx.fill();
      cx.fillStyle = '#3d3327';
      cx.fillRect(-10, -5, 3, 5); cx.fillRect(-2, -5, 3, 5); cx.fillRect(6, -5, 3, 5);
      cx.fillStyle = '#d8d2bd'; cx.fillRect(11, -20, 2, 4); cx.fillRect(16, -20, 2, 4); // horns
      // bell
      cx.fillStyle = '#c9b46a'; cx.fillRect(12, -10, 4, 4);
      cx.restore();
      break;
    }`;

  const newCowSpriteReplacement = `    case 'cow': {
      const face = e.face || 1;
      cx.save();
      cx.translate(x, y);
      cx.scale(face, 1);
      
      // Legs (sturdier structure with defined hooves)
      cx.fillStyle = '#3d3327';
      cx.fillRect(-10, -5, 3, 5);
      cx.fillRect(-2, -5, 3, 5);
      cx.fillRect(6, -5, 3, 5);
      // Hooves (dark slate/grey)
      cx.fillStyle = '#1c1b18';
      cx.fillRect(-10.5, -1.5, 4, 1.5);
      cx.fillRect(-2.5, -1.5, 4, 1.5);
      cx.fillRect(5.5, -1.5, 4, 1.5);

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
    }`;

  const oldCowPortraitTarget = `    case 'cow': {
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
    }`;

  const newCowPortraitReplacement = `    case 'cow': {
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
    }`;

  if (code.includes(oldCowSpriteTarget)) {
    code = code.replace(oldCowSpriteTarget, newCowSpriteReplacement);
    console.log('  [+] Upgraded Cow in-game sprite code');
  } else {
    console.log('  [~] Cow sprite target already updated or not found');
  }

  if (code.includes(oldCowPortraitTarget)) {
    code = code.replace(oldCowPortraitTarget, newCowPortraitReplacement);
    console.log('  [+] Upgraded Cow portrait code');
  } else {
    console.log('  [~] Cow portrait target already updated or not found');
  }

  fs.writeFileSync(GAME_JS_PATH, code, 'utf8');
  console.log('Upgrade of all characters finished successfully.');
}

upgradeAll();
