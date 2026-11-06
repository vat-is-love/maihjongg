// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import savedTurtle from './fixtures/turtle-save-v1.json';
import { SLOTS, LAYOUTS, MOBILE_LAYOUTS, nextMobileLayout, availablePairs, freeTiles, isFree, isValidGame, newGame, random, redo, removalPath, removePair, removedTiles, shuffleRemaining, undo, type Game } from '../src/game';

describe('Turtle rules', () => {
  it('has 144 unique slots, five layers and valid half-offset blockers', () => {
    expect(SLOTS).toHaveLength(144);
    expect(new Set(SLOTS.map(s => `${s.x},${s.y},${s.z}`)).size).toBe(144);
    const removed = new Set<number>();
    const top = SLOTS.find(s => s.z === 4)!;
    expect(isFree(top.id, removed)).toBe(true);
    for (const s of SLOTS.filter(s => s.z === 3)) expect(isFree(s.id, removed)).toBe(false);
    removed.add(top.id);
    for (const s of SLOTS.filter(s => s.z === 3)) expect(isFree(s.id, removed)).toBe(true);
    const middle = SLOTS.find(s => s.x === 6 && s.y === 0 && s.z === 0)!;
    expect(isFree(middle.id, removed)).toBe(false);
    const leftWing = SLOTS.find(s => s.x === 0)!;
    expect(isFree(leftWing.id, removed)).toBe(true);
  });
  it('generates reproducible, fully solvable boards with four of every face', () => {
    for (let seed = 0; seed < 60; seed++) {
      const game = newGame(seed);
      expect(newGame(seed).faces).toEqual(game.faces);
      expect(isValidGame(game)).toBe(true);
      const path = removalPath(new Set(), random(seed))!;
      expect(path).toHaveLength(72);
      for (const [a, b] of path) expect(removePair(game, a, b), `seed ${seed}, pair ${a},${b}`).toBe(true);
      expect(removedTiles(game).size).toBe(144);
      expect(availablePairs(game)).toHaveLength(0);
      expect(isValidGame(game)).toBe(true);
    }
  }, 20000);
  it('rejects blocked, duplicate and mismatched moves without changing history', () => {
    const game = newGame(42);
    const [a, b] = availablePairs(game)[0];
    expect(removePair(game, a, a)).toBe(false);
    expect(removePair(game, -1, a)).toBe(false);
    const closed = SLOTS.find(s => !isFree(s.id, new Set()))!.id;
    expect(removePair(game, a, closed)).toBe(false);
    const different = freeTiles(new Set()).find(i => game.faces[i] !== game.faces[a])!;
    expect(removePair(game, a, different)).toBe(false);
    expect(game.history).toHaveLength(0);
    expect(removePair(game, a, b)).toBe(true);
    expect(removePair(game, a, b)).toBe(false);
  });
  it('supports undo/redo, removes the redo branch after a fresh move', () => {
    const game = newGame(3);
    const pair = availablePairs(game)[0];
    removePair(game, ...pair);
    expect(undo(game)).toBe(true);
    expect(game.redo).toEqual([pair]);
    expect(isValidGame(game)).toBe(true);
    expect(redo(game)).toBe(true);
    expect(game.history).toEqual([pair]);
    undo(game); removePair(game, ...availablePairs(game)[0]);
    expect(game.redo).toHaveLength(0);
  });
  it('reshuffles only remaining tiles into a provably solvable continuation', () => {
    const game = newGame(11);
    const originalPath = removalPath(new Set(), random(11))!;
    for (const pair of originalPath.slice(0, 18)) removePair(game, ...pair);
    const previousFaces = [...game.faces];
    const removed = removedTiles(game);
    const path = removalPath(removed, random(77))!;
    expect(shuffleRemaining(game, 77)).toBe(true);
    expect(game.history).toHaveLength(18);
    for (const id of removed) expect(game.faces[id]).toBe(previousFaces[id]);
    expect(isValidGame(game)).toBe(true);
    expect(undo(game)).toBe(true);
    expect(isValidGame(game)).toBe(true);
    expect(redo(game)).toBe(true);
    for (const pair of path) expect(removePair(game, ...pair)).toBe(true);
    expect(game.history).toHaveLength(72);
  });
  it('rejects corrupt saved state instead of loading an invalid game', () => {
    const game = newGame(1);
    expect(isValidGame({ ...game, faces: [1] })).toBe(false);
    expect(isValidGame({ ...game, history: [[0, 0]] })).toBe(false);
    expect(isValidGame({ ...game, elapsedMs: NaN })).toBe(false);
    expect(isValidGame({ ...game, version: 2 })).toBe(false);
    const closed = SLOTS.find(s => !isFree(s.id, new Set()))!.id;
    expect(isValidGame({ ...game, redo: [[closed, 99]] })).toBe(false);
    expect(isValidGame(null)).toBe(false);
  });
});

// Each compact layout must have a legal complete path, including after shuffling.
describe('Compact layouts', () => {
  it('fits the advertised footprint and generates reproducible solvable deals', async () => {
    const { LAYOUTS } = await import('../src/game');
    for (const layout of MOBILE_LAYOUTS) {
      const width = layout.id.endsWith('6x8') ? 6 : 7;
      const height = layout.id.endsWith('6x8') ? 8 : 7;
      expect(Math.max(...layout.slots.map(s => s.x)) + 1).toBe(width);
      expect(Math.max(...layout.slots.map(s => s.y)) + 1).toBe(height);
      expect(new Set(layout.slots.map(s => `${s.x},${s.y},${s.z}`)).size).toBe(layout.slots.length);
      for (let seed = 0; seed < 30; seed++) {
        const game = newGame(seed, layout.id);
        expect(newGame(seed, layout.id).faces).toEqual(game.faces);
        expect(isValidGame(game)).toBe(true);
        const path = removalPath(new Set(), random(seed), layout.id)!;
        expect(path).toHaveLength(layout.slots.length / 2);
        for (const pair of path.slice(0, 5)) expect(removePair(game, ...pair)).toBe(true);
        undo(game); expect(isValidGame(game)).toBe(true); redo(game);
        const continuation = removalPath(removedTiles(game), random(77), layout.id)!;
        expect(shuffleRemaining(game, 77)).toBe(true);
        expect(isValidGame(game)).toBe(true);
        for (const pair of continuation) expect(removePair(game, ...pair)).toBe(true);
        expect(removedTiles(game).size).toBe(layout.slots.length);
        expect(isValidGame(game)).toBe(true);
        expect(shuffleRemaining(game)).toBe(false);
      }
    }
  }, 20000);
  it('restores legacy Turtle saves and rejects unknown or mismatched layouts', () => {
    const legacy = newGame(42);
    delete legacy.layout;
    expect(isValidGame(legacy)).toBe(true);
    expect(isValidGame({ ...legacy, layout: 'unknown' })).toBe(false);
    expect(isValidGame({ ...legacy, layout: 'garden-7x7' })).toBe(false);
  });
});


it('chooses only compact mobile layouts and never repeats the previous field', () => {
  expect(MOBILE_LAYOUTS).toHaveLength(6);
  for (const previous of LAYOUTS) for (let seed = 0; seed < 30; seed++) {
    const next = nextMobileLayout(previous.id, random(seed));
    expect(MOBILE_LAYOUTS.some(layout => layout.id === next)).toBe(true);
    expect(next).not.toBe(previous.id);
  }
});

it('preserves Turtle positions, IDs, seeded deals and existing saves after the MIT replacement', () => {
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect(hash(SLOTS)).toBe('f8274e63f4948ac4fcb483343998be8079f547cc46c55c5ba132c5482783f4ca');
  expect(hash(newGame(42).faces)).toBe('2948995e3b3a4a6d354fa59bf75e7076b31abe4e605c8bc596b8db640f1b1158');
  const game = structuredClone(savedTurtle) as Game;
  expect(isValidGame(game)).toBe(true);
  expect(redo(game)).toBe(true);
  expect(isValidGame(game)).toBe(true);
  expect(undo(game)).toBe(true);
  expect(game).toEqual(savedTurtle);
});
it('offers only Turtle and the six original compact layouts', () => {
  expect(LAYOUTS.map(layout => layout.id)).toEqual([
    'turtle', 'pyramid-6x8', 'terraces-6x8', 'twins-6x8', 'pyramid-7x7', 'garden-7x7', 'islands-7x7',
  ]);
  for (const layout of ['ziggurat', 'bridges', 'cloud', 'tictactoe', 'dragon', 'overpass', 'pyramid', 'confounding', 'difficult']) {
    expect(isValidGame({ ...savedTurtle, layout })).toBe(false);
  }
});
