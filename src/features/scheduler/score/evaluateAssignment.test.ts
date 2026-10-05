import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultSchedulerConfig,
  createDefaultSongRule,
} from "../defaultConfig";
import { addCandidateSorted } from "../solver/candidateStore";
import {
  EMPTY_SONG_ID,
  FORBIDDEN_SCORE,
  type Assignment,
  type ScheduleCandidate,
  type ScoreResult,
  type ScoreTable,
} from "../types";
import {
  calculateScheduleScore,
  evaluateAssignment,
} from "./evaluateAssignment";
import { createEmptyScoreResult } from "./scoreHelpers";

// C++テストと同じ、2日×3枠×2曲の小さいスコア表。
function createTwoDayScoreTable(): ScoreTable {
  const timeSlots = Array.from({ length: 6 }, (_, timeSlotId) => ({
    id: timeSlotId,
    label: `slot${timeSlotId}`,
    dateKey: `day${Math.trunc(timeSlotId / 3)}`,
    dayIndex: Math.trunc(timeSlotId / 3),
    indexInDay: timeSlotId % 3,
  }));

  return {
    timeSlots,
    songs: [
      { id: 0, name: "曲A" },
      { id: 1, name: "曲B" },
    ],
    slotSongScores: [
      [2, 1],
      [2, 2],
      [1, 2],
      [2, 1],
      [2, 2],
      [1, FORBIDDEN_SCORE],
    ],
  };
}

function createBlankAssignment(timeSlotCount: number): Assignment {
  return {
    assignedSongIds: Array.from(
      { length: timeSlotCount },
      () => EMPTY_SONG_ID,
    ),
  };
}

test("全体点と曲別内訳がC++版と一致する", () => {
  const scoreTable = createTwoDayScoreTable();
  const config = createDefaultSchedulerConfig();
  config.assignmentRequests.push(
    { timeSlotId: 0, songId: 0, priority: 100, fixed: true },
    { timeSlotId: 1, songId: 1, priority: 7, fixed: false },
  );

  const assignment = createBlankAssignment(6);
  assignment.assignedSongIds[0] = 0;
  assignment.assignedSongIds[1] = 1;

  const result = evaluateAssignment({ scoreTable, assignment, config });
  assert.equal(result.score.availabilityScore, 4);
  assert.equal(result.score.assignmentRequestScore, 7);
  assert.equal(result.score.totalScore, 11);
  assert.equal(result.score.hasHardViolation, false);
  assert.equal(result.songScoreBreakdowns[0].primaryScore, 2);
  assert.equal(result.songScoreBreakdowns[1].primaryScore, 9);
});

test("確定枠と絶対不可の違反を検出する", () => {
  const scoreTable = createTwoDayScoreTable();
  const fixedConfig = createDefaultSchedulerConfig();
  fixedConfig.assignmentRequests.push({
    timeSlotId: 0,
    songId: 0,
    priority: 100,
    fixed: true,
  });

  const wrongFixed = createBlankAssignment(6);
  wrongFixed.assignedSongIds[0] = 1;
  assert.equal(
    calculateScheduleScore(scoreTable, wrongFixed, fixedConfig).hasHardViolation,
    true,
  );

  const forbidden = createBlankAssignment(6);
  forbidden.assignedSongIds[5] = 1;
  assert.equal(
    calculateScheduleScore(
      scoreTable,
      forbidden,
      createDefaultSchedulerConfig(),
    ).hasHardViolation,
    true,
  );
});

test("同日連続を減点し、同日非連続を絶対不可にする", () => {
  const scoreTable = createTwoDayScoreTable();
  const config = createDefaultSchedulerConfig();
  const rule = createDefaultSongRule(0);
  rule.sameDayConsecutivePenalty = 5;
  config.songRules.push(rule);

  const consecutive = createBlankAssignment(6);
  consecutive.assignedSongIds[0] = 0;
  consecutive.assignedSongIds[1] = 0;
  const consecutiveScore = calculateScheduleScore(
    scoreTable,
    consecutive,
    config,
  );
  assert.equal(consecutiveScore.dayConstraintPenalty, -5);
  assert.equal(consecutiveScore.hasHardViolation, false);

  const nonConsecutive = createBlankAssignment(6);
  nonConsecutive.assignedSongIds[0] = 0;
  nonConsecutive.assignedSongIds[2] = 0;
  assert.equal(
    calculateScheduleScore(scoreTable, nonConsecutive, config).hasHardViolation,
    true,
  );
});

test("日付の軽いずれは小さく、前半だけの偏りは強く減点する", () => {
  const scoreTable: ScoreTable = {
    songs: [{ id: 0, name: "曲A" }],
    timeSlots: Array.from({ length: 10 }, (_, dayIndex) => ({
      id: dayIndex,
      label: `slot${dayIndex}`,
      dateKey: `day${dayIndex}`,
      dayIndex,
      indexInDay: 0,
    })),
    slotSongScores: Array.from({ length: 10 }, () => [2]),
  };
  const config = createDefaultSchedulerConfig();
  const rule = createDefaultSongRule(0);
  rule.daySpacingPenalty = 1;
  config.songRules.push(rule);

  const earlyAssignment = createBlankAssignment(10);
  earlyAssignment.assignedSongIds[0] = 0;
  earlyAssignment.assignedSongIds[1] = 0;
  assert.equal(
    Math.round(
      calculateScheduleScore(scoreTable, earlyAssignment, config)
        .daySpacingPenalty * 1000,
    ) / 1000,
    -0.79,
  );

  const consecutiveMiddleAssignment = createBlankAssignment(10);
  consecutiveMiddleAssignment.assignedSongIds[4] = 0;
  consecutiveMiddleAssignment.assignedSongIds[5] = 0;
  assert.equal(
    Math.round(
      calculateScheduleScore(
        scoreTable,
        consecutiveMiddleAssignment,
        config,
      ).daySpacingPenalty * 1000,
    ) / 1000,
    -0.323,
  );

  const evenlySpacedAssignment = createBlankAssignment(10);
  evenlySpacedAssignment.assignedSongIds[2] = 0;
  evenlySpacedAssignment.assignedSongIds[7] = 0;
  assert.equal(
    calculateScheduleScore(scoreTable, evenlySpacedAssignment, config)
      .daySpacingPenalty,
    0,
  );

  const earlyThreeTimesAssignment = createBlankAssignment(10);
  earlyThreeTimesAssignment.assignedSongIds[0] = 0;
  earlyThreeTimesAssignment.assignedSongIds[1] = 0;
  earlyThreeTimesAssignment.assignedSongIds[2] = 0;
  const earlyThreeTimesPenalty = calculateScheduleScore(
    scoreTable,
    earlyThreeTimesAssignment,
    config,
  ).daySpacingPenalty;
  assert.ok(
    Math.abs(earlyThreeTimesPenalty) <
      Math.abs(
        calculateScheduleScore(scoreTable, earlyAssignment, config)
          .daySpacingPenalty,
      ),
  );
});

test("同じ日の2枠目は日付偏りへ重複して数えない", () => {
  const scoreTable: ScoreTable = {
    songs: [{ id: 0, name: "曲A" }],
    timeSlots: [
      { id: 0, label: "day2-a", dateKey: "day2", dayIndex: 2, indexInDay: 0 },
      { id: 1, label: "day2-b", dateKey: "day2", dayIndex: 2, indexInDay: 1 },
      { id: 2, label: "day7", dateKey: "day7", dayIndex: 7, indexInDay: 0 },
    ],
    slotSongScores: [[2], [2], [2]],
  };
  const config = createDefaultSchedulerConfig();
  const rule = createDefaultSongRule(0);
  rule.daySpacingPenalty = 1;
  config.songRules.push(rule);

  const twoAssignments = { assignedSongIds: [0, -1, 0] };
  const threeAssignments = { assignedSongIds: [0, 0, 0] };
  assert.equal(
    calculateScheduleScore(scoreTable, twoAssignments, config)
      .daySpacingPenalty,
    calculateScheduleScore(scoreTable, threeAssignments, config)
      .daySpacingPenalty,
  );
});

test("時間帯点は通常点を逆転させず、遅め希望を評価する", () => {
  const scoreTable = createTwoDayScoreTable();
  const config = createDefaultSchedulerConfig();
  const rule = createDefaultSongRule(0);
  rule.timeBalancePenalty = 10;
  config.songRules.push(rule);

  const early = createBlankAssignment(6);
  early.assignedSongIds[0] = 0;
  early.assignedSongIds[3] = 0;
  const earlyScore = calculateScheduleScore(scoreTable, early, config);
  assert.equal(earlyScore.timeBalancePenalty, -10);

  const mixed = createBlankAssignment(6);
  mixed.assignedSongIds[0] = 0;
  mixed.assignedSongIds[5] = 0;
  const mixedScore = calculateScheduleScore(scoreTable, mixed, config);
  assert.equal(mixedScore.timeBalancePenalty, 0);
  assert.ok(earlyScore.totalScore > mixedScore.totalScore);

  rule.timePreference = "preferLate";
  rule.timePreferencePenalty = 10;
  const preferredEarly = calculateScheduleScore(scoreTable, early, config);
  const late = createBlankAssignment(6);
  late.assignedSongIds[2] = 0;
  late.assignedSongIds[5] = 0;
  const preferredLate = calculateScheduleScore(scoreTable, late, config);
  assert.equal(preferredEarly.timePreferencePenalty, -10);
  assert.equal(preferredLate.timePreferencePenalty, 0);
  assert.equal(preferredLate.timeBalancePenalty, 0);
});

function createCandidate(
  songId: number,
  totalScore: number,
  timeTieBreakScore: number,
): ScheduleCandidate {
  const score: ScoreResult = {
    ...createEmptyScoreResult(),
    totalScore,
    timeTieBreakScore,
  };
  return {
    id: 0,
    assignment: { assignedSongIds: [songId] },
    score,
    songScoreBreakdowns: [],
  };
}

test("候補を通常点、時間帯微小点の順に並べて重複を除く", () => {
  const candidates: ScheduleCandidate[] = [];
  addCandidateSorted(candidates, createCandidate(0, 1, -100), 10);
  addCandidateSorted(candidates, createCandidate(1, 0, 0), 10);
  addCandidateSorted(candidates, createCandidate(2, 1, -10), 10);
  addCandidateSorted(candidates, createCandidate(2, 1, -20), 10);

  assert.equal(candidates.length, 3);
  assert.equal(candidates[0].assignment.assignedSongIds[0], 2);
  assert.equal(candidates[1].assignment.assignedSongIds[0], 0);
  assert.equal(candidates[2].assignment.assignedSongIds[0], 1);
});
