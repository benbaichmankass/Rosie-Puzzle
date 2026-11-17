import { LevelConfig, Obstacle } from '../types';
import { BOYFRIEND_POSES, GIRLFRIEND_POSES } from './poses';

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    title: 'Level 1: Rosie’s Cozy Ball',
    subtitle: 'Rosie is curled up in a snug 2-square ball',
    storyNote: 'Easy start! Rosie tucked her nose into her tail in a tight little ball. Rotate your limbs and fit into bed!',
    rows: 5,
    cols: 5,
    dogCells: [
      { r: 0, c: 3, part: 'head' },
      { r: 0, c: 4, part: 'body' },
    ],
    dogPose: 'ball',
    obstacles: [],
    boyfriendDefaultCells: BOYFRIEND_POSES[0].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[0].cells,
    allowDogNudge: true,
    startingGrumpiness: 0,
    targetZenSeconds: 20,
  },
  {
    id: 2,
    title: 'Level 2: The Curled Croissant',
    subtitle: 'Rosie curled like a warm pastry',
    storyNote: 'Rosie made herself into a 3-square donut in the corner. Can you tuck your arms and legs around her?',
    rows: 5,
    cols: 5,
    dogCells: [
      { r: 0, c: 3, part: 'head' },
      { r: 0, c: 4, part: 'body' },
      { r: 1, c: 4, part: 'tail' },
    ],
    dogPose: 'curled',
    obstacles: [],
    boyfriendDefaultCells: BOYFRIEND_POSES[1].cells, // bent leg
    girlfriendDefaultCells: GIRLFRIEND_POSES[1].cells, // curled knee
    allowDogNudge: true,
    startingGrumpiness: 0,
    targetZenSeconds: 25,
  },
  {
    id: 3,
    title: 'Level 3: Squeaky Obstacles',
    subtitle: 'Rosie is snoozing with her squeaky toy duck',
    storyNote: 'Don’t roll onto Rosie’s squeaky duck! Work around her 3-square ball and tuck in for the night.',
    rows: 5,
    cols: 5,
    dogCells: [
      { r: 2, c: 1, part: 'head' },
      { r: 2, c: 2, part: 'body' },
      { r: 3, c: 2, part: 'tail' },
    ],
    dogPose: 'curled',
    obstacles: [
      { id: 'obs-duck-1', type: 'toy_duck', r: 0, c: 2 },
    ],
    boyfriendDefaultCells: BOYFRIEND_POSES[0].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[0].cells,
    allowDogNudge: true,
    startingGrumpiness: 0,
    targetZenSeconds: 25,
  },
  {
    id: 4,
    title: 'Level 4: Side Sleeper Uncurls',
    subtitle: 'Rosie is starting to spread her paws out (4 squares)',
    storyNote: 'She is getting comfier and taking up 4 squares! Nudge her gently if needed, but watch her growl warning.',
    rows: 5,
    cols: 5,
    dogCells: [
      { r: 2, c: 2, part: 'head' },
      { r: 2, c: 3, part: 'body' },
      { r: 1, c: 3, part: 'paw' },
      { r: 3, c: 3, part: 'tail' },
    ],
    dogPose: 'loaf',
    obstacles: [],
    boyfriendDefaultCells: BOYFRIEND_POSES[1].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[2].cells,
    allowDogNudge: true,
    startingGrumpiness: 0,
    targetZenSeconds: 30,
  },
  {
    id: 5,
    title: 'Level 5: Diagonal Leg Stretch',
    subtitle: 'Back paws stretched diagonally (4 squares)',
    storyNote: 'Rosie’s paws are sticking out into the center of the bed! Rotate and flip your pieces to slot around her.',
    rows: 5,
    cols: 5,
    dogCells: [
      { r: 1, c: 1, part: 'head' },
      { r: 2, c: 2, part: 'body' },
      { r: 2, c: 3, part: 'paw' },
      { r: 3, c: 3, part: 'tail' },
    ],
    dogPose: 'diagonal',
    obstacles: [
      { id: 'obs-ball-1', type: 'toy_ball', r: 4, c: 0 },
    ],
    boyfriendDefaultCells: BOYFRIEND_POSES[2].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[1].cells,
    allowDogNudge: true,
    startingGrumpiness: 1,
    targetZenSeconds: 35,
  },
  {
    id: 6,
    title: 'Level 6: The Biscuit Bribe',
    subtitle: 'Rosie spreads to 5 squares across the duvet',
    storyNote: '5 squares occupied! Tap the crunchy bone treat to lure Rosie away from the pillows so you both can sleep.',
    rows: 6,
    cols: 5,
    dogCells: [
      { r: 2, c: 2, part: 'head' },
      { r: 2, c: 3, part: 'body' },
      { r: 1, c: 2, part: 'paw' },
      { r: 3, c: 2, part: 'paw' },
      { r: 2, c: 4, part: 'tail' },
    ],
    dogPose: 'sprawl',
    obstacles: [
      { id: 'treat-bone-1', type: 'treat_bone', r: 0, c: 4 },
      { id: 'toy-duck-2', type: 'toy_duck', r: 5, c: 1 },
    ],
    boyfriendDefaultCells: BOYFRIEND_POSES[0].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[0].cells,
    allowDogNudge: true,
    startingGrumpiness: 1,
    targetZenSeconds: 40,
  },
  {
    id: 7,
    title: 'Level 7: The Superman Sprawl',
    subtitle: 'Paws stretched forward & back (5 squares)',
    storyNote: 'Full classic dog superman pose! Front paws out, back legs stretched behind. Fit your limbs around her!',
    rows: 6,
    cols: 6,
    dogCells: [
      { r: 2, c: 2, part: 'head' },
      { r: 2, c: 3, part: 'body' },
      { r: 1, c: 1, part: 'paw' },
      { r: 3, c: 4, part: 'paw' },
      { r: 2, c: 4, part: 'tail' },
    ],
    dogPose: 'superman',
    obstacles: [
      { id: 'obs-bone-toy', type: 'toy_bone', r: 5, c: 5 },
    ],
    boyfriendDefaultCells: BOYFRIEND_POSES[1].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[2].cells,
    allowDogNudge: true,
    startingGrumpiness: 0,
    targetZenSeconds: 40,
  },
  {
    id: 8,
    title: 'Level 8: The 6-Square Bed Hog',
    subtitle: 'Rosie taking up 6 full squares across the middle',
    storyNote: 'How does she keep getting bigger?! 6 squares of pure fluff in the center. Position your limbs carefully!',
    rows: 6,
    cols: 6,
    dogCells: [
      { r: 2, c: 1, part: 'head' },
      { r: 2, c: 2, part: 'body' },
      { r: 2, c: 3, part: 'body' },
      { r: 1, c: 2, part: 'paw' },
      { r: 3, c: 2, part: 'paw' },
      { r: 2, c: 4, part: 'tail' },
    ],
    dogPose: 'sprawl',
    obstacles: [
      { id: 'obs-duck-3', type: 'toy_duck', r: 4, c: 0 },
      { id: 'obs-ball-2', type: 'toy_ball', r: 0, c: 5 },
    ],
    boyfriendDefaultCells: BOYFRIEND_POSES[2].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[1].cells,
    allowDogNudge: true,
    startingGrumpiness: 0,
    targetZenSeconds: 45,
  },
  {
    id: 9,
    title: 'Level 9: Belly-Up Splay & Bacon',
    subtitle: 'Full belly-up pose (6 squares) + bacon lure',
    storyNote: 'Rosie is sleeping upside down with all 4 paws in the air! Grab the bacon treat to coax her to the corner.',
    rows: 6,
    cols: 6,
    dogCells: [
      { r: 2, c: 2, part: 'head' },
      { r: 2, c: 3, part: 'body' },
      { r: 1, c: 2, part: 'paw' },
      { r: 1, c: 3, part: 'paw' },
      { r: 3, c: 2, part: 'paw' },
      { r: 3, c: 3, part: 'tail' },
    ],
    dogPose: 'starfish',
    obstacles: [
      { id: 'treat-bacon-1', type: 'treat_bacon', r: 0, c: 0 },
      { id: 'obs-ball-3', type: 'toy_ball', r: 5, c: 3 },
    ],
    boyfriendDefaultCells: BOYFRIEND_POSES[0].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[0].cells,
    allowDogNudge: true,
    startingGrumpiness: 1,
    targetZenSeconds: 45,
  },
  {
    id: 10,
    title: 'Level 10: The 7-Square Diagonal Starfish',
    subtitle: 'Rosie cutting a huge diagonal swath (7 squares)',
    storyNote: 'She is sprawled right across the bed diagonal! Rotate your pieces and hook your limbs around her paws.',
    rows: 6,
    cols: 6,
    dogCells: [
      { r: 1, c: 1, part: 'head' },
      { r: 2, c: 2, part: 'body' },
      { r: 3, c: 3, part: 'body' },
      { r: 1, c: 2, part: 'paw' },
      { r: 2, c: 1, part: 'paw' },
      { r: 3, c: 4, part: 'paw' },
      { r: 4, c: 4, part: 'tail' },
    ],
    dogPose: 'starfish',
    obstacles: [
      { id: 'treat-bone-2', type: 'treat_bone', r: 0, c: 5 },
    ],
    boyfriendDefaultCells: BOYFRIEND_POSES[1].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[1].cells,
    allowDogNudge: true,
    startingGrumpiness: 0,
    targetZenSeconds: 50,
  },
  {
    id: 11,
    title: 'Level 11: Queen of the Bed',
    subtitle: '7-square mega sprawl commanding the center',
    storyNote: 'A massive 7-square sprawl! One wrong push will get your toes nipped. Spoon closely together for the cuddle bonus!',
    rows: 6,
    cols: 6,
    dogCells: [
      { r: 2, c: 2, part: 'head' },
      { r: 2, c: 3, part: 'body' },
      { r: 3, c: 2, part: 'body' },
      { r: 3, c: 3, part: 'body' },
      { r: 1, c: 3, part: 'paw' },
      { r: 4, c: 2, part: 'paw' },
      { r: 2, c: 4, part: 'tail' },
    ],
    dogPose: 'sprawl',
    obstacles: [
      { id: 'obs-duck-11', type: 'toy_duck', r: 0, c: 1 },
      { id: 'treat-bone-3', type: 'treat_bone', r: 5, c: 4 },
    ],
    boyfriendDefaultCells: BOYFRIEND_POSES[2].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[2].cells,
    allowDogNudge: true,
    startingGrumpiness: 1,
    targetZenSeconds: 50,
  },
  {
    id: 12,
    title: 'Level 12: The Ultimate 8-Square Mega-Sprawl',
    subtitle: 'Rosie took over 8 whole squares of the queen bed!',
    storyNote: 'The ultimate slumber puzzle! Rosie’s paws and tail are stretched to all corners (8 squares). Rotate, flip, and tuck in together!',
    rows: 6,
    cols: 6,
    dogCells: [
      { r: 2, c: 2, part: 'head' },
      { r: 2, c: 3, part: 'body' },
      { r: 3, c: 2, part: 'body' },
      { r: 3, c: 3, part: 'body' },
      { r: 1, c: 2, part: 'paw' },
      { r: 1, c: 3, part: 'paw' },
      { r: 4, c: 2, part: 'paw' },
      { r: 4, c: 3, part: 'tail' },
    ],
    dogPose: 'starfish',
    obstacles: [
      { id: 'obs-duck-12', type: 'toy_duck', r: 1, c: 0 },
      { id: 'treat-bacon-12', type: 'treat_bacon', r: 5, c: 5 },
    ],
    boyfriendDefaultCells: BOYFRIEND_POSES[0].cells,
    girlfriendDefaultCells: GIRLFRIEND_POSES[0].cells,
    allowDogNudge: true,
    startingGrumpiness: 0,
    targetZenSeconds: 60,
  },
];

const ITEM_TYPES: Array<Obstacle['type']> = [
  'toy_duck',
  'toy_bone',
  'toy_ball',
  'treat_bone',
  'treat_bacon',
];

/**
 * Generate 1 to 3 random toys/treats placed on random empty bed squares.
 * Moves to new positions and varied amounts each round as requested!
 */
export function generateRandomBedItems(
  rows: number,
  cols: number,
  dogCells: Array<{ r: number; c: number }>,
  targetCount?: number
): Obstacle[] {
  // Count between 1 and 3 items each round
  const count =
    targetCount !== undefined
      ? targetCount
      : Math.floor(Math.random() * 3) + 1; // 1, 2, or 3 items

  const dogKeySet = new Set(dogCells.map((c) => `${c.r},${c.c}`));
  const availableCoords: Array<{ r: number; c: number }> = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!dogKeySet.has(`${r},${c}`)) {
        availableCoords.push({ r, c });
      }
    }
  }

  // Shuffle available coordinates
  for (let i = availableCoords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableCoords[i], availableCoords[j]] = [availableCoords[j], availableCoords[i]];
  }

  const chosenCoords = availableCoords.slice(0, Math.min(count, availableCoords.length));
  
  return chosenCoords.map((coord, idx) => {
    // Pick random item type with nice mix of toys and treats
    const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
    return {
      id: `random-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      r: coord.r,
      c: coord.c,
    };
  });
}

