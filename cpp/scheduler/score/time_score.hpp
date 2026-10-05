#pragma once

#include "../types.hpp"

namespace scheduler {

// 時間帯の偏りと早め・遅め希望を、通常点より弱い微小点として計算する。
ScoreResult calculateTimeScore(const ScoreTable& scoreTable,
                               const Assignment& assignment,
                               const SchedulerConfig& config);

}  // namespace scheduler
