import type { Rupiah } from "./money";

export interface OpenTask { id: string; title: string; deadline: string | null; done: boolean }
export interface BillItem { id: string; name: string; dueDate: string | null; remaining: Rupiah | null }

const byDeadline = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Tugas terbuka dengan tenggat terdekat. Urutan menaik menempatkan yang terlambat paling awal. Tanpa tenggat tidak ditampilkan di sini. */
export function nearestOpenTasks<T extends OpenTask>(tasks: readonly T[], n = 3): T[] {
  return tasks
    .filter((t) => !t.done && t.deadline !== null)
    .sort((a, b) => byDeadline(a.deadline as string, b.deadline as string))
    .slice(0, n);
}

/** Tagihan dengan jatuh tempo terdekat yang masih ada sisanya. */
export function nearestBills<T extends BillItem>(items: readonly T[], n = 3): T[] {
  return items
    .filter((i) => i.dueDate !== null && i.remaining !== null && i.remaining > 0)
    .sort((a, b) => byDeadline(a.dueDate as string, b.dueDate as string))
    .slice(0, n);
}

export const isPast = (date: string | null, today: string) => date !== null && date < today;

/** Total setoran per kontributor, terbesar dahulu. Nama dinormalkan (huruf besar/kecil, spasi). */
export function contributorTotals(deposits: readonly { contributor: string; amount: Rupiah }[]): { name: string; total: Rupiah }[] {
  const map = new Map<string, { name: string; total: Rupiah }>();
  for (const d of deposits) {
    const key = d.contributor.trim().toLowerCase().replace(/\s+/g, " ");
    const cur = map.get(key);
    if (cur) cur.total += d.amount;
    else map.set(key, { name: d.contributor.trim().replace(/\s+/g, " "), total: d.amount });
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
