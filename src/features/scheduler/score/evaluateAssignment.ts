import {
  EMPTY_SONG_ID,
  FORBIDDEN_SCORE,
  type Assignment,
  type EvaluateRequest,
  type EvaluateResult,
  type SchedulerConfig,
  type ScoreResult,
  type ScoreTable,
  type SongScoreBreakdown,
} from "../types";
import { calculateAssignmentRequestScore } from "./assignmentRequestScore";
import { calculateBaseScore } from "./baseScore";
import { calculateDayConstraintScore } from "./dayConstraintScore";
import { calculateDaySpacingScore } from "./daySpacingScore";
import { createEmptyScoreResult } from "./scoreHelpers";
import { calculateTimeScore } from "./timeScore";

// 絶対不可の×へ曲が入っていないか調べる。
function hasForbiddenAssignment(
  scoreTable: ScoreTable,
  assignment: Assignment,
): boolean {
  return assignment.assignedSongIds.some(
    (songId, timeSlotId) =>
      songId !== EMPTY_SONG_ID &&
      scoreTable.slotSongScores[timeSlotId][songId] === FORBIDDEN_SCORE,
  );
}

// C++版calculateScheduleScoreと同じ優先順位で予定案全体を採点する。
export function calculateScheduleScore(
  scoreTable: ScoreTable,
  assignment: Assignment,
  config: SchedulerConfig,
): ScoreResult {
  const result = createEmptyScoreResult();
  result.availabilityScore = calculateBaseScore(scoreTable, assignment);

  const dayScore = calculateDayConstraintScore(scoreTable, assignment, config);
  const spacingScore = calculateDaySpacingScore(scoreTable, assignment, config);
  const timeScore = calculateTimeScore(scoreTable, assignment, config);
  const requestScore = calculateAssignmentRequestScore(
    scoreTable,
    assignment,
    config,
  );

  result.dayConstraintPenalty = dayScore.dayConstraintPenalty;
  result.daySpacingPenalty = spacingScore.daySpacingPenalty;
  result.timeBalancePenalty = timeScore.timeBalancePenalty;
  result.timePreferencePenalty = timeScore.timePreferencePenalty;
  result.timeTieBreakScore = timeScore.timeTieBreakScore;
  result.assignmentRequestScore = requestScore.assignmentRequestScore;
  result.hasHardViolation =
    hasForbiddenAssignment(scoreTable, assignment) ||
    dayScore.hasHardViolation ||
    spacingScore.hasHardViolation ||
    timeScore.hasHardViolation ||
    requestScore.hasHardViolation;

  // 時間帯微小点は通常点が同じ予定の比較にだけ使う。
  result.totalScore =
    result.availabilityScore +
    result.dayConstraintPenalty +
    result.daySpacingPenalty +
    result.assignmentRequestScore;
  return result;
}

// 1曲だけを残した予定案を作り、その曲が得た点数を計算する。
function calculateSongBreakdown(
  scoreTable: ScoreTable,
  assignment: Assignment,
  config: SchedulerConfig,
  songId: number,
): SongScoreBreakdown {
  const assignedSongIds = assignment.assignedSongIds.map((assignedSongId) =>
    assignedSongId === songId ? songId : EMPTY_SONG_ID,
  );
  const songOnlyAssignment = { assignedSongIds };
  const dayScore = calculateDayConstraintScore(
    scoreTable,
    songOnlyAssignment,
    config,
  );
  const spacingScore = calculateDaySpacingScore(
    scoreTable,
    songOnlyAssignment,
    config,
  );
  const timeScore = calculateTimeScore(scoreTable, songOnlyAssignment, config);
  const availabilityScore = calculateBaseScore(scoreTable, songOnlyAssignment);

  let assignmentRequestScore = 0;
  for (const request of config.assignmentRequests) {
    if (
      !request.fixed &&
      request.songId === songId &&
      assignment.assignedSongIds[request.timeSlotId] === songId
    ) {
      assignmentRequestScore += Math.max(0, request.priority);
    }
  }

  return {
    songId,
    assignedCount: assignedSongIds.filter((id) => id === songId).length,
    primaryScore:
      availabilityScore +
      dayScore.dayConstraintPenalty +
      spacingScore.daySpacingPenalty +
      assignmentRequestScore,
    timeTieBreakScore:
      timeScore.timeBalancePenalty + timeScore.timePreferencePenalty,
    availabilityScore,
    dayConstraintPenalty: dayScore.dayConstraintPenalty,
    daySpacingPenalty: spacingScore.daySpacingPenalty,
    timeBalancePenalty: timeScore.timeBalancePenalty,
    timePreferencePenalty: timeScore.timePreferencePenalty,
    assignmentRequestScore,
  };
}

// UIが1回呼ぶだけで、全体点と曲別内訳を受け取れる公開関数。
export function evaluateAssignment(request: EvaluateRequest): EvaluateResult {
  const { scoreTable, assignment, config } = request;

  // 曲別計算の前に、割り当て要求のIDもまとめて検証する。
  calculateAssignmentRequestScore(scoreTable, assignment, config);
  const songScoreBreakdowns = scoreTable.songs.map((song) =>
    calculateSongBreakdown(scoreTable, assignment, config, song.id),
  );

  return {
    score: calculateScheduleScore(scoreTable, assignment, config),
    songScoreBreakdowns,
  };
}
