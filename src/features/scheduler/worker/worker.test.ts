import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultSchedulerConfig,
  createDefaultSongRule,
} from "../defaultConfig";
import type { SolveRequest } from "../types";
import { handleSolverWorkerRequest } from "./handleSolverWorkerRequest";
import type {
  SolverWorkerRequest,
  SolverWorkerResponse,
} from "./messages";
import { startSolverWorker } from "./startSolverWorker";

function createSolveRequest(): SolveRequest {
  const config = createDefaultSchedulerConfig();
  config.songRules = [createDefaultSongRule(0), createDefaultSongRule(1)];
  config.trialCount = 2;
  config.annealingIterations = 20;
  config.candidateLimit = 2;

  return {
    minBalanceDifference: 1,
    maxBalanceDifference: 2,
    config,
    scoreTable: {
      songs: [
        { id: 0, name: "曲A" },
        { id: 1, name: "曲B" },
      ],
      timeSlots: [
        { id: 0, label: "d0-0", dateKey: "d0", dayIndex: 0, indexInDay: 0 },
        { id: 1, label: "d0-1", dateKey: "d0", dayIndex: 0, indexInDay: 1 },
        { id: 2, label: "d1-0", dateKey: "d1", dayIndex: 1, indexInDay: 0 },
        { id: 3, label: "d1-1", dateKey: "d1", dayIndex: 1, indexInDay: 1 },
      ],
      slotSongScores: [
        [2, 1],
        [1, 2],
        [2, 1],
        [1, 2],
      ],
    },
  };
}

test("Workerハンドラーが進捗と最終結果を返す", () => {
  const responses: SolverWorkerResponse[] = [];
  handleSolverWorkerRequest(
    { requestId: 10, type: "solve", payload: createSolveRequest() },
    (response) => responses.push(response),
  );

  assert.equal(responses[0].type, "progress");
  assert.equal(
    responses.filter((response) => response.type === "progress").length,
    3,
  );
  const finalResponse = responses.at(-1);
  assert.equal(finalResponse?.type, "result");
  if (finalResponse?.type === "result") {
    assert.notEqual(finalResponse.result.selectedEntryIndex, -1);
  }
});

test("回数固定のWorker進捗を1件として返す", () => {
  const request = createSolveRequest();
  request.config.countRuleMode = "fixedTarget";
  request.config.songRules[0].targetCount = 1;
  request.config.songRules[1].targetCount = 1;
  const responses: SolverWorkerResponse[] = [];

  handleSolverWorkerRequest(
    { requestId: 11, type: "solve", payload: request },
    (response) => responses.push(response),
  );

  const progressResponses = responses.filter(
    (response) => response.type === "progress",
  );
  assert.equal(progressResponses.length, 2);
  assert.equal(progressResponses[0].progress.totalDifferenceCount, 1);
  assert.equal(responses.at(-1)?.type, "result");
});

test("ブラウザ側関数が模擬Workerから結果を受け取る", async () => {
  const originalWorker = globalThis.Worker;
  const progressPhases: string[] = [];

  class MockWorker {
    onmessage: ((event: MessageEvent<SolverWorkerResponse>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;

    postMessage(request: SolverWorkerRequest): void {
      queueMicrotask(() => {
        handleSolverWorkerRequest(request, (response) => {
          this.onmessage?.({ data: response } as MessageEvent<SolverWorkerResponse>);
        });
      });
    }

    terminate(): void {}
  }

  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: MockWorker,
  });

  try {
    const run = startSolverWorker(createSolveRequest(), (progress) => {
      progressPhases.push(progress.phase);
    });
    const result = await run.result;
    assert.notEqual(result.selectedEntryIndex, -1);
    assert.deepEqual(progressPhases, [
      "started",
      "differenceCompleted",
      "differenceCompleted",
    ]);
  } finally {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: originalWorker,
    });
  }
});

test("実行中のWorkerをキャンセルできる", async () => {
  const originalWorker = globalThis.Worker;

  class WaitingWorker {
    onmessage: ((event: MessageEvent<SolverWorkerResponse>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    postMessage(): void {}
    terminate(): void {}
  }

  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: WaitingWorker,
  });
  try {
    const run = startSolverWorker(createSolveRequest());
    run.cancel();
    await assert.rejects(run.result, /予定計算を中止しました/);
  } finally {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: originalWorker,
    });
  }
});
