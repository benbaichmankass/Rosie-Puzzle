import { SleepingPose, PieceCell } from '../types';

export const BOYFRIEND_POSES: SleepingPose[] = [
  {
    id: 'bf-l-pose',
    name: 'L-Shape (Bent Knee)',
    description: 'Bent leg at right angle, perfect for fitting around corners',
    cells: [
      { r: 0, c: 0, part: 'head' },
      { r: 1, c: 0, part: 'torso' },
      { r: 2, c: 0, part: 'leg' },
      { r: 2, c: 1, part: 'feet' },
    ],
  },
  {
    id: 'bf-straight',
    name: 'Straight Sleeper (I-Shape)',
    description: 'Stretched out straight line of 4 squares',
    cells: [
      { r: 0, c: 0, part: 'head' },
      { r: 1, c: 0, part: 'torso' },
      { r: 2, c: 0, part: 'leg' },
      { r: 3, c: 0, part: 'feet' },
    ],
  },
  {
    id: 'bf-fetal',
    name: 'Snug Fetal Tuck',
    description: 'Compact curled pose with tucked arm and knees',
    cells: [
      { r: 0, c: 1, part: 'head' },
      { r: 1, c: 1, part: 'torso' },
      { r: 1, c: 0, part: 'arm' },
      { r: 2, c: 0, part: 'feet' },
    ],
  },
  {
    id: 'bf-starfish',
    name: 'Bed Starfish',
    description: 'Outstretched arms and feet lounger',
    cells: [
      { r: 0, c: 1, part: 'head' },
      { r: 0, c: 0, part: 'arm' },
      { r: 1, c: 1, part: 'torso' },
      { r: 2, c: 0, part: 'leg' },
      { r: 2, c: 2, part: 'feet' },
    ],
  },
  {
    id: 'bf-cuddle-reach',
    name: 'Cuddle Reacher',
    description: 'Arm reaching for cuddle partner with cozy socks tucked',
    cells: [
      { r: 0, c: 0, part: 'head' },
      { r: 0, c: 1, part: 'arm' },
      { r: 1, c: 0, part: 'torso' },
      { r: 2, c: 0, part: 'leg' },
      { r: 2, c: 1, part: 'feet' },
    ],
  },
];

export const GIRLFRIEND_POSES: SleepingPose[] = [
  {
    id: 'gf-l-pose',
    name: 'L-Shape (Bent Knee)',
    description: 'Bent leg at right angle, fits neatly around bed corners',
    cells: [
      { r: 0, c: 0, part: 'head' },
      { r: 1, c: 0, part: 'torso' },
      { r: 2, c: 0, part: 'leg' },
      { r: 2, c: 1, part: 'feet' },
    ],
  },
  {
    id: 'gf-straight',
    name: 'Straight Sleeper (I-Shape)',
    description: 'Cozy straight sleeper fitting into narrow spaces',
    cells: [
      { r: 0, c: 0, part: 'head' },
      { r: 1, c: 0, part: 'torso' },
      { r: 2, c: 0, part: 'leg' },
      { r: 3, c: 0, part: 'feet' },
    ],
  },
  {
    id: 'gf-fetal',
    name: 'Snug Fetal Tuck',
    description: 'Compact curled pose with tucked arm and socks',
    cells: [
      { r: 0, c: 1, part: 'head' },
      { r: 1, c: 1, part: 'torso' },
      { r: 1, c: 0, part: 'arm' },
      { r: 2, c: 0, part: 'feet' },
    ],
  },
  {
    id: 'gf-starfish',
    name: 'Starfish Sprawl',
    description: 'Wide cozy sprawl occupying maximum duvet',
    cells: [
      { r: 0, c: 1, part: 'head' },
      { r: 0, c: 0, part: 'arm' },
      { r: 1, c: 1, part: 'torso' },
      { r: 2, c: 0, part: 'leg' },
      { r: 2, c: 2, part: 'feet' },
    ],
  },
  {
    id: 'gf-cuddle-reach',
    name: 'Cuddle Reacher',
    description: 'Arm reaching for Bentzi with mint green socks',
    cells: [
      { r: 0, c: 0, part: 'head' },
      { r: 0, c: 1, part: 'arm' },
      { r: 1, c: 0, part: 'torso' },
      { r: 2, c: 0, part: 'leg' },
      { r: 2, c: 1, part: 'feet' },
    ],
  },
];

/**
 * Interactive limb adjuster:
 * Adjusts / bends a specific limb (leg, arm, feet) to an adjacent valid position!
 */
export function bendPieceLimb(
  cells: PieceCell[],
  limbPart: 'leg' | 'arm' | 'feet'
): PieceCell[] {
  const torso = cells.find((c) => c.part === 'torso') || cells[1] || { r: 1, c: 0 };
  const head = cells.find((c) => c.part === 'head') || cells[0] || { r: 0, c: 0 };

  const newCells = cells.map((c) => ({ ...c }));

  if (limbPart === 'leg' || limbPart === 'feet') {
    // Cycle leg/feet between:
    // 1. Straight down: leg at torso.r + 1, feet at torso.r + 2
    // 2. Bent right: leg at torso.r + 1, feet at (torso.r + 1, torso.c + 1)
    // 3. Bent left: leg at torso.r + 1, feet at (torso.r + 1, torso.c - 1)
    // 4. Kicked diagonal: leg at (torso.r + 1, torso.c + 1), feet at (torso.r + 2, torso.c + 1)
    const legIdx = newCells.findIndex((c) => c.part === 'leg');
    const feetIdx = newCells.findIndex((c) => c.part === 'feet');

    if (legIdx !== -1 && feetIdx !== -1) {
      const currentFeet = newCells[feetIdx];
      if (currentFeet.c === torso.c && currentFeet.r === torso.r + 2) {
        // Was straight -> bend right
        newCells[legIdx] = { r: torso.r + 1, c: torso.c, part: 'leg' };
        newCells[feetIdx] = { r: torso.r + 1, c: torso.c + 1, part: 'feet' };
      } else if (currentFeet.c > torso.c) {
        // Was bent right -> bend left
        newCells[legIdx] = { r: torso.r + 1, c: torso.c, part: 'leg' };
        newCells[feetIdx] = { r: torso.r + 1, c: torso.c - 1, part: 'feet' };
      } else if (currentFeet.c < torso.c) {
        // Was bent left -> tuck knee
        newCells[legIdx] = { r: torso.r + 1, c: torso.c - 1, part: 'leg' };
        newCells[feetIdx] = { r: torso.r + 2, c: torso.c - 1, part: 'feet' };
      } else {
        // Reset to straight
        newCells[legIdx] = { r: torso.r + 1, c: torso.c, part: 'leg' };
        newCells[feetIdx] = { r: torso.r + 2, c: torso.c, part: 'feet' };
      }
    } else if (feetIdx !== -1) {
      // Single feet/leg cell
      const current = newCells[feetIdx];
      if (current.c === torso.c) {
        newCells[feetIdx] = { r: torso.r + 1, c: torso.c + 1, part: 'feet' };
      } else if (current.c > torso.c) {
        newCells[feetIdx] = { r: torso.r + 1, c: torso.c - 1, part: 'feet' };
      } else {
        newCells[feetIdx] = { r: torso.r + 2, c: torso.c, part: 'feet' };
      }
    }
  } else if (limbPart === 'arm') {
    // Cycle arm between:
    // 1. Reaching right: (torso.r, torso.c + 1)
    // 2. Reaching left: (torso.r, torso.c - 1)
    // 3. Hugging up: (head.r, head.c + 1)
    const armIdx = newCells.findIndex((c) => c.part === 'arm');
    if (armIdx !== -1) {
      const currentArm = newCells[armIdx];
      if (currentArm.c === torso.c + 1 && currentArm.r === torso.r) {
        // Bend left
        newCells[armIdx] = { r: torso.r, c: torso.c - 1, part: 'arm' };
      } else if (currentArm.c === torso.c - 1) {
        // Hug up
        newCells[armIdx] = { r: head.r, c: head.c + 1, part: 'arm' };
      } else {
        // Reach right
        newCells[armIdx] = { r: torso.r, c: torso.c + 1, part: 'arm' };
      }
    } else {
      // Add arm cell if not present
      newCells.push({ r: torso.r, c: torso.c + 1, part: 'arm' });
    }
  }

  // Normalize minR, minC to 0
  const minR = Math.min(...newCells.map((c) => c.r));
  const minC = Math.min(...newCells.map((c) => c.c));
  return newCells.map((c) => ({
    ...c,
    r: c.r - minR,
    c: c.c - minC,
  }));
}
