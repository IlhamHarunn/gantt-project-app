import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import App from '../../App'
import { TaskPanel } from '../../components/TaskPanel'
import { GanttChart } from '../../components/GanttChart'
import { ResourcePanel } from '../../components/ResourcePanel'
import { CalendarPanel } from '../../components/CalendarPanel'
import { AnalysisPanel } from '../../components/AnalysisPanel'
import { ProjectProvider } from '../../state/ProjectContext'

const panels: { name: string; node: ReactElement }[] = [
  { name: 'TaskPanel', node: <TaskPanel /> },
  { name: 'GanttChart', node: <GanttChart /> },
  { name: 'ResourcePanel', node: <ResourcePanel /> },
  { name: 'CalendarPanel', node: <CalendarPanel /> },
  { name: 'AnalysisPanel', node: <AnalysisPanel /> },
]

describe('render aplikasi', () => {
  it('merender App beserta data contoh tanpa error', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Manajemen Tugas')
    expect(html).toContain('Implementasi Sistem ERP')
  })

  for (const { name, node } of panels) {
    it(`merender ${name} tanpa error`, () => {
      const html = renderToString(<ProjectProvider>{node}</ProjectProvider>)
      expect(html.length).toBeGreaterThan(0)
    })
  }
})
