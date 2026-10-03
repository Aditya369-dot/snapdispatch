"use client";

import { pilotFetch, type Me } from "@/components/pilot/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PilotLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner.staging@synthetic.example");
  const [password, setPassword] = useState("synthetic-dev-password");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const result = await pilotFetch<Me>("/api/v1/session", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (result.status !== 200) {
      setError(result.body.error?.message ?? "Sign-in failed.");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form className="rounded-lg border bg-white p-4" onSubmit={(event) => void onSubmit(event)}>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-[#5c6b80]">
        Separate accounts for the owner, dispatcher, and drivers. This is not the pitch role switcher.
      </p>
      <label className="mt-4 block text-sm">
        Email
        <input className="mt-1 w-full rounded-md border px-2 py-1" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
      </label>
      <label className="mt-3 block text-sm">
        Password
        <input className="mt-1 w-full rounded-md border px-2 py-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
      </label>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button className="mt-4 rounded-md bg-[#0c2340] px-3 py-1.5 text-sm text-white" type="submit">
        Sign in
      </button>
    </form>
  );
}
