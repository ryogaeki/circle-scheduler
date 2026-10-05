#include "time_score.hpp"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <string>
#include <vector>

using namespace std;

namespace scheduler {
namespace {

vector<SongRuleConfig> createSongRules(const ScoreTable& scoreTable,
                                       const SchedulerConfig& config) {
    vector<SongRuleConfig> rules(scoreTable.songs.size());
    for (int songId = 0; songId < static_cast<int>(rules.size()); ++songId) {
        rules[songId].songId = songId;
    }

    for (const SongRuleConfig& rule : config.songRules) {
        if (rule.songId < 0 || rule.songId >= static_cast<int>(rules.size())) {
            throw runtime_error("存在しない曲IDの時間帯設定があります。");
        }
        rules[rule.songId] = rule;
    }
    return rules;
}

vector<int> countSlotsByDay(const ScoreTable& scoreTable) {
    int dayCount = 0;
    for (const TimeSlot& timeSlot : scoreTable.timeSlots) {
        if (timeSlot.dayIndex < 0 || timeSlot.indexInDay < 0) {
            throw runtime_error("時間枠の日付番号または日内番号が負です。");
        }
        dayCount = max(dayCount, timeSlot.dayIndex + 1);
    }

    vector<int> slotCounts(dayCount, 0);
    for (const TimeSlot& timeSlot : scoreTable.timeSlots) {
        slotCounts[timeSlot.dayIndex] = max(slotCounts[timeSlot.dayIndex],
                                            timeSlot.indexInDay + 1);
    }
    return slotCounts;
}

double relativeTimePosition(const TimeSlot& timeSlot,
                            const vector<int>& slotCountsByDay) {
    const int slotCount = slotCountsByDay[timeSlot.dayIndex];
    if (slotCount <= 1) {
        return 0.5;
    }
    return static_cast<double>(timeSlot.indexInDay) / (slotCount - 1);
}

int penaltyFromRatio(int penaltyUnit, double ratio) {
    const double limitedRatio = clamp(ratio, 0.0, 1.0);
    return -static_cast<int>(lround(max(0, penaltyUnit) * limitedRatio));
}

}  // namespace

ScoreResult calculateTimeScore(const ScoreTable& scoreTable,
                               const Assignment& assignment,
                               const SchedulerConfig& config) {
    if (assignment.assignedSongIds.size() != scoreTable.timeSlots.size()) {
        throw runtime_error("Assignment の枠数と timeSlots の数が一致しません。");
    }

    const int songCount = static_cast<int>(scoreTable.songs.size());
    const vector<SongRuleConfig> rules = createSongRules(scoreTable, config);
    const vector<int> slotCountsByDay = countSlotsByDay(scoreTable);
    vector<double> positionSums(songCount, 0.0);
    vector<int> assignedCounts(songCount, 0);

    for (int timeSlotId = 0; timeSlotId < static_cast<int>(assignment.assignedSongIds.size()); ++timeSlotId) {
        const int songId = assignment.assignedSongIds[timeSlotId];
        if (songId == EmptySongId) {
            continue;
        }
        if (songId < 0 || songId >= songCount) {
            throw runtime_error("Assignment に存在しない曲IDがあります。枠ID: " +
                                to_string(timeSlotId));
        }

        positionSums[songId] += relativeTimePosition(scoreTable.timeSlots[timeSlotId],
                                                     slotCountsByDay);
        ++assignedCounts[songId];
    }

    ScoreResult result;
    for (int songId = 0; songId < songCount; ++songId) {
        if (assignedCounts[songId] == 0) {
            continue;
        }

        const SongRuleConfig& rule = rules[songId];
        const double averagePosition = positionSums[songId] / assignedCounts[songId];

        // 明示的な早め・遅め希望がない曲だけ、中央からの偏りを見る。
        if (assignedCounts[songId] >= 2 &&
            rule.timePreference == TimePreference::None) {
            const double balanceRatio = abs(averagePosition - 0.5) * 2.0;
            result.timeBalancePenalty += penaltyFromRatio(rule.timeBalancePenalty,
                                                          balanceRatio);
        }

        double preferenceRatio = 0.0;
        if (rule.timePreference == TimePreference::PreferEarly) {
            preferenceRatio = averagePosition;
        } else if (rule.timePreference == TimePreference::PreferLate) {
            preferenceRatio = 1.0 - averagePosition;
        }
        if (rule.timePreference != TimePreference::None) {
            result.timePreferencePenalty += penaltyFromRatio(rule.timePreferencePenalty,
                                                             preferenceRatio);
        }
    }

    result.timeTieBreakScore = result.timeBalancePenalty +
                               result.timePreferencePenalty;
    // 単体で呼んだ場合も結果を確認しやすいよう、微小点をtotalScoreにも入れる。
    result.totalScore = result.timeTieBreakScore;
    return result;
}

}  // namespace scheduler
