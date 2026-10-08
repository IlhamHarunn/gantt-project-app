import { describe, expect, it } from 'vitest'
import type { CalendarSettings } from '../../types'
import {
  addWorkingDays,
  isWorkingDay,
  nextWorkingDay,
  snapToWorkingDay,
  workingDayOffset,
  workingDaysBetween,
} from '../calendar'

// 5 Jan 2026 = Senin.
const cal: CalendarSettings = {
  projectStart: '2026-01-05',
  weekendDays: [0, 6],
  holidays: [{ id: 'h1', date: '2026-01-08', name: 'Libur Uji' }],
}

describe('isWorkingDay', () => {
  it('mengenali hari kerja biasa', () => {
    expect(isWorkingDay('2026-01-05', cal)).toBe(true)
    expect(isWorkingDay('2026-01-06', cal)).toBe(true)
  })

  it('menolak akhir pekan', () => {
    expect(isWorkingDay('2026-01-03', cal)).toBe(false) // Sabtu
    expect(isWorkingDay('2026-01-04', cal)).toBe(false) // Minggu
  })

  it('menolak hari libur khusus', () => {
    expect(isWorkingDay('2026-01-08', cal)).toBe(false)
  })
})

describe('addWorkingDays', () => {
  it('menambahkan 0 hari tanpa perubahan', () => {
    expect(addWorkingDays('2026-01-05', 0, cal)).toBe('2026-01-05')
  })

  it('melompati hari libur', () => {
    // Sen 5 -> Sel 6 -> Rab 7 -> (Kam 8 libur) -> Jum 9
    expect(addWorkingDays('2026-01-05', 3, cal)).toBe('2026-01-09')
  })

  it('melompati akhir pekan', () => {
    expect(addWorkingDays('2026-01-09', 1, cal)).toBe('2026-01-12')
  })

  it('mundur melewati akhir pekan', () => {
    expect(addWorkingDays('2026-01-12', -1, cal)).toBe('2026-01-09')
  })
})

describe('workingDaysBetween', () => {
  it('menghitung hari kerja inklusif', () => {
    // Sen, Sel, Rab, (Kam libur), Jum => 4
    expect(workingDaysBetween('2026-01-05', '2026-01-09', cal)).toBe(4)
  })

  it('mengembalikan 0 bila urutan terbalik', () => {
    expect(workingDaysBetween('2026-01-09', '2026-01-05', cal)).toBe(0)
  })
})

describe('snap & offset', () => {
  it('memajukan hari non-kerja ke hari kerja berikutnya', () => {
    expect(snapToWorkingDay('2026-01-08', cal)).toBe('2026-01-09')
    expect(nextWorkingDay('2026-01-03', cal)).toBe('2026-01-05')
  })

  it('menghitung offset hari kerja dari awal proyek', () => {
    expect(workingDayOffset('2026-01-05', '2026-01-05', cal)).toBe(0)
    expect(workingDayOffset('2026-01-05', '2026-01-09', cal)).toBe(3)
  })
})
