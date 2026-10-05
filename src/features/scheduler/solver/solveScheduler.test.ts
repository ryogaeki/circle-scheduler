import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultSchedulerConfig,
  createDefaultSongRule,
} from "../defaultConfig";
import { FORBIDDEN_SCORE, type ScoreTable } from "../types";
import { solveBalanceComparison } from "./solveBalanceComparison";
import { countSongs } from "./solverHelpers";

function createSmallScoreTable(): ScoreTable {
  return {
    songs: [
      { id: 0, name: "曲A" },
      { id: 1, name: "曲B" },
    ],
    timeSlots: [
      { id: 0, label: "d0-0", dateKey: "d0", dayIndex: 0, indexInDay: 0 },
      { id: 1, label: "d0-1", dateKey: "d0", dayIndex: 0, indexInDay: 1 },
      { id: 2, label: "d1-0", dateKey: "d1", dayIndex: 1, indexInDay: 0 },
      { id: 3, label: "d1-1", dateKey: "d1", dayIndex: 1, indexInDay: 1 },
    ],
    slotSongScores: [
      [2, 1],
      [1, 2],
      [2, 1],
      [1, 2],
    ],
  };
}

test("solverが空白なし・均等な予定候補を作る", () => {
  const scoreTable = createSmallScoreTable();
  const config = createDefaultSchedulerConfig();
  config.songRules = [createDefaultSongRule(0), createDefaultSongRule(1)];
  config.trialCount = 4;
  config.annealingIterations = 50;
  config.candidateLimit = 3;
  config.enableSongChangeNeighbor = true;

  const comparison = solveBalanceComparison(scoreTable, config, 1, 2);
  const selected = comparison.entries[comparison.selectedEntryIndex];
  const best = selected.result.candidates[0];

  assert.equal(selected.result.statistics.minimumBlankCount, 0);
  assert.deepEqual(countSongs(scoreTable, best.assignment), [2, 2]);
  assert.equal(best.score.hasHardViolation, false);
  assert.equal(best.score.totalScore, 8);
});

test("回数固定では曲数差を比較せず指定回数で探索する", () => {
  const scoreTable = createSmallScoreTable();
  const config = createDefaultSchedulerConfig();
  config.countRuleMode = "fixedTarget";
  config.songRules = [createDefaultSongRule(0), createDefaultSongRule(1)];
  config.songRules[0].targetCount = 1;
  config.songRules[1].targetCount = 1;
  config.trialCount = 2;
  config.annealingIterations = 30;

  const comparison = solveBalanceComparison(scoreTable, config, 1, 5);
  const best = comparison.entries[0].result.candidates[0];

  assert.equal(comparison.entries.length, 1);
  assert.equal(comparison.entries[0].maxDifference, 0);
  assert.equal(comparison.entries[0].result.statistics.minimumBlankCount, 2);
  assert.deepEqual(countSongs(scoreTable, best.assignment), [1, 1]);
});

test("回数固定でも最初の初期案が失敗したら次のseedを試す", () => {
  const scoreTable: ScoreTable = {
    songs: [
      { id: 0, name: "曲A" },
      { id: 1, name: "曲B" },
      { id: 2, name: "曲C" },
    ],
    timeSlots: Array.from({ length: 6 }, (_, id) => ({
      id,
      label: `d${Math.floor(id / 2)}-${id % 2}`,
      dateKey: `d${Math.floor(id / 2)}`,
      dayIndex: Math.floor(id / 2),
      indexInDay: id % 2,
    })),
    slotSongScores: [
      [FORBIDDEN_SCORE, 2, 2],
      [2, 2, FORBIDDEN_SCORE],
      [2, FORBIDDEN_SCORE, 2],
      [FORBIDDEN_SCORE, FORBIDDEN_SCORE, 2],
      [FORBIDDEN_SCORE, 2, FORBIDDEN_SCORE],
      [2, FORBIDDEN_SCORE, FORBIDDEN_SCORE],
    ],
  };
  const config = createDefaultSchedulerConfig();
  config.countRuleMode = "fixedTarget";
  config.randomSeed = 1;
  config.trialCount = 2;
  config.annealingIterations = 10;
  config.songRules = scoreTable.songs.map((song) => {
    const rule = createDefaultSongRule(song.id);
    rule.targetCount = 2;
    rule.maxPerDay = 1;
    rule.maxPerDayPolicy = "forbidden";
    rule.sameDayConsecutivePolicy = "forbidden";
    return rule;
  });

  const comparison = solveBalanceComparison(scoreTable, config, 1, 5);
  const result = comparison.entries[0].result;

  assert.equal(result.statistics.initialAssignmentFailureCount, 1);
  assert.equal(result.statistics.successfulTrialCount, 1);
  assert.deepEqual(
    countSongs(scoreTable, result.candidates[0].assignment),
    [2, 2, 2],
  );
});
