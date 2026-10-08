import type { CalendarSettings } from '../types'
import { addDays, compareISO, getWeekday } from './date'

/** Apakah tanggal ini termasuk hari libur khusus. */
export function isHoliday(iso: string, cal: CalendarSettings): boolean {
  return cal.holidays.some((h) => h.date === iso)
}

/** Apakah tanggal ini hari akhir pekan. */
export function isWeekend(iso: string, cal: CalendarSettings): boolean {
  return cal.weekendDays.includes(getWeekday(iso))
}

/** Apakah tanggal ini hari kerja (bukan akhir pekan dan bukan libur). */
export function isWorkingDay(iso: string, cal: CalendarSettings): boolean {
  return !isWeekend(iso, cal) && !isHoliday(iso, cal)
}

/** Hari kerja terdekat pada atau setelah tanggal ini. */
export function nextWorkingDay(iso: string, cal: CalendarSettings): string {
  let cursor = iso
  let guard = 0
  while (!isWorkingDay(cursor, cal) && guard < 3_660) {
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return cursor
}

/** Hari kerja terdekat pada atau sebelum tanggal ini. */
export function prevWorkingDay(iso: string, cal: CalendarSettings): string {
  let cursor = iso
  let guard = 0
  while (!isWorkingDay(cursor, cal) && guard < 3_660) {
    cursor = addDays(cursor, -1)
    guard += 1
  }
  return cursor
}

/** Membulatkan tanggal ke hari kerja terdekat ke depan bila perlu. */
export function snapToWorkingDay(iso: string, cal: CalendarSettings): string {
  return isWorkingDay(iso, cal) ? iso : nextWorkingDay(iso, cal)
}

/**
 * Menambah n hari kerja pada tanggal (tidak menghitung hari mulai).
 * Nilai n bisa negatif untuk mundur ke belakang.
 */
export function addWorkingDays(iso: string, n: number, cal: CalendarSettings): string {
  let cursor = iso
  if (n >= 0) {
    for (let i = 0; i < n; i += 1) {
      cursor = nextWorkingDay(addDays(cursor, 1), cal)
    }
  } else {
    for (let i = 0; i < -n; i += 1) {
      cursor = prevWorkingDay(addDays(cursor, -1), cal)
    }
  }
  return cursor
}

/** Jumlah hari kerja antara dua tanggal (inklusif; 0 bila urutan terbalik). */
export function workingDaysBetween(
  startISO: string,
  endISO: string,
  cal: CalendarSettings,
): number {
  if (compareISO(startISO, endISO) > 0) return 0
  let count = 0
  let cursor = startISO
  let guard = 0
  while (compareISO(cursor, endISO) <= 0 && guard < 20_000) {
    if (isWorkingDay(cursor, cal)) count += 1
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return count
}

/**
 * Offset hari kerja sebuah tanggal terhadap tanggal mulai proyek.
 * Hari kerja pertama proyek bernilai 0. Bila tanggal jatuh pada hari
 * bukan kerja, dipakai hari kerja terdekat berikutnya.
 */
export function workingDayOffset(
  projectStart: string,
  dateISO: string,
  cal: CalendarSettings,
): number {
  const start = snapToWorkingDay(projectStart, cal)
  const target = snapToWorkingDay(dateISO, cal)
  if (compareISO(target, start) < 0) {
    return -workingDaysBetween(target, start, cal)
  }
  return workingDaysBetween(start, target, cal) - 1
}

/** Daftar tanggal libur terurut. */
export function sortedHolidays(cal: CalendarSettings): CalendarSettings['holidays'] {
  return [...cal.holidays].sort((a, b) => compareISO(a.date, b.date))
}
