// 최소 i18n: 브라우저 언어가 ko면 한국어, 아니면 영어. 값은 [ko, en] 쌍.
// 구형 WebView(Chrome 53) 호환을 위해 옵셔널 체이닝/널 병합은 쓰지 않는다.
const lang = (typeof navigator !== 'undefined' && navigator.language) ? String(navigator.language).toLowerCase() : 'ko';
export const isKo = lang.indexOf('ko') === 0;

const T = {
  title: ['멍냥아레나', 'PawPaw Arena'],
  nick: ['닉네임', 'Nickname'],
  cat: ['빠름·물렁', 'Fast · Squishy'],
  dog: ['밸런스', 'Balanced'],
  pig: ['느림·탱크', 'Slow · Tank'],
  rabbit: ['매우빠름·유리몸', 'Very fast · Fragile'],
  duck: ['밸런스+', 'Balanced+'],
  fox: ['한방·중거리', 'Burst · Mid-range'],
  play: ['싸우러 가기', 'Fight!'],
  controls: ['이동 WASD · 조준/발사 마우스', 'Move WASD · Aim & fire with mouse'],
  online: ['온라인 방 입장', 'Join online room'],
  respawn: ['잡아먹혔다! 곧 부활…', 'Eaten! Respawning…'],
  modeOnline: ['온라인', 'Online'],
  modeWaking: ['봇 모드 (서버 깨우는 중…)', 'Bot mode (waking server…)'],
  modeReady: ['봇 모드 (온라인 가능!)', 'Bot mode (online ready!)'],
  me: ['나', 'Me'],
  leaderboard: ['리더보드', 'Leaderboard'],
  died: ['사망', 'died'],
  premiumWeb: ['프리미엄 동물은 모바일 앱에서 잠금 해제할 수 있어요! 🐾', 'Premium animals can be unlocked in the mobile app! 🐾'],
  close: ['닫기', 'Close'],
  statDamage: ['🥊 공격력', '🥊 Damage'],
  statFireRate: ['⚡ 연사', '⚡ Fire rate'],
  statSpeed: ['👟 이동속도', '👟 Speed'],
  statMaxHp: ['❤️ 최대체력', '❤️ Max HP'],
};

export function t(key) {
  const v = T[key];
  if (!v) return key;
  return v[isKo ? 0 : 1];
}

export function hud(level, score) {
  return isKo ? ('Lv ' + level + ' · ' + score + '점') : ('Lv ' + level + ' · ' + score + ' pts');
}

// data-i18n / data-i18n-ph 속성이 붙은 요소의 텍스트·placeholder를 현재 언어로 교체
export function applyDom() {
  const els = document.querySelectorAll('[data-i18n]');
  for (let i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-i18n'));
  const phs = document.querySelectorAll('[data-i18n-ph]');
  for (let i = 0; i < phs.length; i++) phs[i].setAttribute('placeholder', t(phs[i].getAttribute('data-i18n-ph')));
  document.title = t('title');
}
