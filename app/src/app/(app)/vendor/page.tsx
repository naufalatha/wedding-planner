"use client";
import { useState } from "react";
import { Button, Card, Empty, ErrorNote, SelectInput, Sheet, TextInput, useConfirm, MoneyInput, ListSkeleton } from "@/components/ui";
import { formatRupiah, parseRupiah } from "@/domain/money";
import { archiveRow, insertRow, selectVendor, updateRow } from "@/lib/api";
import { useAction, useWeddingData } from "@/lib/hooks";
import type { BudgetItemStatusRow, Vendor } from "@/lib/types";
import { useWedding } from "@/lib/wedding-context";

const STATUS: Record<Vendor["status"], string> = { candidate: "Kandidat", selected: "Terpilih", rejected: "Ditolak" };
const looksLikePhone = (s: string) => /^[+\d][\d\s-]{6,}$/.test(s.trim());
const safeLink = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);

export default function VendorPage() {
  const { weddingId } = useWedding();
  const { vendors, items } = useWeddingData(weddingId);
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  if (vendors.error) return <ErrorNote error={vendors.error} />;
  if (!vendors.data) return <ListSkeleton rows={4} />;
  const cats = [...new Set(vendors.data.map((v) => v.category))];
  const compareList = comparing ? vendors.data.filter((v) => v.category === comparing && v.status !== "rejected") : [];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Vendor</h1>
      <Button className="w-full" onClick={() => setEditing("new")}>Tambah vendor</Button>
      {cats.length === 0 && <Empty title="Belum ada vendor" hint="Catat kandidat per kategori, bandingkan, lalu pilih satu." />}
      {cats.map((c) => {
        const list = vendors.data.filter((v) => v.category === c);
        const chosen = list.find((v) => v.status === "selected");
        const open = list.filter((v) => v.status !== "rejected");
        return (
          <section key={c} aria-label={c} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-muted">{c}</h2>
              {open.length >= 2 && <button className="min-h-12 px-2 text-sm font-semibold underline" onClick={() => setComparing(c)}>Bandingkan</button>}
            </div>
            {list.map((v) => (
              <button key={v.id} onClick={() => setEditing(v)} className={`block min-h-12 w-full rounded-card p-4 text-left ${v.status === "selected" ? "bg-mint-soft" : "border border-line bg-surface"} ${v.status === "rejected" ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3"><p className="font-medium">{v.name}</p><span className="shrink-0 text-xs font-medium">{STATUS[v.status]}</span></div>
                <p className="text-sm text-muted">{v.price_quote === null ? "Harga belum ada" : formatRupiah(v.price_quote)}{v.package ? ` · ${v.package}` : ""}</p>
              </button>
            ))}
            {!chosen && <p className="text-xs text-muted">Belum ada vendor terpilih untuk kategori ini.</p>}
          </section>
        );
      })}
      <Sheet open={editing !== null} title={editing === "new" ? "Tambah vendor" : "Ubah vendor"} onClose={() => setEditing(null)}>
        {editing !== null && <VendorForm key={editing === "new" ? "new" : editing.id} weddingId={weddingId} v={editing === "new" ? null : editing} categories={cats} items={items.data ?? []} onClose={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={comparing !== null} title={`Bandingkan: ${comparing ?? ""}`} onClose={() => setComparing(null)}>
        <div className="space-y-3">
          {compareList.map((v) => (
            <Card key={v.id} tone={v.status === "selected" ? "mint" : undefined} className="!p-4">
              <p className="font-bold">{v.name} <span className="text-xs font-normal text-muted">{STATUS[v.status]}</span></p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted">Harga</dt><dd className="font-medium">{v.price_quote === null ? "Belum ada" : formatRupiah(v.price_quote)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Paket</dt><dd className="text-right">{v.package || "-"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Kontak</dt><dd className="text-right">{v.contact || "-"}</dd></div>
                <div><dt className="text-muted">Catatan</dt><dd>{v.notes || "-"}</dd></div>
              </dl>
              <div className="mt-3 flex gap-2">
                <PickButton weddingId={weddingId} v={v} onDone={() => setComparing(null)} />
                <Button variant="secondary" onClick={() => { setComparing(null); setEditing(v); }}>Detail</Button>
              </div>
            </Card>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function PickButton({ weddingId, v, onDone }: { weddingId: string; v: Vendor; onDone: () => void }) {
  const pick = useAction(async () => { await selectVendor(weddingId, v.id); onDone(); });
  if (v.status === "selected") return <span className="flex min-h-12 items-center text-sm font-semibold">Terpilih ✓</span>;
  return <div><Button onClick={() => pick.mutate(undefined)} disabled={pick.isPending}>{pick.isPending ? "Memilih…" : "Pilih vendor ini"}</Button><ErrorNote error={pick.error} /></div>;
}

function VendorForm({ weddingId, v, categories, items, onClose }: { weddingId: string; v: Vendor | null; categories: string[]; items: BudgetItemStatusRow[]; onClose: () => void }) {
  const [f, setF] = useState({ category: v?.category ?? "", name: v?.name ?? "", status: v?.status ?? "candidate", contact: v?.contact ?? "", price: v?.price_quote?.toString() ?? "", pkg: v?.package ?? "", link: v?.link ?? "", notes: v?.notes ?? "" });
  const del = useConfirm();
  const price = parseRupiah(f.price);
  const badPrice = f.price !== "" && Number.isNaN(price);
  const linked = v ? items.find((i) => i.vendor_id === v.id) : undefined;
  const save = useAction(async () => {
    const wantsSelected = f.status === "selected" && v?.status !== "selected";
    const row = { category: f.category.trim(), name: f.name.trim(), status: wantsSelected ? "candidate" : f.status, contact: f.contact.trim() || null, price_quote: price, package: f.pkg.trim() || null, link: f.link.trim() || null, notes: f.notes.trim() || null };
    let id = v?.id;
    if (v) await updateRow("vendors", v.id, v.revision, row); else id = await insertRow("vendors", { wedding_id: weddingId, ...row });
    if (wantsSelected && id) await selectVendor(weddingId, id);
    onClose();
  });
  const remove = useAction(async () => { if (v) await archiveRow("vendors", v.id, v.revision); onClose(); });
  const addBudget = useAction(async () => {
    if (!v) return;
    await insertRow("budget_items", { wedding_id: weddingId, section: "vendor", category: v.category, name: v.name, vendor_id: v.id, estimated_price: v.price_quote });
    onClose();
  });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
      {v && (v.contact || v.link) && (
        <div className="flex flex-wrap gap-2">
          {v.contact && looksLikePhone(v.contact) && <a className="inline-flex min-h-12 items-center rounded-full border border-line px-5 text-sm font-semibold" href={`tel:${v.contact.replace(/[^\d+]/g, "")}`}>Telepon</a>}
          {v.link && <a className="inline-flex min-h-12 items-center rounded-full border border-line px-5 text-sm font-semibold" href={safeLink(v.link)} target="_blank" rel="noopener noreferrer">Buka tautan</a>}
        </div>
      )}
      <TextInput label="Kategori" required list="cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
      <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <TextInput label="Nama vendor" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <SelectInput label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Vendor["status"] })} >{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput>
      {f.status === "selected" && v?.status !== "selected" && <p className="text-xs text-muted">Vendor terpilih lain di kategori ini akan kembali jadi kandidat.</p>}
      <MoneyInput label="Penawaran harga (Rp)" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} error={badPrice ? "Hanya angka." : null} />
      <TextInput label="Paket (opsional)" value={f.pkg} onChange={(e) => setF({ ...f, pkg: e.target.value })} />
      <TextInput label="Kontak (opsional)" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
      <TextInput label="Tautan (opsional)" type="url" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
      <TextInput label="Catatan (opsional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <ErrorNote error={save.error ?? remove.error ?? addBudget.error} />
      <Button type="submit" className="w-full" disabled={save.isPending || badPrice || f.name.trim() === "" || f.category.trim() === ""}>{save.isPending ? "Menyimpan…" : "Simpan"}</Button>
      {v && (linked
        ? <p className="text-center text-sm text-muted">Sudah ada di anggaran: {linked.name}</p>
        : <Button type="button" variant="secondary" className="w-full" disabled={addBudget.isPending} onClick={() => addBudget.mutate(undefined)}>Tambahkan ke anggaran</Button>)}
      {v && (del.armed ? <div className="flex gap-2"><Button type="button" variant="danger" onClick={() => remove.mutate(undefined)} disabled={remove.isPending}>Ya, arsipkan</Button><Button type="button" variant="secondary" onClick={del.reset}>Batal</Button></div>
        : <Button type="button" variant="ghost" className="text-danger" onClick={del.arm}>Arsipkan vendor</Button>)}
    </form>
  );
}
