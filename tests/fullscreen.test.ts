// @vitest-environment happy-dom
// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenController } from '../src/fullscreen';

let shell: HTMLElement, button: HTMLButtonElement, fullscreen: FullscreenController;
beforeEach(() => {
  shell = document.createElement('section'); button = document.createElement('button');
  shell.append(button); document.body.append(shell);
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
  fullscreen = new FullscreenController(shell, button);
});
afterEach(() => { fullscreen.destroy(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('Fullscreen controls', () => {
  it('expands in an embedded browser without the native API, and toggles back', async () => {
    button.click();
    expect(shell.classList.contains('is-expanded')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Выйти из полноэкранного режима');
    await fullscreen.toggle();
    expect(shell.classList.contains('is-expanded')).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
  it('uses native fullscreen when supported and follows browser escape', async () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    shell.requestFullscreen = vi.fn(async () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: shell });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    await fullscreen.toggle();
    expect(shell.requestFullscreen).toHaveBeenCalledOnce();
    expect(shell.classList.contains('is-expanded')).toBe(true);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(shell.classList.contains('is-expanded')).toBe(false);
  });
  it('retains viewport expansion if the browser rejects native fullscreen', async () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    shell.requestFullscreen = vi.fn().mockRejectedValue(new Error('Not allowed'));
    await fullscreen.toggle();
    expect(shell.classList.contains('is-expanded')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(shell.classList.contains('is-expanded')).toBe(false);
  });
  it('lets Escape close a dialog before leaving the expanded game', async () => {
    await fullscreen.toggle();
    const dialog = document.createElement('dialog'); dialog.setAttribute('open', ''); document.body.append(dialog);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(shell.classList.contains('is-expanded')).toBe(true);
    dialog.remove();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(shell.classList.contains('is-expanded')).toBe(false);
  });
});
