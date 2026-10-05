import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { createDefaultSchedulerConfig } from "../defaultConfig";
import type { ScheduleCandidate, ScoreTable } from "../types";
import { ScheduleCalendar } from "./ScheduleCalendar";

test("選択候補を月別カレンダーとして表示する", () => {
  const scoreTable: ScoreTable = {
    songs: [{ id: 0, name: "曲A" }],
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
        label: "8/24（月）11:00〜",
        dateKey: "8/24（月）",
        dayIndex: 0,
        indexInDay: 1,
      },
      {
        id: 2,
        label: "9/2（水）12:00〜",
        dateKey: "9/2（水）",
        dayIndex: 1,
        indexInDay: 0,
      },
    ],
    slotSongScores: [[2], [2], [1]],
  };
  const candidate: ScheduleCandidate = {
    id: 1,
    assignment: { assignedSongIds: [0, -1, 0] },
    score: {
      totalScore: 3,
      timeTieBreakScore: 0,
      availabilityScore: 3,
      dayConstraintPenalty: 0,
      countBalancePenalty: 0,
      daySpacingPenalty: 0,
      timeBalancePenalty: 0,
      timePreferencePenalty: 0,
      assignmentRequestScore: 0,
      hasHardViolation: false,
    },
    songScoreBreakdowns: [],
  };

  const html = renderToStaticMarkup(
    <ScheduleCalendar
      candidate={candidate}
      config={createDefaultSchedulerConfig()}
      countRuleMode="balance"
      draftAssignment={{
        assignedSongIds: [...candidate.assignment.assignedSongIds],
      }}
      maxDifference={2}
      scoreTable={scoreTable}
      canRedo={false}
      canUndo={false}
      onConfigChange={() => {}}
      onDraftAssignmentChange={() => {}}
      onRedo={() => {}}
      onUndo={() => {}}
    />,
  );

  assert.match(html, /8月/);
  assert.match(html, /9月/);
  assert.match(html, /曲A/);
  assert.match(html, /◯/);
  assert.match(html, /△/);
  assert.match(html, /空白/);
  assert.match(html, /候補 #1/);
  assert.match(html, /交換元を選択/);
  assert.match(html, /元候補に戻す/);
});

test("候補作成前から確定枠と希望枠をカレンダーへ表示する", () => {
  const scoreTable: ScoreTable = {
    songs: [
      { id: 0, name: "ノーチラス" },
      { id: 1, name: "星空のディスタンス" },
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
        label: "8/24（月）11:00〜",
        dateKey: "8/24（月）",
        dayIndex: 0,
        indexInDay: 1,
      },
    ],
    slotSongScores: [
      [2, 1],
      [2, 2],
    ],
  };
  const config = createDefaultSchedulerConfig();
  config.assignmentRequests = [
    { timeSlotId: 0, songId: 0, priority: 100, fixed: true },
    { timeSlotId: 1, songId: 0, priority: 20, fixed: false },
    { timeSlotId: 1, songId: 1, priority: 30, fixed: false },
  ];

  const html = renderToStaticMarkup(
    <ScheduleCalendar
      candidate={null}
      config={config}
      countRuleMode="balance"
      draftAssignment={null}
      maxDifference={1}
      scoreTable={scoreTable}
      canRedo={false}
      canUndo={false}
      onConfigChange={() => {}}
      onDraftAssignmentChange={() => {}}
      onRedo={() => {}}
      onUndo={() => {}}
    />,
  );

  assert.match(html, /設定プレビュー/);
  assert.match(html, /ノーチラス/);
  assert.match(html, /is-request-fixed/);
  assert.match(html, /is-request-preferred/);
  assert.match(html, /ほか1曲/);
  assert.match(html, /希望2/);
  assert.doesNotMatch(html, /交換元を選択/);
});

test("選択した時間枠を外部の右パネルへ渡す表示にできる", () => {
  const scoreTable: ScoreTable = {
    songs: [{ id: 0, name: "曲A" }],
    timeSlots: [
      {
        id: 0,
        label: "8/24（月）10:00〜",
        dateKey: "8/24（月）",
        dayIndex: 0,
        indexInDay: 0,
      },
    ],
    slotSongScores: [[2]],
  };

  const html = renderToStaticMarkup(
    <ScheduleCalendar
      candidate={null}
      config={createDefaultSchedulerConfig()}
      countRuleMode="balance"
      draftAssignment={null}
      maxDifference={1}
      requestTarget={{
        scope: "slot",
        label: "8/24（月）10:00〜",
        timeSlotIds: [0],
      }}
      scoreTable={scoreTable}
      showRequestEditor={false}
      canRedo={false}
      canUndo={false}
      onConfigChange={() => {}}
      onDraftAssignmentChange={() => {}}
      onRedo={() => {}}
      onUndo={() => {}}
    />,
  );

  assert.match(html, /is-request-editor-selected/);
  assert.doesNotMatch(html, /QUICK SETTING/);
});
