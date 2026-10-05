import { createDefaultSongRule } from "../defaultConfig";
import {
  EMPTY_SONG_ID,
  type Assignment,
  type SchedulerConfig,
  type ScoreTable,
  type SongRuleConfig,
} from "../types";

export function validateScoreTableShape(scoreTable: ScoreTable): void {
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
}

// 設定がない曲には、C++版と同じ初期値を補う。
export function buildSongRules(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
): SongRuleConfig[] {
  const rules = scoreTable.songs.map((_, songId) =>
    createDefaultSongRule(songId),
  );
  const alreadySet = new Set<number>();

  for (const rule of config.songRules) {
    if (rule.songId < 0 || rule.songId >= scoreTable.songs.length) {
      throw new Error("存在しない曲IDの設定があります。");
    }
    if (alreadySet.has(rule.songId)) {
      throw new Error("同じ曲IDの設定が複数あります。");
    }
    if (rule.targetCount < -1 || rule.minCount < 0 || rule.maxCount < -1) {
      throw new Error("曲ごとの回数設定に不正な負の値があります。");
    }
    if (rule.maxCount !== -1 && rule.minCount > rule.maxCount) {
      throw new Error("minCountがmaxCountを超えています。");
    }
    rules[rule.songId] = rule;
    alreadySet.add(rule.songId);
  }
  return rules;
}

export function createFixedSlotFlags(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
): boolean[] {
  const fixedSlots = Array.from(
    { length: scoreTable.timeSlots.length },
    () => false,
  );
  for (const request of config.assignmentRequests) {
    if (!request.fixed) {
      continue;
    }
    if (
      request.timeSlotId < 0 ||
      request.timeSlotId >= fixedSlots.length
    ) {
      throw new Error("存在しない時間枠IDの確定要求があります。");
    }
    fixedSlots[request.timeSlotId] = true;
  }
  return fixedSlots;
}

export function countSongs(
  scoreTable: ScoreTable,
  assignment: Assignment,
): number[] {
  const counts = Array.from({ length: scoreTable.songs.length }, () => 0);
  for (const songId of assignment.assignedSongIds) {
    if (songId !== EMPTY_SONG_ID) {
      counts[songId] += 1;
    }
  }
  return counts;
}

export function isBalancedWithinLimit(
  counts: number[],
  maxDifference: number,
): boolean {
  if (counts.length === 0) {
    return true;
  }
  return (
    Math.max(...counts) - Math.min(...counts) <= Math.max(0, maxDifference)
  );
}

export function requestBonusForSlotSong(
  config: SchedulerConfig,
  timeSlotId: number,
  songId: number,
): number {
  return config.assignmentRequests.reduce((bonus, request) => {
    if (
      !request.fixed &&
      request.timeSlotId === timeSlotId &&
      request.songId === songId
    ) {
      return bonus + Math.max(0, request.priority);
    }
    return bonus;
  }, 0);
}
