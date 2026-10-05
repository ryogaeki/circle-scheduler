# score の役割

`score/` は、割り当て済みの予定案を点数にする場所です。
CSV読み込みや焼きなまし法はここでは行いません。

現在、焼きなましで使う合計点は次のとおりです。

```text
基本点 + 同日制限の減点 + 日付偏りの減点 + 希望枠の加点
```

時間帯評価はこの通常点へ加えません。通常点が同じ案のときだけ、
`timeTieBreakScore`として順位を決めます。

絶対不可の違反は大きなマイナス点ではなく、`hasHardViolation = true`にします。

---

## base_score

`base_score.hpp / .cpp` は、割り当ての基本スコアを計算します。

```cpp
int calculateBaseScore(
    const ScoreTable& scoreTable,
    const Assignment& assignment
);
```

やっていることは単純です。

```text
assignment.assignedSongIds[timeSlotId] で曲IDを読む
↓
scoreTable.slotSongScores[timeSlotId][songId] を足す
```

---

## 空白枠

`songId == EmptySongId` の場合、その時間枠は空白です。

```text
空白枠 = 0点
```

---

## day_constraint_score

`day_constraint_score.hpp / .cpp` は、同じ日に同じ曲が入りすぎていないかを見ます。

見ていること:

```text
同じ日に同じ曲が何回入っているか
連続した枠か、非連続の枠か
maxPerDay を超えていないか
```

同日制限は、`ConstraintPolicy` で以下のどちらかを選べます。

```text
Forbidden
  絶対不可扱い。hasHardViolation = true にする。
  solver 側でその予定案を候補から外す。
  点数の減点としては扱わない。

AllowWithPenalty
  減点で許す。設定された penalty の点数だけ減点する。
```

具体的な減点:

```text
同じ日に同じ曲が2回以上入り、すべて連続した枠に並んでいる
  -> sameDayConsecutivePolicy が Forbidden なら hard
  -> AllowWithPenalty なら sameDayConsecutivePenalty 点を減点

同じ日に同じ曲が2回以上入り、間が空いている
  -> sameDayNonConsecutivePolicy が Forbidden なら hard
  -> AllowWithPenalty なら sameDayNonConsecutivePenalty 点を減点

maxPerDay を超えた
  -> maxPerDayPolicy が Forbidden なら hard
  -> AllowWithPenalty なら、超過1回につき maxPerDayPenalty 点を減点
```

複数の `AllowWithPenalty` 条件に当てはまる場合、減点は合計します。
`Forbidden` 条件に当てはまる場合は、点数ではなく候補除外の対象になります。

例:

```text
sameDayConsecutivePenalty = 1
sameDayConsecutivePolicy = AllowWithPenalty
maxPerDay = 2
maxPerDayPolicy = Forbidden

同じ日に同じ曲が2回連続で入る
  -> -1 点
  -> maxPerDay は超えないので hard ではない
```

これは設定例です。現在の`cpp/main.cpp`では全曲に
`sameDayConsecutivePenalty = 5`を設定しているため、連続2枠は-5点です。

別の例:

```text
sameDayNonConsecutivePolicy = Forbidden
maxPerDay = 2

同じ日に同じ曲が2回、間を空けて入る
  -> 非連続が絶対不可なので減点はしない
  -> hasHardViolation = true
  -> solver では候補から外す
```

---

## day_spacing_score

`day_spacing_score.hpp / .cpp` は、同じ曲が日付方向に偏りすぎていないかを見ます。

見ていること:

```text
その曲が入っている日付だけを見る
前半に全くない、後半に全くない、途中の間隔が空きすぎている、を減点する
時間帯は見ない
```

減点:

```text
excess 1 につき daySpacingPenalty 点を減点
cpp/main.cpp では daySpacingPenalty = 1
```

つまり、少しの偏りではほぼ動かさず、かなりひどい偏りなら数点だけ動きます。
これは、◯が1〜2個△になる程度の弱い補正として使います。

---

## time_score

`time_score.hpp / .cpp`は、時間帯の偏りと早め・遅め希望を見ます。

```text
timeBalancePenalty
  曲が入った枠の平均位置を計算する。
  平均が1日の中央から早い側・遅い側へ寄るほど減点する。

timePreferencePenalty
  PreferEarlyなら遅いほど減点する。
  PreferLateなら早いほど減点する。
```

`PreferEarly`または`PreferLate`を指定した曲には、中央へ寄せる
`timeBalancePenalty`を同時適用しません。

1日の先頭を`0.0`、最後を`1.0`として、`indexInDay`を相対位置へ変換します。
現在のmainでは`timeBalancePenalty = 10`ですが、これは通常点の10点ではありません。
通常点が同じ場合だけ使う微小点なので、日付偏りの1点にも必ず負けます。

---

## song_score_breakdown

`song_score_breakdown.hpp / .cpp`は、最終候補の点数を曲ごとに分解します。

```text
基本点
同日減点
日付偏り
希望点
時間帯の偏り
早め・遅め希望
```

内訳は`ScheduleCandidate.songScoreBreakdowns`へ保存し、Web版でも表示に使えます。

---

## schedule_score

`schedule_score.hpp / .cpp`は、上記の採点をまとめて呼ぶ公開窓口です。

```cpp
ScoreResult calculateScheduleScore(
    const ScoreTable& scoreTable,
    const Assignment& assignment,
    const SchedulerConfig& config
);
```

焼きなましと、将来のWeb版の手動編集プレビューはこの同じ関数に対応させます。
×の絶対不可、確定枠、同日制限も`hasHardViolation`へまとめます。

---

## assignment_request_score

`assignment_request_score.hpp / .cpp` は、確定枠と希望枠を見ます。

```text
fixed = true
  その枠にその曲が入っていなければ hard violation にする。
  点数ではなく、予定案を無効扱いにする。

fixed = false
  その枠にその曲が入っていたら priority 点を加点する。
  入っていなくても hard にはしない。
```

`main.cpp` では、以下のように追加する。

```cpp
addFixedRequest(scoreTable, config, "8/26（水）12:00〜", "III");
addPreferredRequest(scoreTable, config, "9/11（金）17:00〜", "天体観測", 30);
addPreferredDateRequest(scoreTable, config, "8/26（水）", "III", 15);
```

希望点はCSVの○=2点、△=1点より大きくできるため、priorityを大きくすると
希望枠が合計点を強く支配します。複数の希望が同じ枠・曲に重なれば加算されます。

---

## チェックしていること

```text
ScoreTable の行数が timeSlots と合っているか
ScoreTable の列数が songs と合っているか
Assignment の数が timeSlots と合っているか
存在しない songId が入っていないか
```

---

## やらないこと

```text
CSVを読む
○/△/× を点数に変換する
曲数バランスを見る
焼きなまし法を実行する
```
