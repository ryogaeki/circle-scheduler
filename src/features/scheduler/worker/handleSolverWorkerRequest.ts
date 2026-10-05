import { solveBalanceComparison } from "../solver/solveBalanceComparison";
import type {
  SolverWorkerRequest,
  SolverWorkerResponse,
} from "./messages";

export type PostSolverWorkerResponse = (
  response: SolverWorkerResponse,
) => void;

// Workerメッセージ1件をsolverへ渡し、進捗・結果・エラーを返信する。
export function handleSolverWorkerRequest(
  request: SolverWorkerRequest,
  postResponse: PostSolverWorkerResponse,
): void {
  const differenceCount =
    request.payload.config.countRuleMode === "fixedTarget"
      ? 1
      : request.payload.maxBalanceDifference -
        request.payload.minBalanceDifference +
        1;
  postResponse({
    requestId: request.requestId,
    type: "progress",
    progress: {
      phase: "started",
      completedDifferenceCount: 0,
      totalDifferenceCount: Math.max(0, differenceCount),
      currentDifference: null,
      solved: null,
    },
  });

  try {
    const { scoreTable, config, minBalanceDifference, maxBalanceDifference } =
      request.payload;
    const result = solveBalanceComparison(
      scoreTable,
      config,
      minBalanceDifference,
      maxBalanceDifference,
      (entry, completedCount, totalCount) => {
        postResponse({
          requestId: request.requestId,
          type: "progress",
          progress: {
            phase: "differenceCompleted",
            completedDifferenceCount: completedCount,
            totalDifferenceCount: totalCount,
            currentDifference: entry.maxDifference,
            solved: entry.solved,
          },
        });
      },
    );
    postResponse({ requestId: request.requestId, type: "result", result });
  } catch (error) {
    postResponse({
      requestId: request.requestId,
      type: "error",
      message: error instanceof Error ? error.message : "不明な探索エラーです。",
    });
  }
}
