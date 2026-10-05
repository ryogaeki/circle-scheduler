import type {
  AvailabilityMark,
  Song,
  SongCsvData,
} from "../types";

type CsvRow = string[];

// C++版と同じく、前後のASCII空白だけを取り除く。
function trimAscii(text: string): string {
  return text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
}

// クォート内のカンマ・改行・二重クォートに対応してCSVを分解する。
function parseCsvRecords(csvText: string): CsvRow[] {
  const records: CsvRow[] = [];
  let currentRow: CsvRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    if (inQuotes) {
      if (character === '"' && csvText[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        currentCell += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      currentRow.push(trimAscii(currentCell));
      currentCell = "";
    } else if (character === "\n") {
      currentRow.push(trimAscii(currentCell));
      records.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else if (character !== "\r") {
      currentCell += character;
    }
  }

  if (inQuotes) {
    throw new Error("CSVのクォートが閉じられていません。");
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(trimAscii(currentCell));
    records.push(currentRow);
  }
  return records;
}

function parseMark(rawMark: string): AvailabilityMark {
  const mark = trimAscii(rawMark);
  if (mark === "○" || mark === "◯") {
    return "available";
  }
  if (mark === "△") {
    return "maybe";
  }
  if (mark === "×" || mark === "✕") {
    return "unavailable";
  }
  throw new Error(`未対応の予定記号です: ${mark}`);
}

function extractDateKey(label: string): string {
  const weekdayEndIndex = label.indexOf("）");
  if (weekdayEndIndex !== -1) {
    return label.slice(0, weekdayEndIndex + 1);
  }
  const spaceIndex = label.indexOf(" ");
  return spaceIndex === -1 ? label : label.slice(0, spaceIndex);
}

function readSongs(headerRow: CsvRow): Song[] {
  const songs = headerRow.slice(1).map((rawName, songId) => {
    const name = trimAscii(rawName);
    if (name.length === 0) {
      throw new Error("曲名が空の列があります。");
    }
    return { id: songId, name };
  });
  if (songs.length === 0) {
    throw new Error("曲名の列がありません。");
  }
  return songs;
}

// 調整さん形式の文字列を、まだ点数化していない曲別CSVデータへ変換する。
export function parseSongCsv(csvText: string): SongCsvData {
  const records = parseCsvRecords(csvText);
  const headerRowIndex = records.findIndex(
    (row) => row.length > 0 && trimAscii(row[0]).replace(/^\uFEFF/, "") === "日程",
  );
  if (headerRowIndex === -1) {
    throw new Error("CSV内に「日程」ヘッダーが見つかりません。");
  }

  // 人名列のCSVを曲ごとCSVとして読み込み、曲名に人名が並ぶ誤りを防ぐ。
  const descriptionText = records
    .slice(0, headerRowIndex)
    .flat()
    .join("\n");
  if (
    descriptionText.includes("名前はフルネーム") ||
    descriptionText.includes("活動に来れる日時")
  ) {
    throw new Error(
      "人ごとの予定CSVが選ばれています。列名が曲名になっている「各曲ごと」のCSVを選んでください。",
    );
  }

  const songs = readSongs(records[headerRowIndex]);
  const data: SongCsvData = { timeSlots: [], songs, marks: [] };
  const dateKeys: string[] = [];
  const slotCountsByDay: number[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < records.length; rowIndex += 1) {
    const row = records[rowIndex];
    const empty = row.every((cell) => trimAscii(cell).length === 0);
    if (empty || trimAscii(row[0]) === "コメント") {
      continue;
    }
    if (row.length !== songs.length + 1) {
      throw new Error(`CSVの列数が曲数と合いません。レコード番号: ${rowIndex + 1}`);
    }

    const label = trimAscii(row[0]);
    const dateKey = extractDateKey(label);
    let dayIndex = dateKeys.indexOf(dateKey);
    if (dayIndex === -1) {
      dayIndex = dateKeys.length;
      dateKeys.push(dateKey);
      slotCountsByDay.push(0);
    }

    const id = data.timeSlots.length;
    data.timeSlots.push({
      id,
      label,
      dateKey,
      dayIndex,
      indexInDay: slotCountsByDay[dayIndex],
    });
    slotCountsByDay[dayIndex] += 1;
    data.marks.push(row.slice(1).map(parseMark));
  }

  return data;
}
