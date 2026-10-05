#pragma once

#include <string>
#include <vector>

namespace scheduler {

constexpr int EmptySongId = -1;
constexpr int ForbiddenScore = -100000000;
constexpr int AvailableScore = 2;
constexpr int MaybeScore = 1;
constexpr int EmptySlotScore = 0;

// 時間枠 （CSVの1行に対応する、練習できる時間枠）
struct TimeSlot {
    int id;
    std::string label;   // ex> 2/9（月）18:00〜
    std::string dateKey; // ex> 2/9（月）
    int dayIndex;        // 何日目
    int indexInDay;      // 何枠目
};

// 曲 （CSVの列に対応する、割り当て対象の曲）
struct Song {
    int id;
    std::string name;
};

// CSVセルに書かれた予定記号。まだ点数には変換しない。
enum class AvailabilityMark {
    Available,
    Maybe,
    Unavailable,
};

// ×/✕ を絶対不可にするか、最悪入れてよい低スコアにするか。
enum class UnavailablePolicy {
    Forbidden,
    AllowWithPenalty,
};

// 制約違反を絶対不可にするか、減点で許すか。
enum class ConstraintPolicy {
    Forbidden,
    AllowWithPenalty,
};

// 曲ごとCSVを読んだ直後のデータ。
struct SongCsvData {
    std::vector<TimeSlot> timeSlots;
    std::vector<Song> songs;
    // marks[timeSlotId][songId] で、その時間枠の曲ごとの予定記号を読む。
    std::vector<std::vector<AvailabilityMark>> marks;
};

// 最適化エンジンが受け取る「時間枠 x 曲」のスコア表。
struct ScoreTable {
    std::vector<TimeSlot> timeSlots;
    std::vector<Song> songs;
    std::vector<std::vector<int>> slotSongScores; // その時間枠にその曲を入れた点数
};

// 各時間枠に、どの曲を入れるかを表す予定案。
// EmptySongId の場合は、その時間枠を空白にする。
struct Assignment {
    std::vector<int> assignedSongIds; // その時間枠に入れる曲ID
};

// 特定の時間枠に特定の曲を入れたいという要求。
// priority が大きいほど強い希望として加点する。
// fixed が true の場合は確定枠として扱い、探索中に変更しない。
// songId が EmptySongId かつ fixed が true の場合は、その枠を強制空白にする。
struct AssignmentRequest {
    int timeSlotId;
    int songId;
    int priority;
    bool fixed;
};

// 曲を早い時間帯へ寄せるか、遅い時間帯へ寄せるか。
enum class TimePreference {
    None,
    PreferEarly,
    PreferLate,
};

// 曲数を均等に寄せるか、指定回数を必ず守るか。
enum class CountRuleMode {
    Balance,
    FixedTarget,
};

// 1曲ごとに変えられる、回数・同日制限・偏り評価の設定。
struct SongRuleConfig {
    int songId;

    // -1なら自動、0以上ならBalanceでもFixedTargetでもその回数に固定する。
    int targetCount = -1;
    int minCount = 0;
    int maxCount = -1; // -1 の場合は上限なし

    UnavailablePolicy unavailablePolicy = UnavailablePolicy::Forbidden;
    int unavailablePenalty = -100; // 最悪入れてよい場合の ×/✕ の点数

    int maxPerDay = 2; // 同じ日に同じ曲を入れてよい基本回数
    ConstraintPolicy maxPerDayPolicy = ConstraintPolicy::Forbidden;
    int maxPerDayPenalty = 3; // maxPerDay を超えても許す場合の超過1回ごとの減点

    // 同じ日に同じ曲を連続枠で入れた場合の扱いと減点。
    ConstraintPolicy sameDayConsecutivePolicy = ConstraintPolicy::AllowWithPenalty;
    int sameDayConsecutivePenalty = 1;
    // 同じ日に同じ曲を非連続枠で入れた場合の扱いと減点。
    ConstraintPolicy sameDayNonConsecutivePolicy = ConstraintPolicy::Forbidden;
    int sameDayNonConsecutivePenalty = 0;

    // 入る日付が前半や後半に偏った場合の通常点の減点。
    int daySpacingPenalty = 0;
    // 以下の時間帯評価は、通常点が同じ案の比較にだけ使う。
    // 平均時間帯が早い側、遅い側へ偏った場合の微小減点。
    int timeBalancePenalty = 0;
    TimePreference timePreference = TimePreference::None;
    // PreferEarly / PreferLate から外れた場合の微小減点。
    int timePreferencePenalty = 0;
};

// 探索やスコア計算で使う設定値。
struct SchedulerConfig {
    std::vector<AssignmentRequest> assignmentRequests;
    // 曲ごとの設定。基本的に songs と同じ数だけ用意する。
    std::vector<SongRuleConfig> songRules;

    CountRuleMode countRuleMode = CountRuleMode::Balance;
    int balanceMaxDifference = 1; // Balance で許す、曲ごとの回数の最大差
    int candidateLimit = 5; // 保存する候補数
    int trialCount = 20;    // seed を変えて試す回数
    int randomSeed = 1;     // ランダム処理を再現するための種
    int annealingIterations = 20000; // 近傍を試す回数
    double startTemperature = 2.0;   // 序盤の採用しやすさ
    double endTemperature = 0.01;    // 終盤の採用しやすさ
    // true の場合だけ、swapに加えて1枠の曲を別の曲へ変える近傍も試す。
    bool enableSongChangeNeighbor = false;
};

// 1つの予定案を採点した結果。
struct ScoreResult {
    // 時間帯の微小点を除いた通常点。まずこの値で案を比較する。
    int totalScore = 0;
    // 通常点が同じ場合だけ使う、時間帯評価の合計。
    int timeTieBreakScore = 0;
    int availabilityScore = 0;        // ○/◯/△/×/✕由来の基本スコア
    int dayConstraintPenalty = 0;     // 同日同曲制限などの減点
    int countBalancePenalty = 0;      // 曲ごとの回数バランスの減点
    int daySpacingPenalty = 0;        // 同じ曲の日付偏りに対する減点
    int timeBalancePenalty = 0;       // 同じ曲の時間帯偏りに対する減点
    int timePreferencePenalty = 0;    // 早め/遅め希望から外れた場合の減点
    int assignmentRequestScore = 0;   // 割り当て要求による加点または減点
    bool hasHardViolation = false;    // 確定枠違反など、無効扱いに近い違反
};

// 1曲が各採点項目から何点を得たかを表示するための内訳。
struct SongScoreBreakdown {
    int songId = -1;
    int assignedCount = 0;
    int primaryScore = 0;
    int timeTieBreakScore = 0;
    int availabilityScore = 0;
    int dayConstraintPenalty = 0;
    int daySpacingPenalty = 0;
    int timeBalancePenalty = 0;
    int timePreferencePenalty = 0;
    int assignmentRequestScore = 0;
};

// 探索で見つけた、表示・比較用の候補。
struct ScheduleCandidate {
    int id;
    Assignment assignment;
    ScoreResult score;
    std::vector<SongScoreBreakdown> songScoreBreakdowns;
};

// solveSchedulerを何回試し、何回予定案を作れたかを表す。
struct SolverStatistics {
    int minimumBlankCount = 0;
    int attemptedTrialCount = 0;
    int successfulTrialCount = 0;
    int failedTrialCount = 0;
    int targetCountFailureCount = 0;
    int initialAssignmentFailureCount = 0;
    int annealingFailureCount = 0;
};

// 候補一覧と、探索が十分に成功したか確認するための統計。
struct SchedulerResult {
    std::vector<ScheduleCandidate> candidates;
    SolverStatistics statistics;
};

// 1つのbalanceMaxDifferenceで探索した結果。
struct BalanceComparisonEntry {
    int maxDifference = 1;
    bool solved = false;
    std::string errorMessage;
    SchedulerResult result;
};

// 複数の曲数差を比較し、自動選択した段階も持つ。
struct BalanceComparisonResult {
    std::vector<BalanceComparisonEntry> entries;
    int selectedEntryIndex = -1;
};

}  // namespace scheduler
