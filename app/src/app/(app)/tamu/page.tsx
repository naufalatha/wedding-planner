"use client";
import { useMemo, useState } from "react";
import { ArchiveBox } from "@/components/cancel-box";
import { Button, Checkbox, Chip, ChipRow, Empty, ErrorNote, FieldRow, FilterBar, FilterSheet, Flag, Group, Icon, ListSkeleton, PageHeader, Panel, RowButton, SectionHead, SelectInput, Sheet, StickyActions, TextInput, cx } from "@/components/ui";
import { duplicateNames, guestSummary, validateAttendance, type Rsvp } from "@/domain/guests";
import { archiveRow, insertRow, updateRow } from "@/lib/api";
import { useAction, useWeddingData } from "@/lib/hooks";
import type { Guest } from "@/lib/types";
import { useWedding } from "@/lib/wedding-context";

const norm = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
type Filter = "all" | "unsent" | "sent" | "attending" | "declined" | "pending";
const FILTERS: [Filter, string][] = [["all", "Semua"], ["attending", "Hadir"], ["declined", "Tidak hadir"], ["pending", "Belum jawab"], ["unsent", "Belum dikirim"], ["sent", "Terkirim"]];
const RSVP: Record<Rsvp, string> = { pending: "Belum menjawab", attending: "Hadir", declined: "Tidak hadir" };
const RSVP_SHORT: Record<Rsvp, string> = { pending: "Belum jawab", attending: "Hadir", declined: "Tidak hadir" };
const RSVP_TONE: Record<Rsvp, string> = { pending: "text-muted", attending: "text-daun", declined: "text-danger" };
const RSVP_DOT: Record<Rsvp, string> = { pending: "bg-line-strong", attending: "bg-daun", declined: "bg-danger" };
type GroupBy = "abjad" | "tag";

export default function Tamu() {
  const { weddingId } = useWedding();
  const { guests } = useWeddingData(weddingId);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [by, setBy] = useState<GroupBy>("abjad");
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<Guest | "new" | null>(null);
  const list = useMemo(() => guests.data ?? [], [guests.data]);
  const sum = useMemo(() => guestSummary(list.map((g) => ({ invitedCount: g.invited_count, confirmedCount: g.confirmed_count, invitationSent: g.invitation_sent, rsvp: g.rsvp }))), [list]);
  const shown = useMemo(() => list.filter((g) => {
    if (tag && g.tag !== tag) return false;
    if (q && !`${g.name} ${g.tag ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return { all: true, unsent: !g.invitation_sent, sent: g.invitation_sent, attending: g.rsvp === "attending", declined: g.rsvp === "declined", pending: g.rsvp === "pending" }[filter];
  }).sort((a, b) => a.name.localeCompare(b.name, "id")), [list, q, filter, tag]);
  const groups = useMemo(() => {
    const m = new Map<string, Guest[]>();
    for (const g of shown) {
      const key = by === "tag" ? g.tag?.trim() || "Tanpa tag" : /^\p{L}/u.test(g.name.trim()) ? g.name.trim()[0].toLocaleUpperCase("id") : "#";
      m.set(key, [...(m.get(key) ?? []), g]);
    }
    return [...m].sort(([a], [b]) => (a === "#" || a === "Tanpa tag" ? 1 : b === "#" || b === "Tanpa tag" ? -1 : a.localeCompare(b, "id")));
  }, [shown, by]);
  const tags = useMemo(() => [...new Set(list.map((g) => g.tag).filter((t): t is string => !!t))].sort(), [list]);
  const dupes = useMemo(() => new Set(duplicateNames(list.map((g) => g.name))), [list]);
  if (guests.error) return <ErrorNote error={guests.error} />;
  if (!guests.data) return <ListSkeleton summary rows={7} />;
  const reset = () => { setQ(""); setTag(""); setFilter("all"); };
  const seg = (n: number) => `${sum.invitations ? (n / sum.invitations) * 100 : 0}%`;

  return (
    <div className="space-y-5">
      <PageHeader title="Tamu" action={<Button compact aria-label="Tambah tamu" onClick={() => setEditing("new")}><Icon name="plus" size={18} />Tambah</Button>} />
      <Panel>
        <p className="num"><span className="display text-title">{sum.invitations}</span><span className="text-muted"> undangan, {sum.invitationsSent} sudah terkirim</span></p>
        {sum.invitations > 0 && (
          <div role="img" aria-label={`${sum.attendingInvitations} hadir, ${sum.declinedInvitations} tidak hadir, ${sum.pendingInvitations} belum menjawab`} className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-line">
            <span className="bg-daun" style={{ width: seg(sum.attendingInvitations) }} />
            <span className="bg-danger" style={{ width: seg(sum.declinedInvitations) }} />
          </div>
        )}
        <dl className="num mt-2 flex flex-wrap gap-x-4 text-meta">
          <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-daun" /><dt className="sr-only">Hadir</dt><dd>{sum.attendingInvitations} hadir</dd></div>
          <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-danger" /><dt className="sr-only">Tidak hadir</dt><dd>{sum.declinedInvitations} tidak hadir</dd></div>
          <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-line-strong" /><dt className="sr-only">Belum menjawab</dt><dd>{sum.pendingInvitations} belum jawab</dd></div>
        </dl>
        <div className="mt-3 border-t border-line pt-3 text-meta">
          {sum.headcountComplete
            ? <p className="num">Total {sum.invitedHeadcount} orang diundang, {sum.confirmedHeadcount} terkonfirmasi hadir.</p>
            : <><Flag>Jumlah orang belum lengkap: {sum.missingHeadcount} undangan belum diisi</Flag><p className="num mt-1.5 text-muted">Hadir terkonfirmasi: {sum.confirmedHeadcount} orang.</p></>}
        </div>
      </Panel>

      <FilterBar q={q} onQ={setQ} placeholder="Cari nama atau tag" activeCount={tag ? 1 : 0} active={q.trim() !== "" || tag !== "" || filter !== "all"}
        onOpen={() => setSheet(true)} shown={shown.length} total={list.length} onReset={reset}
        quick={<ChipRow label="Status tamu">{FILTERS.map(([id, l]) => <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{l}</Chip>)}</ChipRow>} />
      <FilterSheet open={sheet} onClose={() => setSheet(false)} shown={shown.length} onReset={reset}>
        {tags.length > 0 && <SelectInput label="Tag" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Semua tag</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</SelectInput>}
        <div className="space-y-1">
          <p className="text-meta font-medium">Kelompokkan menurut</p>
          <ChipRow label="Pengelompokan" wrap><Chip active={by === "abjad"} onClick={() => setBy("abjad")}>Abjad</Chip><Chip active={by === "tag"} onClick={() => setBy("tag")}>Tag</Chip></ChipRow>
        </div>
      </FilterSheet>

      {list.length === 0 && <Empty title="Belum ada tamu" hint="Satu baris mewakili satu undangan (bisa untuk pasangan atau keluarga)." action={<Button onClick={() => setEditing("new")}>Tambah tamu</Button>} />}
      {list.length > 0 && shown.length === 0 && <Empty title="Tidak ada yang cocok" hint="Ubah atau reset filter." />}
      {groups.map(([key, rows]) => (
        <section key={key} aria-label={key} className="space-y-1">
          <SectionHead title={key} aside={rows.length} />
          <Group>
            {rows.map((g) => (
              <RowButton key={g.id} stack onClick={() => setEditing(g)}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{g.name}</span>
                  <span className={cx("flex shrink-0 items-center gap-1.5 text-meta font-medium", RSVP_TONE[g.rsvp])}><span className={cx("size-2 rounded-full", RSVP_DOT[g.rsvp])} />{RSVP_SHORT[g.rsvp]}</span>
                </span>
                <span className="flex flex-wrap gap-x-3 text-meta text-muted">
                  {by === "abjad" && g.tag && <span>{g.tag}</span>}
                  <span className="num">{g.invited_count !== null ? `${g.invited_count} orang` : "jumlah orang kosong"}</span>
                  <span className={cx(!g.invitation_sent && "font-medium text-ink")}>{g.invitation_sent ? "Terkirim" : "Belum dikirim"}</span>
                  {g.rsvp === "attending" && g.confirmed_count === null && <span>jumlah hadir belum diisi</span>}
                  {dupes.has(norm(g.name)) && <span className="font-medium text-ink">Nama ganda?</span>}
                </span>
              </RowButton>
            ))}
          </Group>
        </section>
      ))}
      <Sheet open={editing !== null} title={editing === "new" ? "Tambah tamu" : "Ubah tamu"} onClose={() => setEditing(null)}>
        {editing !== null && <GuestForm key={editing === "new" ? "new" : editing.id} weddingId={weddingId} g={editing === "new" ? null : editing} others={list.filter((x) => editing === "new" || x.id !== editing.id).map((x) => norm(x.name))} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function GuestForm({ weddingId, g, others, onClose }: { weddingId: string; g: Guest | null; others: string[]; onClose: () => void }) {
  const [f, setF] = useState({ name: g?.name ?? "", tag: g?.tag ?? "", invited: g?.invited_count?.toString() ?? "", confirmed: g?.confirmed_count?.toString() ?? "", sent: g?.invitation_sent ?? false, rsvp: (g?.rsvp ?? "pending") as Rsvp, phone: g?.phone ?? "", email: g?.email ?? "", notes: g?.notes ?? "" });
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
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
      <TextInput label="Nama undangan" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} hint="Boleh nama pasangan atau keluarga." />
      {nameDup && <p className="-mt-2 text-meta text-muted">Nama ini sudah ada di daftar. Tetap bisa disimpan jika memang orang berbeda.</p>}
      <FieldRow>
        <TextInput label="Tag (opsional)" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} />
        <SelectInput label="RSVP" value={f.rsvp} onChange={(e) => setF({ ...f, rsvp: e.target.value as Rsvp })}>{Object.entries(RSVP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput>
      </FieldRow>
      <TextInput label="Jumlah orang diundang (opsional)" inputMode="numeric" value={f.invited} onChange={(e) => setF({ ...f, invited: e.target.value })} hint="Kosong berarti belum diketahui." />
      {f.rsvp === "attending" && <TextInput label="Jumlah yang hadir (opsional)" hint="Boleh dikosongkan jika belum pasti." inputMode="numeric" value={f.confirmed} onChange={(e) => setF({ ...f, confirmed: e.target.value })} error={attendanceError} />}
      {f.rsvp !== "attending" && attendanceError && <p role="alert" className="text-meta text-danger">{attendanceError}</p>}
      {f.rsvp === "declined" && <p className="-mt-2 text-meta text-muted">Tamu yang tidak hadir dicatat 0 orang.</p>}
      <Checkbox label="Undangan sudah dikirim" checked={f.sent} onChange={(e) => setF({ ...f, sent: e.target.checked })} />
      <TextInput label="Telepon (opsional)" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <TextInput label="Email (opsional)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <TextInput label="Catatan (opsional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <ErrorNote error={save.error ?? remove.error} />
      <StickyActions><Button type="submit" className="w-full" disabled={save.isPending || f.name.trim() === "" || attendanceError !== null}>Simpan</Button></StickyActions>
      {g && <ArchiveBox label="Arsipkan tamu" pending={remove.isPending} onConfirm={() => remove.mutate(undefined)} />}
    </form>
  );
}
