import {
  ArrowRight,
  CalendarRange,
  ListChecks,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

import { GitHubMark } from "../../../components/GitHubMark";

export function StartPageOverview() {
  return (
    <section className="start-overview" aria-labelledby="overview-heading">
      <div className="start-overview-heading">
        <h2 id="overview-heading">○△×を、比較できる予定候補へ</h2>
        <p>
          曲数や確定枠などの条件を反映し、候補をカレンダーで確認できます。
        </p>
      </div>

      <div className="start-preview" aria-label="CSVから予定候補を作る流れ">
        <section className="start-preview-input">
          <header>
            <strong>曲ごとCSV</strong>
            <span>3曲・4時間枠</span>
          </header>
          <div className="start-preview-grid" aria-hidden="true">
            <span>日時</span>
            <span>曲 A</span>
            <span>曲 B</span>
            <span>曲 C</span>
            <span>18:00</span>
            <b>○</b>
            <b>△</b>
            <b>×</b>
            <span>18:45</span>
            <b>△</b>
            <b>○</b>
            <b>○</b>
            <span>19:30</span>
            <b>○</b>
            <b>×</b>
            <b>△</b>
            <span>20:15</span>
            <b>○</b>
            <b>△</b>
            <b>○</b>
          </div>
        </section>

        <div className="start-preview-arrow" aria-hidden="true">
          <ArrowRight size={22} />
          <span>条件を反映</span>
        </div>

        <section className="start-preview-output">
          <header>
            <strong>予定候補</strong>
            <span>候補 #1</span>
          </header>
          <div className="start-preview-schedule" aria-hidden="true">
            <span>18:00</span>
            <strong>曲 A</strong>
            <small>○</small>
            <span>18:45</span>
            <strong>曲 B</strong>
            <small>○</small>
            <span>19:30</span>
            <strong>曲 C</strong>
            <small>△</small>
            <span>20:15</span>
            <strong>曲 A</strong>
            <small>○</small>
          </div>
        </section>
      </div>

      <div className="start-capabilities" aria-label="主な機能">
        <span>
          <ListChecks aria-hidden="true" size={19} />
          複数候補と点数内訳
        </span>
        <span>
          <CalendarRange aria-hidden="true" size={19} />
          カレンダー上で手動調整
        </span>
        <span>
          <SlidersHorizontal aria-hidden="true" size={19} />
          曲ごとの細かな条件設定
        </span>
      </div>
    </section>
  );
}

export function StartPageFooter() {
  return (
    <footer className="start-footer">
      <div className="start-footer-inner">
        <div>
          <strong>ぶるさぁ。専用予定調査アプリ</strong>
          <small>練習予定づくりを、少し軽く。</small>
        </div>
        <nav aria-label="フッターナビゲーション">
          <Link href="/date-options">調整さんの日程文作成</Link>
          <a
            href="https://github.com/ryogaeki/circle-scheduler"
            target="_blank"
            rel="noreferrer"
          >
            <GitHubMark size={17} />
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
