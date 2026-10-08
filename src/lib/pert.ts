import type { PertEstimate, ProjectData, Task } from '../types'
import type { ScheduleResult } from './schedule'

export interface PertRow {
  taskId: string
  name: string
  optimistic: number
  mostLikely: number
  pessimistic: number
  /** Durasi harapan (te) = (O + 4M + P) / 6. */
  expected: number
  /** Varians = ((P - O) / 6)^2. */
  variance: number
  stdDev: number
  critical: boolean
}

/** Estimasi default bila tugas belum punya nilai O/M/P. */
export function defaultEstimate(duration: number): PertEstimate {
  const d = Math.max(1, Math.round(duration))
  return {
    optimistic: Math.max(1, Math.round(d * 0.8)),
    mostLikely: d,
    pessimistic: Math.max(d, Math.round(d * 1.3)),
  }
}

export function normalizeEstimate(task: Task): PertEstimate {
  const est = task.estimates
  if (est && est.optimistic > 0 && est.mostLikely > 0 && est.pessimistic > 0) {
    const o = Math.min(est.optimistic, est.mostLikely, est.pessimistic)
    const p = Math.max(est.optimistic, est.mostLikely, est.pessimistic)
    return { optimistic: o, mostLikely: est.mostLikely, pessimistic: p }
  }
  return defaultEstimate(task.durationDays)
}

/** Menyusun baris analisis PERT untuk seluruh tugas daun. */
export function computePertRows(
  data: ProjectData,
  schedule: ScheduleResult,
  criticalIds: Set<string>,
): PertRow[] {
  const rows: PertRow[] = []
  for (const task of data.tasks) {
    const st = schedule.byId.get(task.id)
    if (!st || st.isSummary) continue
    const est = normalizeEstimate(task)
    const expected = (est.optimistic + 4 * est.mostLikely + est.pessimistic) / 6
    const variance = ((est.pessimistic - est.optimistic) / 6) ** 2
    rows.push({
      taskId: task.id,
      name: task.name,
      optimistic: est.optimistic,
      mostLikely: est.mostLikely,
      pessimistic: est.pessimistic,
      expected: Math.round(expected * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
      critical: criticalIds.has(task.id),
    })
  }
  return rows
}

export interface PertProjectSummary {
  expectedDuration: number
  variance: number
  stdDev: number
  /** Rentang kepercayaan ~95% (te ± 1.96σ). */
  p95: number
}

/** Ringkasan durasi proyek berdasarkan jalur kritis pada diagram PERT. */
export function summarizePert(
  rows: PertRow[],
  chain: string[],
): PertProjectSummary {
  const byId = new Map(rows.map((r) => [r.taskId, r] as const))
  let expected = 0
  let variance = 0
  for (const id of chain) {
    const row = byId.get(id)
    if (!row) continue
    expected += row.expected
    variance += row.variance
  }
  const stdDev = Math.sqrt(variance)
  return {
    expectedDuration: Math.round(expected * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    p95: Math.round((expected + 1.96 * stdDev) * 100) / 100,
  }
}

export interface PertGraphNode {
  id: string
  name: string
  level: number
  indexInLevel: number
}

export interface PertGraphEdge {
  from: string
  to: string
  type: 'FS' | 'SS'
  lag: number
}

export interface PertGraph {
  nodes: PertGraphNode[]
  edges: PertGraphEdge[]
  levels: number
}

/** Menyusun tata letak graf PERT (tugas daun saja) berdasarkan kedalaman. */
export function buildPertGraph(data: ProjectData): PertGraph {
  const taskById = new Map(data.tasks.map((t) => [t.id, t] as const))
  const hasChildren = new Set<string>()
  for (const t of data.tasks) if (t.parentId) hasChildren.add(t.parentId)

  const leaves = data.tasks.filter((t) => !hasChildren.has(t.id))
  const leafIds = new Set(leaves.map((t) => t.id))

  const edges: PertGraphEdge[] = []
  const indegree = new Map<string, number>()
  const successors = new Map<string, PertGraphEdge[]>()
  for (const id of leafIds) {
    indegree.set(id, 0)
    successors.set(id, [])
  }
  for (const t of leaves) {
    for (const dep of t.dependencies) {
      if (leafIds.has(dep.predecessorId) && dep.predecessorId !== t.id && taskById.has(dep.predecessorId)) {
        const edge: PertGraphEdge = { from: dep.predecessorId, to: t.id, type: dep.type, lag: dep.lag }
        edges.push(edge)
        indegree.set(t.id, (indegree.get(t.id) ?? 0) + 1)
        successors.get(dep.predecessorId)?.push(edge)
      }
    }
  }

  const level = new Map<string, number>()
  for (const id of leafIds) level.set(id, 0)
  const queue = [...leafIds].filter((id) => (indegree.get(id) ?? 0) === 0)
  const settled = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift() as string
    settled.add(id)
    const currentLevel = level.get(id) ?? 0
    for (const e of successors.get(id) ?? []) {
      level.set(e.to, Math.max(level.get(e.to) ?? 0, currentLevel + 1))
      const next = (indegree.get(e.to) ?? 0) - 1
      indegree.set(e.to, next)
      if (next === 0) queue.push(e.to)
    }
  }
  for (const id of leafIds) if (!settled.has(id)) level.set(id, level.get(id) ?? 0)

  const countInLevel = new Map<number, number>()
  const nodes: PertGraphNode[] = leaves.map((t) => {
    const lv = level.get(t.id) ?? 0
    const idx = countInLevel.get(lv) ?? 0
    countInLevel.set(lv, idx + 1)
    return { id: t.id, name: t.name, level: lv, indexInLevel: idx }
  })

  let maxLevel = 0
  for (const n of nodes) if (n.level > maxLevel) maxLevel = n.level

  return { nodes, edges, levels: maxLevel + 1 }
}
