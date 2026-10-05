// C++版 types.hpp と対応する、予定調整エンジンの共通型。

export const EMPTY_SONG_ID = -1;
export const FORBIDDEN_SCORE = -100_000_000;
export const AVAILABLE_SCORE = 2;
export const MAYBE_SCORE = 1;
export const EMPTY_SLOT_SCORE = 0;

export type AvailabilityMark = "available" | "maybe" | "unavailable";
export type UnavailablePolicy = "forbidden" | "allowWithPenalty";
export type ConstraintPolicy = "forbidden" | "allowWithPenalty";
export type TimePreference = "none" | "preferEarly" | "preferLate";
export type CountRuleMode = "balance" | "fixedTarget";

// CSVの1行に対応する時間枠。
export type TimeSlot = {
  id: number;
  label: string;
  dateKey: string;
  dayIndex: number;
  indexInDay: number;
};

// CSVの列に対応する曲。
export type Song = {
  id: number;
  name: string;
};

// CSVを読み込んだ直後の、まだ点数化していないデータ。
export type SongCsvData = {
  timeSlots: TimeSlot[];
  songs: Song[];
  marks: AvailabilityMark[][];
};

// 時間枠ごと、曲ごとの基本点を持つ表。
export type ScoreTable = {
  timeSlots: TimeSlot[];
  songs: Song[];
  slotSongScores: number[][];
};

// 各時間枠に入れた曲ID。-1は空白を表す。
export type Assignment = {
  assignedSongIds: number[];
};

// 確定枠または希望枠として指定する割り当て要求。
export type AssignmentRequest = {
  timeSlotId: number;
  songId: number;
  priority: number;
  fixed: boolean;
};

// 曲ごとに変更できる回数・同日制限・偏り評価の設定。
export type SongRuleConfig = {
  songId: number;
  targetCount: number;
  minCount: number;
  maxCount: number;
  unavailablePolicy: UnavailablePolicy;
  unavailablePenalty: number;
  maxPerDay: number;
  maxPerDayPolicy: ConstraintPolicy;
  maxPerDayPenalty: number;
  sameDayConsecutivePolicy: ConstraintPolicy;
  sameDayConsecutivePenalty: number;
  sameDayNonConsecutivePolicy: ConstraintPolicy;
  sameDayNonConsecutivePenalty: number;
  daySpacingPenalty: number;
  timeBalancePenalty: number;
  timePreference: TimePreference;
  timePreferencePenalty: number;
};

// 探索と採点で共通して使う設定。
export type SchedulerConfig = {
  assignmentRequests: AssignmentRequest[];
  songRules: SongRuleConfig[];
  countRuleMode: CountRuleMode;
  balanceMaxDifference: number;
  candidateLimit: number;
  trialCount: number;
  randomSeed: number;
  annealingIterations: number;
  startTemperature: number;
  endTemperature: number;
  enableSongChangeNeighbor: boolean;
};

// 予定案全体を採点した結果。
export type ScoreResult = {
  totalScore: number;
  timeTieBreakScore: number;
  availabilityScore: number;
  dayConstraintPenalty: number;
  countBalancePenalty: number;
  daySpacingPenalty: number;
  timeBalancePenalty: number;
  timePreferencePenalty: number;
  assignmentRequestScore: number;
  hasHardViolation: boolean;
};

// 1曲が各項目から得た点数の内訳。
export type SongScoreBreakdown = {
  songId: number;
  assignedCount: number;
  primaryScore: number;
  timeTieBreakScore: number;
  availabilityScore: number;
  dayConstraintPenalty: number;
  daySpacingPenalty: number;
  timeBalancePenalty: number;
  timePreferencePenalty: number;
  assignmentRequestScore: number;
};

// UIから予定案を採点するときの入出力。
export type EvaluateRequest = {
  scoreTable: ScoreTable;
  assignment: Assignment;
  config: SchedulerConfig;
};

export type EvaluateResult = {
  score: ScoreResult;
  songScoreBreakdowns: SongScoreBreakdown[];
};

// swapを反映できない理由。
export type SwapViolationCode =
  | "sameTimeSlot"
  | "sameAssignment"
  | "firstSlotFixed"
  | "secondSlotFixed"
  | "hardConstraint";

// 交換前後の各点数の差。絶対条件はviolationCodesで扱う。
export type ScoreDifference = Omit<ScoreResult, "hasHardViolation">;

// 2つの時間枠を仮に交換して採点する入力。
export type PreviewSwapRequest = EvaluateRequest & {
  firstTimeSlotId: number;
  secondTimeSlotId: number;
};

// 元予定を変更せずに返す、swapの事前確認結果。
export type PreviewSwapResult = {
  allowed: boolean;
  violationCodes: SwapViolationCode[];
  assignment: Assignment;
  before: EvaluateResult;
  after: EvaluateResult;
  scoreDifference: ScoreDifference;
};

// 探索で見つけた表示用候補。
export type ScheduleCandidate = {
  id: number;
  assignment: Assignment;
  score: ScoreResult;
  songScoreBreakdowns: SongScoreBreakdown[];
};

export type SolverStatistics = {
  minimumBlankCount: number;
  attemptedTrialCount: number;
  successfulTrialCount: number;
  failedTrialCount: number;
  targetCountFailureCount: number;
  initialAssignmentFailureCount: number;
  annealingFailureCount: number;
};

export type SchedulerResult = {
  candidates: ScheduleCandidate[];
  statistics: SolverStatistics;
};

export type BalanceComparisonEntry = {
  maxDifference: number;
  solved: boolean;
  errorMessage: string;
  result: SchedulerResult;
};

export type BalanceComparisonResult = {
  entries: BalanceComparisonEntry[];
  selectedEntryIndex: number;
};

// Web Workerへ渡す、スコア表と探索設定。
export type SchedulerInput = {
  scoreTable: ScoreTable;
  config: SchedulerConfig;
};

// 曲数差の比較範囲まで含めた、Web版solverの入力。
export type SolveRequest = SchedulerInput & {
  minBalanceDifference: number;
  maxBalanceDifference: number;
};
