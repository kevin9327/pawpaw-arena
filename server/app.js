import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { World } from '../shared/sim.js';
import { BotBrain } from '../shared/bots.js';
import { pickBotName } from '../shared/names.js';
import { ARENA, TICK_RATE, SNAPSHOT_RATE, ROOM_SIZE, ANIMALS } from '../shared/constants.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ALLOW_INDEX = normalize(join(ROOT, 'index.html'));
const ALLOW_CLIENT = normalize(join(ROOT, 'client')) + sep;
const ALLOW_SHARED = normalize(join(ROOT, 'shared')) + sep;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
};

export function createServer() {
  const httpServer = http.createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path === '/') path = '/index.html';
      const file = normalize(join(ROOT, path));
      if (!(file === ALLOW_INDEX || file.startsWith(ALLOW_CLIENT) || file.startsWith(ALLOW_SHARED))) {
        res.writeHead(404); return res.end('not found');
      }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });

  // 다중 방: 사람이 있을 때만 방을 만든다(아무도 없으면 CPU 0). 방이 12명(사람) 차면
  // 새 방을 만들어 최대 MAX_ROOMS개까지. 간식은 매 프레임 대신 5Hz로만 전송해 대역폭 절감.
  const HUMAN_CAP = ROOM_SIZE;       // 방당 사람 최대 (봇이 나머지를 채움)
  const MAX_ROOMS = 20;              // 총 방 상한 → 최대 동시 사람 240
  const PELLET_EVERY = 4;            // 간식 전체 전송 주기(20Hz/4 = 5Hz)
  const rooms = [];

  function makeRoom() {
    return { world: new World(), brains: new Map(), clients: new Map(), pelletTick: 0, sendPellets: true };
  }

  function fillBots(room) {
    const animals = Object.keys(ANIMALS);
    while (room.world.players.size < ROOM_SIZE) {
      const p = room.world.addPlayer({
        name: pickBotName(Math.random, 'en'),   // 온라인 방은 177개국 공용 → 영어 이름풀 기본(오프라인 봇은 로케일 일치)
        animal: animals[Math.floor(Math.random() * animals.length)],
        isBot: true,
      });
      room.brains.set(p.id, new BotBrain(p.id, {}));
    }
    let excess = room.world.players.size - ROOM_SIZE;
    for (const [id] of room.brains) {
      if (excess <= 0) break;
      room.brains.delete(id); room.world.removePlayer(id); excess--;
    }
  }

  function humanCount(room) {
    let n = 0;
    for (const p of room.world.players.values()) if (!p.isBot) n++;
    return n;
  }

  function assignRoom() {
    for (const r of rooms) if (humanCount(r) < HUMAN_CAP) return r;
    if (rooms.length < MAX_ROOMS) { const r = makeRoom(); fillBots(r); rooms.push(r); return r; }
    return null;
  }

  const wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      try {
        if (msg.t === 'join' && !ws.room) {
          const room = assignRoom();
          if (!room) { ws.send(JSON.stringify({ t: 'full' })); ws.close(); return; }
          const animal = ANIMALS[msg.animal] ? msg.animal : 'dog';
          const name = String(msg.name ?? '').slice(0, 12).trim() || '익명동물';
          const p = room.world.addPlayer({ name, animal });
          ws.room = room; ws.pid = p.id;
          room.clients.set(ws, p.id);
          fillBots(room);
          room.sendPellets = true;   // 새 참가자에게 다음 방송에서 간식 전체 전송
          ws.send(JSON.stringify({ t: 'welcome', id: p.id, arena: ARENA }));
        } else if (msg.t === 'input' && ws.room) {
          ws.room.world.setInput(ws.pid, msg);
        } else if (msg.t === 'upgrade' && ws.room) {
          ws.room.world.chooseUpgrade(ws.pid, msg.stat);
        }
      } catch {
        // 잘못된 메시지가 프로세스를 죽이지 않도록 무시
      }
    });
    ws.on('close', () => {
      const room = ws.room;
      if (!room) return;
      room.world.removePlayer(ws.pid);
      room.clients.delete(ws);
      if (humanCount(room) === 0) {
        const i = rooms.indexOf(room);
        if (i >= 0) rooms.splice(i, 1);   // 빈 방은 제거 → 유휴 시 시뮬레이션 0
      } else {
        fillBots(room);
      }
      ws.room = null;
    });
  });

  const simTimer = setInterval(() => {
    const dt = 1 / TICK_RATE;
    for (const room of rooms) {
      for (const [id, brain] of room.brains) room.world.setInput(id, brain.update(room.world, dt));
      room.world.tick(dt);
    }
  }, 1000 / TICK_RATE);

  const castTimer = setInterval(() => {
    for (const room of rooms) {
      const events = room.world.drainEvents();
      const pub = events.filter((e) => e.t !== 'choices');
      const snap = room.world.snapshot();
      const includePellets = room.sendPellets || (room.pelletTick % PELLET_EVERY === 0);
      room.pelletTick++;
      room.sendPellets = false;
      const base = { t: 'state', tick: snap.tick, players: snap.players, bullets: snap.bullets, events: pub };
      if (includePellets) base.pellets = snap.pellets;   // 없으면 클라가 직전 간식을 유지
      const stateMsg = JSON.stringify(base);
      for (const [ws, pid] of room.clients) {
        if (ws.readyState !== ws.OPEN) continue;
        ws.send(stateMsg);
        for (const e of events) {
          if (e.t === 'choices' && e.id === pid) {
            ws.send(JSON.stringify({ t: 'choices', choices: e.choices }));
          }
        }
      }
    }
  }, 1000 / SNAPSHOT_RATE);

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) { client.terminate(); continue; }
      client.isAlive = false;
      client.ping();
    }
  }, 30000);

  httpServer.on('close', () => { clearInterval(simTimer); clearInterval(castTimer); clearInterval(heartbeat); });
  return httpServer;
}
