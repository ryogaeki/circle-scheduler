import { evaluateAssignment } from "../score/evaluateAssignment";
import { createFixedSlotFlags } from "../solver/solverHelpers";
import type {
  PreviewSwapRequest,
  PreviewSwapResult,
  ScoreDifference,
  ScoreResult,
  SwapViolationCode,
} from "../types";

function validateTimeSlotId(timeSlotId: number, timeSlotCount: number): void {
  if (timeSlotId < 0 || timeSlotId >= timeSlotCount) {
    throw new Error(`存在しない時間枠IDです: ${timeSlotId}`);
  }
}

// 画面で比較しやすいよう、交換後から交換前を引く。
function calculateScoreDifference(
  before: ScoreResult,
  after: ScoreResult,
): ScoreDifference {
  return {
    totalScore: after.totalScore - before.totalScore,
    timeTieBreakScore: after.timeTieBreakScore - before.timeTieBreakScore,
    availabilityScore: after.availabilityScore - before.availabilityScore,
    dayConstraintPenalty:
      after.dayConstraintPenalty - before.dayConstraintPenalty,
    countBalancePenalty:
      after.countBalancePenalty - before.countBalancePenalty,
    daySpacingPenalty: after.daySpacingPenalty - before.daySpacingPenalty,
    timeBalancePenalty: after.timeBalancePenalty - before.timeBalancePenalty,
    timePreferencePenalty:
      after.timePreferencePenalty - before.timePreferencePenalty,
    assignmentRequestScore:
      after.assignmentRequestScore - before.assignmentRequestScore,
  };
}

// 元の予定案は変更せず、2枠を交換した場合の点数と違反を返す。
export function previewSwap(request: PreviewSwapRequest): PreviewSwapResult {
  const {
    scoreTable,
    assignment,
    config,
    firstTimeSlotId,
    secondTimeSlotId,
  } = request;
  const timeSlotCount = scoreTable.timeSlots.length;
  validateTimeSlotId(firstTimeSlotId, timeSlotCount);
  validateTimeSlotId(secondTimeSlotId, timeSlotCount);

  const before = evaluateAssignment({ scoreTable, assignment, config });
  const assignedSongIds = [...assignment.assignedSongIds];
  [assignedSongIds[firstTimeSlotId], assignedSongIds[secondTimeSlotId]] = [
    assignedSongIds[secondTimeSlotId],
    assignedSongIds[firstTimeSlotId],
  ];
  const swappedAssignment = { assignedSongIds };
  const after = evaluateAssignment({
    scoreTable,
    assignment: swappedAssignment,
    config,
  });

  const violationCodes: SwapViolationCode[] = [];
  const fixedSlots = createFixedSlotFlags(scoreTable, config);
  if (firstTimeSlotId === secondTimeSlotId) {
    violationCodes.push("sameTimeSlot");
  } else if (
    assignment.assignedSongIds[firstTimeSlotId] ===
    assignment.assignedSongIds[secondTimeSlotId]
  ) {
    violationCodes.push("sameAssignment");
  }
  if (fixedSlots[firstTimeSlotId]) {
    violationCodes.push("firstSlotFixed");
  }
  if (fixedSlots[secondTimeSlotId]) {
    violationCodes.push("secondSlotFixed");
  }
  if (after.score.hasHardViolation) {
    violationCodes.push("hardConstraint");
  }

  return {
    allowed: violationCodes.length === 0,
    violationCodes,
    assignment: swappedAssignment,
    before,
    after,
    scoreDifference: calculateScoreDifference(before.score, after.score),
  };
}
