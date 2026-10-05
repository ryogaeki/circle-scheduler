#pragma once

#include "../types.hpp"

namespace scheduler {

// 予定案全体の通常点・時間帯微小点・絶対不可違反をまとめて計算する。
ScoreResult calculateScheduleScore(const ScoreTable& scoreTable,
                                   const Assignment& assignment,
                                   const SchedulerConfig& config);

}  // namespace scheduler
