"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SetupNotice } from "@/components/setup-notice";
import { Button, ErrorNote, TextInput } from "@/components/ui";
import { isConfigured, supabase } from "@/lib/supabase";

export default function Masuk() {
  const router = useRouter();
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState<string | null>(null);
  if (!isConfigured) return <SetupNotice />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      const sb = supabase();
      if (mode === "masuk") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/beranda");
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) router.replace("/beranda");
        else setInfo("Akun dibuat. Periksa email Anda untuk konfirmasi, lalu masuk.");
      }
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-lime text-2xl" aria-hidden>💍</div>
        <h1 className="text-4xl font-extrabold tracking-tight">Wedding Planner</h1>
        <p className="mt-2 text-muted">Rencanakan pernikahan berdua, sederhana dan rapi.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <TextInput label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextInput label="Kata sandi" type="password" required minLength={8} autoComplete={mode === "masuk" ? "current-password" : "new-password"}
          hint={mode === "daftar" ? "Minimal 8 karakter." : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
        <ErrorNote error={error} />
        {info && <p role="status" className="rounded-input bg-mint-soft p-3 text-sm">{info}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memproses…" : mode === "masuk" ? "Masuk" : "Buat akun"}</Button>
      </form>
      <button className="mt-4 min-h-12 text-sm text-muted underline" onClick={() => { setMode(mode === "masuk" ? "daftar" : "masuk"); setError(null); }}>
        {mode === "masuk" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
      </button>
    </main>
  );
}
