"use client";

import { Eye, GitCompareArrows, X } from "lucide-react";

import {
  EMPTY_SONG_ID,
  type ScheduleCandidate,
  type ScoreTable,
} from "../types";
import {
  finalDisplayScore,
  formatDecimalScore,
  formatIntegerScore,
  timeTieBreakDisplayScore,
} from "./scoreDisplay";

type CandidateComparisonPanelProps = {
  firstCandidate: ScheduleCandidate;
  secondCandidate: ScheduleCandidate;
  scoreTable: ScoreTable;
  onClose: () => void;
  onSelectSecond: () => void;
};

const SCORE_ROWS = [
  {
    id: "final",
    label: "最終点",
    value: finalDisplayScore,
    decimal: true,
  },
  {
    id: "total",
    label: "通常点",
    value: (score: ScheduleCandidate["score"]) => score.totalScore,
  },
  {
    id: "availability",
    label: "○△×",
    value: (score: ScheduleCandidate["score"]) => score.availabilityScore,
  },
  {
    id: "dayConstraint",
    label: "同日制限",
    value: (score: ScheduleCandidate["score"]) => score.dayConstraintPenalty,
  },
  {
    id: "daySpacing",
    label: "日付間隔",
    value: (score: ScheduleCandidate["score"]) => score.daySpacingPenalty,
    decimal: true,
  },
  {
    id: "request",
    label: "希望枠",
    value: (score: ScheduleCandidate["score"]) => score.assignmentRequestScore,
  },
  {
    id: "time",
    label: "時間帯微小点",
    value: (score: ScheduleCandidate["score"]) =>
      timeTieBreakDisplayScore(score.timeTieBreakScore),
    decimal: true,
  },
];

function songName(scoreTable: ScoreTable, songId: number): string {
  return songId === EMPTY_SONG_ID
    ? "空白"
    : (scoreTable.songs[songId]?.name ?? `曲ID ${songId}`);
}

function countSongs(candidate: ScheduleCandidate, songCount: number): number[] {
  const counts = Array.from({ length: songCount }, () => 0);
  for (const songId of candidate.assignment.assignedSongIds) {
    if (songId !== EMPTY_SONG_ID) {
      counts[songId] += 1;
    }
  }
  return counts;
}

// 2候補の点数、曲数、配置が異なる枠を一つの画面で比較する。
export function CandidateComparisonPanel({
  firstCandidate,
  secondCandidate,
  scoreTable,
  onClose,
  onSelectSecond,
}: CandidateComparisonPanelProps) {
  const firstCounts = countSongs(firstCandidate, scoreTable.songs.length);
  const secondCounts = countSongs(secondCandidate, scoreTable.songs.length);
  const changedSlots = scoreTable.timeSlots.filter(
    (timeSlot) =>
      firstCandidate.assignment.assignedSongIds[timeSlot.id] !==
      secondCandidate.assignment.assignedSongIds[timeSlot.id],
  );
  const changedSongs = scoreTable.songs.filter(
    (song) => firstCounts[song.id] !== secondCounts[song.id],
  );

  return (
    <section
      className="candidate-comparison-section"
      aria-labelledby="candidate-comparison-heading"
    >
      <div className="section-heading-row comparison-heading-row">
        <div>
          <p className="section-kicker">COMPARISON</p>
          <h2 id="candidate-comparison-heading">
            候補 #{firstCandidate.id} と #{secondCandidate.id}
          </h2>
        </div>
        <button
          className="icon-button"
          type="button"
          title="候補比較を閉じる"
          aria-label="候補比較を閉じる"
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="comparison-summary">
        <GitCompareArrows aria-hidden="true" size={18} />
        <span>配置が異なる時間枠</span>
        <strong>{changedSlots.length}枠</strong>
        <span>回数が異なる曲</span>
        <strong>{changedSongs.length}曲</strong>
      </div>

      <div className="comparison-columns">
        <div className="comparison-table-scroll">
          <table className="comparison-score-table">
            <thead>
              <tr>
                <th>採点項目</th>
                <th>#{firstCandidate.id}</th>
                <th>#{secondCandidate.id}</th>
                <th>差</th>
              </tr>
            </thead>
            <tbody>
              {SCORE_ROWS.map(({ id, label, value, decimal }) => {
                const first = value(firstCandidate.score);
                const second = value(secondCandidate.score);
                const format = decimal
                  ? formatDecimalScore
                  : formatIntegerScore;
                return (
                  <tr key={id}>
                    <th scope="row">{label}</th>
                    <td>{format(first)}</td>
                    <td>{format(second)}</td>
                    <td>{format(second - first, true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="comparison-table-scroll">
          <table className="comparison-count-table">
            <thead>
              <tr>
                <th>曲</th>
                <th>#{firstCandidate.id}</th>
                <th>#{secondCandidate.id}</th>
                <th>差</th>
              </tr>
            </thead>
            <tbody>
              {(changedSongs.length > 0 ? changedSongs : scoreTable.songs).map(
                (song) => (
                  <tr key={song.id}>
                    <th scope="row">{song.name}</th>
                    <td>{firstCounts[song.id]}</td>
                    <td>{secondCounts[song.id]}</td>
                    <td>
                      {formatIntegerScore(
                        secondCounts[song.id] - firstCounts[song.id],
                        true,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="comparison-slots">
        <div className="comparison-subheading">
          <h3>異なる時間枠</h3>
          <button
            className="button secondary"
            type="button"
            onClick={onSelectSecond}
          >
            <Eye aria-hidden="true" size={16} />
            候補 #{secondCandidate.id} を表示
          </button>
        </div>
        {changedSlots.length === 0 ? (
          <p className="comparison-empty">配置は同じです。</p>
        ) : (
          <div className="comparison-table-scroll">
            <table className="comparison-slot-table">
              <thead>
                <tr>
                  <th>時間枠</th>
                  <th>#{firstCandidate.id}</th>
                  <th>#{secondCandidate.id}</th>
                </tr>
              </thead>
              <tbody>
                {changedSlots.map((timeSlot) => (
                  <tr key={timeSlot.id}>
                    <th scope="row">{timeSlot.label}</th>
                    <td>
                      {songName(
                        scoreTable,
                        firstCandidate.assignment.assignedSongIds[timeSlot.id],
                      )}
                    </td>
                    <td>
                      {songName(
                        scoreTable,
                        secondCandidate.assignment.assignedSongIds[timeSlot.id],
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
