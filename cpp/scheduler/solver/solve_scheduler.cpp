#include "solve_scheduler.hpp"

#include <stdexcept>
#include <vector>

#include "annealing.hpp"                 // runAnnealing: 初期案を焼きなましで改善する
#include "candidate_store.hpp"           // addCandidateSorted: 候補をスコア順に残す
#include "create_initial_assignment.hpp" // createInitialAssignment: 最初の予定案を作る
#include "create_target_counts.hpp"      // createTargetCounts: 曲ごとの目標回数を作る
#include "find_min_blank_count.hpp"      // findMinBlankCount: Balance の最小空白数を探す

using namespace std;

namespace scheduler {

SchedulerResult solveScheduler(const ScoreTable& scoreTable,
                               const SchedulerConfig& config) {
    SchedulerResult result;
    const int trialCount = config.trialCount <= 0 ? 1 : config.trialCount;
    result.statistics.attemptedTrialCount = trialCount;
    int totalAssignedCount = -1;

    if (config.countRuleMode == CountRuleMode::Balance) {
        // Balance では、均等条件を守れる最小空白数を先に決める。
        const int minBlankCount = findMinBlankCount(scoreTable, config);
        result.statistics.minimumBlankCount = minBlankCount;
        totalAssignedCount = static_cast<int>(scoreTable.timeSlots.size()) - minBlankCount;
    }

    for (int trial = 0; trial < trialCount; ++trial) {
        SchedulerConfig trialConfig = config;
        trialConfig.randomSeed = config.randomSeed + trial;

        vector<int> targetCounts;
        try {
            // create_target_counts.cpp: このseedで曲ごとの目標回数を決める。
            if (config.countRuleMode == CountRuleMode::FixedTarget) {
                targetCounts = createTargetCounts(scoreTable, trialConfig);
            } else {
                targetCounts = createTargetCounts(scoreTable,
                                                  trialConfig,
                                                  totalAssignedCount);
            }
        } catch (const runtime_error&) {
            if (config.countRuleMode == CountRuleMode::FixedTarget) {
                throw;
            }
            ++result.statistics.targetCountFailureCount;
            ++result.statistics.failedTrialCount;
            continue;
        }

        Assignment initialAssignment;
        try {
            // create_initial_assignment.cpp: 目標回数に合わせて最初の予定案を作る。
            initialAssignment = createInitialAssignment(scoreTable,
                                                        targetCounts,
                                                        trialConfig);
        } catch (const runtime_error&) {
            if (config.countRuleMode == CountRuleMode::FixedTarget) {
                throw;
            }
            ++result.statistics.initialAssignmentFailureCount;
            ++result.statistics.failedTrialCount;
            continue;
        }

        try {
            // annealing.cpp: 初期案を近傍で動かし、合計点が高い案を探す。
            const ScheduleCandidate candidate = runAnnealing(scoreTable,
                                                             initialAssignment,
                                                             trialConfig);

            // candidate_store.cpp: 焼きなまし後の候補をスコア順で保存する。
            addCandidateSorted(result.candidates, candidate, config.candidateLimit);
            ++result.statistics.successfulTrialCount;
        } catch (const runtime_error&) {
            if (config.countRuleMode == CountRuleMode::FixedTarget) {
                throw;
            }
            ++result.statistics.annealingFailureCount;
            ++result.statistics.failedTrialCount;
        }
    }

    if (result.candidates.empty()) {
        throw runtime_error("予定候補を1つも作れませんでした。");
    }

    return result;
}

}  // namespace scheduler
