"use client";
import { useMemo, useState } from "react";
import { Button, Card, Chip, Empty, ErrorNote, SelectInput, Sheet, TextInput, useConfirm, ListSkeleton } from "@/components/ui";
import { duplicateNames, guestSummary, validateAttendance, type Rsvp } from "@/domain/guests";
import { archiveRow, insertRow, updateRow } from "@/lib/api";
import { useAction, useWeddingData } from "@/lib/hooks";
import type { Guest } from "@/lib/types";
import { useWedding } from "@/lib/wedding-context";

const norm = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
type Filter = "all" | "unsent" | "sent" | "attending" | "declined" | "pending";
const FILTERS: [Filter, string][] = [["all", "Semua"], ["unsent", "Belum dikirim"], ["sent", "Terkirim"], ["attending", "Hadir"], ["declined", "Tidak hadir"], ["pending", "Belum jawab"]];
const RSVP: Record<Rsvp, string> = { pending: "Belum menjawab", attending: "Hadir", declined: "Tidak hadir" };

export default function Tamu() {
  const { weddingId } = useWedding();
  const { guests } = useWeddingData(weddingId);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [editing, setEditing] = useState<Guest | "new" | null>(null);
  const list = useMemo(() => guests.data ?? [], [guests.data]);
  const sum = useMemo(() => guestSummary(list.map((g) => ({ invitedCount: g.invited_count, confirmedCount: g.confirmed_count, invitationSent: g.invitation_sent, rsvp: g.rsvp }))), [list]);
  const shown = useMemo(() => list.filter((g) => {
    if (tag && g.tag !== tag) return false;
    if (q && !`${g.name} ${g.tag ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return { all: true, unsent: !g.invitation_sent, sent: g.invitation_sent, attending: g.rsvp === "attending", declined: g.rsvp === "declined", pending: g.rsvp === "pending" }[filter];
  }), [list, q, filter, tag]);
  const tags = useMemo(() => [...new Set(list.map((g) => g.tag).filter((t): t is string => !!t))].sort(), [list]);
  const dupes = useMemo(() => new Set(duplicateNames(list.map((g) => g.name))), [list]);
  if (guests.error) return <ErrorNote error={guests.error} />;
  if (!guests.data) return <ListSkeleton summary rows={6} />;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Tamu</h1>
      <Card tone="accent">
        <p className="text-sm">Undangan</p>
        <p className="text-4xl font-extrabold">{sum.invitations}</p>
        <p className="mt-1 text-sm">{sum.invitationsSent} terkirim · {sum.attendingInvitations} hadir · {sum.declinedInvitations} tidak hadir</p>
        <p className="mt-2 text-xs">{sum.headcountComplete ? `Total ${sum.invitedHeadcount} orang diundang.` : `Jumlah orang belum lengkap: ${sum.missingHeadcount} undangan belum diisi. Hadir terkonfirmasi: ${sum.confirmedHeadcount} orang.`}</p>
      </Card>
      <Button className="w-full" onClick={() => setEditing("new")}>Tambah tamu</Button>
      <TextInput label="Cari nama atau tag" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      {tags.length > 0 && <SelectInput label="Tag" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Semua tag</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</SelectInput>}
      <div className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map(([id, l]) => <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{l}</Chip>)}</div>
      {list.length === 0 && <Empty title="Belum ada tamu" hint="Satu baris mewakili satu undangan (bisa untuk pasangan atau keluarga)." />}
      {list.length > 0 && shown.length === 0 && <Empty title="Tidak ada yang cocok" />}
      <ul className="space-y-2">
        {shown.map((g) => (
          <li key={g.id}>
            <button onClick={() => setEditing(g)} className="block min-h-12 w-full rounded-card border border-line bg-surface p-4 text-left">
              <div className="flex items-start justify-between gap-3"><p className="font-medium">{g.name}</p><span className="shrink-0 text-xs">{RSVP[g.rsvp]}{g.rsvp === "attending" && g.confirmed_count === null ? " (jumlah belum diisi)" : ""}</span></div>
              <p className="text-xs text-muted">{[g.tag, g.invitation_sent ? "Undangan terkirim" : "Belum dikirim", g.invited_count !== null ? `${g.invited_count} orang` : "jumlah orang kosong"].concat(dupes.has(norm(g.name)) ? ["Nama ganda?"] : []).filter(Boolean).join(" · ")}</p>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={editing !== null} title={editing === "new" ? "Tambah tamu" : "Ubah tamu"} onClose={() => setEditing(null)}>
        {editing !== null && <GuestForm key={editing === "new" ? "new" : editing.id} weddingId={weddingId} g={editing === "new" ? null : editing} others={list.filter((x) => editing === "new" || x.id !== editing.id).map((x) => norm(x.name))} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function GuestForm({ weddingId, g, others, onClose }: { weddingId: string; g: Guest | null; others: string[]; onClose: () => void }) {
  const [f, setF] = useState({ name: g?.name ?? "", tag: g?.tag ?? "", invited: g?.invited_count?.toString() ?? "", confirmed: g?.confirmed_count?.toString() ?? "", sent: g?.invitation_sent ?? false, rsvp: (g?.rsvp ?? "pending") as Rsvp, phone: g?.phone ?? "", email: g?.email ?? "", notes: g?.notes ?? "" });
  const del = useConfirm();
  const nameDup = f.name.trim() !== "" && others.includes(norm(f.name));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const invited = num(f.invited);
  const confirmed = f.rsvp === "declined" ? 0 : f.rsvp === "pending" ? null : num(f.confirmed);
  const badInvited = invited !== null && (!Number.isInteger(invited) || invited < 1);
  const attendanceError = badInvited ? "Jumlah diundang minimal 1." : validateAttendance({ invitedCount: invited, confirmedCount: confirmed, rsvp: f.rsvp });
  const save = useAction(async () => {
    const row = { name: f.name.trim(), tag: f.tag.trim() || null, invited_count: invited, confirmed_count: confirmed, invitation_sent: f.sent, rsvp: f.rsvp, phone: f.phone.trim() || null, email: f.email.trim() || null, notes: f.notes.trim() || null };
    if (g) await updateRow("guests", g.id, g.revision, row); else await insertRow("guests", { wedding_id: weddingId, ...row });
    onClose();
  });
  const remove = useAction(async () => { if (g) await archiveRow("guests", g.id, g.revision); onClose(); });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
      <TextInput label="Nama undangan" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} hint="Boleh nama pasangan atau keluarga." />
      <TextInput label="Tag (opsional)" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} />
      <TextInput label="Jumlah orang diundang (opsional)" inputMode="numeric" value={f.invited} onChange={(e) => setF({ ...f, invited: e.target.value })} hint="Kosong berarti belum diketahui." />
      <label className="flex min-h-12 items-center gap-3"><input type="checkbox" className="size-6" checked={f.sent} onChange={(e) => setF({ ...f, sent: e.target.checked })} />Undangan sudah dikirim</label>
      <SelectInput label="RSVP" value={f.rsvp} onChange={(e) => setF({ ...f, rsvp: e.target.value as Rsvp })}>{Object.entries(RSVP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput>
      {f.rsvp === "attending" && <TextInput label="Jumlah yang hadir (opsional)" hint="Boleh dikosongkan jika belum pasti." inputMode="numeric" value={f.confirmed} onChange={(e) => setF({ ...f, confirmed: e.target.value })} error={attendanceError} />}
      {f.rsvp !== "attending" && attendanceError && <p role="alert" className="text-xs text-danger">{attendanceError}</p>}
      {f.rsvp === "declined" && <p className="text-xs text-muted">Tamu yang tidak hadir dicatat 0 orang.</p>}
      <TextInput label="Telepon (opsional)" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <TextInput label="Email (opsional)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <TextInput label="Catatan (opsional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      {nameDup && <p className="text-xs text-muted">Nama ini sudah ada di daftar. Tetap bisa disimpan jika memang orang berbeda.</p>}
      <ErrorNote error={save.error ?? remove.error} />
      <Button type="submit" className="w-full" disabled={save.isPending || f.name.trim() === "" || attendanceError !== null}>Simpan</Button>
      {g && (del.armed ? <div className="flex gap-2"><Button type="button" variant="danger" onClick={() => remove.mutate(undefined)} disabled={remove.isPending}>Ya, arsipkan</Button><Button type="button" variant="secondary" onClick={del.reset}>Batal</Button></div>
        : <Button type="button" variant="ghost" className="text-danger" onClick={del.arm}>Arsipkan tamu</Button>)}
    </form>
  );
}
