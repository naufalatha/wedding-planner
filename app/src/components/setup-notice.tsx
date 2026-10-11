import { Card } from "./ui";

export function SetupNotice() {
  return (
    <main className="mx-auto max-w-md p-5 pt-16">
      <Card tone="lavender">
        <h1 className="text-2xl font-bold">Supabase belum dikonfigurasi</h1>
        <p className="mt-2 text-sm">
          Salin <code>.env.example</code> menjadi <code>.env.local</code>, isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, lalu jalankan ulang aplikasi. Langkah lengkap ada di README.
        </p>
      </Card>
    </main>
  );
}
