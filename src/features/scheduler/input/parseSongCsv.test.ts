import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultSchedulerConfig } from "../defaultConfig";
import { FORBIDDEN_SCORE } from "../types";
import { buildScoreTableFromSongCsv } from "./buildScoreTableFromSongCsv";
import { parseSongCsv } from "./parseSongCsv";

test("調整さんCSVから曲、日付番号、日内番号を読み取る", () => {
  const csvText = [
    "タイトル,テスト",
    "日程,曲A,曲B",
    "6/1（月）18:00〜,○,△",
    "6/1（月）19:00〜,×,◯",
    "6/3（水）18:00〜,△,×",
    "コメント,自由記述,",
  ].join("\n");

  const csvData = parseSongCsv(csvText);
  assert.equal(csvData.songs.length, 2);
  assert.equal(csvData.timeSlots.length, 3);
  assert.deepEqual(
    csvData.timeSlots.map((slot) => [slot.dayIndex, slot.indexInDay]),
    [
      [0, 0],
      [0, 1],
      [1, 0],
    ],
  );

  const scoreTable = buildScoreTableFromSongCsv(
    csvData,
    createDefaultSchedulerConfig(),
  );
  assert.deepEqual(scoreTable.slotSongScores[0], [2, 1]);
  assert.deepEqual(scoreTable.slotSongScores[1], [FORBIDDEN_SCORE, 2]);
});

test("人ごとCSVを曲ごとCSVとして読み込まない", () => {
  const csvText = [
    "12月予定調査",
    "名前はフルネームで入力してください。活動に来れる日時に◯を入力してください。",
    "日程,佐々木さん,岡田さん",
    "12/1（月）18:00〜,◯,×",
  ].join("\n");

  assert.throws(() => parseSongCsv(csvText), /人ごとの予定CSV/);
});
