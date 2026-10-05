#include "annealing.hpp"

#include <cmath>
#include <random>
#include <stdexcept>
#include <vector>

#include "../score/schedule_score.hpp"
#include "../score/song_score_breakdown.hpp"
#include "neighbor.hpp"

using namespace std;

namespace scheduler {
namespace {

bool isScoreBetter(const ScoreResult& left, const ScoreResult& right) {
    if (left.totalScore != right.totalScore) {
        return left.totalScore > right.totalScore;
    }
    return left.timeTieBreakScore > right.timeTieBreakScore;
}

double annealingScoreDifference(const ScoreResult& nextScore,
                                const ScoreResult& currentScore) {
    const int primaryDifference = nextScore.totalScore - currentScore.totalScore;
    if (primaryDifference != 0) {
        // 通常点に差があれば、時間帯の微小点は比較に使わない。
        return primaryDifference;
    }
    return nextScore.timeTieBreakScore - currentScore.timeTieBreakScore;
}

double temperatureAt(int iteration, const SchedulerConfig& config) {
    const int lastIteration = config.annealingIterations <= 1 ? 1 : config.annealingIterations - 1;
    const double progress = static_cast<double>(iteration) / lastIteration;
    return config.startTemperature +
           (config.endTemperature - config.startTemperature) * progress;
}

vector<bool> createFixedSlotFlags(const ScoreTable& scoreTable,
                                  const SchedulerConfig& config) {
    vector<bool> fixedSlot(scoreTable.timeSlots.size(), false);
    for (const AssignmentRequest& request : config.assignmentRequests) {
        if (!request.fixed) {
            continue;
        }
        if (request.timeSlotId < 0 ||
            request.timeSlotId >= static_cast<int>(scoreTable.timeSlots.size())) {
            throw runtime_error("存在しない時間枠IDの確定要求があります。");
        }
        fixedSlot[request.timeSlotId] = true;
    }
    return fixedSlot;
}

void repairBlankPlacement(const ScoreTable& scoreTable,
                          const SchedulerConfig& config,
                          Assignment& assignment,
                          ScoreResult& score) {
    const vector<bool> fixedSlot = createFixedSlotFlags(scoreTable, config);
    bool improved = true;

    while (improved) {
        improved = false;
        Assignment bestAssignment = assignment;
        ScoreResult bestScore = score;

        for (int blankSlotId = 0; blankSlotId < static_cast<int>(assignment.assignedSongIds.size()); ++blankSlotId) {
            if (fixedSlot[blankSlotId] || assignment.assignedSongIds[blankSlotId] != EmptySongId) {
                continue;
            }

            for (int filledSlotId = 0; filledSlotId < static_cast<int>(assignment.assignedSongIds.size()); ++filledSlotId) {
                const int songId = assignment.assignedSongIds[filledSlotId];
                if (fixedSlot[filledSlotId] || songId == EmptySongId) {
                    continue;
                }
                if (scoreTable.slotSongScores[blankSlotId][songId] == ForbiddenScore) {
                    continue;
                }

                Assignment trialAssignment = assignment;
                trialAssignment.assignedSongIds[blankSlotId] = songId;
                trialAssignment.assignedSongIds[filledSlotId] = EmptySongId;

                const ScoreResult trialScore = calculateScheduleScore(scoreTable,
                                                                      trialAssignment,
                                                                      config);
                if (trialScore.hasHardViolation) {
                    continue;
                }
                if (isScoreBetter(trialScore, bestScore)) {
                    bestAssignment = trialAssignment;
                    bestScore = trialScore;
                    improved = true;
                }
            }
        }

        if (improved) {
            assignment = bestAssignment;
            score = bestScore;
        }
    }
}

}  // namespace

ScheduleCandidate runAnnealing(const ScoreTable& scoreTable,
                               const Assignment& initialAssignment,
                               const SchedulerConfig& config) {
    Assignment currentAssignment = initialAssignment;
    ScoreResult currentScore = calculateScheduleScore(scoreTable,
                                                      currentAssignment,
                                                      config);
    if (currentScore.hasHardViolation) {
        throw runtime_error("初期案が絶対不可の同日制限に違反しています。");
    }

    Assignment bestAssignment = currentAssignment;
    ScoreResult bestScore = currentScore;

    mt19937 randomEngine(static_cast<unsigned int>(config.randomSeed));
    uniform_real_distribution<double> probability(0.0, 1.0);

    for (int iteration = 0; iteration < config.annealingIterations; ++iteration) {
        Assignment nextAssignment = createSwapNeighbor(scoreTable,
                                                       currentAssignment,
                                                       config,
                                                       randomEngine);
        ScoreResult nextScore = calculateScheduleScore(scoreTable,
                                                       nextAssignment,
                                                       config);

        // Balance では、たまに「曲Aを曲Bへ変える」近傍も試す。
        // swapより良いときだけ、この回の採用候補にする。
        if (config.countRuleMode == CountRuleMode::Balance &&
            config.enableSongChangeNeighbor &&
            probability(randomEngine) < 0.25) {
            const Assignment changedAssignment = createChangeSongNeighbor(scoreTable,
                                                                          currentAssignment,
                                                                          config,
                                                                          randomEngine);
            if (changedAssignment.assignedSongIds != currentAssignment.assignedSongIds) {
                const ScoreResult changedScore = calculateScheduleScore(scoreTable,
                                                                        changedAssignment,
                                                                        config);
                if (!changedScore.hasHardViolation &&
                    (nextScore.hasHardViolation || isScoreBetter(changedScore, nextScore))) {
                    nextAssignment = changedAssignment;
                    nextScore = changedScore;
                }
            }
        }

        if (nextScore.hasHardViolation) {
            continue;
        }

        const double scoreDiff = annealingScoreDifference(nextScore, currentScore);

        // 良くなる案は必ず採用し、悪くなる案も温度に応じてたまに採用する。
        const double temperature = temperatureAt(iteration, config);
        const bool accept = scoreDiff >= 0 ||
                            probability(randomEngine) < exp(scoreDiff / temperature);
        if (!accept) {
            continue;
        }

        currentAssignment = nextAssignment;
        currentScore = nextScore;
        if (isScoreBetter(currentScore, bestScore)) {
            bestAssignment = currentAssignment;
            bestScore = currentScore;
        }
    }

    // 焼きなまし後、空白がより良い枠を潰していないかを最後に直す。
    repairBlankPlacement(scoreTable, config, bestAssignment, bestScore);

    ScheduleCandidate candidate;
    candidate.id = 0;
    candidate.assignment = bestAssignment;
    candidate.score = bestScore;
    candidate.songScoreBreakdowns = calculateSongScoreBreakdowns(scoreTable,
                                                                 bestAssignment,
                                                                 config);
    return candidate;
}

}  // namespace scheduler
