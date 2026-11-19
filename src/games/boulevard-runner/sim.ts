/** One run of the boulevard: Rosie's movement, jumping, tram roofs, collisions and score. Pure TS. */
import { lapOf, lapU, PARK_START, fansNear } from './route';
import { Spawner, CONTROLS, speedAt, alongObstacle, JUMP_H, MOUNT_Y, ROOF_H, RAMP_LEN, TREAT_POINTS, POWERUP_POINTS, BOARD_SPEED, POWER_TIMES, BALLOON_H, SPRING_JUMP_H, SPRING_JUMP_TIME, type Obstacle, type Pickup, type PowerKind } from './spawner';

export { JUMP_H, ROOF_H };
/** Forgiveness: shave this much player distance off each end of an obstacle's hit interval. */
const FORGIVE = 0.18;
/** Gravity and launch speed chosen so a jump on flat ground matches CONTROLS.jumpTime / JUMP_H. */
const GRAV = (8 * JUMP_H) / (CONTROLS.jumpTime * CONTROLS.jumpTime);
const JUMP_V = (4 * JUMP_H) / CONTROLS.jumpTime;
/** Spring booties: a higher, longer jump. */
const SPRING_GRAV = (8 * SPRING_JUMP_H) / (SPRING_JUMP_TIME * SPRING_JUMP_TIME);
const SPRING_V = (4 * SPRING_JUMP_H) / SPRING_JUMP_TIME;
/** Speed Rosie scrambles up onto a roof she reached mid-jump (units/s). */
const CLIMB_V = 16;

export type RunEvent = 'jump' | 'lane' | 'crash' | 'tramWarn' | 'bike' | 'land' | 'mount' | 'treat' | 'power' | 'shield' | 'powerEnd' | 'park' | 'lap';
/** Bonus for reaching Charles Clore Park on each lap. */
export const PARK_BONUS = 500;
/** Bonus for nipping a football fan by Bloomfield Stadium (tap them as Rosie passes). */
export const CHOMP_POINTS = 100;
export interface Power { kind: PowerKind; until: number; total: number }

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
  /** Seconds into a duck (crouch-roll), -1 = standing; a duck asked for in the air starts on landing. */
  duckT = -1;
  private duckQueued = false;
  /** Gravity for the current jump (spring jumps are floatier). */
  private grav = GRAV;
  crashed = false;
  hit: Obstacle | null = null;
  /** Points from treats and power-ups (score = metres + bonus). */
  bonus = 0;
  treats = 0;
  power: Power | null = null;
  /** After the skateboard takes a hit Rosie is briefly untouchable. */
  ghostUntil = -1;
  /** Ids of pickups already collected, and the time each was taken (for the pop animation). */
  taken = new Map<number, number>();
  /** Laps completed and parks reached (milestones). */
  lap = 0;
  parks = 0;
  /** Fans nipped this run (id -> run time) and the last lunge (for the animation). */
  bitten = new Map<number, number>();
  lungeAt = -10;
  lungeSide = 1;
  spawner: Spawner;
  private warned = new Set<number>();
  private bells = new Set<number>();
  private grounded = true;

  /** startAt > 0 is a review aid (URL flag ?d=): the run begins part-way along the route, briefly untouchable. */
  constructor(seed: number, startAt = 0) {
    this.spawner = new Spawner(seed);
    if (startAt > 0) {
      this.d = startAt;
      this.lap = lapOf(startAt);
      this.parks = lapU(startAt) >= PARK_START ? this.lap + 1 : this.lap;
      this.ghostUntil = 2.5;
    }
    this.spawner.ensure(this.d + 200);
  }

  get speed() { return speedAt(this.d) * (this.power?.kind === 'board' ? BOARD_SPEED : 1); }
  get score() { return Math.floor(this.d + this.bonus); }
  get multiplier() { return this.power?.kind === 'mult' ? 2 : 1; }
  get floating() { return this.power?.kind === 'balloon'; }
  get ghost() { return this.t < this.ghostUntil; }
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
  /** Swipe down: duck under bars and branches. In the air it cancels the jump with a fast drop. */
  duck(): boolean {
    if (this.crashed) return false;
    if (!this.grounded) { this.vy = Math.min(this.vy, -12); this.duckQueued = true; return true; }
    this.duckT = 0;
    return true;
  }
  /** Low enough to pass under a bar right now. */
  get ducking(): boolean {
    const T = CONTROLS.duckTime;
    return this.grounded && this.duckT >= CONTROLS.duckFrom * T && this.duckT <= CONTROLS.duckTo * T;
  }
  /** 0..1 how crouched Rosie looks (for drawing). */
  get crouch(): number {
    if (this.duckT < 0) return 0;
    const p = this.duckT / CONTROLS.duckTime;
    return Math.min(1, p * 8, (1 - p) * 8);
  }
  jump(): boolean {
    if (this.crashed || !this.grounded) return false;
    this.duckT = -1; // jumping cancels a duck
    const spring = this.power?.kind === 'spring';
    this.vy = spring ? SPRING_V : JUMP_V;
    this.grav = spring ? SPRING_GRAV : GRAV;
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
    if (this.floating) { this.roof = null; this.leaping = false; }
    if (!this.roof && !this.leaping && !this.floating) {
      const tr = this.tramAt(myLane);
      if (tr) {
        const f = Math.min(FORGIVE, (tr.end - tr.start) * 0.3);
        const rampFoot = tr.ramp && alongObstacle(tr, this.d) < RAMP_LEN;
        if (this.y >= MOUNT_Y || rampFoot) {
          this.roof = tr;
          ev.push('mount');
        } else if (this.d >= tr.start + f && this.d <= tr.end - f) {
          if (this.ghost || this.power?.kind === 'board') {
            // the skateboard takes the hit and Rosie scrambles up onto the roof
            if (!this.ghost) this.breakBoard(ev);
            this.roof = tr;
            this.grounded = false;
            ev.push('mount');
          } else return this.crash(tr, ev);
        }
      }
    }

    // --- duck timer ---
    if (this.duckT >= 0) { this.duckT += dt; if (this.duckT > CONTROLS.duckTime) this.duckT = -1; }

    // --- vertical motion ---
    const base = this.surface(myLane);
    const wasGrounded = this.grounded;
    if (this.floating) {
      // the balloon lifts Rosie over everything
      this.grounded = false;
      this.vy = 0;
      this.y += Math.sign(BALLOON_H - this.y) * Math.min(Math.abs(BALLOON_H - this.y), 7 * dt);
    } else if (this.grounded && base >= this.y - 0.05) {
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
      this.vy -= this.grav * dt;
      this.y += this.vy * dt;
      if (this.y <= base) {
        this.y = base;
        this.vy = 0;
        this.grounded = true;
        this.grav = GRAV;
        if (!wasGrounded) {
          this.landedAt = this.t; ev.push('land');
          if (this.duckQueued) { this.duckQueued = false; this.duckT = 0; }
        }
      }
    }
    this.base = base;

    // --- route milestones: Charles Clore Park, then back to HaBesht one tier faster ---
    const lap = lapOf(this.d);
    if (lap > this.lap) { this.lap = lap; ev.push('lap'); }
    if (this.parks <= lap && lapU(this.d) >= PARK_START) { this.parks = lap + 1; this.bonus += PARK_BONUS; ev.push('park'); }

    // --- power-ups ---
    if (this.power && this.t >= this.power.until) {
      // letting go of the balloon: float down, briefly untouchable so the landing is never a trap
      if (this.power.kind === 'balloon') this.ghostUntil = this.t + 1.6;
      this.power = null;
      ev.push('powerEnd');
    }
    if (this.power?.kind === 'mult') this.bonus += this.speed * dt; // every metre counts double
    if (this.power?.kind === 'board' && this.grounded) {
      // auto-jump anything low coming up in this lane
      for (const o of this.spawner.obstacles) {
        if (o.start > this.d + 6) break;
        if (o.lane !== myLane || o.start - this.d <= 0 || o.start - this.d > this.speed * 0.1) continue;
        if (o.duck) { if (this.duckT < 0) this.duck(); break; } // the board ducks bars and branches too
        if (!o.tall) { this.jump(); ev.push('jump'); break; }
      }
    }
    this.collect(myLane, ev);

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
      if (o.tram || o.lane !== myLane || this.leaping || this.floating) continue;
      const f = Math.min(FORGIVE, (o.end - o.start) * 0.3);
      if (this.d < o.start + f || this.d > o.end - f) continue;
      if (o.duck) {
        // a bar at street level, or a branch / gantry / canopy at tram-roof height: duck or get bonked
        const atLevel = o.duckLevel === 0 ? this.y < 1.6 : this.y >= ROOF_H - 0.4;
        if (!atLevel || this.ducking || this.ghost) continue;
        if (this.power?.kind === 'board') { this.breakBoard(ev); continue; }
        return this.crash(o, ev);
      }
      const clear = o.tall ? 1.95 : 0.35; // a walker is ~1.8 tall; low stuff ~0.5
      if (this.y - 0 >= clear || this.ghost) continue;
      if (this.power?.kind === 'board') { this.breakBoard(ev); continue; }
      return this.crash(o, ev);
    }
    return ev;
  }

  /**
   * Tap on a fan: Rosie lunges and gives their trouser leg a quick cartoon nip (no harm done), for bonus points.
   * Only counts for a fan right beside Rosie or just ahead.
   */
  bite(fanId: number): boolean {
    if (this.crashed || this.bitten.has(fanId)) return false;
    const fan = fansNear(this.d - 2, this.d + 12).find((f) => f.id === fanId);
    if (!fan) return false;
    this.bitten.set(fanId, this.t);
    this.bonus += CHOMP_POINTS * this.multiplier;
    this.lungeAt = this.t;
    this.lungeSide = fan.x > (this.lanePos - 1) * 1.9 ? 1 : -1;
    return true;
  }
  get lunge(): number {
    const k = (this.t - this.lungeAt) / 0.35;
    return k < 0 || k > 1 ? 0 : Math.sin(k * Math.PI);
  }

  private breakBoard(ev: RunEvent[]) {
    this.power = null;
    this.ghostUntil = this.t + 1.3;
    ev.push('shield');
  }

  private collect(myLane: number, ev: RunEvent[]) {
    const magnet = this.power?.kind === 'magnet';
    for (const p of this.spawner.pickups) {
      if (p.d > this.d + 8) break;
      if (this.taken.has(p.id) || p.d < this.d - 1.5) continue;
      const ahead = p.d - this.d;
      const sameSpot = Math.abs(this.lanePos - p.lane) < 0.55 && Math.abs(ahead) < 1.1 &&
        (this.floating || (this.y > p.h - 0.8 && this.y < p.h + 1.9));
      const pulled = magnet && p.kind === 'treat' && ahead < 1.2;
      if (!sameSpot && !pulled) continue;
      this.taken.set(p.id, this.t);
      this.take(p, ev);
    }
  }
  private take(p: Pickup, ev: RunEvent[]) {
    if (p.kind === 'treat') {
      this.treats++;
      this.bonus += TREAT_POINTS * this.multiplier;
      ev.push('treat');
      return;
    }
    this.bonus += POWERUP_POINTS;
    if (this.power?.kind === 'balloon') this.ghostUntil = this.t + 1.6; // swapping away from the balloon mid-air
    const total = POWER_TIMES[p.kind];
    this.power = { kind: p.kind, until: this.t + total, total };
    ev.push('power');
  }

  private crash(o: Obstacle, ev: RunEvent[]): RunEvent[] {
    this.crashed = true;
    this.hit = o;
    ev.push('crash');
    return ev;
  }
}
