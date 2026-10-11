/** Data berubah di perangkat lain sejak formulir dibuka. */
export class ConflictError extends Error {
  constructor() { super("conflict"); this.name = "ConflictError"; }
}

const MESSAGES: [RegExp, string][] = [
  [/conflict/, "Data ini baru saja diubah di perangkat lain. Muat ulang lalu coba lagi; isian Anda tidak dihapus."],
  [/invalid_invitation/, "Kode undangan tidak valid, sudah dipakai, atau kedaluwarsa."],
  [/already_in_wedding/, "Akun ini sudah tergabung di sebuah pernikahan."],
  [/member_limit_reached/, "Pernikahan ini sudah memiliki 2 anggota."],
  [/refund_exceeds_payment/, "Jumlah refund melebihi pembayaran asal."],
  [/has_active_refunds/, "Pembayaran ini punya refund aktif. Batalkan refund terlebih dahulu."],
  [/has_active_payments/, "Item ini punya pembayaran aktif. Batalkan pembayaran terlebih dahulu."],
  [/reason_required/, "Alasan pembatalan wajib diisi."],
  [/vendors_one_selected_per_category/, "Kategori ini sudah punya vendor terpilih."],
  [/vendor_not_found/, "Vendor tidak ditemukan."],
  [/guests_check|violates check constraint/, "Isian tidak valid. Periksa jumlah tamu dan status RSVP."],
  [/Invalid login credentials/i, "Email atau kata sandi salah."],
  [/User already registered/i, "Email ini sudah terdaftar. Silakan masuk."],
  [/Failed to fetch|NetworkError|network/i, "Tidak ada koneksi. Isian Anda aman; coba lagi saat tersambung."],
];

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? `${e.name} ${e.message}` : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  for (const [re, msg] of MESSAGES) if (re.test(raw)) return msg;
  return "Terjadi kesalahan. Coba lagi.";
}
