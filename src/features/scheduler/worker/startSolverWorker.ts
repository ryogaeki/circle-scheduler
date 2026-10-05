import type { BalanceComparisonResult, SolveRequest } from "../types";
import type {
  SolverWorkerRequest,
  SolverWorkerResponse,
} from "./messages";

export type SolverWorkerRun = {
  result: Promise<BalanceComparisonResult>;
  cancel: () => void;
};

let nextRequestId = 1;

// 1回の探索専用Workerを開始し、終了後は自動で破棄する。
export function startSolverWorker(
  payload: SolveRequest,
  onProgress?: (
    progress: Extract<
      SolverWorkerResponse,
      { type: "progress" }
    >["progress"],
  ) => void,
): SolverWorkerRun {
  if (typeof Worker === "undefined") {
    throw new Error("Web Workerはブラウザ上でのみ開始できます。");
  }

  const requestId = nextRequestId;
  nextRequestId += 1;
  const worker = new Worker(new URL("./scheduler.worker.ts", import.meta.url), {
    type: "module",
  });
  let rejectResult: (reason: Error) => void = () => undefined;
  let settled = false;

  const result = new Promise<BalanceComparisonResult>((resolve, reject) => {
    rejectResult = reject;
    worker.onmessage = (event: MessageEvent<SolverWorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== requestId) {
        return;
      }
      if (response.type === "progress") {
        onProgress?.(response.progress);
        return;
      }

      settled = true;
      worker.terminate();
      if (response.type === "result") {
        resolve(response.result);
      } else {
        reject(new Error(response.message));
      }
    };
    worker.onerror = (event) => {
      settled = true;
      worker.terminate();
      reject(new Error(event.message || "Web Workerでエラーが発生しました。"));
    };
  });

  const request: SolverWorkerRequest = { requestId, type: "solve", payload };
  worker.postMessage(request);

  return {
    result,
    cancel: () => {
      if (settled) {
        return;
      }
      settled = true;
      worker.terminate();
      rejectResult(new Error("予定計算を中止しました。"));
    },
  };
}
