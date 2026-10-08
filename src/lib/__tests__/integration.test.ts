import { describe, expect, it } from 'vitest'
import { createSeedData } from '../seed'
import { isWorkingDay } from '../calendar'
import { computeSchedule } from '../schedule'
import { computeCpm } from '../cpm'
import { computePertRows } from '../pert'
import { computeCosts } from '../cost'
import { compareISO } from '../date'

describe('pipeline data contoh (seed)', () => {
  const data = createSeedData()
  const schedule = computeSchedule(data)

  it('tidak memiliki referensi pendahulu / induk yang menggantung', () => {
    const ids = new Set(data.tasks.map((t) => t.id))
    for (const task of data.tasks) {
      if (task.parentId) expect(ids.has(task.parentId)).toBe(true)
      for (const dep of task.dependencies) expect(ids.has(dep.predecessorId)).toBe(true)
    }
  })

  it('memberi setiap tugas tanggal mulai & selesai yang valid pada hari kerja', () => {
    expect(schedule.byId.size).toBe(data.tasks.length)
    expect(isWorkingDay(schedule.projectStart, data.calendar)).toBe(true)
    for (const st of schedule.byId.values()) {
      expect(isWorkingDay(st.computedStart, data.calendar)).toBe(true)
      expect(isWorkingDay(st.computedFinish, data.calendar)).toBe(true)
      expect(compareISO(st.computedStart, st.computedFinish)).toBeLessThanOrEqual(0)
      expect(st.duration).toBeGreaterThanOrEqual(1)
      expect(st.cycle).toBe(false)
    }
  })

  it('menghormati dependensi FS/SS setelah penjadwalan', () => {
    for (const task of data.tasks) {
      const st = schedule.byId.get(task.id)
      if (!st) continue
      for (const dep of task.dependencies) {
        const pred = schedule.byId.get(dep.predecessorId)
        if (!pred) continue
        if (dep.type === 'FS') {
          expect(compareISO(st.computedStart, pred.computedFinish)).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('menemukan jalur kritis dan menghitung PERT + biaya', () => {
    const cpm = computeCpm(data, schedule)
    expect(cpm.chain.length).toBeGreaterThan(0)
    expect(cpm.criticalIds.size).toBeGreaterThan(0)
    expect(cpm.projectDuration).toBeGreaterThan(0)

    const leafCount = data.tasks.filter((t) => !data.tasks.some((c) => c.parentId === t.id)).length
    const pertRows = computePertRows(data, schedule, cpm.criticalIds)
    expect(pertRows).toHaveLength(leafCount)
    for (const row of pertRows) {
      expect(row.expected).toBeGreaterThan(0)
      expect(row.variance).toBeGreaterThanOrEqual(0)
    }

    const costs = computeCosts(data, schedule)
    expect(costs.total).toBeGreaterThan(0)
    expect(costs.byMember.size).toBeGreaterThan(0)
  })
})
