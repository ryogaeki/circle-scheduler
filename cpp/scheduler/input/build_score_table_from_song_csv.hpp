#pragma once

#include "../types.hpp"

namespace scheduler {

// 曲ごとCSVの予定記号を、最適化用のスコア表に変換する。
ScoreTable buildScoreTableFromSongCsv(const SongCsvData& songCsvData);

// 曲ごとの設定を使って、×/✕ の扱いも含めてスコア表に変換する。
ScoreTable buildScoreTableFromSongCsv(const SongCsvData& songCsvData,
                                      const SchedulerConfig& config);

}  // namespace scheduler
