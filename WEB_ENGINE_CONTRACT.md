# Web版エンジン入出力契約

この文書は、C++版からTypeScript版へ移植するときのデータ形式と関数境界を固定する。
画面はエンジン内部を直接触らず、ここに書いた関数を通して予定を計算・採点する。

## 基本ルール

```text
IDは0始まりのnumber
空白のsongIdは-1
配列の添字とIDを一致させる
列挙値はJSONで扱いやすい文字列にする
```

主な列挙値:

```ts
type AvailabilityMark = "available" | "maybe" | "unavailable";
type UnavailablePolicy = "forbidden" | "allowWithPenalty";
type ConstraintPolicy = "forbidden" | "allowWithPenalty";
type TimePreference = "none" | "preferEarly" | "preferLate";
type CountRuleMode = "balance" | "fixedTarget";
```

## 入力データ

```ts
type TimeSlot = {
  id: number;
  label: string;
  dateKey: string;
  dayIndex: number;
  indexInDay: number;
};

type Song = {
  id: number;
  name: string;
};

type AssignmentRequest = {
  timeSlotId: number;
  songId: number;
  priority: number;
  fixed: boolean;
};

type SongRuleConfig = {
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

type SchedulerConfig = {
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

type ScoreTable = {
  timeSlots: TimeSlot[];
  songs: Song[];
  slotSongScores: number[][];
};

type Assignment = {
  assignedSongIds: number[];
};

type SchedulerInput = {
  scoreTable: ScoreTable;
  config: SchedulerConfig;
};
```

`slotSongScores[timeSlotId][songId]`で、その枠へ曲を入れた基本点を読む。
`assignedSongIds[timeSlotId]`は曲ID、空白の場合は`-1`とする。

## CSV変換

```ts
type SongCsvData = {
  timeSlots: TimeSlot[];
  songs: Song[];
  marks: AvailabilityMark[][];
};

parseSongCsv(csvText: string): SongCsvData

buildScoreTableFromSongCsv(
  csvData: SongCsvData,
  config: SchedulerConfig,
): ScoreTable
```

ファイル選択や文字コード処理はUI側、CSV内容の解釈はエンジン側の責任とする。

## 予定の採点

```ts
type ScoreResult = {
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

type SongScoreBreakdown = {
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

type EvaluateRequest = {
  scoreTable: ScoreTable;
  assignment: Assignment;
  config: SchedulerConfig;
};

type EvaluateResult = {
  score: ScoreResult;
  songScoreBreakdowns: SongScoreBreakdown[];
};

evaluateAssignment(request: EvaluateRequest): EvaluateResult
```

C++版では`calculateScheduleScore`と`calculateSongScoreBreakdowns`が対応する。

採点の優先順:

```text
1. hasHardViolation=false
2. totalScoreが高い
3. totalScoreが同じならtimeTieBreakScoreが高い
```

`totalScore`には時間帯評価を含めない。
時間帯評価が、基本点や日付偏りの1点差を逆転してはいけない。

## 予定探索

```ts
type ScheduleCandidate = {
  id: number;
  assignment: Assignment;
  score: ScoreResult;
  songScoreBreakdowns: SongScoreBreakdown[];
};

type SolverStatistics = {
  minimumBlankCount: number;
  attemptedTrialCount: number;
  successfulTrialCount: number;
  failedTrialCount: number;
  targetCountFailureCount: number;
  initialAssignmentFailureCount: number;
  annealingFailureCount: number;
};

type SchedulerResult = {
  candidates: ScheduleCandidate[];
  statistics: SolverStatistics;
};

type BalanceComparisonEntry = {
  maxDifference: number;
  solved: boolean;
  errorMessage: string;
  result: SchedulerResult;
};

type BalanceComparisonResult = {
  entries: BalanceComparisonEntry[];
  selectedEntryIndex: number;
};

type SolveRequest = SchedulerInput & {
  minBalanceDifference: number;
  maxBalanceDifference: number;
};

solveScheduler(request: SolveRequest): Promise<BalanceComparisonResult>
```

`BalanceComparisonResult.entries`は曲数差ごとの結果を持つ。
各`entry.result.candidates`には、重複しない上位`candidateLimit`件を保持する。

自動選択の優先順:

```text
1. 空白数が少ない
2. 曲数差が小さい
3. 通常点が高い
4. 時間帯微小点が高い
```

探索はWeb Workerから呼び、UIを止めない。

## swapの事前確認

ドラッグ＆ドロップでは候補を直接書き換えず、仮の割り当てを採点する。

```ts
type PreviewSwapRequest = EvaluateRequest & {
  firstTimeSlotId: number;
  secondTimeSlotId: number;
};

type SwapViolationCode =
  | "sameTimeSlot"
  | "sameAssignment"
  | "firstSlotFixed"
  | "secondSlotFixed"
  | "hardConstraint";

type PreviewSwapResult = {
  allowed: boolean;
  violationCodes: SwapViolationCode[];
  assignment: Assignment;
  before: EvaluateResult;
  after: EvaluateResult;
  scoreDifference: ScoreDifference;
};

type ScoreDifference = Omit<ScoreResult, "hasHardViolation">;

previewSwap(request: PreviewSwapRequest): PreviewSwapResult
```

`violationCodes`は同じ枠、同じ曲、確定枠、絶対条件違反を区別する。
`previewSwap`は元の`Assignment`を変更せず、交換後のコピーだけを返す。

## 候補編集

探索結果の`ScheduleCandidate`は変更しない。
手動編集ではコピーした`draftAssignment`を使う。

```text
選択した候補
  -> draftAssignmentへコピー
  -> swapをプレビュー
  -> 問題なければdraftAssignmentだけ更新
```

これにより、自動生成した元候補と手動編集後をいつでも比較できる。

`draftAssignment`は`past / present / future`の履歴で管理する。
swapと元候補への復帰は履歴へ追加し、Undo・Redoしても元候補は変更しない。

## 設定ファイル

共通設定、曲別設定、割り当て要求、曲数差範囲をJSONで保存する。
曲と時間枠は数値IDではなく名前・ラベルで保存し、読み込み時に現在のCSVのIDへ変換する。
CSVに存在しない曲や時間枠を参照する設定は読み込まない。

## C++との一致確認

```bash
make test
```

TypeScript版でも同じ小さい入力を使い、最低限次を一致させる。

```text
totalScore
timeTieBreakScore
各スコア内訳
hasHardViolation
曲ごとのスコア内訳
候補の並び順
```

乱数を使う最終予定表そのものは、C++と完全一致しなくてもよい。

## 現在の移植状況

TypeScript版では、曲ごとCSV、採点、初期案、焼きなまし、候補保存、
曲数差比較まで移植済みである。Node.jsでは`npm run scheduler`で実CSVを処理できる。
ブラウザ側では`startSolverWorker`からsolverを別スレッドで開始できる。

React UIでは、CSVアップロード、Workerの開始・中止、進捗、曲数差ごとの候補表、
共通・曲別・割り当て設定、カレンダーでのswap編集まで実装済みである。
クリックとドラッグのどちらでも、点数差と絶対条件違反を確認してから反映する。
設定JSON、候補比較、手動編集のUndo・Redoも実装済みである。
