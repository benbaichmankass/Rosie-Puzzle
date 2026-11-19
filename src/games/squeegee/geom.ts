/**
 * Scene geometry shared by the renderer modules. The scene is 390x600 "scene px"; real-world
 * proportions use about 1.7 px per cm (Bentzi ~1.75 m = ~300 px, counter at hip height).
 */
import * as S from './sim';

export const SW = 390;
export const SH = 600;
export const PX_PER_CM = 1.7;
const X0 = 14;
export const DX = (376 - X0) / (S.N - 1);
const Y_LOW = 548;
export const X = (i: number) => X0 + i * DX;
export const Y = (zCm: number) => Y_LOW - zCm * PX_PER_CM;

export const CEIL_Y = 64;
export const TILE_TOP = 330;
export const COUNTER_Y = Y(93); // sink counter top: hip height
export const CART_L = X(S.CART_FROM) + 1;
export const CART_R = X(S.N - 1) - 4;
/** y of each trolley tray floor (bottom, middle, top). */
export const TRAY_Y = S.SHELF_LEVELS.map((l) => Y(l - 2));
export const CART_TOP = Y(80);
export const HEAD: [number, number] = [56, 202]; // shower head nozzle

export function bedAt(bed: Float64Array, x: number): number {
  const i = Math.max(0, Math.min(S.N - 2, Math.floor(x)));
  const f = Math.max(0, Math.min(1, x - i));
  return bed[i] * (1 - f) + bed[i + 1] * f;
}
