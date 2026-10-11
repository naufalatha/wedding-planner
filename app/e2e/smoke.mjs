// Smoke test UI dengan backend Supabase di-mock (data sintetis). Tidak memerlukan Supabase sungguhan.
// Pakai: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test npm run build
//        npx next start -p 3100 &  node e2e/smoke.mjs
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const API = "http://127.0.0.1:54321";
const OUT = process.env.SHOTS ?? "e2e/shots";
mkdirSync(OUT, { recursive: true });
const U = "11111111-1111-1111-1111-111111111111", W = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: U, role: "authenticated", exp: 4102444800 })}.sig`;
const user = { id: U, aud: "authenticated", role: "authenticated", email: "adi@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

const items = [
  { budget_item_id: "i1", wedding_id: W, section: "vendor", category: "VENUE", name: "Gedung Contoh", estimated_price: 9500000, final_price: 9000000, committed_price: 9000000, paid_amount: 3500000, remaining: 5500000, status: "dp", due_date: null, vendor_id: null },
  { budget_item_id: "i2", wedding_id: W, section: "vendor", category: "DEKOR", name: "Dekor Contoh", estimated_price: 13000000, final_price: null, committed_price: 13000000, paid_amount: 13100000, remaining: -100000, status: "kelebihan_bayar", due_date: null, vendor_id: null },
  { budget_item_id: "i3", wedding_id: W, section: "paperwork", category: null, name: "Pas foto", estimated_price: null, final_price: null, committed_price: null, paid_amount: 0, remaining: null, status: "belum_dibayar", due_date: null, vendor_id: null },
];
const guests = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, wedding_id: W, name: `Tamu Contoh ${i + 1}`, tag: i % 2 ? "Teman" : "Keluarga", invited_count: i < 3 ? 2 : null, confirmed_count: null, invitation_sent: i < 4, rsvp: "pending", phone: null, email: null, notes: null, revision: 1 }));
const data = {
  weddings: { id: W, groom_name: "Adi Contoh", bride_name: "Sari Contoh", wedding_date: "2027-08-28", location: "Bogor", target_amount: 100000000, opening_balance: 0, budget_cap: 69715000, revision: 1 },
  deposits: [{ id: "d1", wedding_id: W, contributor: "Adi", amount: 42000000, deposited_on: "2026-01-25", note: null, revision: 1, cancelled_at: null, cancel_reason: null }],
  fund_withdrawals: [], budget_item_status: items, vendors: [{ id: "v1", wedding_id: W, category: "VENUE", name: "Gedung Contoh", status: "selected", contact: "0812", price_quote: 9500000, notes: null, package: null, link: null, revision: 1 }],
  prep_tasks: [{ id: "t1", wedding_id: W, title: "Cari gedung", phase: "12plus", done: true, deadline: null, assignee: null, priority: null, revision: 1 }, { id: "t2", wedding_id: W, title: "Hubungi vendor WO", phase: "6to12", done: false, deadline: null, assignee: null, priority: "high", revision: 1 }],
  guests, payments: [{ id: "p1", wedding_id: W, budget_item_id: "i1", type: "payment", parent_payment_id: null, amount: 3500000, paid_on: "2026-09-01", funding_source: "wedding_fund", refund_received: false, note: null, cancelled_at: null, cancel_reason: null }],
};
const summary = { collected: 42000000, target: 100000000, funding_progress: 0.42, available_balance: 38500000, total_estimated: 25000000, total_committed: 22000000, total_paid: 16600000, outstanding: 5400000, plan_remaining: null, unpriced_count: 1, estimate_based_count: 2 };

const errors = [];
const calls = [];
let payAttempts = 0;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "id-ID", timezoneId: "Asia/Jakarta" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/WebSocket|realtime|net::ERR|Failed to load resource/i.test(m.text())) errors.push(`console: ${m.text()}`); });

await ctx.route(`${API}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
  const p = url.pathname;
  if (p.endsWith("/auth/v1/token")) return json({ access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: 4102444800, refresh_token: "r", user });
  if (p.endsWith("/auth/v1/user")) return json(user);
  if (p.includes("/rest/v1/rpc/finance_summary")) return json([summary]);
  if (p.includes("/rest/v1/rpc/record_payment")) {
    calls.push({ rpc: "record_payment", body: JSON.parse(req.postData() ?? "{}") });
    payAttempts++;
    if (payAttempts === 1) return json({ message: "Failed to fetch" }, 503); // gangguan jaringan pada percobaan pertama
    return json("pay-new");
  }
  if (p.includes("/rest/v1/")) {
    const table = p.split("/rest/v1/")[1];
    if (req.method() === "GET") {
      const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
      if (table === "wedding_members") return json(single ? { wedding_id: W, role: "owner" } : [{ wedding_id: W, role: "owner" }]);
      if (table === "weddings") return json(single ? data.weddings : [data.weddings]);
      if (table === "budget_items") return json(single ? { ...items[0], id: "i1", revision: 3 } : [{ ...items[0], id: "i1", revision: 3 }]);
      return json(data[table] ?? []);
    }
    calls.push({ table, method: req.method(), body: JSON.parse(req.postData() ?? "null") });
    return json([{ id: "new" }], 201);
  }
  return json({});
});
await ctx.route("**/realtime/**", (r) => r.abort());

const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });

// 1. Belum login -> halaman masuk
await page.goto(BASE);
await page.waitForURL("**/masuk");
await shot("01-masuk");
await page.getByLabel("Email").fill("adi@example.com");
await page.getByLabel("Kata sandi").fill("rahasia123");
await page.getByRole("button", { name: "Masuk", exact: true }).click();
await page.waitForURL("**/beranda");

// 2. Beranda
await page.getByText("Adi & Sari").waitFor();
assert.ok(await page.getByText("42%").first().isVisible(), "progres 42% tampil");
assert.ok(await page.getByText("Rp42.000.000").first().isVisible());
const days = await page.locator("p.text-6xl").innerText();
assert.match(days, /^\d+$/);
await shot("02-beranda");

// 3. Keuangan
await page.getByRole("link", { name: "Keuangan" }).click();
await page.waitForURL("**/keuangan");
await page.getByText("Gedung Contoh").waitFor();
assert.ok(await page.getByText("Kelebihan bayar").isVisible(), "status kelebihan bayar tampil");
assert.ok(await page.getByText("-Rp100.000").first().isVisible(), "sisa negatif ditampilkan apa adanya");
await shot("03-keuangan");

// 4. Catat pembayaran; percobaan pertama gagal, ulang memakai request ID yang SAMA
await page.getByText("Gedung Contoh").click();
const dlg = page.getByRole("dialog");
await dlg.getByLabel("Jumlah (Rp)").fill("2.000.000");
await dlg.getByRole("button", { name: "Simpan", exact: true }).last().click();
await dlg.getByRole("alert").first().waitFor();
await shot("04-pembayaran-gagal");
await dlg.getByRole("button", { name: "Simpan", exact: true }).last().click();
await page.waitForFunction(() => document.querySelectorAll("[role=dialog]").length >= 0);
await page.waitForTimeout(400);
const pays = calls.filter((c) => c.rpc === "record_payment");
assert.equal(pays.length, 2, "dua percobaan");
assert.equal(pays[0].body.p_request_id, pays[1].body.p_request_id, "request ID sama saat retry");
assert.equal(pays[1].body.p_amount, 2000000);
assert.equal(pays[1].body.p_funding, "wedding_fund");

// 5. Tamu
await page.keyboard.press("Escape");
await page.getByRole("link", { name: "Tamu" }).click();
await page.waitForURL("**/tamu");
await page.getByText("Tamu Contoh 1", { exact: true }).waitFor();
assert.ok(await page.getByText(/belum lengkap/).first().isVisible(), "headcount belum lengkap ditandai");
await page.getByText("Tamu Contoh 5", { exact: true }).click();
await dlg.getByLabel("RSVP").selectOption("attending");
await dlg.getByLabel("Jumlah orang diundang (opsional)").fill("2");
await dlg.getByLabel("Jumlah yang hadir").fill("3");
assert.ok(await dlg.getByText("tidak boleh melebihi").isVisible(), "validasi hadir > diundang");
assert.ok(await dlg.getByRole("button", { name: "Simpan" }).isDisabled());
await shot("05-tamu-validasi");

// 6. Nav + a11y dasar
await page.keyboard.press("Escape");
for (const [name, path] of [["Persiapan", "persiapan"], ["Vendor", "vendor"], ["Beranda", "beranda"]]) {
  await page.getByRole("link", { name }).click();
  await page.waitForURL(`**/${path}`);
}
const small = await page.evaluate(() => [...document.querySelectorAll("a,button,input,select")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44) && !e.closest("[hidden]") && e.type !== "checkbox"; }).map((e) => `${e.tagName} ${e.textContent?.slice(0, 20)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
console.log("target sentuh < 44px:", small.length ? small : "tidak ada");
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "tanpa scroll horizontal");

// 7. Layar kecil (320px) + text scaling 150%: tidak ada rupiah/label nav terpotong, tanpa scroll horizontal
await page.setViewportSize({ width: 320, height: 640 });
await page.evaluate(() => { document.documentElement.style.fontSize = "150%"; });
for (const path of ["beranda", "keuangan", "tamu", "persiapan", "vendor"]) {
  await page.goto(`${BASE}/${path}`);
  await page.waitForSelector("nav[aria-label='Menu utama']");
  await page.evaluate(() => { document.documentElement.style.fontSize = "150%"; });
  await page.waitForTimeout(300);
  const clipped = await page.evaluate(() => {
    const bad = [];
    const els = [...document.querySelectorAll("nav span, p, h1, button, span")].filter((e) => /Rp\s?-?\d|^(Beranda|Keuangan|Persiapan|Vendor|Tamu)$/.test(e.textContent?.trim() ?? "") && e.children.length === 0);
    for (const e of els) {
      const r = e.getBoundingClientRect();
      let cut = r.right > window.innerWidth + 1 || r.left < -1;
      for (let a = e.parentElement; a && !cut; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== "visible") { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 1 || r.left < ar.left - 1) cut = true; }
      }
      // teks yang dipotong dengan elipsis (truncate) juga dianggap terpotong
      const own = getComputedStyle(e);
      if (own.textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1) cut = true;
      if (cut) bad.push(`${e.textContent?.trim()} (${Math.round(r.left)}..${Math.round(r.right)} / ${window.innerWidth})`);
    }
    return bad;
  });
  assert.deepEqual(clipped, [], `terpotong di /${path}: ${clipped.join(", ")}`);
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  const wide = sw[0] > sw[1] ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 6).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)} ${Math.round(e.getBoundingClientRect().right)}`)) : [];
  assert.ok(sw[0] <= sw[1], `scroll horizontal di /${path}: ${sw[0]} > ${sw[1]} ${wide.join(" | ")}`);
  const overflowMoney = await page.evaluate(() => [...document.querySelectorAll("p,h1,span,dd")].filter((e) => e.children.length === 0 && /Rp\s?-?\d/.test(e.textContent ?? "") && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  assert.deepEqual(overflowMoney, [], `angka rupiah meluap di /${path}`);
  if (path === "keuangan" || path === "beranda") await page.screenshot({ path: `${OUT}/06-${path}-320-teks150.png` });
}

await browser.close();
assert.deepEqual(errors, [], `galat runtime: ${errors.join(" | ")}`);
console.log("SMOKE UI LOLOS");
