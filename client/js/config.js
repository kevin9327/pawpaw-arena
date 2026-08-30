// 라이브 서버(Render Free, 2026-08-30 배포). 유휴 15분 시 슬립 → 첫 접속자는
// ~50초 봇 모드 후 "온라인 방 입장" 버튼으로 전환된다.
const PROD_WS = 'wss://pawpaw-arena.onrender.com';
export const SERVER_URL =
  ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `ws://${location.host}`
    : PROD_WS;
