"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, ErrorNote, FieldRow, Loading, Logo, MoneyInput, Panel, Tabs, TextInput } from "@/components/ui";
import { createWedding, redeemInvitation } from "@/lib/api";
import { useMembership, useSession } from "@/lib/hooks";
import { parseRupiah } from "@/domain/money";

export default function Mulai() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session, ready } = useSession();
  const membership = useMembership(Boolean(session));
  const urlCode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("kode") ?? "" : "";
  const [tab, setTab] = useState<"buat" | "gabung">(urlCode ? "gabung" : "buat");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [f, setF] = useState({ groom: "", bride: "", date: "", location: "", target: "", opening: "", cap: "", code: urlCode });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (ready && !session) router.replace(urlCode ? `/masuk?kode=${encodeURIComponent(urlCode)}` : "/masuk");
    if (membership.data) router.replace("/beranda");
  }, [ready, session, membership.data, router, urlCode]);
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
    <main className="mx-auto max-w-md px-5 py-8">
      <Logo size={40} />
      <h1 className="display mt-5 text-head">Mulai</h1>
      <p className="mb-5 mt-1 text-muted">Buat pernikahan baru, atau gabung dengan kode dari pasangan.</p>
      <div className="mb-5"><Tabs label="Cara memulai" value={tab} onChange={(t) => { setTab(t); setError(null); }} items={[["buat", "Buat baru"], ["gabung", "Punya kode"]]} /></div>
      {tab === "buat" ? (
        <form onSubmit={create} className="space-y-4">
          <FieldRow>
            <TextInput label="Mempelai pria" required value={f.groom} onChange={set("groom")} />
            <TextInput label="Mempelai wanita" required value={f.bride} onChange={set("bride")} />
          </FieldRow>
          <TextInput label="Tanggal pernikahan" type="date" value={f.date} onChange={set("date")} hint="Boleh dikosongkan dulu." />
          <TextInput label="Lokasi" value={f.location} onChange={set("location")} />
          <FieldRow>
            <MoneyInput label="Target dana (Rp)" value={f.target} onChange={set("target")} error={bad(f.target) ? "Hanya angka." : null} />
            <MoneyInput label="Saldo awal (Rp)" value={f.opening} onChange={set("opening")} error={bad(f.opening) ? "Hanya angka." : null} />
          </FieldRow>
          <MoneyInput label="Batas anggaran rencana (Rp)" value={f.cap} onChange={set("cap")} error={bad(f.cap) ? "Hanya angka." : null} hint="Semua nominal boleh dikosongkan; saldo awal kosong dianggap Rp0." />
          <ErrorNote error={error} />
          <Button type="submit" className="w-full" disabled={busy || bad(f.target) || bad(f.opening) || bad(f.cap)}>{busy ? "Menyimpan…" : "Buat pernikahan"}</Button>
        </form>
      ) : (
        <form onSubmit={join} className="space-y-4">
          <Panel tone="soft"><p>Minta pasangan membuka <b>Akun</b>, lalu <b>Undang pasangan</b>. Kodenya berlaku 7 hari dan hanya bisa dipakai sekali.</p></Panel>
          <TextInput label="Kode undangan" required autoCapitalize="characters" autoComplete="off" spellCheck={false} className="display tracking-[0.18em]" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <ErrorNote error={error} />
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memeriksa…" : "Gabung"}</Button>
        </form>
      )}
    </main>
  );
}
