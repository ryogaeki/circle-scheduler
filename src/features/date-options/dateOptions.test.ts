import assert from "node:assert/strict";
import test from "node:test";

import {
  createDateRange,
  createTimes,
  formatDateOptions,
} from "./dateOptions";

test("月をまたぐ月水金の範囲を選択する", () => {
  assert.deepEqual(
    createDateRange("2026-09-25", "2026-10-09", new Set([1, 3, 5])),
    [
      "2026-09-25",
      "2026-09-28",
      "2026-09-30",
      "2026-10-02",
      "2026-10-05",
      "2026-10-07",
      "2026-10-09",
    ],
  );
});

test("開始時刻、間隔、枠数から時刻を作る", () => {
  assert.deepEqual(createTimes("10:00", 60, 4), [
    "10:00",
    "11:00",
    "12:00",
    "13:00",
  ]);
  assert.deepEqual(createTimes("18:00", 45, 4), [
    "18:00",
    "18:45",
    "19:30",
    "20:15",
  ]);
});

test("日付ごとに空行を入れた調整さん用の文章を作る", () => {
  assert.equal(
    formatDateOptions({
      "2026-10-02": ["18:00", "18:45"],
      "2026-09-30": ["11:00", "10:00"],
    }),
    [
      "9/30（水）10:00〜",
      "9/30（水）11:00〜",
      "",
      "10/2（金）18:00〜",
      "10/2（金）18:45〜",
    ].join("\n"),
  );
});
