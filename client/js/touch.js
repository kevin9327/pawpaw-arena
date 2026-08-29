// Left-half virtual joystick (dynamic origin) + right-half aim/fire touch controls.
// Designed to be owned by InputTracker (input.js) and merged into sample() there;
// main.js needs no changes.

const BASE_D = 120;   // outer ring diameter (px)
const KNOB_D = 50;    // inner knob diameter (px)
const MAX_RADIUS = 60; // joystick drag clamp radius (px)

export class TouchControls {
  constructor(canvas) {
    this.canvas = canvas;

    this.leftId = null;
    this.rightId = null;
    this.leftOrigin = { x: 0, y: 0 };
    this.leftPos = { x: 0, y: 0 };

    this.move = [0, 0];
    this.aim = 0;
    this.fire = false;
    this.aimPoint = null;  // raw client coords for camera-corrected aim calculation

    // Sticky flag: once a real touch happens, touch controls take priority
    // over keyboard/mouse for the rest of the session (mobile device).
    this.usingTouch = false;

    this.baseEl = document.createElement('div');
    this.baseEl.id = 'touch-joy-base';
    this.knobEl = document.createElement('div');
    this.knobEl.id = 'touch-joy-knob';
    document.body.appendChild(this.baseEl);
    document.body.appendChild(this.knobEl);

    // Only attach to the canvas so DOM overlay buttons (menu, upgrade, online-btn)
    // keep receiving their own pointer/click events untouched.
    canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    canvas.addEventListener('pointermove', (e) => this._onMove(e));
    canvas.addEventListener('pointerup', (e) => this._onUp(e));
    canvas.addEventListener('pointercancel', (e) => this._onUp(e));
  }

  _onDown(e) {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    this.usingTouch = true;

    const isLeftHalf = e.clientX < innerWidth / 2;
    if (isLeftHalf) {
      if (this.leftId !== null) return; // extra finger on the left: ignore
      this.leftId = e.pointerId;
      this.leftOrigin = { x: e.clientX, y: e.clientY };
      this.leftPos = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      this._showJoystick();
      this._updateJoystick();
    } else {
      if (this.rightId !== null) return; // extra finger on the right: ignore
      this.rightId = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      this._updateAim(e.clientX, e.clientY);
      this.fire = true;
    }
  }

  _onMove(e) {
    if (e.pointerType === 'touch') e.preventDefault();
    if (e.pointerId === this.leftId) {
      this.leftPos = { x: e.clientX, y: e.clientY };
      this._updateJoystick();
    } else if (e.pointerId === this.rightId) {
      this._updateAim(e.clientX, e.clientY);
    }
  }

  _onUp(e) {
    if (e.pointerId === this.leftId) {
      this.leftId = null;
      this.move = [0, 0];
      this._hideJoystick();
    } else if (e.pointerId === this.rightId) {
      this.rightId = null;
      this.fire = false; // aim intentionally keeps its last value
    }
  }

  _updateJoystick() {
    const dx = this.leftPos.x - this.leftOrigin.x;
    const dy = this.leftPos.y - this.leftOrigin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, MAX_RADIUS);
    const ux = dist > 1e-9 ? dx / dist : 0;
    const uy = dist > 1e-9 ? dy / dist : 0;
    this.move = dist > 1e-9 ? [ux * (clamped / MAX_RADIUS), uy * (clamped / MAX_RADIUS)] : [0, 0];

    const knobX = this.leftOrigin.x + ux * clamped;
    const knobY = this.leftOrigin.y + uy * clamped;
    this.knobEl.style.transform = `translate(${knobX - KNOB_D / 2}px, ${knobY - KNOB_D / 2}px)`;
  }

  _updateAim(x, y) {
    // Store raw client coords; aim will be computed in input.js using camera transform
    this.aimPoint = { x, y };
  }

  _showJoystick() {
    this.baseEl.style.transform = `translate(${this.leftOrigin.x - BASE_D / 2}px, ${this.leftOrigin.y - BASE_D / 2}px)`;
    this.knobEl.style.transform = `translate(${this.leftOrigin.x - KNOB_D / 2}px, ${this.leftOrigin.y - KNOB_D / 2}px)`;
    this.baseEl.classList.add('tc-visible');
    this.knobEl.classList.add('tc-visible');
  }

  _hideJoystick() {
    this.baseEl.classList.remove('tc-visible');
    this.knobEl.classList.remove('tc-visible');
  }

  sample() {
    return { move: this.move, aimPoint: this.aimPoint, fire: this.fire, active: this.usingTouch };
  }
}
