import { useMemo, useState } from 'react'
import type { Task } from '../types'
import { useProject } from '../state/ProjectContext'
import { formatDate } from '../lib/date'
import { PriorityBadge, ProgressBar } from './ui'
import { TaskForm } from './TaskForm'

interface Row {
  task: Task
  depth: number
}

export function TaskPanel() {
  const { data, schedule, cpm, actions } = useProject()
  const [editing, setEditing] = useState<{ id: string | null; parentId: string | null } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const roots = useMemo(
    () => data.tasks.filter((t) => !t.parentId || !data.tasks.some((p) => p.id === t.parentId)),
    [data.tasks],
  )

  const rows = useMemo(() => {
    const result: Row[] = []
    const visit = (task: Task, depth: number) => {
      result.push({ task, depth })
      if (collapsed.has(task.id)) return
      for (const child of data.tasks.filter((t) => t.parentId === task.id)) {
        visit(child, depth + 1)
      }
    }
    for (const root of roots) visit(root, 0)
    return result
  }, [roots, data.tasks, collapsed])

  const memberName = (id: string) => data.members.find((m) => m.id === id)?.name ?? '?'

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const remove = (task: Task) => {
    const count = data.tasks.filter((t) => t.parentId === task.id).length
    const message = count > 0
      ? `Hapus "${task.name}" beserta ${count} sub-tugasnya?`
      : `Hapus tugas "${task.name}"?`
    if (window.confirm(message)) actions.deleteTask(task.id)
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Manajemen Tugas</h2>
          <div className="muted">{data.tasks.length} tugas pada proyek ini</div>
        </div>
        <div className="task-toolbar">
          <button type="button" className="btn" onClick={() => setCollapsed(new Set())}>
            Buka semua
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setCollapsed(new Set(data.tasks.filter((t) => data.tasks.some((c) => c.parentId === t.id)).map((t) => t.id)))}
          >
            Tutup semua
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ id: null, parentId: null })}>
            + Tugas Baru
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ minWidth: 260 }}>Nama Tugas</th>
              <th>Durasi</th>
              <th>Mulai</th>
              <th>Selesai</th>
              <th>Prioritas</th>
              <th style={{ minWidth: 110 }}>Progres</th>
              <th>Sumber Daya</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ task, depth }) => {
              const st = schedule.byId.get(task.id)
              const isSummary = st?.isSummary ?? false
              const isCritical = cpm.criticalIds.has(task.id)
              const childCount = data.tasks.filter((t) => t.parentId === task.id).length
              return (
                <tr key={task.id} className={isSummary ? 'summary-row' : ''}>
                  <td>
                    <div className="task-name" style={{ paddingLeft: depth * 18 }}>
                      {childCount > 0 ? (
                        <button type="button" className="tree-toggle" onClick={() => toggle(task.id)}>
                          {collapsed.has(task.id) ? '▶' : '▼'}
                        </button>
                      ) : (
                        <span style={{ width: 18 }} />
                      )}
                      <span className="color-dot" style={{ background: task.color }} />
                      <span>{task.name}</span>
                      {isCritical && <span className="chip chip-critical">Kritis</span>}
                      {st?.cycle && <span className="chip">siklus</span>}
                    </div>
                  </td>
                  <td>{st?.duration ?? task.durationDays} hari</td>
                  <td>{st ? formatDate(st.computedStart) : '-'}</td>
                  <td>{st ? formatDate(st.computedFinish) : '-'}</td>
                  <td><PriorityBadge priority={task.priority} /></td>
                  <td>
                    <ProgressBar value={task.progress} />
                    <span className="muted" style={{ fontSize: 11 }}>{task.progress}%</span>
                  </td>
                  <td>
                    <div className="pill-row">
                      {task.assignments.length === 0 && <span className="muted">—</span>}
                      {task.assignments.map((a) => (
                        <span className="chip" key={`${task.id}-${a.memberId}`}>
                          {memberName(a.memberId)} · {a.allocation}%
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="pill-row">
                      <button type="button" className="btn btn-small" onClick={() => setEditing({ id: task.id, parentId: null })}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-small" onClick={() => setEditing({ id: null, parentId: task.id })}>
                        +Sub
                      </button>
                      <button type="button" className="btn btn-danger btn-small" onClick={() => remove(task)}>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">Belum ada tugas. Klik “+ Tugas Baru” untuk memulai.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <TaskForm taskId={editing.id} defaultParentId={editing.parentId} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
