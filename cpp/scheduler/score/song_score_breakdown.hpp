#pragma once

#include <vector>

#include "../types.hpp"

namespace scheduler {

// 予定案の点数を曲ごとに分解し、表示用の内訳を作る。
std::vector<SongScoreBreakdown> calculateSongScoreBreakdowns(
    const ScoreTable& scoreTable,
    const Assignment& assignment,
    const SchedulerConfig& config);

}  // namespace scheduler
