"use client";

import { Settings2 } from "lucide-react";

import type { SchedulerConfig } from "../types";

type CommonSettingsProps = {
  config: SchedulerConfig;
  minBalanceDifference: number;
  maxBalanceDifference: number;
  disabled: boolean;
  onConfigChange: (config: SchedulerConfig) => void;
  onDifferenceRangeChange: (minimum: number, maximum: number) => void;
};

function boundedNumber(
  value: number,
  minimum: number,
  maximum: number,
  integer = true,
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  const bounded = Math.min(maximum, Math.max(minimum, value));
  return integer ? Math.round(bounded) : bounded;
}

export function CommonSettings({
  config,
  minBalanceDifference,
  maxBalanceDifference,
  disabled,
  onConfigChange,
  onDifferenceRangeChange,
}: CommonSettingsProps) {
  const updateConfig = <Key extends keyof SchedulerConfig>(
    key: Key,
    value: SchedulerConfig[Key],
  ) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="settings-pane">
      <div className="settings-grid">
        <div className="setting-field setting-field-wide">
          <span className="setting-label">曲数の決め方</span>
          <div className="segmented-control">
            <button
              className={config.countRuleMode === "balance" ? "is-active" : ""}
              type="button"
              disabled={disabled}
              onClick={() => updateConfig("countRuleMode", "balance")}
            >
              バランス
            </button>
            <button
              className={config.countRuleMode === "fixedTarget" ? "is-active" : ""}
              type="button"
              disabled={disabled}
              onClick={() => updateConfig("countRuleMode", "fixedTarget")}
            >
              回数固定
            </button>
          </div>
        </div>

        {config.countRuleMode === "balance" && (
          <>
            <label className="setting-field">
              <span className="setting-label">曲数差 最小</span>
              <input
                type="number"
                min={0}
                max={20}
                value={minBalanceDifference}
                disabled={disabled}
                onChange={(event) => {
                  const minimum = boundedNumber(event.target.valueAsNumber, 0, 20);
                  onDifferenceRangeChange(
                    minimum,
                    Math.max(minimum, maxBalanceDifference),
                  );
                }}
              />
            </label>
            <label className="setting-field">
              <span className="setting-label">曲数差 最大</span>
              <input
                type="number"
                min={0}
                max={20}
                value={maxBalanceDifference}
                disabled={disabled}
                onChange={(event) => {
                  const maximum = boundedNumber(event.target.valueAsNumber, 0, 20);
                  onDifferenceRangeChange(
                    Math.min(minBalanceDifference, maximum),
                    maximum,
                  );
                }}
              />
            </label>
          </>
        )}

        <label className="setting-field">
          <span className="setting-label">保存候補数</span>
          <input
            type="number"
            min={1}
            max={50}
            value={config.candidateLimit}
            disabled={disabled}
            onChange={(event) =>
              updateConfig(
                "candidateLimit",
                boundedNumber(event.target.valueAsNumber, 1, 50),
              )
            }
          />
        </label>

      </div>

      <details className="advanced-settings">
        <summary>
          <Settings2 aria-hidden="true" size={16} />
          探索詳細
        </summary>
        <div className="settings-grid advanced-settings-grid">
          <label className="setting-field">
            <span className="setting-label">初期案の試行回数</span>
            <input
              type="number"
              min={1}
              max={5000}
              value={config.trialCount}
              disabled={disabled}
              onChange={(event) =>
                updateConfig(
                  "trialCount",
                  boundedNumber(event.target.valueAsNumber, 1, 5000),
                )
              }
            />
          </label>
          <label className="setting-field">
            <span className="setting-label">焼きなまし反復回数</span>
            <input
              type="number"
              min={1}
              max={200000}
              step={100}
              value={config.annealingIterations}
              disabled={disabled}
              onChange={(event) =>
                updateConfig(
                  "annealingIterations",
                  boundedNumber(event.target.valueAsNumber, 1, 200000),
                )
              }
            />
          </label>
          <label className="toggle-field setting-field-wide">
            <input
              type="checkbox"
              checked={config.enableSongChangeNeighbor}
              disabled={disabled || config.countRuleMode === "fixedTarget"}
              onChange={(event) =>
                updateConfig("enableSongChangeNeighbor", event.target.checked)
              }
            />
            <span>焼きなましで曲数を変更する</span>
          </label>
          <label className="setting-field">
            <span className="setting-label">乱数seed</span>
            <input
              type="number"
              min={0}
              max={2147483647}
              value={config.randomSeed}
              disabled={disabled}
              onChange={(event) =>
                updateConfig(
                  "randomSeed",
                  boundedNumber(event.target.valueAsNumber, 0, 2147483647),
                )
              }
            />
          </label>
          <label className="setting-field">
            <span className="setting-label">開始温度</span>
            <input
              type="number"
              min={0.001}
              max={1000}
              step={0.1}
              value={config.startTemperature}
              disabled={disabled}
              onChange={(event) =>
                updateConfig(
                  "startTemperature",
                  boundedNumber(event.target.valueAsNumber, 0.001, 1000, false),
                )
              }
            />
          </label>
          <label className="setting-field">
            <span className="setting-label">終了温度</span>
            <input
              type="number"
              min={0.001}
              max={1000}
              step={0.01}
              value={config.endTemperature}
              disabled={disabled}
              onChange={(event) =>
                updateConfig(
                  "endTemperature",
                  boundedNumber(event.target.valueAsNumber, 0.001, 1000, false),
                )
              }
            />
          </label>
        </div>
      </details>
    </div>
  );
}
