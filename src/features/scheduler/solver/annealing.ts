import {
  calculateScheduleScore,
  evaluateAssignment,
} from "../score/evaluateAssignment";
import {
  EMPTY_SONG_ID,
  FORBIDDEN_SCORE,
  type Assignment,
  type ScheduleCandidate,
  type SchedulerConfig,
  type ScoreResult,
  type ScoreTable,
} from "../types";
import {
  createChangeSongNeighbor,
  createSwapNeighbor,
} from "./neighbor";
import { SeededRandom } from "./random";
import { createFixedSlotFlags } from "./solverHelpers";

function isScoreBetter(left: ScoreResult, right: ScoreResult): boolean {
  return left.totalScore !== right.totalScore
    ? left.totalScore > right.totalScore
    : left.timeTieBreakScore > right.timeTieBreakScore;
}

function scoreDifference(next: ScoreResult, current: ScoreResult): number {
  const primaryDifference = next.totalScore - current.totalScore;
  return primaryDifference !== 0
    ? primaryDifference
    : next.timeTieBreakScore - current.timeTieBreakScore;
}

function temperatureAt(iteration: number, config: SchedulerConfig): number {
  const lastIteration = Math.max(1, config.annealingIterations - 1);
  const progress = iteration / lastIteration;
  return (
    config.startTemperature +
    (config.endTemperature - config.startTemperature) * progress
  );
}

// 焼きなまし後に、曲数を変えず空白と曲を全探索で入れ替えて改善する。
function repairBlankPlacement(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  initialAssignment: Assignment,
  initialScore: ScoreResult,
): { assignment: Assignment; score: ScoreResult } {
  const fixedSlots = createFixedSlotFlags(scoreTable, config);
  let assignment = initialAssignment;
  let score = initialScore;
  let improved = true;

  while (improved) {
    improved = false;
    let bestAssignment = assignment;
    let bestScore = score;

    assignment.assignedSongIds.forEach((blankSongId, blankSlotId) => {
      if (fixedSlots[blankSlotId] || blankSongId !== EMPTY_SONG_ID) {
        return;
      }
      assignment.assignedSongIds.forEach((songId, filledSlotId) => {
        if (
          fixedSlots[filledSlotId] ||
          songId === EMPTY_SONG_ID ||
          scoreTable.slotSongScores[blankSlotId][songId] === FORBIDDEN_SCORE
        ) {
          return;
        }

        const trialAssignment: Assignment = {
          assignedSongIds: [...assignment.assignedSongIds],
        };
        trialAssignment.assignedSongIds[blankSlotId] = songId;
        trialAssignment.assignedSongIds[filledSlotId] = EMPTY_SONG_ID;
        const trialScore = calculateScheduleScore(
          scoreTable,
          trialAssignment,
          config,
        );
        if (!trialScore.hasHardViolation && isScoreBetter(trialScore, bestScore)) {
          bestAssignment = trialAssignment;
          bestScore = trialScore;
          improved = true;
        }
      });
    });

    if (improved) {
      assignment = bestAssignment;
      score = bestScore;
    }
  }
  return { assignment, score };
}

// 初期案をswap・曲変更で動かし、途中で見つけた最高点の候補を返す。
export function runAnnealing(
  scoreTable: ScoreTable,
  initialAssignment: Assignment,
  config: SchedulerConfig,
): ScheduleCandidate {
  let currentAssignment = initialAssignment;
  let currentScore = calculateScheduleScore(
    scoreTable,
    currentAssignment,
    config,
  );
  if (currentScore.hasHardViolation) {
    throw new Error("初期案が絶対条件に違反しています。");
  }

  let bestAssignment = currentAssignment;
  let bestScore = currentScore;
  const random = new SeededRandom(config.randomSeed);

  for (
    let iteration = 0;
    iteration < config.annealingIterations;
    iteration += 1
  ) {
    let nextAssignment = createSwapNeighbor(
      scoreTable,
      currentAssignment,
      config,
      random,
    );
    let nextScore = calculateScheduleScore(scoreTable, nextAssignment, config);

    if (
      config.countRuleMode === "balance" &&
      config.enableSongChangeNeighbor &&
      random.next() < 0.25
    ) {
      const changedAssignment = createChangeSongNeighbor(
        scoreTable,
        currentAssignment,
        config,
        random,
      );
      if (
        changedAssignment.assignedSongIds.some(
          (songId, index) =>
            songId !== currentAssignment.assignedSongIds[index],
        )
      ) {
        const changedScore = calculateScheduleScore(
          scoreTable,
          changedAssignment,
          config,
        );
        if (
          !changedScore.hasHardViolation &&
          (nextScore.hasHardViolation || isScoreBetter(changedScore, nextScore))
        ) {
          nextAssignment = changedAssignment;
          nextScore = changedScore;
        }
      }
    }

    if (nextScore.hasHardViolation) {
      continue;
    }
    const difference = scoreDifference(nextScore, currentScore);
    const temperature = temperatureAt(iteration, config);
    const accept =
      difference >= 0 || random.next() < Math.exp(difference / temperature);
    if (!accept) {
      continue;
    }

    currentAssignment = nextAssignment;
    currentScore = nextScore;
    if (isScoreBetter(currentScore, bestScore)) {
      bestAssignment = currentAssignment;
      bestScore = currentScore;
    }
  }

  const repaired = repairBlankPlacement(
    scoreTable,
    config,
    bestAssignment,
    bestScore,
  );
  const evaluated = evaluateAssignment({
    scoreTable,
    assignment: repaired.assignment,
    config,
  });
  return {
    id: 0,
    assignment: repaired.assignment,
    score: evaluated.score,
    songScoreBreakdowns: evaluated.songScoreBreakdowns,
  };
}
