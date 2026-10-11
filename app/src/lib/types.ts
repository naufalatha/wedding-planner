export interface Wedding {
  id: string; groom_name: string; bride_name: string; wedding_date: string | null; location: string | null;
  target_amount: number | null; opening_balance: number; budget_cap: number | null; revision: number;
}
export interface Deposit { id: string; wedding_id: string; contributor: string; amount: number; deposited_on: string; note: string | null; revision: number; cancelled_at: string | null; cancel_reason: string | null }
export interface Withdrawal { id: string; wedding_id: string; amount: number; withdrawn_on: string; note: string | null; revision: number; cancelled_at: string | null; cancel_reason: string | null }
export type Section = "paperwork" | "seserahan" | "vendor" | "other";
export interface BudgetItem { id: string; wedding_id: string; section: Section; category: string | null; name: string; estimated_price: number | null; final_price: number | null; due_date: string | null; notes: string | null; revision: number; cancelled_at: string | null }
export interface BudgetItemStatusRow { budget_item_id: string; wedding_id: string; section: Section; category: string | null; name: string; estimated_price: number | null; final_price: number | null; vendor_id: string | null; committed_price: number | null; paid_amount: number; remaining: number | null; status: "belum_dibayar" | "dp" | "lunas" | "kelebihan_bayar"; due_date: string | null }
export interface Payment { id: string; wedding_id: string; budget_item_id: string; type: "payment" | "refund"; parent_payment_id: string | null; amount: number; paid_on: string; funding_source: "wedding_fund" | "separate"; refund_received: boolean; note: string | null; cancelled_at: string | null; cancel_reason: string | null }
export interface Vendor { id: string; wedding_id: string; category: string; name: string; status: "candidate" | "selected" | "rejected"; contact: string | null; price_quote: number | null; notes: string | null; package: string | null; link: string | null; revision: number }
export type Phase = "12plus" | "6to12" | "3to6" | "1to3" | "1to2w" | "1w" | "1d" | "dday";
export interface PrepTask { id: string; wedding_id: string; title: string; phase: Phase; done: boolean; deadline: string | null; assignee_id: string | null; priority: "normal" | "high" | null; notes: string | null; revision: number }
export interface Member { user_id: string; role: "owner" | "partner" }
export interface Guest { id: string; wedding_id: string; name: string; tag: string | null; invited_count: number | null; confirmed_count: number | null; invitation_sent: boolean; rsvp: "pending" | "attending" | "declined"; phone: string | null; email: string | null; notes: string | null; revision: number }
export interface FinanceSummary { collected: number; target: number | null; funding_progress: number | null; available_balance: number; total_estimated: number; total_committed: number; total_paid: number; outstanding: number; plan_remaining: number | null; unpriced_count: number; estimate_based_count: number }
