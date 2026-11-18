/**
 * Namespaced localStorage helpers. Every key is stored as `rgh:<gameId>:<key>`, so games
 * never collide. All calls are safe when storage is blocked (private mode etc.).
 */
const PREFIX = 'rgh';

export function load<T>(gameId: string, key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(`${PREFIX}:${gameId}:${key}`);
    if (s !== null) return JSON.parse(s) as T;
  } catch {}
  return fallback;
}

export function save(gameId: string, key: string, value: unknown): void {
  try {
    localStorage.setItem(`${PREFIX}:${gameId}:${key}`, JSON.stringify(value));
  } catch {}
}

export function getHighScore(gameId: string): number {
  return load<number>(gameId, 'hi', 0);
}

/** Saves the score if it beats the stored best. Returns true when it is a new best. */
export function submitScore(gameId: string, score: number): boolean {
  if (score > getHighScore(gameId)) {
    save(gameId, 'hi', score);
    return true;
  }
  return false;
}
