import { createHash } from "node:crypto";
import pg from "pg";
import type { Entity, ImportPlan, ImportRecord } from "./extract";

export interface CommitOptions {
  plan: ImportPlan;
  fingerprint: string;
  label: string;
  weddingId: string;
  /** Pengguna anggota wedding; dipakai sebagai created_by dan auth.uid() untuk RPC. */
  userId: string;
  databaseUrl: string;
}

export interface CommitResult {
  batchId: string;
  committed: number;
  unchanged: number;
  changedSinceImport: string[];
  heldForReview: { sourceKey: string; reason: string }[];
  failed: { sourceKey: string; error: string }[];
}

const ORDER: Entity[] = ["wedding", "deposit", "vendor", "budget_item", "payment", "task", "guest"];
const TABLE: Record<Entity, string> = {
  wedding: "weddings", deposit: "deposits", vendor: "vendors", budget_item: "budget_items",
  payment: "payments", task: "prep_tasks", guest: "guests",
};

export const payloadHash = (p: unknown) => createHash("sha256").update(JSON.stringify(p)).digest("hex");

/** UUID deterministik dari source key -> request_id pembayaran yang idempoten. */
export function uuidFromKey(key: string): string {
  const h = createHash("sha256").update(`wp-import:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

interface Ctx { c: pg.Client; o: CommitOptions; batchId: string; res: CommitResult }

export async function commitPlan(o: CommitOptions): Promise<CommitResult> {
  const c = new pg.Client({ connectionString: o.databaseUrl });
  await c.connect();
  const res: CommitResult = { batchId: "", committed: 0, unchanged: 0, changedSinceImport: [], heldForReview: [], failed: [] };
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [o.userId]);
    const member = await c.query("select 1 from public.wedding_members where wedding_id = $1 and user_id = $2", [o.weddingId, o.userId]);
    if (member.rowCount === 0) throw new Error("Pengguna bukan anggota wedding ini.");

    const found = await c.query("select id from public.import_batches where wedding_id = $1 and source_fingerprint = $2", [o.weddingId, o.fingerprint]);
    const batchId: string = found.rows[0]?.id ?? (await c.query(
      "insert into public.import_batches (wedding_id, source_label, source_fingerprint) values ($1,$2,$3) returning id",
      [o.weddingId, o.label, o.fingerprint])).rows[0].id;
    res.batchId = batchId;
    const ctx: Ctx = { c, o, batchId, res };

    const sorted = [...o.plan.records].sort((a, b) => ORDER.indexOf(a.entity) - ORDER.indexOf(b.entity));
    for (const rec of sorted) {
      await c.query("savepoint rec");
      try {
        await processRecord(ctx, rec);
        await c.query("release savepoint rec");
      } catch (e) {
        await c.query("rollback to savepoint rec");
        await c.query("release savepoint rec");
        const msg = e instanceof Error ? e.message : String(e);
        res.failed.push({ sourceKey: rec.sourceKey, error: msg });
        await upsertStaging(ctx, rec, "needs_review", `Gagal saat commit: ${msg}`, null);
      }
    }
    const clean = res.heldForReview.length === 0 && res.failed.length === 0;
    await c.query(
      "update public.import_batches set status = $2, committed_at = now(), summary = $3 where id = $1",
      [batchId, clean ? "committed" : "previewed",
        JSON.stringify({ committed: res.committed, unchanged: res.unchanged, held: res.heldForReview.length, failed: res.failed.length })]);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
  return res;
}

async function upsertStaging(ctx: Ctx, rec: ImportRecord, state: string, reason: string | null, targetId: string | null) {
  await ctx.c.query(
    `insert into public.import_rows (wedding_id, batch_id, source_key, entity, provenance, payload, payload_hash, state, review_reason, target_table, target_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (wedding_id, source_key) do update
       set batch_id = excluded.batch_id, provenance = excluded.provenance, payload = excluded.payload,
           payload_hash = excluded.payload_hash, state = excluded.state, review_reason = excluded.review_reason,
           target_table = coalesce(excluded.target_table, public.import_rows.target_table),
           target_id = coalesce(excluded.target_id, public.import_rows.target_id)`,
    [ctx.o.weddingId, ctx.batchId, rec.sourceKey, rec.entity, JSON.stringify(rec.provenance), JSON.stringify(rec.payload),
      payloadHash(rec.payload), state, reason, TABLE[rec.entity], targetId],
  );
}

async function targetOf(ctx: Ctx, key: string): Promise<string | null> {
  const r = await ctx.c.query(
    "select target_id from public.import_rows where wedding_id = $1 and source_key = $2 and state in ('committed','unchanged') and target_id is not null",
    [ctx.o.weddingId, key]);
  return r.rows[0]?.target_id ?? null;
}

async function processRecord(ctx: Ctx, rec: ImportRecord) {
  const { c, o, res } = ctx;
  const existing = (await c.query(
    "select state, payload_hash, target_id from public.import_rows where wedding_id = $1 and source_key = $2", [o.weddingId, rec.sourceKey])).rows[0];
  const hash = payloadHash(rec.payload);

  if (existing && (existing.state === "committed" || existing.state === "unchanged")) {
    // Sudah ter-commit (mis. lewat resolusi manual) dan kali ini tanpa resolusi: biarkan apa adanya.
    if (rec.state === "needs_review") { res.unchanged++; return; }
    if (existing.payload_hash === hash) { res.unchanged++; await c.query(
      "update public.import_rows set state = 'unchanged', batch_id = $3 where wedding_id = $1 and source_key = $2", [o.weddingId, rec.sourceKey, ctx.batchId]);
    } else {
      // Sumber berubah sejak impor: jangan menimpa data yang mungkin sudah diedit di aplikasi.
      res.changedSinceImport.push(rec.sourceKey);
      await c.query("update public.import_rows set state = 'changed' where wedding_id = $1 and source_key = $2", [o.weddingId, rec.sourceKey]);
    }
    return;
  }
  if (existing?.state === "changed") { res.changedSinceImport.push(rec.sourceKey); return; }

  if (rec.state === "needs_review") {
    res.heldForReview.push({ sourceKey: rec.sourceKey, reason: rec.reviewReason ?? "perlu review" });
    await upsertStaging(ctx, rec, "needs_review", rec.reviewReason ?? null, null);
    return;
  }

  const p = rec.payload as Record<string, unknown>;
  let targetId: string | null = null;
  switch (rec.entity) {
    case "wedding": {
      // Hanya mengisi kolom yang masih kosong; tidak menimpa data yang sudah diisi pengguna.
      await c.query(
        `update public.weddings set
           wedding_date = coalesce(wedding_date, $2), location = coalesce(location, $3),
           target_amount = coalesce(target_amount, $4), budget_cap = coalesce(budget_cap, $5),
           opening_balance = case when opening_balance = 0 then $6 else opening_balance end
         where id = $1`,
        [o.weddingId, p.wedding_date, p.location, p.target_amount, p.budget_cap, p.opening_balance ?? 0]);
      targetId = o.weddingId;
      break;
    }
    case "deposit":
      targetId = (await c.query(
        "insert into public.deposits (wedding_id, contributor, amount, deposited_on, note, created_by) values ($1,$2,$3,$4,'Diimpor dari spreadsheet',$5) returning id",
        [o.weddingId, p.contributor, p.amount, p.deposited_on, o.userId])).rows[0].id;
      break;
    case "vendor":
      targetId = (await c.query(
        "insert into public.vendors (wedding_id, category, name, status, contact, price_quote, notes, package, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
        [o.weddingId, p.category, p.name, p.status, p.contact, p.price_quote, p.notes, p.package, o.userId])).rows[0].id;
      break;
    case "budget_item":
      targetId = (await c.query(
        "insert into public.budget_items (wedding_id, section, category, name, estimated_price, final_price, due_date, notes, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
        [o.weddingId, p.section, p.category, p.name, p.estimated_price, p.final_price, p.due_date, p.notes, o.userId])).rows[0].id;
      break;
    case "payment": {
      const itemId = await targetOf(ctx, String(rec.dependsOn));
      if (!itemId) {
        res.heldForReview.push({ sourceKey: rec.sourceKey, reason: "item anggaran induk belum ter-commit" });
        await upsertStaging(ctx, rec, "needs_review", "Item anggaran induk belum ter-commit.", null);
        return;
      }
      const note = p.paid_on_assumed ? "Diimpor; tanggal bayar diasumsikan" : "Diimpor dari spreadsheet";
      targetId = (await c.query(
        "select public.record_payment($1,$2,$3,'payment',$4,$5,$6,null,$7) as id",
        [o.weddingId, uuidFromKey(rec.sourceKey), itemId, p.amount, p.paid_on, p.funding_source, note])).rows[0].id;
      break;
    }
    case "task":
      targetId = (await c.query(
        "insert into public.prep_tasks (wedding_id, title, phase, done, deadline, notes, priority, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",
        [o.weddingId, p.title, p.phase, p.done, p.deadline, p.notes, p.priority, o.userId])).rows[0].id;
      break;
    case "guest":
      targetId = (await c.query(
        "insert into public.guests (wedding_id, name, tag, invited_count, confirmed_count, invitation_sent, rsvp, phone, email, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id",
        [o.weddingId, p.name, p.tag, p.invited_count, p.confirmed_count, p.invitation_sent, p.rsvp, p.phone, p.email, o.userId])).rows[0].id;
      break;
  }
  await upsertStaging(ctx, rec, "committed", null, targetId);
  res.committed++;
}
