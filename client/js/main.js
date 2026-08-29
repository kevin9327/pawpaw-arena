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
