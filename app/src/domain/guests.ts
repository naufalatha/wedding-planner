export type Rsvp = "pending" | "attending" | "declined";

export interface GuestRecord {
  invitedCount: number | null; // opsional; tidak ada default 1
  confirmedCount: number | null;
  invitationSent: boolean;
  rsvp: Rsvp;
}

/** Validasi kehadiran: 0..jumlah diundang; "tidak hadir" selalu 0. Mengembalikan pesan galat atau null. */
export function validateAttendance(g: Pick<GuestRecord, "invitedCount" | "confirmedCount" | "rsvp">): string | null {
  if (g.rsvp === "declined") {
    return (g.confirmedCount ?? 0) === 0 ? null : "Tamu yang tidak hadir harus 0 orang.";
  }
  if (g.rsvp === "pending") return g.confirmedCount === null ? null : "RSVP belum dijawab, jumlah hadir harus kosong.";
  // Hadir tanpa jumlah boleh disimpan; ditampilkan sebagai "Jumlah hadir belum diisi".
  if (g.confirmedCount === null) return null;
  if (!Number.isInteger(g.confirmedCount) || g.confirmedCount < 0) {
    return "Jumlah hadir harus bilangan bulat 0 atau lebih.";
  }
  if (g.invitedCount !== null && g.confirmedCount > g.invitedCount) {
    return "Jumlah hadir tidak boleh melebihi jumlah diundang.";
  }
  return null;
}

export function guestSummary(guests: readonly GuestRecord[]) {
  const withCount = guests.filter((g) => g.invitedCount !== null);
  const invitedHeadcount = withCount.reduce((s, g) => s + (g.invitedCount as number), 0);
  const attending = guests.filter((g) => g.rsvp === "attending");
  return {
    /** satu baris = satu undangan/grup */
    invitations: guests.length,
    invitationsSent: guests.filter((g) => g.invitationSent).length,
    invitedHeadcount,
    /** jumlah undangan tanpa headcount -> total orang belum lengkap */
    missingHeadcount: guests.length - withCount.length,
    headcountComplete: withCount.length === guests.length,
    confirmedHeadcount: attending.reduce((s, g) => s + (g.confirmedCount ?? 0), 0),
    attendingInvitations: attending.length,
    attendingWithoutCount: attending.filter((g) => g.confirmedCount === null).length,
    declinedInvitations: guests.filter((g) => g.rsvp === "declined").length,
    pendingInvitations: guests.filter((g) => g.rsvp === "pending").length,
  };
}

/** Nama yang sama (tanpa membedakan huruf besar/kecil dan spasi). Hanya peringatan, tidak pernah menggabungkan. */
export function duplicateNames(names: readonly string[]): Set<string> {
  const norm = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
  const seen = new Map<string, number>();
  for (const n of names) seen.set(norm(n), (seen.get(norm(n)) ?? 0) + 1);
  return new Set([...seen].filter(([, c]) => c > 1).map(([k]) => k));
}
