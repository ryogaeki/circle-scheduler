#pragma once

#include "../types.hpp"

namespace scheduler {

// Assignment が選んだ曲の slotSongScores を足し合わせる。
int calculateBaseScore(const ScoreTable& scoreTable, const Assignment& assignment);

}  // namespace scheduler
