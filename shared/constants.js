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
  // 프리미엄 (premium_animals IAP로 일괄 해제, 사이드그레이드 밸런스)
  rabbit: { speed: 240, maxHp: 70, damage: 7,  fireRate: 6,   bulletSpeed: 520, bulletRadius: 5 },
  duck:   { speed: 200, maxHp: 95, damage: 12, fireRate: 3.5, bulletSpeed: 450, bulletRadius: 7 },
  fox:    { speed: 205, maxHp: 90, damage: 16, fireRate: 2.5, bulletSpeed: 480, bulletRadius: 8 },
};
export const FREE_ANIMALS = ['cat', 'dog', 'pig'];
export const PREMIUM_ANIMALS = ['rabbit', 'duck', 'fox'];
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
