"use client";
import Link from "next/link";
import { Card, ErrorNote, LinkButton, ProgressBar, HomeSkeleton } from "@/components/ui";
import { daysUntil, formatShortDate, jakartaDate } from "@/domain/dates";
import { guestSummary } from "@/domain/guests";
import { isPast, nearestBills, nearestOpenTasks } from "@/domain/home";
import { formatRupiah } from "@/domain/money";
import { taskProgress } from "@/domain/tasks";
import { useWeddingData } from "@/lib/hooks";
import { useWedding } from "@/lib/wedding-context";

const GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3";
const Incomplete = ({ children }: { children: string }) => <span className="mt-1 inline-block rounded-full bg-lime-soft px-2 py-0.5 text-[11px] font-medium">{children}</span>;

export default function Beranda() {
  const { weddingId, email } = useWedding();
  const d = useWeddingData(weddingId);
  const err = d.wedding.error ?? d.summary.error;
  if (err) return <ErrorNote error={err} />;
  if (!d.wedding.data || !d.summary.data) return <HomeSkeleton />;
  const w = d.wedding.data;
  const s = d.summary.data;
  const today = jakartaDate(new Date());
  const days = w.wedding_date ? daysUntil(w.wedding_date, new Date()) : null;
  const tasks = d.tasks.data ?? [];
  const progress = taskProgress(tasks.map((t) => ({ done: t.done, deadline: t.deadline, assigneeId: t.assignee_id })));
  const upcomingTasks = nearestOpenTasks(tasks);
  const bills = nearestBills((d.items.data ?? []).map((i) => ({ id: i.budget_item_id, name: i.name, dueDate: i.due_date, remaining: i.remaining })));
  const g = guestSummary((d.guests.data ?? []).map((x) => ({ invitedCount: x.invited_count, confirmedCount: x.confirmed_count, invitationSent: x.invitation_sent, rsvp: x.rsvp })));
  const pct = s.funding_progress === null ? null : Math.round(s.funding_progress * 100);

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{w.wedding_date ? new Date(w.wedding_date + "T00:00:00Z").toLocaleDateString("id-ID", { dateStyle: "full", timeZone: "UTC" }) : "Tanggal belum ditentukan"}{w.location ? ` · ${w.location}` : ""}</p>
          <h1 className="mt-1 text-4xl font-extrabold leading-tight tracking-tight">{w.groom_name.split(" ")[0]} &amp; {w.bride_name.split(" ")[0]}</h1>
        </div>
        <Link href="/akun" aria-label="Akun dan pengaturan" className="grid size-12 shrink-0 place-items-center rounded-full bg-lime font-bold">{(email[0] ?? "?").toUpperCase()}</Link>
      </header>

      <Card tone="lime">
        <p className="text-sm">{days === null ? "Hitung mundur" : days >= 0 ? "Hari menuju hari H" : "Hari sejak hari H"}</p>
        <p className="text-6xl font-extrabold tabular-nums">{days === null ? "—" : Math.abs(days)}</p>
        {days === null && <Incomplete>Belum lengkap: isi tanggal di Akun</Incomplete>}
      </Card>

      <div className="flex flex-wrap gap-2">
        <LinkButton href="/keuangan?bayar=1" className="grow">Catat pembayaran</LinkButton>
        <LinkButton href="/persiapan?baru=1" variant="secondary" className="grow">Tambah tugas</LinkButton>
      </div>

      <Link href="/keuangan" className="block">
        <Card tone="mint">
          <div className="flex items-baseline justify-between">
            <p className="text-sm">Dana terkumpul</p>
            <p className="text-sm font-semibold">{pct === null ? "—" : `${pct}%`}</p>
          </div>
          <p className="mb-3 mt-1 text-[min(1.875rem,7.5vw)] font-extrabold">{formatRupiah(s.collected)}</p>
          <ProgressBar value={s.funding_progress ?? 0} />
          {s.target === null ? <Incomplete>Belum lengkap: isi target dana di Akun</Incomplete> : <p className="mt-2 text-xs text-muted">dari target {formatRupiah(s.target)}</p>}
        </Card>
      </Link>

      <div className={GRID}>
        <Card className="!p-4"><p className="text-xs text-muted">Saldo tersedia</p><p className={`mt-1 break-words text-lg font-bold ${s.available_balance < 0 ? "text-danger" : ""}`}>{formatRupiah(s.available_balance)}</p></Card>
        <Card className="!p-4">
          <p className="text-xs text-muted">Sisa tagihan</p><p className="mt-1 break-words text-lg font-bold">{formatRupiah(s.outstanding)}</p>
          {s.unpriced_count > 0 && <Incomplete>{`${s.unpriced_count} item belum dianggarkan`}</Incomplete>}
        </Card>
        <Card className="!p-4"><p className="text-xs text-muted">Pembayaran tercatat</p><p className="mt-1 break-words text-lg font-bold">{formatRupiah(s.total_paid)}</p></Card>
      </div>

      <section aria-label="Tugas terdekat" className="space-y-2">
        <div className="flex items-baseline justify-between"><h2 className="font-bold">Tugas terdekat</h2><Link href="/persiapan" className="min-h-12 content-center text-sm text-muted underline">Lihat semua</Link></div>
        {upcomingTasks.length === 0 && <p className="rounded-card border border-dashed border-line p-4 text-sm text-muted">Tidak ada tugas bertenggat. Tugas tanpa tenggat ada di Persiapan.</p>}
        {upcomingTasks.map((t) => (
          <Link key={t.id} href="/persiapan" className="block min-h-12 rounded-card border border-line bg-surface p-4">
            <p className="font-medium">{t.title}</p>
            <p className={`text-xs ${isPast(t.deadline, today) ? "font-medium text-danger" : "text-muted"}`}>{isPast(t.deadline, today) ? "Terlambat · " : ""}{formatShortDate(t.deadline as string)}</p>
          </Link>
        ))}
      </section>

      <section aria-label="Tagihan terdekat" className="space-y-2">
        <div className="flex items-baseline justify-between"><h2 className="font-bold">Tagihan terdekat</h2><Link href="/keuangan" className="min-h-12 content-center text-sm text-muted underline">Lihat semua</Link></div>
        {bills.length === 0 && <p className="rounded-card border border-dashed border-line p-4 text-sm text-muted">Belum ada tagihan dengan jatuh tempo.</p>}
        {bills.map((b) => (
          <Link key={b.id} href="/keuangan" className="block min-h-12 rounded-card border border-line bg-surface p-4">
            <div className="flex justify-between gap-3"><p className="min-w-0 font-medium">{b.name}</p><p className="shrink-0 font-semibold">{formatRupiah(b.remaining)}</p></div>
            <p className={`text-xs ${isPast(b.dueDate, today) ? "font-medium text-danger" : "text-muted"}`}>{isPast(b.dueDate, today) ? "Terlambat · " : "Jatuh tempo "}{formatShortDate(b.dueDate as string)}</p>
          </Link>
        ))}
      </section>

      <div className={GRID}>
        <Link href="/persiapan"><Card tone="lavender" className="h-full">
          <p className="text-xs">Persiapan</p>
          {progress.ratio === null ? <p className="mt-1 text-lg font-bold">Belum ada tugas</p> : <><p className="mt-1 text-lg font-bold">{progress.done} dari {progress.total} selesai</p><div className="mt-2"><ProgressBar value={progress.ratio} /></div></>}
        </Card></Link>
        <Link href="/tamu"><Card className="h-full">
          <p className="text-xs text-muted">Tamu</p>
          <p className="mt-1 text-lg font-bold">{g.invitations} undangan</p>
          <p className="mt-1 text-xs text-muted">{g.invitedHeadcount} orang diketahui · {g.confirmedHeadcount} hadir</p>
          {!g.headcountComplete && <Incomplete>{`${g.missingHeadcount} undangan belum ada jumlah orang`}</Incomplete>}
        </Card></Link>
      </div>
    </div>
  );
}
