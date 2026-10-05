#pragma once

#include "../types.hpp"

namespace scheduler {

// 確定枠と希望枠を、予定案のスコアに反映する。
ScoreResult calculateAssignmentRequestScore(const ScoreTable& scoreTable,
                                            const Assignment& assignment,
                                            const SchedulerConfig& config);

}  // namespace scheduler
