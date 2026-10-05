"use client";

import { AlertTriangle, ArrowRight, Check, X } from "lucide-react";

import {
  EMPTY_SONG_ID,
  type PreviewSwapResult,
  type ScoreResult,
  type ScoreTable,
  type SwapViolationCode,
} from "../types";
import {
  finalDisplayScore,
  formatDecimalScore,
  formatIntegerScore,
  timeTieBreakDisplayScore,
} from "./scoreDisplay";

type SwapPreviewPanelProps = {
  firstTimeSlotId: number;
  secondTimeSlotId: number;
  preview: PreviewSwapResult;
  scoreTable: ScoreTable;
  onApply: () => void;
  onCancel: () => void;
};

const VIOLATION_TEXT: Record<SwapViolationCode, string> = {
  sameTimeSlot: "同じ時間枠は交換できません。",
  sameAssignment: "同じ曲同士のため、予定は変わりません。",
  firstSlotFixed: "交換元が確定枠です。",
  secondSlotFixed: "交換先が確定枠です。",
  hardConstraint: "交換後の予定が絶対条件に違反します。",
};

function songName(scoreTable: ScoreTable, songId: number): string {
  return songId === EMPTY_SONG_ID
    ? "空白"
    : (scoreTable.songs[songId]?.name ?? `曲ID ${songId}`);
}

function ScoreRow({
  label,
  before,
  after,
  decimal = false,
}: {
  label: string;
  before: number;
  after: number;
  decimal?: boolean;
}) {
  const difference = after - before;
  const differenceClass =
    difference > 0 ? "is-positive" : difference < 0 ? "is-negative" : "";
  const format = decimal ? formatDecimalScore : formatIntegerScore;
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{format(before)}</td>
      <td>{format(after)}</td>
      <td className={differenceClass}>{format(difference, true)}</td>
    </tr>
  );
}

// 交換する2枠と、反映前後の点数・絶対条件違反をまとめて表示する。
export function SwapPreviewPanel({
  firstTimeSlotId,
  secondTimeSlotId,
  preview,
  scoreTable,
  onApply,
  onCancel,
}: SwapPreviewPanelProps) {
  const firstSlot = scoreTable.timeSlots[firstTimeSlotId];
  const secondSlot = scoreTable.timeSlots[secondTimeSlotId];
  const firstBeforeSongId = preview.assignment.assignedSongIds[secondTimeSlotId];
  const secondBeforeSongId = preview.assignment.assignedSongIds[firstTimeSlotId];
  const firstAfterSongId = preview.assignment.assignedSongIds[firstTimeSlotId];
  const secondAfterSongId = preview.assignment.assignedSongIds[secondTimeSlotId];
  const beforeScore: ScoreResult = preview.before.score;
  const afterScore: ScoreResult = preview.after.score;

  return (
    <div className="swap-preview" role="region" aria-label="交換プレビュー">
      <div className="swap-preview-heading">
        <div>
          <p className="section-kicker">SWAP PREVIEW</p>
          <h3>交換プレビュー</h3>
        </div>
        <button
          className="icon-button"
          type="button"
          title="プレビューを閉じる"
          aria-label="プレビューを閉じる"
          onClick={onCancel}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="swap-slots">
        <div>
          <span>{firstSlot.label}</span>
          <strong className="swap-song-change">
            <span>{songName(scoreTable, firstBeforeSongId)}</span>
            <ArrowRight aria-hidden="true" size={15} />
            <span>{songName(scoreTable, firstAfterSongId)}</span>
          </strong>
        </div>
        <div>
          <span>{secondSlot.label}</span>
          <strong className="swap-song-change">
            <span>{songName(scoreTable, secondBeforeSongId)}</span>
            <ArrowRight aria-hidden="true" size={15} />
            <span>{songName(scoreTable, secondAfterSongId)}</span>
          </strong>
        </div>
      </div>

      {preview.violationCodes.length > 0 && (
        <div className="swap-violations" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <div>
            {[...new Set(preview.violationCodes)].map((code) => (
              <p key={code}>{VIOLATION_TEXT[code]}</p>
            ))}
          </div>
        </div>
      )}

      <div className="swap-score-scroll">
        <table className="swap-score-table">
          <thead>
            <tr>
              <th>採点項目</th>
              <th>現在</th>
              <th>交換後</th>
              <th>差</th>
            </tr>
          </thead>
          <tbody>
            <ScoreRow
              label="最終点"
              before={finalDisplayScore(beforeScore)}
              after={finalDisplayScore(afterScore)}
              decimal
            />
            <ScoreRow
              label="通常点"
              before={beforeScore.totalScore}
              after={afterScore.totalScore}
            />
            <ScoreRow
              label="○△×"
              before={beforeScore.availabilityScore}
              after={afterScore.availabilityScore}
            />
            <ScoreRow
              label="同日制限"
              before={beforeScore.dayConstraintPenalty}
              after={afterScore.dayConstraintPenalty}
            />
            <ScoreRow
              label="日付間隔"
              before={beforeScore.daySpacingPenalty}
              after={afterScore.daySpacingPenalty}
              decimal
            />
            <ScoreRow
              label="希望枠"
              before={beforeScore.assignmentRequestScore}
              after={afterScore.assignmentRequestScore}
            />
            <ScoreRow
              label="時間帯微小点"
              before={timeTieBreakDisplayScore(beforeScore.timeTieBreakScore)}
              after={timeTieBreakDisplayScore(afterScore.timeTieBreakScore)}
              decimal
            />
          </tbody>
        </table>
      </div>

      <div className="swap-preview-actions">
        <span className={preview.allowed ? "swap-ok" : "swap-blocked"}>
          {preview.allowed ? "交換できます" : "交換できません"}
        </span>
        <button className="button secondary" type="button" onClick={onCancel}>
          キャンセル
        </button>
        <button
          className="button primary"
          type="button"
          disabled={!preview.allowed}
          onClick={onApply}
        >
          <Check aria-hidden="true" size={17} />
          交換を反映
        </button>
      </div>
    </div>
  );
}
