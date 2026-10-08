import { useMemo } from 'react'
import { useProject } from '../state/ProjectContext'
import { formatDate } from '../lib/date'
import { EmptyState } from './ui'

const NODE_W = 150
const NODE_H = 64
const H_GAP = 56
const V_GAP = 22

export function AnalysisPanel() {
  const { schedule, cpm, pertRows, pertSummary, pertGraph } = useProject()
  const pertById = useMemo(() => new Map(pertRows.map((r) => [r.taskId, r] as const)), [pertRows])

  const chainTasks = cpm.chain
    .map((id) => schedule.byId.get(id))
    .filter((st): st is NonNullable<typeof st> => Boolean(st))

  const graphLayout = useMemo(() => {
    const maxIndexInLevel = new Map<number, number>()
    for (const n of pertGraph.nodes) {
      maxIndexInLevel.set(n.level, Math.max(maxIndexInLevel.get(n.level) ?? 0, n.indexInLevel))
    }
    const positions = new Map<string, { x: number; y: number }>()
    for (const n of pertGraph.nodes) {
      positions.set(n.id, {
        x: n.level * (NODE_W + H_GAP) + 16,
        y: n.indexInLevel * (NODE_H + V_GAP) + 16,
      })
    }
    let maxBottom = 0
    for (const n of pertGraph.nodes) maxBottom = Math.max(maxBottom, (n.indexInLevel + 1) * (NODE_H + V_GAP))
    return {
      positions,
      width: pertGraph.levels * (NODE_W + H_GAP) + 16,
      height: maxBottom + 24,
    }
  }, [pertGraph])

  const allTasks = [...schedule.byId.values()].sort((a, b) => a.startOffset - b.startOffset)

  const nameOf = (id: string) => schedule.byId.get(id)?.task.name ?? id

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <h2>Ringkasan Analisis</h2>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Durasi Proyek</div>
            <div className="stat-value">{cpm.projectDuration} hari kerja</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {formatDate(schedule.projectStart)} → {formatDate(schedule.projectFinish)}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Tugas Kritis</div>
            <div className="stat-value">{cpm.criticalIds.size}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Durasi Harapan (PERT)</div>
            <div className="stat-value">{pertSummary.expectedDuration}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Estimasi P95 (PERT)</div>
            <div className="stat-value">{pertSummary.p95}</div>
            <div className="muted" style={{ fontSize: 12 }}>σ = {pertSummary.stdDev}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Jalur Kritis (Critical Path)</h2>
            <div className="muted">Rantai tugas tanpa kelonggaran (float = 0).</div>
          </div>
        </div>
        <div className="pill-row" style={{ marginBottom: 14 }}>
          {chainTasks.length === 0 && <span className="muted">Tidak ada jalur kritis terdeteksi.</span>}
          {chainTasks.map((st, index) => (
            <span key={st.task.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="chip chip-critical">{st.task.name}</span>
              {index < chainTasks.length - 1 && <span className="muted">→</span>}
            </span>
          ))}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tugas</th>
                <th className="num">Durasi</th>
                <th>Mulai (ES)</th>
                <th>Selesai (EF)</th>
                <th className="num">Float</th>
              </tr>
            </thead>
            <tbody>
              {chainTasks.map((st, index) => {
                const node = cpm.nodes.get(st.task.id)
                return (
                  <tr key={st.task.id}>
                    <td>{index + 1}</td>
                    <td>{st.task.name}</td>
                    <td className="num">{st.duration}</td>
                    <td>{formatDate(st.computedStart)}</td>
                    <td>{formatDate(st.computedFinish)}</td>
                    <td className="num">{node?.float ?? 0} hari</td>
                  </tr>
                )
              })}
              {chainTasks.length === 0 && (
                <tr>
                  <td colSpan={6}><EmptyState message="Belum ada jalur kritis." /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Tabel Float (CPM)</h2>
            <div className="muted">ES/EF/LS/LF dihitung dalam hari kerja dari tanggal mulai proyek.</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tugas</th>
                <th className="num">Durasi</th>
                <th className="num">ES</th>
                <th className="num">EF</th>
                <th className="num">LS</th>
                <th className="num">LF</th>
                <th className="num">Float</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allTasks.map((st) => {
                const node = cpm.nodes.get(st.task.id)
                if (!node) return null
                return (
                  <tr key={st.task.id}>
                    <td>{st.task.name}</td>
                    <td className="num">{node.duration}</td>
                    <td className="num">{node.es}</td>
                    <td className="num">{node.ef}</td>
                    <td className="num">{node.ls}</td>
                    <td className="num">{node.lf}</td>
                    <td className="num">{node.float}</td>
                    <td>{node.critical ? <span className="chip chip-critical">Kritis</span> : <span className="muted">Longgar</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Analisis PERT</h2>
            <div className="muted">Durasi harapan te = (O + 4M + P) / 6 · Varians = ((P − O) / 6)².</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tugas</th>
                <th className="num">O</th>
                <th className="num">M</th>
                <th className="num">P</th>
                <th className="num">te</th>
                <th className="num">Varians</th>
                <th className="num">σ</th>
                <th>Jalur</th>
              </tr>
            </thead>
            <tbody>
              {pertRows.map((row) => (
                <tr key={row.taskId}>
                  <td>{row.name}</td>
                  <td className="num">{row.optimistic}</td>
                  <td className="num">{row.mostLikely}</td>
                  <td className="num">{row.pessimistic}</td>
                  <td className="num">{row.expected}</td>
                  <td className="num">{row.variance}</td>
                  <td className="num">{row.stdDev}</td>
                  <td>{row.critical ? <span className="chip chip-critical">Kritis</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Diagram PERT</h2>
            <div className="muted">Setiap simpul menampilkan O/M/P dan durasi harapan. Garis merah = jalur kritis.</div>
          </div>
        </div>
        <div className="pert-diagram">
          {pertGraph.nodes.length === 0 ? (
            <EmptyState message="Belum ada tugas untuk digambar." />
          ) : (
            <svg width={graphLayout.width} height={graphLayout.height}>
              <defs>
                <marker id="pert-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
                <marker id="pert-arrow-critical" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#e11d48" />
                </marker>
              </defs>
              {pertGraph.edges.map((e) => {
                const from = graphLayout.positions.get(e.from)
                const to = graphLayout.positions.get(e.to)
                if (!from || !to) return null
                const x1 = from.x + NODE_W
                const y1 = from.y + NODE_H / 2
                const x2 = to.x
                const y2 = to.y + NODE_H / 2
                const mid = x1 + (x2 - x1) / 2
                const critical = cpm.criticalIds.has(e.from) && cpm.criticalIds.has(e.to)
                return (
                  <path
                    key={`${e.from}-${e.to}-${e.type}-${e.lag}`}
                    d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
                    fill="none"
                    stroke={critical ? '#e11d48' : '#94a3b8'}
                    strokeWidth={critical ? 2 : 1.4}
                    markerEnd={critical ? 'url(#pert-arrow-critical)' : 'url(#pert-arrow)'}
                  />
                )
              })}
              {pertGraph.nodes.map((n) => {
                const pos = graphLayout.positions.get(n.id)
                if (!pos) return null
                const row = pertById.get(n.id)
                const critical = cpm.criticalIds.has(n.id)
                const truncated = n.name.length > 20 ? `${n.name.slice(0, 19)}…` : n.name
                return (
                  <g key={n.id}>
                    <rect
                      className={`pert-node${critical ? ' critical' : ''}`}
                      x={pos.x}
                      y={pos.y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={8}
                    />
                    <text x={pos.x + 8} y={pos.y + 18} fontSize={11} fontWeight={600} fill="#0f172a">
                      {truncated}
                    </text>
                    <text x={pos.x + 8} y={pos.y + 34} fontSize={10} fill="#64748b">
                      O/M/P: {row ? `${row.optimistic}/${row.mostLikely}/${row.pessimistic}` : '-'}
                    </text>
                    <text x={pos.x + 8} y={pos.y + 50} fontSize={10} fill="#4f46e5" fontWeight={600}>
                      te = {row ? row.expected : '-'}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Jalur kritis berisi {chainTasks.length} tugas: {chainTasks.map((s) => nameOf(s.task.id)).join(' → ') || '—'}
        </p>
      </div>
    </div>
  )
}
