"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as api from "./api";
import { isConfigured, supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isConfigured);
  useEffect(() => {
    if (!isConfigured) return;
    const sb = supabase();
    void sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export const useMembership = (enabled: boolean) => useQuery({ queryKey: ["membership"], queryFn: api.getMembership, enabled, staleTime: Infinity });

export function useWeddingData(w: string, enabled = true) {
  const on = { enabled: enabled && w !== "" };
  return {
    wedding: useQuery({ queryKey: ["wedding", w], queryFn: () => api.getWedding(w), ...on }),
    summary: useQuery({ queryKey: ["summary", w], queryFn: () => api.financeSummary(w), ...on }),
    deposits: useQuery({ queryKey: ["deposits", w], queryFn: () => api.listDeposits(w), ...on }),
    withdrawals: useQuery({ queryKey: ["withdrawals", w], queryFn: () => api.listWithdrawals(w), ...on }),
    items: useQuery({ queryKey: ["items", w], queryFn: () => api.listItems(w), ...on }),
    payments: useQuery({ queryKey: ["payments", w], queryFn: () => api.listPayments(w), ...on }),
    vendors: useQuery({ queryKey: ["vendors", w], queryFn: () => api.listVendors(w), ...on }),
    tasks: useQuery({ queryKey: ["tasks", w], queryFn: () => api.listTasks(w), ...on }),
    guests: useQuery({ queryKey: ["guests", w], queryFn: () => api.listGuests(w), ...on }),
    members: useQuery({ queryKey: ["members", w], queryFn: () => api.listMembers(w), ...on }),
  };
}

/** Mutasi online-first: tanpa saldo optimistis; setelah sukses semua data diambil ulang dari server. */
export function useAction<A, R = void>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}
