import {
  createDefaultSchedulerConfig,
  createDefaultSongRule,
} from "../defaultConfig";
import { buildScoreTableFromSongCsv } from "../input/buildScoreTableFromSongCsv";
import type { SolveRequest, SongCsvData } from "../types";

// CSV読み込み直後にWeb画面へ設定する初期値を作る。
export function createWebSchedulerInput(csvData: SongCsvData): SolveRequest {
  const config = createDefaultSchedulerConfig();
  config.candidateLimit = 10;
  config.trialCount = 200;
  config.annealingIterations = 2_000;
  config.enableSongChangeNeighbor = true;
  config.songRules = csvData.songs.map((song) => {
    const rule = createDefaultSongRule(song.id);
    rule.sameDayConsecutivePenalty = 5;
    rule.daySpacingPenalty = 1;
    rule.timeBalancePenalty = 10;
    return rule;
  });

  return {
    scoreTable: buildScoreTableFromSongCsv(csvData, config),
    config,
    minBalanceDifference: 1,
    maxBalanceDifference: 5,
  };
}
