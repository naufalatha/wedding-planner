"use client";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { CancelBox } from "../cancel-box";
import { Button, Card, ErrorNote, Loading, SelectInput, Sheet, StatusChip, TextInput, MoneyInput } from "../ui";
import { jakartaDate } from "@/domain/dates";
import { formatRupiah, parseRupiah } from "@/domain/money";
import { cancelRecord, getItem, markRefundReceived, recordPayment, updateRow } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import type { BudgetItemStatusRow, Payment, Vendor } from "@/lib/types";

export function ItemSheet({ weddingId, item, payments, vendors, onClose }: { weddingId: string; item: BudgetItemStatusRow | null; payments: Payment[]; vendors: Vendor[]; onClose: () => void }) {
  return (
    <Sheet open={Boolean(item)} title={item?.name ?? ""} onClose={onClose}>
      {item && <Body key={item.budget_item_id} weddingId={weddingId} item={item} payments={payments.filter((p) => p.budget_item_id === item.budget_item_id)} vendors={vendors} onClose={onClose} />}
    </Sheet>
  );
}

function Body({ weddingId, item, payments, vendors, onClose }: { weddingId: string; item: BudgetItemStatusRow; payments: Payment[]; vendors: Vendor[]; onClose: () => void }) {
  const row = useQuery({ queryKey: ["item", item.budget_item_id], queryFn: () => getItem(item.budget_item_id) });
  const [prices, setPrices] = useState<{ est: string; fin: string; due: string; vendor: string } | null>(null);
  const base = { est: item.estimated_price?.toString() ?? "", fin: item.final_price?.toString() ?? "", due: item.due_date ?? "", vendor: item.vendor_id ?? "" };
  const { est, fin, due, vendor } = prices ?? base;
  const edit = (patch: Partial<typeof base>) => setPrices({ ...(prices ?? base), ...patch });
  const badPrice = [est, fin].some((v) => v !== "" && Number.isNaN(parseRupiah(v)));
  const savePrices = useAction(async () => {
    if (!row.data) return;
    await updateRow("budget_items", row.data.id, row.data.revision, { estimated_price: parseRupiah(est), final_price: parseRupiah(fin), due_date: due || null, vendor_id: vendor || null });
    setPrices(null);
    await row.refetch();
  });

  // Pembayaran: request ID dibuat sekali per formulir dan dipertahankan saat percobaan ulang.
  const requestId = useRef(crypto.randomUUID());
  const [pay, setPay] = useState({ type: "payment" as "payment" | "refund", amount: "", date: jakartaDate(new Date()), funding: "wedding_fund" as "wedding_fund" | "separate", parent: "", note: "" });
  const amount = parseRupiah(pay.amount);
  const payable = payments.filter((p) => p.type === "payment");
  const addPayment = useAction(async () => {
    await recordPayment({ wedding: weddingId, requestId: requestId.current, item: item.budget_item_id, type: pay.type, amount: amount as number, paidOn: pay.date, funding: pay.funding, parent: pay.type === "refund" ? pay.parent : null, note: pay.note || null });
    requestId.current = crypto.randomUUID();
    setPay({ ...pay, amount: "", note: "" });
  });
  const received = useAction((id: string) => markRefundReceived(weddingId, id));
  const cancelPay = useAction(({ id, reason }: { id: string; reason: string }) => cancelRecord(weddingId, "payment", id, reason));
  const cancelItem = useAction(async (reason: string) => { await cancelRecord(weddingId, "budget_item", item.budget_item_id, reason); onClose(); });
  const amountOk = amount !== null && !Number.isNaN(amount) && amount > 0 && (pay.type === "payment" || pay.parent !== "");

  return (
    <div className="space-y-5">
      <Card tone="blush">
        <div className="flex items-center justify-between"><StatusChip status={item.status} /><span className="text-xs text-muted">{item.category ?? ""}</span></div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-xs text-muted">Harga</dt><dd className="font-semibold">{formatRupiah(item.committed_price)}</dd></div>
          <div><dt className="text-xs text-muted">Dibayar</dt><dd className="font-semibold">{formatRupiah(item.paid_amount)}</dd></div>
          <div><dt className="text-xs text-muted">Sisa</dt><dd className={`font-semibold ${(item.remaining ?? 0) < 0 ? "text-danger" : ""}`}>{formatRupiah(item.remaining)}</dd></div>
        </dl>
      </Card>

      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); savePrices.mutate(undefined); }}>
        <h3 className="font-bold">Detail</h3>
        <MoneyInput label="Estimasi (Rp)" inputMode="numeric" value={est} onChange={(e) => edit({ est: e.target.value })} hint="Kosong berarti belum dianggarkan." />
        <MoneyInput label="Harga final (Rp)" inputMode="numeric" value={fin} onChange={(e) => edit({ fin: e.target.value })} hint="Jika diisi, dipakai sebagai harga tagihan." />
        <TextInput label="Jatuh tempo (opsional)" type="date" value={due} onChange={(e) => edit({ due: e.target.value })} />
        <SelectInput label="Vendor terkait (opsional)" value={vendor} onChange={(e) => edit({ vendor: e.target.value })}>
          <option value="">Tidak ada</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.category} · {v.name}</option>)}
        </SelectInput>
        {badPrice && <p role="alert" className="text-xs text-danger">Nominal hanya boleh angka.</p>}
        <ErrorNote error={savePrices.error} />
        <Button type="submit" variant="secondary" disabled={!prices || badPrice || savePrices.isPending || !row.data}>Simpan detail</Button>
      </form>

      <section className="space-y-3">
        <h3 className="font-bold">Riwayat pembayaran</h3>
        {row.isLoading && <Loading />}
        {payments.length === 0 && <p className="text-sm text-muted">Belum ada pembayaran.</p>}
        {payments.map((p) => (
          <div key={p.id} className="rounded-input border border-line bg-surface p-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{p.type === "refund" ? "Refund" : "Pembayaran"} · {p.funding_source === "wedding_fund" ? "Dana pernikahan" : "Dibayar terpisah"}</span>
              <span className="font-semibold">{p.type === "refund" ? "−" : ""}{formatRupiah(p.amount)}</span>
            </div>
            <p className="text-xs text-muted">{p.paid_on}{p.note ? ` · ${p.note}` : ""}</p>
            {p.type === "refund" && !p.refund_received && p.funding_source === "wedding_fund" && (
              <Button variant="secondary" className="mt-2 min-h-12 text-sm" onClick={() => received.mutate(p.id)} disabled={received.isPending}>Tandai uang sudah diterima</Button>
            )}
            {p.type === "refund" && p.refund_received && <p className="mt-1 text-xs">Uang sudah diterima</p>}
            <CancelBox label="Batalkan" pending={cancelPay.isPending} error={cancelPay.error} onConfirm={(reason) => cancelPay.mutate({ id: p.id, reason })} />
          </div>
        ))}
      </section>

      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); addPayment.mutate(undefined); }}>
        <h3 className="font-bold">Catat {pay.type === "payment" ? "pembayaran" : "refund"}</h3>
        <SelectInput label="Jenis" value={pay.type} onChange={(e) => setPay({ ...pay, type: e.target.value as "payment" | "refund" })}>
          <option value="payment">Pembayaran</option>
          <option value="refund">Refund</option>
        </SelectInput>
        {pay.type === "refund" && (
          <SelectInput label="Refund dari pembayaran" value={pay.parent} onChange={(e) => setPay({ ...pay, parent: e.target.value })}>
            <option value="">Pilih pembayaran…</option>
            {payable.map((p) => <option key={p.id} value={p.id}>{p.paid_on} · {formatRupiah(p.amount)}</option>)}
          </SelectInput>
        )}
        <MoneyInput label="Jumlah (Rp)" inputMode="numeric" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} error={pay.amount !== "" && (Number.isNaN(amount) || amount === 0) ? "Masukkan angka lebih dari 0." : null} />
        <TextInput label="Tanggal" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} required />
        {pay.type === "payment" && (
          <SelectInput label="Sumber dana" value={pay.funding} onChange={(e) => setPay({ ...pay, funding: e.target.value as "wedding_fund" | "separate" })}>
            <option value="wedding_fund">Dana pernikahan</option>
            <option value="separate">Dibayar terpisah</option>
          </SelectInput>
        )}
        <TextInput label="Catatan (opsional)" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
        <ErrorNote error={addPayment.error ?? received.error} />
        <Button type="submit" className="w-full" disabled={!amountOk || addPayment.isPending}>{addPayment.isPending ? "Menyimpan…" : "Simpan"}</Button>
        {addPayment.isError && <p className="text-xs text-muted">Isian Anda dipertahankan. Menekan Simpan lagi aman: tidak akan tercatat dua kali.</p>}
      </form>

      <CancelBox label="Batalkan item ini" pending={cancelItem.isPending} error={cancelItem.error} onConfirm={(r) => cancelItem.mutate(r)} />
    </div>
  );
}
