import {
  EMPTY_SONG_ID,
  type Assignment,
  type AssignmentRequest,
  type SchedulerConfig,
  type ScoreResult,
  type ScoreTable,
} from "../types";
import {
  createEmptyScoreResult,
  validateScoreInput,
} from "./scoreHelpers";

// 確定枠・希望枠が参照するIDを検証する。
function validateRequestIds(
  scoreTable: ScoreTable,
  request: AssignmentRequest,
): void {
  if (
    request.timeSlotId < 0 ||
    request.timeSlotId >= scoreTable.timeSlots.length
  ) {
    throw new Error("存在しない時間枠IDの割り当て要求があります。");
  }
  if (request.songId === EMPTY_SONG_ID) {
    if (!request.fixed) {
      throw new Error("空白の割り当て要求はfixed=trueでのみ使えます。");
    }
    return;
  }
  if (request.songId < 0 || request.songId >= scoreTable.songs.length) {
    throw new Error("存在しない曲IDの割り当て要求があります。");
  }
}

// 確定枠は違反判定、希望枠はpriority分の加点として扱う。
export function calculateAssignmentRequestScore(
  scoreTable: ScoreTable,
  assignment: Assignment,
  config: SchedulerConfig,
): ScoreResult {
  validateScoreInput(scoreTable, assignment);
  const result = createEmptyScoreResult();

  for (const request of config.assignmentRequests) {
    validateRequestIds(scoreTable, request);
    const assignedSongId = assignment.assignedSongIds[request.timeSlotId];

    if (request.fixed) {
      if (assignedSongId !== request.songId) {
        result.hasHardViolation = true;
      }
    } else if (assignedSongId === request.songId) {
      result.assignmentRequestScore += Math.max(0, request.priority);
    }
  }

  result.totalScore = result.assignmentRequestScore;
  return result;
}
