import { handleSolverWorkerRequest } from "./handleSolverWorkerRequest";
import type {
  SolverWorkerRequest,
  SolverWorkerResponse,
} from "./messages";

// DOM本体と混同せず、Workerで必要な機能だけを型として定義する。
type SchedulerWorkerScope = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<SolverWorkerRequest>) => void,
  ): void;
  postMessage(response: SolverWorkerResponse): void;
};

const workerScope = globalThis as unknown as SchedulerWorkerScope;

workerScope.addEventListener("message", (event) => {
  handleSolverWorkerRequest(event.data, (response) => {
    workerScope.postMessage(response);
  });
});
