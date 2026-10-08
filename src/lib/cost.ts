import type { Member, ProjectData } from '../types'
import type { ScheduleResult } from './schedule'

/** Asumsi jumlah hari kerja per bulan untuk konversi gaji bulanan ke harian. */
export const WORKING_DAYS_PER_MONTH = 21

export function dailyRate(member: Member): number {
  return member.monthlySalary / WORKING_DAYS_PER_MONTH
}

/** Biaya satu penugasan: tarif harian x durasi x alokasi. */
export function assignmentCost(
  member: Member,
  allocation: number,
  durationDays: number,
): number {
  return dailyRate(member) * (Math.max(0, allocation) / 100) * Math.max(0, durationDays)
}

export interface TaskCost {
  taskId: string
  cost: number
  /** Total alokasi anggota (dalam persen-hari) untuk indikator beban. */
  effort: number
}

export function computeCosts(
  data: ProjectData,
  schedule: ScheduleResult,
): { byTask: Map<string, TaskCost>; byMember: Map<string, number>; total: number } {
  const memberById = new Map(data.members.map((m) => [m.id, m] as const))
  const byTask = new Map<string, TaskCost>()
  const byMember = new Map<string, number>()
  let total = 0

  for (const [taskId, st] of schedule.byId) {
    let cost = 0
    let effort = 0
    for (const assignment of st.task.assignments) {
      const member = memberById.get(assignment.memberId)
      if (!member) continue
      const c = assignmentCost(member, assignment.allocation, st.duration)
      cost += c
      effort += (assignment.allocation / 100) * st.duration
      byMember.set(member.id, (byMember.get(member.id) ?? 0) + c)
    }
    if (cost > 0 || effort > 0) {
      byTask.set(taskId, { taskId, cost, effort })
      total += cost
    }
  }

  return { byTask, byMember, total }
}

/** Format angka rupiah. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}
