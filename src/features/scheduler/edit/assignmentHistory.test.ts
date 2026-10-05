import assert from "node:assert/strict";
import test from "node:test";

import {
  createAssignmentHistory,
  pushAssignmentHistory,
  redoAssignmentHistory,
  undoAssignmentHistory,
} from "./assignmentHistory";

test("編集を複数回Undo・Redoできる", () => {
  const original = { assignedSongIds: [0, 1, 2] };
  let history = createAssignmentHistory(original);
  history = pushAssignmentHistory(history, { assignedSongIds: [1, 0, 2] });
  history = pushAssignmentHistory(history, { assignedSongIds: [1, 2, 0] });

  history = undoAssignmentHistory(history);
  assert.deepEqual(history.present.assignedSongIds, [1, 0, 2]);
  history = undoAssignmentHistory(history);
  assert.deepEqual(history.present.assignedSongIds, [0, 1, 2]);
  history = redoAssignmentHistory(history);
  assert.deepEqual(history.present.assignedSongIds, [1, 0, 2]);
});

test("Undo後に新しく編集するとRedo履歴を破棄する", () => {
  let history = createAssignmentHistory({ assignedSongIds: [0, 1] });
  history = pushAssignmentHistory(history, { assignedSongIds: [1, 0] });
  history = undoAssignmentHistory(history);
  history = pushAssignmentHistory(history, { assignedSongIds: [-1, 0] });

  assert.equal(history.future.length, 0);
  assert.deepEqual(
    redoAssignmentHistory(history).present.assignedSongIds,
    [-1, 0],
  );
});
