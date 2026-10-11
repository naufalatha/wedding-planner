"use client";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { isConfigured, supabase } from "./supabase";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false, refetchOnReconnect: true } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Tabel yang berubah -> kunci query yang terdampak (bukan semuanya). */
const AFFECTS: Record<string, string[]> = {
  weddings: ["wedding", "summary"],
  deposits: ["deposits", "summary"],
  fund_withdrawals: ["withdrawals", "summary"],
  budget_items: ["items", "summary"],
  payments: ["payments", "items", "summary"],
  cash_flow_entries: ["summary"],
  vendors: ["vendors"],
  prep_tasks: ["tasks"],
  guests: ["guests"],
};

/** Realtime per wedding: perubahan menandai data basi lalu diambil ulang dari server (digabung per 300 ms). */
export function useRealtimeInvalidation(weddingId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!weddingId || !isConfigured) return;
    const sb = supabase();
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => { timer = undefined; for (const k of pending) void qc.invalidateQueries({ queryKey: [k] }); pending.clear(); };
    const mark = (table: string) => { for (const k of AFFECTS[table] ?? []) pending.add(k); timer ??= setTimeout(flush, 300); };
    let ch = sb.channel(`wedding-${weddingId}`);
    for (const t of Object.keys(AFFECTS)) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: t === "weddings" ? `id=eq.${weddingId}` : `wedding_id=eq.${weddingId}` }, () => mark(t));
    }
    ch.subscribe();
    // Kembali ke tab setelah lama tersembunyi: ambil ulang (realtime bisa terputus saat tab tidur).
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) { hiddenAt = 0; void qc.invalidateQueries(); }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); void sb.removeChannel(ch); };
  }, [weddingId, qc]);
}
