// node:testで登録される各テストファイルを、一つのnpmコマンドから読み込む。
export {};

await import("../features/date-options/dateOptions.test");
await import("../features/scheduler/input/parseSongCsv.test");
await import("../features/scheduler/settings/schedulerSettingsFile.test");
await import("../features/scheduler/score/evaluateAssignment.test");
await import("../features/scheduler/edit/assignmentHistory.test");
await import("../features/scheduler/edit/previewSwap.test");
await import("../features/scheduler/solver/solveScheduler.test");
await import("../features/scheduler/worker/worker.test");
await import("../features/scheduler/ui/CandidateComparisonPanel.test");
await import("../features/scheduler/ui/ScheduleCalendar.test");
await import("../features/scheduler/ui/scoreDisplay.test");
await import("../features/scheduler/ui/validateWebSchedulerInput.test");
