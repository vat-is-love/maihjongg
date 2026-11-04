// SPDX-License-Identifier: GPL-3.0-or-later
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { isValidGame, layoutId, type Game } from './game';
import type { Score } from './scores';

export interface Settings { highlightFree: boolean; reducedMotion: boolean; mobileMode: boolean; simpleEffects: boolean }
export interface Stats { wins: number; bestMs: number | null; completedIds: string[] }
interface Database extends DBSchema {
  state: { key: string; value: Game | Settings | Stats | Score[] };
}
export const DEFAULT_SETTINGS: Settings = { highlightFree: false, reducedMotion: false, mobileMode: false, simpleEffects: false };
export const DEFAULT_STATS: Stats = { wins: 0, bestMs: null, completedIds: [] };
let connection: Promise<IDBPDatabase<Database>> | undefined;
const db = () => connection ??= openDB<Database>('nephrite-mahjongg', 1, {
  upgrade(database) { database.createObjectStore('state'); },
  blocking() { void connection?.then(database => database.close()); connection = undefined; },
  terminated() { connection = undefined; },
}).catch(error => { connection = undefined; throw error; });

export async function loadSession(): Promise<{ game: Game | null; settings: Settings; stats: Stats; corrupt: boolean }> {
  const database = await db();
  const tx = database.transaction('state', 'readonly');
  const [saved, settings, stats] = await Promise.all([
    tx.store.get('game'), tx.store.get('settings'), tx.store.get('stats'),
  ]);
  await tx.done;
  const valid = isValidGame(saved);
  const preferences = settings as Partial<Settings> | undefined;
  const previous = stats as Partial<Stats> | undefined;
  return {
    game: valid ? saved : null, corrupt: saved !== undefined && !valid,
    settings: {
      highlightFree: preferences?.highlightFree === true,
      reducedMotion: preferences?.reducedMotion === true,
      mobileMode: preferences?.mobileMode === true,
      simpleEffects: preferences?.simpleEffects === true,
    },
    stats: previous && Number.isInteger(previous.wins) && (previous.wins ?? -1) >= 0 &&
      (previous.bestMs === null || (Number.isFinite(previous.bestMs) && previous.bestMs! >= 0)) &&
      Array.isArray(previous.completedIds) && previous.completedIds.every(id => typeof id === 'string')
      ? previous as Stats : structuredClone(DEFAULT_STATS),
  };
}

export async function saveSession(game: Game, settings: Settings): Promise<Stats> {
  const database = await db();
  const tx = database.transaction('state', 'readwrite');
  const stats = (await tx.store.get('stats') as Stats | undefined) ?? structuredClone(DEFAULT_STATS);
  if (game.history.length * 2 === game.faces.length && !stats.completedIds.includes(game.id)) {
    stats.wins++;
    stats.completedIds.push(game.id);
    stats.bestMs = stats.bestMs === null ? game.elapsedMs : Math.min(stats.bestMs, game.elapsedMs);
    const scores = (await tx.store.get('scores') as Score[] | undefined) ?? [];
    scores.push({ id: `local:${game.id}`, date: new Date(game.savedAt).toISOString(), layout: layoutId(game),
      elapsedMs: game.elapsedMs, player: '', source: 'local', hints: game.hints, shuffles: game.shuffles });
    await tx.store.put(scores, 'scores');
  }
  await Promise.all([
    tx.store.put(game, 'game'), tx.store.put(settings, 'settings'), tx.store.put(stats, 'stats'),
  ]);
  await tx.done;
  return stats;
}

export async function loadScores(): Promise<Score[]> {
  return (await (await db()).get('state', 'scores') as Score[] | undefined) ?? [];
}

export async function importScores(incoming: Score[]): Promise<number> {
  const tx = (await db()).transaction('state', 'readwrite');
  const scores = (await tx.store.get('scores') as Score[] | undefined) ?? [];
  const ids = new Set(scores.map(score => score.id));
  let added = 0;
  for (const score of incoming) {
    if (ids.has(score.id)) continue;
    ids.add(score.id); scores.push(score); added++;
  }
  await tx.store.put(scores, 'scores');
  await tx.done;
  return added;
}
