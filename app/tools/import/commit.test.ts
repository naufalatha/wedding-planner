import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commitPlan, uuidFromKey } from "./commit";
import { extractPlan } from "./extract";
import { splitSheets } from "./csv";
import { buildDump } from "./fixture";

const ADMIN = process.env.TEST_PG_URL; // mis. postgres://postgres@127.0.0.1:54329/postgres
const U1 = "11111111-1111-1111-1111-111111111111";
const dbName = `wp_import_${process.pid}`;
const dbUrl = ADMIN ? ADMIN.replace(/\/[^/]*$/, `/${dbName}`) : "";
const supa = path.resolve(import.meta.dirname, "../../../supabase");
const opts = { assumedPaymentDate: "2026-10-11" };

describe.skipIf(!ADMIN)("commit importer (PostgreSQL)", () => {
  let wedding = "";
  const run = (resolutions?: Record<string, { final_price?: number }>, mutate?: (p: ReturnType<typeof extractPlan>) => void) => {
    const plan = extractPlan(splitSheets(buildDump()), { ...opts, resolutions });
    mutate?.(plan);
    return commitPlan({ plan, fingerprint: "fp-test", label: "fixture", weddingId: wedding, userId: U1, databaseUrl: dbUrl });
  };
  const q = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) => {
    const c = new pg.Client({ connectionString: dbUrl });
    await c.connect();
    try { return (await c.query<T>(sql, params)).rows; } finally { await c.end(); }
  };

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: ADMIN });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    await admin.end();
    const c = new pg.Client({ connectionString: dbUrl });
    await c.connect();
    await c.query(readFileSync(path.join(supa, "tests/00_supabase_shim.sql"), "utf8"));
    for (const f of readdirSync(path.join(supa, "migrations")).sort()) {
      await c.query(readFileSync(path.join(supa, "migrations", f), "utf8"));
    }
    await c.query("select set_config('request.jwt.claim.sub', $1, false)", [U1]);
    wedding = (await c.query("select public.create_wedding('Adi Contoh','Sari Contoh') as id")).rows[0].id;
    await c.end();
  }, 60_000);

  afterAll(async () => {
    const admin = new pg.Client({ connectionString: ADMIN });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  it("commit pertama: yang jelas masuk, yang ambigu ditahan", async () => {
    const r = await run();
    expect(r.failed).toEqual([]);
    expect(r.committed).toBe(17);
    expect(r.heldForReview.map((h) => h.sourceKey).sort()).toEqual(expect.arrayContaining([
      expect.stringContaining("gedung contoh"), expect.stringContaining("katering a"), expect.stringContaining("katering b"),
    ]));
    expect(r.heldForReview).toHaveLength(4);
    const [s] = await q<{ collected: string; available_balance: string }>(
      "select set_config('request.jwt.claim.sub', $2, true), * from public.finance_summary($1)", [wedding, U1]);
    expect(Number(s.collected)).toBe(25_000_000);
    expect(Number(s.available_balance)).toBe(24_000_000); // 25 jt - DP dekor 1 jt
    const [w] = await q<{ target_amount: string; budget_cap: string; wedding_date: string }>(
      "select target_amount, budget_cap, to_char(wedding_date,'YYYY-MM-DD') as wedding_date from public.weddings where id = $1", [wedding]);
    expect(Number(w.target_amount)).toBe(100_000_000);
    expect(w.wedding_date).toBe("2027-08-28");
    expect((await q("select 1 from public.budget_items where name = 'GEDUNG CONTOH'")).length).toBe(0);
  });

  it("commit ulang idempoten: tidak ada duplikat", async () => {
    const before = await q<{ n: string }>("select (select count(*) from public.guests) + (select count(*) from public.deposits) + (select count(*) from public.payments) + (select count(*) from public.cash_flow_entries) as n");
    const r = await run();
    expect(r.committed).toBe(0);
    expect(r.unchanged).toBe(17);
    const after = await q<{ n: string }>("select (select count(*) from public.guests) + (select count(*) from public.deposits) + (select count(*) from public.payments) + (select count(*) from public.cash_flow_entries) as n");
    expect(after[0].n).toBe(before[0].n);
    expect((await q("select 1 from public.import_batches where wedding_id = $1", [wedding])).length).toBe(1);
  });

  it("resolusi manual meng-commit baris venue dan pembayarannya, sekali saja", async () => {
    const key = "budget_item|vendor|venue|gedung contoh";
    const r = await run({ [key]: { final_price: 9_500_000 } });
    expect(r.committed).toBe(2);
    expect(r.heldForReview).toHaveLength(2); // hanya katering yang masih ganda
    const [item] = await q<{ final_price: string }>("select final_price from public.budget_items where name = 'GEDUNG CONTOH'");
    expect(Number(item.final_price)).toBe(9_500_000);
    const [pay] = await q<{ amount: string; request_id: string }>("select amount, request_id from public.payments where amount = 3500000");
    expect(pay.request_id).toBe(uuidFromKey(`payment|${key}|dp`));
    const again = await run({ [key]: { final_price: 9_500_000 } });
    expect(again.committed).toBe(0);
    expect((await q("select 1 from public.payments where amount = 3500000")).length).toBe(1);
  });

  it("sumber berubah setelah impor: dilaporkan, data aplikasi tidak ditimpa", async () => {
    const r = await run(undefined, (plan) => {
      const g = plan.records.find((x) => x.entity === "guest")!;
      g.payload.phone = "0899-BERUBAH";
    });
    expect(r.changedSinceImport).toHaveLength(1);
    expect((await q("select 1 from public.guests where phone = '0899-BERUBAH'")).length).toBe(0);
  });

  it("menolak pengguna yang bukan anggota wedding", async () => {
    const plan = extractPlan(splitSheets(buildDump()), opts);
    await expect(commitPlan({ plan, fingerprint: "x", label: "x", weddingId: wedding, userId: "99999999-9999-9999-9999-999999999999", databaseUrl: dbUrl }))
      .rejects.toThrow(/bukan anggota/);
  });
});
