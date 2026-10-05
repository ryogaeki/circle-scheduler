#include "schedule_score.hpp"

#include <stdexcept>

#include "assignment_request_score.hpp"
#include "base_score.hpp"
#include "day_constraint_score.hpp"
#include "day_spacing_score.hpp"
#include "time_score.hpp"

using namespace std;

namespace scheduler {
namespace {

bool hasForbiddenAssignment(const ScoreTable& scoreTable,
                            const Assignment& assignment) {
    for (int timeSlotId = 0; timeSlotId < static_cast<int>(assignment.assignedSongIds.size()); ++timeSlotId) {
        const int songId = assignment.assignedSongIds[timeSlotId];
        if (songId != EmptySongId &&
            scoreTable.slotSongScores[timeSlotId][songId] == ForbiddenScore) {
            return true;
        }
    }
    return false;
}

}  // namespace

ScoreResult calculateScheduleScore(const ScoreTable& scoreTable,
                                   const Assignment& assignment,
                                   const SchedulerConfig& config) {
    // calculateBaseScoreで表の形、枠数、曲IDをまとめて検証する。
    ScoreResult result;
    result.availabilityScore = calculateBaseScore(scoreTable, assignment);

    const ScoreResult dayScore = calculateDayConstraintScore(scoreTable,
                                                             assignment,
                                                             config);
    const ScoreResult spacingScore = calculateDaySpacingScore(scoreTable,
                                                              assignment,
                                                              config);
    const ScoreResult timeScore = calculateTimeScore(scoreTable,
                                                     assignment,
                                                     config);
    const ScoreResult requestScore = calculateAssignmentRequestScore(scoreTable,
                                                                     assignment,
                                                                     config);

    result.dayConstraintPenalty = dayScore.dayConstraintPenalty;
    result.daySpacingPenalty = spacingScore.daySpacingPenalty;
    result.timeBalancePenalty = timeScore.timeBalancePenalty;
    result.timePreferencePenalty = timeScore.timePreferencePenalty;
    result.timeTieBreakScore = timeScore.timeTieBreakScore;
    result.assignmentRequestScore = requestScore.assignmentRequestScore;
    result.hasHardViolation = hasForbiddenAssignment(scoreTable, assignment) ||
                              dayScore.hasHardViolation ||
                              spacingScore.hasHardViolation ||
                              timeScore.hasHardViolation ||
                              requestScore.hasHardViolation;

    // 時間帯微小点は、通常点が同じ案の比較にだけ使うため加えない。
    result.totalScore = result.availabilityScore +
                        result.dayConstraintPenalty +
                        result.daySpacingPenalty +
                        result.assignmentRequestScore;
    return result;
}

}  // namespace scheduler
