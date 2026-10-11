/** Parser CSV RFC4180 minimal. Baris kosong dipertahankan agar nomor baris tetap sesuai sumber. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const pushCell = () => { row.push(cell); cell = ""; };
  const pushRow = () => { pushCell(); rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { pushCell(); i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { pushRow(); i++; continue; }
    cell += ch; i++;
  }
  if (cell !== "" || row.length > 0) pushRow();
  return rows;
}

export type Sheets = Map<string, string[][]>;

/** Memecah dump teks "## Sheet name: X" + CSV menjadi sheet-sheet. */
export function splitSheets(text: string): Sheets {
  const sheets: Sheets = new Map();
  const marker = /^## Sheet name: (.*)$/gm;
  const found: { name: string; start: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(text))) {
    found.push({ name: m[1].trim(), start: m.index, bodyStart: m.index + m[0].length + 1 });
  }
  found.forEach((f, idx) => {
    const end = idx + 1 < found.length ? found[idx + 1].start : text.length;
    sheets.set(f.name, parseCsv(text.slice(f.bodyStart, end)));
  });
  return sheets;
}

export function colLetter(c: number): string {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export const cellRef = (r: number, c: number) => `${colLetter(c)}${r + 1}`;
