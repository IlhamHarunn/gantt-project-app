# Aplikasi Manajemen Proyek Gantt Chart

Aplikasi manajemen proyek berbasis **Gantt Chart** dengan **React + TypeScript + Vite**.
Seluruh data disimpan di **localStorage** (sudah dilengkapi data contoh / seed), sehingga
aplikasi dapat langsung dipakai tanpa backend.

## Fitur

1. **Manajemen Tugas**
   - Tambah / edit / hapus tugas, termasuk sub-tugas (parent–child) dengan penomoran bertingkat.
   - Durasi dalam **hari kerja**, tanggal mulai, prioritas (Low/Medium/High), warna indikator, dan progres.
   - Tugas yang memiliki sub-tugas otomatis menjadi tugas ringkasan (summary) yang rentangnya mengikuti anak-anaknya.
2. **Predecessors & Timeline**
   - Ketergantungan **Finish-to-Start (FS)** dan **Start-to-Start (SS)** dengan **jeda (lag/delay)** hari kerja, lag boleh negatif (lead).
   - Gantt Chart visual: bar tugas, **panah dependensi**, **drag untuk memindah**, dan **resize untuk mengubah durasi**, plus zoom dan penanda "hari ini".
   - Penandaan jalur kritis pada bar dan panah.
3. **Manajemen Sumber Daya**
   - Pendaftaran anggota tim (nama, email, peran, gaji bulanan).
   - Alokasi anggota ke tugas dengan persentase alokasi, lengkap dengan tarif harian dan perhitungan biaya.
4. **Kalender Proyek**
   - Pengaturan hari **akhir pekan** (dapat dikustomisasi) dan penambahan **hari libur khusus**.
   - Semua perhitungan durasi hanya menghitung hari kerja (akhir pekan & libur otomatis dilewati).
5. **Analisis Proyek**
   - **Jalur kritis (Critical Path Method)**: rantai tugas kritis, tabel ES/EF/LS/LF, dan float.
   - **Analisis & diagram PERT**: estimasi O/M/P, durasi harapan `te = (O + 4M + P) / 6`, varians, σ, serta estimasi P95.

## Teknologi

- React 19 + TypeScript
- Vite (build tool & dev server)
- Vitest (unit test)
- Tanpa dependensi UI eksternal (CSS kustom)

## Cara Install & Menjalankan

Prasyarat: **Node.js 20+** dan npm.

```bash
# 1. Install dependensi
npm install

# 2. Jalankan mode pengembangan
npm run dev
# buka http://localhost:5173
```

### Perintah lain

```bash
npm run typecheck   # cek tipe TypeScript (tsc -b)
npm run test        # menjalankan unit test (vitest run)
npm run test:e2e    # build + uji end-to-end di browser (Playwright)
npm run build       # typecheck + build produksi ke folder dist/
npm run preview     # pratinjau hasil build
```

### Uji end-to-end

`npm run test:e2e` melakukan build lalu menjalankan 7 skenario Playwright di browser
sungguhan (memakai **Microsoft Edge** yang terpasang di sistem) atas hasil build di `dist/`:
drag bar Gantt, resize durasi, CRUD tugas lewat form, perubahan kalender, persistensi
localStorage setelah reload, dan tata letak pada layar sempit (390×844). Bila Edge tidak tersedia:

```bash
npx playwright install chromium
PW_CHANNEL=chromium npm run test:e2e
```

## Struktur Proyek

```
src/
  types.ts                  # model data (Task, Member, Calendar, dsb.)
  lib/
    date.ts                 # utilitas tanggal (UTC)
    calendar.ts             # perhitungan hari kerja (weekend, libur, offset)
    schedule.ts             # mesin penjadwalan dependensi FS/SS + lag
    cpm.ts                  # Critical Path Method (float, jalur kritis)
    pert.ts                 # estimasi & graf PERT
    cost.ts                 # biaya sumber daya
    seed.ts                 # data contoh
    storage.ts              # persistensi localStorage
    __tests__/              # unit test (vitest)
  state/
    ProjectContext.tsx      # state global + aksi + analisis turunan
  components/
    TaskPanel.tsx           # tabel tugas
    TaskForm.tsx            # form tambah/edit tugas
    GanttChart.tsx          # Gantt interaktif
    ResourcePanel.tsx       # sumber daya & alokasi
    CalendarPanel.tsx       # kalender & hari libur
    AnalysisPanel.tsx       # jalur kritis & PERT
    ui.tsx                  # komponen UI dasar
  App.tsx                   # kerangka aplikasi + navigasi tab
  index.css                 # gaya aplikasi
e2e/
  gantt.spec.ts             # uji end-to-end (Playwright)
playwright.config.ts        # konfigurasi uji browser
```

## Data & Persistensi

- Data disimpan otomatis pada `localStorage` dengan kunci `gantt-project-app:v1` setiap kali ada perubahan.
- Tombol **Muat Data Contoh** di header mengembalikan data ke seed awal.
- Menghapus data browser akan memuat ulang data contoh pada kunjungan berikutnya.

## Cara Pakai Singkat

1. Buka tab **Tugas** untuk mengelola daftar tugas; klik **+Sub** untuk menambah sub-tugas.
2. Atur pendahulu dan alokasi anggota melalui **Edit** pada sebuah tugas.
3. Buka tab **Gantt Chart** untuk melihat timeline; tarik bar untuk memindah jadwal dan tarik tepi kanan untuk mengubah durasi.
4. Sesuaikan hari kerja pada tab **Kalender**, lalu lihat hasilnya di tab **Analisis**.
