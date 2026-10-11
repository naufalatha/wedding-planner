"use client";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorNote, Loading, TextInput } from "@/components/ui";
import { createInvitation, updateRow } from "@/lib/api";
import { useAction, useWeddingData } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useWedding } from "@/lib/wedding-context";
import { parseRupiah } from "@/domain/money";

export default function Akun() {
  const { weddingId, role, email } = useWedding();
  const router = useRouter();
  const qc = useQueryClient();
  const { wedding } = useWeddingData(weddingId);
  const [code, setCode] = useState<string | null>(null);
  const invite = useAction(async () => setCode(await createInvitation(weddingId)));
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const w = wedding.data;
  const f = form ?? (w ? { groom: w.groom_name, bride: w.bride_name, date: w.wedding_date ?? "", location: w.location ?? "", target: w.target_amount?.toString() ?? "", opening: String(w.opening_balance), cap: w.budget_cap?.toString() ?? "" } : null);
  const save = useAction(async () => {
    if (!w || !f) return;
    await updateRow("weddings", w.id, w.revision, {
      groom_name: f.groom.trim(), bride_name: f.bride.trim(), wedding_date: f.date || null, location: f.location.trim() || null,
      target_amount: parseRupiah(f.target), opening_balance: parseRupiah(f.opening) ?? 0, budget_cap: parseRupiah(f.cap),
    });
    setForm(null);
  });
  if (!w || !f) return <Loading />;
  const bad = ["target", "opening", "cap"].some((k) => f[k] !== "" && Number.isNaN(parseRupiah(f[k])));
  const on = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <Link href="/beranda" className="inline-flex min-h-12 items-center text-sm text-muted">← Beranda</Link>
      <h1 className="text-3xl font-extrabold tracking-tight">Akun</h1>
      <Card><p className="text-xs text-muted">Masuk sebagai</p><p className="font-medium">{email}</p><p className="mt-1 text-xs text-muted">Peran: {role === "owner" ? "Pemilik" : "Pasangan"}</p></Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Data pernikahan</h2>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <TextInput label="Mempelai pria" value={f.groom} onChange={on("groom")} required />
          <TextInput label="Mempelai wanita" value={f.bride} onChange={on("bride")} required />
          <TextInput label="Tanggal" type="date" value={f.date} onChange={on("date")} />
          <TextInput label="Lokasi" value={f.location} onChange={on("location")} />
          <TextInput label="Target dana (Rp)" inputMode="numeric" value={f.target} onChange={on("target")} />
          <TextInput label="Saldo awal (Rp)" inputMode="numeric" value={f.opening} onChange={on("opening")} />
          <TextInput label="Batas anggaran rencana (Rp)" inputMode="numeric" value={f.cap} onChange={on("cap")} />
          {bad && <p role="alert" className="text-xs text-danger">Nominal hanya boleh angka.</p>}
          <ErrorNote error={save.error} />
          <Button type="submit" disabled={save.isPending || bad || !form}>{save.isPending ? "Menyimpan…" : "Simpan"}</Button>
        </form>
      </Card>

      {role === "owner" && (
        <Card tone="mint">
          <h2 className="text-lg font-bold">Undang pasangan</h2>
          <p className="mb-3 mt-1 text-sm">Kode berlaku 7 hari dan hanya bisa dipakai sekali. Maksimal 2 anggota.</p>
          {code && <p className="mb-3 rounded-input bg-surface p-4 text-center font-mono text-2xl font-bold tracking-widest" aria-live="polite">{code}</p>}
          <ErrorNote error={invite.error} />
          <Button variant="secondary" onClick={() => invite.mutate(undefined)} disabled={invite.isPending}>{code ? "Buat kode baru" : "Buat kode undangan"}</Button>
          {code && <p className="mt-2 text-xs text-muted">Kode ini hanya ditampilkan sekarang. Kode lama otomatis tidak berlaku.</p>}
        </Card>
      )}

      <Button variant="danger" className="w-full" onClick={async () => { await supabase().auth.signOut(); qc.clear(); router.replace("/masuk"); }}>Keluar</Button>
    </div>
  );
}
