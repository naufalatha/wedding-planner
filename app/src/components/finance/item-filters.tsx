"use client";
import { useState } from "react";
import { Chip, ChipRow, FilterBar, FilterSheet, SelectInput } from "../ui";
import type { BudgetItemStatusRow, Section } from "@/lib/types";

export interface ItemFilter { q: string; section: Section | "all"; category: string; status: "all" | "belum" | BudgetItemStatusRow["status"] }
export const EMPTY_FILTER: ItemFilter = { q: "", section: "all", category: "", status: "all" };

export const SECTION_LABEL: Record<Section, string> = { paperwork: "Berkas", seserahan: "Seserahan", vendor: "Vendor", other: "Lainnya" };
const STATUS_CHIPS: [ItemFilter["status"], string][] = [["all", "Semua"], ["belum", "Belum lunas"], ["belum_dibayar", "Belum dibayar"], ["dp", "DP"], ["lunas", "Lunas"]];

export function filterItems(items: BudgetItemStatusRow[], f: ItemFilter) {
  const q = f.q.trim().toLowerCase();
  return items.filter((i) =>
    (f.section === "all" || i.section === f.section) &&
    (f.category === "" || (i.category ?? "") === f.category) &&
    (f.status === "all" || (f.status === "belum" ? i.status !== "lunas" : i.status === f.status)) &&
    (q === "" || `${i.name} ${i.category ?? ""}`.toLowerCase().includes(q)));
}

export const isFiltered = (f: ItemFilter) => f.q.trim() !== "" || f.section !== "all" || f.category !== "" || f.status !== "all";

/**
 * Cari + chip status (selalu terlihat) + sheet Filter untuk kelompok dan kategori.
 * `compact` (pilih item pembayaran) hanya menyisakan cari dan kategori.
 */
export function ItemFilterBar({ items, value, onChange, shown, compact = false }: { items: BudgetItemStatusRow[]; value: ItemFilter; onChange: (f: ItemFilter) => void; shown: number; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const set = (p: Partial<ItemFilter>) => onChange({ ...value, ...p });
  const sectionKeys = (Object.keys(SECTION_LABEL) as Section[]).filter((k) => items.some((i) => i.section === k));
  const cats = [...new Set(items.filter((i) => value.section === "all" || i.section === value.section).map((i) => i.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b));
  const showSections = !compact && sectionKeys.length > 1;
  const badge = (value.section !== "all" ? 1 : 0) + (value.category !== "" ? 1 : 0);
  const canOpen = showSections || cats.length > 0;
  return (
    <>
      <FilterBar q={value.q} onQ={(q) => set({ q })} placeholder="Cari nama atau kategori" activeCount={badge} active={isFiltered(value)}
        onOpen={canOpen ? () => setOpen(true) : undefined} shown={shown} total={items.length} onReset={() => onChange(EMPTY_FILTER)}
        quick={compact ? undefined : <ChipRow label="Status">{STATUS_CHIPS.map(([id, l]) => <Chip key={id} active={value.status === id} onClick={() => set({ status: id })}>{l}</Chip>)}</ChipRow>} />
      <FilterSheet open={open} onClose={() => setOpen(false)} shown={shown} onReset={() => onChange(EMPTY_FILTER)}>
        {showSections && (
          <div className="space-y-1">
            <p className="text-meta font-medium">Kelompok</p>
            <ChipRow label="Kelompok" wrap>
              <Chip active={value.section === "all"} onClick={() => set({ section: "all", category: "" })}>Semua</Chip>
              {sectionKeys.map((k) => <Chip key={k} active={value.section === k} onClick={() => set({ section: k, category: "" })}>{SECTION_LABEL[k]}</Chip>)}
            </ChipRow>
          </div>
        )}
        {cats.length > 0 && (
          <SelectInput label="Kategori" value={value.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">Semua kategori</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectInput>
        )}
      </FilterSheet>
    </>
  );
}

/** Samakan ejaan dengan kategori yang sudah ada (tanpa membedakan huruf besar/kecil) agar filter tidak terpecah. */
export function canonCategory(input: string, existing: string[]): string | null {
  const t = input.trim().replace(/\s+/g, " ");
  if (!t) return null;
  return existing.find((c) => c.toLowerCase() === t.toLowerCase()) ?? t;
}
