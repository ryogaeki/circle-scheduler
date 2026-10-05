"use client";

import {
  ArrowRightLeft,
  CalendarDays,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import {
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";

import { previewSwap } from "../edit/previewSwap";
import { evaluateAssignment } from "../score/evaluateAssignment";
import { createFixedSlotFlags } from "../solver/solverHelpers";
import {
  AVAILABLE_SCORE,
  EMPTY_SONG_ID,
  MAYBE_SCORE,
  type Assignment,
  type AssignmentRequest,
  type CountRuleMode,
  type PreviewSwapResult,
  type ScheduleCandidate,
  type SchedulerConfig,
  type ScoreTable,
  type TimeSlot,
} from "../types";
import {
  CalendarRequestEditor,
  type CalendarRequestTarget,
} from "./CalendarRequestEditor";
import {
  finalDisplayScore,
  formatDecimalScore,
  timeTieBreakDisplayScore,
} from "./scoreDisplay";
import { SwapPreviewPanel } from "./SwapPreviewPanel";

type ScheduleCalendarProps = {
  candidate: ScheduleCandidate | null;
  compact?: boolean;
  countRuleMode: CountRuleMode;
  draftAssignment: Assignment | null;
  maxDifference: number;
  scoreTable: ScoreTable;
  config: SchedulerConfig;
  canRedo: boolean;
  canUndo: boolean;
  requestTarget?: CalendarRequestTarget | null;
  showRequestEditor?: boolean;
  onConfigChange: (config: SchedulerConfig) => void;
  onCompactChange?: (compact: boolean) => void;
  onDraftAssignmentChange: (assignment: Assignment) => void;
  onRequestTargetChange?: (target: CalendarRequestTarget | null) => void;
  onRedo: () => void;
  onUndo: () => void;
};

type ScheduledDay = {
  dateKey: string;
  month: number;
  day: number;
  weekdayIndex: number;
  timeSlots: TimeSlot[];
};

type CalendarMonth = {
  month: number;
  firstWeekdayIndex: number;
  days: ScheduledDay[];
};

type PendingSwap = {
  firstTimeSlotId: number;
  secondTimeSlotId: number;
  preview: PreviewSwapResult;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function parseDateKey(dateKey: string) {
  const match = dateKey.match(/^(\d{1,2})\/(\d{1,2})（([日月火水木金土])）$/);
  if (!match) {
    return null;
  }
  return {
    month: Number(match[1]),
    day: Number(match[2]),
    weekdayIndex: WEEKDAYS.indexOf(match[3]),
  };
}

// 時間枠を日付、月の順にまとめ、月初の曜日を日付ラベルから逆算する。
function buildCalendarMonths(timeSlots: TimeSlot[]): {
  months: CalendarMonth[];
  unparsedDays: { dateKey: string; timeSlots: TimeSlot[] }[];
} {
  const slotsByDate = new Map<string, TimeSlot[]>();
  for (const timeSlot of timeSlots) {
    const slots = slotsByDate.get(timeSlot.dateKey) ?? [];
    slots.push(timeSlot);
    slotsByDate.set(timeSlot.dateKey, slots);
  }

  const months: CalendarMonth[] = [];
  const monthByNumber = new Map<number, CalendarMonth>();
  const unparsedDays: { dateKey: string; timeSlots: TimeSlot[] }[] = [];

  for (const [dateKey, slots] of slotsByDate) {
    const date = parseDateKey(dateKey);
    if (!date) {
      unparsedDays.push({ dateKey, timeSlots: slots });
      continue;
    }

    let month = monthByNumber.get(date.month);
    if (!month) {
      const firstWeekdayIndex =
        (date.weekdayIndex - ((date.day - 1) % 7) + 7) % 7;
      month = { month: date.month, firstWeekdayIndex, days: [] };
      monthByNumber.set(date.month, month);
      months.push(month);
    }
    month.days.push({ dateKey, ...date, timeSlots: slots });
  }

  return { months, unparsedDays };
}

function timeText(timeSlot: TimeSlot): string {
  const withoutDate = timeSlot.label.startsWith(timeSlot.dateKey)
    ? timeSlot.label.slice(timeSlot.dateKey.length)
    : timeSlot.label;
  return withoutDate.trim();
}

function availabilityMark(score: number): {
  symbol: string;
  className: string;
} {
  if (score >= AVAILABLE_SCORE) {
    return { symbol: "◯", className: "available" };
  }
  if (score === MAYBE_SCORE) {
    return { symbol: "△", className: "maybe" };
  }
  return { symbol: "×", className: "unavailable" };
}

// 同じ枠の希望をすべて残し、確定・希望点の順で表示しやすくする。
function buildPreviewRequests(
  requests: AssignmentRequest[],
): Map<number, AssignmentRequest[]> {
  const requestByTimeSlot = new Map<number, AssignmentRequest[]>();
  for (const request of requests) {
    const slotRequests = requestByTimeSlot.get(request.timeSlotId) ?? [];
    slotRequests.push(request);
    slotRequests.sort(
      (left, right) =>
        Number(right.fixed) - Number(left.fixed) ||
        right.priority - left.priority,
    );
    requestByTimeSlot.set(request.timeSlotId, slotRequests);
  }
  return requestByTimeSlot;
}

// 候補作成前は、登録済みの確定枠と希望枠だけを仮の予定として並べる。
function createPreviewAssignment(
  scoreTable: ScoreTable,
  requestByTimeSlot: Map<number, AssignmentRequest[]>,
): Assignment {
  const assignedSongIds = Array<number>(scoreTable.timeSlots.length).fill(
    EMPTY_SONG_ID,
  );
  for (const [timeSlotId, requests] of requestByTimeSlot) {
    if (timeSlotId >= 0 && timeSlotId < assignedSongIds.length) {
      assignedSongIds[timeSlotId] = requests[0]?.songId ?? EMPTY_SONG_ID;
    }
  }
  return { assignedSongIds };
}

function targetStatus(
  sourceTimeSlotId: number,
  targetTimeSlotId: number,
  swapPreview: PreviewSwapResult,
): { text: string; className: string } {
  if (sourceTimeSlotId === targetTimeSlotId) {
    return { text: "選択中", className: "is-source" };
  }
  if (swapPreview.violationCodes.includes("sameAssignment")) {
    return { text: "同じ曲", className: "is-blocked" };
  }
  if (
    swapPreview.violationCodes.includes("firstSlotFixed") ||
    swapPreview.violationCodes.includes("secondSlotFixed")
  ) {
    return { text: "確定枠", className: "is-blocked" };
  }
  if (!swapPreview.allowed) {
    return { text: "条件違反", className: "is-blocked" };
  }
  const displayDifference =
    swapPreview.scoreDifference.totalScore +
    timeTieBreakDisplayScore(
      swapPreview.scoreDifference.timeTieBreakScore,
    );
  return {
    text: `${formatDecimalScore(displayDifference, true)}点`,
    className: "is-allowed",
  };
}

function CalendarSlot({
  assignment,
  editorSelected,
  fixed,
  highlightedSongId,
  previewRequests,
  readOnly,
  scoreTable,
  selectedTimeSlotId,
  swapPreview,
  timeSlot,
  onClick,
  onDragStart,
  onDrop,
}: {
  assignment: Assignment;
  editorSelected: boolean;
  fixed: boolean;
  highlightedSongId: number;
  previewRequests: AssignmentRequest[];
  readOnly: boolean;
  scoreTable: ScoreTable;
  selectedTimeSlotId: number | null;
  swapPreview: PreviewSwapResult | null;
  timeSlot: TimeSlot;
  onClick: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  const fixedRequest = previewRequests.find((request) => request.fixed) ?? null;
  const preferredRequests = previewRequests.filter((request) => !request.fixed);
  const songId = assignment.assignedSongIds[timeSlot.id];
  const isBlank = songId === EMPTY_SONG_ID;
  const isForcedBlank =
    readOnly && fixedRequest?.songId === EMPTY_SONG_ID;
  const isUnspecified = readOnly && previewRequests.length === 0;
  const isPreferred = readOnly && !fixedRequest && preferredRequests.length > 0;
  const baseMark = isBlank
    ? { symbol: "−", className: "blank" }
    : availabilityMark(scoreTable.slotSongScores[timeSlot.id][songId]);
  const mark =
    isPreferred && preferredRequests.length > 1
      ? { symbol: String(preferredRequests.length), className: "preferred" }
      : baseMark;
  const primarySongName = isBlank
    ? "空白"
    : scoreTable.songs[songId]?.name ?? "不明";
  const songName = isUnspecified
    ? "未設定"
    : isForcedBlank
      ? "強制空白"
      : isPreferred && preferredRequests.length > 1
        ? `${primarySongName} ほか${preferredRequests.length - 1}曲`
        : primarySongName;
  const preferredTitle = preferredRequests
    .map((request) => {
      const name = scoreTable.songs[request.songId]?.name ?? "不明";
      return `${name}（${request.priority}点）`;
    })
    .join("、");
  const status =
    selectedTimeSlotId !== null && swapPreview
      ? targetStatus(selectedTimeSlotId, timeSlot.id, swapPreview)
      : null;
  const selected = selectedTimeSlotId === timeSlot.id;
  const className = [
    "calendar-slot",
    `is-${mark.className}`,
    isUnspecified && "is-unset",
    readOnly && fixedRequest && "is-request-fixed",
    isPreferred && "is-request-preferred",
    highlightedSongId !== EMPTY_SONG_ID &&
      songId === highlightedSongId &&
      "is-same-song-highlighted",
    editorSelected && "is-request-editor-selected",
    selected && "is-swap-source",
    status?.className === "is-allowed" && "is-swap-allowed",
    status?.className === "is-blocked" && "is-swap-blocked",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={className}
      type="button"
      draggable={!readOnly && !fixed}
      aria-pressed={readOnly ? editorSelected : selected}
      title={
        isPreferred
          ? `希望枠: ${timeSlot.label} ${preferredTitle}`
          : isForcedBlank
            ? `強制空白: ${timeSlot.label}`
            : fixed
              ? `確定枠: ${timeSlot.label} ${songName}`
              : `${timeSlot.label} ${songName}`
      }
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <span className="slot-time">{timeText(timeSlot)}</span>
      <span className="slot-mark" aria-label={mark.symbol}>
        {mark.symbol}
      </span>
      <span className="slot-song">{songName}</span>
      {fixed && (
        <LockKeyhole className="slot-lock" aria-label="確定枠" size={13} />
      )}
      {isPreferred && (
        <span className="slot-request-kind">
          希望{preferredRequests.length > 1 ? preferredRequests.length : ""}
        </span>
      )}
      {status && (
        <span className={`swap-target-status ${status.className}`}>
          {status.text}
        </span>
      )}
    </button>
  );
}

function ScheduledDayCell({
  assignment,
  day,
  daySelected,
  fixedSlots,
  highlightedSongId,
  previewRequests,
  readOnly,
  scoreTable,
  selectedRequestTimeSlotId,
  selectedTimeSlotId,
  swapPreviews,
  onDayClick,
  onSlotClick,
  onSlotDragStart,
  onSlotDrop,
}: {
  assignment: Assignment;
  day: ScheduledDay;
  daySelected: boolean;
  fixedSlots: boolean[];
  highlightedSongId: number;
  previewRequests: Map<number, AssignmentRequest[]>;
  readOnly: boolean;
  scoreTable: ScoreTable;
  selectedRequestTimeSlotId: number | null;
  selectedTimeSlotId: number | null;
  swapPreviews: Map<number, PreviewSwapResult>;
  onDayClick: (day: ScheduledDay) => void;
  onSlotClick: (timeSlotId: number) => void;
  onSlotDragStart: (
    event: DragEvent<HTMLButtonElement>,
    timeSlotId: number,
  ) => void;
  onSlotDrop: (
    event: DragEvent<HTMLButtonElement>,
    timeSlotId: number,
  ) => void;
}) {
  return (
    <div
      className={`calendar-day has-schedule ${readOnly ? "is-request-selectable" : ""} ${daySelected ? "is-request-editor-selected" : ""}`}
      onClick={() => onDayClick(day)}
    >
      <button
        className="calendar-day-heading"
        type="button"
        disabled={!readOnly}
        onClick={(event) => {
          event.stopPropagation();
          onDayClick(day);
        }}
      >
        <strong>{day.day}</strong>
        <span>{WEEKDAYS[day.weekdayIndex]}</span>
      </button>
      <div className="calendar-slots">
        {day.timeSlots.map((timeSlot) => (
          <CalendarSlot
            assignment={assignment}
            editorSelected={selectedRequestTimeSlotId === timeSlot.id}
            fixed={fixedSlots[timeSlot.id]}
            highlightedSongId={highlightedSongId}
            key={timeSlot.id}
            previewRequests={previewRequests.get(timeSlot.id) ?? []}
            readOnly={readOnly}
            scoreTable={scoreTable}
            selectedTimeSlotId={selectedTimeSlotId}
            swapPreview={swapPreviews.get(timeSlot.id) ?? null}
            timeSlot={timeSlot}
            onClick={() => onSlotClick(timeSlot.id)}
            onDragStart={(event) => onSlotDragStart(event, timeSlot.id)}
            onDrop={(event) => onSlotDrop(event, timeSlot.id)}
          />
        ))}
      </div>
    </div>
  );
}

function sameAssignment(left: Assignment, right: Assignment): boolean {
  return (
    left.assignedSongIds.length === right.assignedSongIds.length &&
    left.assignedSongIds.every(
      (songId, timeSlotId) => songId === right.assignedSongIds[timeSlotId],
    )
  );
}

export function ScheduleCalendar({
  candidate,
  compact: controlledCompact,
  countRuleMode,
  draftAssignment,
  maxDifference,
  scoreTable,
  config,
  canRedo,
  canUndo,
  requestTarget: controlledRequestTarget,
  showRequestEditor = true,
  onConfigChange,
  onCompactChange,
  onDraftAssignmentChange,
  onRequestTargetChange,
  onRedo,
  onUndo,
}: ScheduleCalendarProps) {
  const [internalCompact, setInternalCompact] = useState(false);
  const compact = controlledCompact ?? internalCompact;
  const changeCompact = (nextCompact: boolean) => {
    setInternalCompact(nextCompact);
    onCompactChange?.(nextCompact);
  };
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<number | null>(
    null,
  );
  const [pendingSwap, setPendingSwap] = useState<PendingSwap | null>(null);
  const [internalRequestTarget, setInternalRequestTarget] =
    useState<CalendarRequestTarget | null>(null);
  const requestTarget =
    controlledRequestTarget === undefined
      ? internalRequestTarget
      : controlledRequestTarget;
  const changeRequestTarget = (target: CalendarRequestTarget | null) => {
    setInternalRequestTarget(target);
    onRequestTargetChange?.(target);
  };
  const { months, unparsedDays } = useMemo(
    () => buildCalendarMonths(scoreTable.timeSlots),
    [scoreTable.timeSlots],
  );
  const usedWeekdays = useMemo(() => {
    const used = Array<boolean>(WEEKDAYS.length).fill(false);
    for (const month of months) {
      for (const day of month.days) {
        used[day.weekdayIndex] = true;
      }
    }
    return used;
  }, [months]);
  // コンパクト表示では、CSV全体で未使用の曜日を使用曜日の約3分の1にする。
  const calendarColumns = compact
    ? usedWeekdays
        .map((used) => (used ? "minmax(0, 3fr)" : "minmax(22px, 1fr)"))
        .join(" ")
    : "repeat(7, minmax(0, 1fr))";
  const fixedSlots = useMemo(
    () => createFixedSlotFlags(scoreTable, config),
    [scoreTable, config],
  );
  const previewRequests = useMemo(
    () => buildPreviewRequests(config.assignmentRequests),
    [config.assignmentRequests],
  );
  const readOnly = candidate === null;
  const displayedAssignment = useMemo(
    () =>
      draftAssignment ?? createPreviewAssignment(scoreTable, previewRequests),
    [draftAssignment, previewRequests, scoreTable],
  );
  const currentEvaluation = useMemo(
    () =>
      candidate
        ? evaluateAssignment({
            scoreTable,
            assignment: displayedAssignment,
            config,
          })
        : null,
    [candidate, scoreTable, displayedAssignment, config],
  );
  const modified = candidate
    ? !sameAssignment(candidate.assignment, displayedAssignment)
    : false;

  // 交換元を選んだ時点で全枠を仮採点し、各枠に点数差を表示する。
  const swapPreviews = useMemo(() => {
    const previews = new Map<number, PreviewSwapResult>();
    if (readOnly || selectedTimeSlotId === null) {
      return previews;
    }
    for (const timeSlot of scoreTable.timeSlots) {
      previews.set(
        timeSlot.id,
        previewSwap({
          scoreTable,
          assignment: displayedAssignment,
          config,
          firstTimeSlotId: selectedTimeSlotId,
          secondTimeSlotId: timeSlot.id,
        }),
      );
    }
    return previews;
  }, [readOnly, selectedTimeSlotId, scoreTable, displayedAssignment, config]);

  const openPreview = (firstTimeSlotId: number, secondTimeSlotId: number) => {
    setSelectedTimeSlotId(firstTimeSlotId);
    setPendingSwap({
      firstTimeSlotId,
      secondTimeSlotId,
      preview: previewSwap({
        scoreTable,
        assignment: displayedAssignment,
        config,
        firstTimeSlotId,
        secondTimeSlotId,
      }),
    });
  };

  const handleSlotClick = (timeSlotId: number) => {
    if (readOnly) {
      const timeSlot = scoreTable.timeSlots[timeSlotId];
      changeRequestTarget({
        scope: "slot",
        label: timeSlot.label,
        timeSlotIds: [timeSlotId],
      });
      return;
    }
    setPendingSwap(null);
    if (selectedTimeSlotId === null) {
      setSelectedTimeSlotId(timeSlotId);
    } else if (selectedTimeSlotId === timeSlotId) {
      setSelectedTimeSlotId(null);
    } else {
      const preview = previewSwap({
        scoreTable,
        assignment: displayedAssignment,
        config,
        firstTimeSlotId: selectedTimeSlotId,
        secondTimeSlotId: timeSlotId,
      });
      if (preview.allowed) {
        // 1回目のクリックで点数差を表示済みなので、2回目で交換を反映する。
        onDraftAssignmentChange(preview.assignment);
        setSelectedTimeSlotId(null);
        setPendingSwap(null);
      } else {
        setPendingSwap({
          firstTimeSlotId: selectedTimeSlotId,
          secondTimeSlotId: timeSlotId,
          preview,
        });
      }
    }
  };

  const handleDayClick = (day: ScheduledDay) => {
    if (!readOnly) {
      return;
    }
    changeRequestTarget({
      scope: "day",
      label: day.dateKey,
      timeSlotIds: day.timeSlots.map((timeSlot) => timeSlot.id),
    });
  };

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    timeSlotId: number,
  ) => {
    if (readOnly) {
      return;
    }
    event.dataTransfer.setData("text/plain", String(timeSlotId));
    event.dataTransfer.effectAllowed = "move";
    setPendingSwap(null);
    setSelectedTimeSlotId(timeSlotId);
  };

  const handleDrop = (
    event: DragEvent<HTMLButtonElement>,
    secondTimeSlotId: number,
  ) => {
    if (readOnly) {
      return;
    }
    event.preventDefault();
    const firstTimeSlotId = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(firstTimeSlotId)) {
      return;
    }
    openPreview(firstTimeSlotId, secondTimeSlotId);
  };

  const applyPendingSwap = () => {
    if (!pendingSwap?.preview.allowed) {
      return;
    }
    onDraftAssignmentChange(pendingSwap.preview.assignment);
    setPendingSwap(null);
    setSelectedTimeSlotId(null);
  };

  const resetDraft = () => {
    if (!candidate) {
      return;
    }
    onDraftAssignmentChange({
      assignedSongIds: [...candidate.assignment.assignedSongIds],
    });
    setPendingSwap(null);
    setSelectedTimeSlotId(null);
  };

  const undoDraft = () => {
    onUndo();
    setPendingSwap(null);
    setSelectedTimeSlotId(null);
  };

  const redoDraft = () => {
    onRedo();
    setPendingSwap(null);
    setSelectedTimeSlotId(null);
  };

  const selectedSlot =
    selectedTimeSlotId === null
      ? null
      : scoreTable.timeSlots[selectedTimeSlotId];
  const highlightedSongId =
    selectedTimeSlotId === null
      ? EMPTY_SONG_ID
      : displayedAssignment.assignedSongIds[selectedTimeSlotId];
  const selectedRequestTimeSlotId =
    requestTarget?.scope === "slot" ? requestTarget.timeSlotIds[0] : null;
  const selectedRequestDateKey =
    requestTarget?.scope === "day" ? requestTarget.label : null;
  const fixedRequestCount = config.assignmentRequests.filter(
    (request) => request.fixed && request.songId !== EMPTY_SONG_ID,
  ).length;
  const preferredRequestCount = config.assignmentRequests.filter(
    (request) => !request.fixed,
  ).length;
  const forcedBlankCount = config.assignmentRequests.filter(
    (request) => request.fixed && request.songId === EMPTY_SONG_ID,
  ).length;
  const dayCellProps = {
    assignment: displayedAssignment,
    fixedSlots,
    highlightedSongId,
    previewRequests,
    readOnly,
    scoreTable,
    selectedRequestTimeSlotId,
    selectedTimeSlotId,
    swapPreviews,
    onDayClick: handleDayClick,
    onSlotClick: handleSlotClick,
    onSlotDragStart: handleDragStart,
    onSlotDrop: handleDrop,
  };

  return (
    <section
      className={`calendar-section ${compact ? "is-compact" : ""}`}
      aria-labelledby="calendar-heading"
    >
      <div className="section-heading-row calendar-heading-row">
        <div>
          <p className="section-kicker">SCHEDULE</p>
          <h2 id="calendar-heading">予定カレンダー</h2>
        </div>
        <div className="calendar-heading-actions">
          <div className="result-summary">
            {candidate && currentEvaluation ? (
              <>
                <span>候補 #{candidate.id}</span>
                <span>
                  {countRuleMode === "fixedTarget"
                    ? "回数固定"
                    : `曲数差 ${maxDifference}`}
                </span>
                <span>
                  最終点{" "}
                  {formatDecimalScore(
                    finalDisplayScore(currentEvaluation.score),
                  )}
                </span>
                {modified && (
                  <span className="is-edited">
                    元候補から{" "}
                    {formatDecimalScore(
                      finalDisplayScore(currentEvaluation.score) -
                        finalDisplayScore(candidate.score),
                      true,
                    )}
                  </span>
                )}
              </>
            ) : (
              <>
                <span>設定プレビュー</span>
                <span>確定 {fixedRequestCount}</span>
                <span>希望 {preferredRequestCount}</span>
                {forcedBlankCount > 0 && (
                  <span>強制空白 {forcedBlankCount}</span>
                )}
              </>
            )}
          </div>
          <div
            className="segmented-control compact calendar-density-control"
            aria-label="カレンダーの表示密度"
          >
            <button
              className={!compact ? "is-active" : ""}
              type="button"
              title="標準表示"
              aria-pressed={!compact}
              onClick={() => changeCompact(false)}
            >
              <Maximize2 aria-hidden="true" size={14} />
              標準
            </button>
            <button
              className={compact ? "is-active" : ""}
              type="button"
              title="コンパクト表示"
              aria-pressed={compact}
              onClick={() => changeCompact(true)}
            >
              <Minimize2 aria-hidden="true" size={14} />
              コンパクト
            </button>
          </div>
        </div>
      </div>

      {candidate && (
        <div className="calendar-edit-toolbar">
          <div className="calendar-edit-state">
            <ArrowRightLeft aria-hidden="true" size={17} />
            <strong>{selectedSlot ? "交換先を選択" : "交換元を選択"}</strong>
            {selectedSlot && <span>{selectedSlot.label}</span>}
          </div>
          <div className="calendar-history-actions">
            <button
              className="icon-button history-button"
              type="button"
              title="元に戻す"
              aria-label="元に戻す"
              disabled={!canUndo}
              onClick={undoDraft}
            >
              <Undo2 aria-hidden="true" size={18} />
            </button>
            <button
              className="icon-button history-button"
              type="button"
              title="やり直す"
              aria-label="やり直す"
              disabled={!canRedo}
              onClick={redoDraft}
            >
              <Redo2 aria-hidden="true" size={18} />
            </button>
            <button
              className="button secondary calendar-reset-button"
              type="button"
              disabled={!modified}
              onClick={resetDraft}
            >
              <RotateCcw aria-hidden="true" size={16} />
              元候補に戻す
            </button>
          </div>
        </div>
      )}

      {pendingSwap && (
        <SwapPreviewPanel
          firstTimeSlotId={pendingSwap.firstTimeSlotId}
          secondTimeSlotId={pendingSwap.secondTimeSlotId}
          preview={pendingSwap.preview}
          scoreTable={scoreTable}
          onApply={applyPendingSwap}
          onCancel={() => setPendingSwap(null)}
        />
      )}

      <div
        className={`calendar-content-layout ${readOnly && showRequestEditor ? "has-request-editor" : ""}`}
      >
        <div className="calendar-main">
          {months.map((month) => {
            const maxSlotCount = Math.max(
              1,
              ...month.days.map((day) => day.timeSlots.length),
            );
            const dayByNumber = new Map(
              month.days.map((day) => [day.day, day]),
            );
            const weekIndexes = month.days.map((day) =>
              Math.floor((month.firstWeekdayIndex + day.day - 1) / 7),
            );
            const firstWeek = Math.min(...weekIndexes);
            const lastWeek = Math.max(...weekIndexes);
            const cells = Array.from(
              { length: (lastWeek - firstWeek + 1) * 7 },
              (_, index) => {
                const absoluteIndex = firstWeek * 7 + index;
                const dayNumber = absoluteIndex - month.firstWeekdayIndex + 1;
                return { dayNumber, day: dayByNumber.get(dayNumber) };
              },
            );
            return (
              <div className="calendar-month" key={month.month}>
                <h3>{month.month}月</h3>
                <div className="calendar-scroll">
                  <div
                    className="calendar-grid"
                    style={
                      {
                        "--calendar-max-slots": maxSlotCount,
                        gridTemplateColumns: calendarColumns,
                      } as CSSProperties
                    }
                  >
                    {WEEKDAYS.map((weekday, index) => (
                      <div
                        className={`calendar-weekday weekday-${index}${compact && !usedWeekdays[index] ? " is-unused" : ""}`}
                        key={weekday}
                      >
                        {weekday}
                      </div>
                    ))}
                    {cells.map(({ dayNumber, day }, index) =>
                      day ? (
                        <ScheduledDayCell
                          {...dayCellProps}
                          day={day}
                          daySelected={selectedRequestDateKey === day.dateKey}
                          key={day.dateKey}
                        />
                      ) : (
                        <div
                          className="calendar-day"
                          key={`${month.month}-${index}`}
                        >
                          {dayNumber > 0 && dayNumber <= 31 && (
                            <span className="empty-day-number">
                              {dayNumber}
                            </span>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {unparsedDays.length > 0 && (
            <div className="calendar-fallback">
              {unparsedDays.map((day) => (
                <div
                  className={`calendar-day has-schedule ${readOnly ? "is-request-selectable" : ""} ${selectedRequestDateKey === day.dateKey ? "is-request-editor-selected" : ""}`}
                  key={day.dateKey}
                  onClick={() =>
                    readOnly &&
                    changeRequestTarget({
                      scope: "day",
                      label: day.dateKey,
                      timeSlotIds: day.timeSlots.map((timeSlot) => timeSlot.id),
                    })
                  }
                >
                  <button
                    className="calendar-day-heading"
                    type="button"
                    disabled={!readOnly}
                  >
                    <strong>{day.dateKey}</strong>
                  </button>
                  <div className="calendar-slots">
                    {day.timeSlots.map((timeSlot) => (
                      <CalendarSlot
                        assignment={displayedAssignment}
                        editorSelected={
                          selectedRequestTimeSlotId === timeSlot.id
                        }
                        fixed={fixedSlots[timeSlot.id]}
                        highlightedSongId={highlightedSongId}
                        key={timeSlot.id}
                        previewRequests={
                          previewRequests.get(timeSlot.id) ?? []
                        }
                        readOnly={readOnly}
                        scoreTable={scoreTable}
                        selectedTimeSlotId={selectedTimeSlotId}
                        swapPreview={swapPreviews.get(timeSlot.id) ?? null}
                        timeSlot={timeSlot}
                        onClick={() => handleSlotClick(timeSlot.id)}
                        onDragStart={(event) =>
                          handleDragStart(event, timeSlot.id)
                        }
                        onDrop={(event) => handleDrop(event, timeSlot.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="calendar-legend" aria-label="予定記号">
            <CalendarDays aria-hidden="true" size={16} />
            <span className="legend-available">◯ 参加可能</span>
            <span className="legend-maybe">△ 次点</span>
            <span className="legend-unavailable">× 参加不可</span>
            <span>− 空白</span>
            <span className="legend-fixed">
              <LockKeyhole aria-hidden="true" size={13} /> 確定枠
            </span>
            <span className="legend-preferred">
              <span className="legend-request-swatch" aria-hidden="true" />
              希望枠
            </span>
            {highlightedSongId !== EMPTY_SONG_ID && (
              <span className="legend-highlighted">
                <span className="legend-highlight-swatch" aria-hidden="true" />
                選択中と同じ曲
              </span>
            )}
          </div>
        </div>

        {readOnly && showRequestEditor && (
          <CalendarRequestEditor
            config={config}
            scoreTable={scoreTable}
            target={requestTarget}
            onChange={onConfigChange}
            onClose={() => changeRequestTarget(null)}
          />
        )}
      </div>
    </section>
  );
}
