import { useMemo, useState } from 'react'
import { useProject } from '../state/ProjectContext'
import { isHoliday, isWeekend, workingDaysBetween } from '../lib/calendar'
import { addDays, formatDate, getWeekday, toISO } from '../lib/date'
import { EmptyState, Field } from './ui'

const WEEKDAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export function CalendarPanel() {
  const { data, schedule, actions } = useProject()
  const cal = data.calendar
  const [holidayDate, setHolidayDate] = useState(cal.projectStart)
  const [holidayName, setHolidayName] = useState('')
  const [viewMonth, setViewMonth] = useState(() => cal.projectStart.slice(0, 7))

  const holidays = useMemo(
    () => [...cal.holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [cal.holidays],
  )

  const totalWorkingDays = workingDaysBetween(schedule.projectStart, schedule.projectFinish, cal)

  const toggleWeekend = (day: number) => {
    const has = cal.weekendDays.includes(day)
    const next = has ? cal.weekendDays.filter((d) => d !== day) : [...cal.weekendDays, day]
    actions.setCalendar({ weekendDays: next.sort((a, b) => a - b) })
  }

  const addHoliday = () => {
    if (!holidayDate) return
    actions.addHoliday({ date: holidayDate, name: holidayName.trim() || 'Hari Libur' })
    setHolidayName('')
  }

  const shiftMonth = (delta: number) => {
    const [year, month] = viewMonth.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1 + delta, 1))
    setViewMonth(toISO(date).slice(0, 7))
  }

  const monthGrid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Kalender Proyek</h2>
            <div className="muted">Perhitungan durasi hanya menghitung hari kerja.</div>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <Field label="Tanggal mulai proyek">
              <input
                className="input"
                type="date"
                value={cal.projectStart}
                onChange={(e) => actions.setCalendar({ projectStart: e.target.value })}
              />
            </Field>

            <h4 style={{ marginTop: 18 }}>Hari akhir pekan</h4>
            <div className="weekday-picker">
              {WEEKDAY_LABELS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className={`weekday-toggle${cal.weekendDays.includes(day) ? ' active' : ''}`}
                  onClick={() => toggleWeekend(day)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="stat-grid" style={{ marginTop: 18 }}>
              <div className="stat">
                <div className="stat-label">Mulai</div>
                <div className="stat-value" style={{ fontSize: 15 }}>{formatDate(schedule.projectStart)}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Selesai</div>
                <div className="stat-value" style={{ fontSize: 15 }}>{formatDate(schedule.projectFinish)}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Hari Kerja</div>
                <div className="stat-value">{totalWorkingDays}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="card-head" style={{ marginBottom: 8 }}>
              <button type="button" className="btn btn-small" onClick={() => shiftMonth(-1)}>◀</button>
              <strong>{MONTHS[Number(viewMonth.slice(5, 7)) - 1]} {viewMonth.slice(0, 4)}</strong>
              <button type="button" className="btn btn-small" onClick={() => shiftMonth(1)}>▶</button>
            </div>
            <table className="table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
                    <th key={d} style={{ textAlign: 'center' }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthGrid.map((week, i) => (
                  <tr key={i}>
                    {week.map((day, j) => {
                      if (!day) return <td key={j} />
                      const weekend = isWeekend(day, cal)
                      const holiday = isHoliday(day, cal)
                      return (
                        <td
                          key={j}
                          style={{
                            textAlign: 'center',
                            background: holiday ? 'rgba(244,63,94,0.12)' : weekend ? '#f1f5f9' : undefined,
                            color: holiday ? '#be123c' : weekend ? 'var(--text-muted)' : undefined,
                          }}
                        >
                          {Number(day.slice(8, 10))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 12 }}>
              Abu-abu = akhir pekan, merah muda = hari libur khusus.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Hari Libur Khusus</h2>
          <span className="muted">{holidays.length} hari libur</span>
        </div>

        <div className="form-row">
          <Field label="Tanggal">
            <input className="input" type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
          </Field>
          <Field label="Keterangan">
            <input className="input" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="mis. Hari Kemerdekaan" />
          </Field>
          <button type="button" className="btn btn-primary" onClick={addHoliday}>
            + Tambah Libur
          </button>
        </div>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Hari</th>
                <th>Keterangan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id}>
                  <td>{formatDate(h.date)}</td>
                  <td>{WEEKDAY_LABELS[getWeekday(h.date)]}</td>
                  <td>{h.name}</td>
                  <td>
                    <button type="button" className="btn btn-danger btn-small" onClick={() => actions.removeHoliday(h.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState message="Belum ada hari libur khusus." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Menyusun grid kalender bulan (baris x 7) untuk bulan yyyy-mm. */
function buildMonthGrid(viewMonth: string): (string | null)[][] {
  const [year, month] = viewMonth.split('-').map(Number)
  const first = toISO(new Date(Date.UTC(year, month - 1, 1)))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const leading = getWeekday(first)
  const cells: (string | null)[] = Array.from({ length: leading }, () => null)
  for (let d = 0; d < daysInMonth; d += 1) {
    cells.push(addDays(first, d))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
