export interface TaskLike { done: boolean; deadline: string | null; assigneeId: string | null; archived?: boolean }

/** Progres = tugas aktif selesai / tugas aktif. Arsip tidak masuk denominator. Tanpa tugas -> null ("Belum ada tugas"). */
export function taskProgress(tasks: readonly TaskLike[]): { done: number; total: number; ratio: number | null } {
  const active = tasks.filter((t) => !t.archived);
  const done = active.filter((t) => t.done).length;
  return { done, total: active.length, ratio: active.length === 0 ? null : done / active.length };
}

/** Terlambat = belum selesai dan tenggat sebelum hari ini (tanggal kalender Jakarta, YYYY-MM-DD). */
export const isOverdue = (t: Pick<TaskLike, "done" | "deadline">, today: string) => !t.done && t.deadline !== null && t.deadline < today;

export type TaskFilter = "all" | "todo" | "mine" | "overdue" | "done";
export function matchesFilter(t: TaskLike, f: TaskFilter, me: string, today: string): boolean {
  if (t.archived) return false;
  switch (f) {
    case "all": return true;
    case "todo": return !t.done;
    case "mine": return t.assigneeId === me;
    case "overdue": return isOverdue(t, today);
    case "done": return t.done;
  }
}
