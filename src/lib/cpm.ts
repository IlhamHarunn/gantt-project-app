import type { ProjectData } from '../types'
import type { ScheduleResult } from './schedule'

export interface CpmNode {
  id: string
  name: string
  duration: number
  /** Early start / finish dalam offset hari kerja. */
  es: number
  ef: number
  /** Late start / finish dalam offset hari kerja. */
  ls: number
  lf: number
  float: number
  critical: boolean
}

export interface CpmResult {
  nodes: Map<string, CpmNode>
  /** Rantai jalur kritis utama. */
  chain: string[]
  criticalIds: Set<string>
  projectDuration: number
}

interface Link {
  from: string
  to: string
  type: 'FS' | 'SS'
  lag: number
}

/**
 * Critical Path Method atas jadwal nyata (termasuk tanggal manual & kalender).
 * ES/EF diambil dari jadwal; LS/LF dihitung mundur dari akhir proyek.
 */
export function computeCpm(data: ProjectData, schedule: ScheduleResult): CpmResult {
  const links: Link[] = []
  const taskById = new Map(data.tasks.map((t) => [t.id, t] as const))
  for (const t of data.tasks) {
    for (const dep of t.dependencies) {
      if (dep.predecessorId !== t.id && taskById.has(dep.predecessorId)) {
        links.push({ from: dep.predecessorId, to: t.id, type: dep.type, lag: dep.lag })
      }
    }
  }

  const nodes = new Map<string, CpmNode>()
  let lastOffset = 0
  for (const [id, st] of schedule.byId) {
    const es = st.startOffset
    const ef = st.finishOffset
    if (ef > lastOffset) lastOffset = ef
    nodes.set(id, {
      id,
      name: st.task.name,
      duration: Math.max(1, ef - es + 1),
      es,
      ef,
      ls: es,
      lf: ef,
      float: 0,
      critical: false,
    })
  }

  const successors = new Map<string, Link[]>()
  for (const id of nodes.keys()) successors.set(id, [])
  for (const l of links) successors.get(l.from)?.push(l)

  // Inisialisasi: finish terakhir proyek.
  for (const node of nodes.values()) {
    node.lf = Math.max(node.lf, lastOffset)
    node.ls = node.lf - node.duration + 1
  }

  // Telusur mundur mengikuti urutan jadwal terbalik.
  const reverseOrder = [...schedule.order].reverse()
  for (const id of reverseOrder) {
    const succ = successors.get(id) ?? []
    const node = nodes.get(id)
    if (!node) continue
    for (const l of succ) {
      const target = nodes.get(l.to)
      const pred = nodes.get(l.from)
      if (!target || !pred) continue
      if (l.type === 'FS') {
        const candidate = target.ls - 1 - l.lag
        if (candidate < pred.lf) {
          pred.lf = candidate
          pred.ls = pred.lf - pred.duration + 1
        }
      } else {
        const candidate = target.es - l.lag
        if (candidate < pred.ls) {
          pred.ls = candidate
          pred.lf = pred.ls + pred.duration - 1
        }
      }
    }
  }

  for (const node of nodes.values()) {
    // Jaga agar LF/LS tidak lebih awal dari ES/EF nyata.
    if (node.lf < node.ef) {
      node.lf = node.ef
      node.ls = node.ef - node.duration + 1
    }
    node.float = node.lf - node.ef
    node.critical = node.float <= 0
  }

  const criticalIds = new Set<string>()
  for (const node of nodes.values()) if (node.critical) criticalIds.add(node.id)

  // Rantai kritis utama: ikuti tautan yang padat (float 0) antar tugas kritis.
  const isTight = (l: Link): boolean => {
    const pred = nodes.get(l.from)
    const target = nodes.get(l.to)
    if (!pred || !target || !pred.critical || !target.critical) return false
    if (l.type === 'FS') return Math.abs(target.ls - 1 - l.lag - pred.lf) < 1e-6
    return Math.abs(target.es - l.lag - pred.ls) < 1e-6
  }

  const hasCriticalPred = new Set<string>()
  for (const l of links) {
    if (isTight(l)) hasCriticalPred.add(l.to)
  }

  const starts = [...criticalIds]
    .filter((id) => !hasCriticalPred.has(id))
    .map((id) => nodes.get(id) as CpmNode)
    .sort((a, b) => a.es - b.es)
  const chain: string[] = []
  if (starts.length > 0) {
    let current = starts[0]
    const visited = new Set<string>()
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      chain.push(current.id)
      const next = (successors.get(current.id) ?? [])
        .filter(isTight)
        .map((l) => nodes.get(l.to) as CpmNode)
        .filter(Boolean)
        .sort((a, b) => a.es - b.es)[0]
      if (!next) break
      current = next
    }
  }

  const projectDuration = lastOffset + 1
  return { nodes, chain, criticalIds, projectDuration }
}
