#include "day_constraint_score.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>
#include <vector>

using namespace std;

namespace scheduler {

namespace {

vector<SongRuleConfig> createSongRules(const ScoreTable& scoreTable,
                                       const SchedulerConfig& config) {
    vector<SongRuleConfig> rules(scoreTable.songs.size());

    for (int songId = 0; songId < static_cast<int>(scoreTable.songs.size()); ++songId) {
        rules[songId].songId = songId;
    }

    for (const SongRuleConfig& rule : config.songRules) {
        if (rule.songId < 0 || rule.songId >= static_cast<int>(scoreTable.songs.size())) {
            throw runtime_error("存在しない曲IDの同日制限設定があります。");
        }
        rules[rule.songId] = rule;
    }

    return rules;
}

int countDays(const ScoreTable& scoreTable) {
    int dayCount = 0;
    for (const TimeSlot& timeSlot : scoreTable.timeSlots) {
        dayCount = max(dayCount, timeSlot.dayIndex + 1);
    }
    return dayCount;
}

bool isConsecutiveBlock(vector<int> indexesInDay) {
    sort(indexesInDay.begin(), indexesInDay.end());

    for (int i = 1; i < static_cast<int>(indexesInDay.size()); ++i) {
        if (indexesInDay[i] != indexesInDay[i - 1] + 1) {
            return false;
        }
    }
    return true;
}

}  // namespace

ScoreResult calculateDayConstraintScore(const ScoreTable& scoreTable,
                                        const Assignment& assignment,
                                        const SchedulerConfig& config) {
    if (assignment.assignedSongIds.size() != scoreTable.timeSlots.size()) {
        throw runtime_error("Assignment の枠数と timeSlots の数が一致しません。");
    }

    const vector<SongRuleConfig> rules = createSongRules(scoreTable, config);
    const int dayCount = countDays(scoreTable);
    const int songCount = static_cast<int>(scoreTable.songs.size());

    // slotIndexesByDayAndSong[dayIndex][songId] に、その日の何枠目かを入れる。
    vector<vector<vector<int>>> slotIndexesByDayAndSong(dayCount,
                                                        vector<vector<int>>(songCount));
    for (int timeSlotId = 0; timeSlotId < static_cast<int>(assignment.assignedSongIds.size()); ++timeSlotId) {
        const int songId = assignment.assignedSongIds[timeSlotId];
        if (songId == EmptySongId) {
            continue;
        }
        if (songId < 0 || songId >= songCount) {
            throw runtime_error("Assignment に存在しない曲IDがあります。枠ID: " +
                                to_string(timeSlotId));
        }

        const TimeSlot& timeSlot = scoreTable.timeSlots[timeSlotId];
        slotIndexesByDayAndSong[timeSlot.dayIndex][songId].push_back(timeSlot.indexInDay);
    }

    ScoreResult result;

    for (int dayIndex = 0; dayIndex < dayCount; ++dayIndex) {
        for (int songId = 0; songId < songCount; ++songId) {
            const vector<int>& indexesInDay = slotIndexesByDayAndSong[dayIndex][songId];
            const int count = static_cast<int>(indexesInDay.size());
            if (count <= 1) {
                continue;
            }

            const SongRuleConfig& rule = rules[songId];
            const bool consecutive = isConsecutiveBlock(indexesInDay);

            if (consecutive) {
                if (rule.sameDayConsecutivePolicy == ConstraintPolicy::Forbidden) {
                    result.hasHardViolation = true;
                } else {
                    result.dayConstraintPenalty -= max(0, rule.sameDayConsecutivePenalty);
                }
            } else {
                if (rule.sameDayNonConsecutivePolicy == ConstraintPolicy::Forbidden) {
                    result.hasHardViolation = true;
                } else {
                    result.dayConstraintPenalty -= max(0, rule.sameDayNonConsecutivePenalty);
                }
            }

            if (rule.maxPerDay >= 0 && count > rule.maxPerDay) {
                const int extraCount = count - rule.maxPerDay;
                if (rule.maxPerDayPolicy == ConstraintPolicy::Forbidden) {
                    result.hasHardViolation = true;
                } else {
                    result.dayConstraintPenalty -= max(0, rule.maxPerDayPenalty) * extraCount;
                }
            }
        }
    }

    result.totalScore = result.dayConstraintPenalty;
    return result;
}

}  // namespace scheduler
