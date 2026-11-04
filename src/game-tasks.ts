// SPDX-License-Identifier: GPL-3.0-or-later
import { newGame, shuffleRemaining, type Game } from './game';

export type GameTask = { kind: 'generate'; seed?: number; layout: string }
  | { kind: 'shuffle'; game: Game; seed?: number };
export type GameTaskRequest = { id: number; task: GameTask };
export type GameTaskResponse = { id: number; game: Game | null; error?: never }
  | { id: number; error: string; game?: never };

export function runGameTask(task: GameTask): Game | null {
  if (task.kind === 'generate') return newGame(task.seed, task.layout);
  // Never change the live game, even when the search fails or a worker dies.
  const game = structuredClone(task.game);
  return shuffleRemaining(game, task.seed) ? game : null;
}

export function handleGameTask({ id, task }: GameTaskRequest): GameTaskResponse {
  try { return { id, game: runGameTask(task) }; }
  catch (error) { return { id, error: error instanceof Error ? error.message : 'Не удалось подготовить поле.' }; }
}
