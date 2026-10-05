#pragma once

#include "../types.hpp"

namespace scheduler {

// Balance 用。均等条件を守ったまま作れる、最小の空白数を探す。
int findMinBlankCount(const ScoreTable& scoreTable,
                      const SchedulerConfig& config);

}  // namespace scheduler
