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
  }

  get myId() { return this.me.id; }

  step(dt, input) {
    this.world.setInput(this.me.id, input);
    this.acc += Math.min(dt, 0.25);
    const step = 1 / TICK_RATE;
    while (this.acc >= step) {
      for (const [id, brain] of this.brains) this.world.setInput(id, brain.update(this.world, step));
      this.world.tick(step);
      this.acc -= step;
    }
    return { state: this.world.snapshot(), events: this.world.drainEvents() };
  }

  choose(stat) { this.world.chooseUpgrade(this.me.id, stat); }
}
