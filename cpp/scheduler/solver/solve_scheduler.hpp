#pragma once

#include "../types.hpp"

namespace scheduler {

// 複数seedで回し、焼きなまし後の候補と試行結果を返す。
SchedulerResult solveScheduler(const ScoreTable& scoreTable,
                               const SchedulerConfig& config);

}  // namespace scheduler
