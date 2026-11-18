/** One run of the boulevard: Rosie's movement, jumping, collisions and score. Pure TS. */
import { Spawner, CONTROLS, speedAt, type Obstacle } from './spawner';

export const JUMP_H = 1.15;
/** Forgiveness: shave this much player distance off each end of an obstacle's hit interval. */
const FORGIVE = 0.18;

export type RunEvent = 'jump' | 'lane' | 'crash' | 'tramWarn' | 'bike';

export class Run {
  d = 0;
  t = 0;
  lane = 1; // target lane
  lanePos = 1; // drawn/collision position
  jumpT = -1; // seconds into the jump, -1 = on the ground
  landedAt = -10; // run time of the last landing (for dust puffs)
  crashed = false;
  hit: Obstacle | null = null;
  spawner: Spawner;
  private warned = new Set<number>();
  private bells = new Set<number>();

  constructor(seed: number) {
    this.spawner = new Spawner(seed);
    this.spawner.ensure(200);
  }

  get speed() { return speedAt(this.d); }
  get score() { return Math.floor(this.d); }
  get jumpY() {
    if (this.jumpT < 0) return 0;
    const p = this.jumpT / CONTROLS.jumpTime;
    return JUMP_H * 4 * p * (1 - p);
  }
  get airborne() {
    if (this.jumpT < 0) return false;
    const p = this.jumpT / CONTROLS.jumpTime;
    return p > CONTROLS.airFrom && p < CONTROLS.airTo;
  }

  move(dir: -1 | 1): boolean {
    if (this.crashed) return false;
    const n = Math.max(0, Math.min(2, this.lane + dir));
    if (n === this.lane) return false;
    this.lane = n;
    return true;
  }
  jump(): boolean {
    if (this.crashed || this.jumpT >= 0) return false;
    this.jumpT = 0;
    return true;
  }

  /** Advance by dt seconds. Returns events for sound/feedback. */
  update(dt: number): RunEvent[] {
    const ev: RunEvent[] = [];
    if (this.crashed) return ev;
    this.t += dt;
    this.d += this.speed * dt;
    const step = dt / CONTROLS.laneChangeTime;
    if (Math.abs(this.lane - this.lanePos) <= step) this.lanePos = this.lane;
    else this.lanePos += Math.sign(this.lane - this.lanePos) * step;
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      if (this.jumpT >= CONTROLS.jumpTime) { this.jumpT = -1; this.landedAt = this.t; }
    }
    this.spawner.ensure(this.d + 220);
    this.spawner.prune(this.d);
    const myLane = Math.round(this.lanePos);
    for (const o of this.spawner.obstacles) {
      if (o.start > this.d + 200) break;
      if ((o.kind === 'tramIn' || o.kind === 'tramOut') && this.d >= o.warnFrom && !this.warned.has(o.id)) {
        this.warned.add(o.id);
        ev.push('tramWarn');
      }
      if (o.kind === 'bike' && o.start - this.d < 2.2 * this.speed && !this.bells.has(o.id)) {
        this.bells.add(o.id);
        ev.push('bike');
      }
      if (o.lane !== myLane) continue;
      const f = Math.min(FORGIVE, (o.end - o.start) * 0.3);
      if (this.d < o.start + f || this.d > o.end - f) continue;
      if (!o.tall && this.airborne) continue;
      this.crashed = true;
      this.hit = o;
      ev.push('crash');
      break;
    }
    return ev;
  }
}
