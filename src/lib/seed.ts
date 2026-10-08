import type {
  Assignment,
  Dependency,
  DependencyType,
  PertEstimate,
  Priority,
  ProjectData,
  Task,
} from '../types'
import { createId } from './id'

function dep(predecessorId: string, type: DependencyType = 'FS', lag = 0): Dependency {
  return { id: createId('dep'), predecessorId, type, lag }
}

function assign(memberId: string, allocation = 100): Assignment {
  return { memberId, allocation }
}

interface TaskInput {
  id: string
  name: string
  parentId?: string | null
  durationDays: number
  startDate?: string
  priority?: Priority
  color: string
  progress?: number
  dependencies?: Dependency[]
  assignments?: Assignment[]
  estimates?: PertEstimate | null
}

function task(input: TaskInput): Task {
  return {
    id: input.id,
    name: input.name,
    parentId: input.parentId ?? null,
    durationDays: input.durationDays,
    startDate: input.startDate ?? '2026-01-05',
    priority: input.priority ?? 'Medium',
    color: input.color,
    progress: input.progress ?? 0,
    dependencies: input.dependencies ?? [],
    assignments: input.assignments ?? [],
    estimates: input.estimates ?? null,
    collapsed: false,
  }
}

const PLANNING = '#4f46e5'
const DESIGN = '#0891b2'
const DEV = '#7c3aed'
const TEST = '#d97706'
const DEPLOY = '#059669'

const PROJECT_START = '2026-01-05'

/** Data contoh proyek untuk seed localStorage. */
export function createSeedData(): ProjectData {
  const tasks: Task[] = [
    // ---- Perencanaan & Analisis ----
    task({ id: 't_plan', name: 'Perencanaan & Analisis', durationDays: 1, color: PLANNING, priority: 'High' }),
    task({
      id: 't_kickoff', name: 'Kick-off & Penyusunan Ruang Lingkup', parentId: 't_plan',
      durationDays: 3, color: PLANNING, priority: 'High',
      assignments: [assign('m1')],
      estimates: { optimistic: 2, mostLikely: 3, pessimistic: 5 },
    }),
    task({
      id: 't_req', name: 'Analisis Kebutuhan Bisnis', parentId: 't_plan',
      durationDays: 5, color: PLANNING, priority: 'High',
      dependencies: [dep('t_kickoff', 'FS', 0)],
      assignments: [assign('m2'), assign('m1', 25)],
      progress: 100,
      estimates: { optimistic: 4, mostLikely: 5, pessimistic: 9 },
    }),
    task({
      id: 't_srs', name: 'Penyusunan Dokumen SRS', parentId: 't_plan',
      durationDays: 4, color: PLANNING, priority: 'Medium',
      dependencies: [dep('t_req', 'FS', 0)],
      assignments: [assign('m2')],
    }),

    // ---- Desain Sistem ----
    task({ id: 't_design', name: 'Desain Sistem', durationDays: 1, color: DESIGN }),
    task({
      id: 't_arch', name: 'Desain Arsitektur Aplikasi', parentId: 't_design',
      durationDays: 5, color: DESIGN, priority: 'High',
      dependencies: [dep('t_srs', 'FS', 0)],
      assignments: [assign('m3')],
      estimates: { optimistic: 4, mostLikely: 5, pessimistic: 8 },
    }),
    task({
      id: 't_db', name: 'Desain Database', parentId: 't_design',
      durationDays: 4, color: DESIGN, priority: 'High',
      dependencies: [dep('t_arch', 'FS', 0)],
      assignments: [assign('m3', 50), assign('m5', 50)],
    }),
    task({
      id: 't_uiux', name: 'Desain UI/UX Prototype', parentId: 't_design',
      durationDays: 6, color: DESIGN, priority: 'Medium',
      dependencies: [dep('t_arch', 'SS', 1)],
      assignments: [assign('m4')],
    }),

    // ---- Pengembangan ----
    task({ id: 't_dev', name: 'Pengembangan', durationDays: 1, color: DEV }),
    task({
      id: 't_env', name: 'Setup Environment & CI/CD', parentId: 't_dev',
      durationDays: 3, color: DEV, priority: 'High',
      dependencies: [dep('t_db', 'FS', 0)],
      assignments: [assign('m7')],
      estimates: { optimistic: 2, mostLikely: 3, pessimistic: 6 },
    }),
    task({
      id: 't_auth', name: 'Pengembangan Modul Autentikasi', parentId: 't_dev',
      durationDays: 6, color: DEV, priority: 'High',
      dependencies: [dep('t_env', 'FS', 0)],
      assignments: [assign('m5')],
      estimates: { optimistic: 5, mostLikely: 6, pessimistic: 10 },
    }),
    task({
      id: 't_inv', name: 'Pengembangan Modul Inventori', parentId: 't_dev',
      durationDays: 8, color: DEV, priority: 'High',
      dependencies: [dep('t_auth', 'FS', 0)],
      assignments: [assign('m5', 80), assign('m6', 40)],
      estimates: { optimistic: 6, mostLikely: 8, pessimistic: 14 },
    }),
    task({
      id: 't_fin', name: 'Pengembangan Modul Keuangan', parentId: 't_dev',
      durationDays: 9, color: DEV, priority: 'High',
      dependencies: [dep('t_inv', 'SS', 2)],
      assignments: [assign('m5', 60), assign('m6', 60)],
      estimates: { optimistic: 7, mostLikely: 9, pessimistic: 15 },
    }),
    task({
      id: 't_dash', name: 'Pengembangan Dashboard', parentId: 't_dev',
      durationDays: 5, color: DEV, priority: 'Medium',
      dependencies: [dep('t_inv', 'FS', 0), dep('t_uiux', 'FS', 0)],
      assignments: [assign('m6')],
    }),

    // ---- Pengujian ----
    task({ id: 't_test', name: 'Pengujian', durationDays: 1, color: TEST }),
    task({
      id: 't_qc', name: 'Pengujian Unit & Integrasi', parentId: 't_test',
      durationDays: 6, color: TEST, priority: 'High',
      dependencies: [dep('t_fin', 'FS', 0), dep('t_dash', 'FS', 0)],
      assignments: [assign('m8')],
      estimates: { optimistic: 5, mostLikely: 6, pessimistic: 11 },
    }),
    task({
      id: 't_uat', name: 'User Acceptance Test', parentId: 't_test',
      durationDays: 4, color: TEST, priority: 'High',
      dependencies: [dep('t_qc', 'FS', 0)],
      assignments: [assign('m8', 60), assign('m2', 40)],
    }),

    // ---- Deployment ----
    task({ id: 't_deploy', name: 'Deployment', durationDays: 1, color: DEPLOY }),
    task({
      id: 't_train', name: 'Pelatihan Pengguna', parentId: 't_deploy',
      durationDays: 3, color: DEPLOY, priority: 'Medium',
      dependencies: [dep('t_uat', 'FS', 0)],
      assignments: [assign('m1', 50), assign('m4', 50)],
    }),
    task({
      id: 't_golive', name: 'Go-Live & Serah Terima', parentId: 't_deploy',
      durationDays: 2, color: DEPLOY, priority: 'High',
      dependencies: [dep('t_train', 'FS', 2)],
      assignments: [assign('m1'), assign('m7', 50)],
    }),
  ]

  return {
    name: 'Implementasi Sistem ERP',
    tasks,
    members: [
      { id: 'm1', name: 'Budi Santoso', email: 'budi.santoso@corp.id', role: 'Project Manager', monthlySalary: 25_000_000 },
      { id: 'm2', name: 'Siti Aminah', email: 'siti.aminah@corp.id', role: 'Business Analyst', monthlySalary: 18_000_000 },
      { id: 'm3', name: 'Andi Wijaya', email: 'andi.wijaya@corp.id', role: 'Solution Architect', monthlySalary: 30_000_000 },
      { id: 'm4', name: 'Dewi Lestari', email: 'dewi.lestari@corp.id', role: 'UI/UX Designer', monthlySalary: 16_000_000 },
      { id: 'm5', name: 'Rizky Pratama', email: 'rizky.pratama@corp.id', role: 'Backend Developer', monthlySalary: 20_000_000 },
      { id: 'm6', name: 'Maya Kusuma', email: 'maya.kusuma@corp.id', role: 'Frontend Developer', monthlySalary: 18_000_000 },
      { id: 'm7', name: 'Fajar Nugroho', email: 'fajar.nugroho@corp.id', role: 'DevOps Engineer', monthlySalary: 22_000_000 },
      { id: 'm8', name: 'Putri Handayani', email: 'putri.handayani@corp.id', role: 'QA Engineer', monthlySalary: 15_000_000 },
    ],
    calendar: {
      projectStart: PROJECT_START,
      weekendDays: [0, 6],
      holidays: [
        { id: createId('hol'), date: '2026-01-01', name: 'Tahun Baru Masehi' },
        { id: createId('hol'), date: '2026-02-17', name: 'Tahun Baru Imlek' },
        { id: createId('hol'), date: '2026-03-19', name: 'Cuti Bersama Idul Fitri' },
        { id: createId('hol'), date: '2026-03-20', name: 'Hari Raya Idul Fitri' },
        { id: createId('hol'), date: '2026-05-01', name: 'Hari Buruh Internasional' },
      ],
    },
  }
}
