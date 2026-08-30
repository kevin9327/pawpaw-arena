import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createServer } from '../server/app.js';

async function nextState(ws) {
  for (let i = 0; i < 20; i++) {
    const [raw] = await once(ws, 'message');
    const msg = JSON.parse(raw);
    if (msg.t === 'state') return msg;
  }
  throw new Error('state 미수신');
}

test('join→welcome, 방은 봇 포함 12명, 입력이 이동에 반영된다', async () => {
  const server = createServer().listen(0);
  await once(server, 'listening');
  const port = server.address().port;
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await once(ws, 'open');
  ws.send(JSON.stringify({ t: 'join', name: '테스터', animal: 'cat' }));
  const [wraw] = await once(ws, 'message');
  const welcome = JSON.parse(wraw);
  assert.equal(welcome.t, 'welcome');
  assert.equal(welcome.arena.w, 2500);

  const s1 = await nextState(ws);
  assert.equal(s1.players.length, 12);
  const me1 = s1.players.find((p) => p.id === welcome.id);
  assert.equal(me1.name, '테스터');

  ws.send(JSON.stringify({ t: 'input', move: [1, 0], aim: 0, fire: false }));
  await new Promise((r) => setTimeout(r, 300));
  const s2 = await nextState(ws);
  const me2 = s2.players.find((p) => p.id === welcome.id);
  assert.ok(me2.x > me1.x);

  ws.close();
  server.close();
  await once(server, 'close');
});

test('정적 서빙: /shared/constants.js 를 JS로 제공, 경로 탈출은 403/404', async () => {
  const server = createServer().listen(0);
  await once(server, 'listening');
  const port = server.address().port;
  const ok = await fetch(`http://127.0.0.1:${port}/shared/constants.js`);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type'), /javascript/);
  const bad = await fetch(`http://127.0.0.1:${port}/..%2f..%2fetc%2fpasswd`);
  assert.ok(bad.status === 403 || bad.status === 404);
  const bypass = await fetch(`http://127.0.0.1:${port}/client/..%2fserver%2fapp.js`);
  assert.equal(bypass.status, 404);
  const pkg = await fetch(`http://127.0.0.1:${port}/package.json`);
  assert.equal(pkg.status, 404);
  const git = await fetch(`http://127.0.0.1:${port}/shared/..%2f.git%2fconfig`);
  assert.equal(git.status, 404);
  server.close();
  await once(server, 'close');
});

test('악성 입력에도 서버가 죽지 않는다', async () => {
  const server = createServer().listen(0);
  await once(server, 'listening');
  const port = server.address().port;
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await once(ws, 'open');
  ws.send(JSON.stringify({ t: 'join', name: '그리퍼', animal: 'cat' }));
  await once(ws, 'message'); // welcome
  ws.send(JSON.stringify({ t: 'input', move: 5 }));
  ws.send(JSON.stringify({ t: 'input', move: [Infinity, 0], aim: Infinity }));
  ws.send('not json');
  const s = await nextState(ws);
  const me = s.players.find((p) => p.name === '그리퍼');
  assert.ok(me && Number.isFinite(me.x));
  ws.close();
  server.close();
  await once(server, 'close');
});

async function joinAndWelcome(port, name, animal) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await once(ws, 'open');
  ws.send(JSON.stringify({ t: 'join', name, animal }));
  for (let i = 0; i < 20; i++) {
    const [raw] = await once(ws, 'message');
    const m = JSON.parse(raw);
    if (m.t === 'welcome') return { ws, id: m.id };
  }
  throw new Error('welcome 미수신');
}

test('다중 방: 13번째 사람은 새 방으로 격리되어 서로 안 보인다', async () => {
  const server = createServer().listen(0);
  await once(server, 'listening');
  const port = server.address().port;

  // 방 하나(정원 12 사람)를 채운다
  const first = [];
  for (let i = 0; i < 12; i++) first.push(await joinAndWelcome(port, `유저${i}`, 'cat'));
  // 13번째 → 새 방
  const odd = await joinAndWelcome(port, '십삼번', 'dog');

  // 13번째의 방 상태에는 '십삼번'이 있고 '유저0'은 없다(격리)
  const s = await nextState(odd.ws);
  const names = s.players.map((p) => p.name);
  assert.ok(names.includes('십삼번'), '자신은 보여야 함');
  assert.ok(!names.includes('유저0'), '다른 방 사람은 안 보여야 함');
  assert.equal(s.players.length, 12, '새 방도 봇으로 12명 채워짐');

  for (const c of first) c.ws.close();
  odd.ws.close();
  server.close();
  await once(server, 'close');
});

test('대역폭: 간식(pellets)은 매 프레임이 아니라 일부 프레임에만 포함된다', async () => {
  const server = createServer().listen(0);
  await once(server, 'listening');
  const port = server.address().port;
  const { ws } = await joinAndWelcome(port, '측정', 'cat');

  let withP = 0, without = 0;
  for (let i = 0; i < 12; i++) {
    const s = await nextState(ws);
    if (s.pellets !== undefined) withP++; else without++;
  }
  assert.ok(withP >= 1, '간식 전체 프레임이 최소 한 번은 와야 함');
  assert.ok(without >= 1, '간식 생략 프레임도 있어야 함(대역폭 절감)');

  ws.close();
  server.close();
  await once(server, 'close');
});
