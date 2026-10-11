import { describe, expect, it } from "vitest";
import { ConflictError, friendlyError } from "./errors";

describe("pesan galat", () => {
  it("konflik revisi dijelaskan dan menyebut isian tidak hilang", () => {
    expect(friendlyError(new ConflictError())).toMatch(/diubah di perangkat lain.*tidak dihapus/);
  });
  it("galat Postgres/RPC dipetakan ke bahasa Indonesia", () => {
    expect(friendlyError({ message: "invalid_invitation" })).toMatch(/Kode undangan/);
    expect(friendlyError({ message: "refund_exceeds_payment" })).toMatch(/melebihi/);
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "vendors_one_selected_per_category"' })).toMatch(/vendor terpilih/);
    expect(friendlyError(new TypeError("Failed to fetch"))).toMatch(/Tidak ada koneksi/);
  });
  it("galat tak dikenal tidak membocorkan detail internal", () => {
    expect(friendlyError({ message: "relation public.secret does not exist" })).toBe("Terjadi kesalahan. Coba lagi.");
  });
});
