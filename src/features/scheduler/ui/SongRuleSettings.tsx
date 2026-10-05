"use client";

import { Copy, Music2 } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  ConstraintPolicy,
  SchedulerConfig,
  Song,
  SongRuleConfig,
  TimePreference,
  UnavailablePolicy,
} from "../types";

type SongRuleSettingsProps = {
  songs: Song[];
  config: SchedulerConfig;
  disabled: boolean;
  onChange: (config: SchedulerConfig) => void;
};

type NumberRuleKey = {
  [Key in keyof SongRuleConfig]: SongRuleConfig[Key] extends number ? Key : never;
}[keyof SongRuleConfig];

function numericValue(
  value: number,
  minimum: number,
  maximum: number,
  decimalPlaces: number,
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  const multiplier = 10 ** decimalPlaces;
  const clamped = Math.min(maximum, Math.max(minimum, value));
  return Math.round(clamped * multiplier) / multiplier;
}

function PolicyButtons({
  value,
  disabled,
  onChange,
}: {
  value: ConstraintPolicy;
  disabled: boolean;
  onChange: (value: ConstraintPolicy) => void;
}) {
  return (
    <div className="segmented-control compact">
      <button
        className={value === "allowWithPenalty" ? "is-active" : ""}
        type="button"
        disabled={disabled}
        onClick={() => onChange("allowWithPenalty")}
      >
        減点
      </button>
      <button
        className={value === "forbidden" ? "is-active danger-active" : ""}
        type="button"
        disabled={disabled}
        onClick={() => onChange("forbidden")}
      >
        絶対不可
      </button>
    </div>
  );
}

export function SongRuleSettings({
  songs,
  config,
  disabled,
  onChange,
}: SongRuleSettingsProps) {
  const [selectedSongId, setSelectedSongId] = useState(songs[0]?.id ?? 0);

  useEffect(() => {
    if (!songs.some((song) => song.id === selectedSongId)) {
      setSelectedSongId(songs[0]?.id ?? 0);
    }
  }, [selectedSongId, songs]);

  const rule = config.songRules.find((item) => item.songId === selectedSongId);
  if (!rule) {
    return null;
  }

  const updateRule = (patch: Partial<SongRuleConfig>) => {
    onChange({
      ...config,
      songRules: config.songRules.map((item) =>
        item.songId === selectedSongId ? { ...item, ...patch } : item,
      ),
    });
  };

  const updateNumber = (
    key: NumberRuleKey,
    value: number,
    minimum = 0,
    maximum = 100000,
    decimalPlaces = 0,
  ) => {
    updateRule({
      [key]: numericValue(value, minimum, maximum, decimalPlaces),
    });
  };

  // 回数は曲固有のまま残し、制約と採点設定だけを全曲へ複製する。
  const copyScoringRulesToAllSongs = () => {
    const {
      songId: _songId,
      targetCount: _targetCount,
      minCount: _minCount,
      maxCount: _maxCount,
      ...sharedRules
    } = rule;
    onChange({
      ...config,
      songRules: config.songRules.map((item) => ({ ...item, ...sharedRules })),
    });
  };

  return (
    <div className="settings-pane song-settings-pane">
      <div className="song-setting-toolbar">
        <label className="setting-field song-selector">
          <span className="setting-label">編集する曲</span>
          <select
            value={selectedSongId}
            disabled={disabled}
            onChange={(event) => setSelectedSongId(Number(event.target.value))}
          >
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary copy-rule-button"
          type="button"
          disabled={disabled}
          onClick={copyScoringRulesToAllSongs}
        >
          <Copy aria-hidden="true" size={16} />
          制約・採点を全曲へコピー
        </button>
      </div>

      <div className="selected-song-heading">
        <Music2 aria-hidden="true" size={18} />
        <strong>{songs.find((song) => song.id === selectedSongId)?.name}</strong>
      </div>

      <div className="song-rule-groups">
        <section className="setting-group" aria-labelledby="count-settings-heading">
          <h3 id="count-settings-heading">回数</h3>
          <div className="settings-grid">
            <label className="setting-field">
              <span className="setting-label">固定回数（-1で自動）</span>
              <input
                type="number"
                min={-1}
                max={1000}
                value={rule.targetCount}
                disabled={disabled}
                onChange={(event) =>
                  updateNumber("targetCount", event.target.valueAsNumber, -1, 1000)
                }
              />
            </label>
            <label className="setting-field">
              <span className="setting-label">最低回数</span>
              <input
                type="number"
                min={0}
                max={1000}
                value={rule.minCount}
                disabled={disabled}
                onChange={(event) =>
                  updateNumber("minCount", event.target.valueAsNumber, 0, 1000)
                }
              />
            </label>
            <label className="setting-field">
              <span className="setting-label">最大回数（-1で無制限）</span>
              <input
                type="number"
                min={-1}
                max={1000}
                value={rule.maxCount}
                disabled={disabled}
                onChange={(event) =>
                  updateNumber("maxCount", event.target.valueAsNumber, -1, 1000)
                }
              />
            </label>
          </div>
        </section>

        <section className="setting-group" aria-labelledby="unavailable-settings-heading">
          <h3 id="unavailable-settings-heading">×の扱い</h3>
          <div className="settings-grid">
            <div className="setting-field setting-field-wide">
              <span className="setting-label">方針</span>
              <div className="segmented-control compact">
                <button
                  className={rule.unavailablePolicy === "allowWithPenalty" ? "is-active" : ""}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    updateRule({ unavailablePolicy: "allowWithPenalty" as UnavailablePolicy })
                  }
                >
                  減点して許可
                </button>
                <button
                  className={rule.unavailablePolicy === "forbidden" ? "is-active danger-active" : ""}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    updateRule({ unavailablePolicy: "forbidden" as UnavailablePolicy })
                  }
                >
                  絶対不可
                </button>
              </div>
            </div>
            <label className="setting-field">
              <span className="setting-label">×の点数</span>
              <input
                type="number"
                min={-100000}
                max={-1}
                value={rule.unavailablePenalty}
                disabled={disabled || rule.unavailablePolicy === "forbidden"}
                onChange={(event) =>
                  updateNumber(
                    "unavailablePenalty",
                    event.target.valueAsNumber,
                    -100000,
                    -1,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="setting-group" aria-labelledby="day-settings-heading">
          <h3 id="day-settings-heading">同じ日の制限</h3>
          <div className="constraint-list">
            <div className="constraint-row">
              <label className="setting-field">
                <span className="setting-label">1日の最大回数</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rule.maxPerDay}
                  disabled={disabled}
                  onChange={(event) =>
                    updateNumber("maxPerDay", event.target.valueAsNumber, 1, 20)
                  }
                />
              </label>
              <PolicyButtons
                value={rule.maxPerDayPolicy}
                disabled={disabled}
                onChange={(value) => updateRule({ maxPerDayPolicy: value })}
              />
              <label className="setting-field penalty-field">
                <span className="setting-label">減点</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={rule.maxPerDayPenalty}
                  disabled={disabled || rule.maxPerDayPolicy === "forbidden"}
                  onChange={(event) =>
                    updateNumber("maxPerDayPenalty", event.target.valueAsNumber)
                  }
                />
              </label>
            </div>

            <div className="constraint-row">
              <span className="constraint-name">同日で連続</span>
              <PolicyButtons
                value={rule.sameDayConsecutivePolicy}
                disabled={disabled}
                onChange={(value) => updateRule({ sameDayConsecutivePolicy: value })}
              />
              <label className="setting-field penalty-field">
                <span className="setting-label">減点</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={rule.sameDayConsecutivePenalty}
                  disabled={disabled || rule.sameDayConsecutivePolicy === "forbidden"}
                  onChange={(event) =>
                    updateNumber("sameDayConsecutivePenalty", event.target.valueAsNumber)
                  }
                />
              </label>
            </div>

            <div className="constraint-row">
              <span className="constraint-name">同日で非連続</span>
              <PolicyButtons
                value={rule.sameDayNonConsecutivePolicy}
                disabled={disabled}
                onChange={(value) => updateRule({ sameDayNonConsecutivePolicy: value })}
              />
              <label className="setting-field penalty-field">
                <span className="setting-label">減点</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={rule.sameDayNonConsecutivePenalty}
                  disabled={disabled || rule.sameDayNonConsecutivePolicy === "forbidden"}
                  onChange={(event) =>
                    updateNumber("sameDayNonConsecutivePenalty", event.target.valueAsNumber)
                  }
                />
              </label>
            </div>
          </div>
        </section>

        <section className="setting-group" aria-labelledby="distribution-settings-heading">
          <h3 id="distribution-settings-heading">日付・時間帯</h3>
          <div className="settings-grid">
            <label className="setting-field">
              <span className="setting-label">日付間隔の減点</span>
              <input
                type="number"
                min={0}
                max={100000}
                step={0.1}
                value={rule.daySpacingPenalty}
                disabled={disabled}
                onChange={(event) =>
                  updateNumber(
                    "daySpacingPenalty",
                    event.target.valueAsNumber,
                    0,
                    100000,
                    1,
                  )
                }
              />
            </label>
            <label className="setting-field">
              <span className="setting-label">時間帯偏りの微小点</span>
              <input
                type="number"
                min={0}
                max={100000}
                value={rule.timeBalancePenalty}
                disabled={disabled}
                onChange={(event) =>
                  updateNumber("timeBalancePenalty", event.target.valueAsNumber)
                }
              />
            </label>
            <div className="setting-field setting-field-wide">
              <span className="setting-label">時間帯希望</span>
              <div className="segmented-control compact">
                {(
                  [
                    ["none", "指定なし"],
                    ["preferEarly", "早め"],
                    ["preferLate", "遅め"],
                  ] as [TimePreference, string][]
                ).map(([value, label]) => (
                  <button
                    className={rule.timePreference === value ? "is-active" : ""}
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => updateRule({ timePreference: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="setting-field">
              <span className="setting-label">時間帯希望の微小点</span>
              <input
                type="number"
                min={0}
                max={100000}
                value={rule.timePreferencePenalty}
                disabled={disabled || rule.timePreference === "none"}
                onChange={(event) =>
                  updateNumber("timePreferencePenalty", event.target.valueAsNumber)
                }
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
