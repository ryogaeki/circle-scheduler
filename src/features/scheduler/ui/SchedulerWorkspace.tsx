"use client";

import {
  AlertCircle,
  BookOpenText,
  CalendarRange,
  CircleCheck,
  FileSpreadsheet,
  ListChecks,
  Menu,
  Music2,
  Play,
  SlidersHorizontal,
  Square,
  Upload,
  Waypoints,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
} from "react";

import { publicPath } from "../../../lib/publicPath";
import { parseSongCsv } from "../input/parseSongCsv";
import { buildScoreTableFromSongCsv } from "../input/buildScoreTableFromSongCsv";
import {
  createAssignmentHistory,
  pushAssignmentHistory,
  redoAssignmentHistory,
  undoAssignmentHistory,
  type AssignmentHistory,
} from "../edit/assignmentHistory";
import { parseSchedulerSettings } from "../settings/schedulerSettingsFile";
import type {
  BalanceComparisonResult,
  SchedulerConfig,
  SolveRequest,
  SongCsvData,
} from "../types";
import type { SolverWorkerProgress } from "../worker/messages";
import {
  startSolverWorker,
  type SolverWorkerRun,
} from "../worker/startSolverWorker";
import {
  clearPendingCsv,
  clearSchedulerSession,
  loadPendingCsv,
  loadSchedulerSession,
  saveSchedulerSession,
} from "../session/schedulerSessionStorage";
import { CandidateTable } from "./CandidateTable";
import { CandidateComparisonPanel } from "./CandidateComparisonPanel";
import {
  CalendarRequestEditor,
  type CalendarRequestTarget,
} from "./CalendarRequestEditor";
import { createWebSchedulerInput } from "./createWebSchedulerInput";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { ScoreGuideDialog } from "./ScoreGuideDialog";
import {
  SchedulerSettingsPanel,
  type SchedulerSettingsTab,
} from "./SchedulerSettingsPanel";
import { validateWebSchedulerInput } from "./validateWebSchedulerInput";

type LoadedCsv = SolveRequest & {
  fileName: string;
  csvText: string;
  csvData: SongCsvData;
};
type RunStatus = "empty" | "ready" | "running" | "done";
type RightPanel = SchedulerSettingsTab | "quick" | null;

export function SchedulerWorkspace() {
  const router = useRouter();
  const [loadedCsv, setLoadedCsv] = useState<LoadedCsv | null>(null);
  const [restored, setRestored] = useState(false);
  const [status, setStatus] = useState<RunStatus>("empty");
  const [progress, setProgress] = useState<SolverWorkerProgress | null>(null);
  const [comparison, setComparison] =
    useState<BalanceComparisonResult | null>(null);
  const [activeEntryIndex, setActiveEntryIndex] = useState(0);
  const [activeCandidateId, setActiveCandidateId] =
    useState<number | null>(null);
  const [comparisonCandidateId, setComparisonCandidateId] =
    useState<number | null>(null);
  const [draftHistory, setDraftHistory] =
    useState<AssignmentHistory | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [scoreGuideOpen, setScoreGuideOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [calendarCompact, setCalendarCompact] = useState(false);
  const [calendarRequestTarget, setCalendarRequestTarget] =
    useState<CalendarRequestTarget | null>(null);
  const activeRun = useRef<SolverWorkerRun | null>(null);
  const runVersion = useRef(0);

  // 新しいCSV、または前回保存した作業をブラウザから復元する。
  useEffect(() => {
    try {
      const pendingCsv = loadPendingCsv();
      if (pendingCsv) {
        const csvData = parseSongCsv(pendingCsv.csvText);
        const schedulerInput = createWebSchedulerInput(csvData);
        setLoadedCsv({
          ...schedulerInput,
          fileName: pendingCsv.fileName,
          csvText: pendingCsv.csvText,
          csvData,
        });
        setStatus("ready");
        setRestored(true);
        return;
      }

      const session = loadSchedulerSession();
      if (!session) {
        router.replace("/");
        return;
      }

      const csvData = parseSongCsv(session.csvText);
      const scoreTable = buildScoreTableFromSongCsv(csvData, session.config);
      const entryIndex = Math.min(
        Math.max(0, session.activeEntryIndex),
        Math.max(0, (session.comparison?.entries.length ?? 1) - 1),
      );
      const entry = session.comparison?.entries[entryIndex] ?? null;
      const savedCandidate = entry?.result.candidates.find(
        (candidate) => candidate.id === session.activeCandidateId,
      );
      const activeCandidate = savedCandidate ?? entry?.result.candidates[0] ?? null;
      const expectedSlotCount = scoreTable.timeSlots.length;
      const savedDraftIsValid =
        session.draftHistory?.present.assignedSongIds.length === expectedSlotCount;

      setLoadedCsv({
        fileName: session.fileName,
        csvText: session.csvText,
        csvData,
        scoreTable,
        config: session.config,
        minBalanceDifference: session.minBalanceDifference,
        maxBalanceDifference: session.maxBalanceDifference,
      });
      setComparison(session.comparison);
      setActiveEntryIndex(entryIndex);
      setActiveCandidateId(activeCandidate?.id ?? null);
      setDraftHistory(
        savedDraftIsValid
          ? session.draftHistory
          : activeCandidate
            ? createAssignmentHistory(activeCandidate.assignment)
            : null,
      );
      setStatus(session.comparison ? "done" : "ready");
      setRestored(true);
    } catch {
      clearSchedulerSession();
      router.replace("/");
    }
  }, [router]);

  useEffect(
    () => () => {
      activeRun.current?.cancel();
    },
    [],
  );

  useEffect(() => {
    const closePanels = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLeftPanelOpen(false);
        setRightPanel(null);
        setCalendarRequestTarget(null);
      }
    };
    window.addEventListener("keydown", closePanels);
    return () => window.removeEventListener("keydown", closePanels);
  }, []);

  // 計算中以外の作業状態を保存し、リロード後も続きから開けるようにする。
  useEffect(() => {
    if (!restored || !loadedCsv || status === "running") {
      return;
    }
    saveSchedulerSession({
      version: 1,
      savedAt: new Date().toISOString(),
      fileName: loadedCsv.fileName,
      csvText: loadedCsv.csvText,
      timeSlotCount: loadedCsv.scoreTable.timeSlots.length,
      songCount: loadedCsv.scoreTable.songs.length,
      config: loadedCsv.config,
      minBalanceDifference: loadedCsv.minBalanceDifference,
      maxBalanceDifference: loadedCsv.maxBalanceDifference,
      comparison,
      activeEntryIndex,
      activeCandidateId,
      draftHistory,
    });
    clearPendingCsv();
  }, [
    activeCandidateId,
    activeEntryIndex,
    comparison,
    draftHistory,
    loadedCsv,
    restored,
    status,
  ]);

  const cancelRunningSolver = () => {
    runVersion.current += 1;
    activeRun.current?.cancel();
    activeRun.current = null;
    setProgress(null);
    setStatus(loadedCsv ? "ready" : "empty");
  };

  const handleFileSelected = async (file: File) => {
    if (status === "running") {
      cancelRunningSolver();
    }
    setErrorMessage(null);
    setNoticeMessage(null);
    setComparison(null);
    setActiveCandidateId(null);
    setComparisonCandidateId(null);
    setDraftHistory(null);
    setProgress(null);
    setLeftPanelOpen(false);
    setRightPanel(null);
    setCalendarRequestTarget(null);

    try {
      const csvText = await file.text();
      const csvData = parseSongCsv(csvText);
      const schedulerInput = createWebSchedulerInput(csvData);
      setLoadedCsv({
        ...schedulerInput,
        fileName: file.name,
        csvText,
        csvData,
      });
      setStatus("ready");
    } catch (error) {
      setLoadedCsv(null);
      setStatus("empty");
      setErrorMessage(
        error instanceof Error ? error.message : "CSVを読み込めませんでした。",
      );
    }
  };

  const handleStart = async () => {
    if (!loadedCsv || status === "running") {
      return;
    }

    const validationError = validateWebSchedulerInput(loadedCsv);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    setComparison(null);
    setActiveCandidateId(null);
    setComparisonCandidateId(null);
    setDraftHistory(null);
    setProgress(null);
    setStatus("running");
    const version = runVersion.current + 1;
    runVersion.current = version;

    try {
      const run = startSolverWorker(
        {
          scoreTable: loadedCsv.scoreTable,
          config: loadedCsv.config,
          minBalanceDifference: loadedCsv.minBalanceDifference,
          maxBalanceDifference: loadedCsv.maxBalanceDifference,
        },
        (nextProgress) => {
          if (runVersion.current === version) {
            setProgress(nextProgress);
          }
        },
      );
      activeRun.current = run;
      const result = await run.result;
      if (runVersion.current !== version) {
        return;
      }
      setComparison(result);
      const selectedEntryIndex =
        result.selectedEntryIndex >= 0 ? result.selectedEntryIndex : 0;
      const firstCandidate =
        result.entries[selectedEntryIndex]?.result.candidates[0] ?? null;
      setActiveEntryIndex(selectedEntryIndex);
      setActiveCandidateId(firstCandidate?.id ?? null);
      setDraftHistory(
        firstCandidate
          ? createAssignmentHistory(firstCandidate.assignment)
          : null,
      );
      setStatus("done");
      setLeftPanelOpen(true);
      setRightPanel(null);
      activeRun.current = null;
    } catch (error) {
      if (runVersion.current !== version) {
        return;
      }
      setStatus("ready");
      setErrorMessage(
        error instanceof Error ? error.message : "予定候補を作れませんでした。",
      );
      activeRun.current = null;
    }
  };

  const progressPercent = progress
    ? Math.round(
        (progress.completedDifferenceCount /
          Math.max(1, progress.totalDifferenceCount)) *
          100,
      )
    : 0;

  const activeEntry = comparison?.entries[activeEntryIndex] ?? null;
  const activeCandidate =
    activeEntry?.result.candidates.find(
      (candidate) => candidate.id === activeCandidateId,
    ) ?? null;
  const comparisonCandidate =
    activeEntry?.result.candidates.find(
      (candidate) => candidate.id === comparisonCandidateId,
    ) ?? null;

  // 曲数差を切り替えたときは、その段階の最良候補を最初に表示する。
  const handleEntryChange = (entryIndex: number) => {
    const firstCandidate =
      comparison?.entries[entryIndex]?.result.candidates[0] ?? null;
    setActiveEntryIndex(entryIndex);
    setActiveCandidateId(firstCandidate?.id ?? null);
    setComparisonCandidateId(null);
    setDraftHistory(
      firstCandidate
        ? createAssignmentHistory(firstCandidate.assignment)
        : null,
    );
  };

  // 候補を選び直すたびに、元候補から独立した編集用コピーを作る。
  const handleCandidateChange = (candidateId: number) => {
    const candidate = activeEntry?.result.candidates.find(
      (item) => item.id === candidateId,
    );
    setActiveCandidateId(candidateId);
    setComparisonCandidateId(null);
    setDraftHistory(
      candidate ? createAssignmentHistory(candidate.assignment) : null,
    );
  };

  // 設定を変えたらCSV記号を再採点し、以前の候補を無効にする。
  const handleConfigChange = (config: SchedulerConfig) => {
    if (!loadedCsv) {
      return;
    }
    setLoadedCsv({
      ...loadedCsv,
      config,
      scoreTable: buildScoreTableFromSongCsv(loadedCsv.csvData, config),
    });
    setComparison(null);
    setActiveCandidateId(null);
    setComparisonCandidateId(null);
    setDraftHistory(null);
    setProgress(null);
    setErrorMessage(null);
    setNoticeMessage(null);
    setStatus("ready");
    setLeftPanelOpen(false);
  };

  const handleDifferenceRangeChange = (minimum: number, maximum: number) => {
    if (!loadedCsv) {
      return;
    }
    setLoadedCsv({
      ...loadedCsv,
      minBalanceDifference: minimum,
      maxBalanceDifference: maximum,
    });
    setComparison(null);
    setActiveCandidateId(null);
    setComparisonCandidateId(null);
    setDraftHistory(null);
    setProgress(null);
    setErrorMessage(null);
    setNoticeMessage(null);
    setStatus("ready");
    setLeftPanelOpen(false);
  };

  // JSON設定を現在のCSVへ対応付け、問題なければ候補を再計算待ちにする。
  const handleSettingsFileLoad = async (file: File) => {
    if (!loadedCsv) {
      return;
    }
    setErrorMessage(null);
    setNoticeMessage(null);
    try {
      const loadedSettings = parseSchedulerSettings(
        await file.text(),
        loadedCsv.scoreTable,
      );
      const scoreTable = buildScoreTableFromSongCsv(
        loadedCsv.csvData,
        loadedSettings.config,
      );
      const nextLoadedCsv: LoadedCsv = {
        ...loadedCsv,
        ...loadedSettings,
        scoreTable,
      };
      const validationError = validateWebSchedulerInput(nextLoadedCsv);
      if (validationError) {
        throw new Error(validationError);
      }
      setLoadedCsv(nextLoadedCsv);
      setComparison(null);
      setActiveCandidateId(null);
      setComparisonCandidateId(null);
      setDraftHistory(null);
      setProgress(null);
      setStatus("ready");
      setLeftPanelOpen(false);
      setNoticeMessage(`${file.name} の設定を読み込みました。`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "設定ファイルを読み込めませんでした。",
      );
    }
  };

  const handleDraftAssignmentChange = (
    assignment: AssignmentHistory["present"],
  ) => {
    setDraftHistory((history) =>
      history ? pushAssignmentHistory(history, assignment) : history,
    );
  };

  const handleReturnHome = () => {
    if (
      status === "running" &&
      !window.confirm("計算を中止してスタート画面へ戻りますか？")
    ) {
      return;
    }
    if (status === "running") {
      cancelRunningSolver();
    }
    router.push("/");
  };

  const handleWorkspaceFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (
      file &&
      window.confirm("現在の作業を終了して、別のCSVを開きますか？")
    ) {
      void handleFileSelected(file);
    }
    event.target.value = "";
  };

  const toggleCandidatePanel = () => {
    setLeftPanelOpen((open) => {
      if (!open) {
        setRightPanel(null);
      }
      return !open;
    });
  };

  const toggleRightPanel = (panel: Exclude<RightPanel, null>) => {
    setRightPanel((current) => (current === panel ? null : panel));
    setLeftPanelOpen(false);
  };

  const closeRightPanel = () => {
    if (rightPanel === "quick") {
      setCalendarRequestTarget(null);
    }
    setRightPanel(null);
  };

  // 日付・時間枠の選択時は、右側をクイック設定へ自動で切り替える。
  const handleRequestTargetChange = (
    target: CalendarRequestTarget | null,
  ) => {
    setCalendarRequestTarget(target);
    setRightPanel(target ? "quick" : null);
    if (target) {
      setLeftPanelOpen(false);
    }
  };

  const rightPanelTitle =
    rightPanel === "common"
      ? "共通設定"
      : rightPanel === "songs"
        ? "曲別設定"
        : rightPanel === "requests"
          ? "確定・希望枠"
          : rightPanel === "quick"
            ? "選択範囲の設定"
            : "";
  const candidateCount = activeEntry?.result.candidates.length ?? 0;

  // 数値欄は現在値を全選択し、0を残さず直接打ち替えられるようにする。
  const handleNumberInputFocus = (event: FocusEvent<HTMLElement>) => {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.type === "number"
    ) {
      event.target.select();
    }
  };

  // 0の直後へ数字が足される前に0を外し、03ではなく3として入力する。
  const handleNumberBeforeInput = (event: FormEvent<HTMLElement>) => {
    if (
      !(event.target instanceof HTMLInputElement) ||
      event.target.type !== "number" ||
      event.target.value !== "0"
    ) {
      return;
    }
    const inputText = (event.nativeEvent as InputEvent).data ?? "";
    if (/^-?\d/.test(inputText) || inputText === "-") {
      event.target.value = "";
    }
  };

  if (!restored || !loadedCsv) {
    return (
      <div className="workspace-loading" role="status">
        <Image
          src={publicPath("/burusaa-logo.png")}
          alt=""
          width={82}
          height={68}
          priority
        />
        <span>作業を読み込んでいます</span>
      </div>
    );
  }

  return (
    <div className="app-shell workspace-app-shell">
      <header className="app-header">
        <div className="header-inner">
          <button
            className="brand-home-button"
            type="button"
            title="スタート画面へ戻る"
            onClick={handleReturnHome}
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
              <small>練習予定作成</small>
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
                      setScoreGuideOpen(true);
                    }}
                  >
                    <BookOpenText aria-hidden="true" size={17} />
                    採点ルール・点数配分
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main
        className="workspace-frame"
        onBeforeInputCapture={handleNumberBeforeInput}
        onFocusCapture={handleNumberInputFocus}
      >
        <nav className="workspace-rail left-rail" aria-label="候補">
          <button
            className={`workspace-rail-button${leftPanelOpen ? " is-active" : ""}`}
            type="button"
            title="候補一覧"
            aria-label="候補一覧"
            aria-expanded={leftPanelOpen}
            onClick={toggleCandidatePanel}
          >
            <Waypoints aria-hidden="true" size={20} />
            <span>候補</span>
            {candidateCount > 0 && <b>{candidateCount}</b>}
          </button>
        </nav>

        {leftPanelOpen && (
          <aside className="workspace-drawer workspace-left-drawer">
            <div className="workspace-drawer-heading">
              <strong>候補</strong>
              <button
                className="icon-button"
                type="button"
                title="候補を閉じる"
                aria-label="候補を閉じる"
                onClick={() => setLeftPanelOpen(false)}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="workspace-drawer-scroll">
              {comparison ? (
                <>
                  <CandidateTable
                    comparison={comparison}
                    scoreTable={loadedCsv.scoreTable}
                    activeEntryIndex={activeEntryIndex}
                    activeCandidateId={activeCandidateId}
                    comparisonCandidateId={comparisonCandidateId}
                    countRuleMode={loadedCsv.config.countRuleMode}
                    onEntryChange={handleEntryChange}
                    onCandidateChange={handleCandidateChange}
                    onComparisonCandidateChange={setComparisonCandidateId}
                  />
                  {activeCandidate && comparisonCandidate && (
                    <CandidateComparisonPanel
                      firstCandidate={activeCandidate}
                      secondCandidate={comparisonCandidate}
                      scoreTable={loadedCsv.scoreTable}
                      onClose={() => setComparisonCandidateId(null)}
                      onSelectSecond={() =>
                        handleCandidateChange(comparisonCandidate.id)
                      }
                    />
                  )}
                </>
              ) : (
                <div className="workspace-drawer-empty">
                  <Waypoints aria-hidden="true" size={24} />
                  <strong>候補はまだありません</strong>
                  <span>中央上部の「候補を作成」から開始します。</span>
                </div>
              )}
            </div>
          </aside>
        )}

        <section className="calendar-stage" aria-label="予定カレンダー">
          <div className="calendar-stage-toolbar">
            <FileSpreadsheet aria-hidden="true" size={20} />
            <div className="stage-file-copy">
              <strong>{loadedCsv.fileName}</strong>
              <span>
                {loadedCsv.scoreTable.timeSlots.length}時間枠・
                {loadedCsv.scoreTable.songs.length}曲
              </span>
            </div>
            <label
              className={`icon-button stage-file-button${status === "running" ? " is-disabled" : ""}`}
              title="CSVを変更"
            >
              <Upload aria-hidden="true" size={17} />
              <input
                className="visually-hidden"
                type="file"
                accept=".csv,text/csv"
                disabled={status === "running"}
                onChange={handleWorkspaceFileInput}
              />
            </label>

            <div className="stage-run-state" aria-live="polite">
              {status === "running" ? (
                <>
                  <span className="activity-dot" />
                  <strong>計算中</strong>
                  <span>
                    {progress?.phase === "differenceCompleted"
                      ? loadedCsv.config.countRuleMode === "fixedTarget"
                        ? "回数固定"
                        : `曲数差 ${progress.currentDifference}`
                      : "準備中"}
                  </span>
                </>
              ) : comparison ? (
                <>
                  <span className="complete-dot" />
                  <strong>候補 #{activeCandidate?.id ?? "-"}</strong>
                  <span>
                    {loadedCsv.config.countRuleMode === "fixedTarget"
                      ? "回数固定"
                      : `曲数差 ${activeEntry?.maxDifference ?? "-"}`}
                  </span>
                </>
              ) : (
                <span>設定プレビュー</span>
              )}
            </div>

            {status === "running" ? (
              <button
                className="button danger stage-run-button"
                type="button"
                onClick={cancelRunningSolver}
              >
                <Square aria-hidden="true" size={16} />
                中止
              </button>
            ) : (
              <button
                className="button primary stage-run-button"
                type="button"
                onClick={handleStart}
              >
                <Play aria-hidden="true" size={17} />
                候補を作成
              </button>
            )}
          </div>

          {status === "running" && (
            <div
              className="progress-track stage-progress"
              aria-label={`計算進捗 ${progressPercent}%`}
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          )}

          {errorMessage && (
            <div className="inline-alert error stage-alert" role="alert">
              <AlertCircle aria-hidden="true" size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {noticeMessage && (
            <div className="inline-alert success stage-alert" role="status">
              <CircleCheck aria-hidden="true" size={18} />
              <span>{noticeMessage}</span>
            </div>
          )}

          <div className="calendar-stage-scroll">
            <ScheduleCalendar
              key={
                activeCandidate
                  ? `${activeEntryIndex}-${activeCandidate.id}`
                  : `preview-${loadedCsv.fileName}`
              }
              candidate={activeCandidate}
              compact={calendarCompact}
              config={loadedCsv.config}
              countRuleMode={loadedCsv.config.countRuleMode}
              draftAssignment={draftHistory?.present ?? null}
              maxDifference={
                activeEntry?.maxDifference ?? loadedCsv.config.balanceMaxDifference
              }
              requestTarget={calendarRequestTarget}
              scoreTable={loadedCsv.scoreTable}
              showRequestEditor={false}
              canRedo={(draftHistory?.future.length ?? 0) > 0}
              canUndo={(draftHistory?.past.length ?? 0) > 0}
              onConfigChange={handleConfigChange}
              onCompactChange={setCalendarCompact}
              onDraftAssignmentChange={handleDraftAssignmentChange}
              onRequestTargetChange={handleRequestTargetChange}
              onRedo={() =>
                setDraftHistory((history) =>
                  history ? redoAssignmentHistory(history) : history,
                )
              }
              onUndo={() =>
                setDraftHistory((history) =>
                  history ? undoAssignmentHistory(history) : history,
                )
              }
            />
          </div>
        </section>

        {rightPanel && (
          <aside className="workspace-drawer workspace-right-drawer">
            <div className="workspace-drawer-heading">
              <strong>{rightPanelTitle}</strong>
              <button
                className="icon-button"
                type="button"
                title="設定を閉じる"
                aria-label="設定を閉じる"
                onClick={closeRightPanel}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="workspace-drawer-scroll">
              {rightPanel !== "quick" ? (
                <SchedulerSettingsPanel
                  activeTab={rightPanel}
                  scoreTable={loadedCsv.scoreTable}
                  config={loadedCsv.config}
                  minBalanceDifference={loadedCsv.minBalanceDifference}
                  maxBalanceDifference={loadedCsv.maxBalanceDifference}
                  disabled={status === "running"}
                  onConfigChange={handleConfigChange}
                  onDifferenceRangeChange={handleDifferenceRangeChange}
                  onSettingsFileLoad={handleSettingsFileLoad}
                />
              ) : (
                <CalendarRequestEditor
                  config={loadedCsv.config}
                  scoreTable={loadedCsv.scoreTable}
                  target={calendarRequestTarget}
                  onChange={handleConfigChange}
                  onClose={closeRightPanel}
                />
              )}
            </div>
          </aside>
        )}

        <nav className="workspace-rail right-rail" aria-label="予定作成設定">
          <button
            className={`workspace-rail-button${rightPanel === "common" ? " is-active" : ""}`}
            type="button"
            title="共通設定"
            aria-label="共通設定"
            aria-pressed={rightPanel === "common"}
            onClick={() => toggleRightPanel("common")}
          >
            <SlidersHorizontal aria-hidden="true" size={20} />
            <span>共通</span>
          </button>
          <button
            className={`workspace-rail-button${rightPanel === "songs" ? " is-active" : ""}`}
            type="button"
            title="曲別設定"
            aria-label="曲別設定"
            aria-pressed={rightPanel === "songs"}
            onClick={() => toggleRightPanel("songs")}
          >
            <Music2 aria-hidden="true" size={20} />
            <span>曲別</span>
          </button>
          <button
            className={`workspace-rail-button${rightPanel === "requests" ? " is-active" : ""}`}
            type="button"
            title="確定・希望枠"
            aria-label="確定・希望枠"
            aria-pressed={rightPanel === "requests"}
            onClick={() => toggleRightPanel("requests")}
          >
            <ListChecks aria-hidden="true" size={20} />
            <span>割当</span>
            {loadedCsv.config.assignmentRequests.length > 0 && (
              <b>{loadedCsv.config.assignmentRequests.length}</b>
            )}
          </button>
          <button
            className={`workspace-rail-button${rightPanel === "quick" ? " is-active" : ""}`}
            type="button"
            title="選択範囲の設定"
            aria-label="選択範囲の設定"
            aria-pressed={rightPanel === "quick"}
            disabled={!calendarRequestTarget}
            onClick={() => toggleRightPanel("quick")}
          >
            <CalendarRange aria-hidden="true" size={20} />
            <span>選択</span>
          </button>
        </nav>
      </main>
      {scoreGuideOpen && (
        <ScoreGuideDialog onClose={() => setScoreGuideOpen(false)} />
      )}
    </div>
  );
}
