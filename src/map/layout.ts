/**
 * House floor plan, traced from Ben's sketch (docs/map-sketch.jpg).
 * Units are sketch pixels; the map scales the whole plan to fit the screen.
 */
import type { RoomId, SpotId } from '../shared/types';

export interface Rect { x: number; y: number; w: number; h: number }

export const PLAN = { x: 590, y: 236, w: 850, h: 572 };

/** Each room is one or more rectangles (the yard is an L). */
export const ROOM_SHAPES: Record<RoomId, Rect[]> = {
  yard: [
    { x: 605, y: 358, w: 155, h: 435 },
    { x: 760, y: 740, w: 188, h: 53 },
  ],
  'living-room': [{ x: 760, y: 358, w: 188, h: 190 }],
  bedroom: [{ x: 760, y: 548, w: 188, h: 192 }],
  kitchen: [{ x: 908, y: 283, w: 324, h: 109 }],
  bathroom: [{ x: 1235, y: 246, w: 189, h: 147 }],
};

/** Where each room's label sits. */
export const ROOM_LABEL: Record<RoomId, { x: number; y: number }> = {
  yard: { x: 682, y: 560 },
  'living-room': { x: 854, y: 455 },
  bedroom: { x: 854, y: 645 },
  kitchen: { x: 1070, y: 340 },
  bathroom: { x: 1330, y: 320 },
};

/** Launch spots: the doors and walls that lead into each mini-game. */
export const SPOTS: Record<SpotId, { x: number; y: number; label: string }> = {
  'street-door': { x: 605, y: 430, label: 'Street door' },
  'bunny-wall': { x: 622, y: 625, label: 'Bunny wall' },
  'fps-wall': { x: 775, y: 778, label: 'Back wall' },
  bed: { x: 854, y: 690, label: 'Bed' },
  'living-floor': { x: 905, y: 505, label: 'Floor' },
  'living-windows': { x: 778, y: 395, label: 'Windows' },
  'kitchen-cabinets': { x: 990, y: 300, label: 'Cabinets' },
  'kitchen-counter': { x: 1160, y: 372, label: 'Counter' },
  'bathroom-floor': { x: 1300, y: 370, label: 'Floor' },
};

/** Doors and windows drawn on the plan (from the sketch). */
export const OPENINGS: { x1: number; y1: number; x2: number; y2: number; kind: 'door' | 'window' }[] = [
  { x1: 605, y1: 392, x2: 605, y2: 472, kind: 'door' }, // street door (to the boulevard)
  { x1: 760, y1: 418, x2: 760, y2: 482, kind: 'door' }, // front door, living room <-> yard
  { x1: 760, y1: 368, x2: 760, y2: 410, kind: 'window' },
  { x1: 760, y1: 495, x2: 760, y2: 548, kind: 'window' }, // window with AC
];

/** The turtle pool in the yard's bottom-left corner. */
export const TURTLE_POOL: Rect = { x: 617, y: 701, w: 91, h: 80 };
