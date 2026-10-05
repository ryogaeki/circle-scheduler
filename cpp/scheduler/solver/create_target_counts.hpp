#pragma once

#include <vector>

#include "../types.hpp"

namespace scheduler {

// 各曲を何回入れるかを決める。まだ具体的な時間枠には割り当てない。
std::vector<int> createTargetCounts(const ScoreTable& scoreTable,
                                    const SchedulerConfig& config);

// Balance 用。合計で何枠埋めるかを指定して、各曲の回数差が設定値以内になるように決める。
std::vector<int> createTargetCounts(const ScoreTable& scoreTable,
                                    const SchedulerConfig& config,
                                    int totalAssignedCount);

}  // namespace scheduler
