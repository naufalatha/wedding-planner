"use client";
import Link from "next/link";
import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { groupDigits } from "@/domain/money";
import { friendlyError } from "@/lib/errors";

export function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

export function Card({ tone = "white", className, children }: { tone?: "white" | "accent" | "sage" | "blush"; className?: string; children: ReactNode }) {
  const bg = { white: "bg-surface border border-line", accent: "bg-accent-soft", sage: "bg-sage-soft", blush: "bg-blush-soft" }[tone];
  return <section className={cx("rounded-card p-5", bg, className)}>{children}</section>;
}

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const v = {
    primary: "bg-accent text-ink font-semibold active:brightness-95",
    secondary: "bg-surface text-ink border border-line",
    danger: "bg-surface text-danger border border-danger",
    ghost: "text-ink px-2 underline-offset-4 hover:underline",
  }[variant];
  return <button {...p} className={cx("min-h-12 rounded-full text-base disabled:opacity-50 disabled:pointer-events-none", variant === "ghost" ? "" : "px-6", v, className)} />;
}

export function LinkButton({ href, variant = "primary", className, children }: { href: string; variant?: "primary" | "secondary"; className?: string; children: ReactNode }) {
  const v = variant === "primary" ? "bg-accent text-ink font-semibold" : "bg-surface text-ink border border-line";
  return <Link href={href} className={cx("inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base", v, className)}>{children}</Link>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children(id)}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export const inputCls = "min-h-12 w-full rounded-input border border-line bg-surface px-4 text-base outline-none focus:border-ink";

export function TextInput({ label, hint, error, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  return <Field label={label} hint={hint} error={error}>{(id) => <input id={id} {...p} className={cx(inputCls, p.className)} />}</Field>;
}

/** Input nominal: pemisah ribuan otomatis saat mengetik. Nilai yang dilaporkan sudah berpemisah; parseRupiah menanganinya. */
export function MoneyInput({ value, onChange, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null; value: string }) {
  return (
    <TextInput {...p} inputMode="numeric" autoComplete="off" placeholder={p.placeholder ?? "0"} value={groupDigits(value)}
      onChange={(e) => { e.target.value = groupDigits(e.target.value); onChange?.(e); }} />
  );
}

export function SelectInput({ label, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <Field label={label}>{(id) => <select id={id} {...p} className={inputCls}>{children}</select>}</Field>;
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-3 w-full overflow-hidden rounded-full bg-surface">
      <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

const CHIP: Record<string, string> = {
  belum_dibayar: "bg-surface border border-line text-muted", dp: "bg-blush-soft", lunas: "bg-sage-soft", kelebihan_bayar: "bg-accent-soft border border-ink",
};
const CHIP_LABEL: Record<string, string> = { belum_dibayar: "Belum dibayar", dp: "DP", lunas: "Lunas", kelebihan_bayar: "Kelebihan bayar" };
export const StatusChip = ({ status }: { status: string }) => (
  <span className={cx("inline-block rounded-full px-3 py-1 text-xs font-medium", CHIP[status])}>{CHIP_LABEL[status] ?? status}</span>
);

export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cx("min-h-12 shrink-0 rounded-full px-4 text-sm", active ? "bg-ink text-surface" : "bg-surface border border-line")}>
      {children}
    </button>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line p-8 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="rounded-input bg-surface border border-danger p-3 text-sm text-danger">{friendlyError(error)}</p>;
}

/** Bottom sheet modal. Isian tetap ada di komponen anak; ditutup hanya oleh pengguna. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="sheet-in max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-card bg-bg p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="grid size-12 place-items-center rounded-full">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Logo dua cincin. `spin` memutarnya (dipakai saat memuat). */
export function Logo({ size = 56, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden className={spin ? "logo-spin" : undefined}>
      <rect width="512" height="512" rx="112" fill="var(--accent)" />
      <g fill="none" stroke="var(--text)" strokeWidth="36" strokeLinecap="round"><circle cx="200" cy="288" r="84" /><circle cx="312" cy="288" r="84" /></g>
    </svg>
  );
}

/** Layar penuh saat sesi/keanggotaan dimuat (termasuk setelah refresh): logo berputar. */
export function Loading({ label = "Memuat…" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 py-10">
      <Logo size={64} spin />
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton rounded-input", className)} />;
}

/** Kerangka halaman daftar: judul, tombol, lalu beberapa kartu. Memberi kesan konten sedang tiba. */
export function ListSkeleton({ rows = 4, summary = false }: { rows?: number; summary?: boolean }) {
  return (
    <div role="status" aria-label="Memuat" className="space-y-4">
      <span className="sr-only">Memuat…</span>
      <Skeleton className="h-9 w-40" />
      {summary && <Skeleton className="h-32 w-full !rounded-card" />}
      <Skeleton className="h-12 w-full !rounded-full" />
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-20 w-full !rounded-card" />)}
    </div>
  );
}

/** Kerangka Beranda: hitung mundur, kartu dana, dua angka ringkas, daftar. */
export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Memuat" className="space-y-4">
      <span className="sr-only">Memuat…</span>
      <div className="flex items-center justify-between"><Skeleton className="h-8 w-44" /><Skeleton className="size-12 !rounded-full" /></div>
      <Skeleton className="h-40 w-full !rounded-card" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-12 !rounded-full" /><Skeleton className="h-12 !rounded-full" /></div>
      <Skeleton className="h-28 w-full !rounded-card" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-20 !rounded-card" /><Skeleton className="h-20 !rounded-card" /></div>
      <Skeleton className="h-24 w-full !rounded-card" />
    </div>
  );
}

/** Hook kecil untuk konfirmasi dua langkah (tanpa window.confirm). */
export function useConfirm() {
  const [armed, setArmed] = useState(false);
  return { armed, arm: () => setArmed(true), reset: () => setArmed(false) };
}
