"use client";
/** Baris "X dari Y" + tombol Reset, dipakai di semua bar filter. */
export function ResultCount({ shown, total, active, onReset }: { shown: number; total: number; active: boolean; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between text-xs text-muted">
      <span>{shown} dari {total}</span>
      {active && <button type="button" className="min-h-12 px-2 font-medium text-ink underline" onClick={onReset}>Reset filter</button>}
    </div>
  );
}
