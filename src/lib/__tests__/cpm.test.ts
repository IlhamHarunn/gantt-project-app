import { describe, expect, it } from 'vitest'
import type { Dependency, ProjectData, Task } from '../../types'
import { computeSchedule } from '../schedule'
import { computeCpm } from '../cpm'

function dep(predecessorId: string, type: 'FS' | 'SS', lag = 0): Dependency {
  return { id: `d-${predecessorId}`, predecessorId, type, lag }
}

function task(id: string, durationDays: number, dependencies: Dependency[] = []): Task {
  return {
    id,
    name: `Tugas ${id}`,
    parentId: null,
    durationDays,
    startDate: '2026-01-05',
    priority: 'Medium',
    color: '#4f46e5',
    progress: 0,
    dependencies,
    assignments: [],
    estimates: null,
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

describe('computeCpm', () => {
  it('menandai seluruh rantai sebagai kritis dan mengabaikan tugas paralel yang longgar', () => {
    const data = project([
      task('A', 3),
      task('B', 2, [dep('A', 'FS')]),
      task('C', 1, [dep('B', 'FS')]),
      task('D', 2),
    ])
    const schedule = computeSchedule(data)
    const cpm = computeCpm(data, schedule)

    expect(cpm.chain).toEqual(['A', 'B', 'C'])
    expect(cpm.criticalIds.has('A')).toBe(true)
    expect(cpm.criticalIds.has('B')).toBe(true)
    expect(cpm.criticalIds.has('C')).toBe(true)
    expect(cpm.criticalIds.has('D')).toBe(false)
    expect(cpm.nodes.get('D')?.float).toBeGreaterThan(0)
    expect(cpm.projectDuration).toBe(6)
  })

  it('memilih jalur terpanjang saat ada cabang', () => {
    const data = project([
      task('A', 2),
      task('B', 1, [dep('A', 'FS')]), // rantai pendek
      task('C', 4, [dep('A', 'FS')]), // rantai panjang
      task('E', 1, [dep('C', 'FS')]),
    ])
    const schedule = computeSchedule(data)
    const cpm = computeCpm(data, schedule)

    expect(cpm.chain).toContain('C')
    expect(cpm.chain).toContain('E')
    expect(cpm.criticalIds.has('B')).toBe(false)
  })
})
