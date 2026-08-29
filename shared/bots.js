import { BOT_VIEW, BOT_FLEE_HP, ANIMALS } from './constants.js';

export class BotBrain {
  constructor(playerId, { rng = Math.random, aimError = null, reactDelay = null } = {}) {
    this.playerId = playerId;
    this.rng = rng;
    this.aimError = aimError != null ? aimError : 0.05 + rng() * 0.35;   // 스펙: 0.05~0.4rad
    this.reactDelay = reactDelay != null ? reactDelay : 0.1 + rng() * 0.4;
    this.sinceSeen = Infinity;
    this.strafeDir = rng() < 0.5 ? 1 : -1;
    this.strafeTimer = 0;
    this.wanderAngle = rng() * Math.PI * 2;
  }

  update(world, dt) {
    const me = world.players.get(this.playerId);
    if (!me || me.dead) return { move: [0, 0], aim: 0, fire: false };
    const enemy = this._nearestEnemy(world, me);
    if (!enemy) { this.sinceSeen = Infinity; return this._wander(world, me, dt); }
    if (this.sinceSeen === Infinity) this.sinceSeen = 0;
    this.sinceSeen += dt;

    const dist = Math.hypot(enemy.x - me.x, enemy.y - me.y) || 1;
    const t = dist / ANIMALS[me.animal].bulletSpeed;      // 예측 조준
    const px = enemy.x + (enemy.vx != null ? enemy.vx : 0) * t;
    const py = enemy.y + (enemy.vy != null ? enemy.vy : 0) * t;
    const aim = Math.atan2(py - me.y, px - me.x) + (this.rng() - 0.5) * 2 * this.aimError;
    const fire = this.sinceSeen >= this.reactDelay;

    let move;
    if (me.hp < BOT_FLEE_HP * world.maxHpOf(me)) {
      move = [me.x - enemy.x, me.y - enemy.y];            // 도주
    } else {
      this.strafeTimer -= dt;                             // 지그재그 + 거리 유지(250~350px)
      if (this.strafeTimer <= 0) { this.strafeDir *= -1; this.strafeTimer = 0.5 + this.rng(); }
      const toward = dist > 350 ? 1 : dist < 250 ? -1 : 0;
      const dx = (enemy.x - me.x) / dist, dy = (enemy.y - me.y) / dist;
      move = [dx * toward - dy * this.strafeDir, dy * toward + dx * this.strafeDir];
    }
    return { move, aim, fire };
  }

  _nearestEnemy(world, me) {
    let best = null, bestD = BOT_VIEW ** 2;
    for (const p of world.players.values()) {
      if (p.id === me.id || p.dead) continue;
      const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  _wander(world, me, dt) {
    let best = null, bestD = Infinity;
    for (const f of world.pellets.values()) {
      const d = (f.x - me.x) ** 2 + (f.y - me.y) ** 2;
      if (d < bestD) { bestD = d; best = f; }
    }
    if (best) return { move: [best.x - me.x, best.y - me.y], aim: me.aim, fire: false };
    this.wanderAngle += (this.rng() - 0.5) * dt * 2;
    return { move: [Math.cos(this.wanderAngle), Math.sin(this.wanderAngle)], aim: me.aim, fire: false };
  }
}
