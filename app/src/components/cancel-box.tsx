"use client";
import { useState } from "react";
import { Button, ErrorNote, TextInput } from "./ui";

/** Pembatalan teraudit: alasan wajib, dua langkah, tanpa hapus keras. */
export function CancelBox({ label, onConfirm, pending, error }: { label: string; onConfirm: (reason: string) => void; pending: boolean; error: unknown }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button variant="ghost" className="min-h-12 px-2 text-sm text-danger" onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="space-y-2 rounded-input border border-danger p-3">
      <TextInput label="Alasan pembatalan" value={reason} onChange={(e) => setReason(e.target.value)} />
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button variant="danger" disabled={pending || reason.trim() === ""} onClick={() => onConfirm(reason.trim())}>Ya, batalkan</Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>Kembali</Button>
      </div>
    </div>
  );
}
