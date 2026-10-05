#pragma once

#include "../types.hpp"

namespace scheduler {

// 同じ曲が日付方向に偏りすぎていないかを小さく減点する。
ScoreResult calculateDaySpacingScore(const ScoreTable& scoreTable,
                                     const Assignment& assignment,
                                     const SchedulerConfig& config);

}  // namespace scheduler
