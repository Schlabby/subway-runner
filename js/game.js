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
    // NGE: Second-Impact-Abendrot — violett oben, blutrot am Horizont
    const sky = ctx.createLinearGradient(0, 0, 0, hy * 1.25);
    sky.addColorStop(0, '#12081f');
    sky.addColorStop(0.55, '#4b1030');
    sky.addColorStop(1, '#ff3d00');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hy + 2);
    // Rote Sonne mit Glow
    const sunX = W / 2, sunY = hy * 0.82, sunR = 30 * (W / 800);
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 3);
    glow.addColorStop(0, 'rgba(255,80,20,0.8)');
    glow.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - sunR * 3, sunY - sunR * 3, sunR * 6, sunR * 6);
    ctx.fillStyle = '#ff5a1f';
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sunX - sunR, sunY - 2, sunR * 2, 2); // Scanline, NERV-Monitor-Feeling
    // Tokyo-3-Silhouette (Parallax): versenkbare Blöcke + NERV-Pyramide mittig
    const bw = 60 * (W / 800);
    const off = this.cityOffset % (bw * 2);
    ctx.fillStyle = '#16101f';
    for (let x = -bw * 2; x < W + bw; x += bw) {
      const i = Math.round((x + off) / bw);
      const bh = 26 + ((i * 37) % 46);
      ctx.fillRect(x - off, hy - bh, bw * 0.8, bh);
      // winzige Warnfenster
      ctx.fillStyle = 'rgba(255,120,40,0.7)';
      ctx.fillRect(x - off + 6, hy - bh + 6, 3, 3);
      ctx.fillRect(x - off + 14, hy - bh + 12, 3, 3);
      ctx.fillStyle = '#16101f';
    }
    // NERV-Pyramide (Hauptquartier) am Horizont
    const pw = 90 * (W / 800), ph = 44;
    ctx.fillStyle = '#0a0a0e';
    ctx.beginPath();
    ctx.moveTo(W / 2 - pw / 2, hy); ctx.lineTo(W / 2, hy - ph); ctx.lineTo(W / 2 + pw / 2, hy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff2d00';
    ctx.fillRect(W / 2 - 3, hy - ph + 6, 6, 5); // rotes Top-Light
    // Boden: NERV-Startbahn (Graphit mit rotem Mittelglühen)
    const g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, '#2b1a1e');
    g.addColorStop(0.4, '#1c1420');
    g.addColorStop(1, '#0c0a12');
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, W, H - hy);
    // Seitenpanzerung
    ctx.fillStyle = '#241a20';
    ctx.beginPath();
    ctx.moveTo(0, hy); ctx.lineTo(W * 0.18, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, hy); ctx.lineTo(W * 0.82, H); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    // NERV-Blatt-Andeutung links (Halbkreis + Feige): minimalistisch
    ctx.strokeStyle = 'rgba(255,60,20,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(34, H - 34, 18, 0, Math.PI * 2); ctx.stroke();
  }

  drawTracks(ctx, W, H, proj) {
    // Schwellen als Startbahn-Segmente (NERV-Graphit + orange Kanten)
    const spacing = 4;
    const phase = this.distance % spacing;
    for (let k = 0; k < 26; k++) {
      const z = k * spacing - phase;
      const s = proj.scale(z);
      if (s < 0.04) continue;
      const y = proj.y(z);
      const w = (W * 0.62) * s;
      ctx.fillStyle = k % 2 ? '#33272b' : '#3d2f33';
      ctx.fillRect(proj.cx - w / 2, y - 2 * s - 2, w, 3 + 4 * s);
      ctx.fillStyle = 'rgba(255,70,20,0.55)';
      ctx.fillRect(proj.cx - w / 2, y - 2 * s - 2, 3 * s + 1, 3 + 4 * s);
      ctx.fillRect(proj.cx + w / 2 - 3 * s - 1, y - 2 * s - 2, 3 * s + 1, 3 + 4 * s);
    }
    // Führungsschienen (Umbilical-Bridge-Look)
    for (const L of [-1, 0, 1]) {
      for (const side of [-0.32, 0.32]) {
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = Math.max(1, 3 * (W / 800));
        ctx.beginPath();
        ctx.moveTo(proj.x(L + side * 0.3, CONFIG.spawnDistance), proj.y(CONFIG.spawnDistance));
        ctx.lineTo(proj.x(L + side, 0), proj.y(0) + 6);
        ctx.stroke();
      }
    }
    // NERV-Versorgungsmasten statt Laternen (rot blinkend)
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
        ctx.strokeStyle = '#0d0d12';
        ctx.lineWidth = 3 * s + 1;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - h); ctx.stroke();
        const blink = (Math.sin(this.time * 4 + k + side) + 1) / 2;
        ctx.fillStyle = blink > 0.5 ? '#ff2d00' : '#5c1200';
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
      // NERV-Blast-Barrikade (springen) — orange/schwarz, Warnlicht
      const w = u(110), h = u(42);
      ctx.fillStyle = '#23232b';
      ctx.fillRect(x - w / 2, gy - h, w, h * 0.55);
      ctx.fillStyle = '#ff5a00';
      for (let i = -2; i <= 2; i += 2) ctx.fillRect(x + i * (w / 5) - u(6), gy - h, u(14), h * 0.55);
      ctx.fillStyle = '#0c0c10';
      ctx.fillRect(x - w / 2, gy - h * 0.5, u(6), h * 0.5);
      ctx.fillRect(x + w / 2 - u(6), gy - h * 0.5, u(6), h * 0.5);
      ctx.fillStyle = (Math.sin(this.time * 8 + x) > 0) ? '#ff2d00' : '#5c1200';
      ctx.beginPath(); ctx.arc(x, gy - h - u(6), u(6), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(6, u(16))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('NERV', x, gy - h * 0.32);
    } else if (o.type === 'high') {
      // A.T.-FIELD (rollen!) — transluzentes Hexagon-Feld knapp über der Bahn
      const w = u(120), boardH = u(46), postW = u(8);
      const topY = gy - u(110);
      // Emitter-Pfosten
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(x - w / 2, topY, postW, u(110));
      ctx.fillRect(x + w / 2 - postW, topY, postW, u(110));
      // Feldfläche: orange, halbtransparent, mit Hex-Kante
      ctx.fillStyle = 'rgba(255,120,20,0.85)';
      ctx.strokeStyle = '#ffd27a';
      ctx.lineWidth = Math.max(1, u(3));
      ctx.beginPath();
      const hw = w / 2 + u(4);
      ctx.moveTo(x - hw + u(14), topY);
      ctx.lineTo(x + hw - u(14), topY);
      ctx.lineTo(x + hw, topY + boardH / 2);
      ctx.lineTo(x + hw - u(14), topY + boardH);
      ctx.lineTo(x - hw + u(14), topY + boardH);
      ctx.lineTo(x - hw, topY + boardH / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a0b00';
      ctx.font = `bold ${Math.max(6, u(18))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('A.T. FIELD', x, topY + boardH * 0.68);
    } else if (o.type === 'train') {
      // RAMIEL (5. Engel) — schwebender blauer Oktaeder
      const wF = u(120), hF = u(120);
      const cx0 = x, cy0 = gy - hF * 0.62;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5 + o.id);
      const gl = ctx.createRadialGradient(cx0, cy0, 2, cx0, cy0, wF * 0.9);
      gl.addColorStop(0, `rgba(80,180,255,${0.5 + pulse * 0.3})`);
      gl.addColorStop(1, 'rgba(20,60,180,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(cx0 - wF, cy0 - wF * 0.7, wF * 2, wF * 1.4);
      // Schatten auf Bahn
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(x, gy, wF * 0.4, wF * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      // Oktaeder
      const hw = wF * 0.42, hh = hF * 0.42;
      const grad = ctx.createLinearGradient(cx0, cy0 - hh, cx0, cy0 + hh);
      grad.addColorStop(0, '#9fd8ff');
      grad.addColorStop(0.5, '#2b7fff');
      grad.addColorStop(1, '#0b2a8a');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#d6ecff';
      ctx.lineWidth = Math.max(1, u(2));
      ctx.beginPath();
      ctx.moveTo(cx0, cy0 - hh); ctx.lineTo(cx0 + hw, cy0); ctx.lineTo(cx0, cy0 + hh); ctx.lineTo(cx0 - hw, cy0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.moveTo(cx0 - hw, cy0); ctx.lineTo(cx0 + hw, cy0); ctx.stroke();
      // Kern
      ctx.fillStyle = '#ff2d00';
      ctx.beginPath(); ctx.arc(cx0, cy0, u(7) + pulse * u(2), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx0, cy0, u(3), 0, Math.PI * 2); ctx.fill();
    } else {
      // SACHIEL (3. Engel, lang) — dunkler Riese mit Knochenmaske + S2-Kern
      const backZ = o.z + o.length;
      const sb = proj.scale(Math.max(0, backZ));
      const wF = u(120);
      const hF = u(150);
      // Tiefenzug (wenige Segmente für Long-Gefühl)
      ctx.fillStyle = 'rgba(20,16,24,0.9)';
      const xb = proj.x(o.lane, backZ);
      const yb = proj.y(backZ);
      ctx.fillRect(Math.min(x, xb) - wF * 0.3 * (sb / s), yb - hF * (sb / s), Math.abs(x - xb) + wF * 0.6 * (sb / s), hF * 0.2 * (sb / s) + 2);
      // Schatten
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(x, gy, wF * 0.42, wF * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      // Körper
      const bx0 = x - wF * 0.28, bw0 = wF * 0.56;
      const bgrad = ctx.createLinearGradient(bx0, gy - hF, bx0, gy);
      bgrad.addColorStop(0, '#3a3340');
      bgrad.addColorStop(1, '#121016');
      ctx.fillStyle = bgrad;
      ctx.beginPath(); ctx.roundRect(bx0, gy - hF, bw0, hF, u(14)); ctx.fill();
      // Rippen-Linien
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = Math.max(1, u(2));
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(bx0 + 3, gy - hF * 0.25 * i); ctx.lineTo(bx0 + bw0 - 3, gy - hF * 0.25 * i); ctx.stroke();
      }
      // Schulter-Pylonen
      ctx.fillStyle = '#262230';
      ctx.fillRect(bx0 - u(12), gy - hF * 0.95, u(14), hF * 0.3);
      ctx.fillRect(bx0 + bw0 - u(2), gy - hF * 0.95, u(14), hF * 0.3);
      // S2-Kern (rot, leuchtend)
      const coreY = gy - hF * 0.45;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6 + o.id);
      ctx.fillStyle = `rgba(255,45,0,${0.35 + pulse * 0.3})`;
      ctx.beginPath(); ctx.arc(x, coreY, u(16), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff2d00';
      ctx.beginPath(); ctx.arc(x, coreY, u(10), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd9c9';
      ctx.beginPath(); ctx.arc(x, coreY, u(4), 0, Math.PI * 2); ctx.fill();
      // Knochenmaske (weiß, schnabelförmig)
      ctx.fillStyle = '#e8e4da';
      ctx.beginPath();
      ctx.moveTo(x - u(18), gy - hF * 1.02);
      ctx.lineTo(x + u(18), gy - hF * 1.02);
      ctx.lineTo(x + u(8), gy - hF * 0.78);
      ctx.lineTo(x - u(8), gy - hF * 0.78);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(x - u(6), gy - hF * 0.93, u(3), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + u(6), gy - hF * 0.93, u(3), 0, Math.PI * 2); ctx.fill();
    }
  }

  drawCoin(ctx, proj, c) {
    // S2-Organ / Entry-Kern: rot glühende Kugel mit Hexa-Schimmer (statt Münze)
    const s = proj.scale(Math.max(0, c.z));
    if (s < 0.03) return;
    const hAbove = (2 + (c.arcH || 0)) * 26; // Welt -> Pixel, Basis ~52px über Boden
    const x = proj.x(c.lane, c.z);
    const y = proj.y(c.z, hAbove);
    const r = 13 * (ctx.canvas.width / 800) * s + 2;
    const squash = 0.75 + 0.25 * Math.abs(Math.cos(c.spin));
    const pulse = 0.5 + 0.5 * Math.sin(c.spin * 1.3);
    // AT-Schimmer
    ctx.fillStyle = `rgba(255,60,20,${0.18 + pulse * 0.15})`;
    ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, Math.PI * 2); ctx.fill();
    // S2-Kugel
    const cg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    cg.addColorStop(0, '#ffd9c9');
    cg.addColorStop(0.45, '#ff2d00');
    cg.addColorStop(1, '#7a0d00');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(2, r * squash), r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffb08a';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(2, r * squash), r, 0, 0, Math.PI * 2); ctx.stroke();
    // Kern-Highlight
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, Math.max(1, r * 0.22), 0, Math.PI * 2); ctx.fill();
  }
}
