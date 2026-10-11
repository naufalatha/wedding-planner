import { cellRef, type Sheets } from "./csv";
import { clean, isPlaceholder, norm, parseDate, parseMoney } from "./values";

export type Entity = "wedding" | "deposit" | "budget_item" | "payment" | "vendor" | "task" | "guest";

export interface ImportRecord {
  entity: Entity;
  sourceKey: string;
  provenance: { sheet: string; cell: string };
  payload: Record<string, unknown>;
  state: "ready" | "needs_review";
  reviewReason?: string;
  /** sourceKey record induk (mis. pembayaran -> item anggaran) */
  dependsOn?: string;
}

export interface ImportPlan {
  records: ImportRecord[];
  warnings: string[];
  notImported: string[];
}

export interface ExtractOptions {
  /** Tanggal bayar bila sheet tidak mencatatnya (YYYY-MM-DD). */
  assumedPaymentDate: string;
  /** Keputusan manual untuk baris ambigu, kunci = sourceKey item. */
  resolutions?: Record<string, { final_price?: number }>;
}

type Grid = string[][];
const heldPaymentTotals = new WeakMap<ImportPlan, number>();
const at = (g: Grid, r: number, c: number) => (g[r]?.[c] ?? "").trim();

function findCell(g: Grid, re: RegExp, from = 0): { r: number; c: number } | null {
  for (let r = from; r < g.length; r++)
    for (let c = 0; c < g[r].length; c++) if (re.test(clean(g[r][c]))) return { r, c };
  return null;
}

function rightOf(g: Grid, pos: { r: number; c: number } | null, span = 4): string {
  if (!pos) return "";
  for (let c = pos.c + 1; c <= pos.c + span; c++) if (at(g, pos.r, c) !== "") return at(g, pos.r, c);
  return "";
}

function moneyBelow(g: Grid, pos: { r: number; c: number } | null, rows = 5): number | null {
  if (!pos) return null;
  for (let r = pos.r + 1; r <= pos.r + rows; r++) {
    const v = parseMoney(at(g, r, pos.c));
    if (v !== null && !Number.isNaN(v)) return v;
  }
  return null;
}

class KeyGen {
  private seen = new Map<string, number>();
  next(base: string): string {
    const n = (this.seen.get(base) ?? 0) + 1;
    this.seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  }
}

export function extractPlan(sheets: Sheets, opts: ExtractOptions): ImportPlan {
  const plan: ImportPlan = { records: [], warnings: [], notImported: [] };
  const keys = new KeyGen();
  const add = (r: ImportRecord) => plan.records.push(r);

  extractWedding(sheets, plan, add);
  const dpTotal = extractBudget(sheets, plan, add, keys, opts);
  extractVendors(sheets, plan, add, keys);
  extractTimeline(sheets, plan, add, keys);
  extractGuests(sheets, plan, add, keys);

  // Rekonsiliasi: angka "sudah dibayar" di sheet vs pembayaran yang benar-benar tercatat.
  const bt = sheets.get("Budgeting Tracker");
  if (bt) {
    const sheetPaid = moneyBelow(bt, findCell(bt, /^total paid$/i), 2);
    if (sheetPaid !== null && sheetPaid !== dpTotal) {
      plan.warnings.push(
        `Sheet mencatat "Total Paid" Rp${sheetPaid.toLocaleString("id-ID")}, tetapi pembayaran yang dapat dipastikan ` +
          `(kolom DP pada item berstatus DP) hanya Rp${dpTotal.toLocaleString("id-ID")}` +
          ((heldPaymentTotals.get(plan) ?? 0) > 0 ? ` (ditambah Rp${(heldPaymentTotals.get(plan) as number).toLocaleString("id-ID")} yang masih menunggu review)` : "") + `. ` +
          `Sheet kemungkinan menjumlahkan kolom Total harga item berstatus DP, bukan uang yang sudah keluar. ` +
          `Penarikan sebesar angka sheet TIDAK diimpor; saldo tersedia di aplikasi akan lebih tinggi dari sheet.`,
      );
    }
  }
  for (const s of ["Vendor List (reference only)", "WO", "Venue Option", "Catering Option", "MUA/Hairstylist Option",
    "Wedding Attire Option", "Photographer& Videographer", "Honeymoon Planning", "Honeymoon"]) {
    if (sheets.has(s)) plan.notImported.push(`${s}: di luar cakupan impor v1 (data banding/referensi/honeymoon).`);
  }
  return plan;
}

// ---------------------------------------------------------------------------
function extractWedding(sheets: Sheets, plan: ImportPlan, add: (r: ImportRecord) => void) {
  const m = sheets.get("Master");
  const s = sheets.get("Saving Tracker");
  const b = sheets.get("Budgeting Tracker");
  if (!m) { plan.warnings.push('Sheet "Master" tidak ditemukan.'); return; }
  const groom = findCell(m, /^groom'?s name$/i);
  const bride = findCell(m, /^bride'?s name$/i);
  const date = findCell(m, /^save the date$/i);
  const loc = findCell(m, /^location$/i);
  const wDate = parseDate(rightOf(m, date));
  if (!wDate) plan.warnings.push("Tanggal pernikahan tidak dapat dibaca dari sheet Master.");
  const target = s ? moneyBelow(s, findCell(s, /^wedding saving target$/i), 5) : null;
  const startPos = s ? findCell(s, /^starting balance$/i) : null;
  const opening = s ? moneyBelow(s, startPos, 2) : null;
  const cap = b ? parseMoney(rightOf(b, findCell(b, /^budget plan$/i))) : null;
  if (cap !== null && !Number.isNaN(cap)) {
    plan.warnings.push(
      `"Budget Plan" di sheet (Rp${cap.toLocaleString("id-ID")}) tidak diimpor sebagai batas anggaran karena merupakan jumlah estimasi item. ` +
        `Isi batas anggaran di Akun bila diperlukan.`,
    );
  }
  add({
    entity: "wedding",
    sourceKey: "wedding|main",
    provenance: { sheet: "Master", cell: groom ? cellRef(groom.r, groom.c) : "?" },
    payload: {
      groom_name: clean(rightOf(m, groom)), bride_name: clean(rightOf(m, bride)),
      wedding_date: wDate, location: clean(rightOf(m, loc)) || null,
      target_amount: target, opening_balance: opening ?? 0,
      budget_cap: null, // "Budget Plan" di sheet = jumlah semua estimasi, bukan batas yang ditetapkan pengguna
    },
    state: "ready",
  });

  // Setoran
  if (s) {
    const hdr = findCell(s, /^month$/i);
    if (hdr) {
      const row = s[hdr.r].map(clean);
      const cDate = row.findIndex((x) => /^date$/i.test(x));
      const cWho = row.findIndex((x) => /^contributor$/i.test(x));
      const cVal = row.findIndex((x) => /^value$/i.test(x));
      const seen = new KeyGen();
      for (let r = hdr.r + 1; r < s.length; r++) {
        const rawVal = at(s, r, cVal);
        if (rawVal === "" && at(s, r, cDate) === "") continue;
        const amount = parseMoney(rawVal);
        const d = parseDate(at(s, r, cDate));
        const who = clean(at(s, r, cWho)) || "Tidak diketahui";
        const bad = amount === null || Number.isNaN(amount) || amount <= 0 || d === null;
        add({
          entity: "deposit",
          sourceKey: seen.next(`deposit|${d}|${norm(who)}|${amount}`),
          provenance: { sheet: "Saving Tracker", cell: cellRef(r, cVal) },
          payload: { contributor: who, amount, deposited_on: d },
          state: bad ? "needs_review" : "ready",
          reviewReason: bad ? "Tanggal atau nominal setoran tidak valid." : undefined,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
const SECTIONS = ["paperwork", "seserahan", "vendor", "other"] as const;

function extractBudget(
  sheets: Sheets, plan: ImportPlan, add: (r: ImportRecord) => void, keys: KeyGen, opts: ExtractOptions,
): number {
  const g = sheets.get("Budgeting Tracker");
  if (!g) { plan.warnings.push('Sheet "Budgeting Tracker" tidak ditemukan.'); return 0; }
  let r0 = -1;
  for (let r = 0; r < g.length; r++) if (g[r].filter((x) => clean(x) === "No").length >= 3) { r0 = r; break; }
  if (r0 < 0) { plan.warnings.push("Tabel item anggaran tidak ditemukan."); return 0; }
  const starts = g[r0].map((x, i) => (clean(x) === "No" ? i : -1)).filter((i) => i >= 0);
  if (starts.length !== SECTIONS.length) {
    plan.warnings.push(`Ditemukan ${starts.length} blok anggaran, diharapkan ${SECTIONS.length}.`);
  }
  let dpTotal = 0;
  let heldPay = 0;

  starts.forEach((start, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : Math.max(...g.map((row) => row.length));
    const section = SECTIONS[k] ?? "other";
    const inRange = (re: RegExp, row: number) => {
      for (let c = start; c < end; c++) if (re.test(clean(g[row]?.[c]))) return c;
      return -1;
    };
    const cName = (() => { const a = inRange(/^items$/i, r0); return a >= 0 ? a : inRange(/paperworks/i, r0); })();
    const cCat = inRange(/^category$/i, r0);
    const cDue = inRange(/^due date$/i, r0);
    const cPay = inRange(/^payment date$/i, r0);
    const cNote = inRange(/^notes$/i, r0);
    const cEst = inRange(/^estimated/i, r0);
    const cReal = inRange(/^real price/i, r0 + 1);
    const cDp = inRange(/^dp/i, r0 + 1);
    const cRem = inRange(/^remaining/i, r0 + 1);
    const cTot = inRange(/^total/i, r0 + 1);
    const cStat = inRange(/^status$/i, r0);
    if (cName < 0) { plan.warnings.push(`Blok anggaran #${k + 1}: kolom nama tidak ditemukan.`); return; }

    for (let r = r0 + 2; r < g.length; r++) {
      if (!/^\d+$/.test(at(g, r, start))) continue;
      const name = clean(at(g, r, cName));
      if (name === "" || isPlaceholder(name)) continue;
      const category = cCat >= 0 ? clean(at(g, r, cCat)) || null : null;
      const m = (c: number) => (c < 0 ? null : parseMoney(at(g, r, c)));
      const est = m(cEst), real = m(cReal), dp = m(cDp), rem = m(cRem), tot = m(cTot);
      const status = cStat >= 0 ? norm(at(g, r, cStat)) : "";
      const key = keys.next(`budget_item|${section}|${norm(category ?? "")}|${norm(name)}`);
      const prov = { sheet: "Budgeting Tracker", cell: cellRef(r, cName) };

      const reasons: string[] = [];
      for (const [label, v] of [["estimasi", est], ["harga", real], ["DP", dp], ["sisa", rem], ["total", tot]] as const) {
        if (v !== null && Number.isNaN(v)) reasons.push(`format nominal ${label} tidak dikenal`);
      }
      const f = (v: number | null) => (v === null || Number.isNaN(v) ? null : v);
      if (real !== null && dp !== null && rem !== null && !Number.isNaN(real + dp + rem) && real - dp !== rem) {
        reasons.push(
          `harga Rp${real.toLocaleString("id-ID")} tidak cocok dengan DP Rp${dp.toLocaleString("id-ID")} + sisa Rp${rem.toLocaleString("id-ID")}` +
            (tot !== null ? ` (total sheet Rp${tot.toLocaleString("id-ID")})` : ""),
        );
      } else if (real !== null && tot !== null && !Number.isNaN(real + tot) && tot !== real && /^(dp|paid|lunas)$/.test(status)) {
        reasons.push(`harga Rp${real.toLocaleString("id-ID")} berbeda dari total Rp${tot.toLocaleString("id-ID")}`);
      }
      const wantsPayment = status === "dp" ? f(dp) : /^(paid|lunas)$/.test(status) ? f(tot) ?? f(real) : null;
      if (/^(paid|lunas|dp)$/.test(status) && (wantsPayment === null || wantsPayment <= 0)) {
        reasons.push(`berstatus ${status.toUpperCase()} tetapi nominal pembayaran tidak tertulis`);
      }

      const resolution = opts.resolutions?.[key];
      const resolved = resolution?.final_price !== undefined;
      const review = reasons.length > 0 && !resolved;
      add({
        entity: "budget_item",
        sourceKey: key,
        provenance: prov,
        payload: {
          section, category, name,
          estimated_price: f(est),
          final_price: resolved ? resolution!.final_price : review ? null : f(real),
          due_date: parseDate(cDue >= 0 ? at(g, r, cDue) : ""),
          notes: cNote >= 0 ? clean(at(g, r, cNote)) || null : null,
          ...(review ? { sheet_values: { estimated: est, real, dp, remaining: rem, total: tot, status } } : {}),
        },
        state: review ? "needs_review" : "ready",
        reviewReason: review ? `Baris ambigu: ${reasons.join("; ")}.` : undefined,
      });

      if (wantsPayment !== null && wantsPayment > 0 && !Number.isNaN(wantsPayment)) {
        const payDate = parseDate(cPay >= 0 ? at(g, r, cPay) : "");
        if (review) heldPay += wantsPayment; else dpTotal += wantsPayment;
        add({
          entity: "payment",
          sourceKey: `payment|${key}|${status === "dp" ? "dp" : "lunas"}`,
          provenance: { sheet: "Budgeting Tracker", cell: cellRef(r, status === "dp" ? cDp : cTot) },
          payload: {
            item_key: key, type: "payment", amount: wantsPayment,
            paid_on: payDate ?? opts.assumedPaymentDate, paid_on_assumed: payDate === null,
            funding_source: "wedding_fund",
          },
          state: review ? "needs_review" : "ready",
          reviewReason: review ? "Menunggu penyelesaian baris item induk." : undefined,
          dependsOn: key,
        });
      }
    }
  });
  if (plan.records.some((r) => r.entity === "payment" && (r.payload.paid_on_assumed as boolean))) {
    plan.warnings.push(
      `Sheet tidak mencatat tanggal bayar; pembayaran memakai tanggal asumsi ${opts.assumedPaymentDate} ` +
        `(ditandai paid_on_assumed) dan sumber dana diasumsikan "Dana pernikahan". Periksa setelah impor.`,
    );
  }
  heldPaymentTotals.set(plan, heldPay);
  return dpTotal;
}

// ---------------------------------------------------------------------------
function extractVendors(sheets: Sheets, plan: ImportPlan, add: (r: ImportRecord) => void, keys: KeyGen) {
  const g = sheets.get("Vendors");
  if (!g) return;
  const out: ImportRecord[] = [];
  for (let r = 0; r < g.length; r++) {
    const hc = g[r].findIndex((x) => /^final choice$/i.test(clean(x)));
    if (hc < 0) continue;
    // judul kategori: baris sebelumnya yang hanya punya satu sel terisi
    let category = "";
    for (let t = r - 1; t >= Math.max(0, r - 3); t--) {
      const filled = g[t].map(clean).filter((x) => x !== "");
      if (filled.length === 1) { category = filled[0]; break; }
    }
    if (!category) { plan.warnings.push(`Vendors!${cellRef(r, hc)}: judul kategori tidak ditemukan.`); continue; }
    const row = g[r].map(clean);
    const cName = row.findIndex((x) => /^name$/i.test(x));
    const cContact = row.findIndex((x) => /^contact$/i.test(x));
    const cAmount = row.findIndex((x) => /^amount$/i.test(x));
    const cNotes = row.findIndex((x) => /^notes$/i.test(x));
    const cPackage = row.findIndex((x) => /^package/i.test(x));
    const group: ImportRecord[] = [];
    for (let i = r + 1; i < g.length; i++) {
      const flag = clean(at(g, i, hc)).toUpperCase();
      if (flag !== "TRUE" && flag !== "FALSE") break;
      const name = clean(at(g, i, cName));
      if (name === "") continue;
      const price = parseMoney(at(g, i, cAmount));
      group.push({
        entity: "vendor",
        sourceKey: keys.next(`vendor|${norm(category)}|${norm(name)}`),
        provenance: { sheet: "Vendors", cell: cellRef(i, cName) },
        payload: {
          category, name, status: flag === "TRUE" ? "selected" : "candidate",
          contact: clean(at(g, i, cContact)) === "0" ? null : clean(at(g, i, cContact)) || null,
          price_quote: price === null || Number.isNaN(price) ? null : price,
          notes: clean(cNotes >= 0 ? at(g, i, cNotes) : "") || null,
          package: clean(cPackage >= 0 ? at(g, i, cPackage) : "") || null,
        },
        state: "ready",
      });
    }
    const selected = group.filter((x) => x.payload.status === "selected");
    if (selected.length > 1) {
      for (const s of selected) {
        s.state = "needs_review";
        s.reviewReason = `Lebih dari satu vendor terpilih di kategori "${category}"; hanya satu yang diizinkan.`;
      }
    }
    out.push(...group);
  }
  out.forEach(add);
}

// ---------------------------------------------------------------------------
const PHASES: [RegExp, string][] = [
  [/^12\+\s*months/i, "12plus"], [/^6-12\s*months/i, "6to12"], [/^3-6\s*months/i, "3to6"],
  [/^1-3\s*months/i, "1to3"], [/^1-2\s*weeks/i, "1to2w"], [/^1\s*week/i, "1w"],
  [/^1\s*day/i, "1d"], [/^wedding day/i, "dday"],
];

function extractTimeline(sheets: Sheets, plan: ImportPlan, add: (r: ImportRecord) => void, keys: KeyGen) {
  const g = sheets.get("Timeline");
  if (!g) return;
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < g[r].length; c++) {
      if (clean(g[r][c]) !== "DONE") continue;
      let phase: string | null = null;
      for (let t = r - 1; t >= Math.max(0, r - 6) && !phase; t--) {
        const txt = clean(g[t]?.[c]);
        for (const [re, id] of PHASES) if (re.test(txt)) phase = id;
      }
      if (!phase) { plan.warnings.push(`Timeline!${cellRef(r, c)}: judul fase tidak dikenali.`); continue; }
      for (let i = r + 1; i < g.length; i++) {
        const flag = clean(at(g, i, c)).toUpperCase();
        if (flag !== "TRUE" && flag !== "FALSE") break;
        const title = clean(at(g, i, c + 4));
        if (title === "") continue;
        const pr = norm(at(g, i, c + 3));
        const pic = clean(at(g, i, c + 2));
        add({
          entity: "task",
          sourceKey: keys.next(`task|${phase}|${norm(title)}`),
          provenance: { sheet: "Timeline", cell: cellRef(i, c + 4) },
          payload: {
            title, phase, done: flag === "TRUE",
            deadline: parseDate(at(g, i, c + 1)),
            // penanggung jawab di sheet berupa teks bebas; di aplikasi harus anggota, jadi masuk catatan
            notes: pic ? `PIC di spreadsheet: ${pic}` : null,
            priority: /high|tinggi/.test(pr) ? "high" : pr ? "normal" : null,
          },
          state: "ready",
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
function extractGuests(sheets: Sheets, plan: ImportPlan, add: (r: ImportRecord) => void, keys: KeyGen) {
  const g = sheets.get("Guest List");
  if (!g) return;
  // Ada tabel filter di sisi kanan dengan judul serupa; header asli sebaris dengan "GUEST TAGS".
  let hdr: { r: number; c: number } | null = null;
  for (let r = 0; r < g.length && !hdr; r++) {
    if (!g[r].some((x) => /^guest tags$/i.test(clean(x)))) continue;
    const c = g[r].findIndex((x) => /^guest name$/i.test(clean(x)));
    if (c >= 0) hdr = { r, c };
  }
  if (!hdr) { plan.warnings.push("Header daftar tamu tidak ditemukan."); return; }
  const row = g[hdr.r].map(clean);
  const cNo = hdr.c - 1;
  const cName = hdr.c;
  const cTag = row.findIndex((x, i) => i > cName && /^guest tags$/i.test(x));
  const cInv = row.findIndex((x, i) => i > cName && /^invitation$/i.test(x));
  const cRsvp = row.findIndex((x, i) => i > cName && /^rsvp response$/i.test(x));
  const cPhone = row.findIndex((x, i) => i > cName && /^phone number$/i.test(x));
  const cEmail = row.findIndex((x, i) => i > cName && /^email/i.test(x));
  let count = 0;
  for (let r = hdr.r + 1; r < g.length; r++) {
    if (!/^\d+$/.test(at(g, r, cNo))) continue;
    const name = clean(at(g, r, cName));
    if (name === "") continue;
    const rsvpRaw = norm(cRsvp >= 0 ? at(g, r, cRsvp) : "");
    let rsvp: "pending" | "attending" | "declined" = "pending";
    if (/unable|tidak|^no$|decline/.test(rsvpRaw)) rsvp = "declined";
    else if (/attend|^yes$|hadir/.test(rsvpRaw)) rsvp = "attending";
    count++;
    add({
      entity: "guest",
      sourceKey: keys.next(`guest|${at(g, r, cNo)}|${norm(name)}`),
      provenance: { sheet: "Guest List", cell: cellRef(r, cName) },
      payload: {
        name, tag: clean(at(g, r, cTag)) || null,
        invited_count: null, // headcount tidak pernah ditebak dari nama
        confirmed_count: rsvp === "declined" ? 0 : null,
        invitation_sent: /^sent$/i.test(clean(at(g, r, cInv))),
        rsvp, phone: clean(cPhone >= 0 ? at(g, r, cPhone) : "") || null,
        email: clean(cEmail >= 0 ? at(g, r, cEmail) : "").replace(/^,+|,+$/g, "").trim() || null,
      },
      state: "ready",
    });
  }
  const m = sheets.get("Master");
  const tot = m ? findCell(m, /^total guest$/i) : null;
  const expected = tot && m ? Number(at(m, tot.r + 1, tot.c)) : NaN;
  if (!Number.isNaN(expected) && expected !== count) {
    plan.warnings.push(`Jumlah tamu terbaca ${count}, sheet Master menyebut ${expected}.`);
  }
}
