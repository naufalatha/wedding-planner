import { Panel } from "./ui";

export function SetupNotice() {
  return (
    <main className="mx-auto max-w-md p-5 pt-16">
      <Panel tone="kunyit">
        <h1 className="display text-title">Supabase belum dikonfigurasi</h1>
        <p className="mt-2">
          Salin <code>.env.example</code> menjadi <code>.env.local</code>, isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, lalu jalankan ulang aplikasi. Langkah lengkap ada di README.
        </p>
      </Panel>
    </main>
  );
}
