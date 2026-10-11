"use client";
import { useMemo, useState } from "react";
import { Button, Card, Chip, Empty, ErrorNote, Loading, ProgressBar, SelectInput, Sheet, TextInput, useConfirm } from "@/components/ui";
import { jakartaDate } from "@/domain/dates";
import { matchesFilter, taskProgress, type TaskFilter } from "@/domain/tasks";
import { archiveRow, insertRow, updateRow } from "@/lib/api";
import { useAction, useWeddingData } from "@/lib/hooks";
import type { Member, Phase, PrepTask } from "@/lib/types";
import { useWedding } from "@/lib/wedding-context";

const PHASES: [Phase, string][] = [["12plus", "12+ bulan sebelum"], ["6to12", "6–12 bulan sebelum"], ["3to6", "3–6 bulan sebelum"], ["1to3", "1–3 bulan sebelum"], ["1to2w", "1–2 minggu sebelum"], ["1w", "1 minggu sebelum"], ["1d", "1 hari sebelum"], ["dday", "Hari H"]];
const FILTERS: [TaskFilter, string][] = [["all", "Semua"], ["mine", "Milik saya"], ["overdue", "Terlambat"], ["done", "Selesai"]];

export default function Persiapan() {
  const { weddingId, userId } = useWedding();
  const { tasks, members } = useWeddingData(weddingId);
  const [editing, setEditing] = useState<PrepTask | "new" | null>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("baru") ? "new" : null));
  const [filter, setFilter] = useState<TaskFilter>("all");
  const toggle = useAction((t: PrepTask) => updateRow("prep_tasks", t.id, t.revision, { done: !t.done }));
  const all = useMemo(() => tasks.data ?? [], [tasks.data]);
  const today = jakartaDate(new Date());
  const like = (t: PrepTask) => ({ done: t.done, deadline: t.deadline, assigneeId: t.assignee_id });
  const progress = useMemo(() => taskProgress(all.map(like)), [all]);
  if (tasks.error) return <ErrorNote error={tasks.error} />;
  if (!tasks.data) return <Loading />;
  const who = (id: string | null) => (id === null ? null : id === userId ? "Saya" : "Pasangan");

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Persiapan</h1>
      <Card tone="lavender">
        <p className="text-sm">Progres</p>
        {progress.ratio === null ? <p className="text-xl font-bold">Belum ada tugas</p> : (
          <>
            <p className="mb-3 text-3xl font-extrabold">{progress.done}<span className="text-lg font-medium text-muted"> / {progress.total}</span></p>
            <ProgressBar value={progress.ratio} />
          </>
        )}
      </Card>
      <Button className="w-full" onClick={() => setEditing("new")}>Tambah tugas</Button>
      <div className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map(([id, l]) => <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{l}</Chip>)}</div>
      <ErrorNote error={toggle.error} />
      {all.length === 0 && <Empty title="Belum ada tugas" hint="Tambahkan hal yang perlu disiapkan, dikelompokkan menurut waktunya." />}
      {all.length > 0 && !all.some((t) => matchesFilter(like(t), filter, userId, today)) && <Empty title="Tidak ada tugas pada filter ini" />}
      {PHASES.map(([id, label]) => {
        const list = all.filter((t) => t.phase === id && matchesFilter(like(t), filter, userId, today));
        if (list.length === 0) return null;
        return (
          <section key={id} aria-label={label} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted">{label}</h2>
            {list.map((t) => {
              const meta = [t.deadline, who(t.assignee_id), t.priority === "high" ? "Prioritas tinggi" : null].filter(Boolean).join(" · ");
              return (
                <div key={t.id} className="flex items-center gap-1 rounded-card border border-line bg-surface">
                  <button onClick={() => toggle.mutate(t)} role="checkbox" aria-checked={t.done} aria-label={`Tandai ${t.title}`} disabled={toggle.isPending}
                    className="grid size-12 shrink-0 place-items-center"><span className={`grid size-6 place-items-center rounded-full border-2 border-ink ${t.done ? "bg-lime" : ""}`}>{t.done && "✓"}</span></button>
                  <button onClick={() => setEditing(t)} className="min-h-12 min-w-0 flex-1 py-2 pr-4 text-left">
                    <p className={`truncate ${t.done ? "text-muted line-through" : "font-medium"}`}>{t.title}</p>
                    {meta && <p className={`truncate text-xs ${!t.done && t.deadline && t.deadline < today ? "text-danger" : "text-muted"}`}>{meta}</p>}
                  </button>
                </div>
              );
            })}
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
  const arch = useConfirm();
  const save = useAction(async () => {
    const row = { title: f.title.trim(), phase: f.phase, deadline: f.deadline || null, assignee_id: f.assignee || null, priority: f.priority, notes: f.notes.trim() || null };
    if (t) await updateRow("prep_tasks", t.id, t.revision, row); else await insertRow("prep_tasks", { wedding_id: weddingId, ...row });
    onClose();
  });
  const archive = useAction(async () => { if (t) await archiveRow("prep_tasks", t.id, t.revision); onClose(); });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
      <TextInput label="Judul tugas" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <SelectInput label="Fase" value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value as Phase })}>{PHASES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</SelectInput>
      <TextInput label="Tenggat (opsional)" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
      <SelectInput label="Penanggung jawab" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
        <option value="">Belum ditugaskan</option>
        {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === userId ? "Saya" : "Pasangan"}</option>)}
      </SelectInput>
      <SelectInput label="Prioritas" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as "normal" | "high" })}><option value="normal">Normal</option><option value="high">Tinggi</option></SelectInput>
      <TextInput label="Catatan (opsional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <ErrorNote error={save.error ?? archive.error} />
      <Button type="submit" className="w-full" disabled={save.isPending || f.title.trim() === ""}>Simpan</Button>
      {t && (arch.armed ? <div className="flex gap-2"><Button type="button" variant="danger" onClick={() => archive.mutate(undefined)} disabled={archive.isPending}>Ya, arsipkan</Button><Button type="button" variant="secondary" onClick={arch.reset}>Batal</Button></div>
        : <Button type="button" variant="ghost" className="text-danger" onClick={arch.arm}>Arsipkan tugas</Button>)}
    </form>
  );
}
