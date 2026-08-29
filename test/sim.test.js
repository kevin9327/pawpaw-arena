import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../shared/sim.js';
import { ARENA, ANIMALS, mulberry32, xpForLevel, PELLET_XP, UPGRADE_STEP } from '../shared/constants.js';

test('플레이어 추가: 스탯이 동물 정의를 따르고 아레나 안에 스폰된다', () => {
  const w = new World(mulberry32(1));
  const p = w.addPlayer({ name: '나비', animal: 'cat' });
  assert.equal(p.hp, ANIMALS.cat.maxHp);
  assert.equal(p.level, 1);
  assert.ok(p.x >= 0 && p.x <= ARENA.w && p.y >= 0 && p.y <= ARENA.h);
  assert.equal(w.snapshot().players.length, 1);
});

test('이동: 입력 방향으로 speed*dt 만큼 이동하고 벽에 클램프된다', () => {
  const w = new World(mulberry32(1));
  const p = w.addPlayer({ name: '나비', animal: 'cat' });
  p.x = 100; p.y = 100;
  w.setInput(p.id, { move: [1, 0], aim: 0, fire: false });
  w.tick(0.5);
  assert.ok(Math.abs(p.x - (100 + ANIMALS.cat.speed * 0.5)) < 1e-6);
  p.x = 5; w.setInput(p.id, { move: [-1, 0], aim: 0, fire: false });
  w.tick(1);
  assert.equal(p.x, w.radiusOf(p)); // 벽 클램프
});

test('xpForLevel 커브', () => {
  assert.equal(xpForLevel(1), 40);
  assert.equal(xpForLevel(2), Math.round(40 * 1.35));
});

test('발사: fire 입력 시 탄 1개 생성 후 쿨다운 동안 재발사 안 됨', () => {
  const w = new World(mulberry32(2));
  const p = w.addPlayer({ name: '뽀삐', animal: 'dog' });
  w.setInput(p.id, { move: [0, 0], aim: 0, fire: true });
  w.tick(1 / 30);
  assert.equal(w.bullets.length, 1);
  w.tick(1 / 30); // 쿨다운(1/3s) 중
  assert.equal(w.bullets.length, 1);
});

test('전투: 점사 → 사망 → 킬보상 30%·드랍 50% → 3초 후 리스폰', () => {
  const w = new World(mulberry32(3));
  const atk = w.addPlayer({ name: '꿀꿀이', animal: 'pig' });
  const vic = w.addPlayer({ name: '나비', animal: 'cat' });
  atk.x = 500; atk.y = 500; vic.x = 700; vic.y = 500;
  vic.hp = 1; vic.lifeXp = 100; vic.score = 100;
  w.setInput(atk.id, { move: [0, 0], aim: 0, fire: true });
  for (let i = 0; i < 60 && !vic.dead; i++) { w.tick(1 / 30); vic.x = 700; vic.y = 500; }
  assert.equal(vic.dead, true);
  assert.equal(atk.score, 30); // 100 * 0.3
  const dropped = [...w.pellets.values()].filter((f) => f.xp !== PELLET_XP)
    .reduce((s, f) => s + f.xp, 0);
  assert.equal(dropped, 50);   // 100 * 0.5 — 트리클 간식(5XP) 제외, 드랍 청크(10XP)만
  const kills = w.drainEvents().filter((e) => e.t === 'kill');
  assert.equal(kills.length, 1);
  assert.equal(kills[0].victimName, '나비');
  for (let i = 0; i < 100 && vic.dead; i++) w.tick(1 / 30); // 3초+
  assert.equal(vic.dead, false);
  assert.equal(vic.level, 1);
  assert.equal(vic.hp, w.maxHpOf(vic));
});

test('자기 탄에는 안 맞는다', () => {
  const w = new World(mulberry32(4));
  const p = w.addPlayer({ name: '보리', animal: 'cat' });
  p.x = 1000; p.y = 1000;
  // 탄을 소유자 몸 위에 강제로 겹쳐 놓아 면역 가드를 직접 검증
  w.bullets.push({ id: 999, owner: p.id, animal: 'cat', x: 1000, y: 1000,
    vx: 0, vy: 0, damage: 8, radius: 6, ttl: 1 });
  const hp0 = p.hp;
  w.tick(1 / 30);
  assert.equal(p.hp, hp0);          // 면역: 데미지 없음
  assert.equal(w.bullets.length, 1); // 탄도 소멸하지 않음
});

test('간식: 트리클 스폰되고 먹으면 XP·점수 획득', () => {
  const w = new World(mulberry32(5));
  const p = w.addPlayer({ name: '두부', animal: 'dog' });
  w.tick(1 / 30);
  assert.equal(w.pellets.size, 2); // 틱당 2개
  const f = [...w.pellets.values()][0];
  p.x = f.x; p.y = f.y;
  w.tick(1 / 30);
  assert.equal(p.score, PELLET_XP);
});

test('레벨업: 40XP → 레벨2 + 유저에겐 choices 이벤트, 선택하면 +15%', () => {
  const w = new World(mulberry32(6));
  const p = w.addPlayer({ name: '콩이', animal: 'cat' });
  w._gainXp(p, 40);
  assert.equal(p.level, 2);
  assert.equal(p.choices.length, 3);
  const ev = w.drainEvents().find((e) => e.t === 'choices');
  assert.equal(ev.id, p.id);
  const stat = p.choices[0];
  const base = w.statOf(p, stat);
  assert.equal(w.chooseUpgrade(p.id, stat), true);
  assert.ok(Math.abs(w.statOf(p, stat) / base - (1 + UPGRADE_STEP)) < 1e-9);
  assert.equal(p.choices, null);
  assert.equal(w.chooseUpgrade(p.id, stat), false); // 제시 없을 때 거부
});

test('봇은 레벨업 시 자동 선택', () => {
  const w = new World(mulberry32(7));
  const b = w.addPlayer({ name: '초코', animal: 'pig', isBot: true });
  w._gainXp(b, 40);
  const total = Object.values(b.upgrades).reduce((s, v) => s + v, 0);
  assert.equal(total, 1);
  assert.equal(b.choices, null);
});

test('setInput은 비정상 입력을 무해화한다', () => {
  const w = new World(mulberry32(8));
  const p = w.addPlayer({ name: '나', animal: 'cat' });
  w.setInput(p.id, { move: 5, aim: 'x', fire: 1 });
  w.tick(1 / 30);
  assert.ok(Number.isFinite(p.x));
  w.setInput(p.id, { move: [Infinity, 0], aim: Infinity, fire: false });
  w.tick(1 / 30);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.aim));
});
