import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Uji end-to-end di browser sungguhan (Edge) atas hasil build produksi.
 * Fokus: interaksi yang tidak bisa diverifikasi lewat unit test —
 * drag/resize bar Gantt, CRUD tugas lewat form, kalender, dan persistensi localStorage.
 */

const STORAGE_KEY = 'gantt-project-app:v1'

interface StoredHoliday {
  id: string
  date: string
  name: string
}

interface StoredTask {
  id: string
  name: string
  parentId: string | null
  durationDays: number
  startDate: string
  priority: string
  dependencies: { id: string; predecessorId: string; type: string; lag: number }[]
}

interface StoredData {
  name: string
  tasks: StoredTask[]
  members: { id: string; name: string; email: string; role: string }[]
  calendar: { projectStart: string; weekendDays: number[]; holidays: StoredHoliday[] }
}

const MS_PER_DAY = 86_400_000

function addDaysISO(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

function isWorkingDayISO(iso: string, cal: StoredData['calendar']): boolean {
  const weekday = new Date(`${iso}T00:00:00.000Z`).getUTCDay()
  if (cal.weekendDays.includes(weekday)) return false
  return !cal.holidays.some((h) => h.date === iso)
}

function nextWorkingDayISO(iso: string, cal: StoredData['calendar']): string {
  let cursor = iso
  while (!isWorkingDayISO(cursor, cal)) cursor = addDaysISO(cursor, 1)
  return cursor
}

function addWorkingDaysISO(iso: string, count: number, cal: StoredData['calendar']): string {
  let cursor = iso
  for (let i = 0; i < count; i += 1) cursor = nextWorkingDayISO(addDaysISO(cursor, 1), cal)
  return cursor
}

function workingDaysBetweenISO(from: string, to: string, cal: StoredData['calendar']): number {
  let count = 0
  for (let cursor = from; cursor <= to; cursor = addDaysISO(cursor, 1)) {
    if (isWorkingDayISO(cursor, cal)) count += 1
  }
  return count
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Format yang sama dengan lib/date.formatDate, mis. "05 Jan 2026". */
function formatISO(iso: string): string {
  const day = iso.slice(8, 10)
  const month = MONTH_LABELS[Number(iso.slice(5, 7)) - 1]
  return `${day} ${month} ${iso.slice(0, 4)}`
}

/** Membuka aplikasi dari data contoh yang bersih (tanpa sisa localStorage). */
async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Manajemen Tugas' })).toBeVisible()
}

async function readStored(page: Page): Promise<StoredData> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)
  if (!raw) throw new Error('localStorage kosong: data proyek tidak tersimpan')
  return JSON.parse(raw) as StoredData
}

/** Menunggu sampai localStorage memenuhi kondisi, lalu mengembalikannya. */
async function storedEventually(
  page: Page,
  predicate: (data: StoredData) => boolean,
): Promise<StoredData> {
  let last: StoredData | null = null
  for (let attempt = 0; attempt < 40; attempt += 1) {
    last = await readStored(page)
    if (predicate(last)) return last
    await page.waitForTimeout(50)
  }
  throw new Error(`localStorage tidak sesuai harapan: ${JSON.stringify(last).slice(0, 500)}`)
}

/** Mengakses input berdasarkan teks label field yang persis. */
function field(scope: Page | Locator, label: string): Locator {
  return scope
    .locator(`label.field:has(> .field-label:text-is(${JSON.stringify(label)}))`)
    .locator('input, select')
    .first()
}

function taskRow(page: Page, name: string): Locator {
  return page.locator('tbody tr').filter({ hasText: name }).first()
}

/**
 * Menekan dan menggeser sebuah elemen sebesar dx piksel (pointer drag asli).
 * Mengembalikan fungsi untuk melepas tombol mouse setelah pemeriksaan opsional.
 */
async function startDrag(
  page: Page,
  target: Locator,
  dx: number,
): Promise<() => Promise<void>> {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  if (!box) throw new Error('elemen target drag tidak terlihat')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 12 })
  return async () => {
    await page.mouse.up()
  }
}

const KICKOFF = 'Kick-off & Penyusunan Ruang Lingkup'
const REQ = 'Analisis Kebutuhan Bisnis'

test('data contoh termuat dan seluruh tab menampilkan datanya', async ({ page }) => {
  await openApp(page)

  await expect(page.getByLabel('Nama proyek')).toHaveValue('Implementasi Sistem ERP')

  const data = await readStored(page)
  expect(data.tasks).toHaveLength(20)
  expect(data.members).toHaveLength(8)
  expect(data.calendar.holidays).toHaveLength(5)

  const summaryCount = data.tasks.filter((t) => data.tasks.some((c) => c.parentId === t.id)).length
  expect(summaryCount).toBe(5)

  // Tab Tugas: semua baris (termasuk sub-tugas) tampil.
  await expect(page.locator('tbody tr')).toHaveCount(20)
  await expect(page.locator('tbody tr').filter({ hasText: 'Pengembangan Modul Inventori' })).toHaveCount(1)

  // Tab Gantt: bar, bar ringkasan, handle resize, dan panah dependensi.
  await page.getByRole('tab', { name: 'Gantt Chart' }).click()
  await expect(page.locator('.gantt-bar')).toHaveCount(20)
  await expect(page.locator('.gantt-bar.summary')).toHaveCount(5)
  await expect(page.locator('.gantt-resize')).toHaveCount(15)
  expect(await page.locator('.gantt-svg path').count()).toBeGreaterThan(0)
  expect(await page.locator('.gantt-bar.critical').count()).toBeGreaterThan(0)

  // Tab Sumber Daya.
  await page.getByRole('tab', { name: 'Sumber Daya' }).click()
  await expect(page.getByRole('heading', { name: 'Sumber Daya Tim' })).toBeVisible()
  await expect(page.getByText('Budi Santoso').first()).toBeVisible()

  // Tab Kalender.
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await expect(page.getByRole('heading', { name: 'Kalender Proyek' })).toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: 'Hari Raya Idul Fitri' })).toHaveCount(1)

  // Tab Analisis: jalur kritis + diagram PERT.
  await page.getByRole('tab', { name: 'Analisis' }).click()
  await expect(page.getByRole('heading', { name: 'Jalur Kritis (Critical Path)' })).toBeVisible()
  expect(await page.locator('.chip-critical').count()).toBeGreaterThan(0)
  await expect(page.getByRole('heading', { name: 'Diagram PERT' })).toBeVisible()
  expect(await page.locator('svg').count()).toBeGreaterThan(0)
})

test('tambah, edit, dan hapus tugas bertahan setelah reload', async ({ page }) => {
  await openApp(page)

  await page.getByRole('button', { name: '+ Tugas Baru' }).click()
  const dialog = page.getByRole('dialog')
  await field(dialog, 'Nama tugas').fill('Tugas E2E')
  await field(dialog, 'Durasi (hari kerja)').fill('4')
  await field(dialog, 'Prioritas').selectOption('High')
  await dialog.getByRole('button', { name: 'Tambah Tugas' }).click()

  await expect(dialog).toHaveCount(0)
  await expect(taskRow(page, 'Tugas E2E')).toHaveCount(1)

  const created = await storedEventually(page, (d) => d.tasks.some((t) => t.name === 'Tugas E2E'))
  const newTask = created.tasks.find((t) => t.name === 'Tugas E2E')
  expect(newTask?.durationDays).toBe(4)
  expect(newTask?.priority).toBe('High')

  await page.reload()
  await expect(taskRow(page, 'Tugas E2E')).toHaveCount(1)

  await taskRow(page, 'Tugas E2E').getByRole('button', { name: 'Edit' }).click()
  await field(page.getByRole('dialog'), 'Nama tugas').fill('Tugas E2E Diubah')
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan Perubahan' }).click()
  await expect(taskRow(page, 'Tugas E2E Diubah')).toHaveCount(1)

  page.once('dialog', (d) => void d.accept())
  await taskRow(page, 'Tugas E2E Diubah').getByRole('button', { name: 'Hapus' }).click()
  await expect(taskRow(page, 'Tugas E2E Diubah')).toHaveCount(0)

  await page.reload()
  await expect(page.locator('tbody tr').filter({ hasText: 'Tugas E2E' })).toHaveCount(0)
})

test('drag bar menggeser tanggal mulai dan menular ke tugas setelahnya', async ({ page }) => {
  await openApp(page)
  const before = await readStored(page)
  const target = before.tasks.find((t) => t.name === KICKOFF)
  if (!target) throw new Error('tugas target tidak ditemukan pada data contoh')
  const successorRowBefore = await taskRow(page, REQ).innerText()

  await page.getByRole('tab', { name: 'Gantt Chart' }).click()
  const bar = page.locator('.gantt-bar').filter({ hasText: KICKOFF }).first()
  const beforeBox = (await bar.boundingBox()) ?? (() => { throw new Error('bar tidak terlihat') })()

  const finishDrag = await startDrag(page, bar, 90) // 3 hari x 30px
  const draggingBox = (await bar.boundingBox()) ?? beforeBox
  expect(draggingBox.x).toBeGreaterThan(beforeBox.x + 60) // pratinjau live saat drag
  await finishDrag()

  const after = await storedEventually(
    page,
    (d) => d.tasks.find((t) => t.id === target.id)?.startDate === addDaysISO(target.startDate, 3),
  )
  expect(after.tasks.find((t) => t.id === target.id)?.startDate).toBe(addDaysISO(target.startDate, 3))

  // Perubahan kalender tugas pertama menggeser tugas berikutnya (FS, lag 0).
  await page.getByRole('tab', { name: 'Tugas' }).click()
  const successor = after.tasks.find((t) => t.name === REQ)
  if (!successor) throw new Error('tugas lanjutan tidak ditemukan')
  const kickoffFinish = addWorkingDaysISO(
    addDaysISO(target.startDate, 3),
    target.durationDays - 1,
    after.calendar,
  )
  const successorStart = nextWorkingDayISO(addDaysISO(kickoffFinish, 1), after.calendar)
  const successorFinish = addWorkingDaysISO(successorStart, successor.durationDays - 1, after.calendar)
  const successorRowAfter = await taskRow(page, REQ).innerText()
  expect(successorRowAfter).not.toBe(successorRowBefore)
  expect(successorRowAfter).toContain(formatISO(successorStart))
  expect(successorRowAfter).toContain(formatISO(successorFinish))

  await page.reload()
  await expect(taskRow(page, REQ)).toContainText(formatISO(successorStart))
})

test('drag tepi kanan mengubah durasi sesuai hari kerja', async ({ page }) => {
  await openApp(page)
  await page.getByRole('tab', { name: 'Gantt Chart' }).click()

  const before = await readStored(page)
  const target = before.tasks.find((t) => t.name === KICKOFF)
  if (!target) throw new Error('tugas target tidak ditemukan pada data contoh')

  const originalFinish = addWorkingDaysISO(target.startDate, target.durationDays - 1, before.calendar)
  const expectedDuration = workingDaysBetweenISO(
    target.startDate,
    addDaysISO(originalFinish, 7),
    before.calendar,
  )
  expect(expectedDuration).toBe(target.durationDays + 5) // 7 hari kalender = 5 hari kerja

  const bar = page.locator('.gantt-bar').filter({ hasText: KICKOFF }).first()
  const handle = bar.locator('.gantt-resize')
  const beforeWidth = (await bar.boundingBox())?.width ?? 0

  const finishDrag = await startDrag(page, handle, 210) // +7 hari x 30px
  const draggingWidth = (await bar.boundingBox())?.width ?? beforeWidth
  expect(draggingWidth).toBeGreaterThan(beforeWidth) // pratinjau live saat resize
  await finishDrag()

  const after = await storedEventually(
    page,
    (d) => d.tasks.find((t) => t.id === target.id)?.durationDays === expectedDuration,
  )
  expect(after.tasks.find((t) => t.id === target.id)?.durationDays).toBe(expectedDuration)

  const afterWidth = (await bar.boundingBox())?.width ?? 0
  expect(afterWidth).toBeGreaterThan(beforeWidth)

  await page.reload()
  const persisted = await readStored(page)
  expect(persisted.tasks.find((t) => t.id === target.id)?.durationDays).toBe(expectedDuration)
})

test('menambah hari libur menggeser tanggal selesai tugas', async ({ page }) => {
  await openApp(page)
  await page.getByRole('tab', { name: 'Kalender' }).click()

  await field(page, 'Tanggal').fill('2026-01-06')
  await field(page, 'Keterangan').fill('Cuti Bersama E2E')
  await page.getByRole('button', { name: '+ Tambah Libur' }).click()

  const after = await storedEventually(page, (d) =>
    d.calendar.holidays.some((h) => h.date === '2026-01-06'),
  )
  expect(after.calendar.holidays.find((h) => h.date === '2026-01-06')?.name).toBe('Cuti Bersama E2E')

  // Kick-off: mulai 05 Jan, durasi 3 hari kerja -> selesai 08 Jan (06 Jan libur).
  await page.getByRole('tab', { name: 'Tugas' }).click()
  const row = taskRow(page, KICKOFF)
  await expect(row).toContainText('08 Jan 2026')
  await expect(row).toContainText('3 hari')
})

test('tata letak tetap rapi dan responsif pada layar sempit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)

  /** Kelebihan lebar dokumen terhadap lebar viewport (0 berarti tidak meluber). */
  const pageOverflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )

  expect(await pageOverflow()).toBeLessThanOrEqual(1)
  await expect(page.getByRole('tab', { name: 'Tugas' })).toBeVisible()

  // Tabel tugas menggulir di dalam wadahnya, bukan melebarkan halaman.
  const tableWrap = page.locator('.table-wrap').first()
  expect((await tableWrap.boundingBox())?.width ?? 0).toBeLessThanOrEqual(390)
  expect(await tableWrap.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)

  // Dialog form tetap muat dan tidak meluberkan halaman.
  await page.getByRole('button', { name: '+ Tugas Baru' }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  expect((await modal.boundingBox())?.width ?? 0).toBeLessThanOrEqual(390)
  expect(await pageOverflow()).toBeLessThanOrEqual(1)
  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)

  // Semua tab dapat dibuka tanpa meluberkan halaman.
  for (const name of ['Gantt Chart', 'Sumber Daya', 'Kalender', 'Analisis']) {
    await page.getByRole('tab', { name }).click()
    await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
    expect(await pageOverflow()).toBeLessThanOrEqual(1)
  }
})

test('menjadikan Jumat akhir pekan menggeser jadwal dan tersimpan', async ({ page }) => {
  await openApp(page)
  const rowBefore = await taskRow(page, REQ).innerText()

  await page.getByRole('tab', { name: 'Kalender' }).click()
  const finishStat = page.locator('.stat').filter({ hasText: 'Selesai' }).locator('.stat-value')
  const beforeFinish = await finishStat.innerText()

  await page.getByRole('button', { name: 'Jumat' }).click()

  const after = await storedEventually(page, (d) => d.calendar.weekendDays.includes(5))
  expect(after.calendar.weekendDays).toContain(5)
  await expect(page.getByRole('button', { name: 'Jumat' })).toHaveClass(/active/)
  await expect(finishStat).not.toHaveText(beforeFinish)

  // Tugas dengan rentang > 1 minggu harus terdorong oleh hilangnya hari Jumat.
  await page.getByRole('tab', { name: 'Tugas' }).click()
  const rowAfter = await taskRow(page, REQ).innerText()
  expect(rowAfter).not.toBe(rowBefore)

  const kickoff = after.tasks.find((t) => t.name === KICKOFF)
  const req = after.tasks.find((t) => t.name === REQ)
  if (!kickoff || !req) throw new Error('tugas referensi tidak ditemukan')
  const kickoffFinish = addWorkingDaysISO(kickoff.startDate, kickoff.durationDays - 1, after.calendar)
  const reqStart = nextWorkingDayISO(addDaysISO(kickoffFinish, 1), after.calendar)
  const reqFinish = addWorkingDaysISO(reqStart, req.durationDays - 1, after.calendar)
  expect(rowAfter).toContain(formatISO(reqStart))
  expect(rowAfter).toContain(formatISO(reqFinish))

  await page.reload()
  await expect(taskRow(page, REQ)).toContainText(formatISO(reqFinish))
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await expect(page.getByRole('button', { name: 'Jumat' })).toHaveClass(/active/)
})
