#include "create_initial_assignment.hpp"

#include <algorithm>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

#include "../score/day_constraint_score.hpp"

using namespace std;

namespace scheduler {
namespace {

constexpr int UnsetFixedSongId = -2;
constexpr int BaseScoreWeight = 10;

vector<SongRuleConfig> createSongRules(const ScoreTable& scoreTable,
                                       const SchedulerConfig& config) {
    vector<SongRuleConfig> rules(scoreTable.songs.size());
    for (int songId = 0; songId < static_cast<int>(rules.size()); ++songId) {
        rules[songId].songId = songId;
    }
    for (const SongRuleConfig& rule : config.songRules) {
        if (rule.songId < 0 || rule.songId >= static_cast<int>(rules.size())) {
            throw runtime_error("存在しない曲IDの設定があります。");
        }
        rules[rule.songId] = rule;
    }
    return rules;
}

vector<bool> createFixedSlotFlags(const ScoreTable& scoreTable,
                                  const SchedulerConfig& config) {
    vector<bool> fixedSlot(scoreTable.timeSlots.size(), false);
    for (const AssignmentRequest& request : config.assignmentRequests) {
        if (request.fixed) {
            if (request.timeSlotId < 0 ||
                request.timeSlotId >= static_cast<int>(fixedSlot.size())) {
                throw runtime_error("存在しない時間枠IDの確定要求があります。");
            }
            fixedSlot[request.timeSlotId] = true;
        }
    }
    return fixedSlot;
}

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

void validateTargetCounts(const ScoreTable& scoreTable, const vector<int>& targetCounts) {
    if (targetCounts.size() != scoreTable.songs.size()) {
        throw runtime_error("targetCounts の数と曲数が一致しません。");
    }

    for (int songId = 0; songId < static_cast<int>(targetCounts.size()); ++songId) {
        if (targetCounts[songId] < 0) {
            throw runtime_error("targetCounts に負の値があります。曲ID: " +
                                to_string(songId));
        }
    }
}

void validateRequestIds(const ScoreTable& scoreTable, const AssignmentRequest& request) {
    if (request.timeSlotId < 0 ||
        request.timeSlotId >= static_cast<int>(scoreTable.timeSlots.size())) {
        throw runtime_error("存在しない時間枠IDの確定要求があります。");
    }
    if (request.songId == EmptySongId) {
        if (!request.fixed) {
            throw runtime_error("空白の割り当て要求は fixed=true のときだけ使えます。");
        }
        return;
    }
    if (request.songId < 0 || request.songId >= static_cast<int>(scoreTable.songs.size())) {
        throw runtime_error("存在しない曲IDの確定要求があります。");
    }
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

void placeFixedAssignments(const ScoreTable& scoreTable,
                           const SchedulerConfig& config,
                           Assignment& assignment,
                           vector<int>& remainingCounts) {
    vector<int> fixedSongBySlot(scoreTable.timeSlots.size(), UnsetFixedSongId);

    for (const AssignmentRequest& request : config.assignmentRequests) {
        if (!request.fixed) {
            continue;
        }

        validateRequestIds(scoreTable, request);

        const int timeSlotId = request.timeSlotId;
        const int songId = request.songId;
        if (fixedSongBySlot[timeSlotId] != UnsetFixedSongId &&
            fixedSongBySlot[timeSlotId] != songId) {
            throw runtime_error("同じ時間枠に異なる確定要求があります。");
        }
        if (songId != EmptySongId &&
            scoreTable.slotSongScores[timeSlotId][songId] == ForbiddenScore) {
            throw runtime_error("絶対不可の枠に確定要求があります。");
        }

        fixedSongBySlot[timeSlotId] = songId;
    }

    for (int timeSlotId = 0; timeSlotId < static_cast<int>(fixedSongBySlot.size()); ++timeSlotId) {
        const int songId = fixedSongBySlot[timeSlotId];
        if (songId == UnsetFixedSongId || songId == EmptySongId) {
            continue;
        }
        if (remainingCounts[songId] <= 0) {
            throw runtime_error("確定要求が targetCounts より多い曲があります。曲ID: " +
                                to_string(songId));
        }

        assignment.assignedSongIds[timeSlotId] = songId;
        --remainingCounts[songId];
    }
}

int countCandidatesForSlot(const ScoreTable& scoreTable,
                           const vector<int>& remainingCounts,
                           int timeSlotId) {
    int candidateCount = 0;

    for (int songId = 0; songId < static_cast<int>(scoreTable.songs.size()); ++songId) {
        if (remainingCounts[songId] <= 0) {
            continue;
        }
        if (scoreTable.slotSongScores[timeSlotId][songId] != ForbiddenScore) {
            ++candidateCount;
        }
    }

    return candidateCount;
}

int maxConsecutiveLength(vector<int> indexes) {
    if (indexes.empty()) {
        return 0;
    }

    sort(indexes.begin(), indexes.end());
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

int maxFinalCountForDay(vector<int> assignedIndexes,
                        vector<int> openIndexes,
                        const SongRuleConfig& rule) {
    const int assignedCount = static_cast<int>(assignedIndexes.size());
    int limit = assignedCount + static_cast<int>(openIndexes.size());
    if (rule.maxPerDayPolicy == ConstraintPolicy::Forbidden && rule.maxPerDay >= 0) {
        limit = min(limit, rule.maxPerDay);
    }
    if (limit <= 1) {
        return limit;
    }

    if (rule.sameDayConsecutivePolicy == ConstraintPolicy::Forbidden &&
        rule.sameDayNonConsecutivePolicy == ConstraintPolicy::Forbidden) {
        return min(limit, 1);
    }

    if (rule.sameDayNonConsecutivePolicy != ConstraintPolicy::Forbidden) {
        return limit;
    }

    // 非連続が禁止なら、すでに置いた枠を含む連続区間だけを増やせる。
    if (assignedIndexes.empty()) {
        return min(limit, maxConsecutiveLength(openIndexes));
    }

    sort(assignedIndexes.begin(), assignedIndexes.end());
    vector<int> usableIndexes = assignedIndexes;
    usableIndexes.insert(usableIndexes.end(), openIndexes.begin(), openIndexes.end());
    sort(usableIndexes.begin(), usableIndexes.end());

    const int firstAssigned = assignedIndexes.front();
    const int lastAssigned = assignedIndexes.back();
    int firstUsable = firstAssigned;
    int lastUsable = lastAssigned;

    while (find(usableIndexes.begin(), usableIndexes.end(), firstUsable - 1) != usableIndexes.end()) {
        --firstUsable;
    }
    while (find(usableIndexes.begin(), usableIndexes.end(), lastUsable + 1) != usableIndexes.end()) {
        ++lastUsable;
    }

    return min(limit, lastUsable - firstUsable + 1);
}

int remainingCapacityForSong(const ScoreTable& scoreTable,
                             const Assignment& assignment,
                             const vector<bool>& fixedSlot,
                             const SongRuleConfig& rule,
                             int excludedTimeSlotId) {
    const int dayCount = scoreTable.timeSlots.empty()
                             ? 0
                             : scoreTable.timeSlots.back().dayIndex + 1;
    vector<vector<int>> assignedByDay(dayCount);
    vector<vector<int>> openByDay(dayCount);

    for (int timeSlotId = 0; timeSlotId < static_cast<int>(scoreTable.timeSlots.size()); ++timeSlotId) {
        const TimeSlot& timeSlot = scoreTable.timeSlots[timeSlotId];
        if (assignment.assignedSongIds[timeSlotId] == rule.songId) {
            assignedByDay[timeSlot.dayIndex].push_back(timeSlot.indexInDay);
            continue;
        }
        if (timeSlotId == excludedTimeSlotId || fixedSlot[timeSlotId] ||
            assignment.assignedSongIds[timeSlotId] != EmptySongId ||
            scoreTable.slotSongScores[timeSlotId][rule.songId] == ForbiddenScore) {
            continue;
        }
        openByDay[timeSlot.dayIndex].push_back(timeSlot.indexInDay);
    }

    int capacity = 0;
    for (int dayIndex = 0; dayIndex < dayCount; ++dayIndex) {
        const int finalCount = maxFinalCountForDay(assignedByDay[dayIndex],
                                                   openByDay[dayIndex],
                                                   rule);
        capacity += finalCount - static_cast<int>(assignedByDay[dayIndex].size());
    }
    return capacity;
}

int mandatorySongForSlot(const ScoreTable& scoreTable,
                         const Assignment& assignment,
                         const vector<int>& remainingCounts,
                         const vector<SongRuleConfig>& rules,
                         const vector<bool>& fixedSlot,
                         int timeSlotId) {
    int mandatorySongId = EmptySongId;

    for (int songId = 0; songId < static_cast<int>(remainingCounts.size()); ++songId) {
        if (remainingCounts[songId] <= 0 ||
            scoreTable.slotSongScores[timeSlotId][songId] == ForbiddenScore) {
            continue;
        }

        const int capacityWithoutThisSlot = remainingCapacityForSong(scoreTable,
                                                                     assignment,
                                                                     fixedSlot,
                                                                     rules[songId],
                                                                     timeSlotId);
        if (capacityWithoutThisSlot >= remainingCounts[songId]) {
            continue;
        }

        // 2曲が同じ枠を必須としている場合、この貪欲案では解決できない。
        if (mandatorySongId != EmptySongId && mandatorySongId != songId) {
            return -2;
        }
        mandatorySongId = songId;
    }

    return mandatorySongId;
}

vector<int> createSlotOrder(const ScoreTable& scoreTable,
                            const Assignment& assignment,
                            const vector<int>& remainingCounts,
                            const SchedulerConfig& config,
                            mt19937& randomEngine) {
    vector<bool> fixedSlot(scoreTable.timeSlots.size(), false);
    for (const AssignmentRequest& request : config.assignmentRequests) {
        if (!request.fixed) {
            continue;
        }
        validateRequestIds(scoreTable, request);
        fixedSlot[request.timeSlotId] = true;
    }

    vector<int> timeSlotIds;

    for (int timeSlotId = 0; timeSlotId < static_cast<int>(scoreTable.timeSlots.size()); ++timeSlotId) {
        if (assignment.assignedSongIds[timeSlotId] == EmptySongId && !fixedSlot[timeSlotId]) {
            timeSlotIds.push_back(timeSlotId);
        }
    }

    // 同じ難しさの枠の順番が固定されないよう、先に軽く混ぜる。
    shuffle(timeSlotIds.begin(), timeSlotIds.end(), randomEngine);
    stable_sort(timeSlotIds.begin(),
                timeSlotIds.end(),
                [&](int left, int right) {
                    return countCandidatesForSlot(scoreTable, remainingCounts, left) <
                           countCandidatesForSlot(scoreTable, remainingCounts, right);
                });

    return timeSlotIds;
}

int chooseSongForSlot(const ScoreTable& scoreTable,
                      const vector<int>& remainingCounts,
                      const Assignment& assignment,
                      const SchedulerConfig& config,
                      const vector<SongRuleConfig>& rules,
                      const vector<bool>& fixedSlot,
                      int timeSlotId,
                      mt19937& randomEngine) {
    int bestScore = ForbiddenScore;
    vector<int> candidateSongIds;
    const int mandatorySongId = mandatorySongForSlot(scoreTable,
                                                      assignment,
                                                      remainingCounts,
                                                      rules,
                                                      fixedSlot,
                                                      timeSlotId);
    if (mandatorySongId == -2) {
        return EmptySongId;
    }

    for (int songId = 0; songId < static_cast<int>(scoreTable.songs.size()); ++songId) {
        if (remainingCounts[songId] <= 0) {
            continue;
        }
        if (mandatorySongId != EmptySongId && songId != mandatorySongId) {
            continue;
        }

        const int baseScore = scoreTable.slotSongScores[timeSlotId][songId];
        if (baseScore == ForbiddenScore) {
            continue;
        }

        // 同日制限で絶対不可になる曲は、初期案にも入れない。
        Assignment trialAssignment = assignment;
        trialAssignment.assignedSongIds[timeSlotId] = songId;
        if (calculateDayConstraintScore(scoreTable, trialAssignment, config).hasHardViolation) {
            continue;
        }

        // 初期案でも、◯/△だけでなくコメント由来の希望点を見る。
        const int score = baseScore * BaseScoreWeight +
                          requestBonusForSlotSong(config, timeSlotId, songId);
        if (candidateSongIds.empty() || score > bestScore) {
            bestScore = score;
            candidateSongIds.clear();
            candidateSongIds.push_back(songId);
        } else if (score == bestScore) {
            candidateSongIds.push_back(songId);
        }
    }

    if (candidateSongIds.empty()) {
        return EmptySongId;
    }

    uniform_int_distribution<int> distribution(0,
                                               static_cast<int>(candidateSongIds.size()) - 1);
    return candidateSongIds[distribution(randomEngine)];
}

void validateAllTargetsSatisfied(const vector<int>& remainingCounts) {
    for (int songId = 0; songId < static_cast<int>(remainingCounts.size()); ++songId) {
        if (remainingCounts[songId] != 0) {
            throw runtime_error("初期割り当てで targetCounts を満たせません。曲ID: " +
                                to_string(songId));
        }
    }
}

}  // namespace

Assignment createInitialAssignment(const ScoreTable& scoreTable,
                                   const vector<int>& targetCounts,
                                   const SchedulerConfig& config) {
    validateScoreTableShape(scoreTable);
    validateTargetCounts(scoreTable, targetCounts);

    Assignment assignment;
    assignment.assignedSongIds.assign(scoreTable.timeSlots.size(), EmptySongId);

    vector<int> remainingCounts = targetCounts;
    mt19937 randomEngine(static_cast<unsigned int>(config.randomSeed));
    const vector<SongRuleConfig> rules = createSongRules(scoreTable, config);
    const vector<bool> fixedSlot = createFixedSlotFlags(scoreTable, config);

    placeFixedAssignments(scoreTable, config, assignment, remainingCounts);
    if (calculateDayConstraintScore(scoreTable, assignment, config).hasHardViolation) {
        throw runtime_error("確定要求が同日制限の絶対不可に違反しています。");
    }

    const vector<int> timeSlotIds = createSlotOrder(scoreTable,
                                                   assignment,
                                                   remainingCounts,
                                                   config,
                                                   randomEngine);
    for (int timeSlotId : timeSlotIds) {
        const int songId = chooseSongForSlot(scoreTable,
                                            remainingCounts,
                                            assignment,
                                            config,
                                            rules,
                                            fixedSlot,
                                            timeSlotId,
                                            randomEngine);
        if (songId == EmptySongId) {
            continue;
        }

        assignment.assignedSongIds[timeSlotId] = songId;
        --remainingCounts[songId];
    }

    validateAllTargetsSatisfied(remainingCounts);
    return assignment;
}

}  // namespace scheduler
