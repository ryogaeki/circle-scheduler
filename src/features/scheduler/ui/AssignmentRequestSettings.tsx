"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  EMPTY_SONG_ID,
  FORBIDDEN_SCORE,
  type AssignmentRequest,
  type SchedulerConfig,
  type ScoreTable,
} from "../types";

type RequestKind = "fixedSong" | "preferredSong" | "fixedBlank";

type AssignmentRequestSettingsProps = {
  scoreTable: ScoreTable;
  config: SchedulerConfig;
  disabled: boolean;
  onChange: (config: SchedulerConfig) => void;
};

function requestKind(request: AssignmentRequest): string {
  if (request.fixed && request.songId === EMPTY_SONG_ID) {
    return "強制空白";
  }
  return request.fixed ? "確定枠" : "希望枠";
}

export function AssignmentRequestSettings({
  scoreTable,
  config,
  disabled,
  onChange,
}: AssignmentRequestSettingsProps) {
  const [kind, setKind] = useState<RequestKind>("fixedSong");
  const [timeSlotId, setTimeSlotId] = useState(scoreTable.timeSlots[0]?.id ?? 0);
  const [songId, setSongId] = useState(scoreTable.songs[0]?.id ?? 0);
  const [priority, setPriority] = useState(20);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!scoreTable.timeSlots.some((slot) => slot.id === timeSlotId)) {
      setTimeSlotId(scoreTable.timeSlots[0]?.id ?? 0);
    }
    if (!scoreTable.songs.some((song) => song.id === songId)) {
      setSongId(scoreTable.songs[0]?.id ?? 0);
    }
  }, [scoreTable, songId, timeSlotId]);

  const dateGroups = new Map<string, typeof scoreTable.timeSlots>();
  for (const timeSlot of scoreTable.timeSlots) {
    const slots = dateGroups.get(timeSlot.dateKey) ?? [];
    slots.push(timeSlot);
    dateGroups.set(timeSlot.dateKey, slots);
  }

  const addRequest = () => {
    setFormError(null);
    const request: AssignmentRequest = {
      timeSlotId,
      songId: kind === "fixedBlank" ? EMPTY_SONG_ID : songId,
      priority: kind === "preferredSong" ? Math.max(0, priority) : 100,
      fixed: kind !== "preferredSong",
    };

    const fixedAtSameSlot = config.assignmentRequests.find(
      (item) => item.fixed && item.timeSlotId === request.timeSlotId,
    );
    const preferredAtSameSlot = config.assignmentRequests.some(
      (item) => !item.fixed && item.timeSlotId === request.timeSlotId,
    );
    if (
      request.fixed &&
      fixedAtSameSlot &&
      fixedAtSameSlot.songId !== request.songId
    ) {
      setFormError("この時間枠には別の確定枠または強制空白があります。");
      return;
    }
    if ((!request.fixed && fixedAtSameSlot) || (request.fixed && preferredAtSameSlot)) {
      setFormError("同じ時間枠の確定枠と希望枠は同時に登録できません。");
      return;
    }
    if (
      config.assignmentRequests.some(
        (item) =>
          item.timeSlotId === request.timeSlotId &&
          item.songId === request.songId &&
          item.fixed === request.fixed,
      )
    ) {
      setFormError("同じ割り当て要求がすでにあります。");
      return;
    }
    if (
      request.songId !== EMPTY_SONG_ID &&
      request.fixed &&
      scoreTable.slotSongScores[request.timeSlotId][request.songId] ===
        FORBIDDEN_SCORE
    ) {
      setFormError("×を絶対不可にしている枠には曲を確定できません。");
      return;
    }

    onChange({
      ...config,
      assignmentRequests: [...config.assignmentRequests, request],
    });
  };

  const removeRequest = (requestIndex: number) => {
    onChange({
      ...config,
      assignmentRequests: config.assignmentRequests.filter(
        (_, index) => index !== requestIndex,
      ),
    });
  };

  return (
    <div className="settings-pane request-settings-pane">
      <div className="request-form">
        <div className="setting-field setting-field-wide">
          <span className="setting-label">種類</span>
          <div className="segmented-control request-kind-control">
            <button
              className={kind === "fixedSong" ? "is-active" : ""}
              type="button"
              disabled={disabled}
              onClick={() => setKind("fixedSong")}
            >
              確定枠
            </button>
            <button
              className={kind === "preferredSong" ? "is-active" : ""}
              type="button"
              disabled={disabled}
              onClick={() => setKind("preferredSong")}
            >
              希望枠
            </button>
            <button
              className={kind === "fixedBlank" ? "is-active danger-active" : ""}
              type="button"
              disabled={disabled}
              onClick={() => setKind("fixedBlank")}
            >
              強制空白
            </button>
          </div>
        </div>

        <label className="setting-field request-slot-field">
          <span className="setting-label">時間枠</span>
          <select
            value={timeSlotId}
            disabled={disabled}
            onChange={(event) => setTimeSlotId(Number(event.target.value))}
          >
            {[...dateGroups].map(([dateKey, timeSlots]) => (
              <optgroup key={dateKey} label={dateKey}>
                {timeSlots.map((timeSlot) => (
                  <option key={timeSlot.id} value={timeSlot.id}>
                    {timeSlot.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {kind !== "fixedBlank" && (
          <label className="setting-field">
            <span className="setting-label">曲</span>
            <select
              value={songId}
              disabled={disabled}
              onChange={(event) => setSongId(Number(event.target.value))}
            >
              {scoreTable.songs.map((song) => (
                <option key={song.id} value={song.id}>
                  {song.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {kind === "preferredSong" && (
          <label className="setting-field">
            <span className="setting-label">希望点</span>
            <input
              type="number"
              min={0}
              max={100000}
              value={priority}
              disabled={disabled}
              onChange={(event) =>
                setPriority(
                  Number.isFinite(event.target.valueAsNumber)
                    ? Math.round(Math.max(0, event.target.valueAsNumber))
                    : 0,
                )
              }
            />
          </label>
        )}

        <button
          className="button primary add-request-button"
          type="button"
          disabled={disabled}
          onClick={addRequest}
        >
          <Plus aria-hidden="true" size={17} />
          追加
        </button>
      </div>

      {formError && (
        <div className="request-form-error" role="alert">
          {formError}
        </div>
      )}

      <div className="request-list">
        <div className="request-list-header">
          <strong>登録済み</strong>
          <span>{config.assignmentRequests.length}件</span>
        </div>
        {config.assignmentRequests.length === 0 ? (
          <div className="request-empty">設定なし</div>
        ) : (
          <div className="request-table-scroll">
            <table className="request-table">
              <thead>
                <tr>
                  <th scope="col">種類</th>
                  <th scope="col">時間枠</th>
                  <th scope="col">曲</th>
                  <th scope="col">希望点</th>
                  <th scope="col"><span className="visually-hidden">削除</span></th>
                </tr>
              </thead>
              <tbody>
                {config.assignmentRequests.map((request, index) => (
                  <tr key={`${request.timeSlotId}-${request.songId}-${request.fixed}-${index}`}>
                    <td>
                      <span className={`request-type ${request.fixed ? "is-fixed" : "is-preferred"}`}>
                        {requestKind(request)}
                      </span>
                    </td>
                    <td>{scoreTable.timeSlots[request.timeSlotId]?.label ?? "不明"}</td>
                    <td>
                      {request.songId === EMPTY_SONG_ID
                        ? "空白"
                        : scoreTable.songs[request.songId]?.name ?? "不明"}
                    </td>
                    <td>{request.fixed ? "−" : request.priority}</td>
                    <td>
                      <button
                        className="icon-button danger-icon"
                        type="button"
                        title="割り当て要求を削除"
                        aria-label={`${requestKind(request)}を削除`}
                        disabled={disabled}
                        onClick={() => removeRequest(index)}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
