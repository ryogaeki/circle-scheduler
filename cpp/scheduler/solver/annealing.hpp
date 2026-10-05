#pragma once

#include "../types.hpp"

namespace scheduler {

// 初期案をswapで少しずつ動かし、基本スコアが高い案を探す。
ScheduleCandidate runAnnealing(const ScoreTable& scoreTable,
                               const Assignment& initialAssignment,
                               const SchedulerConfig& config);

}  // namespace scheduler
