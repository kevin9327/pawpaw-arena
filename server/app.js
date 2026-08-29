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
      if (!file.startsWith(normalize(ROOT + sep)) && file !== normalize(ROOT)) {
        res.writeHead(403); return res.end();
      }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });

  const world = new World();
  const brains = new Map();   // botId → BotBrain
  const clients = new Map();  // ws → playerId

  function fillBots() {
    while (world.players.size < ROOM_SIZE) {
      const animals = Object.keys(ANIMALS);
      const p = world.addPlayer({
        name: pickBotName(Math.random),
        animal: animals[Math.floor(Math.random() * animals.length)],
        isBot: true,
      });
      brains.set(p.id, new BotBrain(p.id, {}));
    }
    let excess = world.players.size - ROOM_SIZE;
    for (const [id] of brains) {
      if (excess <= 0) break;
      brains.delete(id); world.removePlayer(id); excess--;
    }
  }

  const wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      const pid = clients.get(ws);
      if (msg.t === 'join' && pid == null) {
        const animal = ANIMALS[msg.animal] ? msg.animal : 'dog';
        const name = String(msg.name ?? '').slice(0, 12).trim() || '익명동물';
        const p = world.addPlayer({ name, animal });
        clients.set(ws, p.id);
        fillBots();
        ws.send(JSON.stringify({ t: 'welcome', id: p.id, arena: ARENA }));
      } else if (msg.t === 'input' && pid != null) {
        world.setInput(pid, msg);
      } else if (msg.t === 'upgrade' && pid != null) {
        world.chooseUpgrade(pid, msg.stat);
      }
    });
    ws.on('close', () => {
      const pid = clients.get(ws);
      if (pid != null) world.removePlayer(pid);
      clients.delete(ws);
      fillBots();
    });
  });

  fillBots();

  const simTimer = setInterval(() => {
    const dt = 1 / TICK_RATE;
    for (const [id, brain] of brains) world.setInput(id, brain.update(world, dt));
    world.tick(dt);
  }, 1000 / TICK_RATE);

  const castTimer = setInterval(() => {
    const events = world.drainEvents();
    const pub = events.filter((e) => e.t !== 'choices');
    const snap = world.snapshot();
    const stateMsg = JSON.stringify({ t: 'state', ...snap, events: pub });
    for (const [ws, pid] of clients) {
      if (ws.readyState !== ws.OPEN) continue;
      ws.send(stateMsg);
      for (const e of events) {
        if (e.t === 'choices' && e.id === pid) {
          ws.send(JSON.stringify({ t: 'choices', choices: e.choices }));
        }
      }
    }
  }, 1000 / SNAPSHOT_RATE);

  httpServer.on('close', () => { clearInterval(simTimer); clearInterval(castTimer); });
  return httpServer;
}
