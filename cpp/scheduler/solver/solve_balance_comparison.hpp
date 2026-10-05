#pragma once

#include "../types.hpp"

namespace scheduler {

// 曲数の最大差を順に変えて探索し、空白数と点数を比較する。
BalanceComparisonResult solveBalanceComparison(const ScoreTable& scoreTable,
                                                const SchedulerConfig& config,
                                                int minDifference,
                                                int maxDifference);

}  // namespace scheduler
