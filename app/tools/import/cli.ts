import { readFileSync, writeFileSync } from "node:fs";
import { loadPlan, renderPreview } from "./plan";

const [, , cmd, file, ...rest] = process.argv;
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

async function main() {
  if (!cmd || !file || !["preview", "commit"].includes(cmd)) {
    console.error(
      "Pemakaian:\n  tsx tools/import/cli.ts preview <dump.txt> [--resolutions r.json] [--assumed-date YYYY-MM-DD] [--out preview.json]\n" +
        "  DATABASE_URL=… tsx tools/import/cli.ts commit <dump.txt> --wedding <uuid> --user <uuid> [--resolutions r.json] [--assumed-date …]",
    );
    process.exit(2);
  }
  const resFile = flag("resolutions");
  const resolutions = resFile ? JSON.parse(readFileSync(resFile, "utf8")) : undefined;
  const assumedPaymentDate = flag("assumed-date") ?? new Date().toISOString().slice(0, 10);
  const { plan, fingerprint } = loadPlan(file, { assumedPaymentDate, resolutions });

  if (cmd === "preview") {
    console.log(renderPreview(plan, fingerprint));
    const out = flag("out");
    if (out) writeFileSync(out, JSON.stringify({ fingerprint, plan }, null, 2));
    return;
  }
  const { commitPlan } = await import("./commit");
  const wedding = flag("wedding");
  const user = flag("user");
  if (!wedding || !user || !process.env.DATABASE_URL) {
    console.error("commit memerlukan --wedding, --user, dan env DATABASE_URL.");
    process.exit(2);
  }
  const result = await commitPlan({ plan, fingerprint, label: file.split("/").pop() ?? file, weddingId: wedding, userId: user, databaseUrl: process.env.DATABASE_URL });
  console.log(JSON.stringify(result, null, 2));
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
