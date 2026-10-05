#include "create_target_counts.hpp"

#include <algorithm>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

using namespace std;

namespace scheduler {
namespace {

constexpr int UnsetFixedSongId = -2;
constexpr int BaseScoreWeight = 10;
constexpr int AssignedCountWeight = 6;

void validateScoreTableShape(const ScoreTable& scoreTable) {
    if (scoreTable.slotSongScores.size() != scoreTable.timeSlots.size()) {
        throw runtime_error("スコア表の行数と時間枠数が一致しません。");
    }

    for (size_t timeSlotId = 0; timeSlotId < scoreTable.slotSongScores.size(); ++timeSlotId) {
        if (scoreTable.slotSongScores[timeSlotId].size() != scoreTable.songs.size()) {
            throw runtime_error("スコア表の列数と曲数が一致しません。行番号: " +
                                to_string(timeSlotId + 1));
        }
    }
}

SongRuleConfig defaultRuleForSong(int songId) {
    SongRuleConfig rule;
    rule.songId = songId;
    return rule;
}

void validateSongRule(const SongRuleConfig& rule, int songCount) {
    if (rule.songId < 0 || rule.songId >= songCount) {
        throw runtime_error("存在しない曲IDの設定があります。");
    }
    if (rule.targetCount < -1 || rule.minCount < 0 || rule.maxCount < -1) {
        throw runtime_error("曲ごとの回数設定に負の値があります。");
    }
    if (rule.maxCount != -1 && rule.minCount > rule.maxCount) {
        throw runtime_error("minCount が maxCount を超えています。");
    }
}

vector<SongRuleConfig> buildSongRules(const ScoreTable& scoreTable,
                                      const SchedulerConfig& config) {
    const int songCount = static_cast<int>(scoreTable.songs.size());
    vector<SongRuleConfig> rules;
    vector<bool> alreadySet(songCount, false);

    for (int songId = 0; songId < songCount; ++songId) {
        rules.push_back(defaultRuleForSong(songId));
    }

    for (const SongRuleConfig& rule : config.songRules) {
        validateSongRule(rule, songCount);
        if (alreadySet[rule.songId]) {
            throw runtime_error("同じ曲IDの設定が複数あります。");
        }
        rules[rule.songId] = rule;
        alreadySet[rule.songId] = true;
    }

    return rules;
}

int maxConsecutiveRunLength(const vector<int>& indexes) {
    if (indexes.empty()) {
        return 0;
    }

    int bestLength = 1;
    int currentLength = 1;
    for (int index = 1; index < static_cast<int>(indexes.size()); ++index) {
        if (indexes[index] == indexes[index - 1] + 1) {
            ++currentLength;
        } else {
            currentLength = 1;
        }
        bestLength = max(bestLength, currentLength);
    }
    return bestLength;
}

int dayCapacityForSong(const vector<int>& availableIndexes,
                       const SongRuleConfig& rule) {
    if (availableIndexes.empty()) {
        return 0;
    }
    if (rule.maxPerDayPolicy == ConstraintPolicy::AllowWithPenalty) {
        return static_cast<int>(availableIndexes.size());
    }

    const int maxPerDay = max(0, rule.maxPerDay);
    if (maxPerDay <= 1) {
        return min(maxPerDay, static_cast<int>(availableIndexes.size()));
    }
    if (rule.sameDayNonConsecutivePolicy == ConstraintPolicy::Forbidden) {
        return min(maxPerDay, maxConsecutiveRunLength(availableIndexes));
    }
    return min(maxPerDay, static_cast<int>(availableIndexes.size()));
}

vector<int> countAvailableSlotsBySong(const ScoreTable& scoreTable,
                                      const vector<SongRuleConfig>& rules) {
    vector<int> availableSlotsBySong(scoreTable.songs.size(), 0);
    const int dayCount = scoreTable.timeSlots.empty() ? 0 : scoreTable.timeSlots.back().dayIndex + 1;

    for (int songId = 0; songId < static_cast<int>(scoreTable.songs.size()); ++songId) {
        vector<vector<int>> availableIndexesByDay(dayCount);
        for (int timeSlotId = 0; timeSlotId < static_cast<int>(scoreTable.timeSlots.size()); ++timeSlotId) {
            if (scoreTable.slotSongScores[timeSlotId][songId] == ForbiddenScore) {
                continue;
            }
            const TimeSlot& timeSlot = scoreTable.timeSlots[timeSlotId];
            availableIndexesByDay[timeSlot.dayIndex].push_back(timeSlot.indexInDay);
        }

        for (const vector<int>& availableIndexes : availableIndexesByDay) {
            availableSlotsBySong[songId] += dayCapacityForSong(availableIndexes, rules[songId]);
        }
    }

    return availableSlotsBySong;
}

int countFillableSlots(const ScoreTable& scoreTable) {
    int fillableSlotCount = 0;

    for (const vector<int>& scoreRow : scoreTable.slotSongScores) {
        bool hasAvailableSong = false;
        for (int score : scoreRow) {
            if (score != ForbiddenScore) {
                hasAvailableSong = true;
                break;
            }
        }
        if (hasAvailableSong) {
            ++fillableSlotCount;
        }
    }

    return fillableSlotCount;
}

int sumCounts(const vector<int>& counts) {
    int total = 0;
    for (int count : counts) {
        total += count;
    }
    return total;
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

vector<int> countFixedAssignments(const ScoreTable& scoreTable,
                                  const SchedulerConfig& config) {
    vector<int> fixedCounts(scoreTable.songs.size(), 0);
    vector<int> fixedSongBySlot(scoreTable.timeSlots.size(), UnsetFixedSongId);

    for (const AssignmentRequest& request : config.assignmentRequests) {
        if (!request.fixed) {
            continue;
        }
        if (request.timeSlotId < 0 ||
            request.timeSlotId >= static_cast<int>(scoreTable.timeSlots.size())) {
            throw runtime_error("存在しない時間枠IDの確定要求があります。");
        }
        if (request.songId != EmptySongId &&
            (request.songId < 0 || request.songId >= static_cast<int>(scoreTable.songs.size()))) {
            throw runtime_error("存在しない曲IDの確定要求があります。");
        }
        if (fixedSongBySlot[request.timeSlotId] != UnsetFixedSongId &&
            fixedSongBySlot[request.timeSlotId] != request.songId) {
            throw runtime_error("同じ時間枠に異なる確定要求があります。");
        }
        if (request.songId != EmptySongId &&
            scoreTable.slotSongScores[request.timeSlotId][request.songId] == ForbiddenScore) {
            throw runtime_error("絶対不可の枠に確定要求があります。");
        }

        fixedSongBySlot[request.timeSlotId] = request.songId;
    }

    for (int songId : fixedSongBySlot) {
        if (songId != UnsetFixedSongId && songId != EmptySongId) {
            ++fixedCounts[songId];
        }
    }

    return fixedCounts;
}

void validateTargetCount(int songId,
                         int targetCount,
                         int fixedCount,
                         int availableSlotCount,
                         const SongRuleConfig& rule) {
    if (targetCount < fixedCount) {
        throw runtime_error("targetCount が確定済み回数より少ない曲があります。曲ID: " +
                            to_string(songId));
    }
    if (targetCount < rule.minCount) {
        throw runtime_error("targetCount が minCount より少ない曲があります。曲ID: " +
                            to_string(songId));
    }
    if (rule.maxCount != -1 && targetCount > rule.maxCount) {
        throw runtime_error("targetCount が maxCount を超えた曲があります。曲ID: " +
                            to_string(songId));
    }
    if (targetCount > availableSlotCount) {
        throw runtime_error("targetCount を満たせる枠が足りない曲があります。曲ID: " +
                            to_string(songId));
    }
}

vector<int> createFixedTargetCounts(const ScoreTable& scoreTable,
                                    const vector<SongRuleConfig>& rules,
                                    const vector<int>& fixedCounts,
                                    const vector<int>& availableSlotsBySong,
                                    int fillableSlotCount) {
    vector<int> targetCounts(scoreTable.songs.size(), 0);
    int totalTargetCount = 0;

    for (int songId = 0; songId < static_cast<int>(scoreTable.songs.size()); ++songId) {
        if (rules[songId].targetCount < 0) {
            throw runtime_error("FixedTarget では全曲の targetCount が必要です。");
        }

        targetCounts[songId] = rules[songId].targetCount;
        validateTargetCount(songId,
                            targetCounts[songId],
                            fixedCounts[songId],
                            availableSlotsBySong[songId],
                            rules[songId]);
        totalTargetCount += targetCounts[songId];
    }

    if (totalTargetCount > fillableSlotCount) {
        throw runtime_error("targetCount の合計が、曲を入れられる時間枠数を超えています。");
    }

    return targetCounts;
}

bool canAddOneMore(int songId,
                   const vector<int>& targetCounts,
                   const vector<int>& availableSlotsBySong,
                   const vector<SongRuleConfig>& rules) {
    // BalanceでもtargetCountを指定した曲は、その回数で固定する。
    if (rules[songId].targetCount >= 0) {
        return false;
    }
    if (targetCounts[songId] >= availableSlotsBySong[songId]) {
        return false;
    }
    if (rules[songId].maxCount != -1 && targetCounts[songId] >= rules[songId].maxCount) {
        return false;
    }
    return true;
}

bool fixedSlotRejectsSong(const SchedulerConfig& config, int timeSlotId, int songId) {
    for (const AssignmentRequest& request : config.assignmentRequests) {
        if (!request.fixed || request.timeSlotId != timeSlotId) {
            continue;
        }
        return request.songId != songId;
    }
    return false;
}

int requestBonusForSlotSong(const SchedulerConfig& config, int timeSlotId, int songId) {
    int bonus = 0;
    for (const AssignmentRequest& request : config.assignmentRequests) {
        if (request.fixed) {
            continue;
        }
        if (request.timeSlotId == timeSlotId && request.songId == songId) {
            bonus += max(0, request.priority);
        }
    }
    return bonus;
}

vector<int> collectPotentialScores(const ScoreTable& scoreTable,
                                   const SchedulerConfig& config,
                                   int songId) {
    vector<int> scores;

    for (int timeSlotId = 0; timeSlotId < static_cast<int>(scoreTable.timeSlots.size()); ++timeSlotId) {
        if (fixedSlotRejectsSong(config, timeSlotId, songId)) {
            continue;
        }

        const int baseScore = scoreTable.slotSongScores[timeSlotId][songId];
        if (baseScore == ForbiddenScore) {
            continue;
        }

        // 基本スコアも見つつ、コメント由来の希望枠はかなり強く見る。
        scores.push_back(baseScore * BaseScoreWeight +
                         requestBonusForSlotSong(config, timeSlotId, songId));
    }

    sort(scores.begin(), scores.end(), greater<int>());
    return scores;
}

int scoreForIncreasingSong(const ScoreTable& scoreTable,
                           const SchedulerConfig& config,
                           const vector<int>& targetCounts,
                           int songId) {
    const vector<int> potentialScores = collectPotentialScores(scoreTable, config, songId);
    const int nextIndex = targetCounts[songId];
    if (nextIndex < 0 || nextIndex >= static_cast<int>(potentialScores.size())) {
        return ForbiddenScore;
    }
    return potentialScores[nextIndex];
}

struct SongIncreaseCandidate {
    int songId;
    int score;
};

int findSongToIncrease(const ScoreTable& scoreTable,
                       const SchedulerConfig& config,
                       const vector<int>& targetCounts,
                       const vector<int>& availableSlotsBySong,
                       const vector<SongRuleConfig>& rules,
                       int balanceMaxDifference,
                       mt19937& randomEngine) {
    vector<SongIncreaseCandidate> candidates;

    for (int songId = 0; songId < static_cast<int>(targetCounts.size()); ++songId) {
        if (!canAddOneMore(songId, targetCounts, availableSlotsBySong, rules)) {
            continue;
        }

        vector<int> trialCounts = targetCounts;
        ++trialCounts[songId];
        if (!isBalancedWithinLimit(trialCounts, balanceMaxDifference)) {
            continue;
        }

        int score = scoreForIncreasingSong(scoreTable, config, targetCounts, songId);
        if (score == ForbiddenScore) {
            continue;
        }

        // 良い枠を持つ曲を優先しつつ、同じ曲へ寄せすぎない。
        score -= targetCounts[songId] * AssignedCountWeight;
        candidates.push_back(SongIncreaseCandidate{songId, score});
    }

    if (candidates.empty()) {
        return -1;
    }

    sort(candidates.begin(),
         candidates.end(),
         [](const SongIncreaseCandidate& left, const SongIncreaseCandidate& right) {
             return left.score > right.score;
         });

    int selectableCount = 1;
    while (selectableCount < static_cast<int>(candidates.size()) &&
           selectableCount < 6 &&
           candidates[selectableCount].score >= candidates[0].score - 30) {
        ++selectableCount;
    }

    // 上位候補からseedで選ぶ。完全ランダムよりは賢く、決め打ちよりは詰みにくい。
    uniform_int_distribution<int> distribution(0, selectableCount - 1);
    return candidates[distribution(randomEngine)].songId;
}

vector<int> createBalancedTargetCounts(const ScoreTable& scoreTable,
                                       const SchedulerConfig& config,
                                       const vector<SongRuleConfig>& rules,
                                       const vector<int>& fixedCounts,
                                       const vector<int>& availableSlotsBySong,
                                       int totalAssignedCount,
                                       int balanceMaxDifference,
                                       mt19937& randomEngine) {
    vector<int> targetCounts(scoreTable.songs.size(), 0);
    int usedCount = 0;

    for (int songId = 0; songId < static_cast<int>(scoreTable.songs.size()); ++songId) {
        targetCounts[songId] = fixedCounts[songId];
        if (rules[songId].targetCount >= 0) {
            targetCounts[songId] = rules[songId].targetCount;
        } else if (targetCounts[songId] < rules[songId].minCount) {
            targetCounts[songId] = rules[songId].minCount;
        }

        validateTargetCount(songId,
                            targetCounts[songId],
                            fixedCounts[songId],
                            availableSlotsBySong[songId],
                            rules[songId]);
        usedCount += targetCounts[songId];
    }

    if (usedCount > totalAssignedCount) {
        throw runtime_error("最低回数と確定要求の合計が、今回入れる枠数を超えています。");
    }

    int remainingCount = totalAssignedCount - usedCount;
    while (remainingCount > 0) {
        const int songId = findSongToIncrease(scoreTable,
                                             config,
                                             targetCounts,
                                             availableSlotsBySong,
                                             rules,
                                             balanceMaxDifference,
                                             randomEngine);
        if (songId == -1) {
            break;
        }
        ++targetCounts[songId];
        --remainingCount;
    }

    if (sumCounts(targetCounts) != totalAssignedCount) {
        throw runtime_error("指定された枠数ぶんの targetCounts を作れません。");
    }
    if (!isBalancedWithinLimit(targetCounts, balanceMaxDifference)) {
        throw runtime_error("各曲の回数差が balanceMaxDifference を超えています。");
    }

    return targetCounts;
}

}  // namespace

vector<int> createTargetCounts(const ScoreTable& scoreTable,
                               const SchedulerConfig& config) {
    validateScoreTableShape(scoreTable);

    const vector<SongRuleConfig> rules = buildSongRules(scoreTable, config);
    const vector<int> fixedCounts = countFixedAssignments(scoreTable, config);
    const vector<int> availableSlotsBySong = countAvailableSlotsBySong(scoreTable, rules);
    const int fillableSlotCount = countFillableSlots(scoreTable);
    mt19937 randomEngine(static_cast<unsigned int>(config.randomSeed));

    if (config.countRuleMode == CountRuleMode::FixedTarget) {
        return createFixedTargetCounts(scoreTable,
                                       rules,
                                       fixedCounts,
                                       availableSlotsBySong,
                                       fillableSlotCount);
    }

    return createBalancedTargetCounts(scoreTable,
                                      config,
                                      rules,
                                      fixedCounts,
                                      availableSlotsBySong,
                                      fillableSlotCount,
                                      config.balanceMaxDifference,
                                      randomEngine);
}

vector<int> createTargetCounts(const ScoreTable& scoreTable,
                               const SchedulerConfig& config,
                               int totalAssignedCount) {
    validateScoreTableShape(scoreTable);

    if (config.countRuleMode == CountRuleMode::FixedTarget) {
        throw runtime_error("totalAssignedCount 指定版は Balance 用です。");
    }

    const int fillableSlotCount = countFillableSlots(scoreTable);
    if (totalAssignedCount < 0 || totalAssignedCount > fillableSlotCount) {
        throw runtime_error("totalAssignedCount が、曲を入れられる時間枠数の範囲外です。");
    }

    const vector<SongRuleConfig> rules = buildSongRules(scoreTable, config);
    const vector<int> fixedCounts = countFixedAssignments(scoreTable, config);
    const vector<int> availableSlotsBySong = countAvailableSlotsBySong(scoreTable, rules);
    mt19937 randomEngine(static_cast<unsigned int>(config.randomSeed));

    return createBalancedTargetCounts(scoreTable,
                                      config,
                                      rules,
                                      fixedCounts,
                                      availableSlotsBySong,
                                      totalAssignedCount,
                                      config.balanceMaxDifference,
                                      randomEngine);
}

}  // namespace scheduler
