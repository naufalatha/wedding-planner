"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { groupDigits } from "@/domain/money";
import { friendlyError } from "@/lib/errors";

export function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

/* ---------- Ikon (24px, garis 1.8) ---------- */
const ICONS = {
  home: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z",
  wallet: "M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2",
  tasks: "M5 4h14v16H5zM9 9l2 2 4-4M9 15h6",
  store: "M4 9l2-5h12l2 5M4 9v11h16V9M4 9h16M10 20v-6h4v6",
  users: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21c0-4 4-6 8-6s8 2 8 6",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M13 7a2 2 0 104 0 2 2 0 10-4 0M7 17a2 2 0 104 0 2 2 0 10-4 0",
  x: "M6 6l12 12M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  back: "M15 6l-6 6 6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  logout: "M9 4H5v16h4M16 8l4 4-4 4M20 12H9",
  alert: "M12 4l9 16H3zM12 10v4M12 17v.01",
  copy: "M8 8h12v13H8zM5 16V3h11",
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("shrink-0", className)}>
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ---------- Tombol ---------- */
type Variant = "primary" | "secondary" | "danger" | "ghost" | "dangerGhost" | "accent" | "onDark";
const VARIANT: Record<Variant, string> = {
  onDark: "border border-surface/40 text-surface active:bg-surface/10",
  primary: "bg-indigo text-surface active:bg-indigo-deep",
  accent: "bg-kunyit text-ink active:brightness-95",
  secondary: "border border-line-strong bg-surface text-ink active:bg-indigo-soft",
  danger: "border border-danger bg-surface text-danger active:bg-danger-soft",
  ghost: "text-ink active:bg-indigo-soft",
  dangerGhost: "text-danger active:bg-danger-soft",
};
const btnCls = (variant: Variant, className?: string, compact?: boolean) =>
  cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl font-semibold disabled:pointer-events-none disabled:opacity-45", compact ? "px-3" : "px-5", VARIANT[variant], className);

export function Button({ variant = "primary", compact, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; compact?: boolean }) {
  return <button {...p} className={btnCls(variant, className, compact)} />;
}

export function LinkButton({ href, variant = "primary", compact, className, children }: { href: string; variant?: Variant; compact?: boolean; className?: string; children: ReactNode }) {
  return <Link href={href} className={btnCls(variant, className, compact)}>{children}</Link>;
}

export function IconButton({ label, icon, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconName }) {
  return <button {...p} aria-label={label} className={cx("grid size-11 shrink-0 place-items-center rounded-ctl active:bg-indigo-soft", className)}><Icon name={icon} /></button>;
}

/* ---------- Isian ---------- */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-meta font-medium">{label}</label>
      {children(id)}
      {hint && !error && <p className="text-meta text-muted">{hint}</p>}
      {error && <p role="alert" className="text-meta text-danger">{error}</p>}
    </div>
  );
}

export const inputCls = "min-h-11 w-full rounded-ctl border border-line-strong bg-surface px-3.5 text-[1rem] leading-6 placeholder:text-muted/70";

export function TextInput({ label, hint, error, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  return <Field label={label} hint={hint} error={error}>{(id) => <input id={id} {...p} className={cx(inputCls, p.className)} />}</Field>;
}

/** Input nominal: pemisah ribuan otomatis saat mengetik. Nilai yang dilaporkan sudah berpemisah; parseRupiah menanganinya. */
export function MoneyInput({ value, onChange, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null; value: string }) {
  return (
    <TextInput {...p} inputMode="numeric" autoComplete="off" placeholder={p.placeholder ?? "0"} className="num" value={groupDigits(value)}
      onChange={(e) => { e.target.value = groupDigits(e.target.value); onChange?.(e); }} />
  );
}

export function SelectInput({ label, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <Field label={label}>{(id) => <select id={id} {...p} className={inputCls}>{children}</select>}</Field>;
}

/** Dua isian sejajar untuk pasangan pendek (jumlah + tanggal). */
export const FieldRow = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-3">{children}</div>;

export function Checkbox({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-body">
      <input type="checkbox" {...p} className="size-5 shrink-0 accent-[var(--indigo)]" />{label}
    </label>
  );
}

/* ---------- Penanda status & progres ---------- */
export function ProgressBar({ value, tone = "indigo", className }: { value: number; tone?: "indigo" | "daun" | "kunyit" | "paper"; className?: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const fill = { indigo: "bg-indigo", daun: "bg-daun", kunyit: "bg-kunyit", paper: "bg-kunyit" }[tone];
  const track = tone === "paper" ? "bg-surface/20" : "bg-line";
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className={cx("h-1.5 w-full overflow-hidden rounded-full", track, className)}>
      <div className={cx("bar-fill h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

const CHIP: Record<string, string> = {
  belum_dibayar: "bg-paper text-muted ring-1 ring-inset ring-line-strong",
  dp: "bg-kunyit-soft text-ink",
  lunas: "bg-daun-soft text-daun",
  kelebihan_bayar: "bg-danger-soft text-danger",
};
const DOT: Record<string, string> = { belum_dibayar: "bg-line-strong", dp: "bg-kunyit", lunas: "bg-daun", kelebihan_bayar: "bg-danger" };
const CHIP_LABEL: Record<string, string> = { belum_dibayar: "Belum dibayar", dp: "DP", lunas: "Lunas", kelebihan_bayar: "Kelebihan bayar" };
export const StatusChip = ({ status }: { status: string }) => (
  <span className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium leading-5", CHIP[status])}>
    <span className={cx("size-1.5 rounded-full", DOT[status])} />{CHIP_LABEL[status] ?? status}
  </span>
);

/** Penanda data yang belum lengkap; menautkan ke tempat mengisinya. */
export function Flag({ href, children }: { href?: string; children: ReactNode }) {
  const pill = "inline-flex items-center gap-1.5 rounded-xl bg-kunyit-soft px-2.5 py-1 text-[0.75rem] font-medium leading-4 text-ink";
  const body = <><Icon name="alert" size={14} />{children}</>;
  // Tautan diberi area sentuh 44px; pil-nya tetap kecil.
  return href ? <Link href={href} className="inline-flex min-h-11 items-center"><span className={pill}>{body}</span></Link> : <span className={pill}>{body}</span>;
}

/** Chip filter: tampilan 36px, area sentuh 44px. */
export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="flex min-h-11 shrink-0 items-center">
      <span className={cx("flex h-9 items-center rounded-full px-3.5 text-body", active ? "bg-ink font-semibold text-surface" : "border border-line-strong bg-surface")}>{children}</span>
    </button>
  );
}

export function Tabs<T extends string>({ label, value, onChange, items }: { label: string; value: T; onChange: (v: T) => void; items: readonly (readonly [T, string])[] }) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar flex overflow-x-auto border-b border-line">
      {items.map(([id, text]) => (
        <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}
          className={cx("-mb-px min-h-11 flex-1 shrink-0 border-b-2 px-3 text-body", value === id ? "border-indigo font-semibold text-indigo" : "border-transparent text-muted")}>{text}</button>
      ))}
    </div>
  );
}

/* ---------- Pembungkus konten ---------- */
export function Panel({ tone = "plain", className, children }: { tone?: "plain" | "soft" | "daun" | "kunyit"; className?: string; children: ReactNode }) {
  const bg = { plain: "border border-line bg-surface", soft: "bg-indigo-soft", daun: "bg-daun-soft", kunyit: "bg-kunyit-soft" }[tone];
  return <section className={cx("rounded-group p-4", bg, className)}>{children}</section>;
}

/** Daftar berkelompok: satu permukaan, baris dibatasi garis tipis. */
export function Group({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return <ul aria-label={label} className={cx("divide-y divide-line overflow-hidden rounded-group border border-line bg-surface", className)}>{children}</ul>;
}
const rowBase = "flex min-h-14 w-full px-4 text-left";
const rowLayout = (stack?: boolean) => (stack ? "flex-col items-stretch gap-1.5 py-3" : "items-center gap-3 py-2.5");
const rowPress = "active:bg-indigo-soft";
interface RowProps { className?: string; stack?: boolean; children: ReactNode }
export const RowButton = ({ onClick, className, stack, children, ...p }: RowProps & { onClick: () => void } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className" | "children">) =>
  <li><button type="button" onClick={onClick} {...p} className={cx(rowBase, rowLayout(stack), rowPress, className)}>{children}</button></li>;
export const RowLink = ({ href, className, stack, children }: RowProps & { href: string }) =>
  <li><Link href={href} className={cx(rowBase, rowLayout(stack), rowPress, className)}>{children}</Link></li>;
export const RowStatic = ({ className, stack, children }: RowProps) => <li className={cx(rowBase, rowLayout(stack), className)}>{children}</li>;

/** Judul halaman: serif besar di kiri, aksi utama di kanan. Tidak menempel; hemat tinggi layar. */
export function PageHeader({ title, action, back }: { title: string; action?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-4">
      {back && <Link href={back.href} className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-meta text-muted"><Icon name="back" size={16} />{back.label}</Link>}
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3">
        <h1 className="display text-head">{title}</h1>
        {action}
      </div>
    </header>
  );
}

/** Judul kelompok yang menempel saat menggulir. `aside` = ringkasan kelompok (jumlah, subtotal) atau satu aksi. */
export function SectionHead({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 flex min-h-11 items-center justify-between gap-3 bg-paper/95 px-4 backdrop-blur md:-mx-6 md:px-6">
      <h2 className="flex min-w-0 items-center gap-2 text-meta font-semibold">{title}</h2>
      {aside && <div className="num text-right text-meta text-muted">{aside}</div>}
    </div>
  );
}

/** Baris laporan dengan garis titik-titik, seperti buku kas. */
export function LedgerRow({ label, value, tone }: { label: string; value: ReactNode; tone?: "danger" }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-muted">{label}</dt>
      <span aria-hidden className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-line-strong" />
      <dd className={cx("num ml-auto font-semibold", tone === "danger" && "text-danger")}>{value}</dd>
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-group bg-indigo-soft/60 px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-[32ch] text-meta text-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex gap-2 rounded-ctl bg-danger-soft p-3 text-meta text-danger">
      <Icon name="alert" size={18} className="mt-px" />{friendlyError(error)}
    </p>
  );
}

/* ---------- Pencarian & filter ---------- */
/** Kolom cari + tombol Filter. Baris ringkasan muncul hanya saat ada filter aktif. */
export function FilterBar({ q, onQ, placeholder, activeCount, active, onOpen, shown, total, onReset, quick }: {
  q: string; onQ: (v: string) => void; placeholder: string;
  /** Jumlah filter di dalam sheet (jadi lencana pada tombol). */
  activeCount: number;
  /** Ada pencarian atau filter apa pun yang menyaring daftar. */
  active: boolean; onOpen?: () => void;
  shown: number; total: number; onReset: () => void; quick?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <label className="relative block flex-1">
          <span className="sr-only">Cari</span>
          <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={(e) => onQ(e.target.value)} placeholder={placeholder} className={cx(inputCls, "pl-10")} />
        </label>
        {onOpen && (
          <button type="button" onClick={onOpen} aria-label={activeCount ? `Filter, ${activeCount} aktif` : "Filter"}
            className={cx("relative grid size-11 shrink-0 place-items-center rounded-ctl border", activeCount ? "border-indigo bg-indigo-soft text-indigo" : "border-line-strong bg-surface")}>
            <Icon name="sliders" />
            {activeCount > 0 && <span className="num absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-indigo text-[0.6875rem] font-semibold text-surface">{activeCount}</span>}
          </button>
        )}
      </div>
      {quick}
      {active && (
        <div className="flex min-h-9 items-center justify-between text-meta text-muted">
          <span className="num">{shown} dari {total}</span>
          <button type="button" onClick={onReset} className="-mr-2 flex min-h-11 items-center px-2 font-semibold text-indigo">Reset filter</button>
        </div>
      )}
    </div>
  );
}

/** Baris chip yang bisa digeser mendatar; berjalan sampai tepi layar supaya terlihat ada lanjutannya. */
export const ChipRow = ({ label, wrap = false, children }: { label: string; wrap?: boolean; children: ReactNode }) => (
  <div role="group" aria-label={label} className={wrap ? "flex flex-wrap gap-x-2" : "no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6"}>{children}</div>
);

/* ---------- Sheet ---------- */
/** Bottom sheet di ponsel, dialog di layar lebar. Isian tetap ada di komponen anak; ditutup hanya oleh pengguna. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; before?.focus?.(); };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="scrim-in fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 md:items-center" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="sheet-in flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-sheet bg-paper outline-none md:rounded-sheet">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-3 py-1 pl-5 pr-2">
          <h2 className="truncate text-lead font-semibold">{title}</h2>
          <IconButton label="Tutup" icon="x" onClick={onClose} />
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Tombol simpan yang menempel di dasar sheet, supaya tidak perlu menggulir formulir panjang. */
export function StickyActions({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 z-10 -mx-5 mt-5 space-y-2 border-t border-line bg-paper/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">{children}</div>;
}

/** Sheet khusus filter: hasil terhitung langsung, jadi tombolnya hanya menutup. */
export function FilterSheet({ open, onClose, shown, onReset, children }: { open: boolean; onClose: () => void; shown: number; onReset: () => void; children: ReactNode }) {
  return (
    <Sheet open={open} title="Filter" onClose={onClose}>
      <div className="space-y-5">{children}</div>
      <StickyActions>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onReset}>Reset</Button>
          <Button className="flex-1" onClick={onClose}>Tampilkan {shown} hasil</Button>
        </div>
      </StickyActions>
    </Sheet>
  );
}

/* ---------- Merek & pemuatan ---------- */
/** Logo dua cincin. `spin` memutarnya (dipakai saat memuat). */
export function Logo({ size = 56, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden className={spin ? "logo-spin" : undefined}>
      <rect width="512" height="512" rx="112" fill="var(--indigo)" />
      <g fill="none" strokeWidth="34"><circle cx="205" cy="270" r="82" stroke="var(--kunyit)" /><circle cx="307" cy="270" r="82" stroke="var(--paper)" /></g>
    </svg>
  );
}

/** Layar penuh saat sesi/keanggotaan dimuat (termasuk setelah refresh): logo berputar. */
export function Loading({ label = "Memuat…" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 py-10">
      <Logo size={56} spin />
      <span className="text-meta text-muted">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton rounded-ctl", className)} />;
}

/** Kerangka halaman daftar: judul, kolom cari, lalu baris. Memberi kesan konten sedang tiba. */
export function ListSkeleton({ rows = 5, summary = false }: { rows?: number; summary?: boolean }) {
  return (
    <div role="status" aria-label="Memuat" className="space-y-4">
      <span className="sr-only">Memuat…</span>
      <div className="flex items-center justify-between"><Skeleton className="h-8 w-36" /><Skeleton className="size-11" /></div>
      {summary && <Skeleton className="h-28 w-full !rounded-group" />}
      <Skeleton className="h-11 w-full" />
      <div className="divide-y divide-line overflow-hidden rounded-group border border-line bg-surface">
        {Array.from({ length: rows }, (_, i) => <div key={i} className="flex h-14 items-center gap-3 px-4"><Skeleton className="h-4 w-2/5" /><Skeleton className="ml-auto h-4 w-1/5" /></div>)}
      </div>
    </div>
  );
}

/** Kerangka Beranda: blok indigo, agenda, dana. */
export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Memuat" className="space-y-4">
      <span className="sr-only">Memuat…</span>
      <Skeleton className="h-52 w-full !rounded-group" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-40 w-full !rounded-group" />
      <Skeleton className="h-36 w-full !rounded-group" />
    </div>
  );
}

/** Hook kecil untuk konfirmasi dua langkah (tanpa window.confirm). */
export function useConfirm() {
  const [armed, setArmed] = useState(false);
  return { armed, arm: () => setArmed(true), reset: () => setArmed(false) };
}
