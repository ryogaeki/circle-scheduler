import {
  EMPTY_SONG_ID,
  FORBIDDEN_SCORE,
  type SchedulerConfig,
  type ScoreTable,
  type SongRuleConfig,
} from "../types";
import { SeededRandom } from "./random";
import {
  countAvailableSlotsBySong,
  countFillableSlots,
} from "./slotCapacity";
import {
  buildSongRules,
  isBalancedWithinLimit,
  requestBonusForSlotSong,
  validateScoreTableShape,
} from "./solverHelpers";

const UNSET_FIXED_SONG_ID = -2;
const BASE_SCORE_WEIGHT = 10;
const ASSIGNED_COUNT_WEIGHT = 6;

function countFixedAssignments(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
): number[] {
  const fixedCounts = scoreTable.songs.map(() => 0);
  const fixedSongBySlot = scoreTable.timeSlots.map(() => UNSET_FIXED_SONG_ID);

  for (const request of config.assignmentRequests) {
    if (!request.fixed) {
      continue;
    }
    if (
      request.timeSlotId < 0 ||
      request.timeSlotId >= scoreTable.timeSlots.length
    ) {
      throw new Error("存在しない時間枠IDの確定要求があります。");
    }
    if (
      request.songId !== EMPTY_SONG_ID &&
      (request.songId < 0 || request.songId >= scoreTable.songs.length)
    ) {
      throw new Error("存在しない曲IDの確定要求があります。");
    }
    const previous = fixedSongBySlot[request.timeSlotId];
    if (previous !== UNSET_FIXED_SONG_ID && previous !== request.songId) {
      throw new Error("同じ時間枠に異なる確定要求があります。");
    }
    if (
      request.songId !== EMPTY_SONG_ID &&
      scoreTable.slotSongScores[request.timeSlotId][request.songId] ===
        FORBIDDEN_SCORE
    ) {
      throw new Error("絶対不可の枠に確定要求があります。");
    }
    fixedSongBySlot[request.timeSlotId] = request.songId;
  }

  for (const songId of fixedSongBySlot) {
    if (songId !== UNSET_FIXED_SONG_ID && songId !== EMPTY_SONG_ID) {
      fixedCounts[songId] += 1;
    }
  }
  return fixedCounts;
}

function validateTargetCount(
  songId: number,
  targetCount: number,
  fixedCount: number,
  availableSlotCount: number,
  rule: SongRuleConfig,
): void {
  if (targetCount < fixedCount) {
    throw new Error(`targetCountが確定済み回数より少ない曲があります。曲ID: ${songId}`);
  }
  if (targetCount < rule.minCount) {
    throw new Error(`targetCountがminCountより少ない曲があります。曲ID: ${songId}`);
  }
  if (rule.maxCount !== -1 && targetCount > rule.maxCount) {
    throw new Error(`targetCountがmaxCountを超えた曲があります。曲ID: ${songId}`);
  }
  if (targetCount > availableSlotCount) {
    throw new Error(`targetCountを満たせる枠が足りない曲があります。曲ID: ${songId}`);
  }
}

function createFixedTargetCounts(
  scoreTable: ScoreTable,
  rules: SongRuleConfig[],
  fixedCounts: number[],
  availableSlotsBySong: number[],
  fillableSlotCount: number,
): number[] {
  const targetCounts = rules.map((rule, songId) => {
    if (rule.targetCount < 0) {
      throw new Error("FixedTargetでは全曲のtargetCountが必要です。");
    }
    validateTargetCount(
      songId,
      rule.targetCount,
      fixedCounts[songId],
      availableSlotsBySong[songId],
      rule,
    );
    return rule.targetCount;
  });
  if (targetCounts.reduce((sum, count) => sum + count, 0) > fillableSlotCount) {
    throw new Error("targetCountの合計が、曲を入れられる時間枠数を超えています。");
  }
  return targetCounts;
}

function canAddOneMore(
  songId: number,
  targetCounts: number[],
  availableSlotsBySong: number[],
  rules: SongRuleConfig[],
): boolean {
  const rule = rules[songId];
  return (
    rule.targetCount < 0 &&
    targetCounts[songId] < availableSlotsBySong[songId] &&
    (rule.maxCount === -1 || targetCounts[songId] < rule.maxCount)
  );
}

function fixedSlotRejectsSong(
  config: SchedulerConfig,
  timeSlotId: number,
  songId: number,
): boolean {
  const request = config.assignmentRequests.find(
    (item) => item.fixed && item.timeSlotId === timeSlotId,
  );
  return request !== undefined && request.songId !== songId;
}

function scoreForIncreasingSong(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  targetCounts: number[],
  songId: number,
): number {
  const potentialScores: number[] = [];
  scoreTable.timeSlots.forEach((_, timeSlotId) => {
    if (fixedSlotRejectsSong(config, timeSlotId, songId)) {
      return;
    }
    const baseScore = scoreTable.slotSongScores[timeSlotId][songId];
    if (baseScore !== FORBIDDEN_SCORE) {
      potentialScores.push(
        baseScore * BASE_SCORE_WEIGHT +
          requestBonusForSlotSong(config, timeSlotId, songId),
      );
    }
  });
  potentialScores.sort((left, right) => right - left);
  return potentialScores[targetCounts[songId]] ?? FORBIDDEN_SCORE;
}

function findSongToIncrease(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  targetCounts: number[],
  availableSlotsBySong: number[],
  rules: SongRuleConfig[],
  random: SeededRandom,
): number {
  const candidates: { songId: number; score: number }[] = [];
  for (let songId = 0; songId < targetCounts.length; songId += 1) {
    if (!canAddOneMore(songId, targetCounts, availableSlotsBySong, rules)) {
      continue;
    }
    const trialCounts = [...targetCounts];
    trialCounts[songId] += 1;
    if (!isBalancedWithinLimit(trialCounts, config.balanceMaxDifference)) {
      continue;
    }
    let score = scoreForIncreasingSong(scoreTable, config, targetCounts, songId);
    if (score === FORBIDDEN_SCORE) {
      continue;
    }
    score -= targetCounts[songId] * ASSIGNED_COUNT_WEIGHT;
    candidates.push({ songId, score });
  }

  candidates.sort((left, right) => right.score - left.score);
  if (candidates.length === 0) {
    return -1;
  }
  let selectableCount = 1;
  while (
    selectableCount < candidates.length &&
    selectableCount < 6 &&
    candidates[selectableCount].score >= candidates[0].score - 30
  ) {
    selectableCount += 1;
  }
  return candidates[random.int(selectableCount)].songId;
}

function createBalancedTargetCounts(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  rules: SongRuleConfig[],
  fixedCounts: number[],
  availableSlotsBySong: number[],
  totalAssignedCount: number,
): number[] {
  const targetCounts = rules.map((rule, songId) => {
    let count = fixedCounts[songId];
    if (rule.targetCount >= 0) {
      count = rule.targetCount;
    } else {
      count = Math.max(count, rule.minCount);
    }
    validateTargetCount(
      songId,
      count,
      fixedCounts[songId],
      availableSlotsBySong[songId],
      rule,
    );
    return count;
  });

  let remainingCount =
    totalAssignedCount - targetCounts.reduce((sum, count) => sum + count, 0);
  if (remainingCount < 0) {
    throw new Error("最低回数と確定要求の合計が、今回入れる枠数を超えています。");
  }

  const random = new SeededRandom(config.randomSeed);
  while (remainingCount > 0) {
    const songId = findSongToIncrease(
      scoreTable,
      config,
      targetCounts,
      availableSlotsBySong,
      rules,
      random,
    );
    if (songId === -1) {
      break;
    }
    targetCounts[songId] += 1;
    remainingCount -= 1;
  }

  if (remainingCount !== 0) {
    throw new Error("指定された枠数ぶんのtargetCountsを作れません。");
  }
  if (!isBalancedWithinLimit(targetCounts, config.balanceMaxDifference)) {
    throw new Error("各曲の回数差がbalanceMaxDifferenceを超えています。");
  }
  return targetCounts;
}

// BalanceではtotalAssignedCountを均等条件内で配り、FixedTargetでは指定回数を返す。
export function createTargetCounts(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  totalAssignedCount?: number,
): number[] {
  validateScoreTableShape(scoreTable);
  const rules = buildSongRules(scoreTable, config);
  const fixedCounts = countFixedAssignments(scoreTable, config);
  const availableSlotsBySong = countAvailableSlotsBySong(scoreTable, rules);
  const fillableSlotCount = countFillableSlots(scoreTable);

  if (config.countRuleMode === "fixedTarget") {
    if (totalAssignedCount !== undefined) {
      throw new Error("totalAssignedCount指定版はBalance用です。");
    }
    return createFixedTargetCounts(
      scoreTable,
      rules,
      fixedCounts,
      availableSlotsBySong,
      fillableSlotCount,
    );
  }

  const assignedCount = totalAssignedCount ?? fillableSlotCount;
  if (assignedCount < 0 || assignedCount > fillableSlotCount) {
    throw new Error("totalAssignedCountが曲を入れられる時間枠数の範囲外です。");
  }
  return createBalancedTargetCounts(
    scoreTable,
    config,
    rules,
    fixedCounts,
    availableSlotsBySong,
    assignedCount,
  );
}
