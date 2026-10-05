#include "song_score_breakdown.hpp"

#include <algorithm>
#include <stdexcept>
#include <vector>

#include "assignment_request_score.hpp"
#include "base_score.hpp"
#include "day_constraint_score.hpp"
#include "day_spacing_score.hpp"
#include "time_score.hpp"

using namespace std;

namespace scheduler {

vector<SongScoreBreakdown> calculateSongScoreBreakdowns(
    const ScoreTable& scoreTable,
    const Assignment& assignment,
    const SchedulerConfig& config) {
    if (assignment.assignedSongIds.size() != scoreTable.timeSlots.size()) {
        throw runtime_error("Assignment の枠数と timeSlots の数が一致しません。");
    }

    // ID検証と確定枠違反の検出は、既存の採点関数に任せる。
    calculateAssignmentRequestScore(scoreTable, assignment, config);

    vector<SongScoreBreakdown> breakdowns(scoreTable.songs.size());
    for (int songId = 0; songId < static_cast<int>(scoreTable.songs.size()); ++songId) {
        Assignment songOnlyAssignment;
        songOnlyAssignment.assignedSongIds.assign(scoreTable.timeSlots.size(), EmptySongId);

        for (int timeSlotId = 0; timeSlotId < static_cast<int>(assignment.assignedSongIds.size()); ++timeSlotId) {
            if (assignment.assignedSongIds[timeSlotId] == songId) {
                songOnlyAssignment.assignedSongIds[timeSlotId] = songId;
                ++breakdowns[songId].assignedCount;
            }
        }

        const ScoreResult dayScore = calculateDayConstraintScore(scoreTable,
                                                                 songOnlyAssignment,
                                                                 config);
        const ScoreResult spacingScore = calculateDaySpacingScore(scoreTable,
                                                                  songOnlyAssignment,
                                                                  config);
        const ScoreResult timeScore = calculateTimeScore(scoreTable,
                                                         songOnlyAssignment,
                                                         config);

        SongScoreBreakdown& breakdown = breakdowns[songId];
        breakdown.songId = songId;
        breakdown.availabilityScore = calculateBaseScore(scoreTable,
                                                         songOnlyAssignment);
        breakdown.dayConstraintPenalty = dayScore.dayConstraintPenalty;
        breakdown.daySpacingPenalty = spacingScore.daySpacingPenalty;
        breakdown.timeBalancePenalty = timeScore.timeBalancePenalty;
        breakdown.timePreferencePenalty = timeScore.timePreferencePenalty;

        for (const AssignmentRequest& request : config.assignmentRequests) {
            if (!request.fixed && request.songId == songId &&
                assignment.assignedSongIds[request.timeSlotId] == songId) {
                breakdown.assignmentRequestScore += max(0, request.priority);
            }
        }

        breakdown.primaryScore = breakdown.availabilityScore +
                                 breakdown.dayConstraintPenalty +
                                 breakdown.daySpacingPenalty +
                                 breakdown.assignmentRequestScore;
        breakdown.timeTieBreakScore = breakdown.timeBalancePenalty +
                                       breakdown.timePreferencePenalty;
    }

    return breakdowns;
}

}  // namespace scheduler
