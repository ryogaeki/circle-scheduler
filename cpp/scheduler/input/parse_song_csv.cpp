#include "parse_song_csv.hpp"

#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace std;

namespace scheduler {
namespace {

using CsvRow = vector<string>;
using CsvRecords = vector<CsvRow>;

// 前後のASCII空白だけを落とす。日本語や予定記号はそのまま残す。
string trim(const string& text) {
    size_t begin = 0;
    while (begin < text.size() &&
           (text[begin] == ' ' || text[begin] == '\t' ||
            text[begin] == '\r' || text[begin] == '\n')) {
        ++begin;
    }

    size_t end = text.size();
    while (end > begin &&
           (text[end - 1] == ' ' || text[end - 1] == '\t' ||
            text[end - 1] == '\r' || text[end - 1] == '\n')) {
        --end;
    }

    return text.substr(begin, end - begin);
}

string removeUtf8Bom(const string& text) {
    const string bom = "\xEF\xBB\xBF";
    if (text.rfind(bom, 0) == 0) {
        return text.substr(bom.size());
    }
    return text;
}

// CSV全体を読む。クォート内のカンマ・改行・二重クォートに対応する。
CsvRecords parseCsvRecords(const string& csvText) {
    CsvRecords records;
    CsvRow currentRow;
    string currentCell;
    bool inQuotes = false;

    for (size_t index = 0; index < csvText.size(); ++index) {
        const char ch = csvText[index];

        if (inQuotes) {
            if (ch == '"' && index + 1 < csvText.size() && csvText[index + 1] == '"') {
                currentCell.push_back('"');
                ++index;
            } else if (ch == '"') {
                inQuotes = false;
            } else {
                currentCell.push_back(ch);
            }
            continue;
        }

        if (ch == '"') {
            inQuotes = true;
        } else if (ch == ',') {
            currentRow.push_back(trim(currentCell));
            currentCell.clear();
        } else if (ch == '\n') {
            currentRow.push_back(trim(currentCell));
            currentCell.clear();
            records.push_back(currentRow);
            currentRow.clear();
        } else if (ch != '\r') {
            currentCell.push_back(ch);
        }
    }

    if (inQuotes) {
        throw runtime_error("CSVのクォートが閉じられていません。");
    }

    if (!currentCell.empty() || !currentRow.empty()) {
        currentRow.push_back(trim(currentCell));
        records.push_back(currentRow);
    }

    return records;
}

bool isEmptyRow(const CsvRow& row) {
    for (const string& cell : row) {
        if (!trim(cell).empty()) {
            return false;
        }
    }
    return true;
}

bool isCommentRow(const CsvRow& row) {
    return !row.empty() && trim(row[0]) == "コメント";
}

bool isHeaderRow(const CsvRow& row) {
    if (row.empty()) {
        return false;
    }
    return removeUtf8Bom(trim(row[0])) == "日程";
}

int findHeaderRowIndex(const CsvRecords& records) {
    for (size_t rowIndex = 0; rowIndex < records.size(); ++rowIndex) {
        if (isHeaderRow(records[rowIndex])) {
            return static_cast<int>(rowIndex);
        }
    }
    throw runtime_error("CSV内に「日程」ヘッダーが見つかりません。");
}

AvailabilityMark parseMark(const string& rawMark) {
    const string mark = trim(rawMark);

    if (mark == "○" || mark == "◯") {
        return AvailabilityMark::Available;
    }
    if (mark == "△") {
        return AvailabilityMark::Maybe;
    }
    if (mark == "×" || mark == "✕") {
        return AvailabilityMark::Unavailable;
    }

    throw runtime_error("未対応の予定記号です: " + mark);
}

string extractDateKey(const string& label) {
    const string weekdayEnd = "）";
    const size_t weekdayEndPos = label.find(weekdayEnd);
    if (weekdayEndPos != string::npos) {
        return label.substr(0, weekdayEndPos + weekdayEnd.size());
    }

    const size_t spacePos = label.find(' ');
    if (spacePos != string::npos) {
        return label.substr(0, spacePos);
    }

    return label;
}

int findDayIndex(const vector<string>& dateKeys, const string& dateKey) {
    for (size_t index = 0; index < dateKeys.size(); ++index) {
        if (dateKeys[index] == dateKey) {
            return static_cast<int>(index);
        }
    }
    return -1;
}

vector<Song> readSongs(const CsvRow& headerRow) {
    vector<Song> songs;

    for (size_t column = 1; column < headerRow.size(); ++column) {
        const string songName = trim(headerRow[column]);
        if (songName.empty()) {
            throw runtime_error("曲名が空の列があります。");
        }
        songs.push_back(Song{static_cast<int>(songs.size()), songName});
    }

    if (songs.empty()) {
        throw runtime_error("曲名の列がありません。");
    }

    return songs;
}

void appendTimeSlotAndMarks(const CsvRow& row,
                            int rowIndex,
                            const vector<Song>& songs,
                            vector<string>& dateKeys,
                            vector<int>& slotCountsByDay,
                            SongCsvData& data) {
    const size_t expectedColumnCount = songs.size() + 1;
    if (row.size() != expectedColumnCount) {
        throw runtime_error("CSVの列数が曲数と合いません。レコード番号: " +
                            to_string(rowIndex + 1));
    }

    const string label = trim(row[0]);
    const string dateKey = extractDateKey(label);
    int dayIndex = findDayIndex(dateKeys, dateKey);

    if (dayIndex == -1) {
        dayIndex = static_cast<int>(dateKeys.size());
        dateKeys.push_back(dateKey);
        slotCountsByDay.push_back(0);
    }

    const int timeSlotId = static_cast<int>(data.timeSlots.size());
    const int indexInDay = slotCountsByDay[dayIndex];
    ++slotCountsByDay[dayIndex];

    data.timeSlots.push_back(TimeSlot{timeSlotId, label, dateKey, dayIndex, indexInDay});

    vector<AvailabilityMark> marks;
    for (size_t column = 1; column < row.size(); ++column) {
        marks.push_back(parseMark(row[column]));
    }
    data.marks.push_back(marks);
}

}  // namespace

SongCsvData parseSongCsvText(const string& csvText) {
    const CsvRecords records = parseCsvRecords(csvText);
    const int headerRowIndex = findHeaderRowIndex(records);

    SongCsvData data;
    data.songs = readSongs(records[headerRowIndex]);

    vector<string> dateKeys;
    vector<int> slotCountsByDay;

    for (size_t rowIndex = static_cast<size_t>(headerRowIndex + 1);
         rowIndex < records.size();
         ++rowIndex) {
        const CsvRow& row = records[rowIndex];
        if (isEmptyRow(row) || isCommentRow(row)) {
            continue;
        }

        appendTimeSlotAndMarks(row,
                               static_cast<int>(rowIndex),
                               data.songs,
                               dateKeys,
                               slotCountsByDay,
                               data);
    }

    return data;
}

SongCsvData parseSongCsvFile(const string& filePath) {
    ifstream input(filePath);
    if (!input) {
        throw runtime_error("CSVファイルを開けません: " + filePath);
    }

    ostringstream buffer;
    buffer << input.rdbuf();
    return parseSongCsvText(buffer.str());
}

}  // namespace scheduler
