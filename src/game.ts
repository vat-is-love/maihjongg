// SPDX-FileCopyrightText: 2026 Nephrite contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Turtle coordinates adapted from GNOME Mahjongg, data/maps/mahjongg.map.
// SPDX-FileCopyrightText: 2004-2025 Mahjongg Contributors

export interface Slot { id: number; x: number; y: number; z: number }
export type Pair = [number, number];
export interface Game {
  version: 1;
  id: string;
  seed: number;
  faces: number[];
  history: Pair[];
  redo: Pair[];
  elapsedMs: number;
  hints: number;
  shuffles: number;
  savedAt: number;
}

function turtle(): Slot[] {
  const slots: Slot[] = [];
  const add = (x: number, y: number, z: number) => slots.push({ id: slots.length, x, y, z });
  const rows = [[1, 12], [3, 10], [2, 11], [1, 12], [1, 12], [2, 11], [3, 10], [1, 12]];
  rows.forEach(([left, right], y) => { for (let x = left; x <= right; x++) add(x, y, 0); });
  add(0, 3.5, 0); add(13, 3.5, 0); add(14, 3.5, 0);
  for (let z = 1; z <= 3; z++) {
    for (let y = z; y <= 7 - z; y++) {
      for (let x = z + 3; x <= 10 - z; x++) add(x, y, z);
    }
  }
  add(6.5, 3.5, 4);
  return slots;
}

export const SLOTS = turtle();
const EPS = 0.001;
const overlaps = (a: number, b: number) => Math.abs(a - b) < 1 - EPS;
const blockers = SLOTS.map(a => ({
  above: SLOTS.filter(b => b.z > a.z && overlaps(a.x, b.x) && overlaps(a.y, b.y)).map(b => b.id),
  left: SLOTS.filter(b => b.z === a.z && Math.abs(b.x - a.x + 1) < EPS && overlaps(a.y, b.y)).map(b => b.id),
  right: SLOTS.filter(b => b.z === a.z && Math.abs(b.x - a.x - 1) < EPS && overlaps(a.y, b.y)).map(b => b.id),
}));

export function removedTiles(game: Game): Set<number> { return new Set(game.history.flat()); }
export function isFree(id: number, removed: Set<number>): boolean {
  const b = blockers[id];
  return !!b && !removed.has(id) && !b.above.some(i => !removed.has(i)) &&
    (!b.left.some(i => !removed.has(i)) || !b.right.some(i => !removed.has(i)));
}
export function freeTiles(removed: Set<number>): number[] {
  return SLOTS.filter(s => isFree(s.id, removed)).map(s => s.id);
}
export function availablePairs(game: Game): Pair[] {
  const free = freeTiles(removedTiles(game));
  const pairs: Pair[] = [];
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) {
      if (game.faces[free[a]] === game.faces[free[b]]) pairs.push([free[a], free[b]]);
    }
  }
  return pairs;
}

export function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ value >>> 15, 1 | value);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffled<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Find a complete geometric removal sequence, then assign matching faces to its pairs.
// Backtracking is bounded. A failed search never mutates the player's game.
export function removalPath(initialRemoved: Set<number>, rng: () => number): Pair[] | null {
  const removed = new Set(initialRemoved);
  const failed = new Set<string>();
  let budget = 40000;
  function search(): Pair[] | null {
    if (removed.size === SLOTS.length) return [];
    if (--budget <= 0) return null;
    const key = SLOTS.map(s => removed.has(s.id) ? '0' : '1').join('');
    if (failed.has(key)) return null;
    const free = shuffled(freeTiles(removed), rng);
    for (let a = 0; a < free.length - 1; a++) {
      for (let b = a + 1; b < free.length; b++) {
        const pair: Pair = [free[a], free[b]];
        removed.add(pair[0]); removed.add(pair[1]);
        const rest = search();
        removed.delete(pair[0]); removed.delete(pair[1]);
        if (rest) return [pair, ...rest];
        if (budget <= 0) return null;
      }
    }
    failed.add(key);
    return null;
  }
  return search();
}

export function newGame(seed = crypto.getRandomValues(new Uint32Array(1))[0]): Game {
  const rng = random(seed);
  const path = removalPath(new Set(), rng);
  if (!path) throw new Error('Не удалось подготовить раскладку. Попробуйте ещё раз.');
  const facePairs = shuffled(Array.from({ length: 72 }, (_, i) => Math.floor(i / 2)), rng);
  const faces = Array<number>(144).fill(0);
  path.forEach(([a, b], i) => { faces[a] = faces[b] = facePairs[i]; });
  // getRandomValues also works on a plain HTTP LAN preview; randomUUID requires HTTPS.
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { version: 1, id, seed, faces, history: [], redo: [], elapsedMs: 0,
    hints: 0, shuffles: 0, savedAt: Date.now() };
}

export function removePair(game: Game, a: number, b: number): boolean {
  const removed = removedTiles(game);
  if (a === b || !isFree(a, removed) || !isFree(b, removed) || game.faces[a] !== game.faces[b]) return false;
  game.history.push([a, b]); game.redo = [];
  return true;
}
export function undo(game: Game): boolean {
  const pair = game.history.pop();
  if (!pair) return false;
  game.redo.push(pair); return true;
}
export function redo(game: Game): boolean {
  const pair = game.redo.at(-1);
  if (!pair) return false;
  const removed = removedTiles(game);
  if (!isFree(pair[0], removed) || !isFree(pair[1], removed) || game.faces[pair[0]] !== game.faces[pair[1]]) return false;
  game.redo.pop(); game.history.push(pair); return true;
}
export function shuffleRemaining(game: Game, seed = crypto.getRandomValues(new Uint32Array(1))[0]): boolean {
  const rng = random(seed);
  const removed = removedTiles(game);
  if (removed.size === 144) return false;
  const path = removalPath(removed, rng);
  if (!path) return false;
  const counts = new Map<number, number>();
  SLOTS.filter(s => !removed.has(s.id)).forEach(s => counts.set(game.faces[s.id], (counts.get(game.faces[s.id]) ?? 0) + 1));
  const facePairs: number[] = [];
  for (const [face, count] of counts) {
    if (count % 2 !== 0) return false;
    for (let i = 0; i < count / 2; i++) facePairs.push(face);
  }
  const faces = shuffled(facePairs, rng);
  path.forEach(([a, b], i) => { game.faces[a] = game.faces[b] = faces[i]; });
  game.shuffles++; game.redo = [];
  // Previous moves concern removed tiles only; keep them so undo still has meaning.
  return true;
}

export function isValidGame(value: unknown): value is Game {
  if (!value || typeof value !== 'object') return false;
  const g = value as Game;
  const validPair = (p: unknown): p is Pair => Array.isArray(p) && p.length === 2 &&
    p.every(i => Number.isInteger(i) && i >= 0 && i < 144) && p[0] !== p[1];
  if (g.version !== 1 || typeof g.id !== 'string' || !Number.isInteger(g.seed) ||
    !Array.isArray(g.faces) || g.faces.length !== 144 || !g.faces.every(f => Number.isInteger(f) && f >= 0 && f < 36) ||
    !Array.isArray(g.history) || !g.history.every(validPair) || !Array.isArray(g.redo) || !g.redo.every(validPair) ||
    !Number.isFinite(g.elapsedMs) || g.elapsedMs < 0 || !Number.isInteger(g.hints) || g.hints < 0 ||
    !Number.isInteger(g.shuffles) || g.shuffles < 0 || !Number.isFinite(g.savedAt)) return false;
  const counts = Array<number>(36).fill(0);
  g.faces.forEach(f => counts[f]++);
  if (counts.some(c => c !== 4)) return false;
  const removed = new Set<number>();
  for (const [a, b] of g.history) {
    if (!isFree(a, removed) || !isFree(b, removed) || g.faces[a] !== g.faces[b]) return false;
    removed.add(a); removed.add(b);
  }
  for (const [a, b] of [...g.redo].reverse()) {
    if (!isFree(a, removed) || !isFree(b, removed) || g.faces[a] !== g.faces[b]) return false;
    removed.add(a); removed.add(b);
  }
  return true;
}
