import { useState } from 'react'
import { ProjectProvider, useProject } from './state/ProjectContext'
import { TaskPanel } from './components/TaskPanel'
import { GanttChart } from './components/GanttChart'
import { ResourcePanel } from './components/ResourcePanel'
import { CalendarPanel } from './components/CalendarPanel'
import { AnalysisPanel } from './components/AnalysisPanel'

type TabId = 'tasks' | 'gantt' | 'resources' | 'calendar' | 'analysis'

const TABS: { id: TabId; label: string }[] = [
  { id: 'tasks', label: 'Tugas' },
  { id: 'gantt', label: 'Gantt Chart' },
  { id: 'resources', label: 'Sumber Daya' },
  { id: 'calendar', label: 'Kalender' },
  { id: 'analysis', label: 'Analisis' },
]

function Shell() {
  const { data, actions, schedule, cpm } = useProject()
  const [tab, setTab] = useState<TabId>('tasks')

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <div className="brand">
            <div className="brand-logo">📊</div>
            <div>
              <input
                className="project-name-input"
                value={data.name}
                onChange={(e) => actions.setName(e.target.value)}
                aria-label="Nama proyek"
              />
              <small>
                Manajemen Proyek Gantt · {data.tasks.length} tugas · {data.members.length} anggota ·{' '}
                {cpm.projectDuration} hari kerja · mulai {schedule.projectStart}
              </small>
            </div>
          </div>
          <div className="header-actions">
            <button type="button" className="btn" onClick={() => actions.reset()}>
              Muat Data Contoh
            </button>
            <button type="button" className="btn" onClick={() => setTab('gantt')}>
              Lihat Gantt
            </button>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {tab === 'tasks' && <TaskPanel />}
        {tab === 'gantt' && <GanttChart />}
        {tab === 'resources' && <ResourcePanel />}
        {tab === 'calendar' && <CalendarPanel />}
        {tab === 'analysis' && <AnalysisPanel />}
        <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
          Data tersimpan otomatis di localStorage browser Anda.
        </p>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  )
}
