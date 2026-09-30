// Projektion + Entities (Spieler, Hindernisse, Münzen)

function makeProjector(W, H) {
  const cx = W / 2;
  const horizonY = H * CONFIG.horizonY;
  const groundY = H * CONFIG.groundY;
  const laneBase = CONFIG.laneWidth * (W / 800);

  function scale(z) {
    return 1 / (1 + Math.max(0, z) * 0.13);
  }
  function x(laneFloat, z) {
    return cx + laneFloat * laneBase * scale(z);
  }
  function y(z, heightAboveGround = 0) {
    const s = scale(z);
    // Boden-Y bei Distanz z, minus Höhe (skaliert)
    return horizonY + (groundY - horizonY) * s - heightAboveGround * s;
  }
  return { scale, x, y, cx, horizonY, groundY };
}

class Player {
  constructor() {
    this.reset();
  }
  reset() {
    this.lane = 1;          // Index 0..2
    this.laneX = 0;         // -1..1 float für smooth Wechsel
    this.y = 0;             // Sprunghöhe
    this.vy = 0;
    this.jumping = false;
    this.rolling = 0;       // Restzeit
    this.runPhase = 0;
    this.dead = false;
  }
  get laneFloat() { return this.laneX; }
  get isRolling() { return this.rolling > 0; }
  get height() { return this.isRolling ? 0.45 : 1.0; } // für Kollision (relativ)

  move(dir) {
    this.lane = Math.max(0, Math.min(2, this.lane + dir));
  }
  targetLaneFloat() { return CONFIG.lanes[this.lane]; }

  jump() {
    if (this.jumping || this.isRolling) return;
    this.jumping = true;
    this.vy = CONFIG.jumpVelocity;
  }
  roll() {
    if (this.jumping) { // Slam down: schneller landen + rollen
      this.vy = -45;
    }
    this.rolling = CONFIG.rollTime;
  }
  update(dt, speed) {
    // Spurwechsel smooth
    const target = this.targetLaneFloat();
    const diff = target - this.laneX;
    this.laneX += diff * Math.min(1, dt * 12);
    if (Math.abs(diff) < 0.001) this.laneX = target;

    // Sprungphysik
    if (this.jumping) {
      this.y += this.vy * dt;
      this.vy += CONFIG.gravity * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.jumping = false; }
    }
    if (this.rolling > 0) this.rolling -= dt;
    this.runPhase += dt * (6 + speed * 0.25);
  }

  // Asuka Langley Soryu (Fan-Art, Canvas-nachempfunden):
  // langes orange-rotes Haar, rote A10-Interface-Clips, roter Plugsuit 02.
  draw(ctx, proj) {
    const s = proj.scale(0);
    const px = proj.x(this.laneX, 0);
    const py = proj.y(0, this.y * 30); // y in Welt (max ~4) -> Pixel (~120px Sprunghöhe)
    const base = (v) => v * (ctx.canvas.width / 800) * s;
    const HAIR = '#d9621c', HAIR_D = '#a8430f', HAIR_L = '#f59a4d';
    const SUIT = '#c81e2e', SUIT_D = '#8c1220', TRIM = '#111318';
    const SKIN = '#ffd2a1';

    ctx.save();
    ctx.translate(px, py);

    if (this.isRolling) {
      // Rolle: eingerollter Plugsuit + Haarwirbel
      const r = base(26);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(0, base(4), r * 1.1, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = SUIT;
      ctx.beginPath(); ctx.ellipse(0, -r * 0.7, r * 1.05, r * 0.8, this.runPhase * 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = TRIM; ctx.lineWidth = base(3);
      ctx.beginPath(); ctx.ellipse(0, -r * 0.7, r * 1.05, r * 0.8, this.runPhase * 2, 0, Math.PI * 2); ctx.stroke();
      // Haarsträhne wirbelt mit
      ctx.strokeStyle = HAIR; ctx.lineWidth = base(7); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(0, -r * 0.7, r * 1.35, r * 0.5, this.runPhase * 2 + 0.6, 0.3, Math.PI * 1.2); ctx.stroke();
      // A10-Clip blitzt
      ctx.fillStyle = '#fff';
      ctx.fillRect(-r * 0.2, -r * 1.5, r * 0.45, r * 0.28);
      ctx.fillStyle = SUIT;
      ctx.fillRect(-r * 0.2, -r * 1.5, r * 0.45, r * 0.1);
    } else {
      const run = Math.sin(this.runPhase * 2);
      const H = base(74);
      const legSwing = this.jumping ? 0.5 : run * 0.55;
      const bob = this.jumping ? 0 : Math.abs(Math.cos(this.runPhase * 2)) * base(3);

      // Schatten
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      const shScale = Math.max(0.3, 1 - this.y * 0.06);
      ctx.beginPath();
      ctx.ellipse(0, base(4), base(26) * shScale, base(8) * shScale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(0, -bob);
      // Hinterhaar (lang, bis Hüfte)
      ctx.fillStyle = HAIR_D;
      ctx.beginPath();
      ctx.roundRect(-base(17), -H * 1.12, base(34), H * 0.72, base(10));
      ctx.fill();
      // Beine (Plugsuit rot, schwarze Einsätze)
      ctx.strokeStyle = SUIT;
      ctx.lineWidth = base(11);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.45);
      ctx.lineTo(-base(10) * legSwing - base(4), 0);
      ctx.moveTo(0, -H * 0.45);
      ctx.lineTo(base(10) * legSwing + base(4), 0);
      ctx.stroke();
      ctx.strokeStyle = TRIM;
      ctx.lineWidth = base(4);
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.45);
      ctx.lineTo(-base(10) * legSwing - base(4), -base(2));
      ctx.moveTo(0, -H * 0.45);
      ctx.lineTo(base(10) * legSwing + base(4), -base(2));
      ctx.stroke();
      // Stiefel (weiß/rot)
      ctx.fillStyle = '#eee';
      ctx.fillRect(-base(10) * legSwing - base(11), -base(8), base(16), base(8));
      ctx.fillRect(base(10) * legSwing - base(3), -base(8), base(16), base(8));
      ctx.fillStyle = SUIT;
      ctx.fillRect(-base(10) * legSwing - base(11), -base(8), base(16), base(3));
      ctx.fillRect(base(10) * legSwing - base(3), -base(8), base(16), base(3));
      // Torso (Plugsuit 02)
      ctx.fillStyle = SUIT;
      const tw = base(30);
      ctx.beginPath();
      ctx.roundRect(-tw / 2, -H * 0.9, tw, H * 0.48, base(8));
      ctx.fill();
      // schwarzes Brust-/Bauch-Interface + weiße Linie
      ctx.fillStyle = TRIM;
      ctx.beginPath();
      ctx.roundRect(-tw * 0.28, -H * 0.86, tw * 0.56, H * 0.3, base(4));
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-tw / 2 + base(2), -H * 0.52, tw - base(4), base(2));
      ctx.font = `bold ${Math.max(5, base(10))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('02', 0, -H * 0.6);
      // Arme
      ctx.strokeStyle = SUIT;
      ctx.lineWidth = base(9);
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.8);
      ctx.lineTo(-base(16), -H * 0.5 + run * base(8));
      ctx.moveTo(0, -H * 0.8);
      ctx.lineTo(base(16), -H * 0.5 - run * base(8));
      ctx.stroke();
      // Kopf
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.arc(0, -H * 1.02, base(13), 0, Math.PI * 2); ctx.fill();
      // blaue Augen (stolz, nach vorn)
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(-base(7), -H * 1.04, base(4), base(3));
      ctx.fillRect(base(3), -H * 1.04, base(4), base(3));
      // Pony + lange Vordersträhnen
      ctx.fillStyle = HAIR;
      ctx.beginPath(); ctx.arc(0, -H * 1.07, base(13.5), Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
      ctx.fillRect(-base(14), -H * 1.06, base(6), base(22));
      ctx.fillRect(base(8), -H * 1.06, base(6), base(22));
      ctx.fillStyle = HAIR_L;
      ctx.fillRect(-base(12), -H * 1.14, base(4), base(10));
      // A10-Nervenclips (weiß mit rotem Streifen, beidseitig)
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(side * base(13) - base(3), -H * 1.12, base(7), base(11));
        ctx.fillStyle = SUIT;
        ctx.fillRect(side * base(13) - base(3), -H * 1.08, base(7), base(3));
      }
    }
    ctx.restore();
  }
}

let OBSTACLE_ID = 0;

class Obstacle {
  // type: 'low' (springen), 'high' (rollen), 'train' (ausweichen), 'trainLong'
  constructor(laneFloat, z, type, length = 3) {
    this.id = OBSTACLE_ID++;
    this.lane = laneFloat;
    this.z = z;
    this.type = type;
    this.length = length; // Ausdehnung in z (für lange Züge)
    this.passed = false;
  }
  update(dt, speed) { this.z -= speed * dt; }
  get isTrain() { return this.type === 'train' || this.type === 'trainLong'; }
}

class Coin {
  constructor(laneFloat, z) {
    this.lane = laneFloat;
    this.z = z;
    this.taken = false;
    this.spin = Math.random() * Math.PI * 2;
  }
  update(dt, speed) {
    this.z -= speed * dt;
    this.spin += dt * 6;
  }
}

// Erzeugt eine faire Hindernis-Reihe: mind. 1 Spur bleibt passierbar.
function spawnRow(spawnZ) {
  const objs = [];
  const roll = Math.random();
  const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);

  if (roll < 0.35) {
    // 1-2 Züge, Rest frei oder Münzen
    const nTrains = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < nTrains; i++) {
      const long = Math.random() < 0.35;
      objs.push({ kind: 'ob', ob: new Obstacle(lanes[i], spawnZ + Math.random() * 4, long ? 'trainLong' : 'train', long ? 10 + Math.random() * 8 : 3) });
    }
  } else if (roll < 0.65) {
    // Mix aus low/high Barrieren auf 1-2 Spuren
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = Math.random() < 0.5 ? 'low' : 'high';
      objs.push({ kind: 'ob', ob: new Obstacle(lanes[i], spawnZ, t) });
    }
  } else if (roll < 0.85) {
    // volle Breite low ODER high (alle 3 Spuren gleiche Aktion)
    const t = Math.random() < 0.5 ? 'low' : 'high';
    for (const L of [-1, 0, 1]) objs.push({ kind: 'ob', ob: new Obstacle(L, spawnZ, t) });
  } else {
    // Münz-Bogen ohne Gefahr (oder mit 1 Zug daneben)
    if (Math.random() < 0.4) objs.push({ kind: 'ob', ob: new Obstacle(lanes[0], spawnZ, 'train') });
  }

  // Münzen: Linie auf einer freien Spur
  const usedLanes = new Set(objs.filter(o => o.kind === 'ob').map(o => o.ob.lane));
  let coinLane = [-1, 0, 1].find(l => !usedLanes.has(l));
  if (coinLane === undefined) coinLane = lanes[2];
  const nCoins = 5 + Math.floor(Math.random() * 4);
  const arcJump = Math.random() < 0.25; // Münzen im Bogen für Sprung
  for (let i = 0; i < nCoins; i++) {
    const c = new Coin(coinLane, spawnZ - 6 + i * 2.2);
    c.arcJump = arcJump;
    c.arcH = arcJump ? Math.sin((i / (nCoins - 1)) * Math.PI) * 6 : 0;
    objs.push({ kind: 'coin', coin: c });
  }
  return objs;
}
