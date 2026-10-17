(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const levelEl = document.getElementById('level');
  const overlay = document.getElementById('overlay');
  const overlayCard = document.getElementById('overlay-card');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayCopy = document.getElementById('overlay-copy');
  const lossGif = document.getElementById('loss-gif');
  const lossScoreEl = document.getElementById('loss-score');
  const lossBestEl = document.getElementById('loss-best');
  const startButton = document.getElementById('start-button');
  const flapButton = document.getElementById('fire-button');
  const funnyMessage = document.getElementById('funny-message');
  const W = canvas.width;
  const H = canvas.height;
  const groundHeight = 56;
  const catImage = new Image();
  catImage.src = 'cat.png';
  catImage.addEventListener('load', () => { if (!running) draw(performance.now()); });
  const themes = [
    { skyTop: '#70d6ff', skyBottom: '#d9f7ff', cloud: '#ffffffaa', pipe: '#38b764', pipeDark: '#247d48', ground: '#a8df68', grass: '#6eaf45', bird: '#ffcf4a', accent: '#ff7b54' },
    { skyTop: '#25145e', skyBottom: '#713b8f', cloud: '#e8c7ff66', pipe: '#b95cff', pipeDark: '#7436b0', ground: '#34305f', grass: '#5b55a5', bird: '#65e6ff', accent: '#ff73c7' },
    { skyTop: '#ff9a76', skyBottom: '#ffd47e', cloud: '#fff0c766', pipe: '#d95d4c', pipeDark: '#923a43', ground: '#7c4d3c', grass: '#b5794c', bird: '#fff176', accent: '#ff4d6d' },
    { skyTop: '#102a43', skyBottom: '#486581', cloud: '#d9f3ff44', pipe: '#43aa8b', pipeDark: '#237060', ground: '#263238', grass: '#4f8a78', bird: '#ff9f1c', accent: '#2ec4b6' }
  ];
  let player, pipes, particles, meowBubbles, score, best, level, running, paused, lastTime, pipeClock, scroll, flapQueued, launchTimer;
  const failMessages = ['The cat discovered gravity.', 'Pipe boop! Try again, whiskers.', 'That was a very dramatic landing.', 'The sky said: not today, cat.', 'Nine lives remain... probably.'];
  const levelMessages = ['Purr-fect start!', 'Whoa, fancy whiskers!', 'This cat has turbo paws!', 'The cat is now legally a cloud.'];
  function readBest() {
    try {
      const stored = Number(localStorage.getItem('flappyFlightBest'));
      return Number.isFinite(stored) && stored >= 0 ? stored : 0;
    } catch (error) {
      if (error instanceof DOMException && ['SecurityError', 'QuotaExceededError'].includes(error.name)) return 0;
      throw error;
    }
  }
  function saveBest(value) {
    try {
      localStorage.setItem('flappyFlightBest', String(value));
    } catch (error) {
      if (!(error instanceof DOMException && ['SecurityError', 'QuotaExceededError'].includes(error.name))) throw error;
    }
  }
  best = readBest();
  bestEl.textContent = format(best);

  function format(value) { return String(value).padStart(6, '0'); }
  function theme() { return themes[(level - 1) % themes.length]; }
  function updateHud() {
    scoreEl.textContent = format(score);
    levelEl.textContent = level;
    document.body.dataset.theme = (level - 1) % themes.length;
    document.documentElement.style.setProperty('--accent', theme().accent);
    document.documentElement.style.setProperty('--accent-soft', `${theme().accent}22`);
  }
  async function requestLandscape() {
    const isExpectedOrientationError = error => error instanceof DOMException
      && ['NotAllowedError', 'SecurityError', 'TypeError', 'InvalidStateError'].includes(error.name);
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (error) {
      if (!isExpectedOrientationError(error)) throw error;
    }
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      }
    } catch (error) {
      if (!isExpectedOrientationError(error)) throw error;
    }
  }
  function reset() {
    player = { x: 215, y: H / 2, radius: 22, velocity: 0, rotation: 0 };
    pipes = []; particles = []; meowBubbles = []; score = 0; level = 1; scroll = 0;
    pipeClock = .55; launchTimer = 1.35; running = true; paused = false; flapQueued = false; lastTime = performance.now();
    funnyMessage.textContent = 'Purr-powered and ready!';
    overlayTitle.textContent = 'FLAPPY FLIGHT';
    overlayCopy.textContent = 'Help this very serious cat dodge pipes and collect snacks.';
    startButton.textContent = "LET'S MEOW!";
    overlayCard.classList.remove('loss-state');
    updateHud(); overlay.classList.add('hidden'); requestAnimationFrame(loop);
  }
  function endGame() {
    running = false;
    if (score > best) { best = score; saveBest(best); bestEl.textContent = format(best); }
    overlayTitle.textContent = 'FLIGHT OVER';
    overlayCopy.textContent = `${failMessages[Math.floor(Math.random() * failMessages.length)]} You cleared ${score} pipes.`;
    lossScoreEl.textContent = format(score);
    lossBestEl.textContent = format(best);
    lossGif.src = `smile.gif?loss=${Date.now()}`;
    overlayCard.classList.add('loss-state');
    startButton.textContent = 'TRY AGAIN, MEOW';
    funnyMessage.textContent = 'Emergency snack break!';
    overlay.classList.remove('hidden');
  }
  function flap() {
    if (!running) return;
    player.velocity = -425;
    launchTimer = 0;
    meowBubbles.push({ x: player.x + 20, y: player.y - 22, life: 1, max: 1, drift: 24 });
    funnyMessage.textContent = ['Flap flap hooray!', 'Mind the whiskers!', 'Meow-ving!', 'Up we go!'][Math.floor(Math.random() * 4)];
  }
  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - .5) * 1.4;
      const speed = 25 + Math.random() * 70;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .3 + Math.random() * .25, color });
    }
  }
  function addPipe() {
    const gap = Math.max(132, 184 - level * 7);
    const margin = 72;
    const center = margin + gap / 2 + Math.random() * (H - groundHeight - margin * 2 - gap);
    pipes.push({ x: W + 45, width: 76, gapTop: center - gap / 2, gapBottom: center + gap / 2, passed: false });
  }
  function update(dt) {
    if (paused) return;
    if (flapQueued) { flap(); flapQueued = false; }
    const speed = 190 + (level - 1) * 16;
    scroll += speed * dt;
    pipeClock -= dt;
    if (pipeClock <= 0) { addPipe(); pipeClock = Math.max(.95, 1.45 - level * .035); }
    if (launchTimer > 0) {
      launchTimer -= dt;
      player.velocity = 0;
      player.y = H / 2;
    } else {
      player.velocity += 1100 * dt;
      player.y += player.velocity * dt;
    }
    player.rotation = Math.max(-.45, Math.min(1.25, player.velocity / 500));
    pipes.forEach(pipe => {
      pipe.x -= speed * dt;
      if (!pipe.passed && pipe.x + pipe.width < player.x) {
        pipe.passed = true; score++;
        level = 1 + Math.floor(score / 5);
        updateHud();
        funnyMessage.textContent = levelMessages[(level - 1) % levelMessages.length];
        burst(player.x, player.y, theme().accent, 8);
      }
    });
    pipes = pipes.filter(pipe => pipe.x + pipe.width > -20);
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt; });
    particles = particles.filter(p => p.life > 0);
    meowBubbles.forEach(bubble => { bubble.y -= bubble.drift * dt; bubble.life -= dt; });
    meowBubbles = meowBubbles.filter(bubble => bubble.life > 0);
    const hitGround = player.y + player.radius >= H - groundHeight;
    const hitCeiling = player.y - player.radius <= 0;
    const hitPipe = pipes.some(pipe => {
      const overlapsX = player.x + player.radius > pipe.x && player.x - player.radius < pipe.x + pipe.width;
      return overlapsX && (player.y - player.radius < pipe.gapTop || player.y + player.radius > pipe.gapBottom);
    });
    if (hitGround || hitCeiling || hitPipe) endGame();
  }
  function drawCloud(x, y, scale) {
    const t = theme();
    ctx.fillStyle = t.cloud; ctx.beginPath();
    ctx.arc(x, y, 22 * scale, 0, Math.PI * 2);
    ctx.arc(x + 25 * scale, y - 10 * scale, 30 * scale, 0, Math.PI * 2);
    ctx.arc(x + 58 * scale, y, 22 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawBird() {
    const t = theme();
    ctx.save(); ctx.translate(player.x, player.y + (launchTimer > 0 ? Math.sin(performance.now() / 180) * 5 : 0)); ctx.rotate(player.rotation);
    const size = 48;
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffffff99';
    if (catImage.complete && catImage.naturalWidth > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(catImage, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = t.bird;
      ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawPipe(pipe) {
    const t = theme();
    ctx.shadowBlur = 10; ctx.shadowColor = t.pipeDark; ctx.fillStyle = t.pipe;
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapTop);
    ctx.fillRect(pipe.x, pipe.gapBottom, pipe.width, H - groundHeight - pipe.gapBottom);
    ctx.fillStyle = t.pipeDark;
    ctx.fillRect(pipe.x - 6, pipe.gapTop - 22, pipe.width + 12, 22);
    ctx.fillRect(pipe.x - 6, pipe.gapBottom, pipe.width + 12, 22);
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff33';
    ctx.fillRect(pipe.x + 10, 0, 7, pipe.gapTop - 22);
    ctx.fillRect(pipe.x + 10, pipe.gapBottom + 22, 7, H - groundHeight - pipe.gapBottom - 22);
  }
  function draw(now) {
    const t = theme();
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, t.skyTop); gradient.addColorStop(1, t.skyBottom);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    drawCloud((W - (scroll * .12) % (W + 180)) % (W + 180), 115, 1.15);
    drawCloud((W - (scroll * .08 + 260) % (W + 220)) % (W + 220), 235, .75);
    pipes.forEach(drawPipe);
    particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / .55); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); });
    meowBubbles.forEach(bubble => {
      const alpha = Math.max(0, bubble.life / bubble.max);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 14px Space Mono';
      ctx.textAlign = 'center';
      ctx.fillText('MEOW!', bubble.x, bubble.y);
    });
    ctx.globalAlpha = 1; drawBird();
    ctx.fillStyle = t.ground; ctx.fillRect(0, H - groundHeight, W, groundHeight);
    ctx.fillStyle = t.grass;
    for (let x = -((scroll * .8) % 28); x < W; x += 28) ctx.fillRect(x, H - groundHeight, 18, 7);
    if (launchTimer > 0 && running) {
      ctx.fillStyle = '#ffffffcc'; ctx.font = '700 13px Space Mono'; ctx.textAlign = 'center';
      ctx.fillText('GET READY, KITTY', W / 2, H / 2 - 48);
    }
    if (paused && running) {
      ctx.fillStyle = '#07142699'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = '700 34px DM Sans, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, .035); lastTime = now;
    update(dt); draw(now);
    if (running) requestAnimationFrame(loop);
  }
  function queueFlap() {
    if (!running) return;
    if (paused) { paused = false; return; }
    flapQueued = true;
  }
  startButton.addEventListener('click', () => { requestLandscape(); reset(); });
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); requestLandscape(); queueFlap(); });
  flapButton.addEventListener('pointerdown', e => { e.preventDefault(); requestLandscape(); queueFlap(); });
  window.addEventListener('keydown', e => {
    if ([' ', 'ArrowUp'].includes(e.key)) { e.preventDefault(); queueFlap(); }
    if (e.key.toLowerCase() === 'p' && running) paused = !paused;
    if (e.key === 'Enter' && !running) reset();
  });
  player = { x: 215, y: H / 2, radius: 22, velocity: 0, rotation: 0 };
  pipes = []; particles = []; meowBubbles = []; score = 0; level = 1; running = false; paused = false; scroll = 0;
  launchTimer = 0; updateHud(); draw(0);
  requestLandscape();
})();
