import {
  EMPTY_SONG_ID,
  type Assignment,
  type SchedulerConfig,
  type ScoreResult,
  type ScoreTable,
  type TimeSlot,
} from "../types";
import {
  countDays,
  createEmptyScoreResult,
  createSongRules,
  validateScoreInput,
} from "./scoreHelpers";

// 日ごとの枠数を求め、日内番号を0～1の位置へ変換できるようにする。
function countSlotsByDay(scoreTable: ScoreTable): number[] {
  const slotCounts = Array.from({ length: countDays(scoreTable) }, () => 0);
  for (const timeSlot of scoreTable.timeSlots) {
    if (timeSlot.indexInDay < 0) {
      throw new Error("時間枠の日内番号が負です。");
    }
    slotCounts[timeSlot.dayIndex] = Math.max(
      slotCounts[timeSlot.dayIndex],
      timeSlot.indexInDay + 1,
    );
  }
  return slotCounts;
}

function relativeTimePosition(timeSlot: TimeSlot, slotCounts: number[]): number {
  const slotCount = slotCounts[timeSlot.dayIndex];
  return slotCount <= 1 ? 0.5 : timeSlot.indexInDay / (slotCount - 1);
}

// 比率を設定値に掛け、C++のlroundと同じ正数の四捨五入をする。
function penaltyFromRatio(penaltyUnit: number, ratio: number): number {
  const limitedRatio = Math.min(1, Math.max(0, ratio));
  const penalty = Math.round(Math.max(0, penaltyUnit) * limitedRatio);
  return penalty === 0 ? 0 : -penalty;
}

// 時間帯の偏りと、早め・遅め希望からのずれを微小点として計算する。
export function calculateTimeScore(
  scoreTable: ScoreTable,
  assignment: Assignment,
  config: SchedulerConfig,
): ScoreResult {
  validateScoreInput(scoreTable, assignment);

  const songCount = scoreTable.songs.length;
  const rules = createSongRules(scoreTable, config);
  const slotCounts = countSlotsByDay(scoreTable);
  const positionSums = Array.from({ length: songCount }, () => 0);
  const assignedCounts = Array.from({ length: songCount }, () => 0);

  assignment.assignedSongIds.forEach((songId, timeSlotId) => {
    if (songId === EMPTY_SONG_ID) {
      return;
    }
    if (songId < 0 || songId >= songCount) {
      throw new Error(`存在しない曲IDがあります。枠ID: ${timeSlotId}`);
    }
    positionSums[songId] += relativeTimePosition(
      scoreTable.timeSlots[timeSlotId],
      slotCounts,
    );
    assignedCounts[songId] += 1;
  });

  const result = createEmptyScoreResult();
  rules.forEach((rule, songId) => {
    if (assignedCounts[songId] === 0) {
      return;
    }

    const averagePosition = positionSums[songId] / assignedCounts[songId];
    if (assignedCounts[songId] >= 2 && rule.timePreference === "none") {
      result.timeBalancePenalty += penaltyFromRatio(
        rule.timeBalancePenalty,
        Math.abs(averagePosition - 0.5) * 2,
      );
    }

    if (rule.timePreference === "preferEarly") {
      result.timePreferencePenalty += penaltyFromRatio(
        rule.timePreferencePenalty,
        averagePosition,
      );
    } else if (rule.timePreference === "preferLate") {
      result.timePreferencePenalty += penaltyFromRatio(
        rule.timePreferencePenalty,
        1 - averagePosition,
      );
    }
  });

  result.timeTieBreakScore =
    result.timeBalancePenalty + result.timePreferencePenalty;
  result.totalScore = result.timeTieBreakScore;
  return result;
}
