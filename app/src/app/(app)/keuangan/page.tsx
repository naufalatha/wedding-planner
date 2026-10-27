"use client";
import { useState } from "react";
import { balanceAfterSettled } from "@/domain/finance";
import { ItemSheet } from "@/components/finance/item-sheet";
import { canonCategory, EMPTY_FILTER, ItemFilterBar, SECTION_LABEL as SECTION, filterItems, type ItemFilter } from "@/components/finance/item-filters";
import { LedgerTab, type LedgerRowData } from "@/components/finance/ledger-tab";
import { Button, Empty, ErrorNote, FieldRow, Group, Icon, LedgerRow, ListSkeleton, MoneyInput, PageHeader, Panel, ProgressBar, RowButton, SectionHead, SelectInput, Sheet, StatusChip, StickyActions, Tabs, TextInput, cx } from "@/components/ui";
import { formatShortDate } from "@/domain/dates";
import { formatRupiah, parseRupiah } from "@/domain/money";
import { insertRow } from "@/lib/api";
import { useAction, useWeddingData } from "@/lib/hooks";
import type { BudgetItemStatusRow, Section } from "@/lib/types";
import { useWedding } from "@/lib/wedding-context";

type Tab = "item" | "setoran" | "penarikan";
const TABS: readonly (readonly [Tab, string])[] = [["item", "Item"], ["setoran", "Setoran"], ["penarikan", "Penarikan"]];
const ADD_LABEL: Record<Tab, string> = { item: "Tambah item", setoran: "Tambah setoran", penarikan: "Tambah penarikan" };

export default function Keuangan() {
  const { weddingId } = useWedding();
  const d = useWeddingData(weddingId);
  const cats = [...new Set((d.items.data ?? []).map((i) => i.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b));
  const [tab, setTab] = useState<Tab>("item");
  const [sel, setSel] = useState<BudgetItemStatusRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [ledgerEdit, setLedgerEdit] = useState<LedgerRowData | "new" | null>(null);
  const [flt, setFlt] = useState<ItemFilter>(EMPTY_FILTER);
  const [payFlt, setPayFlt] = useState<ItemFilter>(EMPTY_FILTER);
  const [quickPay, setQuickPay] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("bayar"));
  const [f, setF] = useState({ section: "vendor" as Section, category: "", name: "", price: "", due: "", vendor: "" });
  const bad = f.price !== "" && Number.isNaN(parseRupiah(f.price));
  const add = useAction(async () => {
    await insertRow("budget_items", { wedding_id: weddingId, section: f.section, category: canonCategory(f.category, cats), name: f.name.trim(), final_price: parseRupiah(f.price), due_date: f.due || null, vendor_id: f.vendor || null });
    setF({ ...f, name: "", price: "", due: "", vendor: "" });
    setAdding(false);
  });

  const err = d.summary.error ?? d.items.error;
  if (err) return <ErrorNote error={err} />;
  if (!d.summary.data || !d.items.data) return <ListSkeleton summary rows={5} />;
  const s = d.summary.data;
  const items = d.items.data;
  const shownItems = filterItems(items, flt);
  const sections = (Object.keys(SECTION) as Section[]).map((k) => [k, shownItems.filter((i) => i.section === k)] as const).filter(([, v]) => v.length > 0);
  const payable = filterItems(items.filter((i) => i.status !== "lunas"), payFlt);
  // item yang masih terbuka diperbarui dari data terbaru agar status ikut berubah
  const live = sel ? items.find((i) => i.budget_item_id === sel.budget_item_id) ?? null : null;
  const pct = s.funding_progress === null ? null : Math.round(s.funding_progress * 100);
  const settled = balanceAfterSettled(s.available_balance, s.outstanding);
  const onAdd = () => (tab === "item" ? setAdding(true) : setLedgerEdit("new"));

  return (
    <div className="space-y-5">
      <PageHeader title="Keuangan" action={<Button compact aria-label={ADD_LABEL[tab]} onClick={onAdd}><Icon name="plus" size={18} />Tambah</Button>} />

      <Panel>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
          <div>
            <p className="text-meta text-muted">Saldo tersedia</p>
            <p className={cx("display num text-[1.1875rem] leading-7", s.available_balance < 0 && "text-danger")}>{formatRupiah(s.available_balance)}</p>
          </div>
          <div>
            <p className="text-meta text-muted">Sisa tagihan</p>
            <p className="display num text-[1.1875rem] leading-7">{formatRupiah(s.outstanding)}</p>
          </div>
          <div>
            <p className="text-meta text-muted">Sisa setelah lunas</p>
            <p className={cx("display num text-[1.1875rem] leading-7", settled < 0 && "text-danger")}>{formatRupiah(settled)}</p>
            {settled < 0 && <p className="mt-0.5 text-meta text-danger">Dana kurang</p>}
          </div>
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex items-baseline justify-between gap-3 text-meta"><span className="text-muted">Dana terkumpul</span><span className="num font-semibold">{formatRupiah(s.collected)}</span></div>
          <ProgressBar value={s.funding_progress ?? 0} className="mt-2" />
          <p className="num mt-1.5 text-meta text-muted">{pct === null ? "Target dana belum diisi" : `${pct}% dari ${formatRupiah(s.target)}`}</p>
        </div>
        <details className="group mt-3 border-t border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-meta font-semibold text-indigo [&::-webkit-details-marker]:hidden">
            Rincian anggaran<Icon name="down" size={18} className="group-open:rotate-180" />
          </summary>
          <dl className="space-y-2 pb-1 pt-1">
            <LedgerRow label="Total biaya" value={formatRupiah(s.total_committed)} />
            <LedgerRow label="Pembayaran tercatat" value={formatRupiah(s.total_paid)} />
            <LedgerRow label="Sisa anggaran rencana" value={s.plan_remaining === null ? "Batas belum diatur" : formatRupiah(s.plan_remaining)} tone={(s.plan_remaining ?? 0) < 0 ? "danger" : undefined} />
          </dl>
          {s.unpriced_count > 0 && <p className="mt-3 rounded-ctl bg-kunyit-soft p-2.5 text-meta">{s.unpriced_count} item belum dianggarkan, belum dihitung di total.</p>}
          {s.plan_remaining === null && <p className="mt-2 text-meta text-muted">Atur batas anggaran di Akun untuk melihat sisa anggaran rencana.</p>}
        </details>
      </Panel>
      {s.available_balance < 0 && <p role="alert" className="rounded-ctl bg-danger-soft p-3 text-meta text-danger">Saldo dana negatif: pengeluaran sudah melebihi dana yang terkumpul.</p>}

      <Tabs label="Bagian keuangan" value={tab} onChange={(t) => { setTab(t); setLedgerEdit(null); }} items={TABS} />

      {tab === "item" && (
        <div className="space-y-4">
          {items.length > 0 && <ItemFilterBar items={items} value={flt} onChange={setFlt} shown={shownItems.length} />}
          {items.length === 0 && <Empty title="Belum ada item" hint="Tambahkan vendor, seserahan, atau berkas yang punya biaya." action={<Button onClick={() => setAdding(true)}>Tambah item</Button>} />}
          {items.length > 0 && sections.length === 0 && <Empty title="Tidak ada item yang cocok" hint="Ubah atau reset filter." />}
          {sections.map(([k, list]) => {
            const left = list.reduce((a, i) => a + Math.max(i.remaining ?? 0, 0), 0);
            return (
              <section key={k} aria-label={SECTION[k]} className="space-y-1">
                <SectionHead title={SECTION[k]} aside={`${list.length} item, sisa ${formatRupiah(left)}`} />
                <Group>
                  {list.map((i) => (
                    <RowButton key={i.budget_item_id} stack onClick={() => setSel(i)}>
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">{i.name}</span>
                        {i.remaining === null
                          ? <span className="shrink-0 text-meta text-muted">Belum dianggarkan</span>
                          : <span className={cx("num shrink-0 font-semibold", i.remaining < 0 && "text-danger")}><span className="font-normal text-muted">Sisa </span>{formatRupiah(i.remaining)}</span>}
                      </span>
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 gap-3 text-meta text-muted">
                          <span className="truncate">{i.category ?? "Tanpa kategori"}</span>
                          {i.due_date && <span className="shrink-0">Tempo {formatShortDate(i.due_date)}</span>}
                        </span>
                        <StatusChip status={i.status} />
                      </span>
                      {i.committed_price !== null && i.committed_price > 0 && <ProgressBar value={i.paid_amount / i.committed_price} tone={i.status === "lunas" ? "daun" : "indigo"} />}
                    </RowButton>
                  ))}
                </Group>
              </section>
            );
          })}
        </div>
      )}
      {tab === "setoran" && <LedgerTab kind="deposit" weddingId={weddingId} rows={d.deposits.data ?? []} editing={ledgerEdit} onEdit={setLedgerEdit} />}
      {tab === "penarikan" && <LedgerTab kind="withdrawal" weddingId={weddingId} rows={d.withdrawals.data ?? []} editing={ledgerEdit} onEdit={setLedgerEdit} />}

      <ItemSheet weddingId={weddingId} item={live} payments={d.payments.data ?? []} vendors={d.vendors.data ?? []} onClose={() => setSel(null)} />
      <Sheet open={quickPay} title="Catat pembayaran untuk…" onClose={() => setQuickPay(false)}>
        <div className="space-y-3">
          <ItemFilterBar compact items={items.filter((i) => i.status !== "lunas")} value={payFlt} onChange={setPayFlt} shown={payable.length} />
          {items.every((i) => i.status === "lunas")
            ? <Empty title="Belum ada item yang perlu dibayar" hint="Tambahkan item dulu di tab Item." />
            : (
              <Group>
                {payable.map((i) => (
                  <RowButton key={i.budget_item_id} onClick={() => { setQuickPay(false); setSel(i); }}>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i.name}</span>{i.category && <span className="block truncate text-meta text-muted">{i.category}</span>}</span>
                    <StatusChip status={i.status} />
                  </RowButton>
                ))}
              </Group>
            )}
        </div>
      </Sheet>
      <Sheet open={adding} title="Tambah item" onClose={() => setAdding(false)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); add.mutate(undefined); }}>
          <TextInput label="Nama" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <FieldRow>
            <SelectInput label="Kelompok" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value as Section })}>
              {(Object.keys(SECTION) as Section[]).map((k) => <option key={k} value={k}>{SECTION[k]}</option>)}
            </SelectInput>
            <TextInput label="Kategori" list="kategori-item" autoComplete="off" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </FieldRow>
          <datalist id="kategori-item">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <MoneyInput label="Harga (Rp)" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <p className="-mt-2 text-meta text-muted">Harga boleh dikosongkan. Kategori: pilih dari saran atau ketik baru.</p>
          <TextInput label="Jatuh tempo (opsional)" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          <SelectInput label="Vendor terkait (opsional)" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })}>
            <option value="">Tidak ada</option>
            {(d.vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.category}: {v.name}</option>)}
          </SelectInput>
          {bad && <p role="alert" className="text-meta text-danger">Nominal hanya boleh angka.</p>}
          <ErrorNote error={add.error} />
          <StickyActions><Button type="submit" className="w-full" disabled={add.isPending || bad || f.name.trim() === ""}>Simpan</Button></StickyActions>
        </form>
      </Sheet>
    </div>
  );
}
