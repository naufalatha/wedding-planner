# 💍 Wedding Planner

Aplikasi perencana pernikahan yang sederhana dan bersih untuk dua orang. Menggantikan spreadsheet
"Wedding Planner Naufal & Bella" dengan web app mobile-first yang bisa dipasang di layar utama
iPhone dan Android (PWA).

> **Status:** v1 siap dicoba. Belum diuji terhadap proyek Supabase sungguhan (lihat [Batasan](#batasan-yang-diketahui)).

## Daftar isi
- [Fitur](#fitur)
- [Tech stack](#tech-stack)
- [Mulai cepat](#mulai-cepat)
- [Pemakaian pertama](#pemakaian-pertama)
- [Pasang di ponsel](#pasang-di-ponsel)
- [Struktur proyek](#struktur-proyek)
- [Pengujian](#pengujian)
- [Impor spreadsheet](#impor-spreadsheet-sekali-jalan)
- [Keamanan](#keamanan)
- [Batasan yang diketahui](#batasan-yang-diketahui)

## Fitur

Lima menu di navigasi bawah:

| Menu | Isi |
|---|---|
| **Beranda** | Hitung mundur hari H, dana terkumpul, saldo tersedia, sisa tagihan, tugas dan tagihan terdekat, aksi cepat (catat pembayaran, tugas baru) |
| **Keuangan** | Ringkasan anggaran (estimasi, komitmen, dibayar, sisa), item dengan jatuh tempo dan vendor, setoran per kontributor, penarikan dana |
| **Persiapan** | Daftar tugas per fase, filter (milik saya, terlambat, selesai), penanggung jawab, prioritas, catatan |
| **Vendor** | Kandidat per kategori, bandingkan, pilih satu vendor, tambahkan ke anggaran |
| **Tamu** | Satu baris = satu undangan, RSVP, jumlah orang opsional, filter tag, peringatan nama ganda |

Akun dan undangan pasangan ada di avatar pada Beranda.

**Prinsip data**
- Uang disimpan sebagai rupiah utuh. Kosong (belum diisi) berbeda dengan 0.
- Catatan keuangan tidak pernah dihapus keras: dibatalkan dengan alasan. Tugas, vendor, dan tamu diarsipkan.
- Online-first: saldo selalu dihitung server, tanpa angka optimistis di layar.
- Dua orang bisa mengedit bersamaan. Konflik terdeteksi lewat nomor revisi, perubahan live lewat Realtime.

**Rumus utama**
- Harga tagihan = harga final, atau estimasi bila final belum ada.
- Status item: belum dibayar, DP, lunas, atau kelebihan bayar.
- Saldo tersedia = saldo awal + setoran − penarikan − pembayaran dari dana pernikahan (refund dihitung setelah diterima).
- Sisa anggaran rencana = batas anggaran − total komitmen (hanya muncul bila batas diatur di Akun).

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · TanStack Query ·
Supabase (Auth, PostgreSQL + RLS, RPC, Realtime) · Vitest · Playwright

## Mulai cepat

Butuh **Node.js 22.12+** (Node 20 memunculkan peringatan `EBADENGINE` dan tes bisa gagal) dan satu proyek Supabase.
Di folder `app/` sudah ada `.nvmrc`, jadi cukup `nvm install && nvm use`.

**1. Siapkan database.** Di Supabase → SQL Editor, jalankan semua file di `supabase/migrations/`
berurutan (0001 sampai 0006). Atau pakai `supabase db push`.

**2. Atur Auth.** Authentication → Providers → aktifkan **Email**. Untuk dua pengguna pribadi,
matikan *Confirm email* agar bisa langsung masuk setelah daftar.

**3. Isi environment.** File contoh ada di folder `app/`:
```bash
cd app
cp .env.example .env.local
```
Isi dari Supabase → Project Settings → API:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
```
> Pakai kunci **anon** saja. Jangan pernah memasukkan `service_role` ke aplikasi ini.

**4. Jalankan.**
```bash
npm install
npm run dev
```
Buka http://localhost:3000.

## Pemakaian pertama

1. Daftar di halaman **Masuk**.
2. Pilih **Buat pernikahan**: nama, tanggal, lokasi, target dana, saldo awal.
3. Di **Akun**, isi *batas anggaran* agar "Sisa anggaran rencana" muncul.
4. Undang pasangan: **Akun → Undang pasangan**, salin kode (berlaku 7 hari, sekali pakai, maksimal 2 anggota).
5. Pasangan daftar dengan emailnya sendiri, lalu pilih **Punya kode** dan masukkan kode tadi.

## Pasang di ponsel

Deploy ke Vercel (root directory `app`, Node 22, isi dua variabel env di atas), lalu buka URL-nya di ponsel:
- **iPhone:** Safari → Bagikan → *Tambahkan ke Layar Utama*
- **Android:** Chrome → *Instal aplikasi*

## Struktur proyek

```
app/                  aplikasi Next.js
  src/domain/         logika murni (rupiah, keuangan, tamu, tugas, tanggal) + tes
  src/lib/            klien Supabase, API, hooks, pesan galat
  src/app/            halaman: masuk, mulai, beranda, keuangan, persiapan, vendor, tamu, akun
  tools/import/       importer spreadsheet sekali jalan
  e2e/smoke.mjs       smoke test UI (backend di-mock)
supabase/
  migrations/         skema, RLS, RPC, staging impor, arsip, ringkasan + pilih vendor, perbaikan pgcrypto
  tests/              tes SQL (RLS, idempotensi, undangan, pembatalan)
docs/                 spesifikasi desain + rencana implementasi
```

## Pengujian

Jalankan dari folder `app/`:

| Perintah | Yang diuji |
|---|---|
| `npm run check` | typecheck + lint + tes unit |
| `TEST_PG_URL=postgres://postgres@127.0.0.1:5432/postgres npm test` | termasuk tes importer ke PostgreSQL |
| `PGHOST=… PGPORT=… PGUSER=postgres npm run test:db` | skema, RLS, RPC (PostgreSQL 15+) |
| `npm run e2e` | smoke UI (butuh `next start` dan Chromium) |

Tes SQL memakai shim `supabase/tests/00_supabase_shim.sql`, jadi PostgreSQL biasa sudah cukup.

## Impor spreadsheet (sekali jalan)

Format: dump teks per sheet (`## Sheet name: …` + CSV). XLSX biner belum didukung.

**1. Pratinjau**
```bash
npm run import:preview -- /jalur/dump.txt --assumed-date 2026-10-11
```
Menampilkan jumlah per entitas, **baris yang ditahan untuk review**, dan peringatan rekonsiliasi.
Baris ambigu tidak ditebak. Putuskan lewat `resolutions.json`:
```json
{ "budget_item|vendor|venue|nama gedung": { "final_price": 9500000 } }
```

**2. Commit** (jalankan sebagai pemilik database, bukan dari aplikasi):
```bash
DATABASE_URL=postgres://… npm run import:commit -- /jalur/dump.txt --wedding <uuid> --user <uuid> --resolutions resolutions.json
```
Commit ulang aman: baris yang sama dilewati. Baris yang sumbernya berubah dilaporkan dan tidak menimpa data di aplikasi.

> **Jangan commit berkas dump atau pratinjau.** Isinya data tamu nyata.

## Keamanan

- RLS aktif di semua tabel. Pengguna anon dan non-anggota ditolak.
- Keanggotaan, undangan, pembayaran, dan buku kas hanya berubah lewat RPC `SECURITY DEFINER`
  (search_path dikunci, memeriksa `auth.uid()`).
- Kode undangan disimpan sebagai hash SHA-256. Tidak ada service-role key di aplikasi.

## Batasan yang diketahui

- **Belum diuji terhadap Supabase sungguhan** (Auth, Realtime, PostgREST). Skema dan RPC diuji di PostgreSQL 16 lokal,
  UI diuji di Chromium dengan backend di-mock. Lakukan satu putaran uji manual dengan dua akun setelah deploy.
- Aplikasi native iOS/Android (Flutter) tidak dibuat. Backend yang sama bisa dipakai klien Flutter nanti.
- Mode offline, notifikasi push, dan App Store/Play Store di luar cakupan v1.
- Paket vendor yang dipecah ke beberapa item anggaran belum didukung.
- Impor: tab opsi vendor dan Honeymoon tidak diimpor, hanya sheet *Vendors*. Angka "Total Paid" Rp31.250.000 di sheet
  adalah jumlah kolom *Total* item berstatus DP, bukan uang yang keluar, jadi hanya nominal DP yang diimpor
  (selisihnya diperingatkan di pratinjau). Tanggal pembayaran tidak ada di sheet, jadi memakai tanggal asumsi yang ditandai.
