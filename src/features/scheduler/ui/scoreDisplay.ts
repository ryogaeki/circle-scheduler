import type { ScoreResult } from "../types";

// 同点比較用の内部値1を、画面では通常点の0.001点として表示する。
export const TIME_TIE_BREAK_DISPLAY_UNIT = 0.001;

function roundDisplayScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function timeTieBreakDisplayScore(value: number): number {
  return roundDisplayScore(value * TIME_TIE_BREAK_DISPLAY_UNIT);
}

export function finalDisplayScore(
  score: Pick<ScoreResult, "totalScore" | "timeTieBreakScore">,
): number {
  return roundDisplayScore(
    score.totalScore + timeTieBreakDisplayScore(score.timeTieBreakScore),
  );
}

export function formatDecimalScore(value: number, signed = false): string {
  const normalized = Math.abs(value) < 0.0005 ? 0 : value;
  const text = normalized.toFixed(3);
  if (!signed) {
    return text;
  }
  return normalized > 0 ? `+${text}` : normalized === 0 ? `±${text}` : text;
}

export function formatIntegerScore(value: number, signed = false): string {
  if (signed && value > 0) {
    return `+${value}`;
  }
  return value === 0 && signed ? "±0" : String(value);
}
