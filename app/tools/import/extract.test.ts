import { describe, expect, it } from "vitest";
import { parseCsv, splitSheets } from "./csv";
import { extractPlan } from "./extract";
import { buildDump } from "./fixture";
import { parseDate, parseMoney } from "./values";

const opts = { assumedPaymentDate: "2026-10-11" };
const plan = () => extractPlan(splitSheets(buildDump()), opts);
const of = (p: ReturnType<typeof plan>, e: string) => p.records.filter((r) => r.entity === e);

describe("parser", () => {
  it("CSV: kutip, koma, baris baru dalam sel, baris kosong dipertahankan", () => {
    expect(parseCsv('a,"b,c","d\ne"\n\nx,"y""z"\n')).toEqual([["a", "b,c", "d\ne"], [""], ["x", 'y"z']]);
  });
  it("nominal dan tanggal", () => {
    expect(parseMoney("Rp69,715,000.00")).toBe(69_715_000);
    expect(parseMoney("-Rp31,250,000.00")).toBe(-31_250_000);
    expect(parseMoney("17.500.000")).toBe(17_500_000);
    expect(parseMoney("")).toBeNull();
    expect(Number.isNaN(parseMoney("Rp1,5jt"))).toBe(true);
    expect(Number.isNaN(parseMoney("Rp1,000.55"))).toBe(true); // berpecahan tidak dibulatkan diam-diam
    expect(parseDate("Saturday, August 28, 2027")).toBe("2027-08-28");
    expect(parseDate("4/30/2025")).toBe("2025-04-30");
    expect(parseDate("2/30/2025")).toBeNull();
  });
});

describe("ekstraksi", () => {
  it("wedding", () => {
    const w = of(plan(), "wedding")[0].payload;
    expect(w).toMatchObject({ groom_name: "Adi Contoh", wedding_date: "2027-08-28", target_amount: 100_000_000, budget_cap: null, opening_balance: 0 });
    expect(plan().warnings.join("\n")).toMatch(/Budget Plan.*tidak diimpor sebagai batas/);
  });
  it("setoran", () => {
    const d = of(plan(), "deposit");
    expect(d.map((x) => x.payload.amount)).toEqual([20_000_000, 2_500_000, 2_500_000]);
    expect(new Set(d.map((x) => x.sourceKey)).size).toBe(3); // kunci unik walau nominal sama
  });
  it("baris venue yang jumlahnya tidak cocok ditahan untuk review, bukan ditebak", () => {
    const p = plan();
    const venue = of(p, "budget_item").find((r) => r.payload.name === "GEDUNG CONTOH")!;
    expect(venue.state).toBe("needs_review");
    expect(venue.reviewReason).toMatch(/tidak cocok/);
    expect(venue.payload.final_price).toBeNull();
    const pay = of(p, "payment").find((r) => r.dependsOn === venue.sourceKey)!;
    expect(pay.state).toBe("needs_review");
  });
  it("baris konsisten diimpor dengan pembayaran DP", () => {
    const p = plan();
    const deco = of(p, "budget_item").find((r) => r.payload.name === "DEKOR CONTOH")!;
    expect(deco).toMatchObject({ state: "ready" });
    expect(deco.payload).toMatchObject({ section: "vendor", category: "DECORATION", estimated_price: 13_000_000, final_price: 13_000_000 });
    const pay = of(p, "payment").find((r) => r.dependsOn === deco.sourceKey)!;
    expect(pay.payload).toMatchObject({ amount: 1_000_000, paid_on: "2026-10-11", paid_on_assumed: true, funding_source: "wedding_fund" });
  });
  it("resolusi manual menyelesaikan baris ambigu", () => {
    const base = plan();
    const key = of(base, "budget_item").find((r) => r.payload.name === "GEDUNG CONTOH")!.sourceKey;
    const p = extractPlan(splitSheets(buildDump()), { ...opts, resolutions: { [key]: { final_price: 9_500_000 } } });
    const venue = of(p, "budget_item").find((r) => r.sourceKey === key)!;
    expect(venue.state).toBe("ready");
    expect(venue.payload.final_price).toBe(9_500_000);
    expect(of(p, "payment").find((r) => r.dependsOn === key)!.state).toBe("ready");
  });
  it("harga kosong tetap null; placeholder dilewati", () => {
    const p = plan();
    const foto = of(p, "budget_item").find((r) => r.payload.name === "Pas foto")!;
    expect(foto.payload).toMatchObject({ section: "paperwork", estimated_price: null, final_price: null });
    expect(of(p, "budget_item").some((r) => String(r.payload.name).startsWith("[Input"))).toBe(false);
    const tas = of(p, "budget_item").find((r) => r.payload.name === "Tas Contoh")!;
    expect(tas.payload).toMatchObject({ section: "seserahan", estimated_price: 1_500_000 });
  });
  it("vendor: satu terpilih per kategori; ganda -> review", () => {
    const v = of(plan(), "vendor");
    const wo = v.filter((r) => r.payload.category === "WEDDING ORGANIZER");
    expect(wo.map((r) => r.payload.status)).toEqual(["candidate", "selected"]);
    expect(wo[0].payload).toMatchObject({ price_quote: 17_500_000, notes: "catatan baris dua" });
    expect(wo[1].payload.contact).toBeNull(); // "0" = kosong di sheet
    const cat = v.filter((r) => r.payload.category === "CATERING");
    expect(cat.every((r) => r.state === "needs_review")).toBe(true);
  });
  it("tugas per fase", () => {
    const t = of(plan(), "task");
    expect(t.map((r) => [r.payload.phase, r.payload.title, r.payload.done])).toEqual([
      ["12plus", "List seserahan", false], ["12plus", "Cari gedung", true], ["6to12", "Hubungi vendor makeup", true],
    ]);
  });
  it("tamu: 1 baris = 1 undangan, headcount tidak ditebak dari nama, header asli dipilih", () => {
    const g = of(plan(), "guest");
    expect(g).toHaveLength(3);
    expect(g[0].payload).toMatchObject({ name: "Tamu Satu dan Pasangan", invited_count: null, confirmed_count: null, rsvp: "pending", invitation_sent: false, phone: "0812-1111" });
    expect(g[1].payload).toMatchObject({ invitation_sent: true, rsvp: "declined", confirmed_count: 0 });
  });
  it("peringatan rekonsiliasi dan sheet yang tidak diimpor", () => {
    const p = plan();
    expect(p.warnings.join("\n")).toMatch(/Total Paid[\s\S]*9\.500\.000[\s\S]*1\.000\.000/);
    expect(p.warnings.join("\n")).toMatch(/tanggal asumsi/);
    expect(p.notImported.join("\n")).toMatch(/Honeymoon/);
  });
  it("kunci sumber stabil antar-eksekusi", () => {
    expect(plan().records.map((r) => r.sourceKey)).toEqual(plan().records.map((r) => r.sourceKey));
  });
});
