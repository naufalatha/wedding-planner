"use client";
import { useState } from "react";
import { CancelBox } from "../cancel-box";
import { Button, Empty, ErrorNote, FieldRow, FilterBar, FilterSheet, Group, LedgerRow, MoneyInput, Panel, RowButton, SectionHead, SelectInput, Sheet, StickyActions, TextInput, cx } from "../ui";
import { formatShortDate, jakartaDate } from "@/domain/dates";
import { formatRupiah, parseRupiah } from "@/domain/money";
import { cancelRecord, insertRow, updateRow } from "@/lib/api";
import { contributorTotals } from "@/domain/home";
import { useAction } from "@/lib/hooks";
import type { Deposit, Withdrawal } from "@/lib/types";

export type LedgerRowData = Deposit | Withdrawal;
type Row = LedgerRowData;
const formatMonth = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
const isDeposit = (r: Row): r is Deposit => "contributor" in r;

/** Setoran (masuk) atau penarikan lain (keluar) dari dana pernikahan. Status buka-tutup form dipegang halaman agar tombol Tambah ada di judul. */
export function LedgerTab({ kind, weddingId, rows, editing, onEdit }: { kind: "deposit" | "withdrawal"; weddingId: string; rows: Row[]; editing: Row | "new" | null; onEdit: (r: Row | "new" | null) => void }) {
  const noun = kind === "deposit" ? "Setoran" : "Penarikan";
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [who, setWho] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const dateOf = (r: Row) => (isDeposit(r) ? r.deposited_on : r.withdrawn_on);
  const months = [...new Set(rows.map((r) => dateOf(r).slice(0, 7)))].sort().reverse();
  const people = [...new Set(rows.filter(isDeposit).map((r) => r.contributor))].sort((a, b) => a.localeCompare(b));
  const shown = rows.filter((r) => (month === "" || dateOf(r).startsWith(month)) && (who === "" || (isDeposit(r) && r.contributor === who)) && (q.trim() === "" || `${isDeposit(r) ? r.contributor : ""} ${r.note ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  const filtered = q.trim() !== "" || month !== "" || who !== "";
  const totals = kind === "deposit" ? contributorTotals(rows.filter(isDeposit)) : [];
  const sum = shown.reduce((a, r) => a + r.amount, 0);
  const reset = () => { setQ(""); setMonth(""); setWho(""); };
  const byMonth = [...new Set(shown.map((r) => dateOf(r).slice(0, 7)))].sort().reverse();
  return (
    <div className="space-y-4">
      {totals.length > 0 && (
        <Panel tone="daun">
          <h3 className="mb-2 text-meta font-semibold">Per kontributor</h3>
          <dl className="space-y-2">{totals.map((t) => <LedgerRow key={t.name} label={t.name} value={formatRupiah(t.total)} />)}</dl>
        </Panel>
      )}
      {rows.length > 3 && (
        <>
          <FilterBar q={q} onQ={setQ} placeholder={kind === "deposit" ? "Cari penyetor atau catatan" : "Cari catatan"} activeCount={(month ? 1 : 0) + (who ? 1 : 0)} active={filtered}
            onOpen={() => setFilterOpen(true)} shown={shown.length} total={rows.length} onReset={reset} />
          {filtered && shown.length > 0 && <p className="num text-meta">Total tampil <span className="font-semibold">{formatRupiah(sum)}</span></p>}
          <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} shown={shown.length} onReset={reset}>
            <SelectInput label="Bulan" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Semua bulan</option>
              {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
            </SelectInput>
            {kind === "deposit" && people.length > 1 && (
              <SelectInput label="Penyetor" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Semua</option>
                {people.map((p) => <option key={p} value={p}>{p}</option>)}
              </SelectInput>
            )}
          </FilterSheet>
        </>
      )}
      {rows.length > 0 && shown.length === 0 && <Empty title="Tidak ada catatan yang cocok" hint="Ubah atau reset filter." />}
      {rows.length === 0 && <Empty title={`Belum ada ${noun.toLowerCase()}`} hint={kind === "deposit" ? "Catat setiap tabungan yang masuk ke dana pernikahan." : "Untuk pengeluaran dana di luar pembayaran item."} action={<Button onClick={() => onEdit("new")}>Tambah {noun.toLowerCase()}</Button>} />}
      {byMonth.map((m) => {
        const list = shown.filter((r) => dateOf(r).startsWith(m));
        return (
          <section key={m} aria-label={formatMonth(m)} className="space-y-1">
            <SectionHead title={formatMonth(m)} aside={formatRupiah(list.reduce((a, r) => a + r.amount, 0))} />
            <Group>
              {list.map((r) => (
                <RowButton key={r.id} stack onClick={() => onEdit(r)}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{isDeposit(r) ? r.contributor : "Penarikan"}</span>
                    <span className={cx("num shrink-0 font-semibold", isDeposit(r) ? "text-daun" : "text-danger")}>{isDeposit(r) ? "+" : "−"}{formatRupiah(r.amount)}</span>
                  </span>
                  <span className="flex gap-3 text-meta text-muted"><span className="shrink-0">{formatShortDate(dateOf(r))}</span>{r.note && <span className="truncate">{r.note}</span>}</span>
                </RowButton>
              ))}
            </Group>
          </section>
        );
      })}
      <Sheet open={editing !== null} title={editing === "new" ? `Tambah ${noun.toLowerCase()}` : `Ubah ${noun.toLowerCase()}`} onClose={() => onEdit(null)}>
        {editing !== null && <LedgerForm key={editing === "new" ? "new" : editing.id} kind={kind} weddingId={weddingId} row={editing === "new" ? null : editing} onClose={() => onEdit(null)} />}
      </Sheet>
    </div>
  );
}

function LedgerForm({ kind, weddingId, row, onClose }: { kind: "deposit" | "withdrawal"; weddingId: string; row: Row | null; onClose: () => void }) {
  const [f, setF] = useState({ who: row && isDeposit(row) ? row.contributor : "", amount: row ? String(row.amount) : "", date: row ? (isDeposit(row) ? row.deposited_on : row.withdrawn_on) : jakartaDate(new Date()), note: row?.note ?? "" });
  const amount = parseRupiah(f.amount);
  const amountOk = amount !== null && !Number.isNaN(amount) && amount > 0;
  const ok = amountOk && (kind === "withdrawal" || f.who.trim() !== "");
  const save = useAction(async () => {
    const table = kind === "deposit" ? "deposits" : "fund_withdrawals";
    const patch = kind === "deposit"
      ? { contributor: f.who.trim(), amount, deposited_on: f.date, note: f.note || null }
      : { amount, withdrawn_on: f.date, note: f.note || null };
    if (row) await updateRow(table, row.id, row.revision, patch); else await insertRow(table, { wedding_id: weddingId, ...patch });
    onClose();
  });
  const cancel = useAction(async (reason: string) => { if (row) await cancelRecord(weddingId, kind, row.id, reason); onClose(); });
  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        {kind === "deposit" && <TextInput label="Penyetor" required value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} hint="Mis. Naufal, Bella, Orang tua." />}
        <FieldRow>
          <MoneyInput label="Jumlah (Rp)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} error={f.amount !== "" && !amountOk ? "Harus lebih dari 0." : null} />
          <TextInput label="Tanggal" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </FieldRow>
        <TextInput label="Catatan (opsional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <ErrorNote error={save.error} />
        <StickyActions><Button type="submit" className="w-full" disabled={!ok || save.isPending}>{save.isPending ? "Menyimpan…" : "Simpan"}</Button></StickyActions>
      </form>
      {row && <CancelBox label="Batalkan catatan ini" pending={cancel.isPending} error={cancel.error} onConfirm={(r) => cancel.mutate(r)} />}
    </div>
  );
}
