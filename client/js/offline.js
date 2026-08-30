import { World } from '../../shared/sim.js';
import { BotBrain } from '../../shared/bots.js';
import { pickBotName } from '../../shared/names.js';
import { ROOM_SIZE, ANIMALS, TICK_RATE } from '../../shared/constants.js';

export class OfflineGame {
  constructor(name, animal) {
    this.world = new World();
    this.me = this.world.addPlayer({ name, animal });
    this.brains = new Map();
    const kinds = Object.keys(ANIMALS);
    while (this.world.players.size < ROOM_SIZE) {
      const b = this.world.addPlayer({
        name: pickBotName(Math.random),
        animal: kinds[Math.floor(Math.random() * kinds.length)],
        isBot: true,
      });
      this.brains.set(b.id, new BotBrain(b.id, {}));
    }
    for (let i = 0; i < 75; i++) this.world.tick(1 / TICK_RATE); // 간식 미리 깔기
    this.world.drainEvents();
    this.acc = 0;
    // 고정 타임스텝 보간용: 직전/현재 틱 스냅샷을 보관해 렌더 시 그 사이를 보간한다.
    this.currSnap = this.world.snapshot();
    this.prevSnap = this.currSnap;
  }

  get myId() { return this.me.id; }

  // 30Hz 시뮬을 고정 스텝으로 돌리되, 남은 누적시간(alpha)만큼 직전↔현재 틱을 보간해
  // 60/120fps에서도 매 프레임 위치가 갱신되어 버벅임이 사라진다.
  step(dt, input) {
    this.world.setInput(this.me.id, input);
    this.acc += Math.min(dt, 0.25);
    const step = 1 / TICK_RATE;
    const events = [];
    while (this.acc >= step) {
      this.prevSnap = this.currSnap;
      for (const [id, brain] of this.brains) this.world.setInput(id, brain.update(this.world, step));
      this.world.tick(step);
      this.acc -= step;
      this.currSnap = this.world.snapshot();
      events.push(...this.world.drainEvents());
    }
    const alpha = Math.max(0, Math.min(1, this.acc / step));
    return { prev: this.prevSnap, curr: this.currSnap, alpha, events };
  }

  choose(stat) { this.world.chooseUpgrade(this.me.id, stat); }
}
