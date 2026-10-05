import type { AssignmentHistory } from "../edit/assignmentHistory";
import type {
  BalanceComparisonResult,
  SchedulerConfig,
} from "../types";

const SESSION_KEY = "burusaa.scheduler.session.v1";
const PENDING_CSV_KEY = "burusaa.scheduler.pendingCsv.v1";

// リロード後に復元する、現在の予定作成作業。
export type StoredSchedulerSession = {
  version: 1;
  savedAt: string;
  fileName: string;
  csvText: string;
  timeSlotCount: number;
  songCount: number;
  config: SchedulerConfig;
  minBalanceDifference: number;
  maxBalanceDifference: number;
  comparison: BalanceComparisonResult | null;
  activeEntryIndex: number;
  activeCandidateId: number | null;
  draftHistory: AssignmentHistory | null;
};

// スタート画面から作業画面へ渡す、新しく選択されたCSV。
export type PendingCsv = {
  fileName: string;
  csvText: string;
};

function hasBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

export function loadSchedulerSession(): StoredSchedulerSession | null {
  if (!hasBrowserStorage()) {
    return null;
  }

  try {
    const text = window.localStorage.getItem(SESSION_KEY);
    if (!text) {
      return null;
    }
    const session = JSON.parse(text) as Partial<StoredSchedulerSession>;
    if (
      session.version !== 1 ||
      typeof session.fileName !== "string" ||
      typeof session.csvText !== "string" ||
      !session.config
    ) {
      return null;
    }
    return session as StoredSchedulerSession;
  } catch {
    return null;
  }
}

export function saveSchedulerSession(
  session: StoredSchedulerSession,
): boolean {
  if (!hasBrowserStorage()) {
    return false;
  }

  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearSchedulerSession(): void {
  if (!hasBrowserStorage()) {
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(PENDING_CSV_KEY);
}

export function loadPendingCsv(): PendingCsv | null {
  if (!hasBrowserStorage()) {
    return null;
  }

  try {
    const text = window.localStorage.getItem(PENDING_CSV_KEY);
    if (!text) {
      return null;
    }
    const pendingCsv = JSON.parse(text) as Partial<PendingCsv>;
    if (
      typeof pendingCsv.fileName !== "string" ||
      typeof pendingCsv.csvText !== "string"
    ) {
      return null;
    }
    return pendingCsv as PendingCsv;
  } catch {
    return null;
  }
}

export function savePendingCsv(pendingCsv: PendingCsv): boolean {
  if (!hasBrowserStorage()) {
    return false;
  }

  try {
    window.localStorage.setItem(PENDING_CSV_KEY, JSON.stringify(pendingCsv));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingCsv(): void {
  if (hasBrowserStorage()) {
    window.localStorage.removeItem(PENDING_CSV_KEY);
  }
}
