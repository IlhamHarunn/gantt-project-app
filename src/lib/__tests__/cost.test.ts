import { describe, expect, it } from 'vitest'
import type { Member, ProjectData, Task } from '../../types'
import { computeSchedule } from '../schedule'
import { assignmentCost, dailyRate, computeCosts } from '../cost'

const member: Member = {
  id: 'm1',
  name: 'Andi',
  email: 'andi@corp.id',
  role: 'Developer',
  monthlySalary: 21_000_000,
}

function task(id: string, durationDays: number, assignments: Task['assignments']): Task {
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
    assignments,
    estimates: null,
    collapsed: false,
  }
}

describe('cost', () => {
  it('mengubah gaji bulanan menjadi tarif harian', () => {
    expect(dailyRate(member)).toBe(1_000_000)
  })

  it('menghitung biaya penugasan berdasarkan alokasi', () => {
    expect(assignmentCost(member, 50, 10)).toBe(5_000_000)
  })

  it('menjumlahkan biaya per tugas dan per anggota', () => {
    const data: ProjectData = {
      name: 'Uji',
      tasks: [task('A', 4, [{ memberId: 'm1', allocation: 50 }])],
      members: [member],
      calendar: { projectStart: '2026-01-05', weekendDays: [0, 6], holidays: [] },
    }
    const schedule = computeSchedule(data)
    const costs = computeCosts(data, schedule)
    expect(costs.total).toBe(2_000_000) // tarif 1jt x 50% alokasi x 4 hari kerja
    expect(costs.byMember.get('m1')).toBe(2_000_000)
    expect(costs.byTask.get('A')?.effort).toBe(2)
  })
})
