import { ARENA, BASE_RADIUS, MAX_EXTRA_RADIUS } from '../../shared/constants.js';

const BODY = { cat: '#b8c6e8', dog: '#e8c39e', pig: '#f5afc4' };
const DARK = { cat: '#8fa3d4', dog: '#c79b6d', pig: '#e786a6' };
const BULLET = { cat: '#d8def0', dog: '#fff6e8', pig: '#a9805b' };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.lastHp = new Map();
    this.flash = new Map();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = innerWidth;
    this.canvas.height = innerHeight;
  }

  addKillBurst(x, y, animal) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 180;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.6, color: BODY[animal] ?? '#fff', r: 3 + Math.random() * 4 });
    }
  }

  draw(state, myId, camera, dt) {
    const { ctx, canvas } = this;
    const ox = canvas.width / 2 - camera.x;
    const oy = canvas.height / 2 - camera.y;
    ctx.fillStyle = '#d7ecc8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 잔디 격자 + 아레나 경계
    ctx.save();
    ctx.translate(ox, oy);
    ctx.strokeStyle = '#c4e0b2';
    ctx.lineWidth = 1;
    for (let x = 0; x <= ARENA.w; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.h); ctx.stroke();
    }
    for (let y = 0; y <= ARENA.h; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA.w, y); ctx.stroke();
    }
    ctx.strokeStyle = '#8fb573'; ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, ARENA.w, ARENA.h);

    // 간식
    for (const f of state.pellets) {
      ctx.fillStyle = f.xp > 5 ? '#f2b64c' : '#e8985e';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.xp > 5 ? 7 : 5, 0, 7); ctx.fill();
    }

    // 탄
    for (const b of state.bullets) this._drawBullet(b);

    // 플레이어 (죽은 캐릭 제외)
    for (const p of state.players) {
      if (p.dead) { this.lastHp.delete(p.id); continue; }
      const prev = this.lastHp.get(p.id);
      if (prev != null && p.hp < prev) this.flash.set(p.id, 0.12);
      this.lastHp.set(p.id, p.hp);
      this._drawAnimal(p, p.id === myId);
    }
    for (const id of [...this.lastHp.keys()]) {
      if (!state.players.some((p) => p.id === id)) { this.lastHp.delete(id); this.flash.delete(id); }
    }

    // 파티클
    for (const pt of this.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      ctx.globalAlpha = Math.max(0, pt.life / 0.6);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const [id, t] of this.flash) {
      if (t - dt <= 0) this.flash.delete(id); else this.flash.set(id, t - dt);
    }
    ctx.restore();
  }

  _drawBullet(b) {
    const { ctx } = this;
    ctx.fillStyle = BULLET[b.animal] ?? '#fff';
    if (b.animal === 'dog') { // 뼈다귀: 막대 + 양끝 원 2개
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.fillRect(-b.r, -b.r / 3, b.r * 2, b.r / 1.5);
      for (const sx of [-b.r, b.r]) for (const sy of [-b.r / 3, b.r / 3]) {
        ctx.beginPath(); ctx.arc(sx, sy, b.r / 2.2, 0, 7); ctx.fill();
      }
      ctx.restore();
    } else if (b.animal === 'pig') { // 도토리: 원 + 꼭지
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#6d4c2b';
      ctx.beginPath(); ctx.arc(b.x, b.y - b.r * 0.7, b.r * 0.55, 0, 7); ctx.fill();
    } else { // 털뭉치: 보풀 원
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#aab6dd'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1.5, 0.4, 2.2); ctx.stroke();
    }
  }

  _drawAnimal(p, isMe) {
    const { ctx } = this;
    const r = BASE_RADIUS + Math.min(MAX_EXTRA_RADIUS, (p.level - 1) * 1.5);
    ctx.save();
    ctx.translate(p.x, p.y);

    // 이름 + 체력바 (회전 밖)
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = isMe ? '#2c56c9' : '#555';
    ctx.fillText(`${p.name} Lv${p.level}`, 0, -r - 16);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(-r, -r - 10, r * 2, 5);
    ctx.fillStyle = '#6fce6f';
    ctx.fillRect(-r, -r - 10, (r * 2 * p.hp) / p.maxHp, 5);

    ctx.rotate(p.aim);
    const flashing = this.flash.has(p.id);
    const body = flashing ? '#ffffff' : BODY[p.animal];
    const dark = flashing ? '#ffffff' : DARK[p.animal];

    // 귀 (몸 뒤)
    ctx.fillStyle = dark;
    if (p.animal === 'cat') {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, s * r * 0.5);
        ctx.lineTo(-r * 0.95, s * r * 1.05);
        ctx.lineTo(-r * 0.75, s * r * 0.25);
        ctx.closePath(); ctx.fill();
      }
    } else if (p.animal === 'dog') {
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(-r * 0.5, s * r * 0.85, r * 0.5, r * 0.3, s * 0.6, 0, 7); ctx.fill();
      }
    } else {
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(-r * 0.45, s * r * 0.8, r * 0.32, 0, 7); ctx.fill();
      }
    }

    // 몸통
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; ctx.stroke();

    // 눈 (조준 방향 = +x)
    ctx.fillStyle = '#222';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(r * 0.42, s * r * 0.32, r * 0.11, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(r * 0.46, s * r * 0.32 - r * 0.04, r * 0.04, 0, 7); ctx.fill();
    }

    // 입/코
    if (p.animal === 'pig') {
      ctx.fillStyle = flashing ? '#fff' : '#e786a6';
      ctx.beginPath(); ctx.ellipse(r * 0.75, 0, r * 0.26, r * 0.2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#a04e6e';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(r * 0.75, s * r * 0.07, r * 0.045, 0, 7); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(r * 0.8, 0, r * 0.08, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}
