"use client";
import { useState } from "react";
import { CancelBox } from "../cancel-box";
import { Button, Card, Empty, ErrorNote, Sheet, TextInput, MoneyInput } from "../ui";
import { jakartaDate } from "@/domain/dates";
import { formatRupiah, parseRupiah } from "@/domain/money";
import { cancelRecord, insertRow, updateRow } from "@/lib/api";
import { contributorTotals } from "@/domain/home";
import { useAction } from "@/lib/hooks";
import type { Deposit, Withdrawal } from "@/lib/types";

type Row = Deposit | Withdrawal;
const isDeposit = (r: Row): r is Deposit => "contributor" in r;

/** Setoran (masuk) atau penarikan lain (keluar) dari dana pernikahan. */
export function LedgerTab({ kind, weddingId, rows }: { kind: "deposit" | "withdrawal"; weddingId: string; rows: Row[] }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const noun = kind === "deposit" ? "Setoran" : "Penarikan";
  const totals = kind === "deposit" ? contributorTotals(rows.filter(isDeposit)) : [];
  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => setEditing("new")}>Tambah {noun.toLowerCase()}</Button>
      {totals.length > 0 && (
        <Card tone="sage" className="!p-4">
          <h3 className="mb-2 text-sm font-semibold">Per kontributor</h3>
          <ul className="space-y-1">{totals.map((t) => <li key={t.name} className="flex justify-between text-sm"><span>{t.name}</span><span className="font-semibold">{formatRupiah(t.total)}</span></li>)}</ul>
        </Card>
      )}
      {rows.length === 0 && <Empty title={`Belum ada ${noun.toLowerCase()}`} hint={kind === "deposit" ? "Catat setiap tabungan yang masuk ke dana pernikahan." : "Untuk pengeluaran dana di luar pembayaran item."} />}
      {rows.map((r) => (
        <button key={r.id} onClick={() => setEditing(r)} className="block min-h-12 w-full rounded-card border border-line bg-surface p-4 text-left">
          <div className="flex justify-between"><span className="font-medium">{isDeposit(r) ? r.contributor : "Penarikan"}</span><span className={`font-semibold ${isDeposit(r) ? "" : "text-danger"}`}>{isDeposit(r) ? "+" : "−"}{formatRupiah(r.amount)}</span></div>
          <p className="text-xs text-muted">{isDeposit(r) ? r.deposited_on : r.withdrawn_on}{r.note ? ` · ${r.note}` : ""}</p>
        </button>
      ))}
      <Sheet open={editing !== null} title={editing === "new" ? `Tambah ${noun.toLowerCase()}` : `Ubah ${noun.toLowerCase()}`} onClose={() => setEditing(null)}>
        {editing !== null && <LedgerForm key={editing === "new" ? "new" : editing.id} kind={kind} weddingId={weddingId} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
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
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        {kind === "deposit" && <TextInput label="Penyetor" required value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} hint="Mis. Naufal, Bella, Orang tua." />}
        <MoneyInput label="Jumlah (Rp)" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} error={f.amount !== "" && !amountOk ? "Masukkan angka lebih dari 0." : null} />
        <TextInput label="Tanggal" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <TextInput label="Catatan (opsional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <ErrorNote error={save.error} />
        <Button type="submit" className="w-full" disabled={!ok || save.isPending}>{save.isPending ? "Menyimpan…" : "Simpan"}</Button>
      </form>
      {row && <CancelBox label="Batalkan catatan ini" pending={cancel.isPending} error={cancel.error} onConfirm={(r) => cancel.mutate(r)} />}
    </div>
  );
}
