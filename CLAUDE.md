# Planikah (Naufal & Bella)

Aplikasi/PWA perencana pernikahan sederhana, hasil konversi dari Google Sheets. Pengguna utama: Naufal Atha Yudha (berbahasa Indonesia; tulis UI dan balasan dalam bahasa Indonesia).

## Struktur
- `app/` Next.js 16 (App Router, React 19, TS, Tailwind v4, TanStack Query v5, supabase-js + @supabase/ssr). **Baca `app/AGENTS.md` dan docs di `app/node_modules/next/dist/docs/` sebelum menulis kode Next.js** (ada perubahan besar).
- `supabase/migrations/` migrasi 0001–0006 (urut, jangan diubah yang sudah diterapkan; tambah file baru). `supabase/tests/` tes SQL.
- `docs/` spesifikasi desain (`2026-10-11-wedding-planner-design.md`) dan rencana implementasi.

## Perintah (dari `app/`, butuh Node 22.12+)
- `npm run check` = typecheck + lint + vitest. `npm run build`. `npm run test:db` (butuh Postgres).
- Smoke UI (Supabase di-mock): `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test npm run build`, lalu `npx next start -p 3100`, lalu `npm run e2e`.

## Prinsip desain (jangan dilanggar)
- Logika penting ada di Postgres: RLS per `wedding_id`, RPC `SECURITY DEFINER` dengan `search_path` terkunci (harus memuat `extensions` untuk pgcrypto), CAS `revision`, pembayaran idempoten (`request_id`), pembatalan soft cancel dengan alasan, arsip.
- Hanya anon key di klien. Jangan pernah memakai service-role key di frontend.
- Data lewat satu lapisan `src/lib/api.ts` dan `src/lib/hooks.ts` (TanStack Query, staleTime 5 menit, realtime memicu invalidasi tertarget).
- Mobile first: target sentuh >= 44px, tanpa scroll horizontal di 320px, hormati `prefers-reduced-motion`. Popup (`Sheet`) dirender lewat portal ke `document.body`.
- Nominal: `MoneyInput` (pemisah ribuan titik), `parseRupiah`/`formatRupiah` di `src/domain/money.ts`.
- Design system "pewarna alam" di `globals.css`: tarum (indigo) untuk aksi, kunyit hanya sorotan, daun = selesai/hadir, bata = terlambat/galat. Jangan hardkod warna. Font: Young Serif (`.display`, nama, judul halaman, angka besar) dan Plus Jakarta Sans (UI). Angka rupiah/tanggal pakai `.num` (tabular). Kontrol 44px, input 16px, radius per peran (`ctl` 12, `group` 16, `sheet` 22). Tepi tumpal (`.tumpal`) hanya di Beranda dan Masuk. Jangan beri `className` yang menimpa properti yang sudah diatur varian komponen (tidak ada tailwind-merge); pakai prop (`compact`, `stack`).
- Pola UI: judul halaman + tombol Tambah di `PageHeader`; cari + chip status + sheet Filter lewat `FilterBar`/`FilterSheet`; daftar lewat `Group` + `Row*`; judul kelompok menempel `SectionHead`; tombol Simpan di sheet lewat `StickyActions`.

## Git
- Branch `main`, remote `github.com/naufalatha/wedding-planner`.
- Commit atas nama **Naufal Atha Yudha <naufalatha130@gmail.com>**. **Jangan** menambah `Co-Authored-By` atau atribusi Claude di commit/PR (permintaan eksplisit pemilik repo).

## Status data produksi (Supabase proyek `mdshhihbakisqszeadnp`, wedding `f5ef7e5d-...`)
- Sudah diimpor dari spreadsheet: 242 tamu (semua belum konfirmasi) dan 94 item anggaran; ditambah item "Bale Gedong Venue" yang diisi manual beserta pembayaran aslinya (jangan disentuh).
- Sengaja TIDAK diimpor: vendor, tugas, deposit, pembayaran, harga final (estimasi saja). Saldo awal 60 jt sudah menggantikan deposit di sheet.
- Kategori item sudah dirapikan; form tambah item memberi saran kategori dan menyamakan ejaan.
- Impor lewat SQL langsung (tanpa tabel staging), jadi tidak ada riwayat batch.

## Keputusan arsitektur
- Tetap Vercel + Supabase Cloud. Jangan pindah ke VPS dulu; kalau pindah, mulai dari staging dan Supabase self-hosted (skema kompatibel). Ketergantungan khusus Supabase: `auth.uid()`/`auth.users` di RLS, publikasi Realtime, ekstensi di skema `extensions`.
- Saat monetisasi: tambah layanan kecil berbahasa Go untuk webhook pembayaran (Midtrans/Xendit), cron pengingat, email/WhatsApp, dan pembatasan paket. CRUD tetap di Supabase.
- Biaya acuan (harga resmi saat ditulis): Supabase Pro US$25, Vercel Pro US$20 per kursi; Vercel Hobby hanya non-komersial; Supabase Free tanpa backup harian.

## Daftar tugas berikutnya
1. Migrasi 0007: cabut `EXECUTE` dari `anon` pada fungsi SECURITY DEFINER (kecuali yang memang perlu), kunci `search_path` pada `tg_touch_row` dan `tg_limit_members`, ganti `auth.uid()` jadi `(select auth.uid())` di kebijakan insert (deposits, fund_withdrawals, vendors, budget_items, prep_tasks, guests), tambah indeks FK yang belum ada, aktifkan leaked-password protection (Auth).
2. Halaman Tamu: pengelompokan per tag, ringkasan hadir/belum, merapikan entri kembar ("Gen 6 PIKR", "KFC Team").
3. Beranda: tagihan jatuh tempo 7 hari, tugas terlambat, hitung mundur hari-H.
4. Proyek staging + CI tes SQL, Sentry, SMTP sendiri, ekspor CSV/PDF, pengingat jatuh tempo.
5. Sudah dikerjakan: filter Keuangan/Persiapan/Vendor/Setoran/Penarikan; popup via portal; caching; loader logo berputar.
