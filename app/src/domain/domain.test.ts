import { describe, expect, it } from "vitest";
import { formatRupiah, parseRupiah } from "./money";
import { committedPrice, fundSummary, netPaid, paymentStatus, planRemaining, remainingBill } from "./finance";
import { duplicateNames, guestSummary, validateAttendance } from "./guests";
import { contributorTotals, nearestBills, nearestOpenTasks } from "./home";
import { daysUntil, jakartaDate } from "./dates";

describe("rupiah", () => {
  it("memformat rupiah utuh, negatif, dan kosong", () => {
    expect(formatRupiah(42_000_000)).toBe("Rp42.000.000");
    expect(formatRupiah(0)).toBe("Rp0");
    expect(formatRupiah(-100_000)).toBe("-Rp100.000");
    expect(formatRupiah(null)).toBe("—");
  });
  it("kosong berbeda dari nol saat mengurai", () => {
    expect(parseRupiah("")).toBeNull();
    expect(parseRupiah("0")).toBe(0);
    expect(parseRupiah("Rp 9.500.000")).toBe(9_500_000);
    expect(Number.isNaN(parseRupiah("1,5jt"))).toBe(true);
    expect(Number.isNaN(parseRupiah("-5"))).toBe(true);
  });
});

describe("keuangan (angka spreadsheet)", () => {
  const deposits = [20_000_000, 2_500_000, 2_500_000, 2_500_000, 2_000_000, 12_500_000];
  it("dana terkumpul 42 jt = 42% dari target 100 jt", () => {
    const s = fundSummary({ openingBalance: 0, deposits, otherWithdrawals: [], fundPayments: [], refundsReceived: [], target: 100_000_000 });
    expect(s.collected).toBe(42_000_000);
    expect(s.progress).toBeCloseTo(0.42);
    expect(s.shortfall).toBe(58_000_000);
  });
  it("batang progres dibatasi 100% tetapi angka aslinya tidak", () => {
    const s = fundSummary({ openingBalance: 0, deposits: [150], otherWithdrawals: [], fundPayments: [], refundsReceived: [], target: 100 });
    expect(s.progress).toBe(1.5);
    expect(s.progressBar).toBe(1);
  });
  it("saldo tersedia: refund hanya dihitung bila sudah diterima; boleh negatif", () => {
    const base = { openingBalance: 1_000, deposits: [9_000], otherWithdrawals: [500], target: null };
    expect(fundSummary({ ...base, fundPayments: [3_000], refundsReceived: [] }).available).toBe(6_500);
    expect(fundSummary({ ...base, fundPayments: [3_000], refundsReceived: [200] }).available).toBe(6_700);
    expect(fundSummary({ ...base, fundPayments: [20_000], refundsReceived: [] }).available).toBe(-10_500);
    expect(fundSummary({ ...base, fundPayments: [], refundsReceived: [] }).progress).toBeNull();
  });
  it("harga komitmen: final menggantikan estimasi; kosong tetap kosong", () => {
    expect(committedPrice(9_500_000, null)).toBe(9_500_000);
    expect(committedPrice(9_500_000, 9_000_000)).toBe(9_000_000);
    expect(committedPrice(9_500_000, 0)).toBe(0);
    expect(committedPrice(null, null)).toBeNull();
  });
  it("status & sisa tagihan venue 9,5 jt", () => {
    expect(paymentStatus(9_500_000, 0)).toBe("belum_dibayar");
    expect(paymentStatus(9_500_000, 3_500_000)).toBe("dp");
    expect(remainingBill(9_500_000, 3_500_000)).toBe(6_000_000);
    expect(paymentStatus(9_500_000, 9_500_000)).toBe("lunas");
    expect(paymentStatus(9_500_000, 9_600_000)).toBe("kelebihan_bayar");
    expect(remainingBill(9_500_000, 9_600_000)).toBe(-100_000);
    expect(paymentStatus(null, 50_000)).toBe("dp");
    expect(remainingBill(null, 0)).toBeNull();
  });
  it("refund mengurangi pembayaran bersih; yang dibatalkan diabaikan", () => {
    expect(netPaid([
      { type: "payment", amount: 9_600_000 },
      { type: "refund", amount: 100_000 },
      { type: "payment", amount: 777, cancelled: true },
    ])).toBe(9_500_000);
  });
  it("sisa anggaran rencana", () => {
    expect(planRemaining(69_715_000, 31_250_000)).toBe(38_465_000);
    expect(planRemaining(69_715_000, 70_000_000)).toBe(-285_000);
    expect(planRemaining(null, 1)).toBeNull();
  });
});

describe("tamu", () => {
  it("validasi kehadiran", () => {
    expect(validateAttendance({ invitedCount: 2, confirmedCount: 2, rsvp: "attending" })).toBeNull();
    expect(validateAttendance({ invitedCount: 2, confirmedCount: 3, rsvp: "attending" })).toMatch(/melebihi/);
    expect(validateAttendance({ invitedCount: 2, confirmedCount: -1, rsvp: "attending" })).not.toBeNull();
    expect(validateAttendance({ invitedCount: null, confirmedCount: 4, rsvp: "attending" })).toBeNull();
    expect(validateAttendance({ invitedCount: 2, confirmedCount: 1, rsvp: "declined" })).not.toBeNull();
    expect(validateAttendance({ invitedCount: 2, confirmedCount: 0, rsvp: "declined" })).toBeNull();
    expect(validateAttendance({ invitedCount: 2, confirmedCount: null, rsvp: "pending" })).toBeNull();
  });
  it("242 undangan tanpa headcount = 242 undangan, headcount ditandai belum lengkap", () => {
    const g = Array.from({ length: 242 }, () => ({ invitedCount: null, confirmedCount: null, invitationSent: false, rsvp: "pending" as const }));
    const s = guestSummary(g);
    expect(s.invitations).toBe(242);
    expect(s.invitedHeadcount).toBe(0);
    expect(s.missingHeadcount).toBe(242);
    expect(s.headcountComplete).toBe(false);
    expect(s.confirmedHeadcount).toBe(0);
  });
  it("headcount sebagian terisi", () => {
    const s = guestSummary([
      { invitedCount: 2, confirmedCount: 2, invitationSent: true, rsvp: "attending" },
      { invitedCount: 3, confirmedCount: 0, invitationSent: true, rsvp: "declined" },
      { invitedCount: null, confirmedCount: null, invitationSent: false, rsvp: "pending" },
    ]);
    expect(s).toMatchObject({ invitations: 3, invitationsSent: 2, invitedHeadcount: 5, missingHeadcount: 1,
      confirmedHeadcount: 2, attendingInvitations: 1, declinedInvitations: 1, pendingInvitations: 1 });
  });
});

describe("tanggal Asia/Jakarta", () => {
  it("321 hari menuju 28 Agustus 2027 dari 11 Oktober 2026", () => {
    expect(daysUntil("2027-08-28", new Date("2026-10-11T08:00:00Z"))).toBe(321);
  });
  it("memakai kalender Jakarta, bukan UTC", () => {
    // 23:30 UTC tanggal 10 = 06:30 Jakarta tanggal 11
    expect(jakartaDate(new Date("2026-10-10T23:30:00Z"))).toBe("2026-10-11");
    expect(daysUntil("2026-10-12", new Date("2026-10-10T23:30:00Z"))).toBe(1);
  });
});

import { isOverdue, matchesFilter, taskProgress } from "./tasks";

describe("tugas", () => {
  const t = (o: Partial<{ done: boolean; deadline: string | null; assigneeId: string | null; archived: boolean }> = {}) => ({ done: false, deadline: null, assigneeId: null, ...o });
  it("progres memakai tugas aktif saja; arsip tidak masuk denominator", () => {
    expect(taskProgress([t({ done: true }), t(), t({ archived: true, done: true }), t({ archived: true })])).toEqual({ done: 1, total: 2, ratio: 0.5 });
  });
  it("tanpa tugas -> belum ada tugas, bukan 0%", () => {
    expect(taskProgress([]).ratio).toBeNull();
    expect(taskProgress([t({ archived: true })]).ratio).toBeNull();
  });
  it("terlambat & filter", () => {
    expect(isOverdue(t({ deadline: "2026-10-10" }), "2026-10-11")).toBe(true);
    expect(isOverdue(t({ deadline: "2026-10-11" }), "2026-10-11")).toBe(false);
    expect(isOverdue(t({ deadline: "2026-10-10", done: true }), "2026-10-11")).toBe(false);
    expect(matchesFilter(t({ assigneeId: "me" }), "mine", "me", "2026-10-11")).toBe(true);
    expect(matchesFilter(t({ assigneeId: "other" }), "mine", "me", "2026-10-11")).toBe(false);
    expect(matchesFilter(t({ archived: true, done: true }), "done", "me", "2026-10-11")).toBe(false);
  });
});

describe("beranda & kontributor", () => {
  const T = (id: string, deadline: string | null, done = false) => ({ id, title: id, deadline, done });
  it("tugas terdekat: terlambat dahulu, tanpa tenggat dan selesai tidak ikut, maksimal 3", () => {
    const r = nearestOpenTasks([T("c", "2026-12-01"), T("a", "2026-10-01"), T("x", null), T("d", "2026-10-05", true), T("b", "2026-11-01"), T("e", "2027-01-01")]);
    expect(r.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
  it("tagihan terdekat: hanya yang masih ada sisa dan punya jatuh tempo", () => {
    const B = (id: string, dueDate: string | null, remaining: number | null) => ({ id, name: id, dueDate, remaining });
    expect(nearestBills([B("lunas", "2026-10-01", 0), B("lebih", "2026-10-02", -5), B("kosong", "2026-10-03", null), B("tanpa", null, 100), B("b", "2026-12-01", 100), B("a", "2026-11-01", 50)]).map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("setoran per kontributor digabung tanpa peduli huruf besar/kecil", () => {
    expect(contributorTotals([{ contributor: "Adi", amount: 10 }, { contributor: " adi ", amount: 5 }, { contributor: "Sari", amount: 20 }])).toEqual([{ name: "Sari", total: 20 }, { name: "Adi", total: 15 }]);
  });
  it("hadir tanpa jumlah valid dan terhitung; nama ganda hanya peringatan", () => {
    expect(validateAttendance({ invitedCount: 2, confirmedCount: null, rsvp: "attending" })).toBeNull();
    expect(guestSummary([{ invitedCount: 2, confirmedCount: null, invitationSent: true, rsvp: "attending" }]).attendingWithoutCount).toBe(1);
    expect([...duplicateNames(["Tamu  Satu", "tamu satu", "Lain"])]).toEqual(["tamu satu"]);
  });
});
