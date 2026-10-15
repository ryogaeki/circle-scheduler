"use client";

import { Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

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
  const [compact, setCompact] = useState(false);

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
          <div className="csv-overview-header-actions">
            <div
              className="segmented-control compact csv-overview-density-control"
              aria-label="一覧の表示密度"
            >
              <button
                className={!compact ? "is-active" : ""}
                type="button"
                aria-pressed={!compact}
                onClick={() => setCompact(false)}
              >
                <Maximize2 aria-hidden="true" size={14} />
                通常
              </button>
              <button
                className={compact ? "is-active" : ""}
                type="button"
                aria-pressed={compact}
                onClick={() => setCompact(true)}
              >
                <Minimize2 aria-hidden="true" size={14} />
                コンパクト
              </button>
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
          </div>
        </header>

        <div className="csv-overview-body">
          <div className="csv-overview-table-scroll">
            <table
              className={`csv-overview-table${compact ? " is-compact" : ""}`}
              style={
                { "--song-count": csvData.songs.length } as CSSProperties
              }
            >
              <thead>
                <tr>
                  <th className="csv-overview-slot-column" scope="col">
                    日程
                  </th>
                  {csvData.songs.map((song) => (
                    <th key={song.id} scope="col" title={song.name}>
                      {song.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.timeSlots.map((timeSlot, timeSlotId) => (
                  <tr
                    className={
                      timeSlotId > 0 && timeSlot.indexInDay === 0
                        ? "is-new-day"
                        : ""
                    }
                    key={timeSlot.id}
                  >
                    <th
                      className="csv-overview-slot-column"
                      scope="row"
                      title={timeSlot.label}
                    >
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

          <section
            className="csv-overview-comments"
            aria-labelledby="csv-comments-heading"
          >
            <h3 id="csv-comments-heading">コメント</h3>
            <div className="csv-overview-comments-scroll">
              <table>
                <tbody>
                  {csvData.songs.map((song) => (
                    <tr key={song.id}>
                      <th scope="row">{song.name}</th>
                      <td>{csvData.songComments[song.id]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
