"use client";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { isConfigured, supabase } from "./supabase";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true, refetchOnReconnect: true } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const TABLES = ["weddings", "deposits", "fund_withdrawals", "budget_items", "payments", "cash_flow_entries", "vendors", "prep_tasks", "guests"] as const;

/** Realtime per wedding: setiap perubahan hanya menandai data basi, lalu diambil ulang dari server. */
export function useRealtimeInvalidation(weddingId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!weddingId || !isConfigured) return;
    const sb = supabase();
    let ch = sb.channel(`wedding-${weddingId}`);
    for (const t of TABLES) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: t === "weddings" ? `id=eq.${weddingId}` : `wedding_id=eq.${weddingId}` },
        () => { void qc.invalidateQueries(); });
    }
    ch.subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") void qc.invalidateQueries(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); void sb.removeChannel(ch); };
  }, [weddingId, qc]);
}
