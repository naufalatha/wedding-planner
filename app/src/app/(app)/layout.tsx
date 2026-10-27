"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { SetupNotice } from "@/components/setup-notice";
import { cx, ErrorNote, Icon, Loading, Logo, type IconName } from "@/components/ui";
import { useMembership, useSession, useWeddingData } from "@/lib/hooks";
import { useRealtimeInvalidation } from "@/lib/query";
import { isConfigured } from "@/lib/supabase";
import { WeddingProvider } from "@/lib/wedding-context";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/beranda", label: "Beranda", icon: "home" },
  { href: "/keuangan", label: "Keuangan", icon: "wallet" },
  { href: "/persiapan", label: "Persiapan", icon: "tasks" },
  { href: "/vendor", label: "Vendor", icon: "store" },
  { href: "/tamu", label: "Tamu", icon: "users" },
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
      {/* Layar lebar: rel samping. Ponsel: bilah bawah. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-line bg-surface px-3 py-6 md:flex">
        <Link href="/beranda" className="mb-8 flex items-center gap-2.5 px-2"><Logo size={32} /><span className="display text-title">Planikah</span></Link>
        <nav aria-label="Menu samping" className="flex-1">
          <ul className="space-y-1">
            {NAV.map((n) => {
              const active = path.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={active ? "page" : undefined}
                    className={cx("flex min-h-11 items-center gap-3 rounded-ctl px-3", active ? "bg-indigo-soft font-semibold text-indigo" : "text-muted hover:bg-paper")}>
                    <Icon name={n.icon} />{n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link href="/akun" aria-current={path.startsWith("/akun") ? "page" : undefined}
          className={cx("flex min-h-11 items-center gap-3 rounded-ctl px-3", path.startsWith("/akun") ? "bg-indigo-soft font-semibold text-indigo" : "text-muted hover:bg-paper")}>
          <Icon name="user" /><span className="min-w-0 truncate">Akun</span>
        </Link>
      </aside>

      <div className="min-h-dvh md:pl-56">
        <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 md:max-w-3xl md:px-6 md:pb-12 md:pt-8">{children}</div>
      </div>

      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={active ? "page" : undefined}
                  className={cx("relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 pt-1 text-[12px] leading-4", active ? "font-semibold text-indigo" : "text-muted")}>
                  {active && <span aria-hidden className="absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-kunyit" />}
                  <Icon name={n.icon} size={22} />
                  <span>{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </WeddingProvider>
  );
}
