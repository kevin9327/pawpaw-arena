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
