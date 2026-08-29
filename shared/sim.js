import { ARENA, ANIMALS, BASE_RADIUS, MAX_EXTRA_RADIUS, UPGRADE_STEP } from './constants.js';

export class World {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.players = new Map();
    this.bullets = [];
    this.pellets = new Map();
    this.events = [];
    this.nextId = 1;
    this.tickCount = 0;
  }

  addPlayer({ name, animal, isBot = false }) {
    const id = this.nextId++;
    const p = {
      id, name, animal, isBot,
      x: 100 + this.rng() * (ARENA.w - 200),
      y: 100 + this.rng() * (ARENA.h - 200),
      vx: 0, vy: 0, aim: 0,
      hp: ANIMALS[animal].maxHp, level: 1, xp: 0, score: 0,
      upgrades: { damage: 0, fireRate: 0, speed: 0, maxHp: 0 },
      choices: null, fireCooldown: 0, respawnTimer: 0, dead: false,
      input: { move: [0, 0], aim: 0, fire: false },
    };
    this.players.set(id, p);
    return p;
  }

  removePlayer(id) { this.players.delete(id); }

  setInput(id, input) {
    const p = this.players.get(id);
    if (!p) return;
    const [mx, my] = input.move ?? [0, 0];
    const len = Math.hypot(mx, my);
    p.input = {
      move: len > 1e-9 ? [mx / len, my / len] : [0, 0],
      aim: Number(input.aim) || 0,
      fire: !!input.fire,
    };
  }

  statOf(p, stat) {
    return ANIMALS[p.animal][stat] * (1 + UPGRADE_STEP * p.upgrades[stat]);
  }

  radiusOf(p) {
    return BASE_RADIUS + Math.min(MAX_EXTRA_RADIUS, (p.level - 1) * 1.5);
  }

  maxHpOf(p) { return this.statOf(p, 'maxHp'); }

  tick(dt) {
    this.tickCount++;
    for (const p of this.players.values()) {
      if (p.dead) { this._tickRespawn(p, dt); continue; }
      const speed = this.statOf(p, 'speed');
      p.vx = p.input.move[0] * speed;
      p.vy = p.input.move[1] * speed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const r = this.radiusOf(p);
      p.x = Math.min(ARENA.w - r, Math.max(r, p.x));
      p.y = Math.min(ARENA.h - r, Math.max(r, p.y));
      p.aim = p.input.aim;
      this._tickFire(p, dt);   // Task 3
    }
    this._tickBullets(dt);     // Task 3
    this._tickPellets(dt);     // Task 4
  }

  _tickRespawn() {} // Task 3에서 구현
  _tickFire() {}    // Task 3에서 구현
  _tickBullets() {} // Task 3에서 구현
  _tickPellets() {} // Task 4에서 구현

  snapshot() {
    return {
      tick: this.tickCount,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, animal: p.animal,
        x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
        aim: Math.round(p.aim * 100) / 100,
        hp: Math.round(p.hp), maxHp: Math.round(this.maxHpOf(p)),
        level: p.level, score: p.score, dead: p.dead,
      })),
      bullets: this.bullets.map((b) => ({ id: b.id, animal: b.animal, x: Math.round(b.x), y: Math.round(b.y), r: b.radius })),
      pellets: [...this.pellets.values()].map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y), xp: f.xp })),
    };
  }

  drainEvents() { const ev = this.events; this.events = []; return ev; }
}
