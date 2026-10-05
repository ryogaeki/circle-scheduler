#include "candidate_store.hpp"

#include <algorithm>
#include <vector>

using namespace std;

namespace scheduler {
namespace {

bool isCandidateBetter(const ScheduleCandidate& left,
                       const ScheduleCandidate& right) {
    if (left.score.totalScore != right.score.totalScore) {
        return left.score.totalScore > right.score.totalScore;
    }
    return left.score.timeTieBreakScore > right.score.timeTieBreakScore;
}

}  // namespace

void addCandidateSorted(vector<ScheduleCandidate>& candidates,
                        const ScheduleCandidate& candidate,
                        int limit) {
    if (limit <= 0) {
        return;
    }

    // 同じ表を複数seedで見つけても、上位候補を重複させない。
    const auto duplicate = find_if(candidates.begin(),
                                   candidates.end(),
                                   [&](const ScheduleCandidate& stored) {
                                       return stored.assignment.assignedSongIds ==
                                              candidate.assignment.assignedSongIds;
                                   });
    if (duplicate == candidates.end()) {
        candidates.push_back(candidate);
    } else if (isCandidateBetter(candidate, *duplicate)) {
        *duplicate = candidate;
    }

    sort(candidates.begin(),
         candidates.end(),
         [](const ScheduleCandidate& left, const ScheduleCandidate& right) {
             return isCandidateBetter(left, right);
         });

    if (static_cast<int>(candidates.size()) > limit) {
        candidates.resize(limit);
    }

    // 表示用の番号は、現在の順位に合わせて振り直す。
    for (int index = 0; index < static_cast<int>(candidates.size()); ++index) {
        candidates[index].id = index + 1;
    }
}

}  // namespace scheduler
