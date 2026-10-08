import { describe, expect, it } from 'vitest'
import type { Dependency, ProjectData, Task } from '../../types'
import { computeSchedule } from '../schedule'

function dep(predecessorId: string, type: 'FS' | 'SS', lag = 0): Dependency {
  return { id: `d-${predecessorId}-${type}`, predecessorId, type, lag }
}

function task(partial: Partial<Task> & { id: string; name: string }): Task {
  return {
    id: partial.id,
    name: partial.name,
    parentId: partial.parentId ?? null,
    durationDays: partial.durationDays ?? 1,
    startDate: partial.startDate ?? '2026-01-05',
    priority: partial.priority ?? 'Medium',
    color: partial.color ?? '#4f46e5',
    progress: 0,
    dependencies: partial.dependencies ?? [],
    assignments: partial.assignments ?? [],
    estimates: partial.estimates ?? null,
    collapsed: false,
  }
}

function project(tasks: Task[]): ProjectData {
  return {
    name: 'Uji',
    tasks,
    members: [],
    calendar: { projectStart: '2026-01-05', weekendDays: [0, 6], holidays: [] },
  }
}

describe('computeSchedule', () => {
  it('menghitung FS, SS + lag, dan rollup sub-tugas', () => {
    const data = project([
      task({
        id: 'A',
        name: 'A',
        durationDays: 3,
        startDate: '2026-01-05', // Senin -> Rabu 7 Jan
      }),
      task({
        id: 'B',
        name: 'B',
        durationDays: 2,
        startDate: '2026-01-05',
        dependencies: [dep('A', 'FS', 0)],
      }),
      task({
        id: 'C',
        name: 'C',
        durationDays: 1,
        startDate: '2026-01-05',
        dependencies: [dep('B', 'SS', 1)],
      }),
      task({ id: 'P', name: 'Ringkasan', durationDays: 1 }),
    ])
    // jadikan A, B, C anak dari P
    data.tasks = data.tasks.map((t) =>
      t.id === 'A' || t.id === 'B' || t.id === 'C' ? { ...t, parentId: 'P' } : t,
    )

    const schedule = computeSchedule(data)
    const a = schedule.byId.get('A')
    const b = schedule.byId.get('B')
    const c = schedule.byId.get('C')
    const p = schedule.byId.get('P')

    expect(a?.computedStart).toBe('2026-01-05')
    expect(a?.computedFinish).toBe('2026-01-07')
    expect(b?.computedStart).toBe('2026-01-08') // hari kerja setelah selesai A
    expect(b?.computedFinish).toBe('2026-01-09')
    expect(c?.computedStart).toBe('2026-01-09') // SS + 1 hari kerja dari B
    expect(p?.isSummary).toBe(true)
    expect(p?.computedStart).toBe('2026-01-05')
    expect(p?.computedFinish).toBe('2026-01-09')
    expect(p?.duration).toBe(5)
  })

  it('menerapkan lag pada FS dan melompati akhir pekan', () => {
    const data = project([
      task({ id: 'A', name: 'A', durationDays: 3, startDate: '2026-01-05' }),
      task({
        id: 'D',
        name: 'D',
        durationDays: 1,
        dependencies: [dep('A', 'FS', 2)],
      }),
    ])
    const schedule = computeSchedule(data)
    // A selesai 7 Jan; FS+2 => 3 hari kerja setelahnya: 8, 9, 12 Jan
    expect(schedule.byId.get('D')?.computedStart).toBe('2026-01-12')
  })

  it('mendorong hari mulai non-kerja ke hari kerja berikutnya', () => {
    const data = project([task({ id: 'X', name: 'X', durationDays: 2, startDate: '2026-01-03' })])
    const schedule = computeSchedule(data)
    expect(schedule.byId.get('X')?.computedStart).toBe('2026-01-05')
    expect(schedule.byId.get('X')?.computedFinish).toBe('2026-01-06')
  })

  it('memakai tanggal manual sebagai batas bawah (tidak bisa lebih awal dari pendahulu)', () => {
    const data = project([
      task({ id: 'A', name: 'A', durationDays: 2, startDate: '2026-01-05' }),
      task({
        id: 'B',
        name: 'B',
        durationDays: 2,
        startDate: '2026-02-02', // manual jauh di depan
        dependencies: [dep('A', 'FS', 0)],
      }),
    ])
    const schedule = computeSchedule(data)
    expect(schedule.byId.get('B')?.computedStart).toBe('2026-02-02')
  })
})
