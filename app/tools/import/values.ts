/** Rupiah dari sel sheet. Kosong -> null; format tak dikenal / berpecahan -> NaN. */
export function parseMoney(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let t = raw.trim();
  if (t === "" || t === "-") return null;
  let neg = false;
  if (t.startsWith("-")) { neg = true; t = t.slice(1); }
  t = t.replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
  if (t.startsWith("-")) { neg = true; t = t.slice(1); }
  let digits: string;
  if (/^\d+$/.test(t)) digits = t;
  else if (/^\d{1,3}(,\d{3})+(\.0+)?$/.test(t)) digits = t.replace(/\.0+$/, "").replace(/,/g, "");
  else if (/^\d+\.0+$/.test(t)) digits = t.replace(/\.0+$/, "");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) digits = t.replace(/\./g, "");
  else return Number.NaN;
  const n = Number(digits);
  return neg ? -n : n;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** "Saturday, August 28, 2027" atau "4/30/2025" -> "2027-08-28"; selain itu null. */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t); // m/d/yyyy (format sheet)
  if (m) return iso(+m[3], +m[1], +m[2]);
  m = /^(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(t);
  if (m && MONTHS[m[1].toLowerCase()]) return iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
export const isPlaceholder = (s: string) => /^\[.*input.*\]?\)?$/i.test(s.trim()) || /^\[input/i.test(s.trim());
