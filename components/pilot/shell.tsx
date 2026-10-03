"use client";

import { pilotFetch, type Me } from "@/components/pilot/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export function PilotShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const login = pathname === "/app/login";

  useEffect(() => {
    let cancelled = false;
    pilotFetch<Me>("/api/v1/me").then((result) => {
      if (cancelled) return;
      setMe(result.status === 200 ? result.body : null);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function signOut() {
    await pilotFetch("/api/v1/session", { method: "DELETE" });
    setMe(null);
    router.push("/app/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-[#f4f6f9] text-[#152033]">
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
        Technical workflow checkpoint on synthetic data. Not live-customer ready. Driver-pay calculations are disabled.
        Completion, cancellation, handoffs, and empty returns stay open.{" "}
        <Link className="underline" href="/">
          Pitch demo
        </Link>
      </div>
      {login ? (
        <div className="mx-auto max-w-md px-4 py-8">{children}</div>
      ) : (
        <>
          <header className="flex flex-wrap items-center gap-3 border-b bg-white px-4 py-3">
            <Link href="/app" className="font-semibold text-[#0c2340]">
              SnapDispatch checkpoint
            </Link>
            <nav className="flex flex-wrap gap-3 text-sm">
              <Link href="/app">Loads</Link>
              {me && me.role !== "driver" ? <Link href="/app/loads/new">New load</Link> : null}
              <Link href="/app/roster">Roster</Link>
              <Link href="/app/expenses">Expenses</Link>
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              {me ? (
                <>
                  <span>
                    {me.displayName} · {me.role}
                  </span>
                  <button className="rounded-md border px-2 py-1" onClick={() => void signOut()} type="button">
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/app/login">Sign in</Link>
              )}
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl px-4 py-4">{children}</main>
        </>
      )}
    </div>
  );
}
