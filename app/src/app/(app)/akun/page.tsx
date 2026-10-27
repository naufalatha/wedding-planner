"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote, FieldRow, Icon, Loading, MoneyInput, PageHeader, Panel, TextInput } from "@/components/ui";
import { createInvitation, updateRow } from "@/lib/api";
import { useAction, useWeddingData } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useWedding } from "@/lib/wedding-context";
import { parseRupiah } from "@/domain/money";
import { formatShortDate, jakartaDate } from "@/domain/dates";

export default function Akun() {
  const { weddingId, role, email } = useWedding();
  const router = useRouter();
  const qc = useQueryClient();
  const { wedding, members } = useWeddingData(weddingId);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (what: "kode" | "tautan", text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 2000); } catch { setCopied(null); }
  };
  const [code, setCode] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const invite = useAction(async () => { setCode(await createInvitation(weddingId)); setExpires(jakartaDate(new Date(Date.now() + 7 * 86_400_000))); });
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
  const link = (c: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/mulai?kode=${encodeURIComponent(c)}`;
  if (!w || !f) return <Loading />;
  const bad = ["target", "opening", "cap"].some((k) => f[k] !== "" && Number.isNaN(parseRupiah(f[k])));
  const on = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-7">
      <PageHeader title="Akun" back={{ href: "/beranda", label: "Beranda" }} />
      <Panel>
        <p className="text-meta text-muted">Masuk sebagai</p>
        <p className="break-words font-semibold">{email}</p>
        <p className="mt-0.5 text-meta text-muted">{role === "owner" ? "Pemilik pernikahan" : "Pasangan"}</p>
      </Panel>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <h2 className="text-lead font-semibold">Data pernikahan</h2>
        <FieldRow>
          <TextInput label="Mempelai pria" value={f.groom} onChange={on("groom")} required />
          <TextInput label="Mempelai wanita" value={f.bride} onChange={on("bride")} required />
        </FieldRow>
        <FieldRow>
          <TextInput label="Tanggal" type="date" value={f.date} onChange={on("date")} />
          <TextInput label="Lokasi" value={f.location} onChange={on("location")} />
        </FieldRow>
        <FieldRow>
          <MoneyInput label="Target dana (Rp)" value={f.target} onChange={on("target")} />
          <MoneyInput label="Saldo awal (Rp)" value={f.opening} onChange={on("opening")} />
        </FieldRow>
        <MoneyInput label="Batas anggaran rencana (Rp)" value={f.cap} onChange={on("cap")} hint="Dipakai untuk menghitung sisa anggaran rencana di Keuangan." />
        {bad && <p role="alert" className="text-meta text-danger">Nominal hanya boleh angka.</p>}
        <ErrorNote error={save.error} />
        <Button type="submit" className="w-full" disabled={save.isPending || bad || !form}>{save.isPending ? "Menyimpan…" : "Simpan perubahan"}</Button>
      </form>

      {role === "owner" && (
        <section className="space-y-3">
          <h2 className="text-lead font-semibold">Undang pasangan</h2>
          <Panel tone="soft">
            {(members.data?.length ?? 0) >= 2 ? (
              <p className="flex items-start gap-2"><Icon name="check" className="mt-0.5 text-daun" />Pasangan Anda sudah bergabung. Pernikahan ini sudah berisi 2 anggota.</p>
            ) : (
              <div className="space-y-3">
                <p>Kode berlaku 7 hari dan hanya bisa dipakai sekali. Maksimal 2 anggota.</p>
                {code && (
                  <div className="space-y-3" aria-live="polite">
                    <p className="display num rounded-ctl bg-surface px-4 py-4 text-center text-head tracking-[0.18em]">{code}</p>
                    <p className="text-meta text-muted">Berlaku sampai {expires ? formatShortDate(expires) : "7 hari lagi"}. Kode hanya ditampilkan sekarang.</p>
                    <div className="grid gap-2">
                      <Button variant="secondary" onClick={() => copy("kode", code)}><Icon name={copied === "kode" ? "check" : "copy"} size={18} />{copied === "kode" ? "Kode tersalin" : "Salin kode"}</Button>
                      <Button variant="secondary" onClick={() => copy("tautan", link(code))}><Icon name={copied === "tautan" ? "check" : "link"} size={18} />{copied === "tautan" ? "Tautan tersalin" : "Salin tautan undangan"}</Button>
                      <a className="inline-flex min-h-11 items-center justify-center rounded-ctl bg-ink px-5 font-semibold text-surface" target="_blank" rel="noopener noreferrer"
                        href={`https://wa.me/?text=${encodeURIComponent(`Ayo gabung di Planikah kita! Buka ${link(code)} (kode: ${code}).`)}`}>Kirim lewat WhatsApp</a>
                    </div>
                  </div>
                )}
                <ErrorNote error={invite.error} />
                <Button variant={code ? "ghost" : "primary"} className="w-full" onClick={() => invite.mutate(undefined)} disabled={invite.isPending}>{code ? "Buat kode baru (kode lama hangus)" : "Buat kode undangan"}</Button>
              </div>
            )}
          </Panel>
        </section>
      )}

      <Button variant="danger" className="w-full" onClick={async () => { await supabase().auth.signOut(); qc.clear(); router.replace("/masuk"); }}><Icon name="logout" size={18} />Keluar</Button>
    </div>
  );
}
