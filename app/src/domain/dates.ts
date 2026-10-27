const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta = UTC+7 tanpa DST

/** Tanggal kalender (YYYY-MM-DD) di Asia/Jakarta untuk suatu instan. */
export function jakartaDate(now: Date): string {
  return new Date(now.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Hari menuju tanggal acara, berdasarkan kalender Jakarta. Negatif = sudah lewat. */
export function daysUntil(eventDate: string, now: Date): number {
  const a = Date.parse(`${jakartaDate(now)}T00:00:00Z`);
  const b = Date.parse(`${eventDate}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** "28 Agu 2027" dari "2027-08-28" (tanggal kalender, tanpa konversi zona waktu). */
export function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Hari dan bulan singkat untuk blok tanggal: "2026-10-28" -> { day: "28", mon: "Okt" }. */
export function dayMonth(date: string): { day: string; mon: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return { day: String(d.getUTCDate()), mon: d.toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" }) };
}

/** Selisih hari kalender terhadap `today` (YYYY-MM-DD) dalam kata: "Hari ini", "Besok", "3 hari lagi", "Terlambat 2 hari". */
export function dueLabel(date: string, today: string): string {
  const n = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (n === 0) return "Hari ini";
  if (n === 1) return "Besok";
  return n > 1 ? `${n} hari lagi` : `Terlambat ${-n} hari`;
}
