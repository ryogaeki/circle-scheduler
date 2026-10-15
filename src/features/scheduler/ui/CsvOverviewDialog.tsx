"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import type { AvailabilityMark, SongCsvData } from "../types";

type CsvOverviewDialogProps = {
  fileName: string;
  csvData: SongCsvData;
  onClose: () => void;
};

const MARK_DISPLAY: Record<AvailabilityMark, string> = {
  available: "○",
  maybe: "△",
  unavailable: "×",
};

// 読み込んだ曲ごとCSVを、編集せず確認するための一覧画面。
export function CsvOverviewDialog({
  fileName,
  csvData,
  onClose,
}: CsvOverviewDialogProps) {
  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  return (
    <div
      className="score-guide-backdrop csv-overview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="csv-overview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-overview-heading"
      >
        <header className="score-guide-header csv-overview-header">
          <div>
            <h2 id="csv-overview-heading">○△×・コメント一覧</h2>
            <p>
              {fileName} ・ {csvData.timeSlots.length}時間枠 ・ {csvData.songs.length}曲
            </p>
          </div>
          <button
            className="icon-button"
            type="button"
            title="一覧を閉じる"
            aria-label="一覧を閉じる"
            onClick={onClose}
          >
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="csv-overview-table-scroll">
          <table className="csv-overview-table">
            <thead>
              <tr>
                <th className="csv-overview-slot-column" scope="col">
                  日程
                </th>
                {csvData.songs.map((song) => (
                  <th key={song.id} scope="col">
                    {song.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="csv-overview-comment-row">
                <th className="csv-overview-slot-column" scope="row">
                  コメント
                </th>
                {csvData.songs.map((song) => (
                  <td key={song.id}>
                    {csvData.songComments[song.id] || "コメントなし"}
                  </td>
                ))}
              </tr>
              {csvData.timeSlots.map((timeSlot, timeSlotId) => (
                <tr key={timeSlot.id}>
                  <th className="csv-overview-slot-column" scope="row">
                    {timeSlot.label}
                  </th>
                  {csvData.marks[timeSlotId].map((mark, songId) => (
                    <td
                      className={`csv-overview-mark is-${mark}`}
                      key={csvData.songs[songId].id}
                      aria-label={`${csvData.songs[songId].name}: ${MARK_DISPLAY[mark]}`}
                    >
                      {MARK_DISPLAY[mark]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
