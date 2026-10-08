import type { ProjectData, Task } from '../types'
import { createSeedData } from './seed'

export const STORAGE_KEY = 'gantt-project-app:v1'

/** Memastikan struktur data hasil load tetap lengkap. */
function normalize(input: Partial<ProjectData>): ProjectData {
  const seed = createSeedData()
  const tasks: Task[] = Array.isArray(input.tasks)
    ? input.tasks.map((t) => ({
        id: t.id,
        name: t.name ?? 'Tanpa nama',
        parentId: t.parentId ?? null,
        durationDays: Number.isFinite(t.durationDays) ? t.durationDays : 1,
        startDate: t.startDate ?? seed.calendar.projectStart,
        priority: t.priority ?? 'Medium',
        color: t.color ?? '#4f46e5',
        progress: Number.isFinite(t.progress) ? t.progress : 0,
        dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
        assignments: Array.isArray(t.assignments) ? t.assignments : [],
        estimates: t.estimates ?? null,
        collapsed: t.collapsed ?? false,
      }))
    : seed.tasks

  const calendar = input.calendar
  return {
    name: input.name ?? seed.name,
    tasks,
    members: Array.isArray(input.members) ? input.members : seed.members,
    calendar: {
      projectStart: calendar?.projectStart ?? seed.calendar.projectStart,
      weekendDays: Array.isArray(calendar?.weekendDays)
        ? (calendar?.weekendDays ?? [])
        : seed.calendar.weekendDays,
      holidays: Array.isArray(calendar?.holidays)
        ? (calendar?.holidays ?? [])
        : seed.calendar.holidays,
    },
  }
}

/** Membaca data proyek dari localStorage, atau seed bila belum ada. */
export function loadProject(): ProjectData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeedData()
    return normalize(JSON.parse(raw) as Partial<ProjectData>)
  } catch {
    return createSeedData()
  }
}

/** Menyimpan data proyek ke localStorage. */
export function saveProject(data: ProjectData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* penyimpanan penuh atau tidak tersedia: abaikan */
  }
}

/** Menghapus data tersimpan. */
export function clearProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* abaikan */
  }
}
