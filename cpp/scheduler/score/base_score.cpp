#include "base_score.hpp"

#include <limits>
#include <stdexcept>
#include <string>

using namespace std;

namespace scheduler {
namespace {

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

void validateAssignmentSize(const ScoreTable& scoreTable, const Assignment& assignment) {
    if (assignment.assignedSongIds.size() != scoreTable.timeSlots.size()) {
        throw runtime_error("割り当て数と時間枠数が一致しません。");
    }
}

int scoreForSlot(const ScoreTable& scoreTable, int timeSlotId, int songId) {
    if (songId == EmptySongId) {
        return EmptySlotScore;
    }

    if (songId < 0 || songId >= static_cast<int>(scoreTable.songs.size())) {
        throw runtime_error("存在しない曲IDが割り当てられています。");
    }

    return scoreTable.slotSongScores[timeSlotId][songId];
}

}  // namespace

int calculateBaseScore(const ScoreTable& scoreTable, const Assignment& assignment) {
    validateScoreTableShape(scoreTable);
    validateAssignmentSize(scoreTable, assignment);

    long long totalScore = 0;
    for (int timeSlotId = 0; timeSlotId < static_cast<int>(assignment.assignedSongIds.size());
         ++timeSlotId) {
        const int songId = assignment.assignedSongIds[timeSlotId];
        totalScore += scoreForSlot(scoreTable, timeSlotId, songId);
    }

    if (totalScore < numeric_limits<int>::min() || totalScore > numeric_limits<int>::max()) {
        throw runtime_error("基本スコアがintの範囲を超えました。");
    }

    return static_cast<int>(totalScore);
}

}  // namespace scheduler
