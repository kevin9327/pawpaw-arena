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
