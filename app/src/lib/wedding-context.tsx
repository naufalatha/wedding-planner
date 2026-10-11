"use client";
import { createContext, useContext } from "react";

export interface WeddingCtx { weddingId: string; role: "owner" | "partner"; email: string; userId: string }
const Ctx = createContext<WeddingCtx | null>(null);
export const WeddingProvider = Ctx.Provider;
export function useWedding(): WeddingCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWedding di luar WeddingProvider");
  return v;
}
