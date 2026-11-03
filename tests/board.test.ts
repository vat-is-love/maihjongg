// @vitest-environment happy-dom
// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../src/board';
import { newGame } from '../src/game';
import { tileColumn } from '../src/art';

let host: HTMLElement, board: Board;
const select = vi.fn();
function pointer(target: Element, type: string, x: number, y: number, pointerType = 'mouse', pointerId = 1) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, pointerType, pointerId }));
}
beforeEach(() => {
  select.mockClear();
  host = document.createElement('div'); document.body.append(host);
  host.setPointerCapture = vi.fn();
  board = new Board(host, select);
  board.render(newGame(42), null, null, false);
});
afterEach(() => { host.remove(); });

describe('Board pointer input', () => {
  it('selects immediately on mouse press even when the cursor keeps moving', () => {
    const tile = host.querySelector('.tile.free')!;
    const id = Number(tile.getAttribute('data-tile'));
    pointer(tile, 'pointermove', 70, 50);
    pointer(tile, 'pointerdown', 80, 50);
    expect(select).toHaveBeenCalledExactlyOnceWith(id);
    pointer(host, 'pointermove', 120, 50);
    pointer(host, 'pointerup', 130, 50);
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(select).toHaveBeenCalledTimes(1);
  });
  it('does not discard a quick second mouse press after a background drag', () => {
    const tile = host.querySelector('.tile.free')!;
    pointer(host, 'pointerdown', 20, 20);
    pointer(host, 'pointermove', 60, 20);
    pointer(host, 'pointerup', 60, 20);
    expect(select).not.toHaveBeenCalled();
    pointer(tile, 'pointerdown', 80, 50);
    expect(select).toHaveBeenCalledTimes(1);
  });
  it('allows finger jitter on a tap, and does not select during a touch drag', () => {
    const tile = host.querySelector('.tile.free')!;
    pointer(tile, 'pointerdown', 40, 50, 'touch');
    expect(select).not.toHaveBeenCalled();
    pointer(host, 'pointermove', 47, 53, 'touch');
    pointer(host, 'pointerup', 47, 53, 'touch');
    expect(select).toHaveBeenCalledTimes(1);
    select.mockClear();
    pointer(tile, 'pointerdown', 40, 50, 'touch');
    pointer(host, 'pointermove', 75, 50, 'touch');
    pointer(host, 'pointerup', 75, 50, 'touch');
    expect(select).not.toHaveBeenCalled();
  });
  it('does not select a tile after a pinch or a cancelled touch', () => {
    const tile = host.querySelector('.tile.free')!;
    pointer(tile, 'pointerdown', 40, 50, 'touch', 1);
    pointer(tile, 'pointerdown', 80, 50, 'touch', 2);
    pointer(host, 'pointerup', 80, 50, 'touch', 2);
    pointer(host, 'pointerup', 40, 50, 'touch', 1);
    pointer(tile, 'pointerdown', 40, 50, 'touch');
    pointer(host, 'pointercancel', 40, 50, 'touch');
    expect(select).not.toHaveBeenCalled();
  });
  it('preserves keyboard and accessibility activation', () => {
    const tile = host.querySelector('.tile.free')!;
    tile.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(select).toHaveBeenCalledTimes(2);
  });
});

describe('GNOME tile atlas', () => {
  it('renders normal and original blue selected sprites with unchanged proportions', () => {
    const game = newGame(42);
    const id = Number(host.querySelector('.tile.free')!.getAttribute('data-tile'));
    const tile = host.querySelector(`[data-tile="${id}"]`)!;
    const sprite = () => tile.querySelector('.tile-sprite-normal')!;
    const originalSprite = sprite();
    const selectedSprite = tile.querySelector('.tile-sprite-highlight')!;
    const originalMarkup = tile.innerHTML;
    expect(sprite().getAttribute('width')).toBe('64');
    expect(sprite().getAttribute('height')).toBe('88');
    expect(sprite().getAttribute('href')).toContain(',0,64,88)');
    board.render(game, id, null, false);
    expect(selectedSprite.getAttribute('href')).toContain(',88,64,88)');
    expect(host.querySelector(`[data-tile="${id}"]`)).toBe(tile);
    expect(sprite()).toBe(originalSprite);
    expect(tile.innerHTML).toBe(originalMarkup);
    expect(tile.classList.contains('selected')).toBe(true);
    board.render(game, null, null, false);
    expect(tile.classList.contains('selected')).toBe(false);
    expect(tile.innerHTML).toBe(originalMarkup);
  });
  it('maps the 36 match groups to all 42 face pictures, including four distinct bonuses', () => {
    const columns = Array.from({ length: 36 }, (_, face) =>
      Array.from({ length: face >= 34 ? 4 : 1 }, (_, variant) => tileColumn(face, variant))).flat();
    expect([...columns].sort((a, b) => a - b)).toEqual(Array.from({ length: 42 }, (_, i) => i));
    expect(tileColumn(27)).toBe(12); // East wind, not the first wind in the GNOME sheet.
    expect(tileColumn(33)).toBe(37); // White dragon lies between the bonus groups.
  });
});
