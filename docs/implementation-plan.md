# Rencana Implementasi: Wedding Planner (Web/PWA)

Sumber: `2026-10-11-wedding-planner-design.md` (spesifikasi desain). Dokumen ini mengadaptasi
spesifikasi dari Flutter ke web sesuai keputusan 2026-10-11. Backend, aturan bisnis, dan
desain visual tidak berubah.

## Keputusan yang berubah dari spesifikasi
| Spesifikasi | Implementasi |
|---|---|
| Flutter iOS/Android | Next.js 16 (App Router) + TypeScript, PWA yang bisa dipasang di layar utama |
| Riverpod | TanStack Query (server state) + state lokal React |
| go_router | App Router Next.js |
| supabase_flutter | `@supabase/supabase-js` + `@supabase/ssr` |
| intl id_ID | `Intl.NumberFormat('id-ID')`, zona waktu Asia/Jakarta |
| Distribusi store | Di luar cakupan; PWA dipasang lewat "Tambahkan ke Layar Utama" |

Tidak berubah: Supabase Auth email/password, PostgreSQL + RLS, RPC atomik, realtime per wedding,
tanpa service-role key di klien, token warna dan komponen visual, lima menu, rumus keuangan,
aturan tamu, importer satu kali.

## Asumsi yang perlu dikonfirmasi
1. Spesifikasi bertanda "belum menjadi persetujuan implementasi"; permintaan lanjut dianggap persetujuan.
2. Baris venue ambigu (DP 3.5jt + sisa 5.5jt = 9jt, harga 9.5jt) tidak ditebak; masuk antrean review.
3. Proyek Supabase nyata belum ada; skema diuji secara lokal dan kunci diisi lewat `.env.local`.

## Tahapan
1. **Scaffold**: Next.js, Tailwind dengan token desain, manifest PWA. (selesai)
2. **Skema Supabase** (`supabase/migrations`): tabel multi-tenant, RLS, RPC, tes SQL.
3. **Domain logic** (`src/domain`): fungsi murni untuk keuangan dan tamu, diuji dengan angka spreadsheet.
4. **Importer** (`tools/import`): parser dump CSV/XLSX → staging → pratinjau → commit idempoten.
5. **UI**: Beranda, Keuangan, Persiapan, Vendor, Tamu, auth dan undangan pasangan.
6. **Verifikasi**: lint, typecheck, test, build, cek 10 kriteria penerimaan, README.

## Batasan verifikasi
- Tes UI dan akses DB terhadap Supabase nyata memerlukan proyek Supabase; tes SQL dijalankan
  terhadap PostgreSQL lokal bila bisa dipasang di workspace.
