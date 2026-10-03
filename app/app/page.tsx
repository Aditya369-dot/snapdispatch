"use client";

import { pilotFetch, type Me } from "@/components/pilot/client";
import { formatInZone } from "@/lib/pilot/time";
import Link from "next/link";
import { useEffect, useState } from "react";

type LoadList = {
  displayTimezone?: string;
  loads?: {
    id: string;
    reference: string;
    status: string;
    appointmentStart: string;
    driverId: string | null;
  }[];
};

export default function PilotHomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [day, setDay] = useState("");
  const [loads, setLoads] = useState<LoadList["loads"]>([]);
  const [zone, setZone] = useState("UTC");
  const [error, setError] = useState("");

  useEffect(() => {
    pilotFetch<Me>("/api/v1/me").then((result) => {
      if (result.status !== 200) {
        setError("Sign in to see loads.");
        return;
      }
      setMe(result.body);
      setZone(result.body.displayTimezone);
    });
  }, []);

  useEffect(() => {
    if (!me) return;
    const query = day ? `?businessDay=${day}` : "";
    pilotFetch<LoadList>(`/api/v1/loads${query}`).then((result) => {
      if (result.status !== 200) {
        setError(result.body.error?.message ?? "Could not load.");
        return;
      }
      setLoads(result.body.loads ?? []);
      if (result.body.displayTimezone) setZone(result.body.displayTimezone);
    });
  }, [me, day]);

  return (
    <div>
      <h1 className="text-xl font-semibold">Loads</h1>
      <p className="mt-1 text-sm text-[#5c6b80]">
        Times are stored in UTC and shown in {zone}. Business day uses that zone. Two browsers should use two accounts.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>Owner or dispatcher creates a load and assigns a driver and truck.</li>
        <li>That driver signs in on another browser, acknowledges, and posts progress.</li>
        <li>The driver uploads a receipt and a POD. The owner approves or rejects them. No pay is posted.</li>
      </ol>
      <label className="mt-4 block text-sm">
        Business day
        <input className="ml-2 rounded-md border px-2 py-1" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
      </label>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <ul className="mt-4 divide-y rounded-lg border bg-white">
        {(loads ?? []).map((load) => (
          <li key={load.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <Link className="font-medium underline" href={`/app/loads/${load.id}`}>
              {load.reference}
            </Link>
            <span>{load.status}</span>
            <span className="text-[#5c6b80]">{formatInZone(load.appointmentStart, zone)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
