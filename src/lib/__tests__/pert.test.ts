import { describe, expect, it } from 'vitest'
import type { ProjectData, Task } from '../../types'
import { computeSchedule } from '../schedule'
import { computePertRows, defaultEstimate, normalizeEstimate, summarizePert } from '../pert'

function task(id: string, durationDays: number, estimates: Task['estimates'] = null): Task {
  return {
    id,
    name: `Tugas ${id}`,
    parentId: null,
    durationDays,
    startDate: '2026-01-05',
    priority: 'Medium',
    color: '#4f46e5',
    progress: 0,
    dependencies: [],
    assignments: [],
    estimates,
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

describe('normalizeEstimate', () => {
  it('mengurutkan O, M, P', () => {
    expect(normalizeEstimate(task('X', 4, { optimistic: 9, mostLikely: 4, pessimistic: 2 }))).toEqual({
      optimistic: 2,
      mostLikely: 4,
      pessimistic: 9,
    })
  })

  it('memakai estimasi default bila kosong', () => {
    expect(normalizeEstimate(task('X', 3))).toEqual(defaultEstimate(3))
  })
})

describe('computePertRows', () => {
  it('menghitung durasi harapan dan varians', () => {
    const data = project([task('X', 4, { optimistic: 2, mostLikely: 4, pessimistic: 9 })])
    const schedule = computeSchedule(data)
    const rows = computePertRows(data, schedule, new Set(['X']))
    expect(rows).toHaveLength(1)
    expect(rows[0].expected).toBe(4.5) // (2 + 16 + 9) / 6
    expect(rows[0].variance).toBeCloseTo(1.36, 2)
    expect(rows[0].stdDev).toBeCloseTo(1.17, 2)
    expect(rows[0].critical).toBe(true)
  })

  it('melewati tugas ringkasan', () => {
    const child = { ...task('C', 2), parentId: 'P' }
    const parent: Task = { ...task('P', 1), id: 'P', name: 'P' }
    const data = project([parent, child])
    const schedule = computeSchedule(data)
    const rows = computePertRows(data, schedule, new Set())
    expect(rows.map((r) => r.taskId)).toEqual(['C'])
  })
})

describe('summarizePert', () => {
  it('menjumlahkan durasi & varians sepanjang jalur', () => {
    const data = project([
      task('X', 4, { optimistic: 2, mostLikely: 4, pessimistic: 9 }),
      task('Y', 3, { optimistic: 2, mostLikely: 3, pessimistic: 4 }),
    ])
    const schedule = computeSchedule(data)
    const rows = computePertRows(data, schedule, new Set())
    const summary = summarizePert(rows, ['X', 'Y'])
    expect(summary.expectedDuration).toBeCloseTo(7.5, 2)
    expect(summary.variance).toBeCloseTo(1.47, 2)
    expect(summary.stdDev).toBeCloseTo(1.21, 2)
    expect(summary.p95).toBeCloseTo(9.88, 2)
  })
})
