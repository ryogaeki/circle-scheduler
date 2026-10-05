#pragma once

#include <vector>

#include "../types.hpp"

namespace scheduler {

// targetCounts に合わせて、最初の予定案を作る。
Assignment createInitialAssignment(const ScoreTable& scoreTable,
                                   const std::vector<int>& targetCounts,
                                   const SchedulerConfig& config);

}  // namespace scheduler
