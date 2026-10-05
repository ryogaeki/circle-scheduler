#include "find_min_blank_count.hpp"

#include <stdexcept>
#include <vector>

#include "create_initial_assignment.hpp"
#include "create_target_counts.hpp"

using namespace std;

namespace scheduler {
namespace {

int searchTrialCount(const SchedulerConfig& config) {
    return config.trialCount <= 0 ? 1 : config.trialCount;
}

bool canCreateInitialAssignmentWithBlankCount(const ScoreTable& scoreTable,
                                              const SchedulerConfig& config,
                                              int blankCount) {
    const int totalAssignedCount = static_cast<int>(scoreTable.timeSlots.size()) - blankCount;
    const int trialCount = searchTrialCount(config);

    for (int trial = 0; trial < trialCount; ++trial) {
        SchedulerConfig trialConfig = config;
        trialConfig.randomSeed = config.randomSeed + trial;

        try {
            const vector<int> targetCounts = createTargetCounts(scoreTable,
                                                                trialConfig,
                                                                totalAssignedCount);
            createInitialAssignment(scoreTable, targetCounts, trialConfig);
            return true;
        } catch (const runtime_error&) {
            // このseedでは作れなかっただけなので、別seedを試す。
        }
    }

    return false;
}

}  // namespace

int findMinBlankCount(const ScoreTable& scoreTable,
                      const SchedulerConfig& config) {
    if (config.countRuleMode == CountRuleMode::FixedTarget) {
        throw runtime_error("findMinBlankCount は Balance 用です。");
    }

    const int slotCount = static_cast<int>(scoreTable.timeSlots.size());
    for (int blankCount = 0; blankCount <= slotCount; ++blankCount) {
        if (canCreateInitialAssignmentWithBlankCount(scoreTable, config, blankCount)) {
            return blankCount;
        }
    }

    throw runtime_error("均等条件を守れる初期案を作れません。");
}

}  // namespace scheduler
