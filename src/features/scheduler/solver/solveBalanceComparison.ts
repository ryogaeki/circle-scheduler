import type {
  BalanceComparisonEntry,
  BalanceComparisonResult,
  SchedulerConfig,
  SchedulerResult,
  ScoreTable,
} from "../types";
import { solveScheduler } from "./solveScheduler";

export type BalanceEntryCompleted = (
  entry: BalanceComparisonEntry,
  completedCount: number,
  totalCount: number,
) => void;

function emptySchedulerResult(): SchedulerResult {
  return {
    candidates: [],
    statistics: {
      minimumBlankCount: 0,
      attemptedTrialCount: 0,
      successfulTrialCount: 0,
      failedTrialCount: 0,
      targetCountFailureCount: 0,
      initialAssignmentFailureCount: 0,
      annealingFailureCount: 0,
    },
  };
}

function shouldSelectEntry(
  candidate: BalanceComparisonEntry,
  selected: BalanceComparisonEntry,
): boolean {
  const candidateStats = candidate.result.statistics;
  const selectedStats = selected.result.statistics;
  if (candidateStats.minimumBlankCount !== selectedStats.minimumBlankCount) {
    return candidateStats.minimumBlankCount < selectedStats.minimumBlankCount;
  }
  if (candidate.maxDifference !== selected.maxDifference) {
    return candidate.maxDifference < selected.maxDifference;
  }
  const candidateScore = candidate.result.candidates[0].score;
  const selectedScore = selected.result.candidates[0].score;
  return candidateScore.totalScore !== selectedScore.totalScore
    ? candidateScore.totalScore > selectedScore.totalScore
    : candidateScore.timeTieBreakScore > selectedScore.timeTieBreakScore;
}

// 曲数差ごとに別々に探索し、空白数、曲数差、点数の順で選ぶ。
export function solveBalanceComparison(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  minDifference: number,
  maxDifference: number,
  onEntryCompleted?: BalanceEntryCompleted,
): BalanceComparisonResult {
  if (minDifference < 0 || minDifference > maxDifference) {
    throw new Error("比較する曲数差の範囲が正しくありません。");
  }

  // 回数固定では曲数差を比較せず、指定された回数で1回だけ探索する。
  if (config.countRuleMode === "fixedTarget") {
    const entry: BalanceComparisonEntry = {
      maxDifference: 0,
      solved: false,
      errorMessage: "",
      result: emptySchedulerResult(),
    };
    try {
      entry.result = solveScheduler(scoreTable, config);
      entry.solved = true;
    } catch (error) {
      entry.errorMessage =
        error instanceof Error ? error.message : "不明な探索エラーです。";
    }
    onEntryCompleted?.(entry, 1, 1);
    if (!entry.solved) {
      throw new Error(entry.errorMessage);
    }
    return { entries: [entry], selectedEntryIndex: 0 };
  }

  const comparison: BalanceComparisonResult = {
    entries: [],
    selectedEntryIndex: -1,
  };
  const totalCount = maxDifference - minDifference + 1;
  for (
    let maxDifferenceValue = minDifference;
    maxDifferenceValue <= maxDifference;
    maxDifferenceValue += 1
  ) {
    const entry: BalanceComparisonEntry = {
      maxDifference: maxDifferenceValue,
      solved: false,
      errorMessage: "",
      result: emptySchedulerResult(),
    };
    try {
      entry.result = solveScheduler(scoreTable, {
        ...config,
        balanceMaxDifference: maxDifferenceValue,
      });
      entry.solved = true;
    } catch (error) {
      entry.errorMessage =
        error instanceof Error ? error.message : "不明な探索エラーです。";
    }

    comparison.entries.push(entry);
    const entryIndex = comparison.entries.length - 1;
    if (
      entry.solved &&
      (comparison.selectedEntryIndex === -1 ||
        shouldSelectEntry(
          entry,
          comparison.entries[comparison.selectedEntryIndex],
        ))
    ) {
      comparison.selectedEntryIndex = entryIndex;
    }
    onEntryCompleted?.(entry, comparison.entries.length, totalCount);
  }

  if (comparison.selectedEntryIndex === -1) {
    throw new Error("指定した曲数差では予定候補を作れませんでした。");
  }
  return comparison;
}
