// SPDX-License-Identifier: GPL-3.0-or-later
import { handleGameTask, type GameTaskRequest, type GameTaskResponse } from './game-tasks';

const scope = self as unknown as {
  onmessage: (event: MessageEvent<GameTaskRequest>) => void;
  postMessage: (message: GameTaskResponse) => void;
};
scope.onmessage = event => scope.postMessage(handleGameTask(event.data));
