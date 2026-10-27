import type { Rupiah } from "./money";

export type PaymentStatus = "belum_dibayar" | "dp" | "lunas" | "kelebihan_bayar";

export interface PaymentRecord {
  type: "payment" | "refund";
  amount: Rupiah;
  cancelled?: boolean;
}

/** Harga item = harga final bila ada, jika tidak estimasi lama (kolom legacy). Keduanya kosong -> null. */
export function committedPrice(estimated: Rupiah | null, final: Rupiah | null): Rupiah | null {
  return final ?? estimated;
}

/** Pembayaran bersih = pembayaran − refund (yang dibatalkan diabaikan). */
export function netPaid(payments: readonly PaymentRecord[]): Rupiah {
  return payments
    .filter((p) => !p.cancelled)
    .reduce((sum, p) => sum + (p.type === "payment" ? p.amount : -p.amount), 0);
}

export function paymentStatus(committed: Rupiah | null, paid: Rupiah): PaymentStatus {
  if (paid === 0) return "belum_dibayar";
  if (committed === null) return "dp";
  if (paid > committed) return "kelebihan_bayar";
  if (paid === committed) return "lunas";
  return "dp";
}

/** Sisa tagihan = harga item − dibayar. Boleh negatif (kelebihan bayar). Kosong -> null. */
export function remainingBill(committed: Rupiah | null, paid: Rupiah): Rupiah | null {
  return committed === null ? null : committed - paid;
}

export interface FundInputs {
  openingBalance: Rupiah;
  /** setoran aktif */
  deposits: readonly Rupiah[];
  /** penarikan dana di luar pembayaran item */
  otherWithdrawals: readonly Rupiah[];
  /** pembayaran dari dana pernikahan (aktif) */
  fundPayments: readonly Rupiah[];
  /** refund dari dana pernikahan yang SUDAH diterima */
  refundsReceived: readonly Rupiah[];
  target: Rupiah | null;
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

export function fundSummary(i: FundInputs) {
  const collected = i.openingBalance + sum(i.deposits);
  const available =
    i.openingBalance + sum(i.deposits) - sum(i.otherWithdrawals) - sum(i.fundPayments) + sum(i.refundsReceived);
  const progress = i.target && i.target > 0 ? collected / i.target : null;
  return {
    collected,
    available,
    progress,
    /** batang progres dibatasi 100%, angka aslinya tetap bisa > 100% */
    progressBar: progress === null ? 0 : Math.min(progress, 1),
    shortfall: i.target === null ? null : Math.max(i.target - collected, 0),
  };
}

/** Sisa dari batas anggaran = batas anggaran − total biaya. Negatif = melebihi rencana. */
export function planRemaining(budgetCap: Rupiah | null, totalCommitted: Rupiah): Rupiah | null {
  return budgetCap === null ? null : budgetCap - totalCommitted;
}

/** Sisa dana kalau semua tagihan dilunasi = saldo tersedia − sisa tagihan. Negatif = dana kurang. */
export function balanceAfterSettled(available: Rupiah, outstanding: Rupiah): Rupiah {
  return available - outstanding;
}
