#pragma once

#include <random>

#include "../types.hpp"

namespace scheduler {

// 非固定の2枠を入れ替えて、焼きなまし用の近傍案を作る。
Assignment createSwapNeighbor(const ScoreTable& scoreTable,
                              const Assignment& assignment,
                              const SchedulerConfig& config,
                              std::mt19937& randomEngine);

// 非固定・非空白の1枠を、別の曲へ変える。空白数は変えない。
Assignment createChangeSongNeighbor(const ScoreTable& scoreTable,
                                    const Assignment& assignment,
                                    const SchedulerConfig& config,
                                    std::mt19937& randomEngine);

}  // namespace scheduler
