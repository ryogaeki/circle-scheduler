# TypeScript版 scheduler

C++版の予定調整エンジンを、Web画面から使える形へ順番に移植するフォルダです。

```text
types.ts
  エンジン全体の型と、空白・基本点などの定数。

defaultConfig.ts
  C++版と同じ初期設定を作る。

score/
  基本点、同日制限、日付偏り、時間帯、確定・希望枠を採点する。
  evaluateAssignmentが全体点と曲別内訳をまとめて返す。

input/
  曲ごとCSVを読み、ScoreTableへ変換する。
  列に人名が並ぶ人ごとCSVは、誤入力として読み込みを止める。

config/
  確定枠、強制空白、希望枠を設定へ追加する。

edit/
  2枠の仮交換と、手動編集のUndo・Redo履歴を扱う。

settings/
  共通・曲別・割り当て設定をJSONで保存・読み込みする。

solver/
  曲数、初期案、近傍、焼きなまし、候補、曲数差比較を扱う。

worker/
  solverを別スレッドで実行し、進捗、結果、エラーを返す。

ui/
  CSV、設定、候補表・比較、予定カレンダー、手動swapを扱う。
```

現在は候補作成、設定保存、候補比較、カレンダー上の手動調整まで移植済みです。
編集は元候補と分離し、交換前確認、Undo・Redo、元候補への復帰に対応します。

画面側では次の形で呼びます。

```ts
const run = startSolverWorker(solveRequest, (progress) => {
  console.log(progress.completedDifferenceCount);
});

const comparison = await run.result;
// 計算を止める場合は run.cancel() を呼ぶ。
```

```bash
npm run typecheck
npm test
npm run scheduler
npm run dev
```
