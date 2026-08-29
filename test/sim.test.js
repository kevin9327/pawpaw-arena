import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../shared/sim.js';
import { ARENA, ANIMALS, mulberry32, xpForLevel } from '../shared/constants.js';

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
