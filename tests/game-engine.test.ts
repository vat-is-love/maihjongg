// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, expect, it, vi } from 'vitest';
import { GameEngine } from '../src/game-engine';
import { handleGameTask, runGameTask, type GameTaskRequest, type GameTaskResponse } from '../src/game-tasks';
import { availablePairs, isValidGame, newGame, removePair } from '../src/game';

class FakeWorker {
  static instances: FakeWorker[] = [];
  requests: GameTaskRequest[] = [];
  onmessage?: (event: { data: GameTaskResponse }) => void;
  onerror?: (event: { preventDefault: () => void }) => void;
  onmessageerror?: () => void;
  terminate = vi.fn();
  constructor(public url: URL, public options: WorkerOptions) { FakeWorker.instances.push(this); }
  postMessage(request: GameTaskRequest) { this.requests.push(structuredClone(request)); }
  respond(index: number) { this.onmessage?.({ data: handleGameTask(this.requests[index]) }); }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); FakeWorker.instances = []; });

it('uses one module worker and matches out-of-order replies to their requests', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const engine = new GameEngine();
  const first = engine.run({ kind: 'generate', layout: 'turtle', seed: 1 });
  const second = engine.run({ kind: 'generate', layout: 'islands-7x7', seed: 2 });
  expect(FakeWorker.instances).toHaveLength(1);
  const worker = FakeWorker.instances[0];
  expect(worker.options.type).toBe('module');
  expect(worker.url.pathname).toContain('game.worker.ts');
  worker.respond(1); worker.respond(0);
  expect((await first)!.faces).toEqual(newGame(1).faces);
  expect((await second)!.layout).toBe('islands-7x7');
  engine.dispose();
});
it('rejects all pending work after a crash and creates a fresh worker on retry', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const engine = new GameEngine();
  const first = engine.run({ kind: 'generate', layout: 'turtle' });
  const second = engine.run({ kind: 'generate', layout: 'turtle' });
  const rejectedFirst = expect(first).rejects.toThrow('Попробуйте ещё раз');
  const rejectedSecond = expect(second).rejects.toThrow('Попробуйте ещё раз');
  const worker = FakeWorker.instances[0];
  worker.onerror!({ preventDefault: vi.fn() });
  await Promise.all([rejectedFirst, rejectedSecond]);
  expect(worker.terminate).toHaveBeenCalledOnce();
  const retry = engine.run({ kind: 'generate', layout: 'turtle', seed: 3 });
  FakeWorker.instances[1].respond(0);
  expect(isValidGame(await retry)).toBe(true);
  engine.dispose();
});
it('returns task errors without losing the reusable worker', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const engine = new GameEngine();
  const failed = engine.run({ kind: 'generate', layout: 'missing' });
  const assertion = expect(failed).rejects.toThrow('Неизвестная раскладка');
  FakeWorker.instances[0].respond(0); await assertion;
  const retry = engine.run({ kind: 'generate', layout: 'turtle', seed: 4 });
  FakeWorker.instances[0].respond(1); await retry;
  expect(FakeWorker.instances).toHaveLength(1);
  engine.dispose();
});
it('supports environments without Worker after yielding to the event loop', async () => {
  vi.stubGlobal('Worker', undefined); vi.useFakeTimers();
  const result = new GameEngine().run({ kind: 'generate', layout: 'turtle', seed: 5 });
  await vi.advanceTimersByTimeAsync(0);
  expect((await result)!.faces).toEqual(newGame(5).faces);
});
it('shuffles a snapshot, preserving the live game and removed pairs', () => {
  const game = newGame(11);
  for (let i = 0; i < 4; i++) removePair(game, ...availablePairs(game)[0]);
  const original = structuredClone(game);
  const result = runGameTask({ kind: 'shuffle', game, seed: 77 })!;
  expect(game).toEqual(original);
  expect(result.history).toEqual(original.history);
  expect(result.shuffles).toBe(1);
  expect(isValidGame(result)).toBe(true);
  expect(availablePairs(result).length).toBeGreaterThan(0);
});
