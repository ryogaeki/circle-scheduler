#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

#include "../scheduler/score/schedule_score.hpp"
#include "../scheduler/score/song_score_breakdown.hpp"
#include "../scheduler/solver/candidate_store.hpp"

using namespace std;

namespace {

void expect(bool condition, const string& message) {
    if (!condition) {
        throw runtime_error(message);
    }
}

void expectEqual(int actual, int expected, const string& label) {
    if (actual != expected) {
        throw runtime_error(label + ": expected=" + to_string(expected) +
                            " actual=" + to_string(actual));
    }
}

scheduler::ScoreTable createTwoDayScoreTable() {
    scheduler::ScoreTable table;
    table.songs = {{0, "曲A"}, {1, "曲B"}};

    for (int dayIndex = 0; dayIndex < 2; ++dayIndex) {
        for (int indexInDay = 0; indexInDay < 3; ++indexInDay) {
            const int timeSlotId = dayIndex * 3 + indexInDay;
            table.timeSlots.push_back({timeSlotId,
                                       "slot" + to_string(timeSlotId),
                                       "day" + to_string(dayIndex),
                                       dayIndex,
                                       indexInDay});
        }
    }

    table.slotSongScores = {
        {2, 1},
        {2, 2},
        {1, 2},
        {2, 1},
        {2, 2},
        {1, scheduler::ForbiddenScore},
    };
    return table;
}

scheduler::Assignment createBlankAssignment(int timeSlotCount) {
    scheduler::Assignment assignment;
    assignment.assignedSongIds.assign(timeSlotCount, scheduler::EmptySongId);
    return assignment;
}

scheduler::SongRuleConfig createRule(int songId) {
    scheduler::SongRuleConfig rule;
    rule.songId = songId;
    return rule;
}

void testCombinedScoreAndBreakdown() {
    const scheduler::ScoreTable table = createTwoDayScoreTable();
    scheduler::SchedulerConfig config;
    config.assignmentRequests.push_back({0, 0, 100, true});
    config.assignmentRequests.push_back({1, 1, 7, false});

    scheduler::Assignment assignment = createBlankAssignment(6);
    assignment.assignedSongIds[0] = 0;
    assignment.assignedSongIds[1] = 1;

    const scheduler::ScoreResult score =
        scheduler::calculateScheduleScore(table, assignment, config);
    expectEqual(score.availabilityScore, 4, "基本点");
    expectEqual(score.assignmentRequestScore, 7, "希望点");
    expectEqual(score.totalScore, 11, "通常点合計");
    expect(!score.hasHardViolation, "正しい確定枠が違反扱いになっています。");

    const vector<scheduler::SongScoreBreakdown> breakdowns =
        scheduler::calculateSongScoreBreakdowns(table, assignment, config);
    expectEqual(breakdowns[0].primaryScore, 2, "曲Aの内訳");
    expectEqual(breakdowns[1].primaryScore, 9, "曲Bの内訳");
    expectEqual(breakdowns[0].primaryScore + breakdowns[1].primaryScore,
                score.totalScore,
                "曲別内訳の合計");
}

void testFixedAndForbiddenViolations() {
    const scheduler::ScoreTable table = createTwoDayScoreTable();
    scheduler::SchedulerConfig fixedConfig;
    fixedConfig.assignmentRequests.push_back({0, 0, 100, true});

    scheduler::Assignment wrongFixed = createBlankAssignment(6);
    wrongFixed.assignedSongIds[0] = 1;
    expect(scheduler::calculateScheduleScore(table, wrongFixed, fixedConfig)
               .hasHardViolation,
           "確定枠違反を検出できませんでした。");

    scheduler::Assignment forbidden = createBlankAssignment(6);
    forbidden.assignedSongIds[5] = 1;
    expect(scheduler::calculateScheduleScore(table, forbidden, {})
               .hasHardViolation,
           "絶対不可の×枠を検出できませんでした。");
}

void testSameDayRules() {
    const scheduler::ScoreTable table = createTwoDayScoreTable();
    scheduler::SongRuleConfig rule = createRule(0);
    rule.sameDayConsecutivePenalty = 5;

    scheduler::SchedulerConfig config;
    config.songRules.push_back(rule);

    scheduler::Assignment consecutive = createBlankAssignment(6);
    consecutive.assignedSongIds[0] = 0;
    consecutive.assignedSongIds[1] = 0;
    const scheduler::ScoreResult consecutiveScore =
        scheduler::calculateScheduleScore(table, consecutive, config);
    expectEqual(consecutiveScore.dayConstraintPenalty, -5, "同日連続減点");
    expect(!consecutiveScore.hasHardViolation,
           "許可した同日連続が違反扱いになっています。");

    scheduler::Assignment nonConsecutive = createBlankAssignment(6);
    nonConsecutive.assignedSongIds[0] = 0;
    nonConsecutive.assignedSongIds[2] = 0;
    expect(scheduler::calculateScheduleScore(table, nonConsecutive, config)
               .hasHardViolation,
           "同日非連続の絶対不可を検出できませんでした。");
}

void testDaySpacingPenalty() {
    scheduler::ScoreTable table;
    table.songs = {{0, "曲A"}};
    for (int dayIndex = 0; dayIndex < 10; ++dayIndex) {
        table.timeSlots.push_back({dayIndex,
                                   "slot" + to_string(dayIndex),
                                   "day" + to_string(dayIndex),
                                   dayIndex,
                                   0});
        table.slotSongScores.push_back({scheduler::AvailableScore});
    }

    scheduler::SongRuleConfig rule = createRule(0);
    rule.daySpacingPenalty = 1;
    scheduler::SchedulerConfig config;
    config.songRules.push_back(rule);

    scheduler::Assignment assignment = createBlankAssignment(10);
    assignment.assignedSongIds[0] = 0;
    assignment.assignedSongIds[1] = 0;
    const scheduler::ScoreResult score =
        scheduler::calculateScheduleScore(table, assignment, config);
    expectEqual(score.daySpacingPenalty, -2, "日付偏り減点");
}

void testTimeScores() {
    const scheduler::ScoreTable table = createTwoDayScoreTable();
    scheduler::SongRuleConfig rule = createRule(0);
    rule.timeBalancePenalty = 10;
    scheduler::SchedulerConfig config;
    config.songRules.push_back(rule);

    scheduler::Assignment early = createBlankAssignment(6);
    early.assignedSongIds[0] = 0;
    early.assignedSongIds[3] = 0;
    const scheduler::ScoreResult earlyScore =
        scheduler::calculateScheduleScore(table, early, config);
    expectEqual(earlyScore.timeBalancePenalty, -10, "早い側への偏り");

    scheduler::Assignment mixed = createBlankAssignment(6);
    mixed.assignedSongIds[0] = 0;
    mixed.assignedSongIds[5] = 0;
    const scheduler::ScoreResult mixedScore =
        scheduler::calculateScheduleScore(table, mixed, config);
    expectEqual(mixedScore.timeBalancePenalty, 0, "早い枠と遅い枠の混在");
    expect(earlyScore.totalScore > mixedScore.totalScore,
           "時間帯微小点が通常点を逆転しています。");

    rule.timePreference = scheduler::TimePreference::PreferLate;
    rule.timePreferencePenalty = 10;
    config.songRules[0] = rule;
    const scheduler::ScoreResult preferredEarly =
        scheduler::calculateScheduleScore(table, early, config);

    scheduler::Assignment late = createBlankAssignment(6);
    late.assignedSongIds[2] = 0;
    late.assignedSongIds[5] = 0;
    const scheduler::ScoreResult preferredLate =
        scheduler::calculateScheduleScore(table, late, config);
    expectEqual(preferredEarly.timePreferencePenalty, -10, "遅め希望の早い配置");
    expectEqual(preferredLate.timePreferencePenalty, 0, "遅め希望の遅い配置");
    expectEqual(preferredLate.timeBalancePenalty, 0, "希望指定時の偏り評価停止");
}

scheduler::ScheduleCandidate createCandidate(int songId,
                                             int totalScore,
                                             int timeScore) {
    scheduler::ScheduleCandidate candidate;
    candidate.id = 0;
    candidate.assignment.assignedSongIds = {songId};
    candidate.score.totalScore = totalScore;
    candidate.score.timeTieBreakScore = timeScore;
    return candidate;
}

void testCandidateOrderingAndDeduplication() {
    vector<scheduler::ScheduleCandidate> candidates;
    scheduler::addCandidateSorted(candidates, createCandidate(0, 1, -100), 10);
    scheduler::addCandidateSorted(candidates, createCandidate(1, 0, 0), 10);
    scheduler::addCandidateSorted(candidates, createCandidate(2, 1, -10), 10);
    scheduler::addCandidateSorted(candidates, createCandidate(2, 1, -20), 10);

    expectEqual(static_cast<int>(candidates.size()), 3, "重複除去後の候補数");
    expectEqual(candidates[0].assignment.assignedSongIds[0], 2, "同点時の時間帯順");
    expectEqual(candidates[1].assignment.assignedSongIds[0], 0, "通常点優先順");
    expectEqual(candidates[2].assignment.assignedSongIds[0], 1, "低い通常点の順");
}

}  // namespace

int main() {
    const vector<pair<string, function<void()>>> tests = {
        {"combined score and breakdown", testCombinedScoreAndBreakdown},
        {"fixed and forbidden violations", testFixedAndForbiddenViolations},
        {"same-day rules", testSameDayRules},
        {"day spacing", testDaySpacingPenalty},
        {"time scores", testTimeScores},
        {"candidate ordering", testCandidateOrderingAndDeduplication},
    };

    int passedCount = 0;
    for (const auto& [name, test] : tests) {
        try {
            test();
            ++passedCount;
            cout << "[PASS] " << name << "\n";
        } catch (const exception& error) {
            cerr << "[FAIL] " << name << ": " << error.what() << "\n";
            return 1;
        }
    }

    cout << passedCount << " tests passed.\n";
    return 0;
}
