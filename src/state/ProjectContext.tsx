import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react'
import type { ReactNode } from 'react'
import type {
  CalendarSettings,
  Holiday,
  Member,
  PertEstimate,
  Priority,
  ProjectData,
  Task,
} from '../types'
import { computeSchedule } from '../lib/schedule'
import type { ScheduleResult } from '../lib/schedule'
import { computeCpm } from '../lib/cpm'
import type { CpmResult } from '../lib/cpm'
import { computeCosts } from '../lib/cost'
import { buildPertGraph, computePertRows, summarizePert } from '../lib/pert'
import type { PertGraph, PertProjectSummary, PertRow } from '../lib/pert'
import { createId } from '../lib/id'
import { clearProject, loadProject, saveProject } from '../lib/storage'
import { createSeedData } from '../lib/seed'

export interface NewTaskInput {
  name?: string
  parentId?: string | null
  durationDays?: number
  startDate?: string
  priority?: Priority
  color?: string
  dependencies?: Task['dependencies']
  assignments?: Task['assignments']
  estimates?: PertEstimate | null
}

type Action =
  | { type: 'setName'; name: string }
  | { type: 'addTask'; task: Task }
  | { type: 'updateTask'; id: string; patch: Partial<Task> }
  | { type: 'deleteTask'; id: string }
  | { type: 'addMember'; member: Member }
  | { type: 'updateMember'; id: string; patch: Partial<Member> }
  | { type: 'deleteMember'; id: string }
  | { type: 'setCalendar'; patch: Partial<CalendarSettings> }
  | { type: 'addHoliday'; holiday: Holiday }
  | { type: 'removeHoliday'; id: string }
  | { type: 'replace'; data: ProjectData }
  | { type: 'reset' }

function collectDescendants(tasks: Task[], id: string): Set<string> {
  const result = new Set<string>([id])
  let changed = true
  while (changed) {
    changed = false
    for (const t of tasks) {
      if (t.parentId && result.has(t.parentId) && !result.has(t.id)) {
        result.add(t.id)
        changed = true
      }
    }
  }
  return result
}

function reducer(state: ProjectData, action: Action): ProjectData {
  switch (action.type) {
    case 'setName':
      return { ...state, name: action.name }
    case 'addTask':
      return { ...state, tasks: [...state.tasks, action.task] }
    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, ...action.patch, id: t.id } : t,
        ),
      }
    case 'deleteTask': {
      const ids = collectDescendants(state.tasks, action.id)
      return {
        ...state,
        tasks: state.tasks
          .filter((t) => !ids.has(t.id))
          .map((t) =>
            t.dependencies.some((d) => ids.has(d.predecessorId))
              ? { ...t, dependencies: t.dependencies.filter((d) => !ids.has(d.predecessorId)) }
              : t,
          ),
      }
    }
    case 'addMember':
      return { ...state, members: [...state.members, action.member] }
    case 'updateMember':
      return {
        ...state,
        members: state.members.map((m) =>
          m.id === action.id ? { ...m, ...action.patch, id: m.id } : m,
        ),
      }
    case 'deleteMember':
      return {
        ...state,
        members: state.members.filter((m) => m.id !== action.id),
        tasks: state.tasks.map((t) =>
          t.assignments.some((a) => a.memberId === action.id)
            ? { ...t, assignments: t.assignments.filter((a) => a.memberId !== action.id) }
            : t,
        ),
      }
    case 'setCalendar':
      return { ...state, calendar: { ...state.calendar, ...action.patch } }
    case 'addHoliday':
      return {
        ...state,
        calendar: { ...state.calendar, holidays: [...state.calendar.holidays, action.holiday] },
      }
    case 'removeHoliday':
      return {
        ...state,
        calendar: {
          ...state.calendar,
          holidays: state.calendar.holidays.filter((h) => h.id !== action.id),
        },
      }
    case 'replace':
      return action.data
    case 'reset':
      return createSeedData()
    default:
      return state
  }
}

export interface ProjectActions {
  setName: (name: string) => void
  addTask: (input?: NewTaskInput) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  addMember: (input: Omit<Member, 'id'>) => string
  updateMember: (id: string, patch: Partial<Member>) => void
  deleteMember: (id: string) => void
  setCalendar: (patch: Partial<CalendarSettings>) => void
  addHoliday: (input: Omit<Holiday, 'id'>) => void
  removeHoliday: (id: string) => void
  reset: () => void
  clear: () => void
}

interface ProjectContextValue {
  data: ProjectData
  schedule: ScheduleResult
  cpm: CpmResult
  costs: ReturnType<typeof computeCosts>
  pertRows: PertRow[]
  pertSummary: PertProjectSummary
  pertGraph: PertGraph
  actions: ProjectActions
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

const DEFAULT_COLOR = '#4f46e5'

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, loadProject)

  useEffect(() => {
    saveProject(data)
  }, [data])

  const schedule = useMemo(() => computeSchedule(data), [data])
  const cpm = useMemo(() => computeCpm(data, schedule), [data, schedule])
  const costs = useMemo(() => computeCosts(data, schedule), [data, schedule])
  const pertRows = useMemo(
    () => computePertRows(data, schedule, cpm.criticalIds),
    [data, schedule, cpm],
  )
  const pertSummary = useMemo(() => summarizePert(pertRows, cpm.chain), [pertRows, cpm])
  const pertGraph = useMemo(() => buildPertGraph(data), [data])

  const actions = useMemo<ProjectActions>(
    () => ({
      setName: (name) => dispatch({ type: 'setName', name }),
      addTask: (input = {}) => {
        const id = createId('task')
        const task: Task = {
          id,
          name: input.name ?? 'Tugas Baru',
          parentId: input.parentId ?? null,
          durationDays: Math.max(1, Math.round(input.durationDays ?? 1)),
          startDate: input.startDate ?? data.calendar.projectStart,
          priority: input.priority ?? 'Medium',
          color: input.color ?? DEFAULT_COLOR,
          progress: 0,
          dependencies: input.dependencies ?? [],
          assignments: input.assignments ?? [],
          estimates: input.estimates ?? null,
          collapsed: false,
        }
        dispatch({ type: 'addTask', task })
        return id
      },
      updateTask: (id, patch) => dispatch({ type: 'updateTask', id, patch }),
      deleteTask: (id) => dispatch({ type: 'deleteTask', id }),
      addMember: (input) => {
        const id = createId('member')
        dispatch({ type: 'addMember', member: { ...input, id } })
        return id
      },
      updateMember: (id, patch) => dispatch({ type: 'updateMember', id, patch }),
      deleteMember: (id) => dispatch({ type: 'deleteMember', id }),
      setCalendar: (patch) => dispatch({ type: 'setCalendar', patch }),
      addHoliday: (input) =>
        dispatch({ type: 'addHoliday', holiday: { ...input, id: createId('holiday') } }),
      removeHoliday: (id) => dispatch({ type: 'removeHoliday', id }),
      reset: () => dispatch({ type: 'reset' }),
      clear: () => {
        clearProject()
        dispatch({ type: 'reset' })
      },
    }),
    [data.calendar.projectStart],
  )

  const value = useMemo<ProjectContextValue>(
    () => ({ data, schedule, cpm, costs, pertRows, pertSummary, pertGraph, actions }),
    [data, schedule, cpm, costs, pertRows, pertSummary, pertGraph, actions],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

/** Mengakses state proyek. */
export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject harus dipakai di dalam <ProjectProvider>')
  return ctx
}

/** Daftar sub-tugas langsung dari sebuah tugas. */
export function childrenOf(tasks: Task[], parentId: string | null): Task[] {
  return tasks.filter((t) => t.parentId === parentId)
}

/** Semua keturunan sebuah tugas (rekursif). */
export function descendantsOf(tasks: Task[], id: string): Task[] {
  const ids = collectDescendants(tasks, id)
  ids.delete(id)
  return tasks.filter((t) => ids.has(t.id))
}
