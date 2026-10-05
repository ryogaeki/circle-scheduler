"use client";

import {
  ArrowRight,
  CalendarDays,
  FileSpreadsheet,
  Play,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";

import { GitHubMark } from "../../../components/GitHubMark";
import { publicPath } from "../../../lib/publicPath";
import {
  EXAMPLE_SONG_CSV,
  EXAMPLE_SONG_CSV_FILE_NAME,
} from "../input/exampleSongCsv";
import { parseSongCsv } from "../input/parseSongCsv";
import {
  loadSchedulerSession,
  savePendingCsv,
  type StoredSchedulerSession,
} from "../session/schedulerSessionStorage";
import {
  StartPageFooter,
  StartPageOverview,
} from "./StartPageOverview";

export function SchedulerStartScreen() {
  const router = useRouter();
  const [session, setSession] = useState<StoredSchedulerSession | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSession(loadSchedulerSession());
  }, []);

  const openCsvText = (fileName: string, csvText: string) => {
    setErrorMessage(null);
    try {
      parseSongCsv(csvText);
      if (!savePendingCsv({ fileName, csvText })) {
        throw new Error("ブラウザにCSVを保存できませんでした。");
      }
      router.push("/scheduler");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "CSVを読み込めませんでした。",
      );
    }
  };

  const openCsv = async (file: File) => {
    try {
      openCsvText(file.name, await file.text());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "CSVを読み込めませんでした。",
      );
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void openCsv(file);
    }
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void openCsv(file);
    }
  };

  const savedAt = session
    ? new Intl.DateTimeFormat("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(session.savedAt))
    : null;

  return (
    <div className="start-shell">
      <header className="app-header">
        <div className="header-inner">
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
            <small>スタート</small>
          </span>
          <div className="header-actions">
            <a
              className="header-github-link"
              href="https://github.com/ryogaeki/circle-scheduler"
              target="_blank"
              rel="noreferrer"
              title="GitHubでソースコードを見る"
              aria-label="GitHubでソースコードを見る"
            >
              <GitHubMark />
            </a>
          </div>
        </div>
      </header>

      <main className="start-main">
        <section className="start-hero" aria-labelledby="start-title">
          <Image
            className="start-hero-logo"
            src={publicPath("/burusaa-logo.png")}
            alt=""
            width={104}
            height={86}
            priority
          />
          <div className="start-hero-copy">
            <h1 id="start-title">ぶるさぁ。専用予定調査アプリ</h1>
            <p className="start-lead">
              集めた○△×から、曲数や希望を考えた練習予定を作成します。
            </p>

            {session && (
              <section className="resume-session" aria-labelledby="resume-heading">
                <div className="resume-session-copy">
                  <span id="resume-heading">前回の作業</span>
                  <strong>{session.fileName}</strong>
                  <small>
                    {session.timeSlotCount}時間枠・{session.songCount}曲・{savedAt}保存
                  </small>
                </div>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => router.push("/scheduler")}
                >
                  作業を続ける
                  <ArrowRight aria-hidden="true" size={17} />
                </button>
              </section>
            )}
          </div>
        </section>

        <section className="start-actions" aria-label="アプリを始める">
          <div className="start-upload">
            <div className="start-section-heading">
              <FileSpreadsheet aria-hidden="true" size={21} />
              <h2>{session ? "新しいCSVから始める" : "曲ごとCSVを開く"}</h2>
            </div>
            <div
              className={`start-drop-zone${dragging ? " is-dragging" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <Upload aria-hidden="true" size={28} />
              <div>
                <strong>CSVファイルをドロップ</strong>
                <small>調整さんの「各曲ごと」CSVに対応</small>
              </div>
              <label className="button primary">
                <FileSpreadsheet aria-hidden="true" size={17} />
                CSVを選択
                <input
                  className="visually-hidden"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleInput}
                />
              </label>
            </div>
            <button
              className="start-example-button"
              type="button"
              onClick={() =>
                openCsvText(EXAMPLE_SONG_CSV_FILE_NAME, EXAMPLE_SONG_CSV)
              }
            >
              <Play aria-hidden="true" size={15} />
              CSVがない方は例題で試す
            </button>
          </div>

          <div className="start-utility">
            <div className="start-section-heading">
              <CalendarDays aria-hidden="true" size={21} />
              <h2>調整さんの日程を作る</h2>
            </div>
            <button
              className="start-utility-button"
              type="button"
              onClick={() => router.push("/date-options")}
            >
              <CalendarDays aria-hidden="true" size={25} />
              <span>
                <strong>日付と時間から日程文を作成</strong>
                <small>カレンダーで選択して、すぐコピー</small>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>

          {errorMessage && (
            <div className="inline-alert error start-error" role="alert">
              {errorMessage}
            </div>
          )}
        </section>

        <StartPageOverview />
      </main>
      <StartPageFooter />
    </div>
  );
}
