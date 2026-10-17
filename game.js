(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayCopy = document.getElementById('overlay-copy');
  const startButton = document.getElementById('start-button');
  const fireButton = document.getElementById('fire-button');

  const W = canvas.width, H = canvas.height;
  const keys = new Set();
  let player, bullets, enemies, particles, stars, score, lives, running, paused, lastShot, spawnClock, lastTime, pointerDown;
  let best = Number(localStorage.getItem('spaceShooterBest') || 0);
  bestEl.textContent = format(best);

  function format(n) { return String(n).padStart(6, '0'); }
  function reset() {
    player = { x: W / 2, y: H - 72, w: 34, h: 38, speed: 370, invulnerable: 0 };
    bullets = []; enemies = []; particles = [];
    score = 0; lives = 3; running = true; paused = false;
    lastShot = 0; spawnClock = 0; lastTime = performance.now();
    scoreEl.textContent = format(score); livesEl.textContent = lives;
    overlay.classList.add('hidden');
    requestAnimationFrame(loop);
  }
  function endGame() {
    running = false;
    if (score > best) {
      best = score; localStorage.setItem('spaceShooterBest', String(best));
      bestEl.textContent = format(best);
    }
    overlayTitle.textContent = 'MISSION COMPLETE';
    overlayCopy.textContent = `Final score: ${score}. ${score >= best ? 'A new personal best!' : 'Ready for another run?'}`;
    startButton.textContent = 'PLAY AGAIN';
    overlay.classList.remove('hidden');
  }
  function spawnEnemy() {
    const size = 22 + Math.random() * 17;
    enemies.push({ x: 30 + Math.random() * (W - 60), y: -size, r: size / 2, speed: 75 + Math.random() * 70 + score * 0.015, drift: (Math.random() - 0.5) * 85, phase: Math.random() * 6 });
  }
  function burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, speed = 45 + Math.random() * 180;
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .35 + Math.random() * .45, max: .8, color, r: 1 + Math.random() * 3 });
    }
  }
  function shoot(now) {
    if (now - lastShot < 190) return;
    lastShot = now;
    bullets.push({ x: player.x, y: player.y - 22, vy: -560, r: 4 });
    particles.push({ x: player.x, y: player.y - 24, vx: (Math.random() - .5) * 35, vy: -70, life: .12, max: .12, color: '#63f5ff', r: 3 });
  }
  function hitPlayer() {
    if (player.invulnerable > 0) return;
    lives--; livesEl.textContent = lives; player.invulnerable = 1.3;
    burst(player.x, player.y, '#ff4d9d', 22);
    if (lives <= 0) endGame();
  }
  function update(dt, now) {
    if (paused) return;
    const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
    const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
    if (left) player.x -= player.speed * dt;
    if (right) player.x += player.speed * dt;
    player.x = Math.max(25, Math.min(W - 25, player.x));
    if (keys.has(' ') || keys.has('Spacebar') || pointerDown) shoot(now);
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    spawnClock += dt;
    const interval = Math.max(.32, .85 - score / 1800);
    if (spawnClock >= interval) { spawnClock = 0; spawnEnemy(); }
    bullets.forEach(b => b.y += b.vy * dt);
    bullets = bullets.filter(b => b.y > -20);
    enemies.forEach(e => { e.y += e.speed * dt; e.x += Math.sin(now / 400 + e.phase) * e.drift * dt; });
    for (const e of enemies) {
      if (Math.abs(e.x - player.x) < e.r + 14 && Math.abs(e.y - player.y) < e.r + 15) {
        e.dead = true; hitPlayer();
      } else if (e.y > H + 25) { e.dead = true; hitPlayer(); }
    }
    for (const b of bullets) {
      for (const e of enemies) {
        if (e.dead || b.dead) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.r + b.r) ** 2) {
          e.dead = true; b.dead = true; score += 100;
          scoreEl.textContent = format(score); burst(e.x, e.y, '#ff4d9d', 14);
        }
      }
    }
    enemies = enemies.filter(e => !e.dead);
    bullets = bullets.filter(b => !b.dead);
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .98; p.vy *= .98; p.life -= dt; });
    particles = particles.filter(p => p.life > 0);
  }
  function drawShip(x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.shadowBlur = 18; ctx.shadowColor = '#63f5ff';
    ctx.fillStyle = '#63f5ff'; ctx.beginPath();
    ctx.moveTo(0, -23); ctx.lineTo(17, 16); ctx.lineTo(5, 11); ctx.lineTo(0, 17); ctx.lineTo(-5, 11); ctx.lineTo(-17, 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f8ffff'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4d9d'; ctx.fillRect(-4, 17, 8, 8 + Math.random() * 7);
    ctx.restore();
  }
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#080b1a'); bg.addColorStop(1, '#11183a'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 95; i++) {
      const x = (i * 127.7) % W, y = ((i * 83.3 + now * (0.012 + (i % 4) * .009)) % H);
      ctx.globalAlpha = .3 + (i % 5) * .12; ctx.fillStyle = i % 9 === 0 ? '#ff4d9d' : '#bfeeff';
      ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
    bullets.forEach(b => { ctx.shadowBlur = 14; ctx.shadowColor = '#63f5ff'; ctx.fillStyle = '#cfffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });
    ctx.shadowBlur = 0;
    enemies.forEach(e => {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.sin(now / 500 + e.phase) * .2);
      ctx.shadowBlur = 15; ctx.shadowColor = '#ff4d9d'; ctx.fillStyle = '#ff4d9d';
      ctx.beginPath(); ctx.moveTo(-e.r, -e.r * .45); ctx.lineTo(-e.r * .4, -e.r); ctx.lineTo(e.r * .35, -e.r * .8); ctx.lineTo(e.r, -e.r * .1); ctx.lineTo(e.r * .65, e.r); ctx.lineTo(-e.r * .65, e.r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-e.r * .45, -2, 4, 4); ctx.fillRect(e.r * .2, -2, 4, 4); ctx.restore();
    });
    particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    if (player && (player.invulnerable <= 0 || Math.floor(now / 90) % 2 === 0)) drawShip(player.x, player.y);
    if (paused && running) {
      ctx.fillStyle = '#050817bb'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#63f5ff'; ctx.font = '700 34px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, .035); lastTime = now;
    update(dt, now); draw(now);
    if (running) requestAnimationFrame(loop);
  }
  function togglePause() { if (!running) return; paused = !paused; }
  startButton.addEventListener('click', reset);
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if (e.key.toLowerCase() === 'p') togglePause();
    if (e.key === 'Enter' && !running) reset();
  });
  window.addEventListener('keyup', e => keys.delete(e.key));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', e => {
    if (!player || !running) return;
    canvas.setPointerCapture(e.pointerId); pointerDown = true;
    const rect = canvas.getBoundingClientRect(); player.x = (e.clientX - rect.left) / rect.width * W;
  });
  canvas.addEventListener('pointermove', e => {
    if (!player || !running || !(e.buttons || e.pointerType === 'touch')) return;
    const rect = canvas.getBoundingClientRect(); player.x = (e.clientX - rect.left) / rect.width * W;
  });
  window.addEventListener('pointerup', () => { pointerDown = false; });
  fireButton.addEventListener('pointerdown', e => { e.preventDefault(); pointerDown = true; });
  window.addEventListener('pointerup', () => { pointerDown = false; });
  // Draw an attractive title screen before the first mission.
  player = { x: W / 2, y: H - 72, invulnerable: 0 };
  bullets = []; enemies = []; particles = []; running = false;
  draw(0);
})();
