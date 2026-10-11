"use client";
import { Chip, SelectInput, TextInput } from "../ui";
import type { BudgetItemStatusRow, Section } from "@/lib/types";

export interface ItemFilter { q: string; section: Section | "all"; category: string; status: "all" | "belum" | BudgetItemStatusRow["status"] }
export const EMPTY_FILTER: ItemFilter = { q: "", section: "all", category: "", status: "all" };

export const SECTION_LABEL: Record<Section, string> = { paperwork: "Berkas", seserahan: "Seserahan", vendor: "Vendor", other: "Lainnya" };

export function filterItems(items: BudgetItemStatusRow[], f: ItemFilter) {
  const q = f.q.trim().toLowerCase();
  return items.filter((i) =>
    (f.section === "all" || i.section === f.section) &&
    (f.category === "" || (i.category ?? "") === f.category) &&
    (f.status === "all" || (f.status === "belum" ? i.status !== "lunas" : i.status === f.status)) &&
    (q === "" || `${i.name} ${i.category ?? ""}`.toLowerCase().includes(q)));
}

export const isFiltered = (f: ItemFilter) => f.q !== "" || f.section !== "all" || f.category !== "" || f.status !== "all";

/** Pencarian + filter kelompok/kategori/status. `compact` menyembunyikan kelompok dan status (dipakai di pilih item pembayaran). */
export function ItemFilters({ items, value, onChange, shown, compact = false }: { items: BudgetItemStatusRow[]; value: ItemFilter; onChange: (f: ItemFilter) => void; shown: number; compact?: boolean }) {
  const sectionKeys = (Object.keys(SECTION_LABEL) as Section[]).filter((k) => items.some((i) => i.section === k));
  const cats = [...new Set(items.filter((i) => value.section === "all" || i.section === value.section).map((i) => i.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b));
  const set = (p: Partial<ItemFilter>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-3">
      <TextInput label="Cari item" type="search" placeholder="Nama atau kategori" value={value.q} onChange={(e) => set({ q: e.target.value })} />
      {!compact && sectionKeys.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kelompok">
          <Chip active={value.section === "all"} onClick={() => set({ section: "all", category: "" })}>Semua</Chip>
          {sectionKeys.map((k) => <Chip key={k} active={value.section === k} onClick={() => set({ section: k, category: "" })}>{SECTION_LABEL[k]}</Chip>)}
        </div>
      )}
      <div className={compact ? "" : "grid grid-cols-2 gap-3"}>
        {cats.length > 0 && (
          <SelectInput label="Kategori" value={value.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">Semua kategori</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectInput>
        )}
        {!compact && (
          <SelectInput label="Status" value={value.status} onChange={(e) => set({ status: e.target.value as ItemFilter["status"] })}>
            <option value="all">Semua status</option>
            <option value="belum">Belum lunas</option>
            <option value="belum_dibayar">Belum dibayar</option>
            <option value="dp">DP</option>
            <option value="lunas">Lunas</option>
          </SelectInput>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{shown} dari {items.length} item</span>
        {isFiltered(value) && <button type="button" className="min-h-12 px-2 font-medium text-ink underline" onClick={() => onChange(EMPTY_FILTER)}>Reset filter</button>}
      </div>
    </div>
  );
}
