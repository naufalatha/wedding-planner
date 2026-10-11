"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { SetupNotice } from "@/components/setup-notice";
import { cx, ErrorNote, Loading } from "@/components/ui";
import { useMembership, useSession, useWeddingData } from "@/lib/hooks";
import { useRealtimeInvalidation } from "@/lib/query";
import { isConfigured } from "@/lib/supabase";
import { WeddingProvider } from "@/lib/wedding-context";

const NAV = [
  { href: "/beranda", label: "Beranda", d: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/keuangan", label: "Keuangan", d: "M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2" },
  { href: "/persiapan", label: "Persiapan", d: "M5 4h14v16H5zM9 9l2 2 4-4M9 15h6" },
  { href: "/vendor", label: "Vendor", d: "M4 9l2-5h12l2 5M4 9v11h16V9M4 9h16M10 20v-6h4v6" },
  { href: "/tamu", label: "Tamu", d: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21c0-4 4-6 8-6s8 2 8 6" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { session, ready } = useSession();
  const membership = useMembership(Boolean(session));
  const weddingId = membership.data?.wedding_id;
  useRealtimeInvalidation(weddingId);
  // Muat semua data sekali di sini dan jaga tetap aktif; halaman membaca dari cache sehingga pindah menu instan.
  useWeddingData(weddingId ?? "", Boolean(weddingId));

  useEffect(() => {
    if (!isConfigured) return;
    if (ready && !session) router.replace("/masuk");
    else if (membership.isSuccess && !membership.data) router.replace("/mulai");
  }, [ready, session, membership.isSuccess, membership.data, router]);

  if (!isConfigured) return <SetupNotice />;
  if (membership.isError) return <div className="p-5"><ErrorNote error={membership.error} /></div>;
  if (!ready || !session || membership.isLoading || !membership.data) return <Loading />;

  return (
    <WeddingProvider value={{ weddingId: membership.data.wedding_id, role: membership.data.role, email: session.user.email ?? "", userId: session.user.id }}>
      <div key={path} className="page-in mx-auto min-h-dvh max-w-2xl px-5 pb-28 pt-6">{children}</div>
      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={active ? "page" : undefined} className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px]">
                  <span className={cx("grid h-7 w-[min(3rem,100%)] place-items-center rounded-full", active && "bg-accent")}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={n.d} /></svg>
                  </span>
                  <span className={active ? "font-semibold" : "text-muted"}>{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </WeddingProvider>
  );
}
