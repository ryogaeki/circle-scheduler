import {
  EMPTY_SLOT_SCORE,
  EMPTY_SONG_ID,
  type Assignment,
  type ScoreTable,
} from "../types";
import { validateScoreInput } from "./scoreHelpers";

// ○・△・許可された×の点数を、割り当てられた全枠について合計する。
export function calculateBaseScore(
  scoreTable: ScoreTable,
  assignment: Assignment,
): number {
  validateScoreInput(scoreTable, assignment);

  return assignment.assignedSongIds.reduce((totalScore, songId, timeSlotId) => {
    if (songId === EMPTY_SONG_ID) {
      return totalScore + EMPTY_SLOT_SCORE;
    }
    if (songId < 0 || songId >= scoreTable.songs.length) {
      throw new Error("存在しない曲IDが割り当てられています。");
    }
    return totalScore + scoreTable.slotSongScores[timeSlotId][songId];
  }, 0);
}
