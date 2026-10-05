# circle-scheduler

サークルの曲練習予定を、曲ごとの予定CSVから自動で作るプロジェクトです。
現在はC++版とTypeScript版のどちらでも、CSVから予定候補を作れます。
Web版では、CSVアップロード、設定保存、候補比較、カレンダー編集まで実装済みです。

## 実行

```bash
make run CSV=/path/to/song-schedule.csv
```

採点ルールの自動テスト:

```bash
make test
```

TypeScript版の型検査と採点テスト:

```bash
npm install
npm run typecheck
npm test
```

TypeScript版で実CSVから予定を作る:

```bash
npm run scheduler -- /path/to/song-schedule.csv
```

実際の予定CSVは個人情報を含む可能性があるため、リポジトリには保存しません。

通常は200seed・2000反復です。短い動作確認では次のように減らせます。

```bash
SCHEDULER_TRIALS=20 SCHEDULER_ITERATIONS=100 npm run scheduler
```

Web画面を起動する:

```bash
npm run dev
```

起動後に `http://localhost:3000` を開き、スタート画面で曲ごとCSVを選びます。
CSVの読み込み後は `/scheduler` の作業画面へ移動するので、設定を確認して
「候補を作成」を押します。左上のロゴからスタート画面へ戻れます。
計算はWeb Workerで行うため、計算中も画面操作を止めません。
列に人名が並ぶ人ごとCSVはまだ未対応で、選択した場合は読み込み時にエラーを表示します。

CSV、設定、候補、手動編集、Undo・Redo履歴はブラウザへ自動保存されます。
ページを再読み込みしたりブラウザを閉じたりしても、スタート画面の「作業を続ける」から
復元できます。ただし、計算途中の状態は保存せず、再度候補を作成します。

Web画面では曲数差の範囲を設定し、候補を選ぶと予定カレンダーを確認できます。
共通設定、曲別設定、確定枠、希望枠、強制空白も画面から入力できます。
作業画面はカレンダーを中央に固定し、共通・曲別・割当設定は右側のボタンから開きます。
日付または時間枠を選ぶと、同じ右側にクイック設定が表示されます。
候補一覧は左側のボタンから開き、中央・左・右はそれぞれ独立してスクロールします。
カレンダーの曲をクリックまたはドラッグすると、別枠との交換を事前確認できます。
交換前後の点数差と絶対条件違反を確認してから、編集用予定へ反映します。
探索で作った元候補は変更されず、Undo・Redo・「元候補に戻す」を利用できます。

候補一覧の比較アイコンを押すと、表示中候補との点数・曲数・配置差を確認できます。
設定画面の「設定保存」「設定読込」では、全設定をJSONファイルで再利用できます。

C++版のCSVや確定枠など、実行用の設定は `cpp/main.cpp` にあります。

## GitHub Pagesで公開

`main`ブランチへpushすると、GitHub Actionsが型検査・テスト・静的ビルドを行い、
成功したWeb画面をGitHub Pagesへ公開します。

初回だけ、GitHubのリポジトリ画面で次を設定します。

```text
Settings
  -> Pages
  -> Build and deployment
  -> Source: GitHub Actions
```

その後、`Actions`の`Deploy GitHub Pages`が完了すると、次のURLで利用できます。

```text
https://ryogaeki.github.io/circle-scheduler/
```

Web画面はNode.jsサーバーやデータベースを使わず、予定計算も含めてブラウザ内で動きます。
CSVや候補などの作業状態はブラウザの`localStorage`へ保存されるため、同じ端末・同じブラウザでは
再読み込み後も復元できます。ただし、別の端末や別のブラウザへ作業データは自動共有されません。

## Web画面の設定

```text
共通設定
  曲数の決め方、曲数差、候補数、試行回数、焼きなまし設定。

曲別設定
  回数、×の扱い、同日制限、日付間隔、時間帯設定。

確定・希望枠
  確定曲、希望点付きの曲、強制空白を時間枠ごとに設定。

設定保存・読込
  共通設定、曲別設定、割り当て要求をJSONで保存・復元。
```

設定を変更すると、変更前の候補は消えて再計算待ちになります。
回数固定を選んだ場合は、曲別設定で全曲の固定回数を指定します。

## 現在の処理順

```text
CSVを読み込む
  -> 曲ごとのルールを設定する
  -> ○/△/×をスコア表へ変換する
  -> 確定枠・希望枠・強制空白を設定する
  -> 曲数差1〜5について以下を実行する
       -> 作成できる最小空白数を探す
       -> 曲ごとの目標回数 targetCounts を作る
       -> 将来の配置可能数を確認しながら初期案を作る
       -> 焼きなましで配置を改善する
  -> 各曲数差を比較して候補を選ぶ
```

確定枠などの設定は、最小空白数を探す前に追加されます。
したがって、強制空白や確定曲、同日制限も考慮したうえで空白数を探します。

ただし、ここでいう「最小」は数学的に証明された最適値ではありません。
乱数seedを変えて初期案を試し、初めて作成に成功した空白数です。

## 点数と絶対条件

最終的な合計点は次の合計です。

```text
totalScore
  = availabilityScore
  + dayConstraintPenalty
  + daySpacingPenalty
  + assignmentRequestScore

timeTieBreakScore
  = timeBalancePenalty
  + timePreferencePenalty
```

まず`totalScore`を比較し、同点の場合だけ`timeTieBreakScore`を使います。
したがって時間帯設定が、○と△の1点差や日付偏りの1点差を逆転することはありません。

Web画面では時間帯の小ささをそのまま読めるよう、内部値1を0.001点として表示します。

```text
最終表示点 = totalScore + timeTieBreakScore × 0.001
```

たとえば`totalScore = 42`、`timeTieBreakScore = -17`なら`41.983点`と表示します。
これは表示用の単位です。候補の順位は従来どおり、`totalScore`を先に比較します。
画面右上のメニューにある「採点ルール・点数配分」から、各項目の説明を確認できます。

| 項目 | 現在の値 |
|---|---:|
| CSVの○・◯ | +2点 |
| CSVの△ | +1点 |
| 空白 | 0点 |
| CSVの×・✕ | デフォルトでは絶対不可 |
| 同じ曲を同じ日に連続で入れる | 現在のmainでは -5点 |
| 同じ曲を同じ日に非連続で入れる | 絶対不可 |
| 同じ曲を1日に3回以上入れる | 絶対不可 |
| 日付の偏り | 等間隔からのずれに応じた小数点の減点 |
| 時間帯の偏り | 通常点が同じ場合だけ使う微小減点 |
| 早め・遅め希望 | 通常点が同じ場合だけ使う微小減点 |
| 希望枠 | 入ったら指定したpriorityを加点 |
| 確定枠・強制空白 | 点数ではなく絶対条件 |

`hasHardViolation = true`になった予定案は、点数に関係なく候補から外します。

希望点は○の2点よりかなり大きくできます。たとえばpriorityが25なら、
その希望を1件満たすだけで+25点です。希望を強くしすぎると基本スコアより支配的になります。
同じ枠・同じ曲に希望を複数追加した場合は、priorityが合計されます。

日付偏りは、各曲の配置日を予定期間内の`0〜1`へ変換し、等間隔に置いた理想位置との差を見ます。
同じ日の重複は除外し、同日2枠目は同日制限だけで評価します。
練習日が少ないほど長い空白が生まれやすいため、2日の曲を3日以上の曲より強く評価します。
滑らかな非線形計算により、軽いずれは`-0.01`程度、10日間の中央で連続する2日は
約`-0.323`、最初の2日だけなら約`-0.790`になります。
全曲分を合計しますが、日付間隔の減点設定を`1`にした通常利用では、合計が基本点を
大きく支配しない強さです。
採点内部では小数を丸めず、Web画面だけ小数第3位まで表示します。

## 確定枠と希望枠の書き方

以下はすべて `cpp/main.cpp` の、`solveScheduler`を呼ぶ前に書きます。

```cpp
// この時間枠には必ずこの曲を入れる。
addFixedRequest(scoreTable, config, "9/9（水）17:00〜", "からくりピエロ");

// この時間枠は必ず空白にする。
addFixedBlankRequest(scoreTable, config, "8/28（金）10:00〜");

// この時間枠にこの曲が入ったら30点を加える。
addPreferredRequest(scoreTable, config,
                    "9/11（金）17:00〜", "天体観測", 30);

// 指定日の各時間枠に、この曲の希望点を付ける。
addPreferredDateRequest(scoreTable, config, "8/26（水）", "III", 15);

// この曲が○になっている全時間枠に希望点を付ける。
addPreferredAvailableRequests(scoreTable, config, "ノーチラス", 18);

// 指定日のうち、この曲が○になっている枠だけに希望点を付ける。
addPreferredAvailableDateRequest(scoreTable, config,
                                 "9/4（金）", "星空のディスタンス", 25);
```

`fixed`ではpriorityの値を採点に使いません。守らなければ無効です。
希望枠は守れなくても無効にはならず、入ったときだけ加点します。

## 曲数の決め方

`CountRuleMode::Balance`では、次を守りながら曲数を自動で決めます。

```text
各曲のminCount / maxCount
確定済みの回数
その曲を入れられる枠数
balanceMaxDifference
CSVの○/△と希望点
```

完全ランダムではありません。次に1回増やす曲を、入れやすさと希望点から評価し、
上位候補の中からseedで選びます。現在の内部評価は概ね次の形です。

```text
候補枠の評価 = CSV点 × 10 + 希望点
曲を増やす評価 = 候補枠の評価 - 現在回数 × 6
```

これは曲数と初期案を作るための内部評価です。
焼きなまし後の`totalScore`ではCSV点を10倍しません。

現在は`balanceMaxDifference`を1〜5まで自動で変え、それぞれ探索します。

```text
各段階で絶対条件を守る
  -> 空白数を最小化する
  -> その中で点数を最大化する
```

最後は、見つかった空白数が最も少ない段階のうち、曲数差が最も小さい段階を選びます。
差を広げても空白数が減らない場合は、より均等なほうを選びます。

`CountRuleMode::FixedTarget`では、各曲の`targetCount`をそのまま使います。
実現できない場合はエラーです。
Web版では回数固定でも`trialCount`回までseedを変えて初期案を試します。
固定回数の合計が枠数と一致していても、×、確定枠、同日制限によって配置できない場合があります。
設定見出しには「固定回数合計 / 使用可能枠数」を表示します。

Balanceのまま一部の曲だけ回数固定することもできます。

```cpp
if (songName == "曲A") {
    rule.targetCount = 5;
}
```

`targetCount = -1`の曲は自動、0以上を設定した曲だけは指定回数で固定されます。

## 時間帯の設定

全曲について、早い枠・遅い枠へ偏りすぎないようにする設定です。

```cpp
rule.timeBalancePenalty = 10;
```

`10`は通常点の10点ではなく、同点比較専用の微小点です。
各曲が入った枠の平均位置を見て、中央から前半・後半へ寄るほど最大10まで減点します。
Web画面では内部値10を`0.010点`として表示します。

特定の曲を早め、または遅めにしたい場合は曲別設定内に書きます。

```cpp
if (songName == "曲A") {
    rule.timePreference = scheduler::TimePreference::PreferEarly;
    rule.timePreferencePenalty = 10;
}

if (songName == "曲B") {
    rule.timePreference = scheduler::TimePreference::PreferLate;
    rule.timePreferencePenalty = 10;
}
```

この値も同点比較専用なので、強く設定しても通常点を逆転しません。
`PreferEarly`または`PreferLate`を指定した曲では、通常の時間帯偏り評価を止め、
指定した方向への希望だけを評価します。

## 初期案と試行回数の意味

現在のmainでは次の設定です。

```cpp
config.trialCount = 200;
config.annealingIterations = 2000;
config.candidateLimit = 10;
const int minBalanceDifference = 1;
const int maxBalanceDifference = 5;
```

現在は曲数差1〜5を、それぞれ200seedずつ試します。
比較範囲は`minBalanceDifference`と`maxBalanceDifference`で変更できます。
`trialCount = 200`は、完成候補が200個できる意味ではありません。
seedを変えて、曲数決定と初期案作成を最大200回試すという意味です。
初期案を作れなかったseedは焼きなましへ進みません。

実行時には次の形式で表示されます。

```text
balance comparison:
maxDifference=1 blanks=17 successful=197/200 total=891 time=-42 counts=4-5
maxDifference=2 blanks=6  successful=12/200  total=840 time=-42 counts=4-6 selected
maxDifference=3 blanks=6  successful=14/200  total=871 time=-41 counts=4-7
maxDifference=4 blanks=6  successful=11/200  total=892 time=-42 counts=4-8
maxDifference=5 blanks=6  successful=11/200  total=893 time=-42 counts=4-9
```

各`maxDifference`の`SchedulerResult`は、重複しない上位10案を保持しています。
現在の比較表示は最良案だけですが、Web版では段階ごとの候補一覧に使えます。

`successful`が少ない場合、探索の精度以前に初期案生成が不安定です。
初期案は、現在の枠を逃すと必要回数に届かない曲を先に調べるよう改善しています。
以前は最大差5でも1000回中1回しか初期案を作れませんでした。
先読み追加後の現在の設定では、各段階200回のうち11〜197回成功しています。
ただし、複数曲が同じ枠を必要とする競合までは完全には解けないため、失敗はまだあります。

## 焼きなましの動き

焼きなましでは次の2種類の変更を使います。

```text
swap
  固定されていない2枠の中身を交換する。
  空白の位置は変えられるが、各曲の回数は変わらない。

曲変更
  1つの非固定・非空白枠を、別の曲へ変える。
  空白数は変えない。
  minCount / maxCount / balanceMaxDifference は破らない。
```

曲変更は次で切り替えます。

```cpp
config.enableSongChangeNeighbor = true;  // 使用する
config.enableSongChangeNeighbor = false; // 使用しない
```

ONの場合、各反復の25%で曲変更も試し、その反復のswap案より良ければ採用候補にします。
各焼きなましは途中で見つけた最高点を保存しているため、曲変更によってその1回の保存結果が
直接悪化することはありません。ただし探索経路は変わるため、ON/OFFで結果は変わります。

現在のmainではONです。途中の最高点を保存するため、1回の焼きなましの中で
曲変更後の悪い状態がそのまま最終結果になることはありません。

## 現在の空白6個について

現在のmainでは、`8/28（金）10:00〜15:00`の6枠を
`addFixedBlankRequest`で強制空白にしています。
確認時の`minimum blanks: 6`は、この6個そのものです。
探索が追加で空白を作った結果ではありません。

## 現状の評価

コードは入力・採点・探索に分かれており、構造そのものは整理されています。
一方、アルゴリズムの精度はまだ完成とは言えません。

`create_initial_assignment`は各曲の残り配置可能数を先読みしますが、完全な全組み合わせ探索では
ありません。そのため、表示される空白数は数学的に証明された最小値ではなく、現在の試行で
見つけた最小値です。特に差1のような厳しい段階は、さらに良い配置が残っている可能性があります。

候補には曲ごとの点数内訳も保持しています。現在のコンソールでは最良案について、
基本点、同日減点、日付偏り、希望点、時間帯微小点を曲別に表示します。

## ファイルの役割

```text
cpp/main.cpp
  CSV、設定、確定・希望枠、結果表示。

cpp/scheduler/types.hpp
  全体で使う型と基本点数。

cpp/scheduler/input/
  CSV読み込みとScoreTableへの変換。

cpp/scheduler/score/
  基本点、同日制限、日付偏り、時間帯、確定・希望枠、曲別内訳の採点。

cpp/tests/scheduler_score_test.cpp
  Web移植時の答え合わせに使う、固定入力の採点テスト。

cpp/scheduler/solver/create_target_counts.*
  各曲の目標回数を決める。

cpp/scheduler/solver/find_min_blank_count.*
  初期案を作れる空白数を0から探す。

cpp/scheduler/solver/create_initial_assignment.*
  目標回数どおりの最初の配置を貪欲に作る。

cpp/scheduler/solver/neighbor.*
  swapと曲変更を作る。

cpp/scheduler/solver/annealing.*
  近傍案を採用しながら最高点を探す。

cpp/scheduler/solver/candidate_store.*
  成功した候補を通常点と時間帯微小点の順に、重複なく最大candidateLimit件残す。

cpp/scheduler/solver/solve_scheduler.*
  全処理をまとめ、候補と成功・失敗統計を返す。

cpp/scheduler/solver/solve_balance_comparison.*
  曲数差1〜5を比較し、空白が最少で最も均等な段階を選ぶ。

src/features/scheduler/types.ts
  Web版エンジンで使うTypeScriptの型。

src/features/scheduler/defaultConfig.ts
  C++版と同じ初期設定を作る。

src/features/scheduler/score/
  C++版と同じ採点、曲別内訳、採点テスト。

src/features/scheduler/input/
  曲ごとCSVの読み込みとScoreTableへの変換。

src/features/scheduler/config/
  確定枠・強制空白・希望枠を追加する関数。

src/features/scheduler/edit/
  2枠の仮交換、点数差、絶対条件違反、Undo・Redo履歴を扱う。

src/features/scheduler/settings/
  設定JSONを曲名・時間枠名で保存し、現在のCSVへ読み込む。

src/features/scheduler/solver/
  曲数、初期案、近傍、焼きなまし、候補保存、曲数差比較。

src/features/scheduler/worker/
  solverをWeb Workerで開始し、進捗・結果・エラーを画面側へ返す。

src/features/scheduler/ui/
  CSV、設定、候補表・比較、予定カレンダー、swap確認を表示する。

src/app/
  Next.jsのページ、共通レイアウト、画面スタイル。

src/cli/runScheduler.ts
  Node.jsで実CSVを読み、TypeScript版solverを実行する。
```

詳しい仕様は `SPEC.md`、構成方針は `ARCHITECTURE.md`、AI向け作業ルールは
`AGENTS.md`にあります。
Web版との入出力境界は`WEB_ENGINE_CONTRACT.md`にあります。
