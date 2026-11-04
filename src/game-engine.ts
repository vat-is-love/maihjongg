// SPDX-License-Identifier: GPL-3.0-or-later
import { runGameTask, type GameTask, type GameTaskResponse } from './game-tasks';
import type { Game } from './game';

// Reuse a single worker so subsequent deals do not pay its startup cost.
export class GameEngine {
  private worker?: Worker;
  private sequence = 0;
  private pending = new Map<number, { resolve: (game: Game | null) => void; reject: (error: Error) => void }>();

  async run(task: GameTask): Promise<Game | null> {
    // Compatibility path for browsers without Worker (and DOM-only test environments).
    if (typeof Worker === 'undefined') {
      await new Promise(resolve => setTimeout(resolve, 0));
      return runGameTask(task);
    }
    if (!this.worker) {
      this.worker = new Worker(new URL('./game.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<GameTaskResponse>) => {
        const response = event.data;
        const request = this.pending.get(response.id);
        if (!request) return;
        this.pending.delete(response.id);
        if (response.error !== undefined) request.reject(new Error(response.error));
        else request.resolve(response.game);
      };
      this.worker.onerror = event => {
        event.preventDefault();
        this.dispose('Не удалось выполнить расчёт поля. Попробуйте ещё раз.');
      };
      this.worker.onmessageerror = () => this.dispose('Не удалось получить поле. Попробуйте ещё раз.');
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try { this.worker!.postMessage({ id, task }); }
      catch (error) { this.pending.delete(id); reject(error); }
    });
  }

  dispose(message = 'Расчёт поля остановлен.') {
    this.worker?.terminate();
    this.worker = undefined;
    for (const request of this.pending.values()) request.reject(new Error(message));
    this.pending.clear();
  }
}
