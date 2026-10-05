#pragma once

#include "../types.hpp"

namespace scheduler {

// 同じ日に同じ曲が入りすぎていないかを減点する。
ScoreResult calculateDayConstraintScore(const ScoreTable& scoreTable,
                                        const Assignment& assignment,
                                        const SchedulerConfig& config);

}  // namespace scheduler
