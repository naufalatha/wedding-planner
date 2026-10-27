"use client";
import { useMemo, useState } from "react";
import { ArchiveBox } from "@/components/cancel-box";
import { Button, Checkbox, Chip, ChipRow, Empty, ErrorNote, FieldRow, FilterBar, FilterSheet, Group, Icon, ListSkeleton, PageHeader, Panel, ProgressBar, SectionHead, SelectInput, Sheet, StickyActions, TextInput, cx } from "@/components/ui";
import { formatShortDate, jakartaDate } from "@/domain/dates";
import { isOverdue, matchesFilter, taskProgress, type TaskFilter } from "@/domain/tasks";
import { archiveRow, insertRow, updateRow } from "@/lib/api";
import { useAction, useWeddingData } from "@/lib/hooks";
import type { Member, Phase, PrepTask } from "@/lib/types";
import { useWedding } from "@/lib/wedding-context";

const PHASES: [Phase, string][] = [["12plus", "12+ bulan sebelum"], ["6to12", "6–12 bulan sebelum"], ["3to6", "3–6 bulan sebelum"], ["1to3", "1–3 bulan sebelum"], ["1to2w", "1–2 minggu sebelum"], ["1w", "1 minggu sebelum"], ["1d", "1 hari sebelum"], ["dday", "Hari H"]];
const FILTERS: [TaskFilter, string][] = [["all", "Semua"], ["todo", "Belum selesai"], ["mine", "Milik saya"], ["overdue", "Terlambat"], ["done", "Selesai"]];

export default function Persiapan() {
  const { weddingId, userId } = useWedding();
  const { tasks, members } = useWeddingData(weddingId);
  const [editing, setEditing] = useState<PrepTask | "new" | null>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("baru") ? "new" : null));
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<Phase | "">("");
  const [high, setHigh] = useState(false);
  const [sheet, setSheet] = useState(false);
  const toggle = useAction((t: PrepTask) => updateRow("prep_tasks", t.id, t.revision, { done: !t.done }));
  const all = useMemo(() => tasks.data ?? [], [tasks.data]);
  const today = jakartaDate(new Date());
  const like = (t: PrepTask) => ({ done: t.done, deadline: t.deadline, assigneeId: t.assignee_id });
  const ok = (t: PrepTask) => matchesFilter(like(t), filter, userId, today) && (phase === "" || t.phase === phase) && (!high || t.priority === "high") && (q.trim() === "" || `${t.title} ${t.notes ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const progress = useMemo(() => taskProgress(all.map(like)), [all]);
  if (tasks.error) return <ErrorNote error={tasks.error} />;
  if (!tasks.data) return <ListSkeleton summary rows={6} />;
  const who = (id: string | null) => (id === null ? null : id === userId ? "Saya" : "Pasangan");
  const overdue = all.filter((t) => isOverdue(t, today)).length;
  const shown = all.filter(ok);
  const reset = () => { setFilter("all"); setQ(""); setPhase(""); setHigh(false); };

  return (
    <div className="space-y-5">
      <PageHeader title="Persiapan" action={<Button compact aria-label="Tambah tugas" onClick={() => setEditing("new")}><Icon name="plus" size={18} />Tambah</Button>} />
      <Panel>
        {progress.ratio === null ? <p className="font-semibold">Belum ada tugas</p> : (
          <>
            <p className="num"><span className="display text-title">{progress.done}</span><span className="text-muted"> dari {progress.total} tugas selesai</span></p>
            <ProgressBar value={progress.ratio} tone="daun" className="mt-3" />
            {overdue > 0 && (
              <button type="button" onClick={() => setFilter("overdue")} className="-mb-2 mt-1 flex min-h-11 items-center gap-1.5 text-meta font-semibold text-danger">
                <Icon name="alert" size={16} /><span className="num">{overdue}</span> terlambat, tampilkan
              </button>
            )}
          </>
        )}
      </Panel>
      {all.length > 0 && (
        <>
          <FilterBar q={q} onQ={setQ} placeholder="Cari judul atau catatan" activeCount={(phase ? 1 : 0) + (high ? 1 : 0)} active={filter !== "all" || q.trim() !== "" || phase !== "" || high}
            onOpen={() => setSheet(true)} shown={shown.length} total={all.length} onReset={reset}
            quick={<ChipRow label="Filter tugas">{FILTERS.map(([id, l]) => <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{l}</Chip>)}</ChipRow>} />
          <FilterSheet open={sheet} onClose={() => setSheet(false)} shown={shown.length} onReset={reset}>
            <SelectInput label="Fase" value={phase} onChange={(e) => setPhase(e.target.value as Phase | "")}>
              <option value="">Semua fase</option>
              {PHASES.filter(([id]) => all.some((t) => t.phase === id)).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </SelectInput>
            <Checkbox label="Hanya prioritas tinggi" checked={high} onChange={(e) => setHigh(e.target.checked)} />
          </FilterSheet>
        </>
      )}
      <ErrorNote error={toggle.error} />
      {all.length === 0 && <Empty title="Belum ada tugas" hint="Tambahkan hal yang perlu disiapkan, dikelompokkan menurut waktunya." action={<Button onClick={() => setEditing("new")}>Tambah tugas</Button>} />}
      {all.length > 0 && shown.length === 0 && <Empty title="Tidak ada tugas pada filter ini" hint="Ubah atau reset filter." />}
      {PHASES.map(([id, label]) => {
        const list = shown.filter((t) => t.phase === id);
        if (list.length === 0) return null;
        const done = list.filter((t) => t.done).length;
        return (
          <section key={id} aria-label={label} className="space-y-1">
            <SectionHead
              title={<><span aria-hidden className={cx("size-2.5 shrink-0 rounded-full", done === list.length ? "bg-daun" : "border-2 border-indigo")} />{label}</>}
              aside={`${done} dari ${list.length}`} />
            <Group>
              {list.map((t) => {
                const late = isOverdue(t, today);
                return (
                  <li key={t.id} className="flex items-stretch">
                    <button onClick={() => toggle.mutate(t)} role="checkbox" aria-checked={t.done} aria-label={`Tandai ${t.title}`} disabled={toggle.isPending} className="grid w-12 shrink-0 place-items-center">
                      <span className={cx("grid size-[22px] place-items-center rounded-md border-2", t.done ? "border-daun bg-daun text-surface" : "border-line-strong bg-surface")}>{t.done && <Icon name="check" size={14} />}</span>
                    </button>
                    <button onClick={() => setEditing(t)} className="min-h-14 min-w-0 flex-1 py-2.5 pr-4 text-left active:bg-indigo-soft">
                      <span className={cx("block truncate", t.done ? "text-muted line-through" : "font-medium")}>{t.title}</span>
                      <span className="flex flex-wrap gap-x-3 text-meta text-muted">
                        {t.deadline && <span className={cx(late && "font-semibold text-danger")}>{late ? "Terlambat " : "Tenggat "}{formatShortDate(t.deadline)}</span>}
                        {who(t.assignee_id) && <span>{who(t.assignee_id)}</span>}
                        {t.priority === "high" && <span className="font-medium text-ink">Prioritas tinggi</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </Group>
          </section>
        );
      })}
      <Sheet open={editing !== null} title={editing === "new" ? "Tambah tugas" : "Ubah tugas"} onClose={() => setEditing(null)}>
        {editing !== null && <TaskForm key={editing === "new" ? "new" : editing.id} weddingId={weddingId} userId={userId} members={members.data ?? []} t={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function TaskForm({ weddingId, userId, members, t, onClose }: { weddingId: string; userId: string; members: Member[]; t: PrepTask | null; onClose: () => void }) {
  const [f, setF] = useState({ title: t?.title ?? "", phase: (t?.phase ?? "6to12") as Phase, deadline: t?.deadline ?? "", assignee: t?.assignee_id ?? "", priority: t?.priority ?? "normal", notes: t?.notes ?? "" });
  const save = useAction(async () => {
    const row = { title: f.title.trim(), phase: f.phase, deadline: f.deadline || null, assignee_id: f.assignee || null, priority: f.priority, notes: f.notes.trim() || null };
    if (t) await updateRow("prep_tasks", t.id, t.revision, row); else await insertRow("prep_tasks", { wedding_id: weddingId, ...row });
    onClose();
  });
  const archive = useAction(async () => { if (t) await archiveRow("prep_tasks", t.id, t.revision); onClose(); });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
      <TextInput label="Judul tugas" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <SelectInput label="Fase" value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value as Phase })}>{PHASES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</SelectInput>
      <TextInput label="Tenggat (opsional)" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
      <FieldRow>
        <SelectInput label="Penanggung jawab" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
          <option value="">Belum ada</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === userId ? "Saya" : "Pasangan"}</option>)}
        </SelectInput>
        <SelectInput label="Prioritas" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as "normal" | "high" })}><option value="normal">Normal</option><option value="high">Tinggi</option></SelectInput>
      </FieldRow>
      <TextInput label="Catatan (opsional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <ErrorNote error={save.error ?? archive.error} />
      <StickyActions><Button type="submit" className="w-full" disabled={save.isPending || f.title.trim() === ""}>Simpan</Button></StickyActions>
      {t && <ArchiveBox label="Arsipkan tugas" pending={archive.isPending} onConfirm={() => archive.mutate(undefined)} />}
    </form>
  );
}
