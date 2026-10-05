# solver の役割

`solver/`は、`ScoreTable`と設定から予定候補を作ります。

## solve_balance_comparison

`Balance`では、曲数の最大差を1〜5まで別々に探索します。

```text
差1、2、3、4、5でsolve_schedulerを実行
  -> 空白が最も少ない結果を優先
  -> 同じ空白数なら、曲数差が小さい結果を優先
```

差を広げても空白が減らなければ、より均等な結果を選びます。
各段階の最小空白数は探索で見つけた値であり、数学的な最適保証ではありません。

## find_min_blank_count

`Balance`の各段階で、空白0個から順に初期案を試します。
その空白数で1回でも初期案が作れたら採用し、全部失敗したら空白を増やします。

## create_target_counts

今回埋める枠数を、曲ごとの目標回数`targetCounts`へ配ります。

```text
Balance
  minCount、maxCount、確定回数、入れられる枠数を守る。
  CSV点と希望点を見て、上位候補からseedで配る。
  targetCountを指定した曲だけは、その回数に固定する。

FixedTarget
  全曲に指定したtargetCountをそのまま使う。
```

`targetCounts`は初期案を作るための出発点です。`Balance`では焼きなましの曲変更により、
指定していない曲の最終回数が変わることがあります。

## create_initial_assignment

`targetCounts`どおりの最初の予定案を作ります。

```text
1. 確定曲と強制空白を置く
2. 入れられる候補が少ない枠から見る
3. 現在の枠を逃すと必要回数に届かない曲を優先する
4. CSV点と希望点が高い曲を置く
5. 同点ならseedで選ぶ
```

将来の枠数を先読みしますが、完全な全組み合わせ探索ではありません。
複数曲が同じ枠を必要とする場合などは、実現可能でも失敗することがあります。

## neighbor

焼きなまし用に、少しだけ違う案を作ります。

```text
createSwapNeighbor
  2つの非固定枠を交換する。
  空白位置は変わるが、曲ごとの回数は変わらない。

createChangeSongNeighbor
  非固定・非空白の1枠を別の曲へ変える。
  空白数は変えない。
  minCount、maxCount、balanceMaxDifference、個別targetCountを守る。
```

曲変更は`enableSongChangeNeighbor`で切り替えます。
`FixedTarget`では曲数を変えないため使いません。

## annealing

初期案から近傍を繰り返し作り、合計点を改善します。
良い案は採用し、悪い案も温度に応じて確率的に採用します。
途中で見つけた最高点は別に保存します。

時間帯評価は通常点へ加えません。通常点が同じ案のときだけ、
`timeTieBreakScore`が高い案を優先します。

## candidate_store

焼きなまし後の候補を通常点、時間帯微小点の順に並べ、
重複を除いて`candidateLimit`件まで残します。
曲数差ごとに別の`SchedulerResult`へ保持されます。

## solve_scheduler

1つの`balanceMaxDifference`について、次をまとめて実行します。

```text
find_min_blank_count
  -> create_target_counts
  -> create_initial_assignment
  -> annealing
  -> candidate_store
```

`trialCount`はseedを変えて試す回数であり、完成候補数ではありません。
戻り値には、成功数と次の失敗段階も入ります。

```text
targetCountFailureCount
initialAssignmentFailureCount
annealingFailureCount
```

## 未実装

```text
初期案の完全なバックトラック探索
```
