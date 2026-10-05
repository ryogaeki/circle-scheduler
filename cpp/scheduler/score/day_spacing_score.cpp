#include "day_spacing_score.hpp"

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
            throw runtime_error("存在しない曲IDの日付偏り設定があります。");
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

int ceilDivide(int value, int divisor) {
    if (divisor <= 0) {
        return value;
    }
    return (value + divisor - 1) / divisor;
}

vector<int> uniqueSortedDays(vector<int> dayIndexes) {
    sort(dayIndexes.begin(), dayIndexes.end());
    dayIndexes.erase(unique(dayIndexes.begin(), dayIndexes.end()), dayIndexes.end());
    return dayIndexes;
}

int calculateSpacingExcess(const vector<int>& uniqueDays,
                           int assignedCount,
                           int dayCount) {
    if (dayCount <= 1 || assignedCount <= 1) {
        return 0;
    }

    if (uniqueDays.size() <= 1) {
        // 複数回あるのに同じ日だけなら、かなり偏っていると見る。
        return max(1, dayCount / 2);
    }

    const int totalSpan = dayCount - 1;
    const int intervalCount = static_cast<int>(uniqueDays.size()) - 1;
    const int allowedGap = max(1, ceilDivide(totalSpan, intervalCount));
    const int allowedEdgeGap = max(1, ceilDivide(allowedGap, 2));

    int excess = 0;

    // 前半に全く入っていない、後半に全く入っていない、を軽く減点する。
    excess += max(0, uniqueDays.front() - allowedEdgeGap);
    excess += max(0, (dayCount - 1 - uniqueDays.back()) - allowedEdgeGap);

    // 途中で日付の間隔が空きすぎているところを減点する。
    for (int index = 1; index < static_cast<int>(uniqueDays.size()); ++index) {
        const int gap = uniqueDays[index] - uniqueDays[index - 1];
        excess += max(0, gap - allowedGap);
    }

    // 少しの偏りでは動かさず、ひどい偏りだけ弱く効かせる。
    if (excess <= 1) {
        return 0;
    }
    return (excess + 1) / 2;
}

}  // namespace

ScoreResult calculateDaySpacingScore(const ScoreTable& scoreTable,
                                     const Assignment& assignment,
                                     const SchedulerConfig& config) {
    if (assignment.assignedSongIds.size() != scoreTable.timeSlots.size()) {
        throw runtime_error("Assignment の枠数と timeSlots の数が一致しません。");
    }

    const int songCount = static_cast<int>(scoreTable.songs.size());
    const int dayCount = countDays(scoreTable);
    const vector<SongRuleConfig> rules = createSongRules(scoreTable, config);

    vector<vector<int>> dayIndexesBySong(songCount);
    vector<int> assignedCountBySong(songCount, 0);

    for (int timeSlotId = 0; timeSlotId < static_cast<int>(assignment.assignedSongIds.size()); ++timeSlotId) {
        const int songId = assignment.assignedSongIds[timeSlotId];
        if (songId == EmptySongId) {
            continue;
        }
        if (songId < 0 || songId >= songCount) {
            throw runtime_error("Assignment に存在しない曲IDがあります。枠ID: " +
                                to_string(timeSlotId));
        }

        ++assignedCountBySong[songId];
        dayIndexesBySong[songId].push_back(scoreTable.timeSlots[timeSlotId].dayIndex);
    }

    ScoreResult result;

    for (int songId = 0; songId < songCount; ++songId) {
        const int penaltyUnit = max(0, rules[songId].daySpacingPenalty);
        if (penaltyUnit == 0) {
            continue;
        }

        const vector<int> uniqueDays = uniqueSortedDays(dayIndexesBySong[songId]);
        const int excess = calculateSpacingExcess(uniqueDays,
                                                  assignedCountBySong[songId],
                                                  dayCount);
        result.daySpacingPenalty -= penaltyUnit * excess;
    }

    result.totalScore = result.daySpacingPenalty;
    return result;
}

}  // namespace scheduler
