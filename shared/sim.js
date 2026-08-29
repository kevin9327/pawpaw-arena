import { ARENA, ANIMALS, BASE_RADIUS, MAX_EXTRA_RADIUS, UPGRADE_STEP, BULLET_TTL,
  RESPAWN_DELAY, DEATH_DROP_RATIO, KILL_XP_RATIO,
  PELLET_TARGET, PELLET_XP, UPGRADE_MAX, STATS, xpForLevel } from './constants.js';

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
      hp: ANIMALS[animal].maxHp, level: 1, xp: 0, score: 0, lifeXp: 0,
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

  _tickRespawn(p, dt) {
    p.respawnTimer -= dt;
    if (p.respawnTimer > 0) return;
    p.dead = false;
    p.level = 1; p.xp = 0; p.lifeXp = 0;
    p.upgrades = { damage: 0, fireRate: 0, speed: 0, maxHp: 0 };
    p.choices = null; p.fireCooldown = 0;
    p.hp = this.maxHpOf(p);
    p.x = 100 + this.rng() * (ARENA.w - 200);
    p.y = 100 + this.rng() * (ARENA.h - 200);
  }

  _tickFire(p, dt) {
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (!p.input.fire || p.fireCooldown > 0) return;
    const a = ANIMALS[p.animal];
    const r = this.radiusOf(p);
    this.bullets.push({
      id: this.nextId++, owner: p.id, animal: p.animal,
      x: p.x + Math.cos(p.aim) * (r + a.bulletRadius + 2),
      y: p.y + Math.sin(p.aim) * (r + a.bulletRadius + 2),
      vx: Math.cos(p.aim) * a.bulletSpeed, vy: Math.sin(p.aim) * a.bulletSpeed,
      damage: this.statOf(p, 'damage'), radius: a.bulletRadius, ttl: BULLET_TTL,
    });
    p.fireCooldown = 1 / this.statOf(p, 'fireRate');
  }

  _tickBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.ttl -= dt;
      if (b.ttl <= 0) continue;
      if (b.x < 0 || b.x > ARENA.w || b.y < 0 || b.y > ARENA.h) { b.ttl = 0; continue; }
      for (const p of this.players.values()) {
        if (p.dead || p.id === b.owner) continue;
        const rr = this.radiusOf(p) + b.radius;
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= rr * rr) {
          p.hp -= b.damage; b.ttl = 0;
          if (p.hp <= 0) this._kill(p, this.players.get(b.owner));
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.ttl > 0);
  }

  _kill(victim, killer) {
    victim.dead = true;
    victim.respawnTimer = RESPAWN_DELAY;
    let remain = Math.floor(victim.lifeXp * DEATH_DROP_RATIO);
    while (remain > 0) {
      const chunk = Math.min(10, remain); remain -= chunk;
      this._spawnPellet(victim.x + (this.rng() - 0.5) * 120,
                        victim.y + (this.rng() - 0.5) * 120, chunk);
    }
    if (killer && !killer.dead) this._gainXp(killer, Math.floor(victim.lifeXp * KILL_XP_RATIO));
    this.events.push({
      t: 'kill', killerId: killer?.id ?? null,
      killerName: killer?.name ?? '', killerAnimal: killer?.animal ?? '',
      victimId: victim.id, victimName: victim.name, victimAnimal: victim.animal,
      x: Math.round(victim.x), y: Math.round(victim.y),
    });
  }

  _spawnPellet(x, y, xp) {
    const id = this.nextId++;
    this.pellets.set(id, {
      id,
      x: Math.min(ARENA.w - 10, Math.max(10, x)),
      y: Math.min(ARENA.h - 10, Math.max(10, y)),
      xp,
    });
  }

  _gainXp(p, amount) {
    p.xp += amount; p.lifeXp += amount; p.score += amount;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      this._offerChoices(p);
    }
  }

  _tickPellets() {
    const deficit = PELLET_TARGET - this.pellets.size;
    for (let i = 0; i < Math.min(2, deficit); i++) {
      this._spawnPellet(20 + this.rng() * (ARENA.w - 40),
                        20 + this.rng() * (ARENA.h - 40), PELLET_XP);
    }
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const r = this.radiusOf(p) + 6;
      for (const f of [...this.pellets.values()]) {
        if ((p.x - f.x) ** 2 + (p.y - f.y) ** 2 <= r * r) {
          this.pellets.delete(f.id);
          this._gainXp(p, f.xp);
        }
      }
    }
  }

  _offerChoices(p) {
    const avail = STATS.filter((s) => p.upgrades[s] < UPGRADE_MAX);
    if (!avail.length) { p.choices = null; return; }
    const shuffled = [...avail].sort(() => this.rng() - 0.5);
    p.choices = shuffled.slice(0, Math.min(3, shuffled.length));
    if (p.isBot) {
      this.chooseUpgrade(p.id, p.choices[Math.floor(this.rng() * p.choices.length)]);
    } else {
      this.events.push({ t: 'choices', id: p.id, choices: p.choices });
    }
  }

  chooseUpgrade(id, stat) {
    const p = this.players.get(id);
    if (!p || !p.choices || !p.choices.includes(stat)) return false;
    const hpFrac = p.hp / this.maxHpOf(p);
    p.upgrades[stat] = Math.min(UPGRADE_MAX, p.upgrades[stat] + 1);
    p.choices = null;
    if (stat === 'maxHp') p.hp = hpFrac * this.maxHpOf(p);
    return true;
  }

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
