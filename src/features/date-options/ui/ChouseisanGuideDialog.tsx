"use client";

import { CalendarDays, Clipboard, MessageSquareText, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { publicPath } from "../../../lib/publicPath";

const CHOUSEISAN_MEMO = [
  "名前欄には曲名を入力してください",
  "入力内容は名前欄をタップすると編集できます",
  "○→人数が集まる・ぜひ練習を入れて欲しい日時",
  "△→○ほど人数は集まらないが、練習はできそうなので○の次点で練習を入れて欲しい日時",
  "×→人数が集まらない・練習を入れて欲しくない日時",
  "（他の曲と希望が被ることを考慮して、できる限り×は使わずに入力していただけると助かります）",
].join("\n");

type ChouseisanGuideDialogProps = {
  dateText: string;
  onClose: () => void;
};

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

export function ChouseisanGuideDialog({
  dateText,
  onClose,
}: ChouseisanGuideDialogProps) {
  const [copied, setCopied] = useState<"dates" | "memo" | null>(null);

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  const handleCopy = async (kind: "dates" | "memo", text: string) => {
    await copyText(text);
    setCopied(kind);
  };

  return (
    <div
      className="score-guide-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="chouseisan-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chouseisan-guide-heading"
      >
        <header className="score-guide-header">
          <div>
            <p className="section-kicker">CHOUSEISAN GUIDE</p>
            <h2 id="chouseisan-guide-heading">調整さんへの入力方法</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            title="説明を閉じる"
            aria-label="説明を閉じる"
            onClick={onClose}
          >
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="chouseisan-guide-body">
          <figure className="chouseisan-guide-image">
            <Image
              src={publicPath("/chouseisan-event-create.jpg")}
              alt="調整さんのイベント作成画面。候補日時とメモの入力欄"
              width={921}
              height={1843}
            />
          </figure>

          <div className="chouseisan-guide-fields">
            <section>
              <div className="chouseisan-guide-title">
                <CalendarDays aria-hidden="true" size={19} />
                <div>
                  <span>候補日時</span>
                  <strong>作成した日程文を貼り付ける</strong>
                </div>
              </div>
              <textarea
                readOnly
                value={dateText}
                placeholder="先にカレンダーで日付と時間を設定してください。"
              />
              <button
                className="button secondary"
                type="button"
                disabled={!dateText}
                onClick={() => void handleCopy("dates", dateText)}
              >
                <Clipboard aria-hidden="true" size={16} />
                {copied === "dates" ? "コピーしました" : "候補日時をコピー"}
              </button>
            </section>

            <section>
              <div className="chouseisan-guide-title">
                <MessageSquareText aria-hidden="true" size={19} />
                <div>
                  <span>メモ</span>
                  <strong>回答方法の説明を貼り付ける</strong>
                </div>
              </div>
              <textarea readOnly value={CHOUSEISAN_MEMO} />
              <button
                className="button secondary"
                type="button"
                onClick={() => void handleCopy("memo", CHOUSEISAN_MEMO)}
              >
                <Clipboard aria-hidden="true" size={16} />
                {copied === "memo" ? "コピーしました" : "メモをコピー"}
              </button>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
