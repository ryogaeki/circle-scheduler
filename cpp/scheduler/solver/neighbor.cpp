#include "neighbor.hpp"

#include <algorithm>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

#include "../score/day_constraint_score.hpp"

using namespace std;

namespace scheduler {
namespace {

void validateAssignmentShape(const ScoreTable& scoreTable,
                             const Assignment& assignment) {
    if (assignment.assignedSongIds.size() != scoreTable.timeSlots.size()) {
        throw runtime_error("Assignment の枠数と timeSlots の数が一致しません。");
    }

    for (int timeSlotId = 0; timeSlotId < static_cast<int>(assignment.assignedSongIds.size()); ++timeSlotId) {
        const int songId = assignment.assignedSongIds[timeSlotId];
        if (songId != EmptySongId &&
            (songId < 0 || songId >= static_cast<int>(scoreTable.songs.size()))) {
            throw runtime_error("Assignment に存在しない曲IDがあります。枠ID: " +
                                to_string(timeSlotId));
        }
    }
}

vector<SongRuleConfig> createSongRules(const ScoreTable& scoreTable,
                                       const SchedulerConfig& config) {
    vector<SongRuleConfig> rules(scoreTable.songs.size());

    for (int songId = 0; songId < static_cast<int>(scoreTable.songs.size()); ++songId) {
        rules[songId].songId = songId;
    }

    for (const SongRuleConfig& rule : config.songRules) {
        if (rule.songId < 0 || rule.songId >= static_cast<int>(scoreTable.songs.size())) {
            throw runtime_error("存在しない曲IDの近傍設定があります。");
        }
        rules[rule.songId] = rule;
    }

    return rules;
}

vector<bool> createFixedSlotFlags(const ScoreTable& scoreTable,
                                  const SchedulerConfig& config) {
    vector<bool> fixedSlot(scoreTable.timeSlots.size(), false);

    for (const AssignmentRequest& request : config.assignmentRequests) {
        if (!request.fixed) {
            continue;
        }
        if (request.timeSlotId < 0 ||
            request.timeSlotId >= static_cast<int>(scoreTable.timeSlots.size())) {
            throw runtime_error("存在しない時間枠IDの確定要求があります。");
        }
        fixedSlot[request.timeSlotId] = true;
    }

    return fixedSlot;
}

vector<int> countSongs(const ScoreTable& scoreTable,
                       const Assignment& assignment) {
    vector<int> counts(scoreTable.songs.size(), 0);

    for (int songId : assignment.assignedSongIds) {
        if (songId != EmptySongId) {
            ++counts[songId];
        }
    }

    return counts;
}

bool isBalancedWithinLimit(const vector<int>& counts, int maxDifference) {
    if (counts.empty()) {
        return true;
    }

    int minCount = counts[0];
    int maxCount = counts[0];
    for (int count : counts) {
        minCount = min(minCount, count);
        maxCount = max(maxCount, count);
    }

    return maxCount - minCount <= max(0, maxDifference);
}

bool respectsCountRules(const vector<int>& counts,
                        const vector<SongRuleConfig>& rules,
                        const SchedulerConfig& config) {
    for (int songId = 0; songId < static_cast<int>(counts.size()); ++songId) {
        if (rules[songId].targetCount >= 0 &&
            counts[songId] != rules[songId].targetCount) {
            return false;
        }
        if (counts[songId] < rules[songId].minCount) {
            return false;
        }
        if (rules[songId].maxCount != -1 && counts[songId] > rules[songId].maxCount) {
            return false;
        }
    }

    return isBalancedWithinLimit(counts, config.balanceMaxDifference);
}

vector<int> collectMovableSlots(const Assignment& assignment,
                                const vector<bool>& fixedSlot,
                                bool filledOnly) {
    vector<int> movableSlots;

    for (int timeSlotId = 0; timeSlotId < static_cast<int>(assignment.assignedSongIds.size()); ++timeSlotId) {
        if (fixedSlot[timeSlotId]) {
            continue;
        }
        if (filledOnly && assignment.assignedSongIds[timeSlotId] == EmptySongId) {
            continue;
        }
        movableSlots.push_back(timeSlotId);
    }

    return movableSlots;
}

}  // namespace

Assignment createSwapNeighbor(const ScoreTable& scoreTable,
                              const Assignment& assignment,
                              const SchedulerConfig& config,
                              mt19937& randomEngine) {
    validateAssignmentShape(scoreTable, assignment);

    const vector<bool> fixedSlot = createFixedSlotFlags(scoreTable, config);
    const vector<int> movableSlots = collectMovableSlots(assignment,
                                                         fixedSlot,
                                                         false);
    if (movableSlots.size() < 2) {
        return assignment;
    }

    uniform_int_distribution<int> distribution(0, static_cast<int>(movableSlots.size()) - 1);

    // ランダムに2枠選び、問題なければその2枠を入れ替える。
    const int maxAttempts = 50;
    for (int attempt = 0; attempt < maxAttempts; ++attempt) {
        const int firstTimeSlotId = movableSlots[distribution(randomEngine)];
        const int secondTimeSlotId = movableSlots[distribution(randomEngine)];
        if (firstTimeSlotId == secondTimeSlotId) {
            continue;
        }

        const int firstSongId = assignment.assignedSongIds[firstTimeSlotId];
        const int secondSongId = assignment.assignedSongIds[secondTimeSlotId];
        if (firstSongId == secondSongId) {
            continue;
        }

        // swap後に絶対不可の枠へ入る場合は、そのswapを使わない。
        const bool firstSlotOk = secondSongId == EmptySongId ||
                                 scoreTable.slotSongScores[firstTimeSlotId][secondSongId] != ForbiddenScore;
        const bool secondSlotOk = firstSongId == EmptySongId ||
                                  scoreTable.slotSongScores[secondTimeSlotId][firstSongId] != ForbiddenScore;
        if (!firstSlotOk || !secondSlotOk) {
            continue;
        }

        Assignment neighbor = assignment;
        neighbor.assignedSongIds[firstTimeSlotId] = secondSongId;
        neighbor.assignedSongIds[secondTimeSlotId] = firstSongId;
        if (calculateDayConstraintScore(scoreTable, neighbor, config).hasHardViolation) {
            continue;
        }

        return neighbor;
    }

    return assignment;
}

Assignment createChangeSongNeighbor(const ScoreTable& scoreTable,
                                    const Assignment& assignment,
                                    const SchedulerConfig& config,
                                    mt19937& randomEngine) {
    validateAssignmentShape(scoreTable, assignment);

    if (config.countRuleMode == CountRuleMode::FixedTarget) {
        return assignment;
    }

    const vector<SongRuleConfig> rules = createSongRules(scoreTable, config);
    const vector<bool> fixedSlot = createFixedSlotFlags(scoreTable, config);
    const vector<int> movableFilledSlots = collectMovableSlots(assignment,
                                                               fixedSlot,
                                                               true);
    if (movableFilledSlots.empty() || scoreTable.songs.size() < 2) {
        return assignment;
    }

    const vector<int> currentCounts = countSongs(scoreTable, assignment);
    uniform_int_distribution<int> slotDistribution(0, static_cast<int>(movableFilledSlots.size()) - 1);
    uniform_int_distribution<int> songDistribution(0, static_cast<int>(scoreTable.songs.size()) - 1);

    // 1枠だけ曲を変える。曲数差や min/max を破る変更は使わない。
    const int maxAttempts = 100;
    for (int attempt = 0; attempt < maxAttempts; ++attempt) {
        const int timeSlotId = movableFilledSlots[slotDistribution(randomEngine)];
        const int oldSongId = assignment.assignedSongIds[timeSlotId];
        const int newSongId = songDistribution(randomEngine);
        if (newSongId == oldSongId) {
            continue;
        }
        if (scoreTable.slotSongScores[timeSlotId][newSongId] == ForbiddenScore) {
            continue;
        }

        vector<int> nextCounts = currentCounts;
        --nextCounts[oldSongId];
        ++nextCounts[newSongId];
        if (!respectsCountRules(nextCounts, rules, config)) {
            continue;
        }

        Assignment neighbor = assignment;
        neighbor.assignedSongIds[timeSlotId] = newSongId;
        if (calculateDayConstraintScore(scoreTable, neighbor, config).hasHardViolation) {
            continue;
        }

        return neighbor;
    }

    return assignment;
}

}  // namespace scheduler
