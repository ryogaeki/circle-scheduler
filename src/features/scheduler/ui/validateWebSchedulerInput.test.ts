import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultSchedulerConfig,
  createDefaultSongRule,
} from "../defaultConfig";
import { FORBIDDEN_SCORE, type SolveRequest } from "../types";
import { validateWebSchedulerInput } from "./validateWebSchedulerInput";

function createRequest(): SolveRequest {
  const config = createDefaultSchedulerConfig();
  config.songRules = [createDefaultSongRule(0)];
  return {
    config,
    minBalanceDifference: 1,
    maxBalanceDifference: 5,
    scoreTable: {
      songs: [{ id: 0, name: "曲A" }],
      timeSlots: [
        {
          id: 0,
          label: "6/1（月）18:00〜",
          dateKey: "6/1（月）",
          dayIndex: 0,
          indexInDay: 0,
        },
      ],
      slotSongScores: [[FORBIDDEN_SCORE]],
    },
  };
}

test("回数固定で未指定の曲を検出する", () => {
  const request = createRequest();
  request.config.countRuleMode = "fixedTarget";

  assert.match(validateWebSchedulerInput(request) ?? "", /固定回数/);
});

test("絶対不可の時間枠への確定要求を検出する", () => {
  const request = createRequest();
  request.config.assignmentRequests.push({
    timeSlotId: 0,
    songId: 0,
    priority: 100,
    fixed: true,
  });

  assert.match(validateWebSchedulerInput(request) ?? "", /絶対不可/);
});
