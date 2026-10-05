import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyScoreResult } from "../score/scoreHelpers";
import {
  finalDisplayScore,
  formatDecimalScore,
  timeTieBreakDisplayScore,
} from "./scoreDisplay";

test("時間帯微小点を0.001点単位で最終表示へ加える", () => {
  const score = createEmptyScoreResult();
  score.totalScore = 42;
  score.timeTieBreakScore = -17;

  assert.equal(timeTieBreakDisplayScore(score.timeTieBreakScore), -0.017);
  assert.equal(finalDisplayScore(score), 41.983);
  assert.equal(formatDecimalScore(finalDisplayScore(score)), "41.983");
  assert.equal(formatDecimalScore(0.025, true), "+0.025");
});
