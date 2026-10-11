# Spesifikasi Wedding Planner Naufal & Bella

Tanggal: 11 Oktober 2026. Status: rancangan tertulis untuk review pengguna; belum menjadi persetujuan implementasi.

## 1. Tujuan dan keputusan desain

Aplikasi mobile iOS dan Android untuk Naufal dan Bella mengelola persiapan satu pernikahan bersama. Keberhasilan versi pertama berarti keduanya dapat melihat kondisi persiapan, mencatat pembayaran atau tugas, membandingkan vendor, dan memperbarui tamu melalui formulir singkat tanpa membuka spreadsheet.

Keputusan yang disetujui dalam percakapan: lima menu inti (Beranda, Keuangan, Persiapan, Vendor, Tamu); Flutter dan Supabase; dua akun dalam satu ruang pernikahan; sinkronisasi antarperangkat; struktur ruang pernikahan yang dapat mendukung banyak pasangan kemudian. Referensi visual terbaru adalah Budggt dan screenshot yang diberikan pengguna, menggantikan usulan warna sage sebelumnya.

Keputusan rinci dalam dokumen ini merupakan proposal implementasi untuk review. Tidak ada akun, proyek cloud, atau aplikasi yang dibuat melalui penulisan spesifikasi ini.

## 2. Cakupan versi pertama

Termasuk autentikasi, satu ruang pernikahan aktif, bergabungnya pasangan kedua, pengaturan tanggal/lokasi/target dana, kelima menu, tambah/edit/arsip data, sinkronisasi, dan impor awal terkontrol dari spreadsheet terlampir.

Honeymoon, moodboard, marketplace vendor, AI, kirim undangan otomatis, RSVP publik, push notification, integrasi bank, billing, dan distribusi App Store/Play Store berada di luar versi pertama. Deadline dan tagihan tetap terlihat di aplikasi. Untuk penggunaan awal, distribusi build pengujian dilakukan sebagai tahap terpisah setelah aplikasi tervalidasi.

Bahasa antarmuka Indonesia; mata uang IDR dalam rupiah utuh; tanggal kalender dan countdown memakai Asia/Jakarta. Countdown dihitung dari tanggal pernikahan, bukan nilai cache spreadsheet. Tanggal belum diisi menampilkan ajakan melengkapi pengaturan, bukan countdown nol.

## 3. Arah visual dan interaksi

Halaman publik Budggt yang ditinjau memiliki latar putih, judul hitam tegas, aksen lime, serta ringkasan dashboard. Screenshot pengguna adalah referensi tambahan dengan kartu membulat dan warna lime, mint, serta lavender. Referensi dipakai sebagai inspirasi komponen; spesifikasi tidak menganggap website menyediakan file design kit yang bisa diunduh.

Token warna proposal: background #FAFAF7; surface #FFFFFF; teks utama #171717; teks sekunder #666A66; border #E5E7E1; lime #D7FF00; lime lembut #F1F8C8; mint lembut #E8F3EA; lavender lembut #EEE9F8; error #B42318. Tombol lime menggunakan teks gelap, dan teks/status tidak mengandalkan warna saja. Warna akhir harus melewati pemeriksaan kontras.

Skala spacing 4/8/12/16/24/32 logical pixels; padding layar 20; radius kartu 20; radius input 12; tombol utama tinggi minimal 48; target sentuh minimal 48 x 48. Font menggunakan font sans bawaan platform sehingga tidak memerlukan lisensi font eksternal. Judul layar 28–32, angka ringkasan 28–36, isi 16, label 13–14. Mendukung pembesaran teks tanpa terpotong.

Navigasi bawah menampilkan ikon dan label kelima menu. Menu akun/pengaturan diakses melalui avatar di Beranda. Tidak menggunakan sidebar desktop atau tabel lebar sebagai navigasi mobile. Informasi disusun sebagai kartu dan daftar; formulir menggunakan halaman detail atau bottom sheet yang aman saat keyboard terbuka. Detail tambahan berada di bagian opsional agar formulir pertama tetap singkat.

Loading, kosong, gagal, sedang menyimpan, tersimpan, dan data belum tersinkron memiliki tampilan terpisah. Grafik sederhana melengkapi angka dan label, tidak menggantikannya. Dark mode belum menjadi persyaratan versi pertama.

## 4. Akun dan ruang bersama

Autentikasi menggunakan Supabase Auth dengan email dan password; mendukung masuk, daftar, keluar, serta reset password melalui alur standar penyedia. Pengiriman email autentikasi baru terjadi ketika pengguna menjalankan alur tersebut pada aplikasi yang telah dikonfigurasi.

Pengguna pertama membuat ruang pernikahan dengan nama pasangan, tanggal, lokasi opsional, dan target dana. Pemilik membuat kode undangan sekali pakai, berlaku tujuh hari, yang dibagikan sendiri kepada pasangan. Pengguna kedua masuk dengan akunnya lalu menukarkan kode. Penukaran dilakukan di server secara atomik; kapasitas awal maksimal dua anggota. Kode disimpan dalam bentuk hash dan pembacaan daftar kode tidak dibuka untuk client.

Kedua anggota dapat membaca dan mengubah isi planner. Hanya pemilik dapat membuat/membatalkan kode dan mengelola keanggotaan. Keanggotaan tidak dapat dibuat atau diperluas dengan insert langsung dari client. Akses data selalu berdasarkan membership, bukan berdasarkan nama Naufal/Bella atau ID yang ditanam di aplikasi.

Versi pertama membatasi setiap akun pada satu ruang aktif. Tabel dan seluruh records tetap memiliki wedding_id agar perluasan banyak pasangan tidak memerlukan pemisahan database per pasangan. UI pemilih banyak pernikahan dan paket komersial ditunda.

## 5. Lima menu

### 5.1 Beranda

Header berisi nama pasangan dan tanggal pernikahan. Kartu utama menunjukkan countdown. Ringkasan berisi dana terkumpul, saldo dana tersedia, pembayaran tercatat, progres checklist, jumlah undangan, dan jumlah orang yang telah diketahui.

Bagian berikutnya menampilkan maksimal tiga tugas terbuka dengan deadline terdekat dan tiga tagihan dengan jatuh tempo terdekat. Item terlambat tampil dahulu. Tugas tanpa deadline tetap dapat ditemukan di Persiapan. Tindakan cepat: Tambah tugas dan Catat pembayaran. Mengetuk ringkasan membuka daftar yang relevan.

Angka yang belum dapat dihitung karena data belum lengkap diberi label Belum lengkap. Jumlah orang yang belum diketahui tidak dijadikan nol tanpa keterangan.

### 5.2 Keuangan

Dua bagian: Anggaran & Pembayaran dan Tabungan. Kategori dapat ditambah pengguna; kategori awal mencakup dokumen, seserahan, lamaran, vendor, dan kebutuhan lainnya.

Item anggaran memiliki nama, kategori, estimasi, harga final opsional, jatuh tempo opsional, vendor opsional, dan catatan. Harga final kosong dibedakan dari nol. Harga komitmen adalah harga final jika tersedia, selain itu estimasi. Kartu ringkasan membedakan total estimasi, total komitmen, pembayaran tercatat, dan sisa tagihan. Estimasi sisa diberi label estimasi jika harga final belum tersedia.

Setiap pembayaran memiliki nominal positif, tanggal, pencatat, sumber dana (Dana pernikahan atau Dibayar terpisah), catatan opsional, dan ID permintaan untuk mencegah transaksi ganda saat retry. Record berjenis pembayaran atau pengembalian; pengembalian mereferensikan pembayaran asal melalui parent_payment_id dan tidak boleh melebihi nominal yang belum dikembalikan. Pembatalan catatan salah tidak dianggap sebagai uang refund yang benar-benar diterima. DP dan pelunasan adalah label pembayaran, bukan kolom saldo independen. Status dihitung: belum dibayar jika total pembayaran nol; DP jika pembayaran lebih dari nol dan kurang dari harga komitmen; lunas jika sama; kelebihan bayar jika lebih besar. Kelebihan pembayaran tidak disembunyikan dengan pembatasan sisa ke nol.

Tabungan menampilkan setoran per kontributor, penarikan lain, dan arus keluar pembayaran yang terhubung. Tidak menambahkan nominal DP ke total pembayaran kedua kalinya. Pemilihan Dana pernikahan menghasilkan satu arus kas terhubung secara atomik. Pembayaran terpisah tetap menambah pengeluaran tetapi tidak otomatis mengurangi saldo tabungan bersama.

Definisi perhitungan:

- Dana terkumpul = saldo awal + setoran; label menyatakan ini akumulasi pendanaan selama persiapan.
- Progres pendanaan = dana terkumpul / target, jika target positif. Jika melebihi target, angka aktual tetap ditampilkan; panjang bar dibatasi 100%.
- Saldo tersedia = saldo awal + setoran − penarikan lain − pembayaran dari dana pernikahan + pengembalian dana yang benar-benar masuk.
- Total dibayar per item = pembayaran aktif − pembatalan/pengembalian pembayaran yang berlaku.
- Sisa tagihan = harga komitmen − total dibayar. Nilai negatif berarti kelebihan bayar, bukan nol.
- Sisa anggaran rencana = total batas anggaran yang ditetapkan − total komitmen. Batas anggaran dan target tabungan adalah dua pengaturan berbeda.

Nominal disimpan sebagai integer/bigint rupiah, bukan float. Saldo negatif boleh tercatat dengan penanda kekurangan dana sehingga catatan tidak menyembunyikan kondisi aktual. Item tanpa estimasi maupun harga final tampil sebagai belum dianggarkan dan tidak dijumlahkan sebagai nol tanpa keterangan.

Edit/pembatalan pembayaran dilakukan melalui operasi server yang mengubah catatan pembayaran dan arus kas terkait dalam satu transaksi. Catatan finansial tidak dihapus permanen melalui aplikasi; pembatalan menyimpan audit dan nilai ringkasan memakai records aktif. Item dengan pembayaran hanya dapat diarsipkan setelah transaksi terkait ditangani atau dipertahankan dalam riwayat.

### 5.3 Persiapan

Daftar tugas dapat difilter Semua, Milik saya, Terlambat, dan Selesai. Fields: judul wajib, kategori/fase opsional, deadline opsional, prioritas (normal/tinggi), penanggung jawab anggota aktif atau belum ditugaskan, dan catatan. Fase mengikuti pengelompokan waktu spreadsheet tanpa menciptakan tugas dari checkbox kosong.

Tandai selesai dan buka kembali tersedia langsung dari daftar. Progress = tugas aktif selesai / seluruh tugas aktif; jika belum ada tugas, tampilkan Belum ada tugas. Penanggung jawab tidak boleh berasal dari ruang pernikahan lain. Arsip tidak termasuk denominator progress.

### 5.4 Vendor

Kategori awal mengikuti kebutuhan dalam spreadsheet: WO, venue, catering, MUA, busana, foto/video, dekorasi, dan kategori lain yang diisi pengguna. Status kandidat: dipertimbangkan, terpilih, atau tidak dipilih. Pengguna dapat membandingkan dua kandidat dalam tampilan vertikal berisi nama, paket, harga, kontak, dan catatan.

Setiap kandidat memiliki nama, kategori, kontak opsional, tautan portfolio/social opsional, paket, harga penawaran opsional, dan catatan. Satu vendor terpilih per kategori pada versi pertama. Pergantian pilihan mempertahankan kandidat lama dalam riwayat daftar dan tidak mengubah pembayaran sebelumnya.

Tindakan Tambahkan ke anggaran meminta pengguna memilih membuat item atau menghubungkan item yang sudah ada. Pemilihan vendor tidak otomatis menciptakan transaksi. Perubahan harga vendor tidak menimpa harga komitmen anggaran tanpa tindakan pengguna. Paket gabungan dapat dihubungkan ke beberapa item dengan pembagian nominal eksplisit; harga paket tidak diduplikasi penuh ke setiap kategori.

Direktori referensi vendor dalam spreadsheet tidak dimasukkan sebagai marketplace atau daftar kandidat personal secara massal. Kontak/tautan dibuka setelah tindakan pengguna; aplikasi tidak mengirim pesan otomatis.

### 5.5 Tamu

Satu record adalah satu undangan/kelompok penerima, bukan otomatis satu orang. Fields: nama undangan wajib, kelompok/tag opsional, jumlah orang yang diundang opsional, jumlah hadir terkonfirmasi opsional, telepon/email opsional, status undangan (belum dikirim/sudah dikirim), RSVP (belum ada jawaban/hadir/tidak hadir), dan catatan.

Jumlah orang adalah integer positif bila diisi; hadir terkonfirmasi antara nol dan jumlah undangan bila jumlah undangan diketahui. RSVP tidak hadir menghasilkan jumlah hadir nol. RSVP hadir tanpa jumlah hadir menampilkan Jumlah hadir belum diisi. Nama pasangan atau keluarga dalam sebuah teks tidak diurai untuk menebak headcount.

Ringkasan memisahkan jumlah undangan, jumlah undangan dikirim, jumlah orang diundang yang sudah diketahui, jumlah record dengan headcount belum diisi, dan jumlah orang hadir terkonfirmasi. Tidak ada default headcount satu saat impor. Pencarian nama dan filter kelompok/status/RSVP tersedia. Nama yang sama boleh muncul; duplikasi nama menjadi peringatan, bukan alasan otomatis menggabungkan tamu.

## 6. Arsitektur dan batas tanggung jawab

Flutter memakai organisasi per fitur: presentation, application, domain, dan data. Riverpod mengelola state/dependency, go_router mengelola navigasi, supabase_flutter untuk Auth/database/realtime, intl untuk format Indonesia. Versi paket dipilih dari rilis kompatibel saat implementasi dan dikunci pada lockfile; spesifikasi ini tidak menebak versi terbaru.

Widgets bersama mencakup summary card, status badge, empty/error state, currency input, date input, dan confirmation sheet. Logika finansial/headcount berada di domain/server, tidak disalin di setiap widget. Repository memiliki implementasi Supabase dan fake untuk pengujian; data contoh ditandai contoh dan bukan data pribadi yang ditanam ke source produksi.

Entitas server:

| Entitas | Tanggung jawab |
| --- | --- |
| profiles | Nama tampilan akun |
| weddings | Nama pasangan, tanggal, zona waktu, lokasi, target dana, batas anggaran |
| wedding_members | Hubungan akun dan ruang; role owner/partner |
| wedding_invites | Undangan membership berumur terbatas; hash kode dan state penukaran |
| budget_items | Estimasi, komitmen, jatuh tempo, kategori, vendor terkait |
| payments | Catatan pembayaran, sumber dana, pembatalan/pengembalian, request ID |
| fund_entries | Setoran, penarikan lain, pengembalian dana, atau arus kas terkait pembayaran |
| tasks | Checklist, deadline, assignee, status |
| vendors | Kandidat dan pilihan per kategori |
| guests | Record undangan, headcount, RSVP, status pengiriman |
| import_batches / import_rows | Staging impor, sumber record, masalah validasi, status konfirmasi |

Semua child records memiliki wedding_id, UUID, created_at, updated_at, created_by, revision, dan informasi arsip/pembatalan sesuai jenisnya. Foreign key gabungan (wedding_id, referenced_id) mencegah hubungan lintas ruang. Unique constraint membatasi satu kandidat terpilih per kategori, satu transaksi arus kas per pembayaran, request ID per ruang, dan satu hasil impor per identitas sumber.

Operasi create ruang, tukar undangan, catat/ubah/batalkan pembayaran, pilih vendor, dan commit impor dijalankan secara atomik melalui RPC atau server function dengan validasi membership. Ringkasan finansial membaca ledger aktif yang sama. RLS aktif pada seluruh tabel; pengguna anonim dan akun nonanggota ditolak. Definer functions dibatasi execute untuk role yang tepat, memakai search_path aman, dan memvalidasi auth.uid(). Service-role key tidak masuk aplikasi.

## 7. Sinkronisasi dan kegagalan

Versi pertama online-first; tidak menjanjikan antrean perubahan offline. Data terakhir yang ada di memori boleh tetap terlihat dengan status Belum tersinkron. Form tetap mempertahankan isian selama layar aktif saat penyimpanan gagal. Keluar layar dengan perubahan belum tersimpan menampilkan konfirmasi agar tidak hilang tanpa sengaja. Draft permanen setelah aplikasi ditutup berada di luar versi pertama.

Setiap mutation menunggu keberhasilan server sebelum menampilkan tersimpan. Keuangan tidak memakai optimistic balance. Retry menggunakan request ID yang sama. Saat koneksi kembali atau aplikasi aktif kembali, repository mengambil ulang data. Realtime wedding-scoped menginvalidasi cache dan mengambil nilai otoritatif; channel ditutup saat keluar atau berganti sesi.

Edit menggunakan revision/compare-and-set. Jika versi record berubah karena pasangan mengedit, aplikasi menawarkan muat versi terbaru dan mempertahankan isian untuk ditinjau; tidak menimpa diam-diam. Kegagalan jaringan, akses ditolak, sesi habis, konflik edit, dan input tidak valid memiliki pesan serta tindakan yang berbeda. Berkas log tidak memuat daftar tamu, kontak lengkap, password, atau token sesi.

## 8. Impor awal spreadsheet

Sumber adalah snapshot XLSX yang dilampirkan; spreadsheet asli tidak diubah. Importer satu kali dijalankan sebagai tooling terpisah, bukan pembaca XLSX umum di aplikasi mobile. Preview staging dapat ditinjau dari aplikasi sebelum commit. Eksekusi importer tidak mengunggah data ke proyek cloud sebelum proyek tujuan dan aksesnya dikonfigurasi pengguna.

| Sumber | Pemetaan |
| --- | --- |
| Master | Nama pasangan, tanggal, lokasi; bukan cached countdown/chart |
| Budgeting Tracker | Item/estimasi/harga final dan kandidat pembayaran; kategori menurut blok |
| Saving Tracker | Setoran rinci; saldo awal hanya jika ada nilai eksplisit |
| Timeline | Tugas berjudul nyata, fase, deadline, PIC, prioritas, done |
| Vendors + tab opsi personal | Kandidat/pilihan; deduplikasi dengan konfirmasi untuk paket/nama ambigu |
| Guest List | Nama undangan, tag, kontak, status undangan, RSVP; headcount belum diisi |

Vendor List (reference only), navigation labels, blank checkboxes, nomor urut tanpa isi, Sheet34, dont open, Honeymoon, Honeymoon Planning, moodboard, dan contoh placeholder tidak diimpor sebagai data personal aplikasi.

Temuan dari snapshot untuk preview, bukan jaminan kondisi Google Sheet terkini: Master menampilkan 28 Agustus 2027 dan lokasi TBA - Bogor, Indonesia; Saving Tracker menampilkan target Rp100.000.000 dan enam setoran yang berjumlah Rp42.000.000. Daftar nama tamu utama berisi 242 record. Tidak tersedia kolom jumlah orang per undangan. Data ini mengikuti snapshot yang diberikan, bukan tanggal dari percakapan lama.

Ada kolom berlabel Remaining Payment yang justru ikut dijumlahkan ke Total pada formula spreadsheet. Contoh baris venue: harga final Rp9.500.000, DP Rp3.500.000, kolom tersebut Rp5.500.000, dan total cache Rp9.000.000 dengan status DP. Karena maknanya tidak pasti, importer tidak menganggap Rp5.500.000 sebagai pembayaran atau sisa yang sudah terverifikasi. Baris ini ditahan untuk review pengguna dengan nilai sumber ditampilkan berdampingan.

Aturan impor: preserve blank vs zero; tanggal pembayaran yang kosong tetap tidak diketahui; jangan mengarang tanggal dengan tanggal impor; jangan gunakan status Paid/DP sebagai bukti nominal; jangan memasukkan summary Withdraws dan pembayaran rinci sebagai dua pengeluaran yang sama. Summary Rp31.250.000 tidak dijadikan transaksi penarikan otomatis. Jika ledger rinci belum menjelaskan jumlah tersebut, selisih ditampilkan di preview dan records terkait belum diaktifkan.

Preview menampilkan record valid, pending review, skipped placeholders, dan kemungkinan duplikasi. Normalisasi status bahasa Inggris ke enum aplikasi diperbolehkan dengan pemetaan eksplisit. Formula dan teks error/cache tidak menjadi nominal. Tiap row memiliki sumber sheet/cell atau group cells, fingerprint workbook, dan source key stabil. Reimport snapshot yang sama tidak menggandakan records. Snapshot berbeda selalu menjalani preview; tidak melakukan merge berdasarkan nama saja.

Commit berlaku per batch yang telah dipilih dan divalidasi; records finansial bermasalah tetap staging. Nilai ringkasan setelah commit dihitung dari records aktif yang berhasil diimpor, disertai status Impor belum lengkap selama staging unresolved masih ada. Pengguna dapat memilih mulai kosong dan memasukkan data manual.

## 9. Validasi dan kriteria penerimaan

1. Dua akun anggota dapat melihat dan mengubah kelima menu pada ruang yang sama. Akun ketiga/nonanggota tidak dapat membaca atau menulis records tersebut, termasuk melalui API langsung.
2. Auth, create ruang, undangan sekali pakai/expired, dan logout tervalidasi. Membership tidak dapat dipalsukan dari client.
3. Item Rp10 juta dengan DP Rp3 juta lalu pembayaran Rp7 juta menghasilkan dibayar Rp10 juta dan sisa nol. Jika dari dana pernikahan, saldo berkurang total Rp10 juta tepat sekali; retry maupun realtime tidak menggandakan transaksi.
4. Pembayaran terpisah tidak mengurangi saldo bersama. Pembatalan/refund mengoreksi pembayaran dan arus kas terkait secara atomik sesuai dana yang benar-benar kembali.
5. Perubahan transaksi oleh dua perangkat menghasilkan konflik yang terlihat bila revision tidak cocok. Isian pengguna tidak hilang saat gagal simpan selama layar tetap aktif.
6. Satu undangan untuk dua orang dihitung sebagai satu undangan dan dua orang. 242 record tanpa headcount tetap 242 undangan dengan jumlah orang belum lengkap, bukan otomatis 242 orang.
7. Checkbox kosong tidak menambah tugas. Pengarsipan memengaruhi denominator progres secara konsisten. Vendor terpilih tidak menambah transaksi finansial otomatis.
8. Impor mempertahankan provenance, menahan contoh pembayaran ambigu, dan tidak menggandakan pembayaran/penarikan atau hasil reimport.
9. Semua layar diuji pada lebar mobile kecil, keyboard terbuka, text scaling, loading/empty/error, dan kontras. Angka rupiah dan kelima label navigasi tidak terpotong.
10. Flutter analyze serta unit/widget tests lulus. Uji Supabase lokal membuktikan RLS, transaksi, idempotency, cross-wedding foreign keys, dan membership capacity. Build Android diverifikasi jika SDK tersedia; iOS memerlukan macOS/Xcode dan diverifikasi di lingkungan yang mendukung. Pemeriksaan yang tidak dapat dijalankan dilaporkan secara eksplisit.

## 10. Hasil yang diharapkan dan tahapan review

Hasil implementasi kelak: source Flutter, schema/migrations Supabase, tooling preview impor, pengujian domain/UI/akses database, serta README setup dan build. Source tidak memuat service key atau data tamu pribadi sebagai contoh publik.

Dokumen ini menjadi batas implementasi setelah pengguna menyetujuinya. Sesudah review spesifikasi, langkah berikutnya adalah rencana implementasi tertulis dan pemilihan metode eksekusi sesuai alur Superpowers. Aktivasi cloud, impor aktual ke cloud, dan distribusi build belum dilakukan pada tahap spesifikasi.

## Referensi

- Workbook snapshot: Wedding Planner Naufal & Bella.xlsx yang dilampirkan dalam percakapan ini; file asli tetap utuh.
- Screenshot 2026-10-11 at 14.51.10.png: referensi visual tambahan pengguna.
- https://budggt.com/ — halaman publik dan tampilan yang ditinjau pada 11 Oktober 2026; tidak masuk ke akun pengguna.
- https://docs.flutter.dev/platform-integration — dukungan lintas platform.
- https://supabase.com/docs/guides/database/overview — PostgreSQL.
- https://supabase.com/docs/guides/database/postgres/row-level-security — akses data berbasis RLS.
