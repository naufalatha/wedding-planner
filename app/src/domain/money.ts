/** Rupiah utuh (integer). `null` berarti kosong dan berbeda dari 0. */
export type Rupiah = number;

const fmt = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** "Rp42.000.000"; negatif ditampilkan apa adanya ("-Rp100.000"); kosong jadi "—". */
export function formatRupiah(value: Rupiah | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return fmt.format(value).replace(/ /g, "");
}

/**
 * Mengurai input pengguna ("1.500.000", "Rp 1,5jt" tidak didukung). Hanya digit.
 * Kosong -> null. Tidak valid -> NaN supaya form bisa menolaknya.
 */
export function parseRupiah(input: string): Rupiah | null {
  const t = input.trim();
  if (t === "") return null;
  const digits = t.replace(/^rp\.?/i, "").replace(/[.\s]/g, "");
  if (!/^\d+$/.test(digits)) return Number.NaN;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : Number.NaN;
}
