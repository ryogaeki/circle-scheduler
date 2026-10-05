import {
  AVAILABLE_SCORE,
  EMPTY_SONG_ID,
  type SchedulerConfig,
  type ScoreTable,
} from "../types";

function findTimeSlotId(scoreTable: ScoreTable, label: string): number {
  const timeSlot = scoreTable.timeSlots.find((slot) => slot.label === label);
  if (!timeSlot) {
    throw new Error(`時間枠が見つかりません: ${label}`);
  }
  return timeSlot.id;
}

function findSongId(scoreTable: ScoreTable, name: string): number {
  const song = scoreTable.songs.find((item) => item.name === name);
  if (!song) {
    throw new Error(`曲が見つかりません: ${name}`);
  }
  return song.id;
}

export function addFixedRequest(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  timeSlotLabel: string,
  songName: string,
): void {
  config.assignmentRequests.push({
    timeSlotId: findTimeSlotId(scoreTable, timeSlotLabel),
    songId: findSongId(scoreTable, songName),
    priority: 100,
    fixed: true,
  });
}

export function addFixedBlankRequest(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  timeSlotLabel: string,
): void {
  config.assignmentRequests.push({
    timeSlotId: findTimeSlotId(scoreTable, timeSlotLabel),
    songId: EMPTY_SONG_ID,
    priority: 100,
    fixed: true,
  });
}

export function addPreferredRequest(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  timeSlotLabel: string,
  songName: string,
  priority: number,
): void {
  config.assignmentRequests.push({
    timeSlotId: findTimeSlotId(scoreTable, timeSlotLabel),
    songId: findSongId(scoreTable, songName),
    priority,
    fixed: false,
  });
}

export function addPreferredDateRequest(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  dateKey: string,
  songName: string,
  priority: number,
): void {
  const songId = findSongId(scoreTable, songName);
  const timeSlots = scoreTable.timeSlots.filter(
    (timeSlot) => timeSlot.dateKey === dateKey,
  );
  if (timeSlots.length === 0) {
    throw new Error(`日付が見つかりません: ${dateKey}`);
  }
  for (const timeSlot of timeSlots) {
    config.assignmentRequests.push({
      timeSlotId: timeSlot.id,
      songId,
      priority,
      fixed: false,
    });
  }
}

export function addPreferredAvailableRequests(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  songName: string,
  priority: number,
): void {
  const songId = findSongId(scoreTable, songName);
  for (const timeSlot of scoreTable.timeSlots) {
    if (scoreTable.slotSongScores[timeSlot.id][songId] === AVAILABLE_SCORE) {
      config.assignmentRequests.push({
        timeSlotId: timeSlot.id,
        songId,
        priority,
        fixed: false,
      });
    }
  }
}

export function addPreferredAvailableDateRequest(
  scoreTable: ScoreTable,
  config: SchedulerConfig,
  dateKey: string,
  songName: string,
  priority: number,
): void {
  const songId = findSongId(scoreTable, songName);
  const dateSlots = scoreTable.timeSlots.filter(
    (timeSlot) => timeSlot.dateKey === dateKey,
  );
  if (dateSlots.length === 0) {
    throw new Error(`日付が見つかりません: ${dateKey}`);
  }
  const availableSlots = dateSlots.filter(
    (timeSlot) =>
      scoreTable.slotSongScores[timeSlot.id][songId] === AVAILABLE_SCORE,
  );
  if (availableSlots.length === 0) {
    throw new Error(`その日付に◯枠がありません: ${dateKey} ${songName}`);
  }
  for (const timeSlot of availableSlots) {
    config.assignmentRequests.push({
      timeSlotId: timeSlot.id,
      songId,
      priority,
      fixed: false,
    });
  }
}
