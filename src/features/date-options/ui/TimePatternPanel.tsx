import { Plus, RotateCcw, Trash2 } from "lucide-react";

export type TimeInputMode = "interval" | "manual";

type TimePatternPanelProps = {
  generatedTimes: string[];
  intervalMinutes: number;
  manualTimes: string[];
  selectedDateCount: number;
  slotCount: number;
  startTime: string;
  timeInputMode: TimeInputMode;
  onApply: () => void;
  onClearSelection: () => void;
  onIntervalChange: (minutes: number) => void;
  onManualTimesChange: (times: string[]) => void;
  onRemove: () => void;
  onSlotCountChange: (count: number) => void;
  onStartTimeChange: (time: string) => void;
  onTimeInputModeChange: (mode: TimeInputMode) => void;
};

export function TimePatternPanel({
  generatedTimes,
  intervalMinutes,
  manualTimes,
  selectedDateCount,
  slotCount,
  startTime,
  timeInputMode,
  onApply,
  onClearSelection,
  onIntervalChange,
  onManualTimesChange,
  onRemove,
  onSlotCountChange,
  onStartTimeChange,
  onTimeInputModeChange,
}: TimePatternPanelProps) {
  return (
    <section className="time-pattern" aria-label="時間設定">
      <div className="time-pattern-heading">
        <div>
          <span>選択中</span>
          <strong>{selectedDateCount}日</strong>
        </div>
        <button
          className="button quiet"
          type="button"
          disabled={selectedDateCount === 0}
          onClick={onClearSelection}
        >
          <RotateCcw aria-hidden="true" size={15} />
          選択解除
        </button>
      </div>

      <div className="segmented-control compact time-input-mode">
        <button
          className={timeInputMode === "interval" ? "is-active" : ""}
          type="button"
          onClick={() => onTimeInputModeChange("interval")}
        >
          等間隔
        </button>
        <button
          className={timeInputMode === "manual" ? "is-active" : ""}
          type="button"
          onClick={() => onTimeInputModeChange("manual")}
        >
          個別指定
        </button>
      </div>

      {timeInputMode === "interval" ? (
        <div className="time-fields">
          <label>
            <span>開始時刻</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => onStartTimeChange(event.target.value)}
            />
          </label>
          <label>
            <span>間隔</span>
            <select
              value={intervalMinutes}
              onChange={(event) => onIntervalChange(Number(event.target.value))}
            >
              {[15, 30, 45, 60, 90, 120].map((minutes) => (
                <option value={minutes} key={minutes}>{minutes}分</option>
              ))}
            </select>
          </label>
          <label>
            <span>枠数</span>
            <select
              value={slotCount}
              onChange={(event) => onSlotCountChange(Number(event.target.value))}
            >
              {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => (
                <option value={count} key={count}>{count}枠</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="manual-time-editor">
          <div className="manual-time-list">
            {manualTimes.map((time, index) => (
              <div className="manual-time-row" key={index}>
                <input
                  type="time"
                  aria-label={`個別時刻 ${index + 1}`}
                  value={time}
                  onChange={(event) => {
                    const next = [...manualTimes];
                    next[index] = event.target.value;
                    onManualTimesChange(next);
                  }}
                />
                <button
                  className="icon-button danger-icon"
                  type="button"
                  title="この時刻を削除"
                  disabled={manualTimes.length === 1}
                  onClick={() =>
                    onManualTimesChange(
                      manualTimes.filter((_, timeIndex) => timeIndex !== index),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="button secondary add-manual-time"
            type="button"
            onClick={() => onManualTimesChange([...manualTimes, ""])}
          >
            <Plus aria-hidden="true" size={16} />
            時刻を追加
          </button>
        </div>
      )}

      <div className="generated-times" aria-label="作成される時刻">
        {generatedTimes.map((time) => <span key={time}>{time}</span>)}
      </div>

      <div className="time-pattern-actions">
        <button
          className="button danger"
          type="button"
          disabled={selectedDateCount === 0}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" size={16} />
          時間を削除
        </button>
        <button
          className="button primary"
          type="button"
          disabled={selectedDateCount === 0 || generatedTimes.length === 0}
          onClick={onApply}
        >
          選択日に時間を設定
        </button>
      </div>
    </section>
  );
}
