import {
  EMPTY_SONG_ID,
  type Assignment,
  type SchedulerConfig,
  type ScoreResult,
  type ScoreTable,
} from "../types";
import {
  countDays,
  createEmptyScoreResult,
  createSongRules,
  validateScoreInput,
} from "./scoreHelpers";

// 同じ日の枠番号が、途中で途切れず連続しているか調べる。
function isConsecutiveBlock(indexesInDay: number[]): boolean {
  const sortedIndexes = [...indexesInDay].sort((left, right) => left - right);
  return sortedIndexes.every(
    (indexInDay, index) =>
      index === 0 || indexInDay === sortedIndexes[index - 1] + 1,
  );
}

// 同日連続・非連続・1日上限の違反と減点を計算する。
export function calculateDayConstraintScore(
  scoreTable: ScoreTable,
  assignment: Assignment,
  config: SchedulerConfig,
): ScoreResult {
  validateScoreInput(scoreTable, assignment);

  const songCount = scoreTable.songs.length;
  const rules = createSongRules(scoreTable, config);
  const slotIndexes = Array.from({ length: countDays(scoreTable) }, () =>
    Array.from({ length: songCount }, () => [] as number[]),
  );

  assignment.assignedSongIds.forEach((songId, timeSlotId) => {
    if (songId === EMPTY_SONG_ID) {
      return;
    }
    if (songId < 0 || songId >= songCount) {
      throw new Error(`存在しない曲IDがあります。枠ID: ${timeSlotId}`);
    }

    const timeSlot = scoreTable.timeSlots[timeSlotId];
    slotIndexes[timeSlot.dayIndex][songId].push(timeSlot.indexInDay);
  });

  const result = createEmptyScoreResult();
  for (const indexesBySong of slotIndexes) {
    indexesBySong.forEach((indexesInDay, songId) => {
      const count = indexesInDay.length;
      if (count <= 1) {
        return;
      }

      const rule = rules[songId];
      if (isConsecutiveBlock(indexesInDay)) {
        if (rule.sameDayConsecutivePolicy === "forbidden") {
          result.hasHardViolation = true;
        } else {
          result.dayConstraintPenalty -= Math.max(
            0,
            rule.sameDayConsecutivePenalty,
          );
        }
      } else if (rule.sameDayNonConsecutivePolicy === "forbidden") {
        result.hasHardViolation = true;
      } else {
        result.dayConstraintPenalty -= Math.max(
          0,
          rule.sameDayNonConsecutivePenalty,
        );
      }

      if (rule.maxPerDay >= 0 && count > rule.maxPerDay) {
        if (rule.maxPerDayPolicy === "forbidden") {
          result.hasHardViolation = true;
        } else {
          result.dayConstraintPenalty -=
            Math.max(0, rule.maxPerDayPenalty) * (count - rule.maxPerDay);
        }
      }
    });
  }

  result.totalScore = result.dayConstraintPenalty;
  return result;
}
