import type { Assignment } from "../types";

export type AssignmentHistory = {
  past: Assignment[];
  present: Assignment;
  future: Assignment[];
};

const HISTORY_LIMIT = 50;

function copyAssignment(assignment: Assignment): Assignment {
  return { assignedSongIds: [...assignment.assignedSongIds] };
}

function sameAssignment(left: Assignment, right: Assignment): boolean {
  return (
    left.assignedSongIds.length === right.assignedSongIds.length &&
    left.assignedSongIds.every(
      (songId, timeSlotId) => songId === right.assignedSongIds[timeSlotId],
    )
  );
}

// 候補から独立した、編集履歴の最初の状態を作る。
export function createAssignmentHistory(
  assignment: Assignment,
): AssignmentHistory {
  return {
    past: [],
    present: copyAssignment(assignment),
    future: [],
  };
}

// 新しい編集を追加し、やり直し側の履歴を破棄する。
export function pushAssignmentHistory(
  history: AssignmentHistory,
  assignment: Assignment,
): AssignmentHistory {
  if (sameAssignment(history.present, assignment)) {
    return history;
  }
  return {
    past: [...history.past, copyAssignment(history.present)].slice(
      -HISTORY_LIMIT,
    ),
    present: copyAssignment(assignment),
    future: [],
  };
}

// 直前の編集状態へ戻る。
export function undoAssignmentHistory(
  history: AssignmentHistory,
): AssignmentHistory {
  const previous = history.past.at(-1);
  if (!previous) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: copyAssignment(previous),
    future: [copyAssignment(history.present), ...history.future],
  };
}

// Undoで取り消した編集をもう一度反映する。
export function redoAssignmentHistory(
  history: AssignmentHistory,
): AssignmentHistory {
  const next = history.future[0];
  if (!next) {
    return history;
  }
  return {
    past: [...history.past, copyAssignment(history.present)].slice(
      -HISTORY_LIMIT,
    ),
    present: copyAssignment(next),
    future: history.future.slice(1),
  };
}
