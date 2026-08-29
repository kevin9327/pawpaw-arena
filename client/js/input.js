import { TouchControls } from './touch.js';

export class InputTracker {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
    this.touch = new TouchControls(canvas);
    addEventListener('keydown', (e) => { this.keys.add(e.code); });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    canvas.addEventListener('mousedown', () => { this.mouse.down = true; });
    addEventListener('mouseup', () => { this.mouse.down = false; });
  }
  sample(me, camera) {
    const t = this.touch.sample();
    if (t.active) {
      // Compute aim from aimPoint using camera transform (same as mouse path)
      let aim = 0;
      if (t.aimPoint && me) {
        const wx = camera.x + (t.aimPoint.x - innerWidth / 2);
        const wy = camera.y + (t.aimPoint.y - innerHeight / 2);
        aim = Math.atan2(wy - me.y, wx - me.x);
      }
      return { move: t.move, aim, fire: t.fire };
    }
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
