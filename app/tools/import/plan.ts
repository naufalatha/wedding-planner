import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { splitSheets } from "./csv";
import { extractPlan, type ExtractOptions, type ImportPlan } from "./extract";

export function fingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function loadPlan(file: string, opts: ExtractOptions): { plan: ImportPlan; fingerprint: string } {
  const text = readFileSync(file, "utf8");
  if (!text.includes("## Sheet name:")) {
    throw new Error("Format tidak dikenal: berkas harus berupa dump teks '## Sheet name: …'. (XLSX biner belum didukung.)");
  }
  return { plan: extractPlan(splitSheets(text), opts), fingerprint: fingerprint(text) };
}

export function summarize(plan: ImportPlan) {
  const by: Record<string, { ready: number; needs_review: number }> = {};
  for (const r of plan.records) {
    by[r.entity] ??= { ready: 0, needs_review: 0 };
    by[r.entity][r.state]++;
  }
  return by;
}

export function renderPreview(plan: ImportPlan, fp: string): string {
  const out: string[] = [];
  out.push(`PRATINJAU IMPOR (fingerprint ${fp.slice(0, 12)}…)`, "");
  out.push("Entitas".padEnd(14) + "siap".padStart(6) + "review".padStart(8));
  for (const [e, v] of Object.entries(summarize(plan))) out.push(e.padEnd(14) + String(v.ready).padStart(6) + String(v.needs_review).padStart(8));
  const review = plan.records.filter((r) => r.state === "needs_review");
  if (review.length) {
    out.push("", "BARIS PERLU REVIEW (tidak akan di-commit sampai diputuskan):");
    for (const r of review) out.push(`- [${r.entity}] ${r.sourceKey}  @${r.provenance.sheet}!${r.provenance.cell}\n    ${r.reviewReason}`);
  }
  if (plan.warnings.length) { out.push("", "PERINGATAN:"); plan.warnings.forEach((w) => out.push(`- ${w}`)); }
  if (plan.notImported.length) { out.push("", "TIDAK DIIMPOR:"); plan.notImported.forEach((w) => out.push(`- ${w}`)); }
  return out.join("\n");
}
