#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

#include "scheduler/input/build_score_table_from_song_csv.hpp"
#include "scheduler/input/parse_song_csv.hpp"
#include "scheduler/solver/solve_balance_comparison.hpp"
#include "scheduler/solver/solve_scheduler.hpp"

namespace {

std::vector<int> countSongs(const scheduler::ScoreTable& scoreTable,
                            const scheduler::Assignment& assignment) {
    std::vector<int> counts(scoreTable.songs.size(), 0);

    for (int songId : assignment.assignedSongIds) {
        if (songId != scheduler::EmptySongId) {
            ++counts[songId];
        }
    }

    return counts;
}

int countBlankSlots(const scheduler::Assignment& assignment) {
    int blankCount = 0;
    for (int songId : assignment.assignedSongIds) {
        if (songId == scheduler::EmptySongId) {
            ++blankCount;
        }
    }
    return blankCount;
}

std::string markFromScore(int score) {
    if (score == scheduler::AvailableScore) {
        return "◯";
    }
    if (score == scheduler::MaybeScore) {
        return "△";
    }
    return "✖";
}

[[maybe_unused]] int findTimeSlotId(const scheduler::ScoreTable& scoreTable,
                                    const std::string& label) {
    for (const scheduler::TimeSlot& timeSlot : scoreTable.timeSlots) {
        if (timeSlot.label == label) {
            return timeSlot.id;
        }
    }
    throw std::runtime_error("時間枠が見つかりません: " + label);
}

[[maybe_unused]] int findSongId(const scheduler::ScoreTable& scoreTable,
                                const std::string& name) {
    for (const scheduler::Song& song : scoreTable.songs) {
        if (song.name == name) {
            return song.id;
        }
    }
    throw std::runtime_error("曲が見つかりません: " + name);
}

[[maybe_unused]] void addFixedRequest(const scheduler::ScoreTable& scoreTable,
                                      scheduler::SchedulerConfig& config,
                                      const std::string& timeSlotLabel,
                                      const std::string& songName) {
    scheduler::AssignmentRequest request;
    request.timeSlotId = findTimeSlotId(scoreTable, timeSlotLabel);
    request.songId = findSongId(scoreTable, songName);
    request.priority = 100;
    request.fixed = true;
    config.assignmentRequests.push_back(request);
}

[[maybe_unused]] void addFixedBlankRequest(const scheduler::ScoreTable& scoreTable,
                                           scheduler::SchedulerConfig& config,
                                           const std::string& timeSlotLabel) {
    scheduler::AssignmentRequest request;
    request.timeSlotId = findTimeSlotId(scoreTable, timeSlotLabel);
    request.songId = scheduler::EmptySongId;
    request.priority = 100;
    request.fixed = true;
    config.assignmentRequests.push_back(request);
}

[[maybe_unused]] void addPreferredRequest(const scheduler::ScoreTable& scoreTable,
                                          scheduler::SchedulerConfig& config,
                                          const std::string& timeSlotLabel,
                                          const std::string& songName,
                                          int priority) {
    scheduler::AssignmentRequest request;
    request.timeSlotId = findTimeSlotId(scoreTable, timeSlotLabel);
    request.songId = findSongId(scoreTable, songName);
    request.priority = priority;
    request.fixed = false;
    config.assignmentRequests.push_back(request);
}

[[maybe_unused]] void addPreferredDateRequest(const scheduler::ScoreTable& scoreTable,
                                          scheduler::SchedulerConfig& config,
                                          const std::string& dateKey,
                                          const std::string& songName,
                                          int priority) {
    const int songId = findSongId(scoreTable, songName);
    bool foundDate = false;

    for (const scheduler::TimeSlot& timeSlot : scoreTable.timeSlots) {
        if (timeSlot.dateKey != dateKey) {
            continue;
        }

        scheduler::AssignmentRequest request;
        request.timeSlotId = timeSlot.id;
        request.songId = songId;
        request.priority = priority;
        request.fixed = false;
        config.assignmentRequests.push_back(request);
        foundDate = true;
    }

    if (!foundDate) {
        throw std::runtime_error("日付が見つかりません: " + dateKey);
    }
}

[[maybe_unused]] void addPreferredAvailableRequests(const scheduler::ScoreTable& scoreTable,
                                                   scheduler::SchedulerConfig& config,
                                                   const std::string& songName,
                                                   int priority) {
    const int songId = findSongId(scoreTable, songName);

    for (const scheduler::TimeSlot& timeSlot : scoreTable.timeSlots) {
        // その曲が◯の枠なら、そこに入ったとき希望点を足す。
        if (scoreTable.slotSongScores[timeSlot.id][songId] != 2) {
            continue;
        }

        scheduler::AssignmentRequest request;
        request.timeSlotId = timeSlot.id;
        request.songId = songId;
        request.priority = priority;
        request.fixed = false;
        config.assignmentRequests.push_back(request);
    }
}

[[maybe_unused]] void addPreferredAvailableDateRequest(const scheduler::ScoreTable& scoreTable,
                                                       scheduler::SchedulerConfig& config,
                                                       const std::string& dateKey,
                                                       const std::string& songName,
                                                       int priority) {
    const int songId = findSongId(scoreTable, songName);
    bool foundDate = false;
    bool foundAvailableSlot = false;

    for (const scheduler::TimeSlot& timeSlot : scoreTable.timeSlots) {
        if (timeSlot.dateKey != dateKey) {
            continue;
        }
        foundDate = true;

        // 「その日の◯」という希望なので、△には希望点を付けない。
        if (scoreTable.slotSongScores[timeSlot.id][songId] != 2) {
            continue;
        }

        scheduler::AssignmentRequest request;
        request.timeSlotId = timeSlot.id;
        request.songId = songId;
        request.priority = priority;
        request.fixed = false;
        config.assignmentRequests.push_back(request);
        foundAvailableSlot = true;
    }

    if (!foundDate) {
        throw std::runtime_error("日付が見つかりません: " + dateKey);
    }
    if (!foundAvailableSlot) {
        throw std::runtime_error("その日付に◯枠がありません: " + dateKey + " " + songName);
    }
}

void printCandidateList(const scheduler::ScoreTable& scoreTable,
                        const scheduler::SchedulerConfig& config,
                        const scheduler::SchedulerResult& result) {
    const std::vector<scheduler::ScheduleCandidate>& candidates = result.candidates;
    std::cout << "settings: annealingIterations=" << config.annealingIterations
              << " balanceMaxDifference=" << config.balanceMaxDifference
              << " songChange=" << (config.enableSongChangeNeighbor ? "on" : "off")
              << "\n";
    std::cout << "trials: attempted=" << result.statistics.attemptedTrialCount
              << " successful=" << result.statistics.successfulTrialCount
              << " failed=" << result.statistics.failedTrialCount << "\n";
    std::cout << "failures: targetCounts=" << result.statistics.targetCountFailureCount
              << " initialAssignment=" << result.statistics.initialAssignmentFailureCount
              << " annealing=" << result.statistics.annealingFailureCount << "\n";
    std::cout << "candidates: " << candidates.size() << "\n";
    if (!candidates.empty()) {
        std::cout << "minimum blanks: " << result.statistics.minimumBlankCount << "\n";
    }

    for (const scheduler::ScheduleCandidate& candidate : candidates) {
        const std::vector<int> counts = countSongs(scoreTable, candidate.assignment);

        std::cout << "#" << candidate.id
                  << " total=" << candidate.score.totalScore
                  << " availability=" << candidate.score.availabilityScore
                  << " dayPenalty=" << candidate.score.dayConstraintPenalty
                  << " spacing=" << candidate.score.daySpacingPenalty
                  << " time=" << candidate.score.timeTieBreakScore
                  << " request=" << candidate.score.assignmentRequestScore
                  << " hard=" << (candidate.score.hasHardViolation ? "yes" : "no")
                  << " blanks=" << countBlankSlots(candidate.assignment)
                  << " counts=";
        for (int count : counts) {
            std::cout << " " << count;
        }
        std::cout << "\n";
    }
}

void printBestSongScoreBreakdowns(const scheduler::ScoreTable& scoreTable,
                                  const scheduler::SchedulerResult& result) {
    if (result.candidates.empty()) {
        return;
    }

    std::cout << "\nbest candidate song scores:\n";
    for (const scheduler::SongScoreBreakdown& score :
         result.candidates[0].songScoreBreakdowns) {
        std::cout << scoreTable.songs[score.songId].name
                  << ": count=" << score.assignedCount
                  << " primary=" << score.primaryScore
                  << " availability=" << score.availabilityScore
                  << " day=" << score.dayConstraintPenalty
                  << " spacing=" << score.daySpacingPenalty
                  << " request=" << score.assignmentRequestScore
                  << " timeBalance=" << score.timeBalancePenalty
                  << " timePreference=" << score.timePreferencePenalty
                  << "\n";
    }
}

void printBalanceComparison(const scheduler::ScoreTable& scoreTable,
                            const scheduler::BalanceComparisonResult& comparison) {
    std::cout << "\nbalance comparison:\n";
    for (int index = 0; index < static_cast<int>(comparison.entries.size()); ++index) {
        const scheduler::BalanceComparisonEntry& entry = comparison.entries[index];
        std::cout << "maxDifference=" << entry.maxDifference;
        if (!entry.solved) {
            std::cout << " result=unavailable\n";
            continue;
        }

        const scheduler::ScheduleCandidate& best = entry.result.candidates[0];
        const std::vector<int> counts = countSongs(scoreTable, best.assignment);
        int minCount = counts.empty() ? 0 : counts[0];
        int maxCount = minCount;
        for (int count : counts) {
            if (count < minCount) {
                minCount = count;
            }
            if (count > maxCount) {
                maxCount = count;
            }
        }

        std::cout << " blanks=" << entry.result.statistics.minimumBlankCount
                  << " successful=" << entry.result.statistics.successfulTrialCount
                  << "/" << entry.result.statistics.attemptedTrialCount
                  << " total=" << best.score.totalScore
                  << " time=" << best.score.timeTieBreakScore
                  << " counts=" << minCount << "-" << maxCount;
        if (index == comparison.selectedEntryIndex) {
            std::cout << " selected";
        }
        std::cout << "\n";
    }
}

void printFirstCandidateSchedule(const scheduler::ScoreTable& scoreTable,
                                 const std::vector<scheduler::ScheduleCandidate>& candidates) {
    if (candidates.empty()) {
        return;
    }

    std::cout << "\nbest schedule:\n";
    const scheduler::Assignment& assignment = candidates[0].assignment;
    for (int timeSlotId = 0; timeSlotId < static_cast<int>(scoreTable.timeSlots.size()); ++timeSlotId) {
        // 日付が変わったら空行を入れて、日ごとに見やすくする。
        if (timeSlotId > 0 &&
            scoreTable.timeSlots[timeSlotId].dateKey != scoreTable.timeSlots[timeSlotId - 1].dateKey) {
            std::cout << "\n";
        }

        const int songId = assignment.assignedSongIds[timeSlotId];
        std::cout << scoreTable.timeSlots[timeSlotId].label << " -> ";
        if (songId == scheduler::EmptySongId) {
            std::cout << "(blank)";
        } else {
            const int score = scoreTable.slotSongScores[timeSlotId][songId];
            std::cout << markFromScore(score) << " " << scoreTable.songs[songId].name;
        }
        std::cout << "\n";
    }
}

}  // namespace

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "使い方: ./scheduler CSVファイルのパス\n";
        return 1;
    }
    const std::string csvPath = argv[1];

    const scheduler::SongCsvData songCsvData = scheduler::parseSongCsvFile(csvPath);
    scheduler::SchedulerConfig config;
    // 各曲数差について、重複しない上位10案を保持する。
    config.candidateLimit = 10;
    const int minBalanceDifference = 1;
    const int maxBalanceDifference = 5;
    // 最大差1〜5を比較するため、各段階を200seedずつ試す。
    config.trialCount = 200;
    config.annealingIterations = 2000;
    // swapに加え、条件内で1枠の曲を別の曲へ変える近傍も試す。
    config.enableSongChangeNeighbor = true;

    // 基本は最低4回。コメントで「少なめでもOK」と読める曲だけ最低3回にする。
    for (int songId = 0; songId < static_cast<int>(songCsvData.songs.size()); ++songId) {
        scheduler::SongRuleConfig rule;
        rule.songId = songId;
        rule.minCount = 4;
        // 同じ曲の連続2枠は許すが、少し重めに減点する。
        rule.sameDayConsecutivePenalty = 5;
        // 日付が偏りすぎたら小さく減点する。ひどい偏りだけ少し動かすため1点。
        rule.daySpacingPenalty = 1;
        // 時間帯評価は通常点が同じ案の比較だけに使う。
        rule.timeBalancePenalty = 10;
        const std::string& songName = songCsvData.songs[songId].name;
        if (songName == "Pallet" || songName == "SAYONARA MAYBE") {
            rule.minCount = 3;
        }
        // 曲ごとの早め希望の例:
        // if (songName == "曲名") {
        //     rule.timePreference = scheduler::TimePreference::PreferEarly;
        //     rule.timePreferencePenalty = 10;
        // }
        // 遅め希望なら PreferEarly を PreferLate にする。
        // 1曲だけ回数固定したい場合は、曲名を見て rule.targetCount = 5; などとする。
        config.songRules.push_back(rule);
    }

    // ×の扱いを含む曲別設定を反映して、CSV記号を点数へ変換する。
    const scheduler::ScoreTable scoreTable =
        scheduler::buildScoreTableFromSongCsv(songCsvData, config);

    // 強制空白: その枠には何の曲も入れない。
    addFixedBlankRequest(scoreTable, config, "8/28（金）10:00〜");
    addFixedBlankRequest(scoreTable, config, "8/28（金）11:00〜");
    addFixedBlankRequest(scoreTable, config, "8/28（金）12:00〜");
    addFixedBlankRequest(scoreTable, config, "8/28（金）13:00〜");
    addFixedBlankRequest(scoreTable, config, "8/28（金）14:00〜");
    addFixedBlankRequest(scoreTable, config, "8/28（金）15:00〜");

    // コメントから拾った希望枠。数字が大きいほど強く優先する。
    addPreferredAvailableRequests(scoreTable, config, "ノーチラス", 18);
    addFixedRequest(scoreTable, config, "8/28（金）16:00〜", "一二三");
    addFixedRequest(scoreTable, config, "8/28（金）17:00〜", "ノーチラス");
    addPreferredAvailableDateRequest(scoreTable, config, "9/4（金）", "星空のディスタンス", 25);
    addPreferredAvailableDateRequest(scoreTable, config, "9/14（月）", "星空のディスタンス", 25);
    addFixedRequest(scoreTable, config, "9/9（水）17:00〜", "からくりピエロ");
    addFixedRequest(scoreTable, config, "9/11（金）17:00〜", "からくりピエロ");
    addPreferredAvailableDateRequest(scoreTable, config, "8/26（水）", "一二三", 25);
    addPreferredAvailableDateRequest(scoreTable, config, "8/28（金）", "一二三", 25);
    addPreferredAvailableDateRequest(scoreTable, config, "8/31（月）", "一二三", 25);
    addFixedRequest(scoreTable, config, "8/26（水）12:00〜", "III");
    addFixedRequest(scoreTable, config, "9/4（金）14:00〜", "III");
    addPreferredAvailableRequests(scoreTable, config, "革命でゅ", 12);
    addPreferredAvailableRequests(scoreTable, config, "4年", 70);
    addPreferredAvailableDateRequest(scoreTable, config, "9/7（月）", "5150", 25);
    addPreferredAvailableDateRequest(scoreTable, config, "9/9（水）", "5150", 25);
    addPreferredAvailableDateRequest(scoreTable, config, "9/11（金）", "5150", 25);
    addPreferredAvailableRequests(scoreTable, config, "SAYONARA MAYBE", 25);

    if (config.countRuleMode == scheduler::CountRuleMode::Balance) {
        const scheduler::BalanceComparisonResult comparison =
            scheduler::solveBalanceComparison(scoreTable,
                                               config,
                                               minBalanceDifference,
                                               maxBalanceDifference);
        printBalanceComparison(scoreTable, comparison);

        const scheduler::BalanceComparisonEntry& selected =
            comparison.entries[comparison.selectedEntryIndex];
        scheduler::SchedulerConfig selectedConfig = config;
        selectedConfig.balanceMaxDifference = selected.maxDifference;
        std::cout << "\nselected balance:\n";
        printCandidateList(scoreTable, selectedConfig, selected.result);
        printBestSongScoreBreakdowns(scoreTable, selected.result);
        printFirstCandidateSchedule(scoreTable, selected.result.candidates);
        return 0;
    }

    const scheduler::SchedulerResult result = scheduler::solveScheduler(scoreTable, config);
    printCandidateList(scoreTable, config, result);
    printBestSongScoreBreakdowns(scoreTable, result);
    printFirstCandidateSchedule(scoreTable, result.candidates);
    return 0;
}
