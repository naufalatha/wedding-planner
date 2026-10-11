"use client";
import { useState } from "react";
import { ItemSheet } from "@/components/finance/item-sheet";
import { LedgerTab } from "@/components/finance/ledger-tab";
import { Button, Card, Chip, Empty, ErrorNote, ProgressBar, SelectInput, Sheet, StatusChip, TextInput, MoneyInput, ListSkeleton } from "@/components/ui";
import { formatRupiah, parseRupiah } from "@/domain/money";
import { insertRow } from "@/lib/api";
import { formatShortDate } from "@/domain/dates";
import { useAction, useWeddingData } from "@/lib/hooks";
import type { BudgetItemStatusRow, Section } from "@/lib/types";
import { useWedding } from "@/lib/wedding-context";

const SECTION: Record<Section, string> = { paperwork: "Berkas", seserahan: "Seserahan", vendor: "Vendor", other: "Lainnya" };

export default function Keuangan() {
  const { weddingId } = useWedding();
  const d = useWeddingData(weddingId);
  const [tab, setTab] = useState<"item" | "setoran" | "penarikan">("item");
  const [sel, setSel] = useState<BudgetItemStatusRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [quickPay, setQuickPay] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("bayar"));
  const [f, setF] = useState({ section: "vendor" as Section, category: "", name: "", est: "", fin: "", due: "", vendor: "" });
  const bad = [f.est, f.fin].some((v) => v !== "" && Number.isNaN(parseRupiah(v)));
  const add = useAction(async () => {
    await insertRow("budget_items", { wedding_id: weddingId, section: f.section, category: f.category.trim() || null, name: f.name.trim(), estimated_price: parseRupiah(f.est), final_price: parseRupiah(f.fin), due_date: f.due || null, vendor_id: f.vendor || null });
    setF({ ...f, name: "", est: "", fin: "", due: "", vendor: "" });
    setAdding(false);
  });

  const err = d.summary.error ?? d.items.error;
  if (err) return <ErrorNote error={err} />;
  if (!d.summary.data || !d.items.data) return <ListSkeleton summary rows={4} />;
  const s = d.summary.data;
  const items = d.items.data;
  const sections = (Object.keys(SECTION) as Section[]).map((k) => [k, items.filter((i) => i.section === k)] as const).filter(([, v]) => v.length > 0);
  // item yang masih terbuka diperbarui dari data terbaru agar status ikut berubah
  const live = sel ? items.find((i) => i.budget_item_id === sel.budget_item_id) ?? null : null;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Keuangan</h1>
      <Card tone="mint">
        <p className="text-sm">Dana terkumpul</p>
        <p className="mb-3 text-[min(1.875rem,7.5vw)] font-extrabold">{formatRupiah(s.collected)}</p>
        <ProgressBar value={s.funding_progress ?? 0} />
        <p className="mt-2 text-xs text-muted">{s.funding_progress === null ? "Target dana belum diisi" : `${Math.round(s.funding_progress * 100)}% dari ${formatRupiah(s.target)}`}</p>
      </Card>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
        <Card className="!p-4"><p className="text-xs text-muted">Saldo tersedia</p><p className={`font-bold ${s.available_balance < 0 ? "text-danger" : ""}`}>{formatRupiah(s.available_balance)}</p></Card>
        <Card className="!p-4">
          <p className="text-xs text-muted">Sisa tagihan</p><p className="font-bold">{formatRupiah(s.outstanding)}</p>
          {s.estimate_based_count > 0 && <p className="mt-1 text-[11px] text-muted">Termasuk {s.estimate_based_count} item berdasar estimasi</p>}
        </Card>
      </div>
      <Card className="!p-4">
        <h2 className="mb-2 text-sm font-semibold">Anggaran</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-muted">Total estimasi</dt><dd className="min-w-0 font-medium">{formatRupiah(s.total_estimated)}</dd></div>
          <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-muted">Total komitmen</dt><dd className="min-w-0 font-medium">{formatRupiah(s.total_committed)}</dd></div>
          <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-muted">Pembayaran tercatat</dt><dd className="min-w-0 font-medium">{formatRupiah(s.total_paid)}</dd></div>
          <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-muted">Sisa anggaran rencana</dt><dd className={`min-w-0 text-right font-medium ${(s.plan_remaining ?? 0) < 0 ? "text-danger" : ""}`}>{s.plan_remaining === null ? "Batas belum diatur" : formatRupiah(s.plan_remaining)}</dd></div>
        </dl>
        {s.unpriced_count > 0 && <p className="mt-3 rounded-input bg-lime-soft p-2 text-xs">{s.unpriced_count} item belum dianggarkan, belum dihitung di total.</p>}
        {s.plan_remaining === null && <p className="mt-2 text-xs text-muted">Atur batas anggaran di Akun untuk melihat sisa anggaran rencana.</p>}
      </Card>
      {s.available_balance < 0 && <p role="alert" className="rounded-input border border-danger p-3 text-sm text-danger">Saldo dana negatif: pengeluaran sudah melebihi dana yang terkumpul.</p>}

      <div className="flex gap-2 overflow-x-auto" role="tablist">
        <Chip active={tab === "item"} onClick={() => setTab("item")}>Item &amp; tagihan</Chip>
        <Chip active={tab === "setoran"} onClick={() => setTab("setoran")}>Setoran</Chip>
        <Chip active={tab === "penarikan"} onClick={() => setTab("penarikan")}>Penarikan</Chip>
      </div>

      {tab === "item" && (
        <div className="space-y-5">
          <Button className="w-full" onClick={() => setAdding(true)}>Tambah item</Button>
          {sections.length === 0 && <Empty title="Belum ada item" hint="Tambahkan vendor, seserahan, atau berkas yang punya biaya." />}
          {sections.map(([k, list]) => (
            <section key={k} aria-label={SECTION[k]} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted">{SECTION[k]}</h2>
              {list.map((i) => (
                <button key={i.budget_item_id} onClick={() => setSel(i)} className="block min-h-12 w-full rounded-card border border-line bg-surface p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-medium">{i.name}</p>{i.category && <p className="truncate text-xs text-muted">{i.category}</p>}</div>
                    <StatusChip status={i.status} />
                  </div>
                  <div className="mt-2 flex justify-between text-sm"><span className="text-muted">{i.committed_price === null ? "Belum dianggarkan" : `Harga ${formatRupiah(i.committed_price)}${i.final_price === null ? " (estimasi)" : ""}`}</span><span className={(i.remaining ?? 0) < 0 ? "font-medium text-danger" : "font-medium"}>Sisa {formatRupiah(i.remaining)}</span></div>
                  {i.due_date && <p className="mt-1 text-xs text-muted">Jatuh tempo {formatShortDate(i.due_date)}</p>}
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
      {tab === "setoran" && <LedgerTab kind="deposit" weddingId={weddingId} rows={d.deposits.data ?? []} />}
      {tab === "penarikan" && <LedgerTab kind="withdrawal" weddingId={weddingId} rows={d.withdrawals.data ?? []} />}

      <ItemSheet weddingId={weddingId} item={live} payments={d.payments.data ?? []} vendors={d.vendors.data ?? []} onClose={() => setSel(null)} />
      <Sheet open={quickPay} title="Catat pembayaran untuk…" onClose={() => setQuickPay(false)}>
        <ul className="space-y-2">
          {items.filter((i) => i.status !== "lunas").map((i) => (
            <li key={i.budget_item_id}><button onClick={() => { setQuickPay(false); setSel(i); }} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 text-left"><span className="min-w-0 font-medium">{i.name}</span><StatusChip status={i.status} /></button></li>
          ))}
          {items.every((i) => i.status === "lunas") && <li className="text-sm text-muted">Belum ada item yang perlu dibayar. Tambahkan item dulu.</li>}
        </ul>
      </Sheet>
      <Sheet open={adding} title="Tambah item" onClose={() => setAdding(false)}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(undefined); }}>
          <SelectInput label="Kelompok" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value as Section })}>
            {(Object.keys(SECTION) as Section[]).map((k) => <option key={k} value={k}>{SECTION[k]}</option>)}
          </SelectInput>
          <TextInput label="Nama" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <TextInput label="Kategori (opsional)" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <MoneyInput label="Estimasi (Rp)" inputMode="numeric" value={f.est} onChange={(e) => setF({ ...f, est: e.target.value })} hint="Boleh dikosongkan." />
          <MoneyInput label="Harga final (Rp)" inputMode="numeric" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} hint="Boleh dikosongkan." />
          <TextInput label="Jatuh tempo (opsional)" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          <SelectInput label="Vendor terkait (opsional)" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })}>
            <option value="">Tidak ada</option>
            {(d.vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.category} · {v.name}</option>)}
          </SelectInput>
          {bad && <p role="alert" className="text-xs text-danger">Nominal hanya boleh angka.</p>}
          <ErrorNote error={add.error} />
          <Button type="submit" className="w-full" disabled={add.isPending || bad || f.name.trim() === ""}>Simpan</Button>
        </form>
      </Sheet>
    </div>
  );
}
