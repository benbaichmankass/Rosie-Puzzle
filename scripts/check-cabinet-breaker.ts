/**
 * Cabinet Breaker check: every level layout is valid and fits the board, and an auto-paddle
 * actually clears every level with the real collision code (at the smallest and largest board).
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
import { BALL_R, createSim, launch, mulberry32, paddleY, startLevel, step } from '../src/games/cabinet-breaker/sim';

let failed = false;
const fail = (msg: string) => {
  console.error('FAIL', msg);
  failed = true;
};

if (CABINET_BOTTOM > paddleY(BOARD_MIN_H) - 120) fail('cabinet leaves too little room above the paddle');

LEVELS.forEach((def, i) => {
  for (const e of validateLevel(def)) fail(e);
  for (const b of buildBricks(i)) {
    if (b.x < WALL_L || b.x + b.w > WALL_R || b.y < WALL_T || b.y + b.h > CABINET_BOTTOM || b.x + b.w > BOARD_W)
      fail(`${def.name}: item at row ${b.row} col ${b.col} is outside the cabinet`);
    if (b.def.hits < 1 || !Number.isFinite(b.def.hits)) fail(`${def.name}: unbreakable item at ${b.row},${b.col}`);
  }
});

const t0 = Date.now();
const DT = 1 / 120;
const LIMIT = 900; // sim seconds per level
for (const H of [BOARD_MIN_H, BOARD_MAX_H]) {
  // Two passes: the first loop of levels and the faster second loop.
  for (const level of [...LEVELS.keys(), LEVELS.length, LEVELS.length * 2 - 1]) {
    const rng = mulberry32(1234 + level * 7 + H);
    const sim = createSim(H, rng);
    startLevel(sim, level);
    sim.lives = 999;
    let aim = 0;
    let t = 0;
    let lost = 0;
    while (!sim.cleared && t < LIMIT) {
      if (sim.ball.stuck) launch(sim);
      // A decent player: track the ball, using a varying offset to aim.
      const target = sim.ball.x - aim * (sim.paddle.w / 2 - BALL_R);
      const maxMove = 1600 * DT;
      const dx = Math.max(-maxMove, Math.min(maxMove, target - sim.paddle.x));
      const evs = step(sim, DT, sim.paddle.x + dx);
      for (const e of evs) {
        if (e.type === 'paddle') aim = (rng() - 0.5) * 1.6;
        if (e.type === 'lost') lost++;
      }
      t += DT;
    }
    if (!sim.cleared) fail(`level ${level + 1} (H=${H}) not cleared in ${LIMIT}s, ${sim.bricks.length} items left`);
    else console.log(`level ${level + 1} "${LEVELS[level % LEVELS.length].name}" H=${H}: cleared in ${t.toFixed(0)}s, ${lost} balls lost, score ${sim.score}`);
  }
}
console.log(`done in ${Date.now() - t0} ms`);
if (failed) process.exit(1);
