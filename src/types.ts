/** Prioritas tugas. */
export type Priority = 'Low' | 'Medium' | 'High'

/** Tipe ketergantungan: Finish-to-Start atau Start-to-Start. */
export type DependencyType = 'FS' | 'SS'

export interface Dependency {
  id: string
  /** id tugas pendahulu (predecessor). */
  predecessorId: string
  type: DependencyType
  /** Jeda dalam hari kerja (lag / delay), bisa negatif (lead). */
  lag: number
}

export interface Assignment {
  memberId: string
  /** Persentase alokasi anggota pada tugas ini (0-100). */
  allocation: number
}

export interface PertEstimate {
  /** Durasi optimistis (hari kerja). */
  optimistic: number
  /** Durasi paling mungkin (hari kerja). */
  mostLikely: number
  /** Durasi pesimistis (hari kerja). */
  pessimistic: number
}

export interface Task {
  id: string
  name: string
  /** id tugas induk, null bila tugas level atas. */
  parentId: string | null
  /** Durasi dalam hari kerja, diabaikan bila tugas ini punya sub-tugas. */
  durationDays: number
  /** Tanggal mulai (ISO yyyy-mm-dd), dipakai sebagai batas bawah jadwal. */
  startDate: string
  priority: Priority
  /** Warna indikator bar Gantt. */
  color: string
  /** Progres 0-100. */
  progress: number
  /** Daftar pendahulu. */
  dependencies: Dependency[]
  /** Alokasi anggota tim. */
  assignments: Assignment[]
  /** Estimasi PERT opsional. */
  estimates?: PertEstimate | null
  /** Status buka/tutup sub-tugas di tampilan. */
  collapsed?: boolean
}

export interface Member {
  id: string
  name: string
  email: string
  role: string
  /** Gaji bulanan (Rupiah). */
  monthlySalary: number
}

export interface Holiday {
  id: string
  /** Tanggal libur (ISO yyyy-mm-dd). */
  date: string
  name: string
}

export interface CalendarSettings {
  /** Hari akhir pekan (0 = Minggu ... 6 = Sabtu). */
  weekendDays: number[]
  /** Hari libur khusus. */
  holidays: Holiday[]
  /** Tanggal mulai proyek (ISO yyyy-mm-dd). */
  projectStart: string
}

export interface ProjectData {
  name: string
  tasks: Task[]
  members: Member[]
  calendar: CalendarSettings
}
