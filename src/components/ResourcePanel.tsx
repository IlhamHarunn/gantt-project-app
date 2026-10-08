import { useMemo, useState } from 'react'
import type { Member } from '../types'
import { useProject } from '../state/ProjectContext'
import { assignmentCost, dailyRate, formatCurrency } from '../lib/cost'
import { formatDate } from '../lib/date'
import { EmptyState, Field, Modal } from './ui'

interface FormState {
  id: string | null
  name: string
  email: string
  role: string
  monthlySalary: number
}

const EMPTY: FormState = { id: null, name: '', email: '', role: '', monthlySalary: 0 }

export function ResourcePanel() {
  const { data, schedule, costs, actions } = useProject()
  const [form, setForm] = useState<FormState | null>(null)

  const memberStats = useMemo(() => {
    return data.members.map((m) => {
      const tasks = [...schedule.byId.values()].filter((st) =>
        st.task.assignments.some((a) => a.memberId === m.id),
      )
      const personDays = tasks.reduce((sum, st) => {
        const a = st.task.assignments.find((x) => x.memberId === m.id)
        return sum + (a ? (a.allocation / 100) * st.duration : 0)
      }, 0)
      const cost = costs.byMember.get(m.id) ?? 0
      return { member: m, tasks, personDays, cost }
    })
  }, [data.members, schedule, costs])

  const totalSalary = data.members.reduce((s, m) => s + m.monthlySalary, 0)
  const maxPersonDays = Math.max(1, ...memberStats.map((s) => s.personDays))

  const submit = () => {
    if (!form) return
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role.trim(),
      monthlySalary: Math.max(0, form.monthlySalary),
    }
    if (form.id) actions.updateMember(form.id, payload)
    else actions.addMember(payload)
    setForm(null)
  }

  const remove = (member: Member) => {
    if (window.confirm(`Hapus anggota "${member.name}"? Alokasinya pada tugas juga akan dihapus.`)) {
      actions.deleteMember(member.id)
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Sumber Daya Tim</h2>
            <div className="muted">{data.members.length} anggota terdaftar</div>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>
            + Anggota Baru
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th className="num">Gaji/Bulan</th>
                <th className="num">Tarif/Hari</th>
                <th>Beban (person-day)</th>
                <th className="num">Biaya Tugas</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {memberStats.map(({ member, personDays, cost }) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td className="muted">{member.email}</td>
                  <td>{member.role}</td>
                  <td className="num">{formatCurrency(member.monthlySalary)}</td>
                  <td className="num">{formatCurrency(dailyRate(member))}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress" style={{ width: 90 }}>
                        <div className="progress-fill" style={{ width: `${(personDays / maxPersonDays) * 100}%` }} />
                      </div>
                      <span>{Math.round(personDays)}</span>
                    </div>
                  </td>
                  <td className="num">{formatCurrency(cost)}</td>
                  <td>
                    <div className="pill-row">
                      <button type="button" className="btn btn-small" onClick={() => setForm({ ...member, id: member.id })}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-danger btn-small" onClick={() => remove(member)}>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.members.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState message="Belum ada anggota tim." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="stat">
            <div className="stat-label">Total Gaji/Bulan</div>
            <div className="stat-value">{formatCurrency(totalSalary)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Total Biaya Tugas</div>
            <div className="stat-value">{formatCurrency(costs.total)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Total Person-Day</div>
            <div className="stat-value">{Math.round(memberStats.reduce((s, m) => s + m.personDays, 0))}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Alokasi Anggota ke Tugas</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Anggota</th>
                <th>Tugas</th>
                <th>Periode</th>
                <th>Durasi</th>
                <th className="num">Alokasi</th>
                <th className="num">Biaya</th>
              </tr>
            </thead>
            <tbody>
              {memberStats.flatMap(({ member, tasks }) =>
                tasks.map((st) => {
                  const a = st.task.assignments.find((x) => x.memberId === member.id)
                  const allocation = a?.allocation ?? 0
                  return (
                    <tr key={`${member.id}-${st.task.id}`}>
                      <td>{member.name}</td>
                      <td>{st.task.name}</td>
                      <td className="muted">
                        {formatDate(st.computedStart)} → {formatDate(st.computedFinish)}
                      </td>
                      <td>{st.duration} hari</td>
                      <td className="num">{allocation}%</td>
                      <td className="num">{formatCurrency(assignmentCost(member, allocation, st.duration))}</td>
                    </tr>
                  )
                }),
              )}
              {memberStats.every((m) => m.tasks.length === 0) && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState message="Belum ada alokasi anggota ke tugas." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title={form.id ? 'Edit Anggota' : 'Anggota Baru'} onClose={() => setForm(null)}>
          <div className="form-grid">
            <Field label="Nama">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Peran">
              <input className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="mis. Backend Developer" />
            </Field>
            <Field label="Gaji bulanan (Rp)">
              <input
                className="input"
                type="number"
                min={0}
                value={form.monthlySalary}
                onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setForm(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" onClick={submit}>
              {form.id ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
