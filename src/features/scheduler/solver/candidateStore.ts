import type { ScheduleCandidate } from "../types";

function isCandidateBetter(
  left: ScheduleCandidate,
  right: ScheduleCandidate,
): boolean {
  if (left.score.totalScore !== right.score.totalScore) {
    return left.score.totalScore > right.score.totalScore;
  }
  return left.score.timeTieBreakScore > right.score.timeTieBreakScore;
}

function hasSameAssignment(
  left: ScheduleCandidate,
  right: ScheduleCandidate,
): boolean {
  if (
    left.assignment.assignedSongIds.length !==
    right.assignment.assignedSongIds.length
  ) {
    return false;
  }
  return left.assignment.assignedSongIds.every(
    (songId, index) => songId === right.assignment.assignedSongIds[index],
  );
}

// 重複を除き、通常点、時間帯微小点の順で上位候補を残す。
export function addCandidateSorted(
  candidates: ScheduleCandidate[],
  candidate: ScheduleCandidate,
  limit: number,
): void {
  if (limit <= 0) {
    return;
  }

  const duplicateIndex = candidates.findIndex((stored) =>
    hasSameAssignment(stored, candidate),
  );
  if (duplicateIndex === -1) {
    candidates.push(candidate);
  } else if (isCandidateBetter(candidate, candidates[duplicateIndex])) {
    candidates[duplicateIndex] = candidate;
  }

  candidates.sort((left, right) => {
    if (isCandidateBetter(left, right)) {
      return -1;
    }
    return isCandidateBetter(right, left) ? 1 : 0;
  });
  candidates.splice(limit);
  candidates.forEach((stored, index) => {
    stored.id = index + 1;
  });
}
