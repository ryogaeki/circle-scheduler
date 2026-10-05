import type { SchedulerConfig, ScoreTable } from "../types";
import { createInitialAssignment } from "./createInitialAssignment";
import { createTargetCounts } from "./createTargetCounts";

function canCreateWithBlankCount(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  blankCount: number,
): boolean {
  const totalAssignedCount = scoreTable.timeSlots.length - blankCount;
  const trialCount = Math.max(1, config.trialCount);

  for (let trial = 0; trial < trialCount; trial += 1) {
    const trialConfig = {
      ...config,
      randomSeed: config.randomSeed + trial,
    };
    try {
      const targetCounts = createTargetCounts(
        scoreTable,
        trialConfig,
        totalAssignedCount,
      );
      createInitialAssignment(scoreTable, targetCounts, trialConfig);
      return true;
    } catch {
      // このseedだけ作れない場合があるため、次のseedを試す。
    }
  }
  return false;
}

// 均等条件を守る初期案が作れるまで、空白0個から順に試す。
export function findMinBlankCount(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
): number {
  if (config.countRuleMode === "fixedTarget") {
    throw new Error("findMinBlankCountはBalance用です。");
  }
  for (
    let blankCount = 0;
    blankCount <= scoreTable.timeSlots.length;
    blankCount += 1
  ) {
    if (canCreateWithBlankCount(scoreTable, config, blankCount)) {
      return blankCount;
    }
  }
  throw new Error("均等条件を守れる初期案を作れません。");
}
