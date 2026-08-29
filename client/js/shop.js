// 프리미엄 동물(토끼·오리·여우) 해제 상태 관리 + 구매 요청.
// 해제 강제는 서버가 아니라 클라이언트 측(localStorage / Android PawBridge)에서 이루어진다 — v1 한계.

const STORAGE_KEY = 'pawpaw_premium';
const unlockListeners = [];

function debugForcedUnlock() {
  try {
    return new URLSearchParams(location.search).get('premium') === '1';
  } catch {
    return false;
  }
}

function hasStoredUnlock() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function bridgeSaysUnlocked() {
  try {
    return window.PawBridge?.isPremium?.() === true;
  } catch {
    return false;
  }
}

export function isPremiumUnlocked() {
  // ?premium=1 은 QA/디버그용 — localStorage에 기록하지 않는다.
  return debugForcedUnlock() || hasStoredUnlock() || bridgeSaysUnlocked();
}

export function unlockPremium() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  for (const cb of unlockListeners) {
    try { cb(); } catch {}
  }
}

export function onUnlock(cb) {
  if (typeof cb === 'function') unlockListeners.push(cb);
}

let modalEl = null;
function showFallbackModal() {
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'premium-fallback-modal';
    Object.assign(modalEl.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,.45)', zIndex: '50',
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#fff', borderRadius: '16px', padding: '24px 28px',
      maxWidth: '86vw', textAlign: 'center', fontSize: '16px', color: '#333',
      boxShadow: '0 8px 24px rgba(0,0,0,.25)',
    });
    const msg = document.createElement('p');
    msg.textContent = '프리미엄 동물은 모바일 앱에서 잠금 해제할 수 있어요! 🐾';
    msg.style.marginBottom = '18px';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '닫기';
    Object.assign(closeBtn.style, {
      fontSize: '15px', padding: '10px 28px', border: '0', borderRadius: '12px',
      background: '#6aa84f', color: '#fff', cursor: 'pointer',
    });
    closeBtn.addEventListener('click', () => { modalEl.style.display = 'none'; });
    box.appendChild(msg);
    box.appendChild(closeBtn);
    modalEl.appendChild(box);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) modalEl.style.display = 'none'; });
    document.body.appendChild(modalEl);
  }
  modalEl.style.display = 'flex';
}

export function requestPurchase() {
  const buy = window.PawBridge?.buyPremium;
  if (typeof buy === 'function') {
    try { buy.call(window.PawBridge); return; } catch {}
  }
  showFallbackModal();
}

// Android → JS 콜백: 구매/복원 성공 시 호출됨.
window.onPremiumUnlocked = () => unlockPremium();
