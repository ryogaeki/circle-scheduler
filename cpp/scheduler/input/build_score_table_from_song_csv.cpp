#include "build_score_table_from_song_csv.hpp"

#include <stdexcept>
#include <string>
#include <vector>

using namespace std;

namespace scheduler {
namespace {

SongRuleConfig defaultSongRule(int songId) {
    SongRuleConfig rule;
    rule.songId = songId;
    return rule;
}

SongRuleConfig findSongRule(int songId, const SchedulerConfig& config) {
    for (const SongRuleConfig& rule : config.songRules) {
        if (rule.songId == songId) {
            return rule;
        }
    }
    return defaultSongRule(songId);
}

int scoreFromMark(AvailabilityMark mark, const SongRuleConfig& rule) {
    switch (mark) {
        case AvailabilityMark::Available:
            return AvailableScore;
        case AvailabilityMark::Maybe:
            return MaybeScore;
        case AvailabilityMark::Unavailable:
            if (rule.unavailablePolicy == UnavailablePolicy::AllowWithPenalty) {
                return rule.unavailablePenalty;
            }
            return ForbiddenScore;
    }

    throw runtime_error("未対応の予定記号です。");
}

void validateSongCsvData(const SongCsvData& songCsvData) {
    if (songCsvData.timeSlots.size() != songCsvData.marks.size()) {
        throw runtime_error("時間枠数と予定記号の行数が一致しません。");
    }

    for (size_t rowIndex = 0; rowIndex < songCsvData.marks.size(); ++rowIndex) {
        if (songCsvData.marks[rowIndex].size() != songCsvData.songs.size()) {
            throw runtime_error("予定記号の列数と曲数が一致しません。行番号: " +
                                to_string(rowIndex + 1));
        }
    }
}

}  // namespace

ScoreTable buildScoreTableFromSongCsv(const SongCsvData& songCsvData,
                                      const SchedulerConfig& config) {
    validateSongCsvData(songCsvData);

    ScoreTable scoreTable;
    scoreTable.timeSlots = songCsvData.timeSlots;
    scoreTable.songs = songCsvData.songs;

    for (const vector<AvailabilityMark>& markRow : songCsvData.marks) {
        vector<int> scoreRow;
        for (size_t songId = 0; songId < markRow.size(); ++songId) {
            const SongRuleConfig rule = findSongRule(static_cast<int>(songId), config);
            scoreRow.push_back(scoreFromMark(markRow[songId], rule));
        }
        scoreTable.slotSongScores.push_back(scoreRow);
    }

    return scoreTable;
}

ScoreTable buildScoreTableFromSongCsv(const SongCsvData& songCsvData) {
    return buildScoreTableFromSongCsv(songCsvData, SchedulerConfig{});
}

}  // namespace scheduler
