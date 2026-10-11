# Wedding Planner (web / PWA)

Aplikasi perencana pernikahan sederhana untuk dua orang, menggantikan spreadsheet
"Wedding Planner Naufal & Bella". Dibuat sebagai web app mobile-first yang bisa dipasang
di layar utama iPhone/Android (PWA). Spesifikasi desain: `docs/2026-10-11-wedding-planner-design.md`;
penyesuaian ke stack web: `docs/implementation-plan.md`.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · TanStack Query · Supabase
(Auth, PostgreSQL + RLS, RPC, Realtime). Lima menu: Beranda, Keuangan, Persiapan, Vendor, Tamu.

Ringkas per menu:
- **Beranda**: hitung mundur, dana terkumpul, saldo, sisa tagihan, tugas dan tagihan terdekat, aksi cepat.
- **Keuangan**: ringkasan anggaran (estimasi, komitmen, dibayar, sisa), item dengan jatuh tempo dan vendor, setoran per kontributor, penarikan (bisa diubah/dibatalkan).
- **Vendor**: bandingkan kandidat per kategori, pilih satu (atomik), tambahkan ke anggaran.
- **Tamu**: satu baris = satu undangan; jumlah orang opsional, filter tag, peringatan nama ganda.

Catatan angka: `budget_cap` (batas anggaran) kosong sampai diatur di Akun; "Budget Plan" di spreadsheet hanyalah jumlah estimasi, jadi tidak diimpor sebagai batas.

## Struktur
```
app/                 aplikasi Next.js
  src/domain/        logika murni (rupiah, keuangan, tamu, tugas, tanggal) + tes
  src/lib/           klien Supabase, API, hooks, pesan galat
  src/app/           halaman (masuk, mulai, beranda, keuangan, persiapan, vendor, tamu, akun)
  tools/import/      importer spreadsheet satu kali (preview → commit idempoten)
  e2e/smoke.mjs      smoke test UI dengan backend di-mock
supabase/
  migrations/        skema, RLS, RPC, staging impor, arsip, ringkasan + pilih vendor (0005)
  tests/             tes SQL (RLS, idempotensi, undangan, pembatalan)
docs/                spesifikasi + rencana implementasi
```

## Menjalankan
1. Buat proyek Supabase. Terapkan migrasi berurutan (`supabase db push`, atau tempel isi
   `supabase/migrations/*.sql` berurutan di SQL Editor).
2. Authentication → aktifkan Email. Untuk dua pengguna pribadi, matikan "Confirm email" bila ingin
   langsung masuk setelah daftar, atau biarkan aktif dan konfirmasi lewat email.
3. `cd app && cp .env.example .env.local`, isi URL dan **anon key** (bukan service-role key).
4. `npm install && npm run dev` → buka http://localhost:3000.
5. Daftar → **Buat pernikahan**. Pasangan mendaftar lalu memakai **Punya kode** dengan kode dari
   **Akun → Undang pasangan** (7 hari, sekali pakai, maksimal 2 anggota).
6. Pasang di ponsel: Safari → Bagikan → *Tambahkan ke Layar Utama*; Chrome Android → *Instal aplikasi*.
   Deploy bisa ke Vercel (set dua variabel env di atas).

## Pemeriksaan
```
npm run check                      # typecheck + lint + unit/integrasi
TEST_PG_URL=postgres://postgres@127.0.0.1:5432/postgres npm test   # termasuk tes importer ke PostgreSQL
PGHOST=… PGPORT=… PGUSER=postgres npm run test:db                  # tes skema/RLS/RPC (PostgreSQL 15+)
npm run e2e                        # smoke UI (butuh `next start` dan Chromium)
```
Tes SQL memakai shim `supabase/tests/00_supabase_shim.sql` (role dan `auth.uid()`), jadi cukup PostgreSQL biasa.

## Impor spreadsheet (sekali jalan)
Format yang didukung: dump teks per sheet (`## Sheet name: …` + CSV). XLSX biner belum didukung;
ekspor ke format itu atau tambahkan pembaca XLSX.
```
npm run import:preview -- /jalur/dump.txt --assumed-date 2026-10-11
```
Pratinjau menampilkan jumlah per entitas, **baris yang ditahan untuk review**, dan peringatan rekonsiliasi.
Baris ambigu tidak ditebak. Putuskan lewat `resolutions.json`:
```json
{ "budget_item|vendor|venue|nama gedung": { "final_price": 9500000 } }
```
Commit (jalankan sebagai pemilik database, bukan dari aplikasi; hanya mengisi kolom wedding yang kosong):
```
DATABASE_URL=postgres://… npm run import:commit -- /jalur/dump.txt --wedding <uuid> --user <uuid> --resolutions resolutions.json
```
Commit ulang aman: baris yang sama dilewati (kunci sumber stabil + request ID pembayaran deterministik);
baris yang sumbernya berubah dilaporkan, tidak menimpa data di aplikasi.
**Jangan commit berkas dump atau pratinjau; isinya data tamu nyata.**

## Keamanan
- RLS aktif di semua tabel; anon dan non-anggota ditolak. Keanggotaan, undangan, pembayaran, dan buku kas
  hanya berubah lewat RPC `SECURITY DEFINER` (search_path dikunci, memeriksa `auth.uid()`).
- Kode undangan hanya disimpan sebagai hash SHA-256; tidak ada service-role key di aplikasi.
- Catatan keuangan tidak pernah dihapus keras: dibatalkan dengan alasan dan audit; tugas/vendor/tamu diarsipkan.

## Batasan yang diketahui (jujur)
- **Belum diuji terhadap Supabase sungguhan** (Auth, Realtime, PostgREST). Skema/RLS/RPC diuji di PostgreSQL 16
  lokal; UI diuji di Chromium dengan backend di-mock. Lakukan satu putaran uji manual dengan dua akun setelah deploy.
- Aplikasi native iOS/Android (Flutter) tidak dibuat: SDK-nya tidak dapat diunduh di lingkungan pembangunan.
  Backend yang sama bisa dipakai klien Flutter nanti.
- Mode offline, notifikasi push, dan penyimpanan di App Store/Play Store di luar cakupan v1 (sesuai spesifikasi).
- Tab opsi vendor (WO/Venue/…/Honeymoon) tidak diimpor; hanya sheet *Vendors* (kandidat + pilihan akhir).
- Sheet menghitung "Total Paid" Rp31.250.000 dari kolom *Total* item berstatus DP, bukan uang yang keluar;
  importer hanya mengimpor nominal DP dan memperingatkan selisihnya (lihat pratinjau).
