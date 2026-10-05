"use client";

import {
  Download,
  Upload,
} from "lucide-react";
import { useRef } from "react";

import { serializeSchedulerSettings } from "../settings/schedulerSettingsFile";
import {
  EMPTY_SONG_ID,
  type SchedulerConfig,
  type ScoreTable,
} from "../types";
import { AssignmentRequestSettings } from "./AssignmentRequestSettings";
import { CommonSettings } from "./CommonSettings";
import { SongRuleSettings } from "./SongRuleSettings";

export type SchedulerSettingsTab = "common" | "songs" | "requests";

type SchedulerSettingsPanelProps = {
  scoreTable: ScoreTable;
  config: SchedulerConfig;
  minBalanceDifference: number;
  maxBalanceDifference: number;
  activeTab: SchedulerSettingsTab;
  disabled: boolean;
  onConfigChange: (config: SchedulerConfig) => void;
  onDifferenceRangeChange: (minimum: number, maximum: number) => void;
  onSettingsFileLoad: (file: File) => void | Promise<void>;
};

export function SchedulerSettingsPanel({
  scoreTable,
  config,
  minBalanceDifference,
  maxBalanceDifference,
  activeTab,
  disabled,
  onConfigChange,
  onDifferenceRangeChange,
  onSettingsFileLoad,
}: SchedulerSettingsPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const fixedTargetTotal = config.songRules.reduce(
    (total, rule) => total + Math.max(0, rule.targetCount),
    0,
  );
  const forcedBlankCount = new Set(
    config.assignmentRequests
      .filter(
        (request) => request.fixed && request.songId === EMPTY_SONG_ID,
      )
      .map((request) => request.timeSlotId),
  ).size;
  const fillableSlotCount = scoreTable.timeSlots.length - forcedBlankCount;

  // 現在の設定を、人が確認できるJSONファイルとして保存する。
  const downloadSettings = () => {
    const text = serializeSchedulerSettings(
      scoreTable,
      config,
      minBalanceDifference,
      maxBalanceDifference,
    );
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "circle-scheduler-settings.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <section className="settings-section" aria-label="予定作成設定">
      <div className="section-heading-row settings-heading-row">
        <div className="settings-heading-actions">
          <span className="settings-song-count">{scoreTable.songs.length}曲</span>
          {config.countRuleMode === "fixedTarget" && (
            <span className="settings-song-count">
              固定回数合計 {fixedTargetTotal} / 使用可能 {fillableSlotCount}枠
            </span>
          )}
          <button
            className="button secondary settings-file-button"
            type="button"
            disabled={disabled}
            onClick={downloadSettings}
          >
            <Download aria-hidden="true" size={16} />
            設定保存
          </button>
          <button
            className="button secondary settings-file-button"
            type="button"
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
          >
            <Upload aria-hidden="true" size={16} />
            設定読込
          </button>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            disabled={disabled}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                await onSettingsFileLoad(file);
              }
            }}
          />
        </div>
      </div>

      {activeTab === "common" && (
        <CommonSettings
          config={config}
          minBalanceDifference={minBalanceDifference}
          maxBalanceDifference={maxBalanceDifference}
          disabled={disabled}
          onConfigChange={onConfigChange}
          onDifferenceRangeChange={onDifferenceRangeChange}
        />
      )}
      {activeTab === "songs" && (
        <SongRuleSettings
          songs={scoreTable.songs}
          config={config}
          disabled={disabled}
          onChange={onConfigChange}
        />
      )}
      {activeTab === "requests" && (
        <AssignmentRequestSettings
          scoreTable={scoreTable}
          config={config}
          disabled={disabled}
          onChange={onConfigChange}
        />
      )}
    </section>
  );
}
