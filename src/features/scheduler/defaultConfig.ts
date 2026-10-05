import type {
  SchedulerConfig,
  SongRuleConfig,
} from "./types";

// C++版SongRuleConfigと同じ初期値を作る。
export function createDefaultSongRule(songId: number): SongRuleConfig {
  return {
    songId,
    targetCount: -1,
    minCount: 0,
    maxCount: -1,
    unavailablePolicy: "forbidden",
    unavailablePenalty: -100,
    maxPerDay: 2,
    maxPerDayPolicy: "forbidden",
    maxPerDayPenalty: 3,
    sameDayConsecutivePolicy: "allowWithPenalty",
    sameDayConsecutivePenalty: 1,
    sameDayNonConsecutivePolicy: "forbidden",
    sameDayNonConsecutivePenalty: 0,
    daySpacingPenalty: 0,
    timeBalancePenalty: 0,
    timePreference: "none",
    timePreferencePenalty: 0,
  };
}

// C++版SchedulerConfigと同じ初期値を作る。
export function createDefaultSchedulerConfig(): SchedulerConfig {
  return {
    assignmentRequests: [],
    songRules: [],
    countRuleMode: "balance",
    balanceMaxDifference: 1,
    candidateLimit: 5,
    trialCount: 20,
    randomSeed: 1,
    annealingIterations: 20_000,
    startTemperature: 2,
    endTemperature: 0.01,
    enableSongChangeNeighbor: false,
  };
}
