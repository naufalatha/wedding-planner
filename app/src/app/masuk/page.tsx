"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SetupNotice } from "@/components/setup-notice";
import { Button, ErrorNote, Logo, TextInput } from "@/components/ui";
import { isConfigured, supabase } from "@/lib/supabase";

export default function Masuk() {
  const router = useRouter();
  const [mode, setMode] = useState<"masuk" | "daftar">(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("kode") ? "daftar" : "masuk"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState<string | null>(null);
  if (!isConfigured) return <SetupNotice />;
  const kode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("kode") : null;
  const after = kode ? `/mulai?kode=${encodeURIComponent(kode)}` : "/beranda";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      const sb = supabase();
      if (mode === "masuk") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(after);
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) router.replace(after);
        else setInfo("Akun dibuat. Periksa email Anda untuk konfirmasi, lalu masuk.");
      }
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      <div className="text-surface lg:flex lg:min-h-dvh lg:flex-col lg:justify-end lg:bg-indigo-deep">
        <div className="bg-indigo-deep px-5 pb-8 pt-12 lg:px-14 lg:pb-20">
          <Logo size={48} />
          <h1 className="display mt-6 text-name">Planikah</h1>
          <p className="mt-2 max-w-[30ch] text-lead text-surface/80">Dana, tugas, vendor, dan tamu pernikahan, dipegang berdua di satu tempat.</p>
        </div>
        <div aria-hidden className="tumpal lg:hidden" />
      </div>
      <div className="mx-auto w-full max-w-md px-5 py-8 lg:flex lg:flex-col lg:justify-center lg:py-12">
        {kode && <p className="mb-5 rounded-ctl bg-daun-soft p-3 text-meta">Anda diundang bergabung. Masuk atau buat akun, lalu kode undangan akan terisi otomatis.</p>}
        <h2 className="mb-4 text-title font-semibold">{mode === "masuk" ? "Masuk ke akun" : "Buat akun baru"}</h2>
        <form onSubmit={submit} className="space-y-4">
          <TextInput label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput label="Kata sandi" type="password" required minLength={8} autoComplete={mode === "masuk" ? "current-password" : "new-password"}
            hint={mode === "daftar" ? "Minimal 8 karakter." : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorNote error={error} />
          {info && <p role="status" className="rounded-ctl bg-daun-soft p-3 text-meta">{info}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Memproses…" : mode === "masuk" ? "Masuk" : "Buat akun"}</Button>
        </form>
        <button className="mx-auto mt-3 flex min-h-11 items-center px-3 text-meta text-muted" onClick={() => { setMode(mode === "masuk" ? "daftar" : "masuk"); setError(null); }}>
          {mode === "masuk" ? "Belum punya akun? " : "Sudah punya akun? "}<span className="ml-1 font-semibold text-indigo">{mode === "masuk" ? "Daftar" : "Masuk"}</span>
        </button>
      </div>
    </main>
  );
}
