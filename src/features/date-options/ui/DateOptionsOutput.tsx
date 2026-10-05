import { Clipboard, Download, Trash2 } from "lucide-react";

type DateOptionsOutputProps = {
  dateCount: number;
  notice: string;
  outputText: string;
  totalSlotCount: number;
  onClear: () => void;
  onCopy: () => void;
  onDownload: () => void;
};

export function DateOptionsOutput({
  dateCount,
  notice,
  outputText,
  totalSlotCount,
  onClear,
  onCopy,
  onDownload,
}: DateOptionsOutputProps) {
  return (
    <aside className="date-options-output" aria-labelledby="date-output-heading">
      <div className="date-output-heading">
        <div>
          <span id="date-output-heading">出力</span>
          <strong>{dateCount}日・{totalSlotCount}枠</strong>
        </div>
        <button
          className="icon-button danger-icon"
          type="button"
          title="すべて削除"
          disabled={!outputText}
          onClick={onClear}
        >
          <Trash2 aria-hidden="true" size={17} />
        </button>
      </div>
      <textarea
        readOnly
        value={outputText}
        placeholder="日付と時間を設定すると、ここに日程文が表示されます。"
      />
      <div className="date-output-actions">
        <button
          className="button secondary"
          type="button"
          disabled={!outputText}
          onClick={onCopy}
        >
          <Clipboard aria-hidden="true" size={16} />
          コピー
        </button>
        <button
          className="button primary"
          type="button"
          disabled={!outputText}
          onClick={onDownload}
        >
          <Download aria-hidden="true" size={16} />
          TXT保存
        </button>
      </div>
      {notice && <p className="date-options-notice" role="status">{notice}</p>}
    </aside>
  );
}
