"use client";
import { useState } from "react";
import { ArchiveBox } from "@/components/cancel-box";
import { Button, Chip, ChipRow, Empty, ErrorNote, FieldRow, FilterBar, FilterSheet, Group, Icon, LedgerRow, ListSkeleton, MoneyInput, PageHeader, Panel, RowButton, SectionHead, SelectInput, Sheet, StickyActions, TextInput, cx } from "@/components/ui";
import { formatRupiah, parseRupiah } from "@/domain/money";
import { archiveRow, insertRow, selectVendor, updateRow } from "@/lib/api";
import { useAction, useWeddingData } from "@/lib/hooks";
import type { BudgetItemStatusRow, Vendor } from "@/lib/types";
import { useWedding } from "@/lib/wedding-context";

const STATUS: Record<Vendor["status"], string> = { candidate: "Kandidat", selected: "Terpilih", rejected: "Ditolak" };
const looksLikePhone = (s: string) => /^[+\d][\d\s-]{6,}$/.test(s.trim());
const safeLink = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);
const linkBtn = "inline-flex min-h-11 items-center gap-2 rounded-ctl border border-line-strong bg-surface px-4 font-semibold active:bg-indigo-soft";

export default function VendorPage() {
  const { weddingId } = useWedding();
  const { vendors, items } = useWeddingData(weddingId);
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState("");
  const [st, setSt] = useState<Vendor["status"] | "all">("all");
  const [cat, setCat] = useState("");
  if (vendors.error) return <ErrorNote error={vendors.error} />;
  if (!vendors.data) return <ListSkeleton rows={5} />;
  const cats = [...new Set(vendors.data.map((v) => v.category))];
  const match = (v: Vendor) => (st === "all" || v.status === st) && (cat === "" || v.category === cat) && (q.trim() === "" || `${v.name} ${v.package ?? ""} ${v.notes ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const shown = vendors.data.filter(match);
  const compareList = comparing ? vendors.data.filter((v) => v.category === comparing && v.status !== "rejected") : [];
  const cheapest = Math.min(...compareList.map((v) => v.price_quote ?? Infinity));
  const reset = () => { setQ(""); setSt("all"); setCat(""); };

  return (
    <div className="space-y-5">
      <PageHeader title="Vendor" action={<Button compact aria-label="Tambah vendor" onClick={() => setEditing("new")}><Icon name="plus" size={18} />Tambah</Button>} />
      {vendors.data.length > 0 && (
        <>
          <FilterBar q={q} onQ={setQ} placeholder="Cari nama, paket, atau catatan" activeCount={cat ? 1 : 0} active={q.trim() !== "" || st !== "all" || cat !== ""}
            onOpen={() => setSheet(true)} shown={shown.length} total={vendors.data.length} onReset={reset}
            quick={<ChipRow label="Status vendor"><Chip active={st === "all"} onClick={() => setSt("all")}>Semua</Chip>{(Object.keys(STATUS) as Vendor["status"][]).map((k) => <Chip key={k} active={st === k} onClick={() => setSt(k)}>{STATUS[k]}</Chip>)}</ChipRow>} />
          <FilterSheet open={sheet} onClose={() => setSheet(false)} shown={shown.length} onReset={reset}>
            <SelectInput label="Kategori" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Semua kategori</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </FilterSheet>
        </>
      )}
      {cats.length === 0 && <Empty title="Belum ada vendor" hint="Catat kandidat per kategori, bandingkan, lalu pilih satu." action={<Button onClick={() => setEditing("new")}>Tambah vendor</Button>} />}
      {vendors.data.length > 0 && shown.length === 0 && <Empty title="Tidak ada vendor yang cocok" hint="Ubah atau reset filter." />}
      {cats.map((c) => {
        const list = shown.filter((v) => v.category === c);
        if (list.length === 0) return null;
        const chosen = vendors.data.find((v) => v.category === c && v.status === "selected");
        const open = vendors.data.filter((v) => v.category === c).filter((v) => v.status !== "rejected");
        return (
          <section key={c} aria-label={c} className="space-y-1">
            <SectionHead
              title={<><span className="truncate">{c}</span>{!chosen && <span className="shrink-0 font-normal text-muted">belum ada terpilih</span>}</>}
              aside={open.length >= 2 ? <button className="-mr-2 flex min-h-11 items-center px-2 font-semibold text-indigo" onClick={() => setComparing(c)}>Bandingkan</button> : undefined} />
            <Group>
              {list.map((v) => (
                <RowButton key={v.id} stack onClick={() => setEditing(v)} className={cx(v.status === "selected" && "bg-daun-soft", v.status === "rejected" && "opacity-60")}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={cx("min-w-0 truncate font-medium", v.status === "rejected" && "line-through")}>{v.name}</span>
                    <span className={cx("num shrink-0", v.price_quote === null ? "text-meta text-muted" : "font-semibold")}>{v.price_quote === null ? "Harga belum ada" : formatRupiah(v.price_quote)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 text-meta text-muted">
                    <span className="truncate">{v.package || "Tanpa paket"}</span>
                    <span className={cx("flex shrink-0 items-center gap-1", v.status === "selected" && "font-semibold text-daun")}>{v.status === "selected" && <Icon name="check" size={14} />}{STATUS[v.status]}</span>
                  </span>
                </RowButton>
              ))}
            </Group>
          </section>
        );
      })}
      <Sheet open={editing !== null} title={editing === "new" ? "Tambah vendor" : "Ubah vendor"} onClose={() => setEditing(null)}>
        {editing !== null && <VendorForm key={editing === "new" ? "new" : editing.id} weddingId={weddingId} v={editing === "new" ? null : editing} categories={cats} items={items.data ?? []} onClose={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={comparing !== null} title={`Bandingkan: ${comparing ?? ""}`} onClose={() => setComparing(null)}>
        <div className="space-y-3">
          {compareList.map((v) => (
            <Panel key={v.id} tone={v.status === "selected" ? "daun" : "plain"}>
              <p className="flex items-baseline justify-between gap-3 font-semibold"><span className="min-w-0">{v.name}</span><span className="shrink-0 text-meta font-normal text-muted">{STATUS[v.status]}</span></p>
              <dl className="mt-3 space-y-2">
                <LedgerRow label="Harga" value={v.price_quote === null ? "Belum ada" : formatRupiah(v.price_quote)} />
                <LedgerRow label="Paket" value={v.package || "-"} />
                <LedgerRow label="Kontak" value={v.contact || "-"} />
              </dl>
              {v.price_quote !== null && compareList.length > 1 && (
                <p className={cx("num mt-2 text-meta", v.price_quote === cheapest ? "font-semibold text-daun" : "text-muted")}>
                  {v.price_quote === cheapest ? "Termurah di kategori ini" : `${formatRupiah(v.price_quote - cheapest)} lebih mahal dari yang termurah`}
                </p>
              )}
              {v.notes && <p className="mt-2 text-meta text-muted">{v.notes}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <PickButton weddingId={weddingId} v={v} onDone={() => setComparing(null)} />
                <Button variant="secondary" onClick={() => { setComparing(null); setEditing(v); }}>Detail</Button>
              </div>
            </Panel>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function PickButton({ weddingId, v, onDone }: { weddingId: string; v: Vendor; onDone: () => void }) {
  const pick = useAction(async () => { await selectVendor(weddingId, v.id); onDone(); });
  if (v.status === "selected") return <span className="flex min-h-11 items-center gap-1.5 font-semibold text-daun"><Icon name="check" size={18} />Terpilih</span>;
  return <div><Button onClick={() => pick.mutate(undefined)} disabled={pick.isPending}>{pick.isPending ? "Memilih…" : "Pilih vendor ini"}</Button><ErrorNote error={pick.error} /></div>;
}

function VendorForm({ weddingId, v, categories, items, onClose }: { weddingId: string; v: Vendor | null; categories: string[]; items: BudgetItemStatusRow[]; onClose: () => void }) {
  const [f, setF] = useState({ category: v?.category ?? "", name: v?.name ?? "", status: v?.status ?? "candidate", contact: v?.contact ?? "", price: v?.price_quote?.toString() ?? "", pkg: v?.package ?? "", link: v?.link ?? "", notes: v?.notes ?? "" });
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
    await insertRow("budget_items", { wedding_id: weddingId, section: "vendor", category: v.category, name: v.name, vendor_id: v.id, final_price: v.price_quote });
    onClose();
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
      {v && (v.contact || v.link) && (
        <div className="flex flex-wrap gap-2">
          {v.contact && looksLikePhone(v.contact) && <a className={linkBtn} href={`tel:${v.contact.replace(/[^\d+]/g, "")}`}><Icon name="phone" size={18} />Telepon</a>}
          {v.link && <a className={linkBtn} href={safeLink(v.link)} target="_blank" rel="noopener noreferrer"><Icon name="link" size={18} />Buka tautan</a>}
        </div>
      )}
      <TextInput label="Nama vendor" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <FieldRow>
        <TextInput label="Kategori" required list="cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <SelectInput label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Vendor["status"] })}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput>
      </FieldRow>
      <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      {f.status === "selected" && v?.status !== "selected" && <p className="-mt-2 text-meta text-muted">Vendor terpilih lain di kategori ini akan kembali jadi kandidat.</p>}
      <FieldRow>
        <MoneyInput label="Penawaran (Rp)" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} error={badPrice ? "Hanya angka." : null} />
        <TextInput label="Paket (opsional)" value={f.pkg} onChange={(e) => setF({ ...f, pkg: e.target.value })} />
      </FieldRow>
      <TextInput label="Kontak (opsional)" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
      <TextInput label="Tautan (opsional)" type="url" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
      <TextInput label="Catatan (opsional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <ErrorNote error={save.error ?? remove.error ?? addBudget.error} />
      <StickyActions>
        <Button type="submit" className="w-full" disabled={save.isPending || badPrice || f.name.trim() === "" || f.category.trim() === ""}>{save.isPending ? "Menyimpan…" : "Simpan"}</Button>
      </StickyActions>
      {v && (linked
        ? <p className="text-center text-meta text-muted">Sudah ada di anggaran: {linked.name}</p>
        : <Button type="button" variant="secondary" className="w-full" disabled={addBudget.isPending} onClick={() => addBudget.mutate(undefined)}>Tambahkan ke anggaran</Button>)}
      {v && <ArchiveBox label="Arsipkan vendor" pending={remove.isPending} onConfirm={() => remove.mutate(undefined)} />}
    </form>
  );
}
