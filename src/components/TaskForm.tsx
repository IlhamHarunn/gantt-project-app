import { useMemo, useState } from 'react'
import type { Assignment, Dependency, DependencyType, Priority, Task } from '../types'
import { useProject } from '../state/ProjectContext'
import { createId } from '../lib/id'
import { Field, Modal } from './ui'

interface Props {
  taskId: string | null
  defaultParentId?: string | null
  onClose: () => void
}

const PALETTE = ['#4f46e5', '#0891b2', '#7c3aed', '#059669', '#d97706', '#dc2626', '#db2777', '#0d9488']

function toDependency(input: Partial<Dependency>): Dependency {
  return {
    id: input.id ?? createId('dep'),
    predecessorId: input.predecessorId ?? '',
    type: input.type ?? 'FS',
    lag: input.lag ?? 0,
  }
}

export function TaskForm({ taskId, defaultParentId = null, onClose }: Props) {
  const { data, actions } = useProject()
  const existing = taskId ? data.tasks.find((t) => t.id === taskId) ?? null : null

  const [name, setName] = useState(existing?.name ?? '')
  const [parentId, setParentId] = useState<string>(existing?.parentId ?? defaultParentId ?? '')
  const [durationDays, setDurationDays] = useState(existing?.durationDays ?? 3)
  const [startDate, setStartDate] = useState(existing?.startDate ?? data.calendar.projectStart)
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 'Medium')
  const [color, setColor] = useState(existing?.color ?? PALETTE[0])
  const [progress, setProgress] = useState(existing?.progress ?? 0)
  const [usePert, setUsePert] = useState(Boolean(existing?.estimates))
  const [optimistic, setOptimistic] = useState(existing?.estimates?.optimistic ?? Math.max(1, Math.round((existing?.durationDays ?? 3) * 0.8)))
  const [mostLikely, setMostLikely] = useState(existing?.estimates?.mostLikely ?? existing?.durationDays ?? 3)
  const [pessimistic, setPessimistic] = useState(existing?.estimates?.pessimistic ?? Math.round((existing?.durationDays ?? 3) * 1.3))
  const [assignments, setAssignments] = useState<Assignment[]>(existing?.assignments ?? [])
  const [dependencies, setDependencies] = useState<Dependency[]>(existing?.dependencies ?? [])
  const [error, setError] = useState('')

  const hasChildren = useMemo(
    () => data.tasks.some((t) => t.parentId === existing?.id),
    [data.tasks, existing?.id],
  )

  const descendantIds = useMemo(() => {
    if (!existing) return new Set<string>()
    const ids = new Set<string>([existing.id])
    let changed = true
    while (changed) {
      changed = false
      for (const t of data.tasks) {
        if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) {
          ids.add(t.id)
          changed = true
        }
      }
    }
    return ids
  }, [data.tasks, existing])

  const parentOptions = data.tasks.filter((t) => !descendantIds.has(t.id))
  const predecessorOptions = data.tasks.filter((t) => !descendantIds.has(t.id))

  const submit = () => {
    if (!name.trim()) {
      setError('Nama tugas wajib diisi.')
      return
    }
    const estimates = usePert
      ? { optimistic, mostLikely, pessimistic }
      : null
    const patch = {
      name: name.trim(),
      parentId: parentId || null,
      durationDays: Math.max(1, Math.round(durationDays)),
      startDate,
      priority,
      color,
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      assignments,
      dependencies: dependencies.filter((d) => d.predecessorId),
      estimates,
    }
    if (existing) {
      actions.updateTask(existing.id, patch as Partial<Task>)
    } else {
      actions.addTask(patch)
    }
    onClose()
  }

  return (
    <Modal title={existing ? 'Edit Tugas' : 'Tambah Tugas'} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Nama tugas">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Pengembangan Modul" />
        </Field>
        <Field label="Tugas induk (opsional)">
          <select className="select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Tanpa induk (level atas) —</option>
            {parentOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Durasi (hari kerja)">
          <input
            className="input"
            type="number"
            min={1}
            value={durationDays}
            disabled={hasChildren}
            onChange={(e) => setDurationDays(Number(e.target.value))}
          />
        </Field>
        <Field label="Tanggal mulai">
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Prioritas">
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </Field>
        <Field label="Warna indikator">
          <input className="input" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>
        <Field label={`Progres: ${progress}%`}>
          <input className="input" type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
        </Field>
      </div>

      {hasChildren && (
        <p className="muted" style={{ marginTop: 8 }}>
          Tugas ini memiliki sub-tugas; durasi dan tanggalnya mengikuti rentang sub-tugas.
        </p>
      )}

      <h4 style={{ marginTop: 20 }}>Estimasi PERT</h4>
      <label className="pill-row" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={usePert} onChange={(e) => setUsePert(e.target.checked)} />
        <span>Gunakan estimasi Optimistis / Most Likely / Pesimistis</span>
      </label>
      {usePert && (
        <div className="form-grid">
          <Field label="Optimistis (O)">
            <input className="input" type="number" min={1} value={optimistic} onChange={(e) => setOptimistic(Number(e.target.value))} />
          </Field>
          <Field label="Most Likely (M)">
            <input className="input" type="number" min={1} value={mostLikely} onChange={(e) => setMostLikely(Number(e.target.value))} />
          </Field>
          <Field label="Pesimistis (P)">
            <input className="input" type="number" min={1} value={pessimistic} onChange={(e) => setPessimistic(Number(e.target.value))} />
          </Field>
        </div>
      )}

      <h4 style={{ marginTop: 20 }}>Pendahulu (Predecessors)</h4>
      <div className="inline-list">
        {dependencies.map((d, index) => (
          <div className="dep-row" key={d.id}>
            <select
              className="select"
              value={d.predecessorId}
              onChange={(e) =>
                setDependencies((prev) => prev.map((x, i) => (i === index ? { ...x, predecessorId: e.target.value } : x)))
              }
            >
              <option value="">— Pilih tugas —</option>
              {predecessorOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={d.type}
              onChange={(e) =>
                setDependencies((prev) => prev.map((x, i) => (i === index ? { ...x, type: e.target.value as DependencyType } : x)))
              }
            >
              <option value="FS">Finish-to-Start</option>
              <option value="SS">Start-to-Start</option>
            </select>
            <input
              className="input"
              type="number"
              value={d.lag}
              title="Jeda hari kerja (lag, boleh negatif)"
              onChange={(e) =>
                setDependencies((prev) => prev.map((x, i) => (i === index ? { ...x, lag: Number(e.target.value) } : x)))
              }
            />
            <button type="button" className="btn btn-danger btn-small" onClick={() => setDependencies((prev) => prev.filter((_, i) => i !== index))}>
              Hapus
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-small" onClick={() => setDependencies((prev) => [...prev, toDependency({})])}>
          + Tambah pendahulu
        </button>
      </div>

      <h4 style={{ marginTop: 20 }}>Alokasi anggota</h4>
      <div className="inline-list">
        {assignments.map((a, index) => (
          <div className="allocation-row" key={`${a.memberId}-${index}`}>
            <select
              className="select"
              value={a.memberId}
              onChange={(e) =>
                setAssignments((prev) => prev.map((x, i) => (i === index ? { ...x, memberId: e.target.value } : x)))
              }
            >
              <option value="">— Pilih anggota —</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.role}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              value={a.allocation}
              title="Alokasi (%)"
              onChange={(e) =>
                setAssignments((prev) => prev.map((x, i) => (i === index ? { ...x, allocation: Number(e.target.value) } : x)))
              }
            />
            <span className="muted">%</span>
            <button type="button" className="btn btn-danger btn-small" onClick={() => setAssignments((prev) => prev.filter((_, i) => i !== index))}>
              Hapus
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-small" onClick={() => setAssignments((prev) => [...prev, { memberId: '', allocation: 100 }])}>
          + Alokasikan anggota
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>
          Batal
        </button>
        <button type="button" className="btn btn-primary" onClick={submit}>
          {existing ? 'Simpan Perubahan' : 'Tambah Tugas'}
        </button>
      </div>
    </Modal>
  )
}
