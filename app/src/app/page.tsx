"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SetupNotice } from "@/components/setup-notice";
import { Loading } from "@/components/ui";
import { useSession } from "@/lib/hooks";
import { isConfigured } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const { session, ready } = useSession();
  useEffect(() => {
    if (ready && isConfigured) router.replace(session ? "/beranda" : "/masuk");
  }, [ready, session, router]);
  if (!isConfigured) return <SetupNotice />;
  return <Loading />;
}
