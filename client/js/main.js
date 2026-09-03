import { Renderer } from './render.js';
import { InputTracker } from './input.js';
import { OfflineGame } from './offline.js';
import { SnapshotBuffer, lerpState } from './interp.js';
import { openSocket } from './net.js';
import { Sfx } from './audio.js';
import { isPremiumUnlocked, requestPurchase, onUnlock } from './shop.js';
import { PREMIUM_ANIMALS } from '../../shared/constants.js';
import { t, hud, applyDom } from './i18n.js';

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
const EMOJI = { cat: '🐱', dog: '🐶', pig: '🐷', rabbit: '🐰', duck: '🦆', fox: '🦊' };
const STAT_LABELS = { damage: t('statDamage'), fireRate: t('statFireRate'), speed: t('statSpeed'), maxHp: t('statMaxHp') };
let pendingChoices = null;
let lastShotAt = 0;
let prevMyHp = null;
let prevMyDead = false;
let lbTimer = 0;
let lastPellets = [];   // 온라인: 간식 5Hz 전송분을 프레임 사이에 유지

// ref.sock으로 어느 소켓의 close인지 구분한다 (활성 vs 대기 소켓)
function socketCallbacks(ref) {
  return {
    onWelcome: (msg) => { myId = msg.id; },
    onState: (msg) => {
      // 서버가 대역폭 절감을 위해 간식을 5Hz로만 보냄 — 없는 프레임은 직전 간식을 유지
      if (msg.pellets != null) lastPellets = msg.pellets;
      else msg.pellets = lastPellets;
      buffer.push(msg);
      latestEvents.push(...(msg.events != null ? msg.events : []));
    },
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
  if (!(pendingChoices != null && pendingChoices.includes(stat))) return;
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
  if (mode === 'online') { if (ws != null) ws.send(JSON.stringify({ t: 'upgrade', stat })); }
  else { if (offlineGame != null) offlineGame.choose(stat); }
}

async function startOnline(sock) {
  ws = sock;
  mode = 'online';
  offlineGame = null;
  buffer.buf = [];
  lastPellets = [];
  ws.send(JSON.stringify({ t: 'join', name: profile.name, animal: profile.animal }));
  $('mode-tag').textContent = t('modeOnline');
  $('online-btn').style.display = 'none';
}

function startOffline() {
  mode = 'offline';
  ws = null;
  offlineGame = new OfflineGame(profile.name, profile.animal);
  myId = offlineGame.myId;
  $('mode-tag').textContent = t('modeWaking');
  scheduleReconnect();
}

function scheduleReconnect() {
  setTimeout(async () => {
    if (mode !== 'offline' || standbyWs) return;
    try {
      const ref = {};
      ref.sock = await openSocket(socketCallbacks(ref));
      standbyWs = ref.sock;
      $('mode-tag').textContent = t('modeReady');
      $('online-btn').style.display = 'block';
    } catch {
      scheduleReconnect();
    }
  }, 10000);
}

// 프리미엄 동물 잠금 표시: 초기 렌더 + 해제 이벤트 시 갱신, 잠긴 카드 클릭은 선택 대신 구매 유도
function refreshAnimalLocks() {
  const unlocked = isPremiumUnlocked();
  document.querySelectorAll('.animals label[data-animal]').forEach((label) => {
    const locked = PREMIUM_ANIMALS.includes(label.dataset.animal) && !unlocked;
    label.classList.toggle('locked', locked);
  });
}
document.querySelectorAll('.animals label[data-animal]').forEach((label) => {
  label.addEventListener('click', (e) => {
    if (label.classList.contains('locked')) {
      e.preventDefault();
      requestPurchase();
    }
  });
});
applyDom();
onUnlock(refreshAnimalLocks);
refreshAnimalLocks();

$('online-btn').addEventListener('click', () => {
  if (!standbyWs) return;
  const sock = standbyWs; standbyWs = null;
  startOnline(sock);
});

$('play').addEventListener('click', async () => {
  const chosen = document.querySelector('input[name=animal]:checked').value;
  // 제출 시점 페이월 재확인 — 클릭 시점 잠금(라벨 리스너)이 어떤 이유로든 우회돼도 여기서 차단
  if (PREMIUM_ANIMALS.includes(chosen) && !isPremiumUnlocked()) {
    requestPurchase();
    return;
  }
  profile = {
    name: $('name').value.trim() || t('me'),
    animal: chosen,
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
    state = lerpState(out.prev, out.curr, out.alpha); // 틱 사이 보간 → 부드러운 렌더
    latestEvents.push(...out.events.filter((e) => e.t !== 'choices' || e.id !== myId));
    for (const e of out.events) if (e.t === 'choices' && e.id === myId) handleChoices(e.choices);
  } else if (mode === 'online') {
    state = buffer.sample();
    sendTimer -= dt;
    if (state) {
      const me = state.players.find((p) => p.id === myId);
      inp = input.sample(me, camera);
      if ((ws != null ? ws.readyState : undefined) === WebSocket.OPEN && sendTimer <= 0) {
        ws.send(JSON.stringify({ t: 'input', ...inp }));
        sendTimer = 1 / 30;
      }
    }
  }

  if (state) {
    const me = state.players.find((p) => p.id === myId);
    if (me) {
      const camK = Math.min(1, dt * 10); // 프레임레이트 독립 카메라 추종
      camera.x += (me.x - camera.x) * camK;
      camera.y += (me.y - camera.y) * camK;
      $('hud-hp-fill').style.width = `${Math.max(0, (100 * me.hp) / me.maxHp)}%`;
      $('hud-level').textContent = hud(me.level, me.score);
      $('respawn').style.display = me.dead ? 'flex' : 'none';
    }

    // 리더보드 (0.25초 스로틀)
    lbTimer -= dt;
    if (lbTimer <= 0) {
      lbTimer = 0.25;
      const top = [...state.players].sort((a, b) => b.score - a.score).slice(0, 10);
      $('leaderboard').innerHTML = '<b>🏆 ' + t('leaderboard') + '</b>' + top.map((p, i) =>
        `<div${p.id === myId ? ' style="font-weight:bold;color:#2c56c9"' : ''}>` +
        `${i + 1}. ${EMOJI[p.animal] != null ? EMOJI[p.animal] : ''} ${escapeHtml(p.name)} — ${p.score}</div>`).join('');
    }

    // 킬 파티클 + 킬피드 + 효과음 (단일 루프, latestEvents 초기화는 루프 뒤 한 번만)
    for (const e of latestEvents) {
      if (e.t !== 'kill') continue;
      renderer.addKillBurst(e.x, e.y, e.victimAnimal);
      const row = document.createElement('div');
      row.textContent = e.killerName
        ? `${EMOJI[e.killerAnimal] != null ? EMOJI[e.killerAnimal] : ''} ${e.killerName} ▶ ${EMOJI[e.victimAnimal] != null ? EMOJI[e.victimAnimal] : ''} ${e.victimName}`
        : `${EMOJI[e.victimAnimal] != null ? EMOJI[e.victimAnimal] : ''} ${e.victimName} ${t('died')}`;
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

    if ((inp != null && inp.fire) && now / 1000 - lastShotAt > 0.15 && me && !me.dead) {
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
