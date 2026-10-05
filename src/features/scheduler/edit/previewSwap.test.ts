import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultSchedulerConfig } from "../defaultConfig";
import { FORBIDDEN_SCORE, type ScoreTable } from "../types";
import { previewSwap } from "./previewSwap";

function createScoreTable(): ScoreTable {
  return {
    songs: [
      { id: 0, name: "曲A" },
      { id: 1, name: "曲B" },
    ],
    timeSlots: [
      {
        id: 0,
        label: "8/24（月）10:00〜",
        dateKey: "8/24（月）",
        dayIndex: 0,
        indexInDay: 0,
      },
      {
        id: 1,
        label: "8/25（火）10:00〜",
        dateKey: "8/25（火）",
        dayIndex: 1,
        indexInDay: 0,
      },
    ],
    slotSongScores: [
      [2, 1],
      [1, 2],
    ],
  };
}

test("元予定を変えずにswap後の点数差を返す", () => {
  const scoreTable = createScoreTable();
  const assignment = { assignedSongIds: [0, 1] };
  const result = previewSwap({
    scoreTable,
    assignment,
    config: createDefaultSchedulerConfig(),
    firstTimeSlotId: 0,
    secondTimeSlotId: 1,
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.assignment.assignedSongIds, [1, 0]);
  assert.deepEqual(assignment.assignedSongIds, [0, 1]);
  assert.equal(result.before.score.totalScore, 4);
  assert.equal(result.after.score.totalScore, 2);
  assert.equal(result.scoreDifference.totalScore, -2);
});

test("確定枠を含むswapは反映不可にする", () => {
  const scoreTable = createScoreTable();
  const config = createDefaultSchedulerConfig();
  config.assignmentRequests.push({
    timeSlotId: 0,
    songId: 0,
    priority: 100,
    fixed: true,
  });

  const result = previewSwap({
    scoreTable,
    assignment: { assignedSongIds: [0, 1] },
    config,
    firstTimeSlotId: 0,
    secondTimeSlotId: 1,
  });

  assert.equal(result.allowed, false);
  assert.ok(result.violationCodes.includes("firstSlotFixed"));
  assert.ok(result.violationCodes.includes("hardConstraint"));
});

test("交換先が絶対不可の×になるswapは反映不可にする", () => {
  const scoreTable = createScoreTable();
  scoreTable.slotSongScores[1][0] = FORBIDDEN_SCORE;

  const result = previewSwap({
    scoreTable,
    assignment: { assignedSongIds: [0, 1] },
    config: createDefaultSchedulerConfig(),
    firstTimeSlotId: 0,
    secondTimeSlotId: 1,
  });

  assert.equal(result.allowed, false);
  assert.ok(result.violationCodes.includes("hardConstraint"));
});
