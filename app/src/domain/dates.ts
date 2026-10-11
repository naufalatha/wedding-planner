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
