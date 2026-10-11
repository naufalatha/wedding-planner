/** Fixture sintetis yang meniru tata letak dump spreadsheet. Tidak berisi data nyata. */
type Cells = Record<number, string>;

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function line(cells: Cells): string {
  const max = Math.max(-1, ...Object.keys(cells).map(Number));
  return Array.from({ length: max + 1 }, (_, i) => csvCell(cells[i] ?? "")).join(",");
}
const sheet = (name: string, rows: Cells[]) => `## Sheet name: ${name}\n${rows.map(line).join("\n")}\n`;
const blank: Cells = {};

export function buildDump(): string {
  const master = sheet("Master", [
    { 4: "GROOM'S NAME", 5: "Adi Contoh" },
    { 4: "BRIDE'S NAME", 5: "Sari Contoh" },
    { 4: "SAVE THE DATE", 5: "Saturday, August 28, 2027" },
    { 4: "LOCATION", 5: "TBA - Kota Contoh" },
    blank,
    { 4: "TOTAL GUEST" },
    { 4: "3" },
  ]);

  const saving = sheet("Saving Tracker", [
    blank,
    { 4: "WEDDING SAVING TARGET" },
    blank,
    { 4: "Rp100,000,000" },
    blank, blank, blank, blank,
    { 4: "Month", 5: "Date", 7: "Contributor", 9: "Value" },
    { 4: "April", 5: "4/30/2025", 7: "Groom", 9: "Rp20,000,000" },
    { 4: "May", 5: "5/1/2025", 7: "Groom", 9: "Rp2,500,000" },
    { 4: "June", 5: "6/3/2025", 7: "Groom", 9: "Rp2,500,000" },
  ]);

  // 4 blok lebar 12 kolom: paperwork@3, seserahan@15, vendor@27, other@39
  const starts = [3, 15, 27, 39];
  const hdr: Cells = {};
  const sub: Cells = {};
  starts.forEach((s, k) => {
    hdr[s] = "No";
    if (k === 0) hdr[s + 1] = "Wedding Paperworks"; else { hdr[s + 1] = "Category"; hdr[s + 2] = "Items"; }
    hdr[s + 3] = "Due Date"; hdr[s + 4] = "Payment Date"; hdr[s + 5] = "Notes";
    hdr[s + 6] = "Estimated Price\n(Rp)"; hdr[s + 7] = "ACTUAL \n(Rp)"; hdr[s + 11] = "Status";
    sub[s + 7] = "REAL PRICE"; sub[s + 8] = "DP (Down Payment)"; sub[s + 9] = "Remaining Payment "; sub[s + 10] = "Total ";
  });
  const row = (cells: Cells) => cells;
  const budget = sheet("Budgeting Tracker", [
    blank,
    { 4: "WEDDING FUND CONTRIBUTOR", 7: "TOTAL PAID" },
    { 7: "Rp9,500,000" },
    { 4: "Budget Plan", 5: "Rp69,715,000.00" },
    blank, blank, blank, blank, blank, blank,
    hdr,
    sub,
    row({ 3: "1", 4: "Pas foto", 14: "Unpaid", 15: "1", 16: "Lifestyle", 17: "Tas Contoh", 21: "Rp1,500,000.00", 26: "Unpaid",
      27: "1", 28: "VENUE", 29: "GEDUNG CONTOH", 33: "Rp9,500,000.00", 34: "Rp9,500,000.00", 35: "Rp3,500,000.00", 36: "Rp5,500,000.00", 37: "Rp9,000,000.00", 38: "DP",
      39: "1", 40: "Food", 41: "[Input Category 5]" }),
    row({ 3: "2", 4: "KTP Ortu", 14: "Unpaid", 27: "2", 28: "DECORATION", 29: "DEKOR CONTOH", 33: "Rp13,000,000.00", 34: "Rp13,000,000.00", 35: "Rp1,000,000.00", 36: "Rp12,000,000.00", 37: "Rp13,000,000.00", 38: "DP" }),
  ]);

  const vendors = sheet("Vendors", [
    { 3: "VENDORS CHOICE" },
    { 3: "WEDDING ORGANIZER", 4: "0", 5: "0%" },
    blank,
    { 3: "WEDDING ORGANIZER" },
    blank,
    { 6: "FINAL CHOICE", 7: "NAME", 9: "CONTACT", 10: "EMAIL ADDRESS", 11: "PACKAGE #", 12: "AMOUNT", 13: "NOTES" },
    { 6: "FALSE", 7: "WO Satu", 9: "0815-0000-001", 12: "Rp17,500,000", 13: "catatan\nbaris dua" },
    { 6: "TRUE", 7: "WO Dua", 9: "0" },
    blank,
    { 3: "CATERING" },
    blank,
    { 6: "FINAL CHOICE", 7: "NAME", 9: "CONTACT", 10: "EMAIL ADDRESS", 11: "PACKAGE #", 12: "AMOUNT", 13: "NOTES" },
    { 6: "TRUE", 7: "Katering A" },
    { 6: "TRUE", 7: "Katering B" },
  ]);

  const timeline = sheet("Timeline", [
    { 4: "TIMELINE" },
    { 4: "12+ Months\nBefore the Wedding", 13: "6-12 Months\nBefore the Wedding" },
    blank, blank,
    { 4: "DONE", 5: "DEADLINE", 6: "PERSON IN CHARGE", 7: "PRIORITY", 8: "DESCRIPTION", 13: "DONE", 14: "DEADLINE", 15: "PERSON IN CHARGE", 16: "PRIORITY", 17: "DESCRIPTION" },
    { 4: "FALSE", 8: "List seserahan", 13: "TRUE", 17: "Hubungi vendor makeup" },
    { 4: "TRUE", 8: "Cari gedung", 13: "FALSE" },
    { 4: "FALSE" },
  ]);

  const guests = sheet("Guest List", [
    { 25: "TAG", 26: "Bride Family" },
    blank,
    { 36: "#", 37: "Guest Name", 38: "TAGS" }, // tabel filter di kanan: jangan salah dikira header
    { 7: "#", 8: "GUEST NAME", 9: "GUEST TAGS", 10: "SAVE THE DATE", 11: "INVITATION", 12: "RSVP RESPONSE", 21: "PHONE NUMBER" },
    { 7: "1", 8: "Tamu Satu dan Pasangan", 9: "Bride Friend", 11: "Not Sent", 21: "0812-1111" },
    { 7: "2", 8: "Tamu Dua", 9: "Groom Family", 11: "Sent", 12: "Unable to attend" },
    { 7: "3", 8: "Tamu Tiga", 11: "Not Sent" },
    { 7: "4" },
    { 7: "5" },
  ]);

  return [master, saving, budget, vendors, timeline, guests, sheet("Honeymoon", [blank])].join("\n");
}
