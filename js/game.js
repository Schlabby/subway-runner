// Game: Loop, Spawning, Kollision, Score, Rendering (Pseudo-3D)

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this.proj = makeProjector(this.W, this.H);

    this.player = new Player();
    this.obstacles = [];
    this.coins = [];
    this.state = 'menu';

    this.time = 0;
    this.distance = 0;
    this.speed = CONFIG.baseSpeed;
    this.spawnTimer = 0;
    this.spawnInterval = CONFIG.spawnIntervalStart;

    this.score = 0;
    this.coinCount = 0;
    this.hiscore = parseInt(localStorage.getItem('subway_hiscore') || '0', 10);

    this.cityOffset = 0;
    this.lastTs = 0;

    this.el = {
      hud: document.getElementById('hud'),
      score: document.getElementById('score'),
      coins: document.getElementById('coins'),
      speed: document.getElementById('speed'),
      menu: document.getElementById('menu'),
      gameover: document.getElementById('gameover'),
      pause: document.getElementById('pause'),
      menuHiscore: document.getElementById('menu-hiscore'),
      finalScore: document.getElementById('final-score'),
      finalCoins: document.getElementById('final-coins'),
      finalHiscore: document.getElementById('final-hiscore'),
      newRecord: document.getElementById('new-record'),
    };
    this.el.menuHiscore.textContent = this.hiscore;
    this.updateOverlays();
  }

  // ---- State ----
  start() {
    this.player.reset();
    this.obstacles = [];
    this.coins = [];
    this.time = 0; this.distance = 0;
    this.speed = CONFIG.baseSpeed;
    this.spawnInterval = CONFIG.spawnIntervalStart;
    this.spawnTimer = 0.5;
    this.score = 0; this.coinCount = 0;
    this.state = 'playing';
    this.lastTs = performance.now();
    this.updateOverlays();
  }

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; }
    else if (this.state === 'paused') { this.state = 'playing'; this.lastTs = performance.now(); }
    this.updateOverlays();
  }

  gameOver() {
    this.state = 'gameover';
    const s = Math.floor(this.score);
    let isRecord = false;
    if (s > this.hiscore) { this.hiscore = s; localStorage.setItem('subway_hiscore', String(s)); isRecord = true; }
    this.el.finalScore.textContent = s;
    this.el.finalCoins.textContent = this.coinCount;
    this.el.finalHiscore.textContent = this.hiscore;
    this.el.newRecord.classList.toggle('hidden', !isRecord);
    this.updateOverlays();
  }

  handleEnter() {
    if (this.state === 'menu' || this.state === 'gameover') this.start();
    else if (this.state === 'paused') this.togglePause();
  }

  updateOverlays() {
    this.el.menu.classList.toggle('hidden', this.state !== 'menu');
    this.el.gameover.classList.toggle('hidden', this.state !== 'gameover');
    this.el.pause.classList.toggle('hidden', this.state !== 'paused');
    this.el.hud.classList.toggle('hidden', this.state === 'menu');
    if (this.state === 'menu') this.el.menuHiscore.textContent = this.hiscore;
  }

  // ---- Input-Aktionen ----
  moveLane(dir) { if (this.state === 'playing') this.player.move(dir); }
  jump() { if (this.state === 'playing') this.player.jump(); else if (this.state === 'menu' || this.state === 'gameover') this.start(); }
  roll() { if (this.state === 'playing') this.player.roll(); }
  rollOrJump(dy) { if (dy > 0) this.roll(); else this.jump(); } // Swipe runter=rollen, hoch=springen

  // ---- Loop ----
  loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;
    if (this.state === 'playing') this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.time += dt;
    // Schwierigkeit
    this.speed = Math.min(CONFIG.maxSpeed, CONFIG.baseSpeed + this.time * CONFIG.speedGain);
    this.spawnInterval = Math.max(CONFIG.spawnIntervalMin, CONFIG.spawnIntervalStart - this.time * CONFIG.spawnIntervalGain);
    this.distance += this.speed * dt;
    this.score += this.speed * dt * CONFIG.distScore;
    this.cityOffset += this.speed * dt * 0.4;

    this.player.update(dt, this.speed);

    // Spawning
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      for (const o of spawnRow(CONFIG.spawnDistance)) {
        if (o.kind === 'ob') this.obstacles.push(o.ob);
        else this.coins.push(o.coin);
      }
    }

    // Entities bewegen
    for (const o of this.obstacles) o.update(dt, this.speed);
    for (const c of this.coins) c.update(dt, this.speed);
    this.obstacles = this.obstacles.filter(o => o.z + o.length > CONFIG.despawnZ);
    this.coins = this.coins.filter(c => c.z > CONFIG.despawnZ && !c.taken);

    this.checkCollisions();
    this.updateHud();
  }

  checkCollisions() {
    const p = this.player;
    for (const o of this.obstacles) {
      const overlapZ = o.z < 1.2 && (o.z + o.length) > -1.2;
      if (!overlapZ) {
        if (!o.passed && o.z + o.length < -1.2) o.passed = true;
        continue;
      }
      if (Math.abs(p.laneX - o.lane) > 0.5) continue;
      let hit = false;
      if (o.type === 'low') hit = p.y < 2.0;
      else if (o.type === 'high') hit = !p.isRolling;
      else hit = true; // Zug: immer Crash
      if (hit) { this.gameOver(); return; }
    }
    for (const c of this.coins) {
      if (c.taken) continue;
      if (Math.abs(c.z) > 1.6) continue;
      if (Math.abs(p.laneX - c.lane) > 0.55) continue;
      const coinH = 2 + (c.arcH || 0);
      const playerH = p.y + 1 + (p.isRolling ? -0.5 : 0);
      if (Math.abs(coinH - playerH) < 2.2) {
        c.taken = true;
        this.coinCount++;
        this.score += CONFIG.coinScore;
      }
    }
    this.coins = this.coins.filter(c => !c.taken);
  }

  updateHud() {
    this.el.score.textContent = Math.floor(this.score);
    this.el.coins.textContent = this.coinCount;
    this.el.speed.textContent = Math.round(this.speed * 3.6);
  }

  // ---- Rendering ----
  render() {
    const { ctx, W, H, proj } = this;
    this.drawBackground(ctx, W, H);
    this.drawTracks(ctx, W, H, proj);
    // Objekte fern -> nah
    const drawables = [
      ...this.obstacles.map(o => ({ z: o.z, o })),
      ...this.coins.map(c => ({ z: c.z, c })),
    ].sort((a, b) => b.z - a.z);
    for (const d of drawables) {
      if (d.o) this.drawObstacle(ctx, proj, d.o);
      else this.drawCoin(ctx, proj, d.c);
    }
    if (this.state !== 'menu') this.player.draw(ctx, proj);
  }

  drawBackground(ctx, W, H) {
    const hy = H * CONFIG.horizonY;
    // Himmel
    const sky = ctx.createLinearGradient(0, 0, 0, hy * 1.2);
    sky.addColorStop(0, '#0b1026');
    sky.addColorStop(1, '#e0653a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hy + 2);
    // Sonne
    ctx.fillStyle = '#ffd93b';
    ctx.beginPath(); ctx.arc(W / 2, hy * 0.85, 26 * (W / 800), 0, Math.PI * 2); ctx.fill();
    // City-Silhouette (Parallax)
    ctx.fillStyle = '#23264d';
    const bw = 60 * (W / 800);
    const off = this.cityOffset % (bw * 2);
    for (let x = -bw * 2; x < W + bw; x += bw) {
      const i = Math.round((x + off) / bw);
      const bh = 30 + ((i * 37) % 50);
      ctx.fillRect(x - off, hy - bh, bw * 0.8, bh);
    }
    // Boden
    const g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, '#3a3f5c');
    g.addColorStop(1, '#171a30');
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, W, H - hy);
    // Seiten-Gras/Schotter
    ctx.fillStyle = '#22263f';
    ctx.beginPath();
    ctx.moveTo(0, hy); ctx.lineTo(W * 0.18, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, hy); ctx.lineTo(W * 0.82, H); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  drawTracks(ctx, W, H, proj) {
    // Schwellen (bewegt)
    const spacing = 4;
    const phase = this.distance % spacing;
    for (let k = 0; k < 26; k++) {
      const z = k * spacing - phase;
      const s = proj.scale(z);
      if (s < 0.04) continue;
      const y = proj.y(z);
      const w = (W * 0.62) * s;
      ctx.fillStyle = k % 2 ? '#4a3b2a' : '#54432f';
      ctx.fillRect(proj.cx - w / 2, y - 2 * s - 2, w, 3 + 4 * s);
    }
    // Schienen pro Spur (konvergierend)
    for (const L of [-1, 0, 1]) {
      for (const side of [-0.32, 0.32]) {
        ctx.strokeStyle = '#9aa3b2';
        ctx.lineWidth = Math.max(1, 3 * (W / 800));
        ctx.beginPath();
        ctx.moveTo(proj.x(L + side * 0.3, CONFIG.spawnDistance), proj.y(CONFIG.spawnDistance));
        ctx.lineTo(proj.x(L + side, 0), proj.y(0) + 6);
        ctx.stroke();
      }
    }
    // Laternen (Seiten-Deko, scrollt)
    const lampSpacing = 18;
    const lp = this.distance % lampSpacing;
    for (let k = 1; k < 7; k++) {
      const z = k * lampSpacing - lp;
      const s = proj.scale(z);
      if (s < 0.08) continue;
      for (const side of [-1, 1]) {
        const bx = proj.cx + side * (W * 0.42) * s;
        const by = proj.y(z);
        const h = 90 * s * (H / 600);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3 * s + 1;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - h); ctx.stroke();
        ctx.fillStyle = '#ffe27a';
        ctx.beginPath(); ctx.arc(bx, by - h, 5 * s + 1, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawObstacle(ctx, proj, o) {
    const s = proj.scale(Math.max(0, o.z));
    if (s < 0.03) return;
    const x = proj.x(o.lane, o.z);
    const gy = proj.y(o.z);
    const u = (W) => W * (ctx.canvas.width / 800) * s;

    if (o.type === 'low') {
      // Hürde zum Springen
      const w = u(110), h = u(42);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(x - w / 2, gy - h, w, h * 0.55);
      ctx.fillStyle = '#fff';
      for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * (w / 5) - u(6), gy - h, u(12), h * 0.55);
      ctx.fillStyle = '#444';
      ctx.fillRect(x - w / 2, gy - h * 0.5, u(6), h * 0.5);
      ctx.fillRect(x + w / 2 - u(6), gy - h * 0.5, u(6), h * 0.5);
    } else if (o.type === 'high') {
      // Overhead-Board zum Rollen
      const w = u(120), boardH = u(46), postW = u(8);
      const topY = gy - u(110);
      ctx.fillStyle = '#334155';
      ctx.fillRect(x - w / 2, topY, postW, u(110));
      ctx.fillRect(x + w / 2 - postW, topY, postW, u(110));
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x - w / 2 - u(4), topY, w + u(8), boardH);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(6, u(22))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('▼ ROLLEN', x, topY + boardH * 0.72);
    } else {
      // Zug
      const backZ = o.z + o.length;
      const sb = proj.scale(Math.max(0, backZ));
      const xb = proj.x(o.lane, backZ);
      const yb = proj.y(backZ);
      const wF = u(120);
      const hF = u(120);
      // Seite (Perspektive nach hinten)
      ctx.fillStyle = o.type === 'trainLong' ? '#1d4ed8' : '#047857';
      ctx.beginPath();
      ctx.moveTo(x - wF / 2, gy);
      ctx.lineTo(xb - (wF * sb / s) / 2, yb);
      ctx.lineTo(xb - (wF * sb / s) / 2, yb - hF * (sb / s));
      ctx.lineTo(x - wF / 2, gy - hF);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = o.type === 'trainLong' ? '#1e40af' : '#065f46';
      ctx.beginPath();
      ctx.moveTo(x + wF / 2, gy);
      ctx.lineTo(xb + (wF * sb / s) / 2, yb);
      ctx.lineTo(xb + (wF * sb / s) / 2, yb - hF * (sb / s));
      ctx.lineTo(x + wF / 2, gy - hF);
      ctx.closePath(); ctx.fill();
      // Front
      const grad = ctx.createLinearGradient(x, gy - hF, x, gy);
      grad.addColorStop(0, o.type === 'trainLong' ? '#3b82f6' : '#10b981');
      grad.addColorStop(1, o.type === 'trainLong' ? '#1e3a8a' : '#064e3b');
      ctx.fillStyle = grad;
      ctx.fillRect(x - wF / 2, gy - hF, wF, hF);
      // Dach
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - wF / 2, gy - hF, wF, hF * 0.14);
      // Fenster
      ctx.fillStyle = '#bfdbfe';
      ctx.fillRect(x - wF * 0.36, gy - hF * 0.88, wF * 0.72, hF * 0.28);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x - wF * 0.36, gy - hF * 0.88, wF * 0.2, hF * 0.28);
      // Lichter
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(x - wF * 0.28, gy - hF * 0.22, u(9), 0, Math.PI * 2);
      ctx.arc(x + wF * 0.28, gy - hF * 0.22, u(9), 0, Math.PI * 2);
      ctx.fill();
      // Warnstreifen
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x - wF / 2, gy - hF * 0.08, wF, hF * 0.08);
    }
  }

  drawCoin(ctx, proj, c) {
    const s = proj.scale(Math.max(0, c.z));
    if (s < 0.03) return;
    const hAbove = (2 + (c.arcH || 0)) * 26; // Welt -> Pixel, Basis ~52px über Boden
    const x = proj.x(c.lane, c.z);
    const y = proj.y(c.z, hAbove);
    const r = 13 * (ctx.canvas.width / 800) * s + 2;
    const squash = Math.abs(Math.cos(c.spin));
    // Glow
    ctx.fillStyle = 'rgba(255, 215, 60, 0.25)';
    ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.fill();
    // Münze
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(2, r * squash), r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, r * 0.62 * squash), r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  }
}
