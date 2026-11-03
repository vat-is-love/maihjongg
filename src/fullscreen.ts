// SPDX-License-Identifier: GPL-3.0-or-later
import { icon } from './art';

// Expand immediately; if native fullscreen is unavailable/denied the same controls
// still fill the browser viewport. This also works in embedded previews.
export class FullscreenController {
  private expanded = false;
  private pending = false;
  private onClick = () => { void this.toggle(); };
  private onFullscreenChange = () => { this.setExpanded(document.fullscreenElement === this.shell); };
  private onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.expanded && !document.fullscreenElement && !document.querySelector('dialog[open]')) {
      event.preventDefault(); this.setExpanded(false);
    }
  };
  constructor(private shell: HTMLElement, private button: HTMLButtonElement) {
    button.addEventListener('click', this.onClick);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    document.addEventListener('keydown', this.onKeydown);
    this.setExpanded(false);
  }
  destroy() {
    this.button.removeEventListener('click', this.onClick);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('keydown', this.onKeydown);
    this.setExpanded(false);
  }
  private setExpanded(value: boolean) {
    this.expanded = value;
    this.shell.classList.toggle('is-expanded', value);
    document.body.classList.toggle('game-expanded', value);
    const label = value ? 'Выйти из полноэкранного режима' : 'На весь экран';
    this.button.title = label;
    this.button.setAttribute('aria-label', label);
    this.button.setAttribute('aria-pressed', String(value));
    this.button.innerHTML = icon(value ? 'collapse' : 'fullscreen', 17);
  }
  async toggle(): Promise<void> {
    if (this.pending) return;
    if (this.expanded) {
      if (document.fullscreenElement === this.shell) {
        this.pending = true;
        try { await document.exitFullscreen(); }
        catch { /* Keep the exit button usable if the browser rejects the request. */ }
        finally { this.pending = false; }
        this.setExpanded(document.fullscreenElement === this.shell);
      } else this.setExpanded(false);
      return;
    }
    this.setExpanded(true);
    if (document.fullscreenEnabled && typeof this.shell.requestFullscreen === 'function') {
      this.pending = true;
      try { await this.shell.requestFullscreen(); }
      catch { /* Expanded viewport is already visible; no dead button on denial. */ }
      finally { this.pending = false; }
    }
  }
}
