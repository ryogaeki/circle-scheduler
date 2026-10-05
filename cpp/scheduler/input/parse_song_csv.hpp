#pragma once

#include <string>

#include "../types.hpp"

namespace scheduler {

// CSV文字列から、曲ごとの予定記号を読み取る。
SongCsvData parseSongCsvText(const std::string& csvText);

// CSVファイルを読み込み、parseSongCsvText と同じ形に変換する。
SongCsvData parseSongCsvFile(const std::string& filePath);

}  // namespace scheduler
