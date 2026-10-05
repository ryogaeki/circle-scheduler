import { calculateDayConstraintScore } from "../score/dayConstraintScore";
import {
  EMPTY_SONG_ID,
  FORBIDDEN_SCORE,
  type Assignment,
  type SchedulerConfig,
  type ScoreTable,
  type SongRuleConfig,
} from "../types";
import { SeededRandom } from "./random";
import {
  buildSongRules,
  countSongs,
  createFixedSlotFlags,
  isBalancedWithinLimit,
} from "./solverHelpers";

function validateAssignment(
  scoreTable: ScoreTable,
  assignment: Assignment,
): void {
  if (assignment.assignedSongIds.length !== scoreTable.timeSlots.length) {
    throw new Error("Assignmentの枠数とtimeSlotsの数が一致しません。");
  }
  assignment.assignedSongIds.forEach((songId, timeSlotId) => {
    if (
      songId !== EMPTY_SONG_ID &&
      (songId < 0 || songId >= scoreTable.songs.length)
    ) {
      throw new Error(`Assignmentに存在しない曲IDがあります。枠ID: ${timeSlotId}`);
    }
  });
}

function collectMovableSlots(
  assignment: Assignment,
  fixedSlots: boolean[],
  filledOnly: boolean,
): number[] {
  return assignment.assignedSongIds
    .map((_, timeSlotId) => timeSlotId)
    .filter(
      (timeSlotId) =>
        !fixedSlots[timeSlotId] &&
        (!filledOnly ||
          assignment.assignedSongIds[timeSlotId] !== EMPTY_SONG_ID),
    );
}

function respectsCountRules(
  counts: number[],
  rules: SongRuleConfig[],
  config: SchedulerConfig,
): boolean {
  const respectsSongRules = counts.every((count, songId) => {
    const rule = rules[songId];
    return (
      (rule.targetCount < 0 || count === rule.targetCount) &&
      count >= rule.minCount &&
      (rule.maxCount === -1 || count <= rule.maxCount)
    );
  });
  return (
    respectsSongRules &&
    isBalancedWithinLimit(counts, config.balanceMaxDifference)
  );
}

// 非固定の2枠を入れ替え、曲数を変えない近傍を作る。
export function createSwapNeighbor(
  scoreTable: ScoreTable,
  assignment: Assignment,
  config: SchedulerConfig,
  random: SeededRandom,
): Assignment {
  validateAssignment(scoreTable, assignment);
  const fixedSlots = createFixedSlotFlags(scoreTable, config);
  const movableSlots = collectMovableSlots(assignment, fixedSlots, false);
  if (movableSlots.length < 2) {
    return assignment;
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const firstSlotId = movableSlots[random.int(movableSlots.length)];
    const secondSlotId = movableSlots[random.int(movableSlots.length)];
    if (firstSlotId === secondSlotId) {
      continue;
    }
    const firstSongId = assignment.assignedSongIds[firstSlotId];
    const secondSongId = assignment.assignedSongIds[secondSlotId];
    if (firstSongId === secondSongId) {
      continue;
    }
    if (
      (secondSongId !== EMPTY_SONG_ID &&
        scoreTable.slotSongScores[firstSlotId][secondSongId] ===
          FORBIDDEN_SCORE) ||
      (firstSongId !== EMPTY_SONG_ID &&
        scoreTable.slotSongScores[secondSlotId][firstSongId] === FORBIDDEN_SCORE)
    ) {
      continue;
    }

    const neighbor: Assignment = {
      assignedSongIds: [...assignment.assignedSongIds],
    };
    neighbor.assignedSongIds[firstSlotId] = secondSongId;
    neighbor.assignedSongIds[secondSlotId] = firstSongId;
    if (
      !calculateDayConstraintScore(scoreTable, neighbor, config).hasHardViolation
    ) {
      return neighbor;
    }
  }
  return assignment;
}

// 非固定の1枠を別の曲へ変え、許容された範囲で曲数も動かす。
export function createChangeSongNeighbor(
  scoreTable: ScoreTable,
  assignment: Assignment,
  config: SchedulerConfig,
  random: SeededRandom,
): Assignment {
  validateAssignment(scoreTable, assignment);
  if (config.countRuleMode === "fixedTarget") {
    return assignment;
  }

  const rules = buildSongRules(scoreTable, config);
  const fixedSlots = createFixedSlotFlags(scoreTable, config);
  const movableSlots = collectMovableSlots(assignment, fixedSlots, true);
  if (movableSlots.length === 0 || scoreTable.songs.length < 2) {
    return assignment;
  }
  const currentCounts = countSongs(scoreTable, assignment);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const timeSlotId = movableSlots[random.int(movableSlots.length)];
    const oldSongId = assignment.assignedSongIds[timeSlotId];
    const newSongId = random.int(scoreTable.songs.length);
    if (
      newSongId === oldSongId ||
      scoreTable.slotSongScores[timeSlotId][newSongId] === FORBIDDEN_SCORE
    ) {
      continue;
    }

    const nextCounts = [...currentCounts];
    nextCounts[oldSongId] -= 1;
    nextCounts[newSongId] += 1;
    if (!respectsCountRules(nextCounts, rules, config)) {
      continue;
    }

    const neighbor: Assignment = {
      assignedSongIds: [...assignment.assignedSongIds],
    };
    neighbor.assignedSongIds[timeSlotId] = newSongId;
    if (
      !calculateDayConstraintScore(scoreTable, neighbor, config).hasHardViolation
    ) {
      return neighbor;
    }
  }
  return assignment;
}
