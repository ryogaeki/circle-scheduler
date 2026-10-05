import {
  EMPTY_SONG_ID,
  type SchedulerConfig,
  type SchedulerResult,
  type ScoreTable,
} from "../types";
import { runAnnealing } from "./annealing";
import { addCandidateSorted } from "./candidateStore";
import { createInitialAssignment } from "./createInitialAssignment";
import { createTargetCounts } from "./createTargetCounts";
import { findMinBlankCount } from "./findMinBlankCount";

function createEmptyResult(trialCount: number): SchedulerResult {
  return {
    candidates: [],
    statistics: {
      minimumBlankCount: 0,
      attemptedTrialCount: trialCount,
      successfulTrialCount: 0,
      failedTrialCount: 0,
      targetCountFailureCount: 0,
      initialAssignmentFailureCount: 0,
      annealingFailureCount: 0,
    },
  };
}

// 曲数、初期案、焼きなましをseedごとに実行し、上位候補を返す。
export function solveScheduler(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
): SchedulerResult {
  const trialCount = Math.max(1, config.trialCount);
  const result = createEmptyResult(trialCount);
  let totalAssignedCount: number | undefined;
  let lastTrialError = "";

  if (config.countRuleMode === "balance") {
    result.statistics.minimumBlankCount = findMinBlankCount(scoreTable, config);
    totalAssignedCount =
      scoreTable.timeSlots.length - result.statistics.minimumBlankCount;
  }

  for (let trial = 0; trial < trialCount; trial += 1) {
    const trialConfig = {
      ...config,
      randomSeed: config.randomSeed + trial,
    };

    let targetCounts: number[];
    try {
      targetCounts = createTargetCounts(
        scoreTable,
        trialConfig,
        totalAssignedCount,
      );
    } catch (error) {
      if (config.countRuleMode === "fixedTarget") {
        throw error;
      }
      result.statistics.targetCountFailureCount += 1;
      result.statistics.failedTrialCount += 1;
      continue;
    }

    let initialAssignment;
    try {
      initialAssignment = createInitialAssignment(
        scoreTable,
        targetCounts,
        trialConfig,
      );
    } catch (error) {
      result.statistics.initialAssignmentFailureCount += 1;
      result.statistics.failedTrialCount += 1;
      lastTrialError =
        error instanceof Error ? error.message : "初期案を作れませんでした。";
      continue;
    }

    try {
      const candidate = runAnnealing(
        scoreTable,
        initialAssignment,
        trialConfig,
      );
      addCandidateSorted(result.candidates, candidate, config.candidateLimit);
      result.statistics.successfulTrialCount += 1;
    } catch (error) {
      result.statistics.annealingFailureCount += 1;
      result.statistics.failedTrialCount += 1;
      lastTrialError =
        error instanceof Error ? error.message : "焼きなましに失敗しました。";
    }
  }

  if (result.candidates.length === 0) {
    if (config.countRuleMode === "fixedTarget" && lastTrialError) {
      throw new Error(
        `回数固定の配置を${trialCount}回試しましたが作れませんでした。` +
          `最後の失敗: ${lastTrialError}`,
      );
    }
    throw new Error("予定候補を1つも作れませんでした。");
  }
  if (config.countRuleMode === "fixedTarget") {
    result.statistics.minimumBlankCount = result.candidates[0].assignment.assignedSongIds.filter(
      (songId) => songId === EMPTY_SONG_ID,
    ).length;
  }
  return result;
}
