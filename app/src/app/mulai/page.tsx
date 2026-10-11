"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, ErrorNote, Loading, TextInput } from "@/components/ui";
import { createWedding, redeemInvitation } from "@/lib/api";
import { useMembership, useSession } from "@/lib/hooks";
import { parseRupiah } from "@/domain/money";

export default function Mulai() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session, ready } = useSession();
  const membership = useMembership(Boolean(session));
  const [tab, setTab] = useState<"buat" | "gabung">("buat");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [f, setF] = useState({ groom: "", bride: "", date: "", location: "", target: "", opening: "", cap: "", code: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (ready && !session) router.replace("/masuk");
    if (membership.data) router.replace("/beranda");
  }, [ready, session, membership.data, router]);
  if (!ready || membership.isLoading || membership.data) return <Loading />;

  const money = (s: string) => parseRupiah(s);
  const bad = (s: string) => s !== "" && Number.isNaN(money(s));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await qc.invalidateQueries(); router.replace("/beranda"); } catch (e) { setError(e); } finally { setBusy(false); }
  }
  const create = (e: FormEvent) => { e.preventDefault(); void run(() => createWedding({
    groom: f.groom.trim(), bride: f.bride.trim(), date: f.date || null, location: f.location.trim() || null,
    target: money(f.target), opening: money(f.opening) ?? 0, cap: money(f.cap),
  })); };
  const join = (e: FormEvent) => { e.preventDefault(); void run(() => redeemInvitation(f.code)); };

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Mulai</h1>
      <p className="mb-6 mt-1 text-muted">Buat pernikahan baru, atau gabung dengan kode dari pasangan.</p>
      <div className="mb-6 grid grid-cols-2 gap-2">
        {(["buat", "gabung"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null); }} aria-pressed={tab === t}
            className={`min-h-12 rounded-full text-sm font-medium ${tab === t ? "bg-ink text-surface" : "bg-surface border border-line"}`}>
            {t === "buat" ? "Buat baru" : "Punya kode"}
          </button>
        ))}
      </div>
      {tab === "buat" ? (
        <form onSubmit={create} className="space-y-4">
          <TextInput label="Nama mempelai pria" required value={f.groom} onChange={set("groom")} />
          <TextInput label="Nama mempelai wanita" required value={f.bride} onChange={set("bride")} />
          <TextInput label="Tanggal pernikahan" type="date" value={f.date} onChange={set("date")} hint="Boleh dikosongkan dulu." />
          <TextInput label="Lokasi" value={f.location} onChange={set("location")} />
          <TextInput label="Target dana (Rp)" inputMode="numeric" value={f.target} onChange={set("target")} error={bad(f.target) ? "Hanya angka." : null} />
          <TextInput label="Saldo awal (Rp)" inputMode="numeric" value={f.opening} onChange={set("opening")} error={bad(f.opening) ? "Hanya angka." : null} hint="Kosong dianggap Rp0." />
          <TextInput label="Batas anggaran rencana (Rp)" inputMode="numeric" value={f.cap} onChange={set("cap")} error={bad(f.cap) ? "Hanya angka." : null} />
          <ErrorNote error={error} />
          <Button type="submit" className="w-full" disabled={busy || bad(f.target) || bad(f.opening) || bad(f.cap)}>{busy ? "Menyimpan…" : "Buat pernikahan"}</Button>
        </form>
      ) : (
        <form onSubmit={join} className="space-y-4">
          <Card tone="mint"><p className="text-sm">Minta pasangan membuka <b>Akun</b> → <b>Undang pasangan</b>. Kodenya berlaku 7 hari dan hanya bisa dipakai sekali.</p></Card>
          <TextInput label="Kode undangan" required autoCapitalize="characters" value={f.code} onChange={set("code")} />
          <ErrorNote error={error} />
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memeriksa…" : "Gabung"}</Button>
        </form>
      )}
    </main>
  );
}
