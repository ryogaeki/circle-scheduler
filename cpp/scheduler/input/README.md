# input の役割

`input/` は、CSVをC++で扱いやすい型に変換する場所です。
ここではスコア計算や焼きなまし法はしません。

```text
CSV -> TimeSlot / Song / AvailabilityMark
```

---

## parse_song_csv

`parse_song_csv.hpp / .cpp` は、曲ごとCSVを読みます。

```csv
日程,曲A,曲B,曲C
2/9（月）18:00〜,○,△,×
2/9（月）19:00〜,△,○,×
```

返す型は `SongCsvData` です。

```cpp
struct SongCsvData {
    std::vector<TimeSlot> timeSlots;
    std::vector<Song> songs;
    std::vector<std::vector<AvailabilityMark>> marks;
};
```

`marks[timeSlotId][songId]` で、その時間枠・曲の予定記号を読めます。
この時点では、`○ = 2` のような点数化はしません。

---

## build_score_table_from_song_csv

`build_score_table_from_song_csv.hpp / .cpp` は、`SongCsvData` を `ScoreTable` に変換します。

```text
Available   -> 2
Maybe       -> 1
Unavailable -> デフォルトでは絶対不可
```

曲ごとの設定で `AllowWithPenalty` にした場合だけ、`Unavailable` を `-100` などの低スコアにします。

CSVを読む処理とは分けてあります。

---

## 読み込みの流れ

```text
1. CSV全体をレコードに分解する
2. 「日程」で始まるヘッダー行を探す
3. 2列目以降を Song として読む
4. 各行を TimeSlot と marks に変換する
5. 空行と「コメント」行は読み飛ばす
```

`TimeSlot` には以下を入れます。

```text
label      = 1/7（水）18:00〜
dateKey    = 1/7（水）
dayIndex   = 何日目か
indexInDay = その日の何枠目か
```

---

## 対応しているCSVの癖

```text
表の前の説明文
クォート内のカンマ
クォート内の改行
二重クォート ""
UTF-8 BOM
末尾の コメント 行
```

予定記号は以下に変換します。

```text
○ / ◯ -> Available
△      -> Maybe
× / ✕ -> Unavailable
```

---

## やらないこと

```text
予定記号を点数にする
割り当てを作る
スコアを計算する
制約を判定する
焼きなまし法を実行する
```
