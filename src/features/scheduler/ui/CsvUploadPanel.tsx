"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useState, type ChangeEvent, type DragEvent } from "react";

type CsvUploadPanelProps = {
  fileName: string | null;
  timeSlotCount: number;
  songCount: number;
  disabled: boolean;
  onFileSelected: (file: File) => void;
};

export function CsvUploadPanel({
  fileName,
  timeSlotCount,
  songCount,
  disabled,
  onFileSelected,
}: CsvUploadPanelProps) {
  const [dragging, setDragging] = useState(false);

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) {
      const file = event.dataTransfer.files[0];
      if (file) {
        onFileSelected(file);
      }
    }
  };

  return (
    <section className="upload-section" aria-labelledby="csv-heading">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">INPUT</p>
          <h2 id="csv-heading">曲ごとCSV</h2>
        </div>
        {fileName && (
          <dl className="file-metrics" aria-label="読み込み結果">
            <div>
              <dt>時間枠</dt>
              <dd>{timeSlotCount}</dd>
            </div>
            <div>
              <dt>曲</dt>
              <dd>{songCount}</dd>
            </div>
          </dl>
        )}
      </div>

      <div
        className={`drop-zone${dragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <FileSpreadsheet aria-hidden="true" size={24} />
        <div className="file-copy">
          <strong>{fileName ?? "CSV未選択"}</strong>
          <span>{fileName ? "読み込み済み" : "CSVファイルをドロップ"}</span>
        </div>
        <label className={`button secondary${disabled ? " is-disabled" : ""}`}>
          <Upload aria-hidden="true" size={17} />
          CSVを選択
          <input
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            disabled={disabled}
            onChange={handleInput}
          />
        </label>
      </div>
    </section>
  );
}
