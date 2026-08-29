# 멍냥아레나 (PawPaw Arena) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 귀여운 동물(고양이/강아지/돼지)들이 봇과 실제 유저 혼합으로 싸우는 2D .io 아레나 슈터 — 권위 서버 + 오프라인 봇 모드 하이브리드.

**Architecture:** `shared/`의 순수 ESM 시뮬 코어(월드·전투·성장·봇AI)를 Node 서버(30Hz 틱, 20Hz 브로드캐스트)와 브라우저 오프라인 모드가 그대로 공유한다. 클라이언트는 빌드 도구 없는 바닐라 JS + Canvas로, 입력만 서버에 보내고 스냅샷을 100ms 보간해 렌더한다.

**Tech Stack:** Node.js 18+ (ESM, `node --test`), 의존성은 `ws` 하나. 클라이언트 의존성 0.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-08-29-pawpaw-arena-design.md` (승인본)
- 아레나 2,500×2,500 / 방 정원 12(유저+봇) / 틱 30Hz / 스냅샷 20Hz / 보간 100ms
- 간식 목표 150개·개당 XP 5 / 킬 보상 = 상대 누적 XP의 30% / 사망 드랍 = 보유 XP 50% / 리스폰 3초
- 레벨 필요 XP `40 × 1.35^(레벨-1)` / 업그레이드 4종(damage·fireRate·speed·maxHp), 단계당 +15%, 최대 5단계
- 동물 스탯: cat(220속/80HP/8dmg/5발s/탄속500) · dog(190/100/14/3/450) · pig(160/140/24/1.5/400), 몸 반지름 22px+레벨당 최대 +8
- 봇 시야 700px / 도주 임계 HP 30% / 조준 오차 0.05~0.4rad
- npm 의존성은 `ws`만. 클라이언트에 어떤 프레임워크·빌드 단계도 추가 금지.
- 저장소 root에 `index.html` (GitHub Pages를 루트 배포로 쓰기 위함). 모든 커밋 메시지는 한글 + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Windows 개발 환경: 줄바꿈은 `.gitattributes`로 LF 강제.

## File Structure

```
petaflo-arena/
  index.html                # 진입 페이지(메뉴 + canvas + UI 오버레이) — root에 두어 Pages 루트 배포
  .gitattributes            # * text=auto eol=lf
  .gitignore                # node_modules
  package.json              # type:module, ws, test/start 스크립트
  render.yaml               # Render 무료 웹서비스 정의
  shared/
    constants.js            # 모든 튜닝 수치(아레나·동물·XP·봇) — 유일한 밸런스 소스
    names.js                # 봇 닉네임 풀 + pickBotName(rng)
    sim.js                  # World 클래스: 플레이어·탄·간식·성장·이벤트, tick(dt)
    bots.js                 # BotBrain 클래스: world를 읽고 input을 산출하는 상태기계
  server/
    index.js                # http 정적 서빙(repo root) + ws 방(Room) + 틱/브로드캐스트 루프
  client/js/
    config.js               # SERVER_URL 결정(localhost ↔ 배포 주소)
    input.js                # 키보드/마우스 → {move, aim, fire}
    interp.js               # SnapshotBuffer: 100ms 지연 보간
    render.js               # Canvas 렌더(잔디·동물·탄·간식·파티클·플래시)
    audio.js                # WebAudio 합성 효과음 4종
    offline.js              # OfflineGame: shared 시뮬 + BotBrain 11마리를 브라우저에서 구동
    net.js                  # NetGame: ws 연결·welcome·state 수신·입력 송신
    main.js                 # 메뉴/모드 전환(하이브리드)/게임루프/UI(리더보드·킬피드·업글·리스폰)
  test/
    sim.test.js             # World 유닛테스트
    bots.test.js            # BotBrain 유닛테스트
    server.test.js          # ws 통합테스트(에페메랄 포트)
  docs/superpowers/{specs,plans}/
```

**인터페이스 요약(전 태스크 공통):**
- `new World(rng)` / `world.addPlayer({name, animal, isBot}) → player` / `world.removePlayer(id)` / `world.setInput(id, {move:[x,y], aim, fire})` / `world.chooseUpgrade(id, stat)` / `world.tick(dt)` / `world.snapshot() → {tick, players:[], bullets:[], pellets:[]}` / `world.drainEvents() → [{t:'kill'|'levelup', ...}]` / `world.statOf(p, stat)` / `world.radiusOf(p)`
- `new BotBrain(playerId, {rng, aimError, reactDelay})` / `brain.update(world, dt) → {move, aim, fire}`
- ws 프로토콜(JSON): C→S `{t:'join', name, animal}` `{t:'input', move, aim, fire}` `{t:'upgrade', stat}` · S→C `{t:'welcome', id, arena:{w,h}}` `{t:'state', tick, players, bullets, pellets, events}` `{t:'choices', choices:['damage',...]}`(해당 소켓에만)

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `.gitignore`, `.gitattributes`

**Interfaces:**
- Produces: ESM 프로젝트(`"type":"module"`), `npm test` = `node --test test/`, `npm start` = `node server/index.js`

- [ ] **Step 1: 파일 3개 작성**

`package.json`:
```json
{
  "name": "pawpaw-arena",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

`.gitignore`:
```
node_modules/
```

`.gitattributes`:
```
* text=auto eol=lf
```

- [ ] **Step 2: 의존성 설치 확인**

Run: `npm install` (repo root에서)
Expected: `added 1 package` 류 출력, `node_modules/ws` 존재

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .gitignore .gitattributes
git commit -m "프로젝트 스캐폴드: ESM + ws 의존성"
```

---

### Task 2: shared 상수·이름 풀 + World 이동

**Files:**
- Create: `shared/constants.js`, `shared/names.js`, `shared/sim.js`
- Test: `test/sim.test.js`

**Interfaces:**
- Produces: 위 "인터페이스 요약"의 `World` 중 생성/입력/이동/스냅샷 부분과 `constants.js`의 모든 export, `pickBotName(rng)`, `mulberry32(seed)` (테스트용 시드 rng, `shared/constants.js`에서 export)

- [ ] **Step 1: 실패하는 테스트 작성** — `test/sim.test.js`

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module ... shared/sim.js`

- [ ] **Step 3: 구현**

`shared/constants.js`:
```js
export const ARENA = { w: 2500, h: 2500 };
export const TICK_RATE = 30;
export const SNAPSHOT_RATE = 20;
export const ROOM_SIZE = 12;
export const PELLET_TARGET = 150;
export const PELLET_XP = 5;
export const KILL_XP_RATIO = 0.3;
export const DEATH_DROP_RATIO = 0.5;
export const RESPAWN_DELAY = 3;
export const BASE_RADIUS = 22;
export const MAX_EXTRA_RADIUS = 8;
export const BULLET_TTL = 1.2;
export const BOT_VIEW = 700;
export const BOT_FLEE_HP = 0.3;
export const UPGRADE_STEP = 0.15;
export const UPGRADE_MAX = 5;
export const STATS = ['damage', 'fireRate', 'speed', 'maxHp'];
export const ANIMALS = {
  cat: { speed: 220, maxHp: 80,  damage: 8,  fireRate: 5,   bulletSpeed: 500, bulletRadius: 6 },
  dog: { speed: 190, maxHp: 100, damage: 14, fireRate: 3,   bulletSpeed: 450, bulletRadius: 8 },
  pig: { speed: 160, maxHp: 140, damage: 24, fireRate: 1.5, bulletSpeed: 400, bulletRadius: 11 },
};
export const xpForLevel = (lvl) => Math.round(40 * Math.pow(1.35, lvl - 1));

// 테스트/봇용 결정적 rng
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`shared/names.js`:
```js
const NAMES = ['초코', '마루', '꿀꿀이', '나비', '보리', '콩이', '두부', '모찌', '까미', '해피',
  'Mochi', 'Biscuit', 'Waffle', 'Peanut', 'Nugget', 'Pudding', 'Choco', 'Bean', 'Tofu', 'Latte'];
export function pickBotName(rng) {
  return NAMES[Math.floor(rng() * NAMES.length)];
}
```

`shared/sim.js` (이 태스크 범위 — 이동·스냅샷까지. fire/pellet 처리 지점은 주석 훅으로 남긴다):
```js
import { ARENA, ANIMALS, BASE_RADIUS, MAX_EXTRA_RADIUS, UPGRADE_STEP } from './constants.js';

export class World {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.players = new Map();
    this.bullets = [];
    this.pellets = new Map();
    this.events = [];
    this.nextId = 1;
    this.tickCount = 0;
  }

  addPlayer({ name, animal, isBot = false }) {
    const id = this.nextId++;
    const p = {
      id, name, animal, isBot,
      x: 100 + this.rng() * (ARENA.w - 200),
      y: 100 + this.rng() * (ARENA.h - 200),
      vx: 0, vy: 0, aim: 0,
      hp: ANIMALS[animal].maxHp, level: 1, xp: 0, score: 0,
      upgrades: { damage: 0, fireRate: 0, speed: 0, maxHp: 0 },
      choices: null, fireCooldown: 0, respawnTimer: 0, dead: false,
      input: { move: [0, 0], aim: 0, fire: false },
    };
    this.players.set(id, p);
    return p;
  }

  removePlayer(id) { this.players.delete(id); }

  setInput(id, input) {
    const p = this.players.get(id);
    if (!p) return;
    const [mx, my] = input.move ?? [0, 0];
    const len = Math.hypot(mx, my);
    p.input = {
      move: len > 1e-9 ? [mx / len, my / len] : [0, 0],
      aim: Number(input.aim) || 0,
      fire: !!input.fire,
    };
  }

  statOf(p, stat) {
    return ANIMALS[p.animal][stat] * (1 + UPGRADE_STEP * p.upgrades[stat]);
  }

  radiusOf(p) {
    return BASE_RADIUS + Math.min(MAX_EXTRA_RADIUS, (p.level - 1) * 1.5);
  }

  maxHpOf(p) { return this.statOf(p, 'maxHp'); }

  tick(dt) {
    this.tickCount++;
    for (const p of this.players.values()) {
      if (p.dead) { this._tickRespawn(p, dt); continue; }
      const speed = this.statOf(p, 'speed');
      p.vx = p.input.move[0] * speed;
      p.vy = p.input.move[1] * speed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const r = this.radiusOf(p);
      p.x = Math.min(ARENA.w - r, Math.max(r, p.x));
      p.y = Math.min(ARENA.h - r, Math.max(r, p.y));
      p.aim = p.input.aim;
      this._tickFire(p, dt);   // Task 3
    }
    this._tickBullets(dt);     // Task 3
    this._tickPellets(dt);     // Task 4
  }

  _tickRespawn() {} // Task 3에서 구현
  _tickFire() {}    // Task 3에서 구현
  _tickBullets() {} // Task 3에서 구현
  _tickPellets() {} // Task 4에서 구현

  snapshot() {
    return {
      tick: this.tickCount,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, animal: p.animal,
        x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
        aim: Math.round(p.aim * 100) / 100,
        hp: Math.round(p.hp), maxHp: Math.round(this.maxHpOf(p)),
        level: p.level, score: p.score, dead: p.dead,
      })),
      bullets: this.bullets.map((b) => ({ id: b.id, animal: b.animal, x: Math.round(b.x), y: Math.round(b.y), r: b.radius })),
      pellets: [...this.pellets.values()].map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y), xp: f.xp })),
    };
  }

  drainEvents() { const ev = this.events; this.events = []; return ev; }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/ test/sim.test.js
git commit -m "shared 시뮬 코어: 상수·이름 풀·World 이동/스냅샷"
```

---

### Task 3: World 전투 — 발사·탄·데미지·사망·리스폰

**Files:**
- Modify: `shared/sim.js` (Task 2의 `_tickFire`/`_tickBullets`/`_tickRespawn` 빈 메서드 교체 + `addPlayer`에 `lifeXp` 추가 + `_kill`/`_spawnPellet`/`_gainXp` 신설)
- Test: `test/sim.test.js` (추가)

**Interfaces:**
- Consumes: Task 2의 `World` 골격, `constants.js`
- Produces: `world._gainXp(p, amount)`(Task 4가 레벨업 로직으로 확장), `world._spawnPellet(x, y, xp)`, kill 이벤트 `{t:'kill', killerId, killerName, killerAnimal, victimId, victimName, victimAnimal, x, y}`

- [ ] **Step 1: 실패하는 테스트 추가** — `test/sim.test.js` 하단에

```js
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
  const dropped = [...w.pellets.values()].reduce((s, f) => s + f.xp, 0);
  assert.equal(dropped, 50);   // 100 * 0.5
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
  w.setInput(p.id, { move: [0, 0], aim: 0, fire: true });
  w.tick(1 / 30);
  const hp0 = p.hp;
  for (let i = 0; i < 30; i++) w.tick(1 / 30);
  assert.equal(p.hp, hp0);
});
```

주의: Task 3 시점에는 `_tickPellets`가 아직 빈 메서드라 간식 자연 스폰이 없어 드랍 검증이 정확히 50이 된다.

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: 새 테스트 3개 FAIL (탄 미생성 / dead 아님)

- [ ] **Step 3: 구현** — `shared/sim.js`

import 줄을 다음으로 교체:
```js
import { ARENA, ANIMALS, BASE_RADIUS, MAX_EXTRA_RADIUS, UPGRADE_STEP, BULLET_TTL,
  RESPAWN_DELAY, DEATH_DROP_RATIO, KILL_XP_RATIO } from './constants.js';
```

`addPlayer`의 `hp: ANIMALS[animal].maxHp,` 뒤에 `lifeXp: 0,` 추가.

빈 메서드들을 다음으로 교체(`_tickPellets`는 Task 4까지 빈 채 유지):
```js
  _tickRespawn(p, dt) {
    p.respawnTimer -= dt;
    if (p.respawnTimer > 0) return;
    p.dead = false;
    p.level = 1; p.xp = 0; p.lifeXp = 0;
    p.upgrades = { damage: 0, fireRate: 0, speed: 0, maxHp: 0 };
    p.choices = null; p.fireCooldown = 0;
    p.hp = this.maxHpOf(p);
    p.x = 100 + this.rng() * (ARENA.w - 200);
    p.y = 100 + this.rng() * (ARENA.h - 200);
  }

  _tickFire(p, dt) {
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (!p.input.fire || p.fireCooldown > 0) return;
    const a = ANIMALS[p.animal];
    const r = this.radiusOf(p);
    this.bullets.push({
      id: this.nextId++, owner: p.id, animal: p.animal,
      x: p.x + Math.cos(p.aim) * (r + a.bulletRadius + 2),
      y: p.y + Math.sin(p.aim) * (r + a.bulletRadius + 2),
      vx: Math.cos(p.aim) * a.bulletSpeed, vy: Math.sin(p.aim) * a.bulletSpeed,
      damage: this.statOf(p, 'damage'), radius: a.bulletRadius, ttl: BULLET_TTL,
    });
    p.fireCooldown = 1 / this.statOf(p, 'fireRate');
  }

  _tickBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.ttl -= dt;
      if (b.ttl <= 0) continue;
      if (b.x < 0 || b.x > ARENA.w || b.y < 0 || b.y > ARENA.h) { b.ttl = 0; continue; }
      for (const p of this.players.values()) {
        if (p.dead || p.id === b.owner) continue;
        const rr = this.radiusOf(p) + b.radius;
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= rr * rr) {
          p.hp -= b.damage; b.ttl = 0;
          if (p.hp <= 0) this._kill(p, this.players.get(b.owner));
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.ttl > 0);
  }

  _kill(victim, killer) {
    victim.dead = true;
    victim.respawnTimer = RESPAWN_DELAY;
    let remain = Math.floor(victim.lifeXp * DEATH_DROP_RATIO);
    while (remain > 0) {
      const chunk = Math.min(10, remain); remain -= chunk;
      this._spawnPellet(victim.x + (this.rng() - 0.5) * 120,
                        victim.y + (this.rng() - 0.5) * 120, chunk);
    }
    if (killer && !killer.dead) this._gainXp(killer, Math.floor(victim.lifeXp * KILL_XP_RATIO));
    this.events.push({
      t: 'kill', killerId: killer?.id ?? null,
      killerName: killer?.name ?? '', killerAnimal: killer?.animal ?? '',
      victimId: victim.id, victimName: victim.name, victimAnimal: victim.animal,
      x: Math.round(victim.x), y: Math.round(victim.y),
    });
  }

  _spawnPellet(x, y, xp) {
    const id = this.nextId++;
    this.pellets.set(id, {
      id,
      x: Math.min(ARENA.w - 10, Math.max(10, x)),
      y: Math.min(ARENA.h - 10, Math.max(10, y)),
      xp,
    });
  }

  // Task 4에서 레벨업 로직으로 확장된다 — 지금은 점수 적립만
  _gainXp(p, amount) {
    p.xp += amount; p.lifeXp += amount; p.score += amount;
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (전체 6 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/sim.js test/sim.test.js
git commit -m "World 전투: 발사·탄 충돌·사망 드랍·킬 보상·리스폰"
```

---

### Task 4: World 성장 — 간식·XP·레벨업·업그레이드

**Files:**
- Modify: `shared/sim.js` (`_tickPellets` 구현, `_gainXp` 레벨업 확장, `_offerChoices`/`chooseUpgrade` 신설)
- Test: `test/sim.test.js` (추가)

**Interfaces:**
- Consumes: Task 3의 `_gainXp`/`_spawnPellet`
- Produces: `world.chooseUpgrade(id, stat) → boolean`, 유저 레벨업 이벤트 `{t:'choices', id, choices:[stat×3]}` (봇은 자동 선택), 틱당 최대 2개 간식 트리클 스폰(목표 150)

- [ ] **Step 1: 실패하는 테스트 추가** — `test/sim.test.js`

기존 import 아래에 추가:
```js
import { PELLET_XP, UPGRADE_STEP } from '../shared/constants.js';
```

하단에 테스트 추가:
```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: 새 테스트 3개 FAIL (pellets 0개 / level 1 유지)

- [ ] **Step 3: 구현** — `shared/sim.js`

import 줄에 성장 관련 상수 추가:
```js
import { ARENA, ANIMALS, BASE_RADIUS, MAX_EXTRA_RADIUS, UPGRADE_STEP, BULLET_TTL,
  RESPAWN_DELAY, DEATH_DROP_RATIO, KILL_XP_RATIO,
  PELLET_TARGET, PELLET_XP, UPGRADE_MAX, STATS, xpForLevel } from './constants.js';
```

`_tickPellets() {}` 교체 + `_gainXp` 확장 + 신규 메서드 2개:
```js
  _tickPellets() {
    const deficit = PELLET_TARGET - this.pellets.size;
    for (let i = 0; i < Math.min(2, deficit); i++) {
      this._spawnPellet(20 + this.rng() * (ARENA.w - 40),
                        20 + this.rng() * (ARENA.h - 40), PELLET_XP);
    }
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const r = this.radiusOf(p) + 6;
      for (const f of this.pellets.values()) {
        if ((p.x - f.x) ** 2 + (p.y - f.y) ** 2 <= r * r) {
          this.pellets.delete(f.id);
          this._gainXp(p, f.xp);
        }
      }
    }
  }

  _gainXp(p, amount) {
    p.xp += amount; p.lifeXp += amount; p.score += amount;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      this._offerChoices(p);
    }
  }

  _offerChoices(p) {
    const avail = STATS.filter((s) => p.upgrades[s] < UPGRADE_MAX);
    if (!avail.length) { p.choices = null; return; }
    const shuffled = [...avail].sort(() => this.rng() - 0.5);
    p.choices = shuffled.slice(0, Math.min(3, shuffled.length));
    if (p.isBot) {
      this.chooseUpgrade(p.id, p.choices[Math.floor(this.rng() * p.choices.length)]);
    } else {
      this.events.push({ t: 'choices', id: p.id, choices: p.choices });
    }
  }

  chooseUpgrade(id, stat) {
    const p = this.players.get(id);
    if (!p || !p.choices || !p.choices.includes(stat)) return false;
    const hpFrac = p.hp / this.maxHpOf(p);
    p.upgrades[stat] = Math.min(UPGRADE_MAX, p.upgrades[stat] + 1);
    p.choices = null;
    if (stat === 'maxHp') p.hp = hpFrac * this.maxHpOf(p);
    return true;
  }
```

알려진 단순화(v1 의도): 연속 레벨업 시 choices는 마지막 레벨 것 하나만 유지된다.

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (전체 9 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/sim.js test/sim.test.js
git commit -m "World 성장: 간식 스폰/섭취·레벨업·3택1 업그레이드"
```

---

### Task 5: BotBrain — 봇 상태기계

**Files:**
- Create: `shared/bots.js`
- Test: `test/bots.test.js`

**Interfaces:**
- Consumes: `World`(Task 2~4), `constants.js`의 `BOT_VIEW`, `BOT_FLEE_HP`, `ANIMALS`
- Produces: `new BotBrain(playerId, {rng, aimError, reactDelay})` / `brain.update(world, dt) → {move:[x,y], aim, fire}` — move는 비정규 벡터여도 됨(`setInput`이 정규화)

- [ ] **Step 1: 실패하는 테스트 작성** — `test/bots.test.js`

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module ... shared/bots.js`

- [ ] **Step 3: 구현** — `shared/bots.js`

```js
import { BOT_VIEW, BOT_FLEE_HP, ANIMALS } from './constants.js';

export class BotBrain {
  constructor(playerId, { rng = Math.random, aimError = null, reactDelay = null } = {}) {
    this.playerId = playerId;
    this.rng = rng;
    this.aimError = aimError ?? 0.05 + rng() * 0.35;   // 스펙: 0.05~0.4rad
    this.reactDelay = reactDelay ?? 0.1 + rng() * 0.4;
    this.sinceSeen = Infinity;
    this.strafeDir = rng() < 0.5 ? 1 : -1;
    this.strafeTimer = 0;
    this.wanderAngle = rng() * Math.PI * 2;
  }

  update(world, dt) {
    const me = world.players.get(this.playerId);
    if (!me || me.dead) return { move: [0, 0], aim: 0, fire: false };
    const enemy = this._nearestEnemy(world, me);
    if (!enemy) { this.sinceSeen = Infinity; return this._wander(world, me, dt); }
    if (this.sinceSeen === Infinity) this.sinceSeen = 0;
    this.sinceSeen += dt;

    const dist = Math.hypot(enemy.x - me.x, enemy.y - me.y) || 1;
    const t = dist / ANIMALS[me.animal].bulletSpeed;      // 예측 조준
    const px = enemy.x + (enemy.vx ?? 0) * t;
    const py = enemy.y + (enemy.vy ?? 0) * t;
    const aim = Math.atan2(py - me.y, px - me.x) + (this.rng() - 0.5) * 2 * this.aimError;
    const fire = this.sinceSeen >= this.reactDelay;

    let move;
    if (me.hp < BOT_FLEE_HP * world.maxHpOf(me)) {
      move = [me.x - enemy.x, me.y - enemy.y];            // 도주
    } else {
      this.strafeTimer -= dt;                             // 지그재그 + 거리 유지(250~350px)
      if (this.strafeTimer <= 0) { this.strafeDir *= -1; this.strafeTimer = 0.5 + this.rng(); }
      const toward = dist > 350 ? 1 : dist < 250 ? -1 : 0;
      const dx = (enemy.x - me.x) / dist, dy = (enemy.y - me.y) / dist;
      move = [dx * toward - dy * this.strafeDir, dy * toward + dx * this.strafeDir];
    }
    return { move, aim, fire };
  }

  _nearestEnemy(world, me) {
    let best = null, bestD = BOT_VIEW ** 2;
    for (const p of world.players.values()) {
      if (p.id === me.id || p.dead) continue;
      const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  _wander(world, me, dt) {
    let best = null, bestD = Infinity;
    for (const f of world.pellets.values()) {
      const d = (f.x - me.x) ** 2 + (f.y - me.y) ** 2;
      if (d < bestD) { bestD = d; best = f; }
    }
    if (best) return { move: [best.x - me.x, best.y - me.y], aim: me.aim, fire: false };
    this.wanderAngle += (this.rng() - 0.5) * dt * 2;
    return { move: [Math.cos(this.wanderAngle), Math.sin(this.wanderAngle)], aim: me.aim, fire: false };
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (전체 12 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/bots.js test/bots.test.js
git commit -m "BotBrain: 배회/교전(예측조준·지그재그)/도주 상태기계"
```

---

### Task 6: 서버 — ws 방·틱 루프·정적 서빙

**Files:**
- Create: `server/app.js` (테스트 가능한 `createServer()`), `server/index.js` (진입점)
- Test: `test/server.test.js`

**Interfaces:**
- Consumes: `World`, `BotBrain`, `pickBotName`, constants
- Produces: `createServer() → http.Server`(listen은 호출자 몫, close 시 타이머 정리). ws 프로토콜은 파일 구조 절의 "인터페이스 요약"과 동일. `PORT` env 지원(기본 8080). repo root 기준 정적 서빙(`/` → `/index.html`, 경로 탈출 차단)

- [ ] **Step 1: 실패하는 테스트 작성** — `test/server.test.js`

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module ... server/app.js`

- [ ] **Step 3: 구현**

`server/app.js`:
```js
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
```

`server/index.js`:
```js
import { createServer } from './app.js';

const PORT = Number(process.env.PORT ?? 8080);
createServer().listen(PORT, () => {
  console.log(`멍냥아레나 서버: http://localhost:${PORT}`);
});
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (전체 14 tests). 테스트가 몇 초 내에 끝나야 함(타이머 정리 확인).

- [ ] **Step 5: Commit**

```bash
git add server/ test/server.test.js
git commit -m "서버: ws 방·봇 충원·30Hz 틱·20Hz 브로드캐스트·정적 서빙"
```

---

### Task 7: 클라이언트 뼈대 — 오프라인 모드로 플레이 가능하게

**Files:**
- Create: `index.html`, `client/js/config.js`, `client/js/input.js`, `client/js/render.js`, `client/js/offline.js`, `client/js/main.js`

**Interfaces:**
- Consumes: `World`/`BotBrain`/`pickBotName`/constants (브라우저 ESM으로 `./shared/*.js` 직접 import)
- Produces: `new Renderer(canvas)` / `renderer.draw(state, myId, camera)` / `renderer.addKillBurst(x, y, animal)` · `new InputTracker(canvas)` / `input.sample(me, camera) → {move, aim, fire}` · `new OfflineGame(name, animal)` / `game.step(dt, input) → {state, events}` / `game.choose(stat)` / `game.myId` · HTML 요소 id: `game, menu, name, play, hud-hp, hud-hp-fill, hud-level, hud-score, leaderboard, killfeed, upgrade, respawn, online-btn`

- [ ] **Step 1: `index.html` 작성** (repo root)

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>멍냥아레나</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; overflow: hidden; font-family: 'Segoe UI', sans-serif; }
  #game { display: block; background: #d7ecc8; }
  .overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  #menu { background: rgba(215, 236, 200, .95); flex-direction: column; gap: 18px; z-index: 10; }
  #menu h1 { font-size: 44px; color: #4a6b3a; }
  #menu input { font-size: 18px; padding: 10px 14px; border: 2px solid #9fc487; border-radius: 12px; width: 240px; text-align: center; }
  .animals { display: flex; gap: 12px; }
  .animals label { cursor: pointer; background: #fff; border: 3px solid transparent; border-radius: 16px; padding: 12px 18px; font-size: 34px; text-align: center; }
  .animals label small { display: block; font-size: 13px; color: #666; }
  .animals input { display: none; }
  .animals input:checked + span { outline: 3px solid #6aa84f; outline-offset: 6px; border-radius: 12px; }
  #play { font-size: 20px; padding: 12px 44px; border: 0; border-radius: 14px; background: #6aa84f; color: #fff; cursor: pointer; }
  #hud { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); width: 320px; text-align: center; z-index: 5; }
  #hud-hp { height: 14px; background: rgba(0,0,0,.25); border-radius: 7px; overflow: hidden; }
  #hud-hp-fill { height: 100%; width: 100%; background: #6fce6f; transition: width .15s; }
  #hud-level { color: #333; font-size: 14px; margin-top: 4px; text-shadow: 0 1px 0 #fff; }
  #leaderboard { position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,.75); border-radius: 12px; padding: 10px 14px; font-size: 13px; min-width: 170px; z-index: 5; }
  #killfeed { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); text-align: center; font-size: 14px; color: #444; z-index: 5; }
  #killfeed div { background: rgba(255,255,255,.7); border-radius: 8px; padding: 2px 10px; margin-bottom: 4px; }
  #upgrade { position: absolute; left: 50%; bottom: 70px; transform: translateX(-50%); display: none; gap: 10px; z-index: 6; }
  #upgrade button { font-size: 15px; padding: 10px 16px; border: 0; border-radius: 12px; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.2); cursor: pointer; }
  #respawn { display: none; background: rgba(0,0,0,.35); color: #fff; font-size: 28px; z-index: 8; }
  #online-btn { position: absolute; top: 12px; left: 12px; display: none; font-size: 14px; padding: 8px 14px; border: 0; border-radius: 10px; background: #4e5ae8; color: #fff; cursor: pointer; z-index: 6; }
  #mode-tag { position: absolute; bottom: 8px; left: 12px; font-size: 12px; color: #6a6a6a; z-index: 5; }
</style>
</head>
<body>
<canvas id="game"></canvas>
<div id="hud">
  <div id="hud-hp"><div id="hud-hp-fill"></div></div>
  <div id="hud-level">Lv 1 · 0점</div>
</div>
<div id="leaderboard"></div>
<div id="killfeed"></div>
<div id="upgrade"></div>
<button id="online-btn">온라인 방 입장</button>
<div id="mode-tag"></div>
<div id="respawn" class="overlay">잡아먹혔다! 곧 부활…</div>
<div id="menu" class="overlay">
  <h1>🐾 멍냥아레나</h1>
  <input id="name" maxlength="12" placeholder="닉네임">
  <div class="animals">
    <label><input type="radio" name="animal" value="cat" checked><span>🐱<small>빠름·물렁</small></span></label>
    <label><input type="radio" name="animal" value="dog"><span>🐶<small>밸런스</small></span></label>
    <label><input type="radio" name="animal" value="pig"><span>🐷<small>느림·탱크</small></span></label>
  </div>
  <button id="play">싸우러 가기</button>
  <div style="font-size:13px;color:#557">이동 WASD · 조준/발사 마우스</div>
</div>
<script type="module" src="client/js/main.js"></script>
</body>
</html>
```

(메뉴의 이모지는 입장 화면에서만 쓰고, 인게임 동물은 Canvas 벡터로 그린다 — 스펙 준수.)

- [ ] **Step 2: `client/js/config.js` 작성**

```js
// Task 10에서 Render 서비스가 생기면 PROD_WS를 실제 주소로 교체한다.
const PROD_WS = 'wss://pawpaw-arena.onrender.com';
export const SERVER_URL =
  ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `ws://${location.host}`
    : PROD_WS;
```

- [ ] **Step 3: `client/js/input.js` 작성**

```js
export class InputTracker {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
    addEventListener('keydown', (e) => { this.keys.add(e.code); });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    canvas.addEventListener('mousedown', () => { this.mouse.down = true; });
    addEventListener('mouseup', () => { this.mouse.down = false; });
  }
  sample(me, camera) {
    let mx = 0, my = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    const wx = camera.x + (this.mouse.x - innerWidth / 2);
    const wy = camera.y + (this.mouse.y - innerHeight / 2);
    const aim = me ? Math.atan2(wy - me.y, wx - me.x) : 0;
    return { move: [mx, my], aim, fire: this.mouse.down || this.keys.has('Space') };
  }
}
```

- [ ] **Step 4: `client/js/render.js` 작성**

```js
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
```

(`arc(..., 0, 7)`의 7은 2π보다 큰 값으로 완전한 원을 뜻한다.)

- [ ] **Step 5: `client/js/offline.js` 작성**

```js
import { World } from '../../shared/sim.js';
import { BotBrain } from '../../shared/bots.js';
import { pickBotName } from '../../shared/names.js';
import { ROOM_SIZE, ANIMALS, TICK_RATE } from '../../shared/constants.js';

export class OfflineGame {
  constructor(name, animal) {
    this.world = new World();
    this.me = this.world.addPlayer({ name, animal });
    this.brains = new Map();
    const kinds = Object.keys(ANIMALS);
    while (this.world.players.size < ROOM_SIZE) {
      const b = this.world.addPlayer({
        name: pickBotName(Math.random),
        animal: kinds[Math.floor(Math.random() * kinds.length)],
        isBot: true,
      });
      this.brains.set(b.id, new BotBrain(b.id, {}));
    }
    for (let i = 0; i < 75; i++) this.world.tick(1 / TICK_RATE); // 간식 미리 깔기
    this.world.drainEvents();
    this.acc = 0;
  }

  get myId() { return this.me.id; }

  step(dt, input) {
    this.world.setInput(this.me.id, input);
    this.acc += Math.min(dt, 0.25);
    const step = 1 / TICK_RATE;
    while (this.acc >= step) {
      for (const [id, brain] of this.brains) this.world.setInput(id, brain.update(this.world, step));
      this.world.tick(step);
      this.acc -= step;
    }
    return { state: this.world.snapshot(), events: this.world.drainEvents() };
  }

  choose(stat) { this.world.chooseUpgrade(this.me.id, stat); }
}
```

- [ ] **Step 6: `client/js/main.js` 작성** (Task 7 버전 — 오프라인 전용, 온라인 배선은 Task 8에서 교체)

```js
import { Renderer } from './render.js';
import { InputTracker } from './input.js';
import { OfflineGame } from './offline.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const input = new InputTracker(canvas);
const $ = (id) => document.getElementById(id);

let game = null;
let myId = null;
const camera = { x: 1250, y: 1250 };

$('play').addEventListener('click', () => {
  const name = $('name').value.trim() || '나';
  const animal = document.querySelector('input[name=animal]:checked').value;
  game = new OfflineGame(name, animal);
  myId = game.myId;
  $('menu').style.display = 'none';
  $('mode-tag').textContent = '봇 모드';
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game) {
    const meLive = game.world.players.get(myId);
    const inp = input.sample(meLive, camera);
    const { state, events } = game.step(dt, inp);
    for (const e of events) {
      if (e.t === 'choices' && e.id === myId) game.choose(e.choices[0]); // Task 9에서 UI로 교체
      if (e.t === 'kill') renderer.addKillBurst(e.x, e.y, e.victimAnimal);
    }
    const me = state.players.find((p) => p.id === myId);
    if (me) {
      camera.x += (me.x - camera.x) * 0.1;
      camera.y += (me.y - camera.y) * 0.1;
      $('hud-hp-fill').style.width = `${Math.max(0, (100 * me.hp) / me.maxHp)}%`;
      $('hud-level').textContent = `Lv ${me.level} · ${me.score}점`;
      $('respawn').style.display = me.dead ? 'flex' : 'none';
    }
    renderer.draw(state, myId, camera, dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 7: 수동 검증 (오프라인 모드)**

Run: `npm start` 후 브라우저에서 `http://localhost:8080` 열기
확인 체크리스트:
- 메뉴에서 동물 선택 → 입장 → 봇 11마리와 한 방
- WASD 이동, 마우스 조준·클릭 발사, 탄 모양이 동물별로 다름
- 봇이 간식을 먹으러 다니고, 다가가면 나를 쏘고, 체력 낮으면 도망감
- 봇을 잡으면 파티클 + 간식 드랍, 내가 죽으면 "잡아먹혔다!" 후 부활
- 체력바·레벨·점수 HUD 갱신

- [ ] **Step 8: Commit**

```bash
git add index.html client/
git commit -m "클라이언트 뼈대: Canvas 렌더러·입력·오프라인 봇 모드"
```

---

### Task 8: 온라인 모드 — 넷코드·보간·하이브리드 전환

**Files:**
- Create: `client/js/interp.js`, `client/js/net.js`
- Modify: `client/js/main.js` (하이브리드 배선)

**Interfaces:**
- Consumes: Task 6 서버 프로토콜, Task 7의 Renderer/InputTracker/OfflineGame, `config.js`의 `SERVER_URL`
- Produces: `new SnapshotBuffer(0.1)` / `buf.push(stateMsg)` / `buf.sample() → state|null` · `openSocket({onState, onChoices, onWelcome, onClose, timeout}) → Promise<WebSocket>`(연결 실패/타임아웃 시 reject)

- [ ] **Step 1: `client/js/interp.js` 작성**

```js
export class SnapshotBuffer {
  constructor(delay = 0.1) { this.delay = delay; this.buf = []; }

  push(snap) {
    this.buf.push({ at: performance.now() / 1000, snap });
    if (this.buf.length > 40) this.buf.shift();
  }

  sample() {
    if (!this.buf.length) return null;
    const target = performance.now() / 1000 - this.delay;
    let a = this.buf[0], b = this.buf[this.buf.length - 1];
    for (let i = 0; i < this.buf.length - 1; i++) {
      if (this.buf[i].at <= target && this.buf[i + 1].at >= target) {
        a = this.buf[i]; b = this.buf[i + 1]; break;
      }
    }
    const span = b.at - a.at;
    const t = span > 0 ? Math.min(1, Math.max(0, (target - a.at) / span)) : 1;
    return lerpState(a.snap, b.snap, t);
  }
}

function lerpState(s1, s2, t) {
  const lerp = (x, y) => x + (y - x) * t;
  const prev = new Map(s1.players.map((p) => [p.id, p]));
  return {
    ...s2,
    players: s2.players.map((p) => {
      const o = prev.get(p.id);
      if (!o || o.dead || p.dead) return p;
      let da = p.aim - o.aim;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      return { ...p, x: lerp(o.x, p.x), y: lerp(o.y, p.y), aim: o.aim + da * t };
    }),
    bullets: s2.bullets.map((b) => {
      const o = s1.bullets.find((q) => q.id === b.id);
      return o ? { ...b, x: lerp(o.x, b.x), y: lerp(o.y, b.y) } : b;
    }),
  };
}
```

- [ ] **Step 2: `client/js/net.js` 작성**

```js
import { SERVER_URL } from './config.js';

export function openSocket({ timeout = 3000, onState, onChoices, onWelcome, onClose }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(SERVER_URL);
    const timer = setTimeout(() => {
      if (!settled) { settled = true; ws.close(); reject(new Error('timeout')); }
    }, timeout);
    ws.addEventListener('open', () => {
      if (!settled) { settled = true; clearTimeout(timer); resolve(ws); }
    });
    ws.addEventListener('error', () => {
      if (!settled) { settled = true; clearTimeout(timer); reject(new Error('connect error')); }
    });
    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'state') onState(msg);
      else if (msg.t === 'welcome') onWelcome(msg);
      else if (msg.t === 'choices') onChoices(msg.choices);
    });
    ws.addEventListener('close', () => onClose?.());
  });
}
```

- [ ] **Step 3: `client/js/main.js`를 하이브리드 버전으로 교체**

```js
import { Renderer } from './render.js';
import { InputTracker } from './input.js';
import { OfflineGame } from './offline.js';
import { SnapshotBuffer } from './interp.js';
import { openSocket } from './net.js';

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
  // Task 9에서 UI로 교체 — 지금은 첫 항목 자동 선택
  chooseUpgrade(choices[0]);
}

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

  if (mode === 'offline' && offlineGame) {
    const meLive = offlineGame.world.players.get(myId);
    const inp = input.sample(meLive, camera);
    const out = offlineGame.step(dt, inp);
    state = out.state;
    latestEvents.push(...out.events.filter((e) => e.t !== 'choices' || e.id !== myId));
    for (const e of out.events) if (e.t === 'choices' && e.id === myId) handleChoices(e.choices);
  } else if (mode === 'online') {
    state = buffer.sample();
    sendTimer -= dt;
    if (state && ws?.readyState === WebSocket.OPEN && sendTimer <= 0) {
      const me = state.players.find((p) => p.id === myId);
      ws.send(JSON.stringify({ t: 'input', ...input.sample(me, camera) }));
      sendTimer = 1 / 30;
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
    for (const e of latestEvents) {
      if (e.t === 'kill') renderer.addKillBurst(e.x, e.y, e.victimAnimal);
    }
    latestEvents = [];
    renderer.draw(state, myId, camera, dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

주의: 대기 소켓(`standbyWs`)이 끊겼을 때 `startOffline()`을 다시 부르면 진행 중인 오프라인 게임이 리셋된다 — 위 `socketCallbacks(ref)`의 분기가 그 방지책이므로 그대로 구현할 것.

- [ ] **Step 4: 수동 검증 (온라인 + 하이브리드)**

1. `npm start` → 브라우저 탭 2개에서 `http://localhost:8080` 접속, 서로 다른 닉네임으로 입장
   - 두 탭 모두 mode-tag "온라인", 서로가 보이고 쏘면 체력이 깎임
   - 한 탭에서 죽인 킬 파티클이 다른 탭에도 보임
   - 이동이 20Hz 스냅샷임에도 뚝뚝 끊기지 않음(보간 동작)
2. 서버 프로세스 종료 → 탭이 자동으로 봇 모드 전환(mode-tag "봇 모드 (서버 깨우는 중…)")
3. 서버 재시작 → 10초 내 "온라인 가능!" + 버튼 표시 → 클릭 시 온라인 방 재입장

- [ ] **Step 5: Commit**

```bash
git add client/js/
git commit -m "온라인 모드: 스냅샷 보간·입력 송신·하이브리드 전환"
```

---

### Task 9: UI 완성 — 리더보드·킬피드·업그레이드 선택·효과음

**Files:**
- Create: `client/js/audio.js`
- Modify: `client/js/main.js` (자동 업그레이드 제거 → 3버튼 UI, 리더보드·킬피드·효과음 배선)

**Interfaces:**
- Consumes: Task 8의 main.js, HTML 요소 `leaderboard, killfeed, upgrade`
- Produces: `new Sfx()` / `sfx.shoot() .hit() .kill() .levelup() .death()`

- [ ] **Step 1: `client/js/audio.js` 작성**

```js
export class Sfx {
  constructor() { this.ctx = null; }
  _ac() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  _blip(f0, f1, dur, type = 'square', gain = 0.06) {
    try {
      const ac = this._ac();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), ac.currentTime + dur);
      g.gain.setValueAtTime(gain, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.connect(g).connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + dur);
    } catch { /* 오디오 불가 환경 무시 */ }
  }
  shoot() { this._blip(600, 220, 0.07); }
  hit() { this._blip(180, 120, 0.1, 'triangle', 0.1); }
  kill() { this._blip(300, 900, 0.22, 'square', 0.08); }
  levelup() { this._blip(440, 880, 0.25, 'sine', 0.09); }
  death() { this._blip(400, 60, 0.5, 'sawtooth', 0.1); }
}
```

- [ ] **Step 2: `client/js/main.js`에 UI 배선 추가**

상단 import에 추가:
```js
import { Sfx } from './audio.js';
```

모듈 상단 상태 근처에 추가:
```js
const sfx = new Sfx();
const EMOJI = { cat: '🐱', dog: '🐶', pig: '🐷' };
const STAT_LABELS = { damage: '🥊 공격력', fireRate: '⚡ 연사', speed: '👟 이동속도', maxHp: '❤️ 최대체력' };
let pendingChoices = null;
let lastShotAt = 0;
let prevMyHp = null;
let prevMyDead = false;
let lbTimer = 0;
```

`handleChoices`를 자동 선택에서 UI로 교체:
```js
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
```

`frame()` 안에서 `if (state) { ... }` 블록에 다음을 추가(HUD 갱신 뒤):
```js
    // 리더보드 (0.25초 스로틀)
    lbTimer -= dt;
    if (lbTimer <= 0) {
      lbTimer = 0.25;
      const top = [...state.players].sort((a, b) => b.score - a.score).slice(0, 10);
      $('leaderboard').innerHTML = '<b>🏆 리더보드</b>' + top.map((p, i) =>
        `<div${p.id === myId ? ' style="font-weight:bold;color:#2c56c9"' : ''}>` +
        `${i + 1}. ${EMOJI[p.animal] ?? ''} ${escapeHtml(p.name)} — ${p.score}</div>`).join('');
    }

    // 킬피드 + 효과음
    for (const e of latestEvents) {
      if (e.t !== 'kill') continue;
      const row = document.createElement('div');
      row.textContent = e.killerName
        ? `${EMOJI[e.killerAnimal] ?? ''} ${e.killerName} ▶ ${EMOJI[e.victimAnimal] ?? ''} ${e.victimName}`
        : `${EMOJI[e.victimAnimal] ?? ''} ${e.victimName} 사망`;
      $('killfeed').prepend(row);
      setTimeout(() => row.remove(), 4000);
      if (e.killerId === myId) sfx.kill();
    }

    if (me) {
      if (prevMyHp != null && me.hp < prevMyHp) sfx.hit();
      if (me.dead && !prevMyDead) { sfx.death(); pendingChoices = null; $('upgrade').style.display = 'none'; }
      prevMyHp = me.hp; prevMyDead = me.dead;
    }
```

킬 파티클 처리(`for (const e of latestEvents) ... addKillBurst`)는 위 킬피드 루프와 합쳐 한 루프로 정리한다. `latestEvents = [];` 초기화는 루프 뒤 한 번만.

발사음: `frame()`에서 입력을 샘플한 직후(온·오프라인 공통 경로)에 추가:
```js
    const inp = /* 이미 샘플한 입력 */;
    if (inp?.fire && now / 1000 - lastShotAt > 0.15 && me && !me.dead) {
      lastShotAt = now / 1000;
      sfx.shoot();
    }
```
(연사 속도와 무관한 150ms 간격 근사음 — v1 의도적 단순화.)

XSS 방지 유틸(파일 하단):
```js
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```
킬피드는 `textContent`라 이스케이프 불필요, 리더보드만 innerHTML이므로 `escapeHtml` 필수.

- [ ] **Step 3: 수동 검증**

- 봇을 잡아 레벨업 → 하단에 버튼 3개, 클릭/숫자키 1~3으로 선택, 스탯 체감(연사 등)
- 리더보드 실시간 정렬, 내 이름 파란 볼드
- 킬 발생 시 킬피드 4초 표시, 내가 킬하면 상승음
- 발사/피격/사망/레벨업 효과음 재생 (첫 클릭 후 AudioContext 활성화)
- 닉네임에 `<b>x</b>` 입력해도 리더보드에 태그가 그대로 문자로 보임

- [ ] **Step 4: Commit**

```bash
git add client/js/audio.js client/js/main.js
git commit -m "UI 완성: 업그레이드 3택 UI·리더보드·킬피드·합성 효과음"
```

---

### Task 10: 배포 준비 — README·render.yaml·GitHub 공개

**Files:**
- Create: `README.md`, `render.yaml`
- Modify: `client/js/config.js` (Render 주소 확정 후)

**Interfaces:**
- Consumes: 완성된 전체 앱
- Produces: 공개 GitHub 저장소 + GitHub Pages(클라) + Render 배포 절차

- [ ] **Step 1: `render.yaml` 작성**

```yaml
services:
  - type: web
    name: pawpaw-arena
    runtime: node
    plan: free
    buildCommand: npm install
    startCommand: node server/index.js
```

- [ ] **Step 2: `README.md` 작성**

```markdown
# 🐾 멍냥아레나 (PawPaw Arena)

귀여운 동물들이 싸우는 2D .io 아레나 슈터. 접속자끼리 싸우고 빈 자리는 봇이 채웁니다.
서버가 없어도 봇 모드로 즉시 플레이됩니다.

## 조작

- 이동: WASD / 방향키 · 조준·발사: 마우스 · 업그레이드: 클릭 또는 1~3

## 로컬 실행

```
npm install
npm start        # http://localhost:8080
npm test         # 시뮬·봇·서버 테스트
```

## 구조

- `shared/` 시뮬 코어(물리·전투·성장·봇AI) — 서버와 브라우저가 공유
- `server/` Node + ws 권위 서버 (30Hz 틱 / 20Hz 스냅샷)
- `client/` 바닐라 JS + Canvas (빌드 도구 없음)

## 배포

- 클라이언트: GitHub Pages (repo root)
- 서버: Render 무료 웹서비스 (`render.yaml`) — 배포 후 `client/js/config.js`의
  `PROD_WS`를 실제 서비스 주소로 교체
```

- [ ] **Step 3: 로컬 최종 확인 후 커밋**

Run: `npm test` → 전체 PASS 확인, `npm start` → 브라우저 스모크 1회
```bash
git add README.md render.yaml
git commit -m "배포 준비: README·render.yaml"
```

- [ ] **Step 4: GitHub 공개 (⚠️ 사용자 확인 게이트)**

공개 저장소 생성·푸시는 외부 공개 행위다. **실행 전 사용자에게 저장소 이름과 공개 여부를 확인받는다.** 승인 후:
```bash
gh repo create pawpaw-arena --public --source . --push
gh api repos/kevin9327/pawpaw-arena/pages -X POST -f "source[branch]=master" -f "source[path]=/"
```
Expected: Pages URL `https://kevin9327.github.io/pawpaw-arena/` 발급(빌드 1~2분).
확인: Pages URL 접속 → 메뉴 표시 → 입장 시 (서버 아직 없으므로) 3초 후 봇 모드 시작.

- [ ] **Step 5: Render 서비스 생성 (사용자 직접) + 주소 반영**

사용자가 할 일: render.com 가입/로그인 → New Web Service → GitHub 저장소 `pawpaw-arena` 연결(render.yaml 자동 인식, Free 플랜) → 발급된 `https://<서비스명>.onrender.com` 주소 전달.
이후 작업자: `client/js/config.js`의 `PROD_WS`를 `wss://<서비스명>.onrender.com`으로 교체 → 커밋·푸시 → Pages 재배포 후 접속해 mode-tag "온라인" 확인, 두 기기/브라우저로 상호 전투 확인.

- [ ] **Step 6: 최종 커밋**

```bash
git add client/js/config.js
git commit -m "배포: Render 서버 주소 반영"
git push
```

---

## 최종 수동 QA 체크리스트 (전 태스크 완료 후)

1. `npm test` 전체 PASS (14 tests)
2. 로컬: 2탭 온라인 전투 + 서버 킬 → 봇 모드 폴백 + 재연결 버튼 → 온라인 복귀
3. Pages(프로덕션): 첫 로드 즉시 봇 모드 또는 온라인 입장, Render 콜드스타트 중에도 플레이 가능
4. 밸런스 스모크: 각 동물로 1판씩 — 고양이가 돼지를 카이팅으로 이길 수 있고, 돼지가 근접 정면전에서 이기는지(안 되면 `shared/constants.js` 수치만 조정)

