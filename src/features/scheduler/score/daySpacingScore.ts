import {
  EMPTY_SONG_ID,
  type Assignment,
  type SchedulerConfig,
  type ScoreResult,
  type ScoreTable,
} from "../types";
import {
  countDays,
  createEmptyScoreResult,
  createSongRules,
  validateScoreInput,
} from "./scoreHelpers";

const DEVIATION_SCALE = 0.32;
const SINGLE_DAY_SEVERITY = 0.9;

// 理想的な等間隔配置と比べ、実際の日付位置がどれだけずれたかを返す。
function calculateSpacingSeverity(
  assignedDays: number[],
  dayCount: number,
): number {
  if (dayCount <= 1 || assignedDays.length <= 1) {
    return 0;
  }

  // 同日の重複は同日制限で評価するため、日付偏りでは1日として扱う。
  const uniqueDays = [...new Set(assignedDays)].sort(
    (left, right) => left - right,
  );
  if (uniqueDays.length === 1) {
    return SINGLE_DAY_SEVERITY;
  }

  const totalDeviation = uniqueDays.reduce((sum, dayIndex, index) => {
    const actualPosition = (dayIndex + 0.5) / dayCount;
    const idealPosition = (index + 0.5) / uniqueDays.length;
    return sum + Math.abs(actualPosition - idealPosition);
  }, 0);
  const averageDeviation = totalDeviation / uniqueDays.length;

  // 少ない練習日は長い空白を生みやすいため、2日の曲を最も強く評価する。
  const countSensitivity = Math.sqrt(
    2 / Math.max(2, uniqueDays.length),
  );
  const scaledDeviation = averageDeviation / DEVIATION_SCALE;

  // 指数曲線により、軽いずれは小さく、著しい偏りは滑らかに強くする。
  return (
    (1 - Math.exp(-(scaledDeviation * scaledDeviation))) * countSensitivity
  );
}

// 同じ曲が前半・後半や一部の日付だけに偏った場合の減点を計算する。
export function calculateDaySpacingScore(
  scoreTable: ScoreTable,
  assignment: Assignment,
  config: SchedulerConfig,
): ScoreResult {
  validateScoreInput(scoreTable, assignment);

  const songCount = scoreTable.songs.length;
  const dayIndexesBySong = Array.from({ length: songCount }, () => [] as number[]);
  const rules = createSongRules(scoreTable, config);

  assignment.assignedSongIds.forEach((songId, timeSlotId) => {
    if (songId === EMPTY_SONG_ID) {
      return;
    }
    if (songId < 0 || songId >= songCount) {
      throw new Error(`存在しない曲IDがあります。枠ID: ${timeSlotId}`);
    }
    dayIndexesBySong[songId].push(scoreTable.timeSlots[timeSlotId].dayIndex);
  });

  const result = createEmptyScoreResult();
  const dayCount = countDays(scoreTable);
  rules.forEach((rule, songId) => {
    const penaltyUnit = Math.max(0, rule.daySpacingPenalty);
    if (penaltyUnit === 0) {
      return;
    }

    const severity = calculateSpacingSeverity(
      dayIndexesBySong[songId],
      dayCount,
    );
    result.daySpacingPenalty -= penaltyUnit * severity;
  });

  result.totalScore = result.daySpacingPenalty;
  return result;
}
