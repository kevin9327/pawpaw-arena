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
    ws.addEventListener('close', () => (onClose != null ? onClose() : undefined));
  });
}
