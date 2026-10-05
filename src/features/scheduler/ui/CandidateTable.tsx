"use client";

import {
  AlertCircle,
  CheckCircle2,
  GitCompareArrows,
} from "lucide-react";

import {
  EMPTY_SONG_ID,
  type BalanceComparisonResult,
  type CountRuleMode,
  type ScheduleCandidate,
  type ScoreTable,
} from "../types";
import {
  finalDisplayScore,
  formatDecimalScore,
  formatIntegerScore,
  timeTieBreakDisplayScore,
} from "./scoreDisplay";

type CandidateTableProps = {
  comparison: BalanceComparisonResult;
  scoreTable: ScoreTable;
  activeEntryIndex: number;
  activeCandidateId: number | null;
  comparisonCandidateId: number | null;
  countRuleMode: CountRuleMode;
  onEntryChange: (entryIndex: number) => void;
  onCandidateChange: (candidateId: number) => void;
  onComparisonCandidateChange: (candidateId: number | null) => void;
};

function candidateCounts(
  candidate: ScheduleCandidate,
  songCount: number,
): { blanks: number; minimum: number; maximum: number } {
  const counts = Array.from({ length: songCount }, () => 0);
  let blanks = 0;
  for (const songId of candidate.assignment.assignedSongIds) {
    if (songId === EMPTY_SONG_ID) {
      blanks += 1;
    } else {
      counts[songId] += 1;
    }
  }
  return {
    blanks,
    minimum: counts.length === 0 ? 0 : Math.min(...counts),
    maximum: counts.length === 0 ? 0 : Math.max(...counts),
  };
}

export function CandidateTable({
  comparison,
  scoreTable,
  activeEntryIndex,
  activeCandidateId,
  comparisonCandidateId,
  countRuleMode,
  onEntryChange,
  onCandidateChange,
  onComparisonCandidateChange,
}: CandidateTableProps) {
  const entry = comparison.entries[activeEntryIndex];

  return (
    <section className="candidate-section" aria-labelledby="candidate-heading">
      <div className="section-heading-row candidate-heading-row">
        <div>
          <p className="section-kicker">RESULT</p>
          <h2 id="candidate-heading">候補一覧</h2>
        </div>
        {entry.solved && (
          <div className="result-summary">
            <span>{entry.result.candidates.length}候補</span>
            <span>空白 {entry.result.statistics.minimumBlankCount}</span>
            <span>
              成功 {entry.result.statistics.successfulTrialCount}/
              {entry.result.statistics.attemptedTrialCount}
            </span>
          </div>
        )}
      </div>

      <div className="difference-tabs" role="tablist" aria-label="曲数差">
        {comparison.entries.map((item, index) => (
          <button
            className={index === activeEntryIndex ? "is-active" : ""}
            key={item.maxDifference}
            type="button"
            role="tab"
            aria-selected={index === activeEntryIndex}
            onClick={() => onEntryChange(index)}
          >
            {countRuleMode === "fixedTarget"
              ? "回数固定"
              : `差 ${item.maxDifference}`}
            <span>
              {item.solved
                ? `空白 ${item.result.statistics.minimumBlankCount}`
                : "失敗"}
            </span>
          </button>
        ))}
      </div>

      {!entry.solved ? (
        <div className="inline-alert error" role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          <span>{entry.errorMessage}</span>
        </div>
      ) : (
        <div className="candidate-card-list">
          {entry.result.candidates.map((candidate) => {
            const counts = candidateCounts(
              candidate,
              scoreTable.songs.length,
            );
            const selected = candidate.id === activeCandidateId;
            const comparisonSelected =
              candidate.id === comparisonCandidateId;
            return (
              <article
                className={`candidate-card${selected ? " is-selected" : ""}${
                  comparisonSelected ? " is-comparison" : ""
                }`}
                key={candidate.id}
              >
                <button
                  className="candidate-card-select"
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onCandidateChange(candidate.id)}
                >
                  <span className="candidate-card-heading">
                    <span>候補 #{candidate.id}</span>
                    <strong>
                      {formatDecimalScore(finalDisplayScore(candidate.score))}点
                    </strong>
                  </span>
                  <span className="candidate-card-status">
                    <CheckCircle2 aria-hidden="true" size={14} />
                    有効
                  </span>
                  <dl className="candidate-card-metrics">
                    <div>
                      <dt>空白</dt>
                      <dd>{counts.blanks}</dd>
                    </div>
                    <div>
                      <dt>曲数</dt>
                      <dd>{counts.minimum}–{counts.maximum}</dd>
                    </div>
                    <div>
                      <dt>基本</dt>
                      <dd>{formatIntegerScore(candidate.score.availabilityScore, true)}</dd>
                    </div>
                    <div>
                      <dt>同日</dt>
                      <dd>{formatIntegerScore(candidate.score.dayConstraintPenalty, true)}</dd>
                    </div>
                    <div>
                      <dt>日付</dt>
                      <dd>{formatDecimalScore(candidate.score.daySpacingPenalty, true)}</dd>
                    </div>
                    <div>
                      <dt>希望</dt>
                      <dd>{formatIntegerScore(candidate.score.assignmentRequestScore, true)}</dd>
                    </div>
                    <div>
                      <dt>時間</dt>
                      <dd>
                        {formatDecimalScore(
                          timeTieBreakDisplayScore(candidate.score.timeTieBreakScore),
                          true,
                        )}
                      </dd>
                    </div>
                  </dl>
                </button>
                <button
                  className={`icon-button compare-button${
                    comparisonSelected ? " is-active" : ""
                  }`}
                  type="button"
                  title={
                    selected
                      ? "表示中の候補です"
                      : comparisonSelected
                        ? "比較を終了"
                        : `候補 #${candidate.id} と比較`
                  }
                  aria-label={
                    comparisonSelected
                      ? `候補 #${candidate.id} の比較を終了`
                      : `候補 #${candidate.id} と比較`
                  }
                  aria-pressed={comparisonSelected}
                  disabled={selected}
                  onClick={() =>
                    onComparisonCandidateChange(
                      comparisonSelected ? null : candidate.id,
                    )
                  }
                >
                  <GitCompareArrows aria-hidden="true" size={17} />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
