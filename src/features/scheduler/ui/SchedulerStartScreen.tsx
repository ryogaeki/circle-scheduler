"use client";

import {
  ArrowRight,
  CalendarDays,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";

import { publicPath } from "../../../lib/publicPath";
import { parseSongCsv } from "../input/parseSongCsv";
import {
  loadSchedulerSession,
  savePendingCsv,
  type StoredSchedulerSession,
} from "../session/schedulerSessionStorage";

export function SchedulerStartScreen() {
  const router = useRouter();
  const [session, setSession] = useState<StoredSchedulerSession | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSession(loadSchedulerSession());
  }, []);

  const openCsv = async (file: File) => {
    setErrorMessage(null);
    try {
      const csvText = await file.text();
      parseSongCsv(csvText);
      if (!savePendingCsv({ fileName: file.name, csvText })) {
        throw new Error("ブラウザにCSVを保存できませんでした。");
      }
      router.push("/scheduler");
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
        </div>
      </header>

      <main className="start-main">
        <div className="start-content">
          <Image
            className="start-logo"
            src={publicPath("/burusaa-logo.png")}
            alt="ぶるさぁ。ロゴ"
            width={210}
            height={174}
            priority
          />
          <h1>ぶるさぁ。専用予定調査アプリ</h1>

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

          <section className="start-upload" aria-labelledby="start-upload-heading">
            <div className="start-section-heading">
              <FileSpreadsheet aria-hidden="true" size={21} />
              <h2 id="start-upload-heading">
                {session ? "新しいCSVから始める" : "曲ごとCSVを開く"}
              </h2>
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
              <strong>CSVファイルをドロップ</strong>
              <label className="button secondary">
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
          </section>

          <section className="start-utility" aria-labelledby="start-utility-heading">
            <div className="start-section-heading">
              <CalendarDays aria-hidden="true" size={21} />
              <h2 id="start-utility-heading">調整さんの日程を作る</h2>
            </div>
            <button
              className="start-utility-button"
              type="button"
              onClick={() => router.push("/date-options")}
            >
              <CalendarDays aria-hidden="true" size={24} />
              <span>
                <strong>日付と時間から日程文を作成</strong>
                <small>コピー・テキスト保存</small>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </section>

          {errorMessage && (
            <div className="inline-alert error start-error" role="alert">
              {errorMessage}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
