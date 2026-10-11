import { ConflictError } from "./errors";
import { supabase } from "./supabase";
import type {
  BudgetItem, Member, BudgetItemStatusRow, Deposit, FinanceSummary, Guest, Payment, PrepTask, Vendor, Wedding, Withdrawal,
} from "./types";

type Table = "weddings" | "deposits" | "fund_withdrawals" | "budget_items" | "vendors" | "prep_tasks" | "guests";

async function rows<T>(q: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getMembership(): Promise<{ wedding_id: string; role: "owner" | "partner" } | null> {
  const { data, error } = await supabase().from("wedding_members").select("wedding_id, role").limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
export async function getWedding(id: string): Promise<Wedding> {
  const { data, error } = await supabase().from("weddings").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Wedding;
}
export const listDeposits = (w: string) => rows<Deposit>(supabase().from("deposits").select("*").eq("wedding_id", w).is("cancelled_at", null).order("deposited_on", { ascending: false }));
export const listWithdrawals = (w: string) => rows<Withdrawal>(supabase().from("fund_withdrawals").select("*").eq("wedding_id", w).is("cancelled_at", null).order("withdrawn_on", { ascending: false }));
export const listItems = (w: string) => rows<BudgetItemStatusRow>(supabase().from("budget_item_status").select("*").eq("wedding_id", w).order("section").order("name"));
export const getItem = async (id: string) => {
  const { data, error } = await supabase().from("budget_items").select("*").eq("id", id).single();
  if (error) throw error;
  return data as BudgetItem;
};
export const listPayments = (w: string) => rows<Payment>(supabase().from("payments").select("*").eq("wedding_id", w).is("cancelled_at", null).order("paid_on", { ascending: false }));
export const listVendors = (w: string) => rows<Vendor>(supabase().from("vendors").select("*").eq("wedding_id", w).is("archived_at", null).order("category").order("name"));
export const listTasks = (w: string) => rows<PrepTask>(supabase().from("prep_tasks").select("*").eq("wedding_id", w).is("archived_at", null).order("created_at"));
export const listGuests = (w: string) => rows<Guest>(supabase().from("guests").select("*").eq("wedding_id", w).is("archived_at", null).order("created_at").limit(2000));
export const listMembers = (w: string) => rows<Member>(supabase().from("wedding_members").select("user_id, role").eq("wedding_id", w));
export async function financeSummary(w: string): Promise<FinanceSummary> {
  const { data, error } = await supabase().rpc("finance_summary", { p_wedding: w });
  if (error) throw error;
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, string | number | null>;
  const n = (v: string | number | null) => (v === null || v === undefined ? null : Number(v));
  return {
    collected: Number(r.collected), target: n(r.target), funding_progress: n(r.funding_progress),
    available_balance: Number(r.available_balance), total_estimated: Number(r.total_estimated), total_committed: Number(r.total_committed),
    total_paid: Number(r.total_paid), outstanding: Number(r.outstanding), plan_remaining: n(r.plan_remaining),
    unpriced_count: Number(r.unpriced_count), estimate_based_count: Number(r.estimate_based_count),
  };
}

/** Compare-and-set: gagal dengan ConflictError bila revisi sudah berubah di tempat lain. */
export async function updateRow(table: Table, id: string, revision: number, patch: Record<string, unknown>) {
  const { data, error } = await supabase().from(table).update(patch).eq("id", id).eq("revision", revision).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new ConflictError();
}
export async function insertRow(table: Table, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase().from(table).insert(row).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}
/** Pilih vendor: kandidat terpilih sebelumnya kembali jadi kandidat dalam satu transaksi. */
export async function selectVendor(wedding: string, vendor: string) {
  const { error } = await supabase().rpc("select_vendor", { p_wedding: wedding, p_vendor: vendor });
  if (error) throw error;
}
/** Arsip (bukan hapus permanen): baris tersembunyi dari daftar dan tidak dihitung di ringkasan. */
export async function archiveRow(table: "vendors" | "prep_tasks" | "guests", id: string, revision: number) {
  await updateRow(table, id, revision, { archived_at: new Date().toISOString() });
}

export async function recordPayment(a: {
  wedding: string; requestId: string; item: string; type: "payment" | "refund"; amount: number; paidOn: string;
  funding: "wedding_fund" | "separate"; parent?: string | null; note?: string | null;
}): Promise<string> {
  const { data, error } = await supabase().rpc("record_payment", {
    p_wedding: a.wedding, p_request_id: a.requestId, p_item: a.item, p_type: a.type, p_amount: a.amount,
    p_paid_on: a.paidOn, p_funding: a.funding, p_parent: a.parent ?? null, p_note: a.note ?? null,
  });
  if (error) throw error;
  return data as string;
}
export async function markRefundReceived(wedding: string, payment: string) {
  const { error } = await supabase().rpc("mark_refund_received", { p_wedding: wedding, p_payment: payment });
  if (error) throw error;
}
export async function cancelRecord(wedding: string, kind: "deposit" | "withdrawal" | "payment" | "budget_item", id: string, reason: string) {
  const { error } = await supabase().rpc("cancel_record", { p_wedding: wedding, p_kind: kind, p_id: id, p_reason: reason });
  if (error) throw error;
}
export async function createWedding(a: { groom: string; bride: string; date: string | null; location: string | null; target: number | null; opening: number; cap: number | null }) {
  const { data, error } = await supabase().rpc("create_wedding", {
    p_groom: a.groom, p_bride: a.bride, p_date: a.date, p_location: a.location, p_target: a.target, p_opening: a.opening, p_budget_cap: a.cap,
  });
  if (error) throw error;
  return data as string;
}
export async function createInvitation(wedding: string): Promise<string> {
  const { data, error } = await supabase().rpc("create_invitation", { p_wedding: wedding });
  if (error) throw error;
  return data as string;
}
export async function redeemInvitation(code: string): Promise<string> {
  const { data, error } = await supabase().rpc("redeem_invitation", { p_code: code });
  if (error) throw error;
  return data as string;
}
