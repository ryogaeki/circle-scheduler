"use client";

import {
  CalendarDays,
  Clock3,
  Sigma,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect } from "react";

type ScoreGuideDialogProps = {
  onClose: () => void;
};

// 画面に表示している点数と、候補を選ぶ優先順位をまとめて説明する。
export function ScoreGuideDialog({ onClose }: ScoreGuideDialogProps) {
  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  return (
    <div
      className="score-guide-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="score-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-guide-heading"
      >
        <header className="score-guide-header">
          <div>
            <p className="section-kicker">SCORE GUIDE</p>
            <h2 id="score-guide-heading">採点ルール・点数配分</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            title="採点ルールを閉じる"
            aria-label="採点ルールを閉じる"
            onClick={onClose}
          >
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="score-guide-body">
          <section className="score-guide-block">
            <div className="score-guide-title">
              <ShieldCheck aria-hidden="true" size={19} />
              <h3>候補を選ぶ優先順位</h3>
            </div>
            <ol className="score-priority-list">
              <li>
                <strong>絶対条件</strong>
                <span>×禁止、確定枠、強制空白、禁止した同日配置を守る</span>
              </li>
              <li>
                <strong>空白数</strong>
                <span>作成できる候補のうち空白が少ないものを優先する</span>
              </li>
              <li>
                <strong>曲数差</strong>
                <span>空白数が同じなら、曲ごとの回数差が小さい段階を優先する</span>
              </li>
              <li>
                <strong>通常点</strong>
                <span>○△×、同日、日付間隔、希望枠を合計して比較する</span>
              </li>
              <li>
                <strong>時間帯微小点</strong>
                <span>通常点まで同じ候補だけを比較する</span>
              </li>
            </ol>
          </section>

          <section className="score-guide-block">
            <div className="score-guide-title">
              <Sigma aria-hidden="true" size={19} />
              <h3>通常点</h3>
            </div>
            <p className="score-formula">
              通常点 = ○△× + 同日制限 + 日付間隔 + 希望枠
            </p>
            <div className="score-guide-table-scroll">
              <table className="score-guide-table">
                <thead>
                  <tr>
                    <th>項目</th>
                    <th>計算</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">○・◯</th>
                    <td>割り当て1枠につき +2点</td>
                  </tr>
                  <tr>
                    <th scope="row">△</th>
                    <td>割り当て1枠につき +1点</td>
                  </tr>
                  <tr>
                    <th scope="row">空白</th>
                    <td>0点。点数より先に空白数を比較する</td>
                  </tr>
                  <tr>
                    <th scope="row">×・✕</th>
                    <td>通常は絶対不可。許可した曲だけ設定した負の点数</td>
                  </tr>
                  <tr>
                    <th scope="row">希望枠</th>
                    <td>その曲が入ったとき priority を加点。同じ希望は合計する</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="score-guide-block">
            <div className="score-guide-title">
              <CalendarDays aria-hidden="true" size={19} />
              <h3>同日制限と日付間隔</h3>
            </div>
            <dl className="score-rule-list">
              <div>
                <dt>同日連続・非連続</dt>
                <dd>同じ日の配置が連続かを判定し、曲別設定の減点を1日ごとに引きます。絶対不可にした配置は候補にできません。</dd>
              </div>
              <div>
                <dt>1日の上限</dt>
                <dd>上限を超えた回数 × 設定した減点を引きます。絶対不可を選んだ場合は点数ではなく禁止です。</dd>
              </div>
              <div>
                <dt>日付間隔</dt>
                <dd>
                  同じ日の重複を除いて予定期間内の位置を0〜1へ直し、等間隔の理想位置との差を測ります。練習日が2日の曲を3日以上の曲より強く評価し、軽いずれは小数点以下、前半・後半だけの偏りは滑らかに大きく減点します。同じ日の2枠目は、ここではなく同日制限だけで評価します。
                </dd>
              </div>
            </dl>
          </section>

          <section className="score-guide-block">
            <div className="score-guide-title">
              <Clock3 aria-hidden="true" size={19} />
              <h3>時間帯微小点</h3>
            </div>
            <p>
              各日の先頭を0、最後を1として、曲ごとの平均位置を計算します。時間帯の偏りは平均が0.5から離れるほど、早め・遅め希望は希望方向から離れるほど減点します。
            </p>
            <dl className="score-rule-list time-score-formulas">
              <div>
                <dt>偏りを減らす</dt>
                <dd>四捨五入（設定値 × |平均位置 - 0.5| × 2）を減点</dd>
              </div>
              <div>
                <dt>早め希望</dt>
                <dd>四捨五入（設定値 × 平均位置）を減点</dd>
              </div>
              <div>
                <dt>遅め希望</dt>
                <dd>四捨五入（設定値 × (1 - 平均位置)）を減点</dd>
              </div>
            </dl>
            <p className="score-formula">
              最終表示点 = 通常点 + 時間帯内部値 × 0.001
            </p>
            <p>
              例: 通常点42、時間帯内部値-17なら、画面では41.983点です。候補の順位は通常点を先に比較するため、時間帯評価が通常点1点の差を逆転することはありません。
            </p>
          </section>

          <section className="score-guide-note" aria-label="絶対条件">
            <ShieldCheck aria-hidden="true" size={18} />
            <p>
              <strong>確定枠・強制空白は加点ではありません。</strong>
              一致しない予定は絶対条件違反として候補から外れます。
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
