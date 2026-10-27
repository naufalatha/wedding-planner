"use client";
import Link from "next/link";
import { Empty, ErrorNote, Flag, Group, HomeSkeleton, Icon, LedgerRow, LinkButton, Panel, ProgressBar, RowLink, cx } from "@/components/ui";
import { dayMonth, daysUntil, dueLabel, jakartaDate } from "@/domain/dates";
import { balanceAfterSettled } from "@/domain/finance";
import { guestSummary } from "@/domain/guests";
import { nearestBills, nearestOpenTasks } from "@/domain/home";
import { formatRupiah } from "@/domain/money";
import { taskProgress } from "@/domain/tasks";
import { useWeddingData } from "@/lib/hooks";
import { useWedding } from "@/lib/wedding-context";

interface Agenda { key: string; href: string; kind: "Tagihan" | "Tugas"; title: string; date: string; amount: number | null }

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
  const bills = nearestBills((d.items.data ?? []).map((i) => ({ id: i.budget_item_id, name: i.name, dueDate: i.due_date, remaining: i.remaining })), 5);
  const agenda: Agenda[] = [
    ...bills.map((b): Agenda => ({ key: `b${b.id}`, href: "/keuangan", kind: "Tagihan", title: b.name, date: b.dueDate as string, amount: b.remaining })),
    ...nearestOpenTasks(tasks, 5).map((t): Agenda => ({ key: `t${t.id}`, href: "/persiapan", kind: "Tugas", title: t.title, date: t.deadline as string, amount: null })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, 6);
  const g = guestSummary((d.guests.data ?? []).map((x) => ({ invitedCount: x.invited_count, confirmedCount: x.confirmed_count, invitationSent: x.invitation_sent, rsvp: x.rsvp })));
  const pct = s.funding_progress === null ? null : Math.round(s.funding_progress * 100);
  const first = (n: string) => n.split(" ")[0];

  return (
    <div className="space-y-7">
      {/* Blok indigo penuh lebar di ponsel, ditutup tepi tumpal. */}
      <section aria-label="Pernikahan" className="on-indigo -mx-4 -mt-5 text-surface md:mx-0 md:mt-0">
        <div className="bg-indigo-deep px-4 pb-6 pt-5 md:rounded-t-group md:px-6 md:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-meta text-surface/75">
              {w.wedding_date
                ? <p>{new Date(w.wedding_date + "T00:00:00Z").toLocaleDateString("id-ID", { dateStyle: "full", timeZone: "UTC" })}</p>
                : <Flag href="/akun">Isi tanggal pernikahan</Flag>}
              {w.location && <p>{w.location}</p>}
            </div>
            <Link href="/akun" aria-label="Akun dan pengaturan" className="grid size-11 shrink-0 place-items-center rounded-full bg-surface/15 font-semibold">{(email[0] ?? "?").toUpperCase()}</Link>
          </div>
          <h1 className="display mt-3 text-name">{first(w.groom_name)} &amp; {first(w.bride_name)}</h1>
          <p className="mt-5 flex items-end gap-3">
            {days === null ? <span className="text-lead text-surface/80">Hitung mundur dimulai setelah tanggal diisi.</span> : days === 0 ? <span className="display text-title">Hari ini hari H.</span> : (
              <>
                <span data-countdown className="display num text-[4rem] leading-[0.9]">{Math.abs(days)}</span>
                <span className="pb-0.5 text-body leading-5 text-surface/80">{days > 0 ? "hari lagi menuju hari H" : "hari sejak hari H"}</span>
              </>
            )}
          </p>
          <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2">
            <LinkButton href="/keuangan?bayar=1" variant="accent" compact className="text-center leading-tight">Catat pembayaran</LinkButton>
            <LinkButton href="/persiapan?baru=1" variant="onDark" compact className="text-center leading-tight">Tambah tugas</LinkButton>
          </div>
        </div>
        <div aria-hidden className="tumpal" />
      </section>

      <section aria-label="Berikutnya" className="space-y-2">
        <h2 className="text-lead font-semibold">Berikutnya</h2>
        {agenda.length === 0
          ? <Empty title="Belum ada tenggat dekat" hint="Isi tenggat pada tugas atau jatuh tempo pada item anggaran, nanti muncul di sini." />
          : (
            <Group label="Tagihan dan tugas terdekat">
              {agenda.map((a) => {
                const late = a.date < today;
                const soon = !late && daysUntil(a.date, new Date()) <= 7;
                const dm = dayMonth(a.date);
                return (
                  <RowLink key={a.key} href={a.href} className="flex-wrap">
                    <span className={cx("num grid size-11 shrink-0 place-items-center rounded-ctl text-center leading-none", late ? "bg-danger-soft text-danger" : soon ? "bg-kunyit-soft" : "bg-indigo-soft")}>
                      <span><span className="display block text-lead">{dm.day}</span><span className="block pt-0.5 text-[0.6875rem] font-medium">{dm.mon}</span></span>
                    </span>
                    <span className="min-w-[7rem] flex-1">
                      <span className="block truncate font-medium">{a.title}</span>
                      <span className="flex flex-wrap gap-x-3 text-meta text-muted">
                        <span>{a.kind}</span>
                        <span className={late ? "font-semibold text-danger" : undefined}>{dueLabel(a.date, today)}</span>
                      </span>
                    </span>
                    {a.amount !== null && <span className="num ml-auto shrink-0 font-semibold">{formatRupiah(a.amount)}</span>}
                  </RowLink>
                );
              })}
            </Group>
          )}
      </section>

      <section aria-label="Dana" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lead font-semibold">Dana</h2>
          <Link href="/keuangan" className="-mr-2 inline-flex min-h-11 items-center gap-0.5 px-2 text-meta font-semibold text-indigo">Rincian<Icon name="chevron" size={16} /></Link>
        </div>
        <Panel>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-meta text-muted">Terkumpul</p>
            <p className="num text-meta font-semibold">{pct === null ? "—" : `${pct}%`}</p>
          </div>
          <p className="display num mt-0.5 text-[min(1.75rem,8.5vw)] leading-9">{formatRupiah(s.collected)}</p>
          <ProgressBar value={s.funding_progress ?? 0} className="mt-3" />
          <div className="mt-2">{s.target === null ? <Flag href="/akun">Isi target dana</Flag> : <p className="num text-meta text-muted">dari target {formatRupiah(s.target)}</p>}</div>
          <dl className="mt-5 space-y-2">
            <LedgerRow label="Saldo tersedia" value={formatRupiah(s.available_balance)} tone={s.available_balance < 0 ? "danger" : undefined} />
            <LedgerRow label="Sisa tagihan" value={formatRupiah(s.outstanding)} />
            <LedgerRow label="Sisa setelah lunas" value={formatRupiah(balanceAfterSettled(s.available_balance, s.outstanding))} tone={balanceAfterSettled(s.available_balance, s.outstanding) < 0 ? "danger" : undefined} />
            <LedgerRow label="Pembayaran tercatat" value={formatRupiah(s.total_paid)} />
          </dl>
          {s.unpriced_count > 0 && <div className="mt-3"><Flag href="/keuangan">{s.unpriced_count} item belum dianggarkan</Flag></div>}
        </Panel>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
        <Link href="/persiapan" className="block">
          <Panel className="h-full">
            <p className="text-meta text-muted">Persiapan</p>
            {progress.ratio === null ? <p className="mt-1 font-semibold">Belum ada tugas</p> : (
              <>
                <p className="num mt-1 font-semibold">{progress.done} dari {progress.total} selesai</p>
                <ProgressBar value={progress.ratio} tone="daun" className="mt-3" />
              </>
            )}
          </Panel>
        </Link>
        <Link href="/tamu" className="block">
          <Panel className="h-full">
            <p className="text-meta text-muted">Tamu</p>
            <p className="num mt-1 font-semibold">{g.invitations} undangan</p>
            <p className="num mt-1 text-meta text-muted">{g.confirmedHeadcount} orang hadir</p>
            {!g.headcountComplete && <p className="num mt-1 text-meta text-muted">{g.missingHeadcount} belum ada jumlah orang</p>}
          </Panel>
        </Link>
      </div>
    </div>
  );
}
