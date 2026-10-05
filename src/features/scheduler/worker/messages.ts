import type {
  BalanceComparisonResult,
  SolveRequest,
} from "../types";

// UIからWorkerへ送る探索開始メッセージ。
export type SolverWorkerRequest = {
  requestId: number;
  type: "solve";
  payload: SolveRequest;
};

export type SolverWorkerProgress = {
  phase: "started" | "differenceCompleted";
  completedDifferenceCount: number;
  totalDifferenceCount: number;
  currentDifference: number | null;
  solved: boolean | null;
};

export type SolverWorkerProgressResponse = {
  requestId: number;
  type: "progress";
  progress: SolverWorkerProgress;
};

export type SolverWorkerResultResponse = {
  requestId: number;
  type: "result";
  result: BalanceComparisonResult;
};

export type SolverWorkerErrorResponse = {
  requestId: number;
  type: "error";
  message: string;
};

export type SolverWorkerResponse =
  | SolverWorkerProgressResponse
  | SolverWorkerResultResponse
  | SolverWorkerErrorResponse;
