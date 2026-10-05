"use client";

import {
  CalendarRange,
  Clock3,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  EMPTY_SONG_ID,
  FORBIDDEN_SCORE,
  type AssignmentRequest,
  type SchedulerConfig,
  type ScoreTable,
} from "../types";

type RequestKind = "fixedSong" | "preferredSong" | "fixedBlank";

export type CalendarRequestTarget = {
  scope: "slot" | "day";
  label: string;
  timeSlotIds: number[];
};

type CalendarRequestEditorProps = {
  config: SchedulerConfig;
  scoreTable: ScoreTable;
  target: CalendarRequestTarget | null;
  onChange: (config: SchedulerConfig) => void;
  onClose: () => void;
};

function requestKind(request: AssignmentRequest): string {
  if (request.fixed && request.songId === EMPTY_SONG_ID) {
    return "強制空白";
  }
  return request.fixed ? "確定" : "希望";
}

export function CalendarRequestEditor({
  config,
  scoreTable,
  target,
  onChange,
  onClose,
}: CalendarRequestEditorProps) {
  const [kind, setKind] = useState<RequestKind>("preferredSong");
  const [songId, setSongId] = useState(scoreTable.songs[0]?.id ?? 0);
  const [priority, setPriority] = useState(20);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scoreTable.songs.some((song) => song.id === songId)) {
      setSongId(scoreTable.songs[0]?.id ?? 0);
    }
  }, [scoreTable.songs, songId]);

  useEffect(() => setError(null), [target]);

  const targetIds = useMemo(
    () => new Set(target?.timeSlotIds ?? []),
    [target],
  );
  const targetRequests = config.assignmentRequests
    .map((request, index) => ({ request, index }))
    .filter(({ request }) => targetIds.has(request.timeSlotId));

  const applyRequest = () => {
    if (!target || target.timeSlotIds.length === 0) {
      return;
    }
    setError(null);

    const fixed = kind !== "preferredSong";
    const nextSongId = kind === "fixedBlank" ? EMPTY_SONG_ID : songId;
    if (
      fixed &&
      nextSongId !== EMPTY_SONG_ID &&
      target.timeSlotIds.some(
        (timeSlotId) =>
          scoreTable.slotSongScores[timeSlotId][nextSongId] ===
          FORBIDDEN_SCORE,
      )
    ) {
      setError("×を絶対不可にしている時間枠には確定できません。");
      return;
    }

    if (
      !fixed &&
      config.assignmentRequests.some(
        (request) => request.fixed && targetIds.has(request.timeSlotId),
      )
    ) {
      setError("確定枠または強制空白を削除してから希望を追加してください。");
      return;
    }

    let requests = [...config.assignmentRequests];
    if (fixed) {
      // 確定と強制空白は、その枠にある希望を含めて置き換える。
      requests = requests.filter(
        (request) => !targetIds.has(request.timeSlotId),
      );
      for (const timeSlotId of target.timeSlotIds) {
        requests.push({
          timeSlotId,
          songId: nextSongId,
          priority: 100,
          fixed: true,
        });
      }
    } else {
      // 同じ曲の希望があれば点数を更新し、別の曲なら追加する。
      for (const timeSlotId of target.timeSlotIds) {
        const requestIndex = requests.findIndex(
          (request) =>
            !request.fixed &&
            request.timeSlotId === timeSlotId &&
            request.songId === nextSongId,
        );
        const request = {
          timeSlotId,
          songId: nextSongId,
          priority: Math.max(0, priority),
          fixed: false,
        };
        if (requestIndex >= 0) {
          requests[requestIndex] = request;
        } else {
          requests.push(request);
        }
      }
    }

    onChange({ ...config, assignmentRequests: requests });
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
    <aside
      className={`calendar-request-aside ${target ? "has-target" : ""}`}
      aria-label="選択範囲の割り当て設定"
    >
      <div className="calendar-request-heading">
        <div>
          <p className="section-kicker">QUICK SETTING</p>
          <h3>{target?.label ?? "未選択"}</h3>
        </div>
        {target && (
          <button
            className="icon-button"
            type="button"
            title="選択を解除"
            aria-label="選択を解除"
            onClick={onClose}
          >
            <X aria-hidden="true" size={17} />
          </button>
        )}
      </div>

      {!target ? (
        <div className="calendar-request-empty">
          <Clock3 aria-hidden="true" size={20} />
          <span>時間枠・日付 未選択</span>
        </div>
      ) : (
        <>
          <div className="calendar-request-scope">
            {target.scope === "day" ? (
              <CalendarRange aria-hidden="true" size={16} />
            ) : (
              <Clock3 aria-hidden="true" size={16} />
            )}
            <span>{target.timeSlotIds.length}枠</span>
          </div>

          <div className="calendar-request-form">
            <div className="setting-field setting-field-wide">
              <span className="setting-label">種類</span>
              <div className="segmented-control calendar-request-kind">
                <button
                  className={kind === "fixedSong" ? "is-active" : ""}
                  type="button"
                  onClick={() => setKind("fixedSong")}
                >
                  確定
                </button>
                <button
                  className={kind === "preferredSong" ? "is-active" : ""}
                  type="button"
                  onClick={() => setKind("preferredSong")}
                >
                  希望
                </button>
                <button
                  className={kind === "fixedBlank" ? "is-active danger-active" : ""}
                  type="button"
                  onClick={() => setKind("fixedBlank")}
                >
                  空白
                </button>
              </div>
            </div>

            {kind !== "fixedBlank" && (
              <label className="setting-field setting-field-wide">
                <span className="setting-label">曲</span>
                <select
                  value={songId}
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
              <label className="setting-field setting-field-wide">
                <span className="setting-label">希望点</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={priority}
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
              className="button primary calendar-request-apply"
              type="button"
              onClick={applyRequest}
            >
              <Plus aria-hidden="true" size={16} />
              {kind === "preferredSong" ? "追加・更新" : "設定"}
            </button>
          </div>

          {error && (
            <div className="calendar-request-error" role="alert">
              {error}
            </div>
          )}

          <div className="calendar-request-list">
            <div className="calendar-request-list-heading">
              <strong>現在の設定</strong>
              <span>{targetRequests.length}件</span>
            </div>
            {targetRequests.length === 0 ? (
              <div className="calendar-request-list-empty">設定なし</div>
            ) : (
              targetRequests.map(({ request, index }) => (
                <div
                  className="calendar-request-item"
                  key={`${request.timeSlotId}-${request.songId}-${request.fixed}-${index}`}
                >
                  <div>
                    <span>{requestKind(request)}</span>
                    <strong>
                      {request.songId === EMPTY_SONG_ID
                        ? "空白"
                        : scoreTable.songs[request.songId]?.name ?? "不明"}
                    </strong>
                    {target.scope === "day" && (
                      <small>
                        {scoreTable.timeSlots[request.timeSlotId]?.label ??
                          "不明な時間枠"}
                      </small>
                    )}
                    {!request.fixed && <small>希望点 {request.priority}</small>}
                  </div>
                  <button
                    className="icon-button danger-icon"
                    type="button"
                    title="設定を削除"
                    aria-label="設定を削除"
                    onClick={() => removeRequest(index)}
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}
