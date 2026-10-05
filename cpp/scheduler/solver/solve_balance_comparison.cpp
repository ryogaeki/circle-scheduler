#include "solve_balance_comparison.hpp"

#include <stdexcept>
#include <string>

#include "solve_scheduler.hpp"

using namespace std;

namespace scheduler {
namespace {

bool shouldSelectEntry(const BalanceComparisonEntry& candidate,
                       const BalanceComparisonEntry& selected) {
    if (candidate.result.statistics.minimumBlankCount !=
        selected.result.statistics.minimumBlankCount) {
        return candidate.result.statistics.minimumBlankCount <
               selected.result.statistics.minimumBlankCount;
    }
    if (candidate.maxDifference != selected.maxDifference) {
        return candidate.maxDifference < selected.maxDifference;
    }
    const ScoreResult& candidateScore = candidate.result.candidates[0].score;
    const ScoreResult& selectedScore = selected.result.candidates[0].score;
    if (candidateScore.totalScore != selectedScore.totalScore) {
        return candidateScore.totalScore > selectedScore.totalScore;
    }
    return candidateScore.timeTieBreakScore > selectedScore.timeTieBreakScore;
}

}  // namespace

BalanceComparisonResult solveBalanceComparison(const ScoreTable& scoreTable,
                                                const SchedulerConfig& config,
                                                int minDifference,
                                                int maxDifference) {
    if (config.countRuleMode != CountRuleMode::Balance) {
        throw runtime_error("曲数差の比較はBalance専用です。");
    }
    if (minDifference < 0 || minDifference > maxDifference) {
        throw runtime_error("比較する曲数差の範囲が正しくありません。");
    }

    BalanceComparisonResult comparison;

    for (int difference = minDifference; difference <= maxDifference; ++difference) {
        BalanceComparisonEntry entry;
        entry.maxDifference = difference;

        SchedulerConfig trialConfig = config;
        trialConfig.balanceMaxDifference = difference;

        try {
            entry.result = solveScheduler(scoreTable, trialConfig);
            entry.solved = true;
        } catch (const runtime_error& error) {
            entry.errorMessage = error.what();
        }

        comparison.entries.push_back(entry);
        const int entryIndex = static_cast<int>(comparison.entries.size()) - 1;
        if (!entry.solved) {
            continue;
        }
        if (comparison.selectedEntryIndex == -1 ||
            shouldSelectEntry(comparison.entries[entryIndex],
                              comparison.entries[comparison.selectedEntryIndex])) {
            comparison.selectedEntryIndex = entryIndex;
        }
    }

    if (comparison.selectedEntryIndex == -1) {
        throw runtime_error("指定した曲数差では予定候補を作れませんでした。");
    }

    return comparison;
}

}  // namespace scheduler
