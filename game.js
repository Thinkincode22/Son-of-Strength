(() => {
  'use strict';

  const GAME_WIDTH = 400;
  const GAME_HEIGHT = 600;
  const GRAVITY = 0.28;
  const JUMP_VELOCITY = -10.5;
  const SPRING_VELOCITY = -17;
  const MOVE_SPEED = 4.2;
  const PLAYER_RADIUS = 16;
  const PLATFORM_WIDTH = 62;
  const PLATFORM_HEIGHT = 14;
  const HIGH_SCORE_KEY = 'doodle-jump-modern-highscore';

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

  const dpr = window.devicePixelRatio || 1;
  canvas.width = GAME_WIDTH * dpr;
  canvas.height = GAME_HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration, type = 'sine', startGain = 0.15) {
    try {
      const ac = getAudio();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(startGain, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch {
      /* audio may be blocked until user interaction */
    }
  }

  function lerpColor(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
  }

  function rgb([r, g, b]) {
    return `rgb(${r},${g},${b})`;
  }

  function makeSky(height) {
    const t = Math.min(1, height / 4000);
    const top = lerpColor([135, 206, 250], [10, 8, 40], t);
    const bottom = lerpColor([255, 236, 179], [40, 20, 70], t);
    return { top, bottom, spaceT: t };
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  let state = 'menu'; // 'menu' | 'playing' | 'gameover'
  let score = 0;
  let highScore = 0;
  try {
    highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
  } catch {
    highScore = 0;
  }
  bestPill.textContent = `Best ${highScore}`;

  let player = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100, vy: 0, vx: 0, facing: 1, squash: 1 };
  let platforms = [];
  let stars = [];
  let cameraY = 0;
  let maxHeight = 0;
  let highestPlatformY = 0;
  const keys = { left: false, right: false };

  function spawnPlatform(y) {
    const roll = Math.random();
    let type = 'normal';
    if (roll > 0.92) type = 'spring';
    else if (roll > 0.78) type = 'breaking';
    else if (roll > 0.58) type = 'moving';

    platforms.push({
      x: randRange(PLATFORM_WIDTH / 2, GAME_WIDTH - PLATFORM_WIDTH / 2),
      y,
      type,
      broken: false,
      dir: Math.random() > 0.5 ? 1 : -1,
    });
  }

  function resetGame() {
    platforms = [];
    stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT * 4 - GAME_HEIGHT * 3,
      r: randRange(0.5, 1.8),
      twinkle: Math.random() * Math.PI * 2,
    }));
    cameraY = 0;
    maxHeight = 0;

    platforms.push({ x: GAME_WIDTH / 2, y: GAME_HEIGHT - 60, type: 'normal', broken: false, dir: 1 });
    let y = GAME_HEIGHT - 140;
    while (y > -GAME_HEIGHT * 3) {
      spawnPlatform(y);
      y -= randRange(55, 95);
    }
    highestPlatformY = y;

    player = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100, vy: JUMP_VELOCITY, vx: 0, facing: 1, squash: 1 };
    score = 0;
    scorePill.textContent = '0';
  }

  function startGame() {
    getAudio();
    resetGame();
    state = 'playing';
    gameFrame.classList.add('playing');
    overlay.classList.add('hidden-overlay');
  }

  function endGame() {
    state = 'gameover';
    gameFrame.classList.remove('playing');
    const finalScore = Math.floor(maxHeight / 10);
    score = finalScore;
    if (finalScore > highScore) {
      highScore = finalScore;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
      } catch {
        /* localStorage may be unavailable */
      }
    }
    bestPill.textContent = `Best ${highScore}`;

    overlayTitle.textContent = '💥 Game Over';
    overlayScore.classList.remove('hidden');
    overlayScore.innerHTML = `Score: <b>${finalScore}</b> &middot; Best: <span class="best-value">${highScore}</span>`;
    overlayHint.classList.add('hidden');
    playBtn.textContent = 'Play Again';
    overlay.classList.remove('hidden-overlay');

    playTone(220, 0.25, 'sawtooth', 0.12);
    setTimeout(() => playTone(140, 0.35, 'sawtooth', 0.12), 120);
  }

  function update() {
    if (state !== 'playing') return;

    if (keys.left) {
      player.vx = -MOVE_SPEED;
      player.facing = -1;
    } else if (keys.right) {
      player.vx = MOVE_SPEED;
      player.facing = 1;
    } else {
      player.vx *= 0.85;
    }

    player.x += player.vx;
    if (player.x < -PLAYER_RADIUS) player.x = GAME_WIDTH + PLAYER_RADIUS;
    if (player.x > GAME_WIDTH + PLAYER_RADIUS) player.x = -PLAYER_RADIUS;

    player.vy += GRAVITY;
    player.y += player.vy;
    player.squash += (1 - player.squash) * 0.2;

    const screenY = player.y - cameraY;
    if (screenY < GAME_HEIGHT * 0.4) {
      const delta = GAME_HEIGHT * 0.4 - screenY;
      cameraY -= delta;
      maxHeight = Math.max(maxHeight, -cameraY);
      score = Math.floor(maxHeight / 10);
      scorePill.textContent = String(score);
    }

    for (const p of platforms) {
      if (p.broken) continue;
      if (p.type === 'moving') {
        p.x += p.dir * 1.6;
        if (p.x < PLATFORM_WIDTH / 2 || p.x > GAME_WIDTH - PLATFORM_WIDTH / 2) p.dir *= -1;
      }

      if (player.vy > 0) {
        const withinX = Math.abs(player.x - p.x) < PLATFORM_WIDTH / 2 + PLAYER_RADIUS * 0.5;
        const withinY = player.y + PLAYER_RADIUS > p.y && player.y + PLAYER_RADIUS < p.y + PLATFORM_HEIGHT + player.vy;
        if (withinX && withinY) {
          if (p.type === 'breaking') {
            p.broken = true;
            playTone(180, 0.15, 'square', 0.08);
          } else if (p.type === 'spring') {
            player.vy = SPRING_VELOCITY;
            player.squash = 1.4;
            playTone(660, 0.12, 'triangle', 0.1);
            continue;
          } else {
            player.vy = JUMP_VELOCITY;
            player.squash = 1.3;
            playTone(440, 0.08, 'sine', 0.08);
          }
        }
      }
    }
    platforms = platforms.filter((p) => !p.broken);

    const topVisible = cameraY;
    while (highestPlatformY > topVisible - GAME_HEIGHT) {
      highestPlatformY -= randRange(55, 95);
      spawnPlatform(highestPlatformY);
    }
    platforms = platforms.filter((p) => p.y - cameraY < GAME_HEIGHT + 60);

    if (player.y - cameraY > GAME_HEIGHT + 40) {
      endGame();
    }
  }

  function drawPlatform(p, py) {
    const w = PLATFORM_WIDTH;
    const h = PLATFORM_HEIGHT;
    const x = p.x - w / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 4;

    const colors = {
      normal: ['#7ee787', '#2f9e44'],
      moving: ['#74c0fc', '#1971c2'],
      breaking: ['#e8a15a', '#a5591a'],
      spring: ['#ffe066', '#e8a300'],
    };
    const [light, dark] = colors[p.type];
    const g = ctx.createLinearGradient(x, py, x, py + h);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, py, w, h, 6);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.roundRect(x + 3, py + 1.5, w - 6, h * 0.35, 4);
    ctx.fill();

    if (p.type === 'breaking') {
      ctx.strokeStyle = 'rgba(80,40,10,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - 8, py + 2);
      ctx.lineTo(p.x, py + h - 2);
      ctx.lineTo(p.x + 10, py + 3);
      ctx.stroke();
    }

    if (p.type === 'spring') {
      ctx.strokeStyle = '#7a5200';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const sy = py - 2 - i * 4;
        ctx.moveTo(p.x - 6, sy);
        ctx.lineTo(p.x + 6, sy - 3);
      }
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const x = player.x;
    const y = player.y - cameraY;
    const stretch = player.vy < 0 ? 1.15 : 1;
    const rx = PLAYER_RADIUS * (2 - player.squash) * 0.95;
    const ry = PLAYER_RADIUS * player.squash * stretch;

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + ry + 4, rx * 0.8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const bodyGrad = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 2, x, y, rx * 1.4);
    bodyGrad.addColorStop(0, '#9be564');
    bodyGrad.addColorStop(1, '#4f9d1f');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#3d7a17';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - rx * 0.5, y + ry * 0.7);
    ctx.lineTo(x - rx * 0.7, y + ry + 6);
    ctx.moveTo(x + rx * 0.5, y + ry * 0.7);
    ctx.lineTo(x + rx * 0.7, y + ry + 6);
    ctx.stroke();

    const eyeOffsetX = player.facing * rx * 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x + eyeOffsetX - 4, y - ry * 0.2, 5, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(x + eyeOffsetX + 6, y - ry * 0.2, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(x + eyeOffsetX - 4 + player.facing * 1.5, y - ry * 0.2, 2.4, 0, Math.PI * 2);
    ctx.arc(x + eyeOffsetX + 6 + player.facing * 1.5, y - ry * 0.2, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    const sky = makeSky(maxHeight);
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, rgb(sky.top));
    grad.addColorStop(1, rgb(sky.bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (sky.spaceT > 0.15) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (sky.spaceT - 0.15) * 1.4);
      for (const s of stars) {
        const sy = s.y - cameraY * 0.3;
        const wrapped = ((sy % (GAME_HEIGHT * 4)) + GAME_HEIGHT * 4) % (GAME_HEIGHT * 4);
        if (wrapped > GAME_HEIGHT) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(s.twinkle + performance.now() / 500);
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x, wrapped, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const p of platforms) {
      const py = p.y - cameraY;
      if (py < -30 || py > GAME_HEIGHT + 30) continue;
      drawPlatform(p, py);
    }

    drawPlayer();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // input
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
    const press = (e) => {
      e.preventDefault();
      keys[side] = true;
    };
    const release = (e) => {
      e.preventDefault();
      keys[side] = false;
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  }
  bindTouch(leftBtn, 'left');
  bindTouch(rightBtn, 'right');

  playBtn.addEventListener('click', startGame);

  // initial menu draw (static preview)
  resetGame();
  overlayTitle.textContent = '🚀 Doodle Jump';
  overlayScore.classList.add('hidden');
  overlayHint.classList.remove('hidden');
  playBtn.textContent = 'Play';

  requestAnimationFrame(loop);
})();
