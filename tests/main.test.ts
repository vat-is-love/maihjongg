// @vitest-environment happy-dom
// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { availablePairs, newGame, removePair, type Game, type Pair } from '../src/game';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from '../src/storage';

const session = vi.hoisted(() => ({ game: null as Game | null }));
vi.mock('../src/storage', async importOriginal => ({
  ...await importOriginal<typeof import('../src/storage')>(),
  loadSession: vi.fn(async () => ({ game: session.game, settings: DEFAULT_SETTINGS, stats: DEFAULT_STATS, corrupt: false })),
  saveSession: vi.fn(async () => DEFAULT_STATS),
}));
vi.mock('../src/fullscreen', () => ({ FullscreenController: class {} }));

function deadEnd() {
  const game = newGame(42);
  while (availablePairs(game).length) {
    const [a, b] = availablePairs(game)[0];
    removePair(game, a, b);
  }
  expect(game.history.length).toBeLessThan(72);
  return game;
}
async function start(game: Game) {
  session.game = game;
  await import('../src/main');
  await vi.waitFor(() => expect(document.querySelectorAll('.tile').length).toBeGreaterThan(0));
  for (const image of document.querySelectorAll('#board image')) image.dispatchEvent(new Event('load'));
}
function click(id: string) { document.querySelector<HTMLButtonElement>(id)!.click(); }
function play(pair: Pair) {
  for (const image of document.querySelectorAll('#board image')) image.dispatchEvent(new Event('load'));
  for (const id of pair) document.querySelector(`[data-tile="${id}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
}
beforeEach(() => { vi.resetModules(); document.body.innerHTML = '<div id="app"></div>'; vi.useFakeTimers(); });
afterEach(async () => { await vi.advanceTimersByTimeAsync(0); vi.clearAllTimers(); vi.useRealTimers(); document.body.innerHTML = ''; });

it('offers three actions for a restored dead end and highlights the new game button', async () => {
  await start(deadEnd());
  const dialog = document.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  expect(document.querySelector('#dialog-title')!.textContent).toBe('Доступных ходов больше нет');
  expect(document.querySelectorAll('.no-moves-actions button')).toHaveLength(3);
  expect(document.querySelector('#no-moves-new')!.classList.contains('primary')).toBe(true);
  click('#close-dialog');
  expect(dialog.open).toBe(false);
  click('#pause'); click('#pause');
  expect(dialog.open).toBe(false);
});
it('opens the menu immediately after the last available move, including redo', async () => {
  const game = deadEnd();
  const pair = game.history.pop()!;
  await start(game);
  expect(document.querySelector('dialog')!.open).toBe(false);
  play(pair);
  expect(document.querySelector('dialog')!.open).toBe(true);
  click('#close-dialog'); click('#undo'); click('#redo');
  expect(document.querySelector('dialog')!.open).toBe(true);
});
it('shuffles the remaining tiles while preserving removed pairs', async () => {
  const game = deadEnd(), history = structuredClone(game.history);
  await start(game);
  click('#no-moves-shuffle');
  await vi.advanceTimersByTimeAsync(40);
  expect(game.history).toEqual(history);
  expect(game.shuffles).toBe(1);
  expect(availablePairs(game).length).toBeGreaterThan(0);
  expect(document.querySelector('dialog')!.open).toBe(false);
});
it('restarts the original deal with the same seed and all 144 tiles', async () => {
  const game = deadEnd();
  await start(game);
  click('#no-moves-restart');
  await vi.advanceTimersByTimeAsync(40);
  expect(document.querySelectorAll('.tile')).toHaveLength(144);
  const original = newGame(game.seed);
  for (const tile of document.querySelectorAll<SVGSVGElement>('.tile')) {
    expect(tile.dataset.sprite!.split(':')[0]).toBe(String(original.faces[Number(tile.dataset.tile)]));
  }
  expect(document.querySelector('#timer')!.textContent).toBe('00:00');
  expect(document.querySelector('dialog')!.open).toBe(false);
});
it('starts a new game directly from the menu', async () => {
  await start(deadEnd());
  click('#no-moves-new');
  await vi.advanceTimersByTimeAsync(40);
  expect(document.querySelectorAll('.tile')).toHaveLength(144);
  expect(document.querySelector('dialog')!.open).toBe(false);
  expect(document.querySelector('#pairs')!.textContent).not.toBe('0');
});

it('updates only the affected tiles when selecting, switching and deselecting', async () => {
  const game = newGame(42);
  await start(game);
  const [a, b] = availablePairs(game)[0];
  const board = document.querySelector('#board')!;
  const observer = new MutationObserver(() => {});
  observer.observe(board, { subtree: true, attributes: true, childList: true });
  const activate = (id: number) => board.querySelector(`[data-tile="${id}"]`)!
    .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  activate(a);
  expect(observer.takeRecords().length).toBeLessThanOrEqual(2);
  expect(board.querySelector('.selected')!.getAttribute('data-tile')).toBe(String(a));
  activate(a);
  expect(observer.takeRecords().length).toBeLessThanOrEqual(2);
  expect(board.querySelector('.selected')).toBeNull();
  activate(a);
  observer.takeRecords();
  // Choosing a different face switches selection without changing the position.
  const other = [...board.querySelectorAll<SVGSVGElement>('.free')]
    .find(tile => game.faces[Number(tile.dataset.tile)] !== game.faces[a])!;
  activate(Number(other.dataset.tile));
  expect(observer.takeRecords().length).toBeLessThanOrEqual(4);
  expect(other.classList.contains('selected')).toBe(true);
  activate(a); activate(b);
  expect(board.querySelector(`[data-tile="${a}"]`)).toBeNull();
  expect(board.querySelector(`[data-tile="${b}"]`)).toBeNull();
  observer.disconnect();
});

it('toggles mobile controls and dismisses them when returning to the board', async () => {
  await start(newGame(42));
  const toggle = document.querySelector<HTMLButtonElement>('#toggle-controls')!;
  const shell = document.querySelector('.game-shell')!;
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  toggle.click();
  expect(shell.classList.contains('controls-open')).toBe(true);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const menu = document.querySelector<HTMLDetailsElement>('#game-menu')!;
  menu.open = true;
  document.querySelector('#board')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(menu.open).toBe(false);
  toggle.click();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

it('starts the chosen compact layout, updates totals, and can return to Turtle', async () => {
  await start(newGame(42));
  const select = document.querySelector<HTMLSelectElement>('#layout')!;
  expect(select.options).toHaveLength(7);
  select.value = 'garden-7x7';
  click('#new-game');
  await vi.advanceTimersByTimeAsync(40);
  expect(document.querySelectorAll('.tile')).toHaveLength(72);
  expect(document.querySelector('#remaining')!.textContent).toBe('72');
  expect(document.querySelector('.stat-total')!.textContent).toBe(' / 72');
  select.value = 'turtle'; click('#new-game');
  await vi.advanceTimersByTimeAsync(40);
  expect(document.querySelectorAll('.tile')).toHaveLength(144);
});

it('restores and restarts a compact deal with its layout and recognizes its final pair', async () => {
  const { random, removalPath } = await import('../src/game');
  const game = newGame(13, 'islands-7x7');
  const path = removalPath(new Set(), random(13), game.layout)!;
  for (const pair of path.slice(0, -1)) removePair(game, ...pair);
  await start(game);
  expect(document.querySelector<HTMLSelectElement>('#layout')!.value).toBe('islands-7x7');
  play(path.at(-1)!);
  expect(document.querySelector('.victory')).not.toBeNull();
  expect(document.querySelector('#remaining')!.textContent).toBe('0');
  click('#play-again'); await vi.advanceTimersByTimeAsync(40);
  expect(document.querySelectorAll('.tile')).toHaveLength(56);
  expect(document.querySelector<HTMLSelectElement>('#layout')!.value).toBe('islands-7x7');
});
