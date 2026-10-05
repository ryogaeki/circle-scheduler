#include "assignment_request_score.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>

using namespace std;

namespace scheduler {
namespace {

void validateRequestIds(const ScoreTable& scoreTable, const AssignmentRequest& request) {
    if (request.timeSlotId < 0 ||
        request.timeSlotId >= static_cast<int>(scoreTable.timeSlots.size())) {
        throw runtime_error("存在しない時間枠IDの割り当て要求があります。");
    }
    if (request.songId == EmptySongId) {
        if (!request.fixed) {
            throw runtime_error("空白の割り当て要求は fixed=true のときだけ使えます。");
        }
        return;
    }
    if (request.songId < 0 || request.songId >= static_cast<int>(scoreTable.songs.size())) {
        throw runtime_error("存在しない曲IDの割り当て要求があります。");
    }
}

}  // namespace

ScoreResult calculateAssignmentRequestScore(const ScoreTable& scoreTable,
                                            const Assignment& assignment,
                                            const SchedulerConfig& config) {
    if (assignment.assignedSongIds.size() != scoreTable.timeSlots.size()) {
        throw runtime_error("Assignment の枠数と timeSlots の数が一致しません。");
    }

    ScoreResult result;

    for (const AssignmentRequest& request : config.assignmentRequests) {
        validateRequestIds(scoreTable, request);

        const int assignedSongId = assignment.assignedSongIds[request.timeSlotId];
        if (request.fixed) {
            // 確定枠は点数ではなく、守れなければ無効扱いにする。
            if (assignedSongId != request.songId) {
                result.hasHardViolation = true;
            }
            continue;
        }

        // 希望枠は、合っていたら priority の分だけ加点する。
        if (assignedSongId == request.songId) {
            result.assignmentRequestScore += max(0, request.priority);
        }
    }

    result.totalScore = result.assignmentRequestScore;
    return result;
}

}  // namespace scheduler
