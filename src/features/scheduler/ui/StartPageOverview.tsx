import {
  CalendarRange,
  FileSpreadsheet,
  ListChecks,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

import { GitHubMark } from "../../../components/GitHubMark";

const FLOW_STEPS = [
  {
    icon: FileSpreadsheet,
    number: "01",
    title: "予定を読み込む",
    description: "調整さんの曲ごとCSVを、そのままブラウザで読み込みます。",
  },
  {
    icon: SlidersHorizontal,
    number: "02",
    title: "条件を整える",
    description: "曲数、確定枠、希望枠などを曲ごとに調整します。",
  },
  {
    icon: CalendarRange,
    number: "03",
    title: "候補を比べる",
    description: "自動作成された予定を比べ、カレンダー上で仕上げます。",
  },
] as const;

export function StartPageOverview() {
  return (
    <section className="start-overview" aria-labelledby="overview-heading">
      <div className="start-overview-heading">
        <p className="start-kicker">FROM RESPONSES TO SCHEDULE</p>
        <h2 id="overview-heading">集めた希望を、練習予定へ。</h2>
        <p>
          空いている日を眺め続ける代わりに、条件を保った候補をまとめて作ります。
        </p>
      </div>

      <ol className="start-flow" aria-label="予定作成の流れ">
        {FLOW_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.number}>
              <span className="start-flow-number">{step.number}</span>
              <span className="start-flow-icon">
                <Icon aria-hidden="true" size={25} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          );
        })}
      </ol>

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
