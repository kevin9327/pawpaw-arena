// Task 10에서 Render 서비스가 생기면 PROD_WS를 실제 주소로 교체한다.
const PROD_WS = 'wss://pawpaw-arena.onrender.com';
export const SERVER_URL =
  ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `ws://${location.host}`
    : PROD_WS;
