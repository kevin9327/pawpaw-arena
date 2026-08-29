import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../shared/sim.js';
import { BotBrain } from '../shared/bots.js';
import { mulberry32 } from '../shared/constants.js';

function makeWorldPair() {
  const w = new World(mulberry32(10));
  const bot = w.addPlayer({ name: '초코', animal: 'dog', isBot: true });
  bot.x = 1000; bot.y = 1000;
  return { w, bot };
}

test('적이 없으면 가장 가까운 간식 방향으로 이동', () => {
  const { w, bot } = makeWorldPair();
  w._spawnPellet(1200, 1000, 5); // 오른쪽
  w._spawnPellet(400, 1000, 5);  // 먼 왼쪽
  const brain = new BotBrain(bot.id, { rng: mulberry32(11) });
  const input = brain.update(w, 1 / 30);
  assert.ok(input.move[0] > 0);
  assert.equal(input.fire, false);
});

test('시야 내 적: 반응 지연 후 발사, 조준은 적 방향(오차 0 주입)', () => {
  const { w, bot } = makeWorldPair();
  const enemy = w.addPlayer({ name: '나비', animal: 'cat' });
  enemy.x = 1300; enemy.y = 1000; enemy.vx = 0; enemy.vy = 0;
  const brain = new BotBrain(bot.id, { rng: mulberry32(12), aimError: 0, reactDelay: 0.2 });
  const first = brain.update(w, 1 / 30);
  assert.equal(first.fire, false); // 아직 반응 전
  let input;
  for (let i = 0; i < 10; i++) input = brain.update(w, 1 / 30);
  assert.equal(input.fire, true);
  assert.ok(Math.abs(input.aim) < 0.01); // 정확히 오른쪽
});

test('체력 30% 미만이면 적 반대 방향으로 도주', () => {
  const { w, bot } = makeWorldPair();
  const enemy = w.addPlayer({ name: '나비', animal: 'cat' });
  enemy.x = 1300; enemy.y = 1000;
  bot.hp = w.maxHpOf(bot) * 0.2;
  const brain = new BotBrain(bot.id, { rng: mulberry32(13), aimError: 0, reactDelay: 0 });
  const input = brain.update(w, 1 / 30);
  assert.ok(input.move[0] < 0); // 왼쪽으로 도주
});
