(() => {
  'use strict';

  // === CONSTANTS ===
  const GAME_WIDTH = 400;
  const GAME_HEIGHT = 600;
  const GRAVITY = 0.35;
  const JUMP_VELOCITY = -12;
  const SPRING_VELOCITY = -18;
  const MOVE_SPEED = 5;
  const PLAYER_WIDTH = 60;
  const PLAYER_HEIGHT = 90;
  const PLATFORM_WIDTH = 70;
  const PLATFORM_HEIGHT = 25;
  const HIGH_SCORE_KEY = 'kotyhiroshko-highscore';

  // === DOM ELEMENTS ===
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const gameFrame = document.getElementById('gameFrame');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayScore = document.getElementById('overlayScore');
  const overlayHint = document.getElementById('overlayHint');
  const playBtn = document.getElementById('playBtn');
  const scorePill = document.getElementById('scorePill');
  const bestPill = document.getElementById('bestPill');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');

  // === CANVAS SETUP ===
  const dpr = window.devicePixelRatio || 1;
  canvas.width = GAME_WIDTH * dpr;
  canvas.height = GAME_HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  // === SPRITES ===
  const sprites = {};
  const spritePaths = {
    playerIdle: 'assets/player/idle.png',
    playerJump: 'assets/player/jump.png',
    playerFall: 'assets/player/fall.png',
    playerVictory: 'assets/player/victory.png',
    platformWood: 'assets/platforms/wood.png',
    platformGold: 'assets/platforms/gold.png',
    platformSpring: 'assets/platforms/spring.png',
    platformBreaking: 'assets/platforms/breaking.png',
    platformTrident: 'assets/platforms/trident.png',
    enemySnake: 'assets/enemies/snake.png',
    enemyDragon: 'assets/enemies/dragon.png',
    enemyGolem: 'assets/enemies/golem.png',
    enemySpike: 'assets/enemies/spike.png',
    uiPea: 'assets/ui/pea.png',
  };

  let spritesLoaded = false;
  let loadedCount = 0;
  const totalSprites = Object.keys(spritePaths).length;

  function loadSprites(callback) {
    for (const [name, path] of Object.entries(spritePaths)) {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalSprites) {
          spritesLoaded = true;
          callback();
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load: ${path}`);
        loadedCount++;
        if (loadedCount === totalSprites) {
          spritesLoaded = true;
          callback();
        }
      };
      img.src = path;
      sprites[name] = img;
    }
  }

  // === AUDIO ===
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration, type = 'sine', gain = 0.1) {
    try {
      const ac = getAudio();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      g.gain.setValueAtTime(gain, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch {}
  }

  // === UTILITIES ===
  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerpColor(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
  }

  function rgb([r, g, b]) {
    return `rgb(${r},${g},${b})`;
  }

  // === GAME STATE ===
  let state = 'menu';
  let score = 0;
  let highScore = 0;
  try {
    highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
  } catch {
    highScore = 0;
  }
  bestPill.textContent = `Рекорд ${highScore}`;

  let player = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100, vy: 0, vx: 0, facing: 1 };
  let platforms = [];
  let enemies = [];
  let particles = [];
  let peas = [];
  let stars = [];
  let cameraY = 0;
  let maxHeight = 0;
  let highestPlatformY = 0;
  let peasCollected = 0;
  const keys = { left: false, right: false };

  // === SKY GRADIENT ===
  function makeSky(height) {
    const t = Math.min(1, height / 5000);
    const top = lerpColor([135, 206, 250], [15, 10, 45], t);
    const bottom = lerpColor([255, 220, 150], [45, 25, 80], t);
    return { top, bottom, spaceT: t };
  }

  // === PLATFORM SPAWNING ===
  function spawnPlatform(y) {
    const roll = Math.random();
    let type = 'normal';
    if (roll > 0.94) type = 'spring';
    else if (roll > 0.82) type = 'breaking';
    else if (roll > 0.65) type = 'moving';
    else if (roll > 0.55) type = 'trident';

    platforms.push({
      x: randRange(PLATFORM_WIDTH / 2, GAME_WIDTH - PLATFORM_WIDTH / 2),
      y,
      type,
      broken: false,
      breakTimer: 0,
      dir: Math.random() > 0.5 ? 1 : -1,
    });

    // Spawn pea on some platforms
    if (Math.random() > 0.7) {
      peas.push({
        x: randRange(PLATFORM_WIDTH / 2 + 20, GAME_WIDTH - PLATFORM_WIDTH / 2 - 20),
        y: y - 40,
        collected: false,
      });
    }
  }

  // === ENEMY SPAWNING ===
  function spawnEnemy(y) {
    const types = ['spike', 'snake', 'dragon', 'golem'];
    const type = types[Math.floor(Math.random() * types.length)];
    enemies.push({
      x: randRange(50, GAME_WIDTH - 50),
      y,
      type,
      dir: Math.random() > 0.5 ? 1 : -1,
      vx: randRange(1, 2.5),
    });
  }

  // === PARTICLE SYSTEM ===
  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: randRange(-3, 3),
        vy: randRange(-4, 1),
        life: 1,
        color,
        size: randRange(3, 7),
      });
    }
  }

  // === RESET GAME ===
  function resetGame() {
    platforms = [];
    enemies = [];
    particles = [];
    peas = [];
    peasCollected = 0;

    stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT * 5 - GAME_HEIGHT * 4,
      r: randRange(0.5, 2),
      twinkle: Math.random() * Math.PI * 2,
    }));

    cameraY = 0;
    maxHeight = 0;

    // Starting platform
    platforms.push({ x: GAME_WIDTH / 2, y: GAME_HEIGHT - 50, type: 'normal', broken: false, dir: 1 });

    let y = GAME_HEIGHT - 120;
    let enemyChance = 0;
    while (y > -GAME_HEIGHT * 4) {
      spawnPlatform(y);

      // Enemies start appearing after some height
      enemyChance += 0.002;
      if (Math.random() < enemyChance && enemyChance > 0.05) {
        spawnEnemy(y - 80);
        enemyChance = 0;
      }

      y -= randRange(50, 90);
    }
    highestPlatformY = y;

    player = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100, vy: JUMP_VELOCITY, vx: 0, facing: 1 };
    score = 0;
    scorePill.textContent = '0';
  }

  // === START GAME ===
  function startGame() {
    if (!spritesLoaded) return;
    getAudio();
    resetGame();
    state = 'playing';
    gameFrame.classList.add('playing');
    overlay.classList.add('hidden-overlay');
  }

  // === END GAME ===
  function endGame() {
    state = 'gameover';
    gameFrame.classList.remove('playing');
    const finalScore = Math.floor(maxHeight / 10) + peasCollected * 10;
    score = finalScore;

    if (finalScore > highScore) {
      highScore = finalScore;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
      } catch {}
    }
    bestPill.textContent = `Рекорд ${highScore}`;

    overlayTitle.textContent = 'Гру завершено!';
    overlayScore.classList.remove('hidden');
    overlayScore.innerHTML = `Рахунок: <b>${finalScore}</b> | Рекорд: <span class="best-value">${highScore}</span>`;
    overlayHint.classList.add('hidden');
    playBtn.textContent = 'Грати знову';
    overlay.classList.remove('hidden-overlay');

    playTone(220, 0.25, 'sawtooth', 0.08);
    setTimeout(() => playTone(140, 0.35, 'sawtooth', 0.08), 120);
  }

  // === UPDATE ===
  function update() {
    if (state !== 'playing') return;

    // Player movement
    if (keys.left) {
      player.vx = -MOVE_SPEED;
      player.facing = -1;
    } else if (keys.right) {
      player.vx = MOVE_SPEED;
      player.facing = 1;
    } else {
      player.vx *= 0.88;
    }

    player.x += player.vx;

    // Screen wrap
    if (player.x < -PLAYER_WIDTH / 2) player.x = GAME_WIDTH + PLAYER_WIDTH / 2;
    if (player.x > GAME_WIDTH + PLAYER_WIDTH / 2) player.x = -PLAYER_WIDTH / 2;

    // Gravity
    player.vy += GRAVITY;
    player.y += player.vy;

    // Camera follow
    const screenY = player.y - cameraY;
    if (screenY < GAME_HEIGHT * 0.35) {
      const delta = GAME_HEIGHT * 0.35 - screenY;
      cameraY -= delta;
      maxHeight = Math.max(maxHeight, -cameraY);
      score = Math.floor(maxHeight / 10) + peasCollected * 10;
      scorePill.textContent = String(score);
    }

    // Platform collision
    for (const p of platforms) {
      if (p.broken) {
        p.breakTimer += 0.1;
        continue;
      }

      if (p.type === 'moving') {
        p.x += p.dir * 2;
        if (p.x < PLATFORM_WIDTH / 2 || p.x > GAME_WIDTH - PLATFORM_WIDTH / 2) p.dir *= -1;
      }

      if (player.vy > 0) {
        const pw = PLATFORM_WIDTH;
        const ph = PLATFORM_HEIGHT;
        const withinX = player.x > p.x - pw / 2 - PLAYER_WIDTH / 3 && player.x < p.x + pw / 2 + PLAYER_WIDTH / 3;
        const withinY = player.y + PLAYER_HEIGHT / 2 > p.y && player.y + PLAYER_HEIGHT / 2 < p.y + ph + player.vy + 5;

        if (withinX && withinY) {
          if (p.type === 'breaking') {
            p.broken = true;
            spawnParticles(p.x, p.y, '#8B4513', 12);
            playTone(180, 0.12, 'square', 0.06);
          } else if (p.type === 'spring') {
            player.vy = SPRING_VELOCITY;
            spawnParticles(p.x, p.y, '#FFD700', 6);
            playTone(880, 0.15, 'triangle', 0.08);
          } else {
            player.vy = JUMP_VELOCITY;
            spawnParticles(p.x, p.y, '#90EE90', 4);
            playTone(440, 0.08, 'sine', 0.06);
          }
        }
      }
    }

    // Pea collection
    for (const pea of peas) {
      if (pea.collected) continue;
      const dx = player.x - pea.x;
      const dy = (player.y - cameraY) - (pea.y - cameraY);
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        pea.collected = true;
        peasCollected++;
        spawnParticles(pea.x, pea.y - cameraY, '#90EE90', 8);
        playTone(660, 0.1, 'sine', 0.08);
      }
    }

    // Enemy collision
    for (const e of enemies) {
      e.x += e.dir * e.vx;
      if (e.x < 40 || e.x > GAME_WIDTH - 40) e.dir *= -1;

      const ey = e.y - cameraY;
      if (ey > -100 && ey < GAME_HEIGHT + 100) {
        const dx = Math.abs(player.x - e.x);
        const dy = Math.abs((player.y) - e.y);
        const hitDist = e.type === 'spike' ? 35 : 45;

        if (dx < hitDist && dy < hitDist) {
          endGame();
          return;
        }
      }
    }

    // Generate new platforms
    while (highestPlatformY > cameraY - GAME_HEIGHT) {
      highestPlatformY -= randRange(50, 90);
      spawnPlatform(highestPlatformY);

      if (Math.random() < 0.08) {
        spawnEnemy(highestPlatformY - 80);
      }
    }

    // Cleanup off-screen objects
    platforms = platforms.filter(p => p.y - cameraY < GAME_HEIGHT + 100 && !p.broken);
    enemies = enemies.filter(e => e.y - cameraY < GAME_HEIGHT + 100);
    peas = peas.filter(p => !p.collected && p.y - cameraY < GAME_HEIGHT + 100);

    // Update particles
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.03;
      return p.life > 0;
    });

    // Fall death
    if (player.y - cameraY > GAME_HEIGHT + 50) {
      endGame();
    }
  }

  // === DRAW SPRITE ===
  function drawSprite(sprite, x, y, width, height, flipX = false) {
    if (!sprite || !sprite.complete) return;
    ctx.save();
    if (flipX) {
      ctx.translate(x + width / 2, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, -width / 2, 0, width, height);
    } else {
      ctx.drawImage(sprite, x, y, width, height);
    }
    ctx.restore();
  }

  // === DRAW PLATFORM ===
  function drawPlatform(p) {
    const py = p.y - cameraY;
    if (py < -50 || py > GAME_HEIGHT + 50) return;

    let sprite;
    let w = PLATFORM_WIDTH;
    let h = PLATFORM_HEIGHT;

    switch (p.type) {
      case 'spring':
        sprite = sprites.platformSpring;
        h = 35;
        break;
      case 'breaking':
        sprite = sprites.platformBreaking;
        if (p.broken) {
          ctx.globalAlpha = 1 - p.breakTimer;
        }
        break;
      case 'trident':
        sprite = sprites.platformTrident;
        w = 80;
        h = 30;
        break;
      case 'moving':
        sprite = sprites.platformGold;
        break;
      default:
        sprite = sprites.platformWood;
    }

    if (sprite && sprite.complete) {
      drawSprite(sprite, p.x - w / 2, py, w, h);
    } else {
      // Fallback rectangle
      ctx.fillStyle = p.type === 'spring' ? '#FFD700' : '#8B4513';
      ctx.fillRect(p.x - w / 2, py, w, h);
    }
    ctx.globalAlpha = 1;
  }

  // === DRAW PLAYER ===
  function drawPlayer() {
    const x = player.x - PLAYER_WIDTH / 2;
    const y = player.y - cameraY - PLAYER_HEIGHT / 2;

    let sprite;
    if (player.vy < -2) {
      sprite = sprites.playerJump;
    } else if (player.vy > 3) {
      sprite = sprites.playerFall;
    } else {
      sprite = sprites.playerIdle;
    }

    const flip = player.facing < 0;

    if (sprite && sprite.complete) {
      drawSprite(sprite, x, y, PLAYER_WIDTH, PLAYER_HEIGHT, flip);
    } else {
      // Fallback circle
      ctx.fillStyle = '#E74C3C';
      ctx.beginPath();
      ctx.arc(player.x, player.y - cameraY, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // === DRAW ENEMY ===
  function drawEnemy(e) {
    const ey = e.y - cameraY;
    if (ey < -100 || ey > GAME_HEIGHT + 100) return;

    let sprite;
    let size = 50;

    switch (e.type) {
      case 'snake':
        sprite = sprites.enemySnake;
        size = 60;
        break;
      case 'dragon':
        sprite = sprites.enemyDragon;
        size = 70;
        break;
      case 'golem':
        sprite = sprites.enemyGolem;
        size = 55;
        break;
      default:
        sprite = sprites.enemySpike;
        size = 45;
    }

    const flip = e.dir < 0;

    if (sprite && sprite.complete) {
      drawSprite(sprite, e.x - size / 2, ey - size / 2, size, size, flip);
    } else {
      ctx.fillStyle = '#E74C3C';
      ctx.beginPath();
      ctx.arc(e.x, ey, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // === DRAW ===
  function draw() {
    const sky = makeSky(maxHeight);
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, rgb(sky.top));
    grad.addColorStop(1, rgb(sky.bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Stars
    if (sky.spaceT > 0.1) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (sky.spaceT - 0.1) * 2);
      for (const s of stars) {
        const sy = s.y - cameraY * 0.2;
        const wrapped = ((sy % (GAME_HEIGHT * 5)) + GAME_HEIGHT * 5) % (GAME_HEIGHT * 5);
        if (wrapped > GAME_HEIGHT) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(s.twinkle + performance.now() / 400);
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x, wrapped, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Platforms
    for (const p of platforms) {
      drawPlatform(p);
    }

    // Peas
    for (const pea of peas) {
      if (pea.collected) continue;
      const py = pea.y - cameraY;
      if (py < -30 || py > GAME_HEIGHT + 30) continue;

      if (sprites.uiPea && sprites.uiPea.complete) {
        drawSprite(sprites.uiPea, pea.x - 15, py - 15, 30, 30);
      } else {
        ctx.fillStyle = '#90EE90';
        ctx.beginPath();
        ctx.arc(pea.x, py, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Enemies
    for (const e of enemies) {
      drawEnemy(e);
    }

    // Player
    drawPlayer();

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // === GAME LOOP ===
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // === INPUT ===
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if ((e.key === ' ' || e.key === 'Enter') && state !== 'playing') {
      e.preventDefault();
      startGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  function bindTouch(btn, side) {
    const press = (e) => { e.preventDefault(); keys[side] = true; };
    const release = (e) => { e.preventDefault(); keys[side] = false; };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  }
  bindTouch(leftBtn, 'left');
  bindTouch(rightBtn, 'right');

  playBtn.addEventListener('click', startGame);

  // === INIT ===
  loadSprites(() => {
    overlayTitle.textContent = 'Котигорошко';
    overlayScore.classList.add('hidden');
    overlayHint.classList.remove('hidden');
    overlayHint.textContent = 'Використовуй ← → або A/D для руху. Стрибай по платформах якомога вище!';
    playBtn.textContent = 'Грати';
    requestAnimationFrame(loop);
  });
})();
