const MS_PER_DAY = 86_400_000

/** Mengubah string ISO (yyyy-mm-dd) menjadi Date pada tengah malam UTC. */
export function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

/** Mengubah Date menjadi string ISO (yyyy-mm-dd). */
export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Menambah sejumlah hari kalender pada tanggal ISO. */
export function addDays(iso: string, days: number): string {
  return toISO(new Date(parseISO(iso).getTime() + days * MS_PER_DAY))
}

/** Hari dalam seminggu (0 = Minggu ... 6 = Sabtu) secara UTC. */
export function getWeekday(iso: string): number {
  return parseISO(iso).getUTCDay()
}

/** Perbandingan dua tanggal ISO. */
export function compareISO(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** Tanggal hari ini sebagai ISO. */
export function todayISO(): string {
  return toISO(new Date())
}

/** Daftar tanggal antara start dan end (inklusif). */
export function eachDay(startISO: string, endISO: string): string[] {
  const result: string[] = []
  let cursor = startISO
  let guard = 0
  while (compareISO(cursor, endISO) <= 0 && guard < 20_000) {
    result.push(cursor)
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return result
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

/** Format tanggal ringkas, mis. "05 Jan 2026". */
export function formatDate(iso: string): string {
  const d = parseISO(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Nama hari singkat, mis. "Sen". */
export function dayName(iso: string): string {
  return DAY_NAMES[getWeekday(iso)]
}

/** Jumlah hari antara dua tanggal ISO. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / MS_PER_DAY)
}
