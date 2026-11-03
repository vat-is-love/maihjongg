// SPDX-License-Identifier: GPL-3.0-or-later
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { newGame, random, removalPath, removePair, undo } from '../src/game';
import { DEFAULT_SETTINGS, importScores, loadScores, loadSession, saveSession } from '../src/storage';
import { parseGnomeHistory } from '../src/scores';

describe('IndexedDB persistence', () => {
  it('restores moves, timer, preferences and counts a win exactly once', async () => {
    const game = newGame(23);
    game.elapsedMs = 123000;
    const path = removalPath(new Set(), random(23))!;
    for (const pair of path.slice(0, 4)) removePair(game, ...pair);
    undo(game);
    const settings = { ...DEFAULT_SETTINGS, highlightFree: true };
    await saveSession(game, settings);
    const loaded = await loadSession();
    expect(loaded.game).toEqual(game);
    expect(loaded.settings).toEqual(settings);
    expect(loaded.corrupt).toBe(false);
    for (const pair of path.slice(3)) removePair(game, ...pair);
    const stats = await saveSession(game, settings);
    expect(stats.wins).toBe(1);
    expect(stats.bestMs).toBe(123000);
    expect((await saveSession(game, settings)).wins).toBe(1);
    undo(game); await saveSession(game, settings);
    removePair(game, ...path.at(-1)!);
    expect((await saveSession(game, settings)).wins).toBe(1);
    const records = await loadScores();
    expect(records.filter(score => score.id === `local:${game.id}`)).toHaveLength(1);
    expect(records.find(score => score.id === `local:${game.id}`)).toMatchObject({ elapsedMs: 123000, hints: 0, shuffles: 0 });
  });
  it('merges imports atomically without duplicating records or altering local stats and game', async () => {
    const before = await loadSession();
    const records = parseGnomeHistory('2026-11-03T12:00:00Z turtle 90 Test Player\n2026-11-03T13:00:00Z pyramid 50').scores;
    const counts = await Promise.all([importScores(records), importScores(records)]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
    expect(await importScores(records)).toBe(0);
    expect((await loadScores()).filter(score => score.source === 'gnome')).toHaveLength(2);
    expect(await loadSession()).toEqual(before);
  });
});
