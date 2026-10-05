import { calculateDayConstraintScore } from "../score/dayConstraintScore";
import {
  EMPTY_SONG_ID,
  FORBIDDEN_SCORE,
  type Assignment,
  type AssignmentRequest,
  type SchedulerConfig,
  type ScoreTable,
  type SongRuleConfig,
} from "../types";
import { SeededRandom } from "./random";
import { maxFinalCountForDay } from "./slotCapacity";
import {
  buildSongRules,
  createFixedSlotFlags,
  requestBonusForSlotSong,
  validateScoreTableShape,
} from "./solverHelpers";

const UNSET_FIXED_SONG_ID = -2;
const BASE_SCORE_WEIGHT = 10;

function validateTargetCounts(
  scoreTable: ScoreTable,
  targetCounts: number[],
): void {
  if (targetCounts.length !== scoreTable.songs.length) {
    throw new Error("targetCountsの数と曲数が一致しません。");
  }
  targetCounts.forEach((count, songId) => {
    if (count < 0) {
      throw new Error(`targetCountsに負の値があります。曲ID: ${songId}`);
    }
  });
}

function validateRequestIds(
  scoreTable: ScoreTable,
  request: AssignmentRequest,
): void {
  if (
    request.timeSlotId < 0 ||
    request.timeSlotId >= scoreTable.timeSlots.length
  ) {
    throw new Error("存在しない時間枠IDの確定要求があります。");
  }
  if (request.songId === EMPTY_SONG_ID) {
    if (!request.fixed) {
      throw new Error("空白の割り当て要求はfixed=trueでのみ使えます。");
    }
    return;
  }
  if (request.songId < 0 || request.songId >= scoreTable.songs.length) {
    throw new Error("存在しない曲IDの確定要求があります。");
  }
}

function placeFixedAssignments(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  assignment: Assignment,
  remainingCounts: number[],
): void {
  const fixedSongBySlot = scoreTable.timeSlots.map(() => UNSET_FIXED_SONG_ID);
  for (const request of config.assignmentRequests) {
    if (!request.fixed) {
      continue;
    }
    validateRequestIds(scoreTable, request);
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

  fixedSongBySlot.forEach((songId, timeSlotId) => {
    if (songId === UNSET_FIXED_SONG_ID || songId === EMPTY_SONG_ID) {
      return;
    }
    if (remainingCounts[songId] <= 0) {
      throw new Error(`確定要求がtargetCountsより多い曲があります。曲ID: ${songId}`);
    }
    assignment.assignedSongIds[timeSlotId] = songId;
    remainingCounts[songId] -= 1;
  });
}

function remainingCapacityForSong(
  scoreTable: ScoreTable,
  assignment: Assignment,
  fixedSlots: boolean[],
  rule: SongRuleConfig,
  excludedTimeSlotId: number,
): number {
  const dayCount = scoreTable.timeSlots.reduce(
    (count, slot) => Math.max(count, slot.dayIndex + 1),
    0,
  );
  const assignedByDay = Array.from({ length: dayCount }, () => [] as number[]);
  const openByDay = Array.from({ length: dayCount }, () => [] as number[]);

  scoreTable.timeSlots.forEach((timeSlot, timeSlotId) => {
    if (assignment.assignedSongIds[timeSlotId] === rule.songId) {
      assignedByDay[timeSlot.dayIndex].push(timeSlot.indexInDay);
    } else if (
      timeSlotId !== excludedTimeSlotId &&
      !fixedSlots[timeSlotId] &&
      assignment.assignedSongIds[timeSlotId] === EMPTY_SONG_ID &&
      scoreTable.slotSongScores[timeSlotId][rule.songId] !== FORBIDDEN_SCORE
    ) {
      openByDay[timeSlot.dayIndex].push(timeSlot.indexInDay);
    }
  });

  return assignedByDay.reduce((capacity, assignedIndexes, dayIndex) => {
    const finalCount = maxFinalCountForDay(
      assignedIndexes,
      openByDay[dayIndex],
      rule,
    );
    return capacity + finalCount - assignedIndexes.length;
  }, 0);
}

function mandatorySongForSlot(
  scoreTable: ScoreTable,
  assignment: Assignment,
  remainingCounts: number[],
  rules: SongRuleConfig[],
  fixedSlots: boolean[],
  timeSlotId: number,
): number {
  let mandatorySongId = EMPTY_SONG_ID;
  for (let songId = 0; songId < remainingCounts.length; songId += 1) {
    if (
      remainingCounts[songId] <= 0 ||
      scoreTable.slotSongScores[timeSlotId][songId] === FORBIDDEN_SCORE
    ) {
      continue;
    }
    const capacityWithoutSlot = remainingCapacityForSong(
      scoreTable,
      assignment,
      fixedSlots,
      rules[songId],
      timeSlotId,
    );
    if (capacityWithoutSlot >= remainingCounts[songId]) {
      continue;
    }
    if (mandatorySongId !== EMPTY_SONG_ID && mandatorySongId !== songId) {
      return -2;
    }
    mandatorySongId = songId;
  }
  return mandatorySongId;
}

function createSlotOrder(
  scoreTable: ScoreTable,
  assignment: Assignment,
  remainingCounts: number[],
  fixedSlots: boolean[],
  random: SeededRandom,
): number[] {
  const candidateCount = (timeSlotId: number): number =>
    scoreTable.songs.filter(
      (_, songId) =>
        remainingCounts[songId] > 0 &&
        scoreTable.slotSongScores[timeSlotId][songId] !== FORBIDDEN_SCORE,
    ).length;

  const timeSlotIds = scoreTable.timeSlots
    .map((_, timeSlotId) => timeSlotId)
    .filter(
      (timeSlotId) =>
        assignment.assignedSongIds[timeSlotId] === EMPTY_SONG_ID &&
        !fixedSlots[timeSlotId],
    );
  random.shuffle(timeSlotIds);
  timeSlotIds.sort(
    (left, right) => candidateCount(left) - candidateCount(right),
  );
  return timeSlotIds;
}

function chooseSongForSlot(
  scoreTable: ScoreTable,
  remainingCounts: number[],
  assignment: Assignment,
  config: SchedulerConfig,
  rules: SongRuleConfig[],
  fixedSlots: boolean[],
  timeSlotId: number,
  random: SeededRandom,
): number {
  const mandatorySongId = mandatorySongForSlot(
    scoreTable,
    assignment,
    remainingCounts,
    rules,
    fixedSlots,
    timeSlotId,
  );
  if (mandatorySongId === -2) {
    return EMPTY_SONG_ID;
  }

  let bestScore = FORBIDDEN_SCORE;
  let candidates: number[] = [];
  for (let songId = 0; songId < scoreTable.songs.length; songId += 1) {
    if (
      remainingCounts[songId] <= 0 ||
      (mandatorySongId !== EMPTY_SONG_ID && songId !== mandatorySongId)
    ) {
      continue;
    }
    const baseScore = scoreTable.slotSongScores[timeSlotId][songId];
    if (baseScore === FORBIDDEN_SCORE) {
      continue;
    }

    const trialAssignment: Assignment = {
      assignedSongIds: [...assignment.assignedSongIds],
    };
    trialAssignment.assignedSongIds[timeSlotId] = songId;
    if (
      calculateDayConstraintScore(scoreTable, trialAssignment, config)
        .hasHardViolation
    ) {
      continue;
    }

    const score =
      baseScore * BASE_SCORE_WEIGHT +
      requestBonusForSlotSong(config, timeSlotId, songId);
    if (candidates.length === 0 || score > bestScore) {
      bestScore = score;
      candidates = [songId];
    } else if (score === bestScore) {
      candidates.push(songId);
    }
  }
  return candidates.length === 0
    ? EMPTY_SONG_ID
    : candidates[random.int(candidates.length)];
}

// 目標回数を守り、固定枠と絶対条件を満たす最初の予定案を貪欲に作る。
export function createInitialAssignment(
  scoreTable: ScoreTable,
  targetCounts: number[],
  config: SchedulerConfig,
): Assignment {
  validateScoreTableShape(scoreTable);
  validateTargetCounts(scoreTable, targetCounts);

  const assignment: Assignment = {
    assignedSongIds: scoreTable.timeSlots.map(() => EMPTY_SONG_ID),
  };
  const remainingCounts = [...targetCounts];
  const rules = buildSongRules(scoreTable, config);
  const fixedSlots = createFixedSlotFlags(scoreTable, config);
  const random = new SeededRandom(config.randomSeed);

  placeFixedAssignments(scoreTable, config, assignment, remainingCounts);
  if (
    calculateDayConstraintScore(scoreTable, assignment, config).hasHardViolation
  ) {
    throw new Error("確定要求が同日制限の絶対不可に違反しています。");
  }

  const timeSlotIds = createSlotOrder(
    scoreTable,
    assignment,
    remainingCounts,
    fixedSlots,
    random,
  );
  for (const timeSlotId of timeSlotIds) {
    const songId = chooseSongForSlot(
      scoreTable,
      remainingCounts,
      assignment,
      config,
      rules,
      fixedSlots,
      timeSlotId,
      random,
    );
    if (songId !== EMPTY_SONG_ID) {
      assignment.assignedSongIds[timeSlotId] = songId;
      remainingCounts[songId] -= 1;
    }
  }

  remainingCounts.forEach((count, songId) => {
    if (count !== 0) {
      const songName = scoreTable.songs[songId]?.name ?? `曲ID ${songId}`;
      throw new Error(
        `初期割り当てで固定回数を満たせません。` +
          `曲: ${songName}（ID ${songId}、残り${count}回）`,
      );
    }
  });
  return assignment;
}
