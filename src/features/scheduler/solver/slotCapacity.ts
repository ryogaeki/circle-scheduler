import {
  FORBIDDEN_SCORE,
  type ScoreTable,
  type SongRuleConfig,
} from "../types";

export function maxConsecutiveLength(indexes: number[]): number {
  const sorted = [...indexes].sort((left, right) => left - right);
  let bestLength = sorted.length === 0 ? 0 : 1;
  let currentLength = bestLength;
  for (let index = 1; index < sorted.length; index += 1) {
    currentLength = sorted[index] === sorted[index - 1] + 1
      ? currentLength + 1
      : 1;
    bestLength = Math.max(bestLength, currentLength);
  }
  return bestLength;
}

// まだ未配置の段階で、その日の利用可能枠に最大何回置けるか求める。
function dayCapacityForSong(
  availableIndexes: number[],
  rule: SongRuleConfig,
): number {
  if (availableIndexes.length === 0) {
    return 0;
  }
  if (rule.maxPerDayPolicy === "allowWithPenalty") {
    return availableIndexes.length;
  }
  const maxPerDay = Math.max(0, rule.maxPerDay);
  if (maxPerDay <= 1) {
    return Math.min(maxPerDay, availableIndexes.length);
  }
  if (rule.sameDayNonConsecutivePolicy === "forbidden") {
    return Math.min(maxPerDay, maxConsecutiveLength(availableIndexes));
  }
  return Math.min(maxPerDay, availableIndexes.length);
}

export function countAvailableSlotsBySong(
  scoreTable: ScoreTable,
  rules: SongRuleConfig[],
): number[] {
  const dayCount = scoreTable.timeSlots.reduce(
    (count, slot) => Math.max(count, slot.dayIndex + 1),
    0,
  );
  return scoreTable.songs.map((_, songId) => {
    const indexesByDay = Array.from({ length: dayCount }, () => [] as number[]);
    scoreTable.timeSlots.forEach((timeSlot, timeSlotId) => {
      if (scoreTable.slotSongScores[timeSlotId][songId] !== FORBIDDEN_SCORE) {
        indexesByDay[timeSlot.dayIndex].push(timeSlot.indexInDay);
      }
    });
    return indexesByDay.reduce(
      (capacity, indexes) => capacity + dayCapacityForSong(indexes, rules[songId]),
      0,
    );
  });
}

export function countFillableSlots(scoreTable: ScoreTable): number {
  return scoreTable.slotSongScores.filter((row) =>
    row.some((score) => score !== FORBIDDEN_SCORE),
  ).length;
}

// 一部配置済みの状態で、その日の最終配置数の上限を求める。
export function maxFinalCountForDay(
  assignedIndexes: number[],
  openIndexes: number[],
  rule: SongRuleConfig,
): number {
  let limit = assignedIndexes.length + openIndexes.length;
  if (rule.maxPerDayPolicy === "forbidden" && rule.maxPerDay >= 0) {
    limit = Math.min(limit, rule.maxPerDay);
  }
  if (limit <= 1) {
    return limit;
  }
  if (
    rule.sameDayConsecutivePolicy === "forbidden" &&
    rule.sameDayNonConsecutivePolicy === "forbidden"
  ) {
    return Math.min(limit, 1);
  }
  if (rule.sameDayNonConsecutivePolicy !== "forbidden") {
    return limit;
  }
  if (assignedIndexes.length === 0) {
    return Math.min(limit, maxConsecutiveLength(openIndexes));
  }

  const assigned = [...assignedIndexes].sort((left, right) => left - right);
  const usableSet = new Set([...assignedIndexes, ...openIndexes]);
  let firstUsable = assigned[0];
  let lastUsable = assigned[assigned.length - 1];
  while (usableSet.has(firstUsable - 1)) {
    firstUsable -= 1;
  }
  while (usableSet.has(lastUsable + 1)) {
    lastUsable += 1;
  }
  return Math.min(limit, lastUsable - firstUsable + 1);
}
