import { createDefaultSongRule } from "../defaultConfig";
import {
  AVAILABLE_SCORE,
  FORBIDDEN_SCORE,
  MAYBE_SCORE,
  type AvailabilityMark,
  type SchedulerConfig,
  type ScoreTable,
  type SongCsvData,
  type SongRuleConfig,
} from "../types";

function scoreFromMark(
  mark: AvailabilityMark,
  rule: SongRuleConfig,
): number {
  if (mark === "available") {
    return AVAILABLE_SCORE;
  }
  if (mark === "maybe") {
    return MAYBE_SCORE;
  }
  return rule.unavailablePolicy === "allowWithPenalty"
    ? rule.unavailablePenalty
    : FORBIDDEN_SCORE;
}

// CSV記号を、曲別の×設定を反映した時間枠×曲の点数表へ変換する。
export function buildScoreTableFromSongCsv(
  csvData: SongCsvData,
  config: SchedulerConfig,
): ScoreTable {
  if (csvData.timeSlots.length !== csvData.marks.length) {
    throw new Error("時間枠数と予定記号の行数が一致しません。");
  }

  const configuredRules = new Map(
    config.songRules.map((rule) => [rule.songId, rule]),
  );
  const slotSongScores = csvData.marks.map((markRow, rowIndex) => {
    if (markRow.length !== csvData.songs.length) {
      throw new Error(`予定記号の列数と曲数が一致しません。行番号: ${rowIndex + 1}`);
    }
    return markRow.map((mark, songId) =>
      scoreFromMark(
        mark,
        configuredRules.get(songId) ?? createDefaultSongRule(songId),
      ),
    );
  });

  return {
    timeSlots: csvData.timeSlots,
    songs: csvData.songs,
    slotSongScores,
  };
}
