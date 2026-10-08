import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ScheduledTask } from '../lib/schedule'
import { useProject } from '../state/ProjectContext'
import { addDays, compareISO, daysBetween, dayName, eachDay, formatDate, getWeekday, todayISO } from '../lib/date'
import { isHoliday, isWeekend, workingDaysBetween } from '../lib/calendar'

interface GanttRow {
  st: ScheduledTask
  depth: number
}

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 52
const LEFT_WIDTH = 300

export function GanttChart() {
  const { data, schedule, cpm, actions } = useProject()
  const [dayWidth, setDayWidth] = useState(30)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showDeps, setShowDeps] = useState(true)
  const [showCritical, setShowCritical] = useState(true)
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'resize'; deltaDays: number } | null>(null)
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; origStart: string; origFinish: string; deltaDays: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const roots = useMemo(
    () => data.tasks.filter((t) => !t.parentId || !data.tasks.some((p) => p.id === t.parentId)),
    [data.tasks],
  )

  const rows: GanttRow[] = useMemo(() => {
    const result: GanttRow[] = []
    const visit = (id: string, depth: number) => {
      const st = schedule.byId.get(id)
      if (!st) return
      result.push({ st, depth })
      if (collapsed.has(id)) return
      for (const child of data.tasks.filter((t) => t.parentId === id)) visit(child.id, depth + 1)
    }
    for (const root of roots) visit(root.id, 0)
    return result
  }, [roots, data.tasks, schedule, collapsed])

  const { timelineStart, days } = useMemo(() => {
    let min = schedule.projectStart
    let max = schedule.projectStart
    for (const st of schedule.byId.values()) {
      if (compareISO(st.computedStart, min) < 0) min = st.computedStart
      if (compareISO(st.computedFinish, max) > 0) max = st.computedFinish
    }
    const start = addDays(min, -getWeekday(min))
    const end = addDays(max, 3)
    return { timelineStart: start, days: eachDay(start, end) }
  }, [schedule])

  const timelineWidth = days.length * dayWidth
  const bodyHeight = rows.length * ROW_HEIGHT
  const today = todayISO()

  const xOf = (iso: string) => daysBetween(timelineStart, iso) * dayWidth
  const widthOf = (startISO: string, finishISO: string) =>
    (daysBetween(startISO, finishISO) + 1) * dayWidth

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((r, i) => map.set(r.st.task.id, i))
    return map
  }, [rows])

  const months = useMemo(() => {
    const blocks: { label: string; start: number; width: number }[] = []
    days.forEach((day, index) => {
      const label = dayMonthLabel(day)
      const last = blocks[blocks.length - 1]
      if (last && last.label === label) {
        last.width += dayWidth
      } else {
        blocks.push({ label, start: index * dayWidth, width: dayWidth })
      }
    })
    return blocks
  }, [days, dayWidth])

  const aria = (iso: string) => isHoliday(iso, data.calendar) ? 'holiday' : isWeekend(iso, data.calendar) ? 'weekend' : ''

  const scrollToToday = () => {
    const el = scrollRef.current
    if (!el) return
    const x = xOf(today)
    el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2 + LEFT_WIDTH), behavior: 'smooth' })
  }

  const onPointerDown = (
    e: ReactPointerEvent<HTMLElement>,
    st: ScheduledTask,
    mode: 'move' | 'resize',
  ) => {
    if (st.isSummary) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      id: st.task.id,
      mode,
      startX: e.clientX,
      origStart: st.computedStart,
      origFinish: st.computedFinish,
      deltaDays: 0,
    }
    setDrag({ id: st.task.id, mode, deltaDays: 0 })
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d) return
    const delta = Math.round((e.clientX - d.startX) / dayWidth)
    if (delta !== d.deltaDays) {
      d.deltaDays = delta
      setDrag({ id: d.id, mode: d.mode, deltaDays: delta })
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* pointer may already be released */
    }
    dragRef.current = null
    setDrag(null)
    if (d.deltaDays === 0) return
    if (d.mode === 'move') {
      actions.updateTask(d.id, { startDate: addDays(d.origStart, d.deltaDays) })
    } else {
      const newFinish = addDays(d.origFinish, d.deltaDays)
      const duration = Math.max(1, workingDaysBetween(d.origStart, newFinish, data.calendar))
      actions.updateTask(d.id, { durationDays: duration })
    }
  }

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const barRect = (id: string) => {
    const st = schedule.byId.get(id)
    const index = rowIndexById.get(id)
    if (!st || index === undefined) return null
    return {
      x: xOf(st.computedStart),
      width: widthOf(st.computedStart, st.computedFinish),
      y: index * ROW_HEIGHT + ROW_HEIGHT / 2,
    }
  }

  const arrows = useMemo(() => {
    const list: { key: string; d: string; critical: boolean }[] = []
    if (!showDeps) return list
    for (const { st } of rows) {
      for (const dep of st.task.dependencies) {
        const from = barRect(dep.predecessorId)
        const to = barRect(st.task.id)
        if (!from || !to) continue
        const sx = dep.type === 'SS' ? from.x : from.x + from.width
        const ex = to.x
        const sy = from.y
        const ey = to.y
        const gap = 12
        let d: string
        if (ex >= sx + gap) {
          const mid = (sx + ex) / 2
          d = `M ${sx} ${sy} H ${mid} V ${ey} H ${ex}`
        } else {
          d = `M ${sx} ${sy} h ${gap} V ${ey} H ${ex}`
        }
        const critical =
          showCritical && cpm.criticalIds.has(st.task.id) && cpm.criticalIds.has(dep.predecessorId)
        list.push({ key: `${dep.id}-${st.task.id}`, d, critical })
      }
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, dayWidth, showDeps, showCritical, schedule, cpm, timelineStart])

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Gantt Chart</h2>
          <div className="muted">
            {formatDate(timelineStart)} – {formatDate(days[days.length - 1] ?? timelineStart)} · tarik bar untuk memindah, tarik tepi kanan untuk mengubah durasi
          </div>
        </div>
      </div>

      <div className="gantt">
        <div className="gantt-toolbar">
          <button type="button" className="btn btn-small" onClick={() => setDayWidth((w) => Math.max(12, w - 6))}>
            − Zoom
          </button>
          <span className="muted">{dayWidth}px/hari</span>
          <button type="button" className="btn btn-small" onClick={() => setDayWidth((w) => Math.min(80, w + 6))}>
            + Zoom
          </button>
          <button type="button" className="btn btn-small" onClick={scrollToToday}>
            Hari ini
          </button>
          <label className="pill-row">
            <input type="checkbox" checked={showDeps} onChange={(e) => setShowDeps(e.target.checked)} />
            <span>Dependensi</span>
          </label>
          <label className="pill-row">
            <input type="checkbox" checked={showCritical} onChange={(e) => setShowCritical(e.target.checked)} />
            <span>Jalur kritis</span>
          </label>
          <div className="legend">
            <span className="legend-item"><span className="legend-swatch" style={{ background: 'rgba(148,163,184,0.35)' }} /> Akhir pekan</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: 'rgba(244,63,94,0.25)' }} /> Libur</span>
            <span className="legend-item"><span className="legend-swatch" style={{ borderColor: 'var(--critical)', background: '#fff' }} /> Kritis</span>
          </div>
        </div>

        <div className="gantt-scroll" ref={scrollRef}>
          <div className="gantt-inner" style={{ height: HEADER_HEIGHT + bodyHeight }}>
            {/* Left task column */}
            <div className="gantt-left" style={{ width: LEFT_WIDTH }}>
              <div className="gantt-left-head">Tugas</div>
              {rows.map(({ st, depth }) => {
                const childCount = data.tasks.filter((t) => t.parentId === st.task.id).length
                return (
                  <div key={st.task.id} className={`gantt-left-row${st.isSummary ? ' summary' : ''}`}>
                    <div className="task-name" style={{ paddingLeft: depth * 14 }}>
                      {childCount > 0 ? (
                        <button type="button" className="tree-toggle" onClick={() => toggle(st.task.id)}>
                          {collapsed.has(st.task.id) ? '▶' : '▼'}
                        </button>
                      ) : (
                        <span style={{ width: 18 }} />
                      )}
                      <span className="color-dot" style={{ background: st.task.color }} />
                      <span className="gantt-left-name" title={st.task.name}>{st.task.name}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Timeline */}
            <div className="gantt-right" style={{ width: timelineWidth }}>
              <div className="gantt-header" style={{ width: timelineWidth }}>
                {months.map((m) => (
                  <div key={`${m.label}-${m.start}`} className="gantt-month" style={{ left: m.start, width: m.width }}>
                    {m.label}
                  </div>
                ))}
                {days.map((day, index) => {
                  const kind = aria(day)
                  return (
                    <div
                      key={day}
                      className={`gantt-day${kind === 'weekend' ? ' weekend' : ''}${kind === 'holiday' ? ' holiday' : ''}`}
                      style={{ left: index * dayWidth, width: dayWidth }}
                    >
                      <span>{dayName(day)}</span>
                      <span>{day.slice(8, 10)}</span>
                    </div>
                  )
                })}
              </div>

              <div className="gantt-body" style={{ height: bodyHeight, width: timelineWidth }}>
                {/* Background columns */}
                {days.map((day, index) => {
                  const kind = aria(day)
                  return (
                    <div
                      key={`col-${day}`}
                      className={`gantt-col${kind ? ` ${kind}` : ''}`}
                      style={{ left: index * dayWidth, width: dayWidth }}
                    />
                  )
                })}

                {/* Row guides */}
                {rows.map(({ st }, index) => (
                  <div
                    key={`row-${st.task.id}`}
                    className="gantt-row"
                    style={{ position: 'absolute', top: index * ROW_HEIGHT, left: 0, width: timelineWidth }}
                  />
                ))}

                {today >= timelineStart && today <= (days[days.length - 1] ?? today) && (
                  <div className="gantt-today" style={{ left: xOf(today) }} title={`Hari ini: ${formatDate(today)}`} />
                )}

                {/* Bars */}
                {rows.map(({ st }, index) => {
                  const baseX = xOf(st.computedStart)
                  const baseWidth = widthOf(st.computedStart, st.computedFinish)
                  const isDragging = drag?.id === st.task.id
                  let x = baseX
                  let width = baseWidth
                  if (isDragging && drag) {
                    if (drag.mode === 'move') x += drag.deltaDays * dayWidth
                    else width = Math.max(dayWidth * 0.6, width + drag.deltaDays * dayWidth)
                  }
                  const critical = showCritical && cpm.criticalIds.has(st.task.id)
                  return (
                    <div
                      key={`bar-${st.task.id}`}
                      className={`gantt-bar${st.isSummary ? ' summary' : ''}${critical ? ' critical' : ''}`}
                      style={{
                        left: x,
                        top: index * ROW_HEIGHT + (st.isSummary ? 11 : 6),
                        width,
                        background: st.isSummary ? '#334155' : st.task.color,
                        cursor: st.isSummary ? 'default' : 'grab',
                        zIndex: isDragging ? 5 : 1,
                      }}
                      title={`${st.task.name}\n${formatDate(st.computedStart)} → ${formatDate(st.computedFinish)}\n${st.duration} hari kerja`}
                      onPointerDown={(e) => onPointerDown(e, st, 'move')}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                    >
                      {!st.isSummary && (
                        <>
                          <span className="gantt-bar-progress" style={{ width: `${Math.max(0, Math.min(100, st.task.progress))}%` }} />
                          <span className="gantt-bar-label">{st.task.name}</span>
                          <span
                            className="gantt-resize"
                            onPointerDown={(e) => {
                              e.stopPropagation()
                              onPointerDown(e, st, 'resize')
                            }}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                          />
                        </>
                      )}
                    </div>
                  )
                })}

                {/* Dependency arrows */}
                <svg className="gantt-svg" width={timelineWidth} height={bodyHeight}>
                  <defs>
                    <marker id="gantt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                    </marker>
                    <marker id="gantt-arrow-critical" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#e11d48" />
                    </marker>
                  </defs>
                  {arrows.map((a) => (
                    <path
                      key={a.key}
                      d={a.d}
                      fill="none"
                      stroke={a.critical ? '#e11d48' : '#94a3b8'}
                      strokeWidth={a.critical ? 2 : 1.5}
                      markerEnd={a.critical ? 'url(#gantt-arrow-critical)' : 'url(#gantt-arrow)'}
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {drag && <p className="muted" style={{ marginTop: 8 }}>Geser {drag.deltaDays} hari…</p>}
      {rows.length === 0 && <div className="empty-state" style={{ marginTop: 12 }}>Belum ada tugas untuk ditampilkan.</div>}
    </div>
  )
}

function dayMonthLabel(iso: string): string {
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const month = Number(iso.slice(5, 7)) - 1
  return `${MONTHS[month]} ${iso.slice(0, 4)}`
}
