#pragma once

#include <vector>

#include "../types.hpp"

namespace scheduler {

// 候補をスコア順に並べ、上位 limit 件だけ残す。
void addCandidateSorted(std::vector<ScheduleCandidate>& candidates,
                        const ScheduleCandidate& candidate,
                        int limit);

}  // namespace scheduler
