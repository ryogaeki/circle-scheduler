import { readFileSync } from "node:fs";

import {
  addFixedBlankRequest,
  addFixedRequest,
  addPreferredAvailableDateRequest,
  addPreferredAvailableRequests,
} from "../features/scheduler/config/assignmentRequests";
import {
  createDefaultSchedulerConfig,
  createDefaultSongRule,
} from "../features/scheduler/defaultConfig";
import { buildScoreTableFromSongCsv } from "../features/scheduler/input/buildScoreTableFromSongCsv";
import { parseSongCsv } from "../features/scheduler/input/parseSongCsv";
import { solveBalanceComparison } from "../features/scheduler/solver/solveBalanceComparison";
import { countSongs } from "../features/scheduler/solver/solverHelpers";
import {
  AVAILABLE_SCORE,
  EMPTY_SONG_ID,
  MAYBE_SCORE,
  type Assignment,
  type SchedulerConfig,
  type SchedulerResult,
  type ScoreTable,
} from "../features/scheduler/types";

function numberFromEnvironment(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return fallback;
  }
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name}には0以上の整数を指定してください。`);
  }
  return value;
}

function countBlankSlots(assignment: Assignment): number {
  return assignment.assignedSongIds.filter(
    (songId) => songId === EMPTY_SONG_ID,
  ).length;
}

function markFromScore(score: number): string {
  if (score === AVAILABLE_SCORE) {
    return "◯";
  }
  return score === MAYBE_SCORE ? "△" : "✖";
}

function printCandidateList(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  result: SchedulerResult,
): void {
  console.log(
    `settings: annealingIterations=${config.annealingIterations}` +
      ` balanceMaxDifference=${config.balanceMaxDifference}` +
      ` songChange=${config.enableSongChangeNeighbor ? "on" : "off"}`,
  );
  console.log(
    `trials: attempted=${result.statistics.attemptedTrialCount}` +
      ` successful=${result.statistics.successfulTrialCount}` +
      ` failed=${result.statistics.failedTrialCount}`,
  );
  console.log(
    `failures: targetCounts=${result.statistics.targetCountFailureCount}` +
      ` initialAssignment=${result.statistics.initialAssignmentFailureCount}` +
      ` annealing=${result.statistics.annealingFailureCount}`,
  );
  console.log(`candidates: ${result.candidates.length}`);
  console.log(`minimum blanks: ${result.statistics.minimumBlankCount}`);

  for (const candidate of result.candidates) {
    const counts = countSongs(scoreTable, candidate.assignment).join(" ");
    console.log(
      `#${candidate.id} total=${candidate.score.totalScore}` +
        ` availability=${candidate.score.availabilityScore}` +
        ` dayPenalty=${candidate.score.dayConstraintPenalty}` +
        ` spacing=${candidate.score.daySpacingPenalty}` +
        ` time=${candidate.score.timeTieBreakScore}` +
        ` request=${candidate.score.assignmentRequestScore}` +
        ` hard=${candidate.score.hasHardViolation ? "yes" : "no"}` +
        ` blanks=${countBlankSlots(candidate.assignment)} counts= ${counts}`,
    );
  }
}

function printBestSchedule(
  scoreTable: ScoreTable,
  result: SchedulerResult,
): void {
  const candidate = result.candidates[0];
  console.log("\nbest candidate song scores:");
  for (const breakdown of candidate.songScoreBreakdowns) {
    console.log(
      `${scoreTable.songs[breakdown.songId].name}:` +
        ` count=${breakdown.assignedCount}` +
        ` primary=${breakdown.primaryScore}` +
        ` availability=${breakdown.availabilityScore}` +
        ` day=${breakdown.dayConstraintPenalty}` +
        ` spacing=${breakdown.daySpacingPenalty}` +
        ` request=${breakdown.assignmentRequestScore}` +
        ` timeBalance=${breakdown.timeBalancePenalty}` +
        ` timePreference=${breakdown.timePreferencePenalty}`,
    );
  }

  console.log("\nbest schedule:");
  scoreTable.timeSlots.forEach((timeSlot, timeSlotId) => {
    if (
      timeSlotId > 0 &&
      timeSlot.dateKey !== scoreTable.timeSlots[timeSlotId - 1].dateKey
    ) {
      console.log("");
    }
    const songId = candidate.assignment.assignedSongIds[timeSlotId];
    if (songId === EMPTY_SONG_ID) {
      console.log(`${timeSlot.label} -> (blank)`);
    } else {
      const score = scoreTable.slotSongScores[timeSlotId][songId];
      console.log(
        `${timeSlot.label} -> ${markFromScore(score)} ${scoreTable.songs[songId].name}`,
      );
    }
  });
}

function configureRequests(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
): void {
  for (let hour = 10; hour <= 15; hour += 1) {
    addFixedBlankRequest(scoreTable, config, `8/28（金）${hour}:00〜`);
  }
  addPreferredAvailableRequests(scoreTable, config, "ノーチラス", 18);
  addFixedRequest(scoreTable, config, "8/28（金）16:00〜", "一二三");
  addFixedRequest(scoreTable, config, "8/28（金）17:00〜", "ノーチラス");
  addPreferredAvailableDateRequest(
    scoreTable,
    config,
    "9/4（金）",
    "星空のディスタンス",
    25,
  );
  addPreferredAvailableDateRequest(
    scoreTable,
    config,
    "9/14（月）",
    "星空のディスタンス",
    25,
  );
  addFixedRequest(scoreTable, config, "9/9（水）17:00〜", "からくりピエロ");
  addFixedRequest(scoreTable, config, "9/11（金）17:00〜", "からくりピエロ");
  for (const dateKey of ["8/26（水）", "8/28（金）", "8/31（月）"]) {
    addPreferredAvailableDateRequest(scoreTable, config, dateKey, "一二三", 25);
  }
  addFixedRequest(scoreTable, config, "8/26（水）12:00〜", "III");
  addFixedRequest(scoreTable, config, "9/4（金）14:00〜", "III");
  addPreferredAvailableRequests(scoreTable, config, "革命でゅ", 12);
  addPreferredAvailableRequests(scoreTable, config, "4年", 70);
  for (const dateKey of ["9/7（月）", "9/9（水）", "9/11（金）"]) {
    addPreferredAvailableDateRequest(scoreTable, config, dateKey, "5150", 25);
  }
  addPreferredAvailableRequests(scoreTable, config, "SAYONARA MAYBE", 25);
}

function main(): void {
  const csvPath = process.argv[2];
  if (!csvPath) {
    throw new Error("実行するCSVのパスを指定してください。");
  }
  const csvData = parseSongCsv(readFileSync(csvPath, "utf8"));
  const config = createDefaultSchedulerConfig();
  config.candidateLimit = 10;
  config.trialCount = numberFromEnvironment("SCHEDULER_TRIALS", 200);
  config.annealingIterations = numberFromEnvironment(
    "SCHEDULER_ITERATIONS",
    2_000,
  );
  config.enableSongChangeNeighbor = true;

  config.songRules = csvData.songs.map((song) => {
    const rule = createDefaultSongRule(song.id);
    rule.minCount =
      song.name === "Pallet" || song.name === "SAYONARA MAYBE" ? 3 : 4;
    rule.sameDayConsecutivePenalty = 5;
    rule.daySpacingPenalty = 1;
    rule.timeBalancePenalty = 10;
    return rule;
  });

  const scoreTable = buildScoreTableFromSongCsv(csvData, config);
  configureRequests(scoreTable, config);
  console.log(
    `input: ${csvPath} slots=${scoreTable.timeSlots.length}` +
      ` songs=${scoreTable.songs.length}`,
  );

  const comparison = solveBalanceComparison(scoreTable, config, 1, 5);
  console.log("\nbalance comparison:");
  comparison.entries.forEach((entry, index) => {
    if (!entry.solved) {
      console.log(
        `maxDifference=${entry.maxDifference} result=unavailable ${entry.errorMessage}`,
      );
      return;
    }
    const best = entry.result.candidates[0];
    const counts = countSongs(scoreTable, best.assignment);
    console.log(
      `maxDifference=${entry.maxDifference}` +
        ` blanks=${entry.result.statistics.minimumBlankCount}` +
        ` successful=${entry.result.statistics.successfulTrialCount}` +
        `/${entry.result.statistics.attemptedTrialCount}` +
        ` total=${best.score.totalScore}` +
        ` time=${best.score.timeTieBreakScore}` +
        ` counts=${Math.min(...counts)}-${Math.max(...counts)}` +
        `${index === comparison.selectedEntryIndex ? " selected" : ""}`,
    );
  });

  const selected = comparison.entries[comparison.selectedEntryIndex];
  console.log("\nselected balance:");
  printCandidateList(
    scoreTable,
    { ...config, balanceMaxDifference: selected.maxDifference },
    selected.result,
  );
  printBestSchedule(scoreTable, selected.result);
}

main();
