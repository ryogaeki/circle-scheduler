import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultSchedulerConfig,
  createDefaultSongRule,
} from "../defaultConfig";
import type { ScoreTable } from "../types";
import {
  parseSchedulerSettings,
  serializeSchedulerSettings,
} from "./schedulerSettingsFile";

function createScoreTable(reversed = false): ScoreTable {
  const songs = reversed
    ? [
        { id: 0, name: "曲B" },
        { id: 1, name: "曲A" },
      ]
    : [
        { id: 0, name: "曲A" },
        { id: 1, name: "曲B" },
      ];
  const labels = reversed
    ? ["8/2（火）10:00〜", "8/1（月）10:00〜"]
    : ["8/1（月）10:00〜", "8/2（火）10:00〜"];
  return {
    songs,
    timeSlots: labels.map((label, id) => ({
      id,
      label,
      dateKey: label.slice(0, label.indexOf("）") + 1),
      dayIndex: id,
      indexInDay: 0,
    })),
    slotSongScores: [
      [2, 2],
      [2, 2],
    ],
  };
}

test("設定を曲名と時間枠名で保存し、並びが違うCSVへ復元する", () => {
  const source = createScoreTable();
  const config = createDefaultSchedulerConfig();
  const ruleA = createDefaultSongRule(0);
  const ruleB = createDefaultSongRule(1);
  ruleA.minCount = 3;
  config.songRules = [ruleA, ruleB];
  config.assignmentRequests = [
    { timeSlotId: 0, songId: 1, priority: 25, fixed: false },
  ];

  const text = serializeSchedulerSettings(source, config, 1, 5);
  const loaded = parseSchedulerSettings(text, createScoreTable(true));

  assert.equal(loaded.config.songRules[1].minCount, 3);
  assert.deepEqual(loaded.config.assignmentRequests[0], {
    timeSlotId: 1,
    songId: 0,
    priority: 25,
    fixed: false,
  });
  assert.equal(loaded.maxBalanceDifference, 5);
});

test("CSVにない曲を含む設定ファイルは読み込まない", () => {
  const scoreTable = createScoreTable();
  const config = createDefaultSchedulerConfig();
  config.songRules = [createDefaultSongRule(0), createDefaultSongRule(1)];
  const text = serializeSchedulerSettings(scoreTable, config, 1, 5).replace(
    '"曲B"',
    '"不明な曲"',
  );

  assert.throws(
    () => parseSchedulerSettings(text, scoreTable),
    /CSVにない曲/,
  );
});
