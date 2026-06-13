const fs = require('fs');
const path = require('path');

const GAME_JS_PATH = path.join(__dirname, '..', 'game.js');

function upgradeCharacters() {
  console.log('Starting character design upgrades...');
  
  if (!fs.existsSync(GAME_JS_PATH)) {
    console.error(`Error: game.js not found at ${GAME_JS_PATH}`);
    process.exit(1);
  }

  let code = fs.readFileSync(GAME_JS_PATH, 'utf8');

  // =========================================================================
  // 1. GRETA (TEST RUN)
  // =========================================================================
  
  // A. In-game sprite drawing for Greta (drawEntity)
  const oldGretaSpriteTarget = `      if (e.who === 'vera') {
        cx.fillStyle = '#b8483a'; cx.fillRect(x - 5, y - 16, 10, 12);  // flight suit
        cx.fillStyle = '#e8b88a'; cx.beginPath(); cx.arc(x, y - 20, 4.5, 0, 7); cx.fill();
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x, y - 23, 4.2, Math.PI, 0); cx.fill(); // helmet
        cx.fillStyle = '#3d3327'; cx.fillRect(x - 4, y - 5, 3, 5); cx.fillRect(x + 1, y - 5, 3, 5);
        cx.strokeStyle = '#888'; cx.lineWidth = 1; // sunglasses
        cx.beginPath(); cx.moveTo(x - 3, y - 21); cx.lineTo(x + 3, y - 21); cx.stroke();
        break;
      }`;

  const newGretaSpriteReplacement = `      if (e.who === 'vera') {
        cx.fillStyle = '#b8483a'; cx.fillRect(x - 5, y - 16, 10, 12);  // flight suit
        cx.fillStyle = '#e8b88a'; cx.beginPath(); cx.arc(x, y - 20, 4.5, 0, 7); cx.fill();
        cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x, y - 23, 4.2, Math.PI, 0); cx.fill(); // helmet
        cx.fillStyle = '#3d3327'; cx.fillRect(x - 4, y - 5, 3, 5); cx.fillRect(x + 1, y - 5, 3, 5);
        cx.strokeStyle = '#888'; cx.lineWidth = 1; // sunglasses
        cx.beginPath(); cx.moveTo(x - 3, y - 21); cx.lineTo(x + 3, y - 21); cx.stroke();
        break;
      }
      if (e.who === 'greta') {
        const px2 = x, py2 = y;
        // Legs & sturdy shoes
        cx.fillStyle = '#3d3327';
        cx.fillRect(px2 - 4, py2 - 5, 3, 5);
        cx.fillRect(px2 + 1, py2 - 5, 3, 5);
        // Shoe soles
        cx.fillStyle = '#231e17';
        cx.fillRect(px2 - 5, py2 - 1.5, 4.5, 1.2);
        cx.fillRect(px2 + 0.5, py2 - 1.5, 4.5, 1.2);
        
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
        break;
      }`;

  // B. Portrait image drawing for Greta (drawPortrait)
  const oldGretaPortraitTarget = `    case 'greta': {
      shoulders('#6f5a7d');
      head(-1); eyes(-1);
      cx.fillStyle = '#cfcfcf';                                        // grey hair + bun
      cx.beginPath(); cx.arc(0, -3.5, 7.6, Math.PI, 0); cx.fill();
      cx.beginPath(); cx.arc(0, -12, 3.2, 0, 7); cx.fill();
      break;
    }`;

  const newGretaPortraitReplacement = `    case 'greta': {
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
    }`;

  // C. Update the Fallback logic to remove Greta so it only handles Norbert
  const oldFallbackTarget = `      // --- Fallback: procedural NPC drawing (Greta / Norbert without sprites) ---
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
      break;`;

  const newFallbackReplacement = `      // --- Fallback: procedural NPC drawing (Norbert without sprites) ---
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

  // Apply Greta Sprite Upgrade
  if (code.includes(oldGretaSpriteTarget)) {
    code = code.replace(oldGretaSpriteTarget, newGretaSpriteReplacement);
    console.log('  [+] Upgraded Greta in-game sprite code');
  } else {
    console.log('  [~] Greta sprite target already updated or not found');
  }

  // Apply Greta Portrait Upgrade
  if (code.includes(oldGretaPortraitTarget)) {
    code = code.replace(oldGretaPortraitTarget, newGretaPortraitReplacement);
    console.log('  [+] Upgraded Greta portrait image code');
  } else {
    console.log('  [~] Greta portrait target already updated or not found');
  }

  // Apply Fallback cleaning (remove Greta from it)
  if (code.includes(oldFallbackTarget)) {
    code = code.replace(oldFallbackTarget, newFallbackReplacement);
    console.log('  [+] Cleaned generic fallback to only apply to Norbert');
  } else {
    console.log('  [~] Fallback target already cleaned or not found');
  }

  // =========================================================================
  // FUTURE CHARACTER UPGRADES PLACEHOLDERS
  // =========================================================================
  // The framework can be easily extended to Norbert, Vera, Strolch, Kuh, etc.
  // by adding similar replacements here.

  fs.writeFileSync(GAME_JS_PATH, code, 'utf8');
  console.log('Upgrade process finished successfully.');
}

upgradeCharacters();
