import { Renderer } from './render.js';
import { InputTracker } from './input.js';
import { OfflineGame } from './offline.js';
import { SnapshotBuffer } from './interp.js';
import { openSocket } from './net.js';
import { Sfx } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const input = new InputTracker(canvas);
const $ = (id) => document.getElementById(id);

let mode = null;            // 'online' | 'offline'
let offlineGame = null;
let ws = null;              // 온라인 소켓
let standbyWs = null;       // 오프라인 중 재연결로 확보한 소켓
let myId = null;
let profile = null;         // { name, animal }
const buffer = new SnapshotBuffer(0.1);
let latestEvents = [];
const camera = { x: 1250, y: 1250 };
let sendTimer = 0;

const sfx = new Sfx();
const EMOJI = { cat: '🐱', dog: '🐶', pig: '🐷' };
const STAT_LABELS = { damage: '🥊 공격력', fireRate: '⚡ 연사', speed: '👟 이동속도', maxHp: '❤️ 최대체력' };
let pendingChoices = null;
let lastShotAt = 0;
let prevMyHp = null;
let prevMyDead = false;
let lbTimer = 0;

// ref.sock으로 어느 소켓의 close인지 구분한다 (활성 vs 대기 소켓)
function socketCallbacks(ref) {
  return {
    onWelcome: (msg) => { myId = msg.id; },
    onState: (msg) => { buffer.push(msg); latestEvents.push(...(msg.events ?? [])); },
    onChoices: (choices) => { handleChoices(choices); },
    onClose: () => {
      if (ref.sock && ref.sock === standbyWs) {
        standbyWs = null;
        $('online-btn').style.display = 'none';
        scheduleReconnect();
      } else if (mode === 'online' && ref.sock === ws) {
        startOffline();
      }
    },
  };
}

function handleChoices(choices) {
  pendingChoices = choices;
  const box = $('upgrade');
  box.innerHTML = '';
  choices.forEach((stat, i) => {
    const btn = document.createElement('button');
    btn.textContent = `${i + 1}. ${STAT_LABELS[stat]}`;
    btn.addEventListener('click', () => pickUpgrade(stat));
    box.appendChild(btn);
  });
  box.style.display = 'flex';
}

function pickUpgrade(stat) {
  if (!pendingChoices?.includes(stat)) return;
  pendingChoices = null;
  $('upgrade').style.display = 'none';
  chooseUpgrade(stat);
  sfx.levelup();
}

addEventListener('keydown', (e) => {
  if (!pendingChoices) return;
  const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
  if (i >= 0 && pendingChoices[i]) pickUpgrade(pendingChoices[i]);
});

function chooseUpgrade(stat) {
  if (mode === 'online') ws?.send(JSON.stringify({ t: 'upgrade', stat }));
  else offlineGame?.choose(stat);
}

async function startOnline(sock) {
  ws = sock;
  mode = 'online';
  offlineGame = null;
  buffer.buf = [];
  ws.send(JSON.stringify({ t: 'join', name: profile.name, animal: profile.animal }));
  $('mode-tag').textContent = '온라인';
  $('online-btn').style.display = 'none';
}

function startOffline() {
  mode = 'offline';
  ws = null;
  offlineGame = new OfflineGame(profile.name, profile.animal);
  myId = offlineGame.myId;
  $('mode-tag').textContent = '봇 모드 (서버 깨우는 중…)';
  scheduleReconnect();
}

function scheduleReconnect() {
  setTimeout(async () => {
    if (mode !== 'offline' || standbyWs) return;
    try {
      const ref = {};
      ref.sock = await openSocket(socketCallbacks(ref));
      standbyWs = ref.sock;
      $('mode-tag').textContent = '봇 모드 (온라인 가능!)';
      $('online-btn').style.display = 'block';
    } catch {
      scheduleReconnect();
    }
  }, 10000);
}

$('online-btn').addEventListener('click', () => {
  if (!standbyWs) return;
  const sock = standbyWs; standbyWs = null;
  startOnline(sock);
});

$('play').addEventListener('click', async () => {
  profile = {
    name: $('name').value.trim() || '나',
    animal: document.querySelector('input[name=animal]:checked').value,
  };
  $('menu').style.display = 'none';
  try {
    const ref = {};
    ref.sock = await openSocket(socketCallbacks(ref));
    startOnline(ref.sock);
  } catch {
    startOffline();
  }
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  let state = null;
  let inp = null;

  if (mode === 'offline' && offlineGame) {
    const meLive = offlineGame.world.players.get(myId);
    inp = input.sample(meLive, camera);
    const out = offlineGame.step(dt, inp);
    state = out.state;
    latestEvents.push(...out.events.filter((e) => e.t !== 'choices' || e.id !== myId));
    for (const e of out.events) if (e.t === 'choices' && e.id === myId) handleChoices(e.choices);
  } else if (mode === 'online') {
    state = buffer.sample();
    sendTimer -= dt;
    if (state) {
      const me = state.players.find((p) => p.id === myId);
      inp = input.sample(me, camera);
      if (ws?.readyState === WebSocket.OPEN && sendTimer <= 0) {
        ws.send(JSON.stringify({ t: 'input', ...inp }));
        sendTimer = 1 / 30;
      }
    }
  }

  if (state) {
    const me = state.players.find((p) => p.id === myId);
    if (me) {
      camera.x += (me.x - camera.x) * 0.1;
      camera.y += (me.y - camera.y) * 0.1;
      $('hud-hp-fill').style.width = `${Math.max(0, (100 * me.hp) / me.maxHp)}%`;
      $('hud-level').textContent = `Lv ${me.level} · ${me.score}점`;
      $('respawn').style.display = me.dead ? 'flex' : 'none';
    }

    // 리더보드 (0.25초 스로틀)
    lbTimer -= dt;
    if (lbTimer <= 0) {
      lbTimer = 0.25;
      const top = [...state.players].sort((a, b) => b.score - a.score).slice(0, 10);
      $('leaderboard').innerHTML = '<b>🏆 리더보드</b>' + top.map((p, i) =>
        `<div${p.id === myId ? ' style="font-weight:bold;color:#2c56c9"' : ''}>` +
        `${i + 1}. ${EMOJI[p.animal] ?? ''} ${escapeHtml(p.name)} — ${p.score}</div>`).join('');
    }

    // 킬 파티클 + 킬피드 + 효과음 (단일 루프, latestEvents 초기화는 루프 뒤 한 번만)
    for (const e of latestEvents) {
      if (e.t !== 'kill') continue;
      renderer.addKillBurst(e.x, e.y, e.victimAnimal);
      const row = document.createElement('div');
      row.textContent = e.killerName
        ? `${EMOJI[e.killerAnimal] ?? ''} ${e.killerName} ▶ ${EMOJI[e.victimAnimal] ?? ''} ${e.victimName}`
        : `${EMOJI[e.victimAnimal] ?? ''} ${e.victimName} 사망`;
      $('killfeed').prepend(row);
      setTimeout(() => row.remove(), 4000);
      if (e.killerId === myId) sfx.kill();
    }
    latestEvents = [];

    if (me) {
      if (prevMyHp != null && me.hp < prevMyHp) sfx.hit();
      if (me.dead && !prevMyDead) { sfx.death(); pendingChoices = null; $('upgrade').style.display = 'none'; }
      prevMyHp = me.hp; prevMyDead = me.dead;
    }

    if (inp?.fire && now / 1000 - lastShotAt > 0.15 && me && !me.dead) {
      lastShotAt = now / 1000;
      sfx.shoot();
    }

    renderer.draw(state, myId, camera, dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
