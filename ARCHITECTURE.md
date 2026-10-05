# ARCHITECTURE.md

# アーキテクチャ設計

## 1. 基本方針

このプロジェクトは、サークル予定調整Webアプリである。

最重要方針は以下。

```text
コードを開発者本人が理解できるように保つ
```

旧C++コードでは、CSV読み込み、スコア計算、制約処理、焼きなまし法、出力処理などが1つのファイルに集まり、コードが大きくなりすぎた。

新しい開発では、まず開発者が慣れている C++ でアルゴリズム部分を整理し、その後 TypeScript / Next.js に移植してWebアプリ化する。

つまり、このプロジェクトの開発方針は以下。

```text
C++で予定調整エンジンを整理・検証する
↓
同じ構造でTypeScriptに移植する
↓
Next.jsでWeb UIを作る
```

C++版はWebアプリ本体ではなく、予定調整アルゴリズムを理解しながら作るための検証用実装である。

---

## 2. 開発フェーズ

## Phase 1: C++アルゴリズム版

最初に、C++で予定調整エンジンを作る。

目的:

```text
焼きなまし法の流れを理解できる形で整理する
旧コードの意図を引き継ぐ
1ファイルに詰め込まず、処理を分割する
TypeScriptに移植しやすい構造にする
```

C++版で扱う範囲:

```text
曲ごとCSV読み込み
○/◯/△/×/✕のスコア化
日付・時間枠の管理
曲ごとの回数管理
割り当て要求（確定枠・希望枠）
同じ曲の同日制限
曲ごとの弱い偏り評価
初期解生成
近傍生成
焼きなまし法
上位候補保存
簡易出力
```

C++版でやらないこと:

```text
Web UI
カレンダー表示
クリック操作
ドラッグ操作
パラメータスライダー
データベース保存
ログイン機能
```

---

## Phase 2: TypeScript移植

C++版でアルゴリズムの形が見えたら、同じ構造でTypeScriptへ移植する。

重要:

```text
C++コードをそのまま直訳しない
巨大な関数を作らない
C++版の構造を参考にしつつ、TypeScriptらしい型で書く
```

TypeScript版では、Web UIから呼び出せる予定調整エンジンとして実装する。

---

## Phase 3: Next.js Web UI

TypeScript版の予定調整エンジンをNext.jsの画面から使えるようにする。

初期UIはシンプルでよい。

```text
CSVアップロード
パラメータ入力
計算開始
候補一覧
表形式の予定表示
スコア内訳表示
```

カレンダーはまず閲覧専用で作り、ドラッグ操作は後の段階で追加する。

---

## 3. 現在のディレクトリ構成

現在はC++版全体、TypeScript版solver、Web Worker、最小Web UIがある。

```text
circle-scheduler/
  SPEC.md
  ARCHITECTURE.md
  AGENTS.md

  legacy/
    burusa_yakinamasi.cpp
    burusa3.cpp

  cpp/
    main.cpp
    scheduler/
      types.hpp

      input/
        parse_song_csv.*
        build_score_table_from_song_csv.*

      score/
        base_score.*
        day_constraint_score.*
        day_spacing_score.*
        time_score.*
        assignment_request_score.*
        schedule_score.*
        song_score_breakdown.*

      solver/
        find_min_blank_count.*
        create_target_counts.*
        create_initial_assignment.*
        neighbor.*
        annealing.*
        candidate_store.*
        solve_balance_comparison.*
        solve_scheduler.*

  src/
    app/
      layout.tsx
      page.tsx
      globals.css

    features/
      scheduler/
        types.ts
        defaultConfig.ts
        config/
          assignmentRequests.ts
        edit/
          assignmentHistory.ts
          previewSwap.ts
        settings/
          schedulerSettingsFile.ts
        input/
          parseSongCsv.ts
          buildScoreTableFromSongCsv.ts
        score/
          baseScore.ts
          dayConstraintScore.ts
          daySpacingScore.ts
          timeScore.ts
          assignmentRequestScore.ts
          evaluateAssignment.ts
          evaluateAssignment.test.ts
        solver/
          createTargetCounts.ts
          createInitialAssignment.ts
          findMinBlankCount.ts
          neighbor.ts
          annealing.ts
          candidateStore.ts
          solveScheduler.ts
          solveBalanceComparison.ts
        worker/
          messages.ts
          handleSolverWorkerRequest.ts
          scheduler.worker.ts
          startSolverWorker.ts

        ui/
          createWebSchedulerInput.ts
          validateWebSchedulerInput.ts
          CsvUploadPanel.tsx
          SchedulerSettingsPanel.tsx
          CommonSettings.tsx
          SongRuleSettings.tsx
          AssignmentRequestSettings.tsx
          CandidateTable.tsx
          CandidateComparisonPanel.tsx
          ScheduleCalendar.tsx
          SwapPreviewPanel.tsx
          SchedulerWorkspace.tsx

    cli/
      runScheduler.ts
```

人ごとCSV、手動固定、予定表の出力はまだ作っていない。
`rules/`や`total_score.*`も現時点では存在せず、制約判定は各scoreファイルにある。

---

## 4. C++版とTypeScript版の対応

C++版とTypeScript版は、なるべく対応関係が分かるようにする。

例:

```text
C++                              TypeScript

types.hpp                        types.ts
parse_song_csv.cpp               parseSongCsv.ts
build_score_table_from_song_csv  buildScoreTableFromSongCsv.ts
day_constraint_score.cpp         dayConstraintScore.ts
day_spacing_score.cpp            daySpacingScore.ts
time_score.cpp                   timeScore.ts
song_score_breakdown.cpp         songScoreBreakdown.ts
neighbor.cpp                     neighbor.ts
annealing.cpp                    annealing.ts
candidate_store.cpp              candidateStore.ts
```

ただし、TypeScriptへ移植するときに、C++の書き方を完全にそのまま持ち込む必要はない。

大事なのは、以下の対応が追えること。

```text
このC++の処理は、TypeScriptではどこにあるか
このTypeScriptの処理は、C++ではどの考え方に対応するか
```

---

## 5. C++版の役割

C++版は、予定調整エンジンを理解するための検証用実装である。

C++版の入力:

```text
曲ごとCSV
設定値
割り当て要求（確定枠・希望枠）
```

C++版の出力:

```text
候補予定表
合計スコア
曲ごとの回数
日ごとの割り当て
簡易スコア内訳
```

C++版では、出力をなるべくJSONに近い形にしておくと、TypeScript移植時に考えやすい。

例:

```text
candidate 1
score: 1234
assignments:
  2/9 18:00 -> 曲A
  2/9 19:00 -> 曲B
```

---

## 6. TypeScript版の役割

TypeScript版は、Webアプリから呼び出す予定調整エンジンである。

役割:

```text
CSVをブラウザ上で読み込む
内部データに変換する
予定調整エンジンを実行する
候補をUIに渡す
```

TypeScript版では、React UIと探索ロジックを混ぜない。

---

## 7. 入力方式

このアプリでは、入力方式が2種類ある。

---

## 7.1 曲ごとCSV方式

最初に対応する方式。

```text
行: 時間枠
列: 曲
セル: ○ / ◯ / △ / × / ✕
```

この方式では、CSVを読み込むと直接

```text
時間枠 × 曲 のスコア表
```

を作れる。

調整さんCSVでは、表の前にタイトル行や説明文が入ることがある。
そのため、`parse_song_csv` は `日程` で始まる行をヘッダーとして探してから表を読む。

初期開発ではこの方式を優先する。

---

## 7.2 人ごとCSV方式

将来的に対応する方式。

```text
行: 時間枠
列: メンバー
セル: ○ / ◯ / △ / × / ✕
```

この方式では、別途、曲ごとのメンバー・役割・重みを設定して、

```text
時間枠 × 曲 のスコア表
```

に変換する。

この機能は、曲ごとCSV方式が動いてから追加する。

人ごとCSV方式でも、`parse_people_csv` は `日程` で始まる行をヘッダーとして探してから表を読む。

---

## 8. 最適化エンジンの共通入力

入力方式が違っても、最適化に入る前に必ず以下の形に変換する。

```text
ScoreTable = 時間枠 × 曲 のスコア表
```

最適化エンジンは、ScoreTableが曲ごとCSVから作られたのか、人ごとCSVから作られたのかを知らない。

この分離を守ることで、あとから人ごとCSV方式を追加しやすくする。

---

## 9. 主要な型の考え方

C++版では `types.hpp`、TypeScript版では `types.ts` に定義する。

主な型:

```text
TimeSlot
Song
ScoreTable
Assignment
AssignmentRequest
UnavailablePolicy
TimePreference
CountRuleMode
SongRuleConfig
SchedulerConfig
ScoreResult
SongScoreBreakdown
ScheduleCandidate
SolverStatistics
SchedulerResult
```

C++版の例:

```cpp
struct TimeSlot {
    int id;
    std::string label;
    std::string dateKey;
    int dayIndex;
    int indexInDay;
};

struct Song {
    int id;
    std::string name;
};

struct ScoreTable {
    std::vector<TimeSlot> timeSlots;
    std::vector<Song> songs;
    std::vector<std::vector<int>> slotSongScores;
};

struct Assignment {
    std::vector<int> assignedSongIds;
};

struct AssignmentRequest {
    int timeSlotId;
    int songId;
    int priority;
    bool fixed;
};

enum class TimePreference {
    None,
    PreferEarly,
    PreferLate,
};

enum class UnavailablePolicy {
    Forbidden,
    AllowWithPenalty,
};

enum class ConstraintPolicy {
    Forbidden,
    AllowWithPenalty,
};

enum class CountRuleMode {
    Balance,
    FixedTarget,
};

struct SongRuleConfig {
    int songId;
    int targetCount;
    int minCount;
    int maxCount;
    UnavailablePolicy unavailablePolicy;
    int unavailablePenalty;
    int maxPerDay;
    ConstraintPolicy maxPerDayPolicy;
    int maxPerDayPenalty;
    ConstraintPolicy sameDayConsecutivePolicy;
    int sameDayConsecutivePenalty;
    ConstraintPolicy sameDayNonConsecutivePolicy;
    int sameDayNonConsecutivePenalty;
    int daySpacingPenalty;
    int timeBalancePenalty;
    TimePreference timePreference;
    int timePreferencePenalty;
};

struct SchedulerConfig {
    std::vector<AssignmentRequest> assignmentRequests;
    std::vector<SongRuleConfig> songRules;
    CountRuleMode countRuleMode;
    int balanceMaxDifference;
    int candidateLimit;
    int trialCount;
    int randomSeed;
    int annealingIterations;
    double startTemperature;
    double endTemperature;
    bool enableSongChangeNeighbor;
};
```

TypeScript版の例:

```ts
export type TimeSlot = {
  id: number;
  label: string;
  dateKey: string;
  dayIndex: number;
  indexInDay: number;
};

export type Song = {
  id: number;
  name: string;
};

export type ScoreTable = {
  timeSlots: TimeSlot[];
  songs: Song[];
  slotSongScores: number[][];
};

export type Assignment = {
  assignedSongIds: number[];
};

export type AssignmentRequest = {
  timeSlotId: number;
  songId: number;
  priority: number;
  fixed: boolean;
};

export type TimePreference = "none" | "preferEarly" | "preferLate";
export type UnavailablePolicy = "forbidden" | "allowWithPenalty";
export type ConstraintPolicy = "forbidden" | "allowWithPenalty";
export type CountRuleMode = "balance" | "fixedTarget";

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
```

---

## 10. スコア計算

初期実装では旧コードに近いスコアを使う。

```text
○ = 2
◯ = 2
△ = 1
× / ✕ = デフォルトでは絶対不可
```

曲ごとに `unavailablePolicy` を持つ。
`Forbidden` の場合、その曲はその枠に入れない。
`AllowWithPenalty` の場合、初期値 `-100` の低スコアとして扱う。

スコア計算は `score/` に置く。

`score/` では、与えられた割り当てを評価するだけにする。
探索やCSV読み込みはしない。

主なスコア:

```text
基本スコア
同日制限スコア
日付間隔スコア
時間帯バランススコア
時間帯希望スコア
割り当て要求スコア
```

曲数バランスは、`score/`ではなく`solver/create_target_counts`と
`solver/neighbor`の条件判定で扱う。
swapでは曲数は変わらないが、曲変更近傍では`minCount`、`maxCount`、
`balanceMaxDifference`を守る範囲で曲数が変わる。

日付間隔は通常点の弱い減点として扱う。
時間帯バランスと時間帯希望は通常点から分離し、通常点が同じ案の比較にだけ使う。

---

## 11. ルール判定

現在は独立した`rules/`を作らず、同日制限は`day_constraint_score`、
確定・希望枠は`assignment_request_score`で判定する。
同じ判定は初期案や近傍生成でも、絶対不可の案を作らないために参照する。

---

## 12. 探索アルゴリズム

探索処理は `solver/` に置く。

最初は焼きなまし法を使う。

主な処理:

```text
createTargetCounts
  曲ごとの目標回数を決める。
  Balance では seed によって多めになる曲を変える。

findMinBlankCount
  Balance で、均等条件を守れる最小空白数を探す。

createInitialAssignment
  難しい枠から貪欲に初期解を作る

neighbor
  近傍解を作る

annealing
  焼きなまし法本体

candidateStore
  焼きなまし後の重複しない上位候補をスコア順に保存する

solveScheduler
  全処理をまとめ、候補と試行成功・失敗数を返す

solveBalanceComparison
  Balanceの曲数差1〜5を別々に探索し、空白が最少になる最小の差を選ぶ
```

各曲数差の`SchedulerResult`は、それぞれ`candidateLimit`件まで候補を保持する。
通常点が同じ候補だけ、時間帯の微小点で順位を決める。
`ScheduleCandidate`はWeb版の詳細表示用に曲別点数内訳も持つ。

Balance では、回数パターンを1つだけに固定しない。
曲数差1〜5を別々に試し、各段階で最小空白数を探す。
空白を除いた枠数で複数の targetCounts を作り、それぞれ初期解を作って焼きなましする。
空白数を最優先し、同じ空白数なら曲数差が小さい段階を選ぶ。
一部の曲だけtargetCountを指定した場合は、その曲数を固定したまま残りを自動で決める。
FixedTarget では、指定された targetCount をそのまま使い、回数パターンはランダム化しない。
候補として保存するのは、初期解ではなく焼きなまし後の結果である。

焼きなまし法ではswap近傍を中心にし、設定がONなら曲変更近傍も試す。

```text
固定されていない2つの時間枠を選ぶ
割り当て曲を入れ替える
必要なら1枠の曲を別の曲へ変える
スコアを計算する
採用判定する
```

曲変更は空白数を変えず、曲数条件を守る。
一方、曲数決定は曲同士の枠競合を完全には解かず、初期案も貪欲法なので、
実現不能な回数パターンや、実現可能でも途中で詰まるパターンがある。
試行回数だけでなく、初期案作成の成功数を確認する必要がある。

```text
例:
Balance: 3 3 3 4 3 4 3 ... で焼きなまし
Balance: 3 3 4 3 3 3 4 ... で焼きなまし
FixedTarget: 指定された回数で焼きなまし
焼きなまし後のスコア順で候補を持つ
```

---

## 13. UI

UIは `src/features/scheduler/ui/` に置く。

初期UIはシンプルでよい。

```text
CsvUploadPanel
ScheduleTable
CandidateList
ScoreBreakdown
ParameterPanel
```

現在はCSV、各種設定、候補表、カレンダー、swapの事前採点と手動反映、
それらをまとめる`SchedulerWorkspace`まで実装済み。

UIコンポーネントは、探索ロジックを直接持たない。

悪い例:

```text
ScheduleTable.tsx の中で焼きなまし法を実行する
```

良い例:

```text
ScheduleTable.tsx は candidates を受け取って表示するだけ
```

---

## 14. データの流れ

曲ごとCSV方式の最終的な流れ:

```text
CSVファイル
↓
parseSongCsv
↓
timeSlots, songs, marks
↓
buildScoreTableFromSongCsv
↓
ScoreTable
↓
findMinBlankCount
↓
createTargetCounts
↓
createInitialAssignment
↓
annealing
↓
SchedulerResult（候補 + 試行統計）
↓
CandidateList / ScheduleTable / ScoreBreakdown
```

人ごとCSV方式の将来的な流れ:

```text
CSVファイル
↓
parsePeopleCsv
↓
timeSlots, members, memberAvailability
↓
曲メンバー・役割・重み設定
↓
buildScoreTableFromPeopleCsv
↓
ScoreTable
↓
以降は曲ごとCSV方式と同じ
```

---

## 15. 実装状況

C++版の基本経路から最小Web UIまで実装済み。

```text
完了: C++版の採点・探索
完了: TypeScript版への移植と自動テスト
完了: Web Workerからsolverを実行
完了: CSVアップロードと候補表だけのWeb UI
完了: 曲数差・候補の選択と閲覧用カレンダー
完了: 共通設定・曲別設定画面
完了: 確定枠・希望枠・強制空白の入力
完了: swapプレビューとカレンダーの手動入れ替え
完了: 設定JSONの保存・読み込み
完了: 候補同士の点数・曲数・配置比較
完了: 手動編集のUndo・Redo
次: 予定表の保存・出力、手動固定、細かい操作改善
```

---

## 16. 旧コードの扱い

旧コードは参考資料として扱う。

```text
legacy/burusa_yakinamasi.cpp
legacy/burusa3.cpp
```

役割:

```text
burusa_yakinamasi.cpp
  曲ごとCSVから予定表を作る旧実装

burusa3.cpp
  人ごとCSVから曲ごとのスコアを作る旧実装
```

新アプリでは旧コードをそのまま移植しない。

旧コードから引き継ぐ考え方:

```text
日付ごとの枠管理
○/◯/△/×/✕のスコア化
曲ごとの回数バランス
割り当て要求（確定枠・希望枠）
同じ曲の同日制限
焼きなまし法
上位候補保存
```

---

## 17. 避けたい設計

以下は避ける。

```text
C++で再び1000行1ファイルにする
TypeScriptに旧C++をそのまま直訳する
page.tsx に全部書く
annealing にCSV読み込みやUI処理を書く
UIコンポーネント内で探索ロジックを動かす
グローバル変数だらけにする
型をanyだらけにする
```

---
