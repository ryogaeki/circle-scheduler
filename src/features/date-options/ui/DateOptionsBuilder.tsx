"use client";

import {
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { publicPath } from "../../../lib/publicPath";
import {
  WEEKDAY_LABELS,
  createDateRange,
  createTimes,
  formatDateOptions,
  moveMonth,
  type CalendarDate,
  type DateTimeOptions,
  type YearMonth,
} from "../dateOptions";
import { DateOptionsOutput } from "./DateOptionsOutput";
import { ChouseisanGuideDialog } from "./ChouseisanGuideDialog";
import { MonthCalendar } from "./MonthCalendar";
import {
  TimePatternPanel,
  type TimeInputMode,
} from "./TimePatternPanel";

type SelectionMode = "single" | "range";

function currentYearMonth(): YearMonth {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

export function DateOptionsBuilder() {
  const router = useRouter();
  const [firstMonth, setFirstMonth] = useState<YearMonth>(currentYearMonth);
  const [selectionMode, setSelectionMode] =
    useState<SelectionMode>("single");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [enabledWeekdays, setEnabledWeekdays] = useState<Set<number>>(
    new Set([1, 3, 5]),
  );
  const [startTime, setStartTime] = useState("18:00");
  const [intervalMinutes, setIntervalMinutes] = useState(45);
  const [slotCount, setSlotCount] = useState(4);
  const [timeInputMode, setTimeInputMode] =
    useState<TimeInputMode>("interval");
  const [manualTimes, setManualTimes] = useState([""]);
  const [dateOptions, setDateOptions] = useState<DateTimeOptions>({});
  const [notice, setNotice] = useState("");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const secondMonth = moveMonth(firstMonth, 1);
  const generatedTimes = useMemo(() => {
    if (timeInputMode === "manual") {
      return [...new Set(manualTimes.filter(Boolean))].sort();
    }
    try {
      return createTimes(startTime, intervalMinutes, slotCount);
    } catch {
      return [];
    }
  }, [intervalMinutes, manualTimes, slotCount, startTime, timeInputMode]);
  const outputText = useMemo(() => formatDateOptions(dateOptions), [dateOptions]);
  const totalSlotCount = Object.values(dateOptions).reduce(
    (total, times) => total + times.length,
    0,
  );

  const handleDateClick = (date: CalendarDate) => {
    setNotice("");
    if (selectionMode === "single") {
      setSelectedDates((current) => {
        const next = new Set(current);
        if (next.has(date.key)) next.delete(date.key);
        else next.add(date.key);
        return next;
      });
      return;
    }

    if (!rangeStart) {
      setRangeStart(date.key);
      setSelectedDates(new Set([date.key]));
      return;
    }
    setSelectedDates(
      new Set(createDateRange(rangeStart, date.key, enabledWeekdays)),
    );
    setRangeStart(null);
  };

  const changeSelectionMode = (mode: SelectionMode) => {
    setSelectionMode(mode);
    setRangeStart(null);
    setSelectedDates(new Set());
  };

  const toggleWeekday = (weekday: number) => {
    setEnabledWeekdays((current) => {
      const next = new Set(current);
      if (next.has(weekday)) next.delete(weekday);
      else next.add(weekday);
      return next;
    });
  };

  const applyTimes = () => {
    if (selectedDates.size === 0 || generatedTimes.length === 0) return;
    setDateOptions((current) => {
      const next = { ...current };
      for (const key of selectedDates) next[key] = [...generatedTimes];
      return next;
    });
    setNotice(`${selectedDates.size}日へ時間を設定しました。`);
    setSelectedDates(new Set());
    setRangeStart(null);
  };

  const removeSelectedDates = () => {
    setDateOptions((current) => {
      const next = { ...current };
      for (const key of selectedDates) delete next[key];
      return next;
    });
    setSelectedDates(new Set());
    setRangeStart(null);
    setNotice("選択した日付の時間を削除しました。");
  };

  const copyOutput = async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setNotice("日程文をコピーしました。");
  };

  const downloadOutput = () => {
    if (!outputText) return;
    const url = URL.createObjectURL(
      new Blob([outputText], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "chouseisan-dates.txt";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("テキストファイルを保存しました。");
  };

  return (
    <div className="app-shell date-options-shell">
      <header className="app-header">
        <div className="header-inner">
          <button
            className="brand-home-button"
            type="button"
            title="スタート画面へ戻る"
            onClick={() => router.push("/")}
          >
            <Image
              className="brand-logo"
              src={publicPath("/burusaa-logo.png")}
              alt=""
              width={48}
              height={40}
              priority
            />
            <span className="brand-copy">
              <strong>ぶるさぁ。専用予定調査アプリ</strong>
              <small>調整さん日程文作成</small>
            </span>
          </button>
          <div className="header-actions">
            <div className="header-menu">
              <button
                className="header-menu-button"
                type="button"
                title="メニューを開く"
                aria-label="メニューを開く"
                aria-expanded={headerMenuOpen}
                onClick={() => setHeaderMenuOpen((open) => !open)}
              >
                <Menu aria-hidden="true" size={20} />
              </button>
              {headerMenuOpen && (
                <div className="header-menu-popover" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setGuideOpen(true);
                    }}
                  >
                    <BookOpenText aria-hidden="true" size={17} />
                    調整さんへの入力方法
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="date-options-main">
        <header className="date-options-title">
          <CalendarDays aria-hidden="true" size={24} />
          <div>
            <p className="section-kicker">DATE OPTIONS</p>
            <h1>調整さんの日程文作成</h1>
          </div>
        </header>

        <div className="date-options-layout">
          <div className="date-options-editor">
            <section className="date-selection-toolbar" aria-label="日付選択">
              <div className="segmented-control compact">
                <button
                  className={selectionMode === "single" ? "is-active" : ""}
                  type="button"
                  onClick={() => changeSelectionMode("single")}
                >
                  個別選択
                </button>
                <button
                  className={selectionMode === "range" ? "is-active" : ""}
                  type="button"
                  onClick={() => changeSelectionMode("range")}
                >
                  範囲選択
                </button>
              </div>

              {selectionMode === "range" && (
                <div className="weekday-filter" aria-label="範囲に含める曜日">
                  {WEEKDAY_LABELS.map((weekday, index) => (
                    <button
                      className={enabledWeekdays.has(index) ? "is-active" : ""}
                      type="button"
                      key={weekday}
                      aria-pressed={enabledWeekdays.has(index)}
                      onClick={() => toggleWeekday(index)}
                    >
                      {weekday}
                    </button>
                  ))}
                </div>
              )}

              <div className="month-navigation">
                <button
                  className="icon-button"
                  type="button"
                  title="前の月"
                  onClick={() => setFirstMonth(moveMonth(firstMonth, -1))}
                >
                  <ChevronLeft aria-hidden="true" size={19} />
                </button>
                <input
                  type="month"
                  aria-label="表示する月"
                  value={`${firstMonth.year}-${String(firstMonth.month).padStart(2, "0")}`}
                  onChange={(event) => {
                    const [year, month] = event.target.value.split("-").map(Number);
                    if (year && month) setFirstMonth({ year, month });
                  }}
                />
                <button
                  className="button quiet"
                  type="button"
                  onClick={() => setFirstMonth(currentYearMonth())}
                >
                  今月
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title="次の月"
                  onClick={() => setFirstMonth(moveMonth(firstMonth, 1))}
                >
                  <ChevronRight aria-hidden="true" size={19} />
                </button>
              </div>
            </section>

            <div className="option-calendar-pair">
              <MonthCalendar
                value={firstMonth}
                configuredDates={dateOptions}
                rangeStart={rangeStart}
                selectedDates={selectedDates}
                onDateClick={handleDateClick}
              />
              <MonthCalendar
                value={secondMonth}
                configuredDates={dateOptions}
                rangeStart={rangeStart}
                selectedDates={selectedDates}
                onDateClick={handleDateClick}
              />
            </div>

            <TimePatternPanel
              generatedTimes={generatedTimes}
              intervalMinutes={intervalMinutes}
              manualTimes={manualTimes}
              selectedDateCount={selectedDates.size}
              slotCount={slotCount}
              startTime={startTime}
              timeInputMode={timeInputMode}
              onApply={applyTimes}
              onClearSelection={() => {
                setSelectedDates(new Set());
                setRangeStart(null);
              }}
              onIntervalChange={setIntervalMinutes}
              onManualTimesChange={setManualTimes}
              onRemove={removeSelectedDates}
              onSlotCountChange={setSlotCount}
              onStartTimeChange={setStartTime}
              onTimeInputModeChange={setTimeInputMode}
            />
          </div>

          <DateOptionsOutput
            dateCount={Object.keys(dateOptions).length}
            notice={notice}
            outputText={outputText}
            totalSlotCount={totalSlotCount}
            onClear={() => {
              setDateOptions({});
              setNotice("日程をすべて削除しました。");
            }}
            onCopy={() => void copyOutput()}
            onDownload={downloadOutput}
          />
        </div>
      </main>
      {guideOpen && (
        <ChouseisanGuideDialog
          dateText={outputText}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </div>
  );
}
