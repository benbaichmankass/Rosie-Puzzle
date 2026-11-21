/**
 * Cabinet Breaker check:
 * - every level layout is valid and fits the board;
 * - an auto-paddle clears every level with the real collision code (smallest and largest board),
 *   with pickups dropping, being caught and missed along the way;
 * - the Tabasco fireball burns straight through items without bouncing;
 * - multi-lemon: an extra lemon joins play, losing one of several costs no life, losing the last does;
 * - tahini and coffee cancel each other and effects never stack past their length.
 */
import {
  BOARD_MAX_H,
  BOARD_MIN_H,
  BOARD_W,
  buildBricks,
  CABINET_BOTTOM,
  LEVELS,
  validateLevel,
  WALL_L,
  WALL_R,
  WALL_T,
} from '../src/games/cabinet-breaker/levels';
import {
  applyPickup,
  BALL_R,
  createSim,
  EFFECT_TIME,
  effectiveSpeed,
  launch,
  MAX_BALLS,
  mulberry32,
  paddleY,
  PICKUPS,
  spawnPickup,
  startLevel,
  step,
  type Sim,
  type SimEvent,
} from '../src/games/cabinet-breaker/sim';

let failed = false;
const fail = (msg: string) => {
  console.error('FAIL', msg);
  failed = true;
};
const DT = 1 / 120;

/* ------------------------------------------------------------ layouts */

if (CABINET_BOTTOM > paddleY(BOARD_MIN_H) - 120) fail('cabinet leaves too little room above the paddle');

LEVELS.forEach((def, i) => {
  for (const e of validateLevel(def)) fail(e);
  for (const b of buildBricks(i)) {
    if (b.x < WALL_L || b.x + b.w > WALL_R || b.y < WALL_T || b.y + b.h > CABINET_BOTTOM || b.x + b.w > BOARD_W)
      fail(`${def.name}: item at row ${b.row} col ${b.col} is outside the cabinet`);
    if (b.def.hits < 1 || !Number.isFinite(b.def.hits)) fail(`${def.name}: unbreakable item at ${b.row},${b.col}`);
  }
});

const totalChance = Object.values(PICKUPS).reduce((a, p) => a + p.chance, 0);
if (totalChance < 0.12 || totalChance > 0.3) fail(`pickup rate ${totalChance} is not "one every several smashes"`);
if (PICKUPS.tabasco.chance >= Math.min(PICKUPS.lemon.chance, PICKUPS.tahini.chance, PICKUPS.coffee.chance))
  fail('the fireball should be the rarest pickup');

/* ------------------------------------------------------------ auto-play every level */

/** A decent player: follow the lowest falling lemon, aiming with a varying offset. */
function autoTarget(sim: Sim, aim: number) {
  const live = sim.balls.filter((b) => !b.stuck);
  if (live.length === 0) return sim.balls[0].x;
  const falling = live.filter((b) => b.vy > 0);
  const pick = (falling.length ? falling : live).reduce((a, b) => (b.y > a.y ? b : a));
  return pick.x - aim * (sim.paddle.w / 2 - BALL_R);
}

const t0 = Date.now();
const LIMIT = 900; // sim seconds per level
let caught = 0;
let missed = 0;
let maxBalls = 1;
for (const H of [BOARD_MIN_H, BOARD_MAX_H]) {
  for (const level of [...LEVELS.keys(), LEVELS.length, LEVELS.length * 2 - 1]) {
    const rng = mulberry32(1234 + level * 7 + H);
    const sim = createSim(H, rng);
    startLevel(sim, level);
    sim.lives = 999;
    let aim = 0;
    let t = 0;
    let lost = 0;
    while (!sim.cleared && t < LIMIT) {
      if (sim.balls[0]?.stuck) launch(sim);
      const target = autoTarget(sim, aim);
      const maxMove = 1600 * DT;
      const dx = Math.max(-maxMove, Math.min(maxMove, target - sim.paddle.x));
      for (const e of step(sim, DT, sim.paddle.x + dx)) {
        if (e.type === 'paddle') aim = (rng() - 0.5) * 1.6;
        if (e.type === 'lost') lost++;
        if (e.type === 'pickupCatch') caught++;
        if (e.type === 'pickupMiss') missed++;
      }
      maxBalls = Math.max(maxBalls, sim.balls.length);
      if (sim.balls.length > MAX_BALLS) fail(`more than ${MAX_BALLS} lemons in play`);
      t += DT;
    }
    if (!sim.cleared) fail(`level ${level + 1} (H=${H}) not cleared in ${LIMIT}s, ${sim.bricks.length} items left`);
    else console.log(`level ${level + 1} "${LEVELS[level % LEVELS.length].name}" H=${H}: cleared in ${t.toFixed(0)}s, ${lost} lives lost`);
  }
}
console.log(`pickups during auto-play: ${caught} caught, ${missed} missed, up to ${maxBalls} lemons at once`);
if (caught + missed < 20) fail('almost no pickups dropped during auto-play');

/* ------------------------------------------------------------ fireball pass-through */
{
  // "Heavy Metal": top row is pans and clay pots (3 hits each). Fire one lemon straight up column 0.
  const lv = LEVELS.findIndex((l) => l.name === 'Heavy Metal');
  const sim = createSim(700, mulberry32(5));
  startLevel(sim, lv);
  const before = sim.bricks.filter((b) => b.col === 0).length;
  const heavy = sim.bricks.find((b) => b.col === 0 && b.row === 0)!;
  if (heavy.def.hits < 3) fail('fireball test expects a 3-hit item at the top of column 0');
  launch(sim);
  const ball = sim.balls[0];
  ball.x = heavy.x + heavy.w / 2;
  ball.y = 330;
  ball.vx = 0;
  ball.vy = -effectiveSpeed(sim);
  applyPickup(sim, 'tabasco');
  let bouncedOffItem = false;
  let burnt = 0;
  let hitWall = false;
  for (let i = 0; i < 400 && !hitWall; i++) {
    const vyBefore = ball.vy;
    const evs: SimEvent[] = step(sim, DT, null);
    for (const e of evs) {
      if (e.type === 'break' && e.burnt) burnt++;
      if (e.type === 'hit') bouncedOffItem = true;
      if (e.type === 'wall' && e.y <= WALL_T + 1) hitWall = true;
    }
    if (!hitWall && vyBefore < 0 && ball.vy > 0) bouncedOffItem = true;
  }
  const after = sim.bricks.filter((b) => b.col === 0).length;
  if (!hitWall) fail('fireball never reached the top of the cabinet');
  if (bouncedOffItem) fail('fireball bounced off an item instead of burning through');
  if (after !== 0 || burnt < before) fail(`fireball left ${after} of ${before} items in its column (burnt ${burnt})`);
  if (sim.bricks.includes(heavy)) fail('fireball did not destroy the 3-hit item in one touch');
  if (ball.vy <= 0) fail('fireball should bounce off the top wall');
  // When the fire runs out, items bounce the ball again.
  sim.effects.fire = 0;
  ball.x = sim.bricks[0].x + sim.bricks[0].w / 2;
  ball.y = sim.bricks[0].y + sim.bricks[0].h + 20;
  ball.vx = 0;
  ball.vy = -effectiveSpeed(sim);
  let bounced = false;
  for (let i = 0; i < 60 && !bounced; i++) {
    step(sim, DT, null);
    if (ball.vy > 0) bounced = true;
  }
  if (!bounced) fail('ball should bounce off items again once the fireball ends');
  console.log(`fireball: burnt ${burnt} items in column 0 without bouncing, including a 3-hit item`);
}

/* ------------------------------------------------------------ multi-lemon */
{
  const sim = createSim(700, mulberry32(9));
  startLevel(sim, 0);
  launch(sim);
  const lives = sim.lives;
  // Catch a lemon pickup with the paddle (real catch path, not applyPickup directly).
  const p = spawnPickup(sim, 'lemon', sim.paddle.x, sim.paddle.y - 40);
  p.vy = 200;
  let gotCatch = false;
  for (let i = 0; i < 60 && !gotCatch; i++) {
    for (const e of step(sim, DT, sim.paddle.x)) if (e.type === 'pickupCatch' && e.pickup.kind === 'lemon') gotCatch = true;
  }
  if (!gotCatch) fail('paddle did not catch a lemon pickup falling onto it');
  if (sim.balls.length !== 2) fail(`catching a lemon should give 2 lemons, got ${sim.balls.length}`);
  // Drop one lemon off the bottom: no life lost.
  const drop = sim.balls[1];
  drop.x = 40;
  drop.y = sim.H + 50;
  drop.vy = 300;
  let ballLost = false;
  for (const e of step(sim, DT, sim.paddle.x)) if (e.type === 'ballLost') ballLost = true;
  if (!ballLost || sim.balls.length !== 1 || sim.lives !== lives) fail('losing one of two lemons should cost no life');
  // Drop the last one: a life is lost and a single lemon goes back on the board.
  const last = sim.balls[0];
  last.x = 40;
  last.y = sim.H + 50;
  last.vy = 300;
  sim.effects.fire = 3;
  let lifeLost = false;
  for (const e of step(sim, DT, sim.paddle.x)) if (e.type === 'lost') lifeLost = true;
  if (!lifeLost || sim.lives !== lives - 1) fail('losing the last lemon should cost a life');
  if (sim.balls.length !== 1 || !sim.balls[0].stuck) fail('after a lost life one lemon should wait on the board');
  if (sim.effects.fire !== 0 || sim.pickups.length !== 0) fail('effects and pickups should clear after a lost life');
  // Never more than MAX_BALLS.
  launch(sim);
  for (let i = 0; i < 10; i++) applyPickup(sim, 'lemon');
  if (sim.balls.length !== MAX_BALLS) fail(`lemons should cap at ${MAX_BALLS}, got ${sim.balls.length}`);
  console.log(`multi-lemon: extra lemon caught, spare lost for free, last lost costs a life, capped at ${MAX_BALLS}`);
}

/* ------------------------------------------------------------ tahini / coffee */
{
  const sim = createSim(700, mulberry32(11));
  startLevel(sim, 0);
  launch(sim);
  const base = effectiveSpeed(sim);
  applyPickup(sim, 'tahini');
  if (!(effectiveSpeed(sim) < base)) fail('tahini should slow the lemon');
  applyPickup(sim, 'coffee');
  if (sim.effects.slow !== 0 || !(effectiveSpeed(sim) > base)) fail('coffee should cancel tahini and speed the lemon up');
  for (let i = 0; i < 5; i++) applyPickup(sim, 'coffee');
  if (sim.effects.fast > EFFECT_TIME.fast) fail('coffee should not stack past its length');
  applyPickup(sim, 'tahini');
  if (sim.effects.fast !== 0) fail('tahini should cancel coffee');
  for (let i = 0; i < Math.ceil((EFFECT_TIME.slow + 1) / DT); i++) {
    sim.pickups = []; // ignore fresh drops so only the timer is tested
    step(sim, DT, sim.balls[0].x);
  }
  if (sim.effects.slow !== 0) fail('tahini should wear off');
  console.log('tahini/coffee: cancel each other, refresh without stacking, wear off');
}

console.log(`done in ${Date.now() - t0} ms`);
if (failed) process.exit(1);
