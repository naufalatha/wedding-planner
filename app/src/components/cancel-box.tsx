"use client";
import { useState } from "react";
import { Button, ErrorNote, TextInput } from "./ui";

/** Pembatalan teraudit: alasan wajib, dua langkah, tanpa hapus keras. */
export function CancelBox({ label, onConfirm, pending, error }: { label: string; onConfirm: (reason: string) => void; pending: boolean; error: unknown }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button variant="dangerGhost" className="-ml-3 text-meta" onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="space-y-3 rounded-ctl bg-danger-soft p-3">
      <TextInput label="Alasan pembatalan" value={reason} onChange={(e) => setReason(e.target.value)} />
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button variant="danger" disabled={pending || reason.trim() === ""} onClick={() => onConfirm(reason.trim())}>Ya, batalkan</Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>Kembali</Button>
      </div>
    </div>
  );
}

/** Arsip dua langkah untuk tugas, vendor, dan tamu (bisa dipulihkan dari database, bukan hapus keras). */
export function ArchiveBox({ label, pending, onConfirm }: { label: string; pending: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <Button type="button" variant="dangerGhost" className="w-full" onClick={() => setArmed(true)}>{label}</Button>;
  return (
    <div className="flex gap-2">
      <Button type="button" variant="danger" className="flex-1" onClick={onConfirm} disabled={pending}>Ya, arsipkan</Button>
      <Button type="button" variant="secondary" onClick={() => setArmed(false)}>Batal</Button>
    </div>
  );
}
