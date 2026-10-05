import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { createEmptyScoreResult } from "../score/scoreHelpers";
import type { ScheduleCandidate, ScoreTable } from "../types";
import { CandidateComparisonPanel } from "./CandidateComparisonPanel";

test("2候補の点数と異なる時間枠を表示する", () => {
  const scoreTable: ScoreTable = {
    songs: [
      { id: 0, name: "曲A" },
      { id: 1, name: "曲B" },
    ],
    timeSlots: [
      {
        id: 0,
        label: "8/1（月）10:00〜",
        dateKey: "8/1（月）",
        dayIndex: 0,
        indexInDay: 0,
      },
      {
        id: 1,
        label: "8/2（火）10:00〜",
        dateKey: "8/2（火）",
        dayIndex: 1,
        indexInDay: 0,
      },
    ],
    slotSongScores: [
      [2, 1],
      [1, 2],
    ],
  };
  const first: ScheduleCandidate = {
    id: 1,
    assignment: { assignedSongIds: [0, 1] },
    score: {
      ...createEmptyScoreResult(),
      totalScore: 4,
      timeTieBreakScore: -17,
    },
    songScoreBreakdowns: [],
  };
  const second: ScheduleCandidate = {
    id: 2,
    assignment: { assignedSongIds: [1, 0] },
    score: {
      ...createEmptyScoreResult(),
      totalScore: 2,
      timeTieBreakScore: -2,
    },
    songScoreBreakdowns: [],
  };

  const html = renderToStaticMarkup(
    <CandidateComparisonPanel
      firstCandidate={first}
      secondCandidate={second}
      scoreTable={scoreTable}
      onClose={() => {}}
      onSelectSecond={() => {}}
    />,
  );

  assert.match(html, /候補 #1 と #2/);
  assert.match(html, /配置が異なる時間枠/);
  assert.match(html, /2枠/);
  assert.match(html, /8\/1（月）10:00〜/);
  assert.match(html, /曲A/);
  assert.match(html, /曲B/);
  assert.match(html, /3\.983/);
  assert.match(html, /1\.998/);
});
