export class SnapshotBuffer {
  constructor(delay = 0.1) { this.delay = delay; this.buf = []; }

  push(snap) {
    this.buf.push({ at: performance.now() / 1000, snap });
    if (this.buf.length > 40) this.buf.shift();
  }

  sample() {
    if (!this.buf.length) return null;
    const target = performance.now() / 1000 - this.delay;
    let a = this.buf[0], b = this.buf[this.buf.length - 1];
    for (let i = 0; i < this.buf.length - 1; i++) {
      if (this.buf[i].at <= target && this.buf[i + 1].at >= target) {
        a = this.buf[i]; b = this.buf[i + 1]; break;
      }
    }
    const span = b.at - a.at;
    const t = span > 0 ? Math.min(1, Math.max(0, (target - a.at) / span)) : 1;
    return lerpState(a.snap, b.snap, t);
  }
}

export function lerpState(s1, s2, t) {
  const lerp = (x, y) => x + (y - x) * t;
  const prev = new Map(s1.players.map((p) => [p.id, p]));
  return {
    ...s2,
    players: s2.players.map((p) => {
      const o = prev.get(p.id);
      if (!o || o.dead || p.dead) return p;
      let da = p.aim - o.aim;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      return { ...p, x: lerp(o.x, p.x), y: lerp(o.y, p.y), aim: o.aim + da * t };
    }),
    bullets: s2.bullets.map((b) => {
      const o = s1.bullets.find((q) => q.id === b.id);
      return o ? { ...b, x: lerp(o.x, b.x), y: lerp(o.y, b.y) } : b;
    }),
  };
}
