import { safeAppPath, stagingAccessRequired } from "@/lib/pilot/staging-access";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Staging access · SnapDispatch",
  description: "Unlock the synthetic staging checkpoint. The public pitch is unchanged.",
};

export const dynamic = "force-dynamic";

export default async function StagingAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}) {
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const nextRaw = Array.isArray(query.next) ? query.next[0] : query.next;
  const next = safeAppPath(nextRaw);
  const required = stagingAccessRequired();

  return (
    <div className="min-h-dvh bg-[#f4f6f9] text-[#152033]">
      <form className="mx-auto mt-16 max-w-md rounded-lg border bg-white p-4" action="/api/staging-access" method="post">
        <h1 className="text-lg font-semibold">Staging access</h1>
        <p className="mt-1 text-sm text-[#5c6b80]">
          This gate covers <span className="font-medium">/app</span> and <span className="font-medium">/api/v1</span> when{" "}
          <span className="font-medium">SNAPDISPATCH_ENV</span> is staging and <span className="font-medium">STAGING_ACCESS_CODE</span> is
          set. The public pitch at <Link className="underline" href="/">/</Link> stays open. After this step, sign in at /app/login with a synthetic
          profile. That password is not a Supabase Auth user.
        </p>
        {required ? null : (
          <p className="mt-3 text-sm text-[#5c6b80]">
            The gate is off in this process. Continue to the checkpoint, or open the pitch.
          </p>
        )}
        {error === "denied" ? <p className="mt-3 text-sm text-red-700">That access code was not accepted.</p> : null}
        {error === "config" ? (
          <p className="mt-3 text-sm text-red-700">Set PILOT_SESSION_SECRET to at least 16 characters before using this gate.</p>
        ) : null}
        <input type="hidden" name="next" value={next} />
        <label className="mt-4 block text-sm">
          Access code
          <input className="mt-1 w-full rounded-md border px-2 py-1" name="code" type="password" autoComplete="off" />
        </label>
        <button className="mt-4 rounded-md bg-[#0c2340] px-3 py-1.5 text-sm text-white" type="submit">
          Continue
        </button>
        <p className="mt-4 text-sm">
          <Link className="underline" href="/">
            Public pitch
          </Link>
        </p>
      </form>
    </div>
  );
}
