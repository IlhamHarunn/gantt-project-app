import type { ProjectData, Task } from '../types'
import {
  addWorkingDays,
  snapToWorkingDay,
  workingDayOffset,
  workingDaysBetween,
} from './calendar'
import { compareISO } from './date'

export interface ScheduledTask {
  task: Task
  isSummary: boolean
  childIds: string[]
  computedStart: string
  computedFinish: string
  /** Durasi efektif dalam hari kerja. */
  duration: number
  /** Offset hari kerja mulai terhadap awal proyek (hari kerja pertama = 0). */
  startOffset: number
  finishOffset: number
  /** True bila tugas terlibat siklus ketergantungan. */
  cycle: boolean
}

export interface ScheduleResult {
  byId: Map<string, ScheduledTask>
  order: string[]
  projectStart: string
  projectFinish: string
  projectDuration: number
}

interface Edge {
  from: string
  to: string
  type: 'FS' | 'SS'
  lag: number
  implicit: boolean
}

/**
 * Menghitung jadwal seluruh tugas dengan menghormati dependensi FS/SS + lag
 * dan kalender hari kerja. Tugas ringkasan (punya sub-tugas) mengikuti
 * rentang sub-tugasnya.
 */
export function computeSchedule(data: ProjectData): ScheduleResult {
  const cal = data.calendar
  const projectStart = snapToWorkingDay(cal.projectStart, cal)
  const taskById = new Map(data.tasks.map((t) => [t.id, t] as const))

  const childrenOf = new Map<string, string[]>()
  for (const t of data.tasks) {
    if (t.parentId && taskById.has(t.parentId)) {
      const arr = childrenOf.get(t.parentId) ?? []
      arr.push(t.id)
      childrenOf.set(t.parentId, arr)
    }
  }

  const edges: Edge[] = []
  for (const t of data.tasks) {
    for (const dep of t.dependencies) {
      if (dep.predecessorId !== t.id && taskById.has(dep.predecessorId)) {
        edges.push({ from: dep.predecessorId, to: t.id, type: dep.type, lag: dep.lag, implicit: false })
      }
    }
  }
  for (const [parentId, childIds] of childrenOf) {
    for (const childId of childIds) {
      edges.push({ from: childId, to: parentId, type: 'FS', lag: 0, implicit: true })
    }
  }

  const indegree = new Map<string, number>()
  const successors = new Map<string, Edge[]>()
  for (const t of data.tasks) {
    indegree.set(t.id, 0)
    successors.set(t.id, [])
  }
  for (const e of edges) {
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1)
    successors.get(e.from)?.push(e)
  }

  const queue: string[] = data.tasks
    .filter((t) => indegree.get(t.id) === 0)
    .map((t) => t.id)
  const ordered: string[] = []
  const settled = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift() as string
    ordered.push(id)
    settled.add(id)
    for (const e of successors.get(id) ?? []) {
      const next = (indegree.get(e.to) ?? 0) - 1
      indegree.set(e.to, next)
      if (next === 0) queue.push(e.to)
    }
  }
  const cyclicIds = new Set(
    data.tasks.filter((t) => !settled.has(t.id)).map((t) => t.id),
  )
  const finalOrder = [...ordered, ...data.tasks.map((t) => t.id).filter((id) => cyclicIds.has(id))]

  const byId = new Map<string, ScheduledTask>()

  const scheduleLeaf = (task: Task): { start: string; finish: string; duration: number } => {
    let base = snapToWorkingDay(task.startDate, cal)
    for (const dep of task.dependencies) {
      if (cyclicIds.has(task.id) && cyclicIds.has(dep.predecessorId)) continue
      const pred = byId.get(dep.predecessorId)
      if (!pred) continue
      const candidate =
        dep.type === 'FS'
          ? snapToWorkingDay(addWorkingDays(pred.computedFinish, 1 + dep.lag, cal), cal)
          : snapToWorkingDay(addWorkingDays(pred.computedStart, dep.lag, cal), cal)
      if (compareISO(candidate, base) > 0) base = candidate
    }
    const duration = Math.max(1, Math.round(task.durationDays))
    return { start: base, finish: addWorkingDays(base, duration - 1, cal), duration }
  }

  for (const id of finalOrder) {
    const task = taskById.get(id)
    if (!task) continue
    const childIds = childrenOf.get(id) ?? []
    const kids = childIds
      .map((cid) => byId.get(cid))
      .filter((k): k is ScheduledTask => Boolean(k))

    let start: string
    let finish: string
    let duration: number
    const isSummary = childIds.length > 0 && kids.length > 0

    if (isSummary) {
      let min = kids[0].computedStart
      let max = kids[0].computedFinish
      for (const k of kids) {
        if (compareISO(k.computedStart, min) < 0) min = k.computedStart
        if (compareISO(k.computedFinish, max) > 0) max = k.computedFinish
      }
      start = min
      finish = max
      duration = workingDaysBetween(min, max, cal)
    } else {
      const leaf = scheduleLeaf(task)
      start = leaf.start
      finish = leaf.finish
      duration = leaf.duration
    }

    byId.set(id, {
      task,
      isSummary,
      childIds,
      computedStart: start,
      computedFinish: finish,
      duration,
      startOffset: workingDayOffset(projectStart, start, cal),
      finishOffset: workingDayOffset(projectStart, finish, cal),
      cycle: cyclicIds.has(id),
    })
  }

  let projectFinish = projectStart
  let projectDuration = 0
  for (const st of byId.values()) {
    if (compareISO(st.computedFinish, projectFinish) > 0) projectFinish = st.computedFinish
    if (st.finishOffset + 1 > projectDuration) projectDuration = st.finishOffset + 1
  }

  return { byId, order: finalOrder, projectStart, projectFinish, projectDuration }
}
