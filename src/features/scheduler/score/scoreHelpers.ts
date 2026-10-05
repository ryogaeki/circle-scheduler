import { createDefaultSongRule } from "../defaultConfig";
import type {
  Assignment,
  SchedulerConfig,
  ScoreResult,
  ScoreTable,
  SongRuleConfig,
} from "../types";

// 各採点関数が必要な項目だけを書き換えられる初期値。
export function createEmptyScoreResult(): ScoreResult {
  return {
    totalScore: 0,
    timeTieBreakScore: 0,
    availabilityScore: 0,
    dayConstraintPenalty: 0,
    countBalancePenalty: 0,
    daySpacingPenalty: 0,
    timeBalancePenalty: 0,
    timePreferencePenalty: 0,
    assignmentRequestScore: 0,
    hasHardViolation: false,
  };
}

// スコア表と予定案の配列サイズを検証する。
export function validateScoreInput(
  scoreTable: ScoreTable,
  assignment: Assignment,
): void {
  if (scoreTable.slotSongScores.length !== scoreTable.timeSlots.length) {
    throw new Error("スコア表の行数と時間枠数が一致しません。");
  }

  scoreTable.slotSongScores.forEach((row, timeSlotId) => {
    if (row.length !== scoreTable.songs.length) {
      throw new Error(
        `スコア表の列数と曲数が一致しません。行番号: ${timeSlotId + 1}`,
      );
    }
  });

  if (assignment.assignedSongIds.length !== scoreTable.timeSlots.length) {
    throw new Error("割り当て数と時間枠数が一致しません。");
  }
}

// 省略された曲にはC++版と同じ初期設定を補う。
export function createSongRules(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
): SongRuleConfig[] {
  const rules = scoreTable.songs.map((_, songId) =>
    createDefaultSongRule(songId),
  );

  for (const rule of config.songRules) {
    if (rule.songId < 0 || rule.songId >= scoreTable.songs.length) {
      throw new Error("存在しない曲IDの設定があります。");
    }
    rules[rule.songId] = rule;
  }
  return rules;
}

// dayIndexの最大値から、予定表に含まれる日数を求める。
export function countDays(scoreTable: ScoreTable): number {
  let dayCount = 0;
  for (const timeSlot of scoreTable.timeSlots) {
    if (timeSlot.dayIndex < 0) {
      throw new Error("時間枠の日付番号が負です。");
    }
    dayCount = Math.max(dayCount, timeSlot.dayIndex + 1);
  }
  return dayCount;
}
