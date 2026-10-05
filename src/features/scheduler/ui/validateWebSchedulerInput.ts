import {
  EMPTY_SONG_ID,
  FORBIDDEN_SCORE,
  type SolveRequest,
} from "../types";

// 画面で変更した設定を、重い探索を始める前に検証する。
export function validateWebSchedulerInput(input: SolveRequest): string | null {
  const { config, scoreTable } = input;
  if (
    config.countRuleMode === "balance" &&
    (input.minBalanceDifference < 0 ||
      input.minBalanceDifference > input.maxBalanceDifference)
  ) {
    return "曲数差の範囲が正しくありません。";
  }
  if (
    !Number.isInteger(input.minBalanceDifference) ||
    !Number.isInteger(input.maxBalanceDifference)
  ) {
    return "曲数差は整数で指定してください。";
  }
  if (config.candidateLimit < 1 || config.trialCount < 1) {
    return "保存候補数と初期案の試行回数は1以上にしてください。";
  }
  if (config.annealingIterations < 1) {
    return "焼きなまし反復回数は1以上にしてください。";
  }
  if (config.startTemperature <= 0 || config.endTemperature <= 0) {
    return "焼きなまし温度は0より大きくしてください。";
  }
  if (
    !Number.isInteger(config.candidateLimit) ||
    !Number.isInteger(config.trialCount) ||
    !Number.isInteger(config.annealingIterations) ||
    !Number.isInteger(config.randomSeed)
  ) {
    return "候補数、試行回数、反復回数、seedは整数で指定してください。";
  }

  for (const rule of config.songRules) {
    const songName = scoreTable.songs[rule.songId]?.name ?? `曲ID ${rule.songId}`;
    if (
      !Number.isInteger(rule.targetCount) ||
      !Number.isInteger(rule.minCount) ||
      !Number.isInteger(rule.maxCount) ||
      !Number.isInteger(rule.maxPerDay)
    ) {
      return `${songName}: 回数設定は整数で指定してください。`;
    }
    if (rule.minCount < 0 || (rule.maxCount !== -1 && rule.maxCount < rule.minCount)) {
      return `${songName}: 最低回数と最大回数が正しくありません。`;
    }
    if (config.countRuleMode === "fixedTarget" && rule.targetCount < 0) {
      return `${songName}: 回数固定では固定回数を指定してください。`;
    }
    if (
      rule.targetCount >= 0 &&
      (rule.targetCount < rule.minCount ||
        (rule.maxCount !== -1 && rule.targetCount > rule.maxCount))
    ) {
      return `${songName}: 固定回数が最低回数・最大回数の範囲外です。`;
    }
  }

  const fixedSongBySlot = new Map<number, number>();
  const preferredSlots = new Set<number>();
  for (const request of config.assignmentRequests) {
    if (
      request.timeSlotId < 0 ||
      request.timeSlotId >= scoreTable.timeSlots.length
    ) {
      return "存在しない時間枠を参照する割り当て要求があります。";
    }
    if (
      request.songId !== EMPTY_SONG_ID &&
      (request.songId < 0 || request.songId >= scoreTable.songs.length)
    ) {
      return "存在しない曲を参照する割り当て要求があります。";
    }
    if (
      !Number.isFinite(request.priority) ||
      request.priority < 0 ||
      (request.songId === EMPTY_SONG_ID && !request.fixed)
    ) {
      return "割り当て要求の希望点または空白指定が正しくありません。";
    }
    if (!request.fixed) {
      if (fixedSongBySlot.has(request.timeSlotId)) {
        return `${scoreTable.timeSlots[request.timeSlotId].label}: 確定枠と希望枠が競合しています。`;
      }
      preferredSlots.add(request.timeSlotId);
      continue;
    }
    if (preferredSlots.has(request.timeSlotId)) {
      return `${scoreTable.timeSlots[request.timeSlotId].label}: 確定枠と希望枠が競合しています。`;
    }
    const previousSongId = fixedSongBySlot.get(request.timeSlotId);
    if (previousSongId !== undefined && previousSongId !== request.songId) {
      return `${scoreTable.timeSlots[request.timeSlotId].label}: 確定枠が競合しています。`;
    }
    fixedSongBySlot.set(request.timeSlotId, request.songId);
    if (
      request.songId !== EMPTY_SONG_ID &&
      scoreTable.slotSongScores[request.timeSlotId][request.songId] ===
        FORBIDDEN_SCORE
    ) {
      return `${scoreTable.timeSlots[request.timeSlotId].label}: ×の絶対不可枠に曲が確定されています。`;
    }
  }
  return null;
}
