import { buildSongRules } from "../solver/solverHelpers";
import {
  EMPTY_SONG_ID,
  type AssignmentRequest,
  type ConstraintPolicy,
  type CountRuleMode,
  type SchedulerConfig,
  type ScoreTable,
  type SongRuleConfig,
  type TimePreference,
  type UnavailablePolicy,
} from "../types";

type SavedSongRule = Omit<SongRuleConfig, "songId"> & {
  songName: string;
};

type SavedAssignmentRequest = Omit<
  AssignmentRequest,
  "timeSlotId" | "songId"
> & {
  timeSlotLabel: string;
  songName: string | null;
};

type SavedSchedulerSettings = {
  format: "circle-scheduler-settings";
  version: 1;
  minBalanceDifference: number;
  maxBalanceDifference: number;
  common: Omit<SchedulerConfig, "songRules" | "assignmentRequests">;
  songRules: SavedSongRule[];
  assignmentRequests: SavedAssignmentRequest[];
};

export type LoadedSchedulerSettings = {
  config: SchedulerConfig;
  minBalanceDifference: number;
  maxBalanceDifference: number;
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label}の形式が正しくありません。`);
  }
  return value as Record<string, unknown>;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key}が数値ではありません。`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${key}がtrueまたはfalseではありません。`);
  }
  return value;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${key}が文字列ではありません。`);
  }
  return value;
}

function readEnum<const Value extends string>(
  record: Record<string, unknown>,
  key: string,
  values: readonly Value[],
): Value {
  const value = readString(record, key);
  if (!values.includes(value as Value)) {
    throw new Error(`${key}に未対応の値があります。`);
  }
  return value as Value;
}

function uniqueIdByName(
  items: { id: number; name: string }[],
  label: string,
): Map<string, number> {
  const ids = new Map<string, number>();
  for (const item of items) {
    if (ids.has(item.name)) {
      throw new Error(`${label}名が重複しているため設定を読み込めません。`);
    }
    ids.set(item.name, item.id);
  }
  return ids;
}

// IDではなく曲名・時間枠名で保存し、読み込み時の取り違えを防ぐ。
export function serializeSchedulerSettings(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  minBalanceDifference: number,
  maxBalanceDifference: number,
): string {
  const { songRules: _songRules, assignmentRequests: _requests, ...common } =
    config;
  const songRules = buildSongRules(scoreTable, config).map((rule) => {
    const { songId, ...savedRule } = rule;
    return { songName: scoreTable.songs[songId].name, ...savedRule };
  });
  const assignmentRequests = config.assignmentRequests.map((request) => ({
    timeSlotLabel: scoreTable.timeSlots[request.timeSlotId].label,
    songName:
      request.songId === EMPTY_SONG_ID
        ? null
        : scoreTable.songs[request.songId].name,
    priority: request.priority,
    fixed: request.fixed,
  }));
  const saved: SavedSchedulerSettings = {
    format: "circle-scheduler-settings",
    version: 1,
    minBalanceDifference,
    maxBalanceDifference,
    common,
    songRules,
    assignmentRequests,
  };
  return JSON.stringify(saved, null, 2);
}

function parseCommonConfig(record: Record<string, unknown>): Omit<
  SchedulerConfig,
  "songRules" | "assignmentRequests"
> {
  return {
    countRuleMode: readEnum(record, "countRuleMode", [
      "balance",
      "fixedTarget",
    ]) as CountRuleMode,
    balanceMaxDifference: readNumber(record, "balanceMaxDifference"),
    candidateLimit: readNumber(record, "candidateLimit"),
    trialCount: readNumber(record, "trialCount"),
    randomSeed: readNumber(record, "randomSeed"),
    annealingIterations: readNumber(record, "annealingIterations"),
    startTemperature: readNumber(record, "startTemperature"),
    endTemperature: readNumber(record, "endTemperature"),
    enableSongChangeNeighbor: readBoolean(
      record,
      "enableSongChangeNeighbor",
    ),
  };
}

function parseSongRule(
  value: unknown,
  songIdByName: Map<string, number>,
): SongRuleConfig {
  const record = asRecord(value, "曲別設定");
  const songName = readString(record, "songName");
  const songId = songIdByName.get(songName);
  if (songId === undefined) {
    throw new Error(`CSVにない曲の設定があります: ${songName}`);
  }
  return {
    songId,
    targetCount: readNumber(record, "targetCount"),
    minCount: readNumber(record, "minCount"),
    maxCount: readNumber(record, "maxCount"),
    unavailablePolicy: readEnum(record, "unavailablePolicy", [
      "forbidden",
      "allowWithPenalty",
    ]) as UnavailablePolicy,
    unavailablePenalty: readNumber(record, "unavailablePenalty"),
    maxPerDay: readNumber(record, "maxPerDay"),
    maxPerDayPolicy: readEnum(record, "maxPerDayPolicy", [
      "forbidden",
      "allowWithPenalty",
    ]) as ConstraintPolicy,
    maxPerDayPenalty: readNumber(record, "maxPerDayPenalty"),
    sameDayConsecutivePolicy: readEnum(
      record,
      "sameDayConsecutivePolicy",
      ["forbidden", "allowWithPenalty"],
    ) as ConstraintPolicy,
    sameDayConsecutivePenalty: readNumber(
      record,
      "sameDayConsecutivePenalty",
    ),
    sameDayNonConsecutivePolicy: readEnum(
      record,
      "sameDayNonConsecutivePolicy",
      ["forbidden", "allowWithPenalty"],
    ) as ConstraintPolicy,
    sameDayNonConsecutivePenalty: readNumber(
      record,
      "sameDayNonConsecutivePenalty",
    ),
    daySpacingPenalty: readNumber(record, "daySpacingPenalty"),
    timeBalancePenalty: readNumber(record, "timeBalancePenalty"),
    timePreference: readEnum(record, "timePreference", [
      "none",
      "preferEarly",
      "preferLate",
    ]) as TimePreference,
    timePreferencePenalty: readNumber(record, "timePreferencePenalty"),
  };
}

// 保存ファイルを現在のCSVのIDへ安全に変換する。
export function parseSchedulerSettings(
  text: string,
  scoreTable: ScoreTable,
): LoadedSchedulerSettings {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("設定JSONを読み取れませんでした。");
  }

  const root = asRecord(parsed, "設定ファイル");
  if (
    root.format !== "circle-scheduler-settings" ||
    root.version !== 1
  ) {
    throw new Error("この設定ファイル形式には対応していません。");
  }
  if (!Array.isArray(root.songRules)) {
    throw new Error("曲別設定の配列がありません。");
  }
  if (!Array.isArray(root.assignmentRequests)) {
    throw new Error("割り当て要求の配列がありません。");
  }

  const songIdByName = uniqueIdByName(scoreTable.songs, "曲");
  const songRules = root.songRules.map((rule) =>
    parseSongRule(rule, songIdByName),
  );
  if (
    songRules.length !== scoreTable.songs.length ||
    new Set(songRules.map((rule) => rule.songId)).size !==
      scoreTable.songs.length
  ) {
    throw new Error("設定ファイルとCSVの曲が一致しません。");
  }
  songRules.sort((left, right) => left.songId - right.songId);

  const slotIdByLabel = new Map<string, number>();
  for (const timeSlot of scoreTable.timeSlots) {
    if (slotIdByLabel.has(timeSlot.label)) {
      throw new Error("時間枠名が重複しているため設定を読み込めません。");
    }
    slotIdByLabel.set(timeSlot.label, timeSlot.id);
  }
  const assignmentRequests = root.assignmentRequests.map((value) => {
    const record = asRecord(value, "割り当て要求");
    const timeSlotLabel = readString(record, "timeSlotLabel");
    const timeSlotId = slotIdByLabel.get(timeSlotLabel);
    if (timeSlotId === undefined) {
      throw new Error(`CSVにない時間枠の設定があります: ${timeSlotLabel}`);
    }
    const savedSongName = record.songName;
    if (savedSongName !== null && typeof savedSongName !== "string") {
      throw new Error("割り当て要求の曲名が正しくありません。");
    }
    const songId =
      savedSongName === null
        ? EMPTY_SONG_ID
        : songIdByName.get(savedSongName);
    if (songId === undefined) {
      throw new Error(`CSVにない曲の設定があります: ${savedSongName}`);
    }
    return {
      timeSlotId,
      songId,
      priority: readNumber(record, "priority"),
      fixed: readBoolean(record, "fixed"),
    };
  });

  return {
    config: {
      ...parseCommonConfig(asRecord(root.common, "共通設定")),
      songRules,
      assignmentRequests,
    },
    minBalanceDifference: readNumber(root, "minBalanceDifference"),
    maxBalanceDifference: readNumber(root, "maxBalanceDifference"),
  };
}
