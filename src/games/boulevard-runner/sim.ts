/** One run of the boulevard: Rosie's movement, jumping, tram roofs, collisions and score. Pure TS. */
import { Spawner, CONTROLS, speedAt, alongObstacle, JUMP_H, MOUNT_Y, ROOF_H, RAMP_LEN, type Obstacle } from './spawner';

export { JUMP_H, ROOF_H };
/** Forgiveness: shave this much player distance off each end of an obstacle's hit interval. */
const FORGIVE = 0.18;
/** Gravity and launch speed chosen so a jump on flat ground matches CONTROLS.jumpTime / JUMP_H. */
const GRAV = (8 * JUMP_H) / (CONTROLS.jumpTime * CONTROLS.jumpTime);
const JUMP_V = (4 * JUMP_H) / CONTROLS.jumpTime;
/** Speed Rosie scrambles up onto a roof she reached mid-jump (units/s). */
const CLIMB_V = 16;

export type RunEvent = 'jump' | 'lane' | 'crash' | 'tramWarn' | 'bike' | 'land' | 'mount';

export class Run {
  d = 0;
  t = 0;
  lane = 1; // target lane
  lanePos = 1; // drawn/collision position
  /** Height of Rosie's feet above the street, and vertical speed. */
  y = 0;
  vy = 0;
  /** Height of whatever she stands on (street, ramp or roof). */
  base = 0;
  /** The tram whose roof she is on. */
  roof: Obstacle | null = null;
  /** Leaping across the bike path from one tram roof to the other. */
  leaping = false;
  landedAt = -10; // run time of the last landing (for dust and squash)
  jumpedAt = -10;
  crashed = false;
  hit: Obstacle | null = null;
  spawner: Spawner;
  private warned = new Set<number>();
  private bells = new Set<number>();
  private grounded = true;

  constructor(seed: number) {
    this.spawner = new Spawner(seed);
    this.spawner.ensure(200);
  }

  get speed() { return speedAt(this.d); }
  get score() { return Math.floor(this.d); }
  /** Height above whatever she is standing on (for the jump animation). */
  get jumpY() { return Math.max(0, this.y - this.base); }
  get onRoof() { return this.roof !== null; }

  /** The tram in `lane` overlapping Rosie's spot right now, if any. */
  tramAt(lane: number, d = this.d): Obstacle | null {
    for (const o of this.spawner.obstacles) {
      if (o.start > d + 1) break;
      if (o.tram && o.lane === lane && d >= o.start && d <= o.end) return o;
    }
    return null;
  }

  move(dir: -1 | 1): boolean {
    if (this.crashed) return false;
    let n = Math.max(0, Math.min(2, this.lane + dir));
    if (n === this.lane) return false;
    // From a roof toward the bike path: leap across if a tram covers the other track for the whole hop.
    if (this.roof && n === 1 && !this.leaping) {
      const far = this.lane === 0 ? 2 : 0;
      const span = this.speed * CONTROLS.laneChangeTime * 2;
      const a = this.tramAt(far), b = this.tramAt(far, this.d + span + 0.5);
      if (a && a === b) { n = far; this.leaping = true; }
    }
    this.lane = n;
    return true;
  }
  jump(): boolean {
    if (this.crashed || !this.grounded) return false;
    this.vy = JUMP_V;
    this.grounded = false;
    this.jumpedAt = this.t;
    return true;
  }

  /** Surface height under Rosie in her current collision lane. */
  private surface(myLane: number): number {
    if (this.leaping) return ROOF_H;
    const r = this.roof;
    if (!r || r.lane !== myLane || this.d > r.end) return 0;
    if (r.ramp) {
      const u = alongObstacle(r, this.d);
      if (u < RAMP_LEN) return (ROOF_H * Math.max(0, u)) / RAMP_LEN;
    }
    return ROOF_H;
  }

  /** Advance by dt seconds. Returns events for sound/feedback. */
  update(dt: number): RunEvent[] {
    const ev: RunEvent[] = [];
    if (this.crashed) return ev;
    this.t += dt;
    this.d += this.speed * dt;
    const lcTime = CONTROLS.laneChangeTime;
    const step = dt / lcTime;
    if (Math.abs(this.lane - this.lanePos) <= step) this.lanePos = this.lane;
    else this.lanePos += Math.sign(this.lane - this.lanePos) * step;
    this.spawner.ensure(this.d + 220);
    this.spawner.prune(this.d);
    const myLane = Math.round(this.lanePos);

    // --- trams: stay on, climb on, or crash ---
    if (this.leaping && this.lanePos === this.lane) {
      this.leaping = false;
      this.roof = this.tramAt(this.lane);
    }
    if (this.roof && (this.d > this.roof.end || (!this.leaping && this.roof.lane !== myLane))) {
      // Ran off the end, or stepped off sideways.
      const other = this.tramAt(myLane);
      this.roof = other && this.y >= ROOF_H - 0.6 ? other : null;
    }
    if (!this.roof && !this.leaping) {
      const tr = this.tramAt(myLane);
      if (tr) {
        const f = Math.min(FORGIVE, (tr.end - tr.start) * 0.3);
        const rampFoot = tr.ramp && alongObstacle(tr, this.d) < RAMP_LEN;
        if (this.y >= MOUNT_Y || rampFoot) {
          this.roof = tr;
          ev.push('mount');
        } else if (this.d >= tr.start + f && this.d <= tr.end - f) {
          return this.crash(tr, ev);
        }
      }
    }

    // --- vertical motion ---
    const base = this.surface(myLane);
    const wasGrounded = this.grounded;
    if (this.grounded && base >= this.y - 0.05) {
      this.y = base; // walk along (incl. up a ramp)
      this.vy = 0;
    } else if (this.y < base) {
      // reached a roof mid-jump: scramble up
      this.y = Math.min(base, this.y + CLIMB_V * dt);
      this.vy = 0;
      if (this.y >= base) { this.grounded = true; this.landedAt = this.t; ev.push('land'); }
      else this.grounded = false;
    } else {
      this.grounded = false;
      this.vy -= GRAV * dt;
      this.y += this.vy * dt;
      if (this.y <= base) {
        this.y = base;
        this.vy = 0;
        this.grounded = true;
        if (!wasGrounded) { this.landedAt = this.t; ev.push('land'); }
      }
    }
    this.base = base;

    // --- warnings, bells and street obstacles ---
    for (const o of this.spawner.obstacles) {
      if (o.start > this.d + 200) break;
      if (o.tram && o.kind !== 'tramStop' && this.d >= o.warnFrom && !this.warned.has(o.id)) {
        this.warned.add(o.id);
        ev.push('tramWarn');
      }
      if (o.kind === 'bike' && o.start - this.d < 2.2 * this.speed && !this.bells.has(o.id)) {
        this.bells.add(o.id);
        ev.push('bike');
      }
      if (o.tram || o.lane !== myLane || this.leaping) continue;
      const f = Math.min(FORGIVE, (o.end - o.start) * 0.3);
      if (this.d < o.start + f || this.d > o.end - f) continue;
      const clear = o.tall ? 1.95 : 0.35; // a walker is ~1.8 tall; low stuff ~0.5
      if (this.y - 0 >= clear) continue;
      return this.crash(o, ev);
    }
    return ev;
  }

  private crash(o: Obstacle, ev: RunEvent[]): RunEvent[] {
    this.crashed = true;
    this.hit = o;
    ev.push('crash');
    return ev;
  }
}
