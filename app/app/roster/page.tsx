"use client";

import { pilotFetch, type Me } from "@/components/pilot/client";
import { useEffect, useState } from "react";

export default function RosterPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [trucks, setTrucks] = useState<{ id: string; unit: string; operational: string }[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; displayName: string; availability: string }[]>([]);
  const [reminders, setReminders] = useState<{ id: string; unit: string; title: string; dueOn: string; notes: string }[]>([]);
  const [miles, setMiles] = useState("");
  const [truckId, setTruckId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    pilotFetch<Me>("/api/v1/me").then((result) => {
      if (result.status === 200) setMe(result.body);
    });
    pilotFetch<{ trucks: typeof trucks }>("/api/v1/trucks").then((result) => {
      if (result.status === 200) setTrucks(result.body.trucks ?? []);
    });
    pilotFetch<{ drivers: typeof drivers }>("/api/v1/drivers").then((result) => {
      if (result.status === 200) setDrivers(result.body.drivers ?? []);
    });
    pilotFetch<{ reminders: typeof reminders }>("/api/v1/maintenance").then((result) => {
      if (result.status === 200) setReminders(result.body.reminders ?? []);
    });
  }, []);

  async function submitMileage(event: React.FormEvent) {
    event.preventDefault();
    const result = await pilotFetch("/api/v1/mileage", {
      method: "POST",
      body: JSON.stringify({
        truckId,
        miles: Number(miles),
        reportedOn: "2026-10-03",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    setMessage(result.status === 200 ? "Mileage stored once for that key." : (result.body.error?.message ?? "Mileage failed."));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Roster</h1>
      <p className="text-sm text-[#5c6b80]">{trucks.length} trucks · {drivers.length} drivers. Maintenance reminders are synthetic.</p>
      <ul className="rounded-lg border bg-white text-sm">
        {trucks.map((truck) => (
          <li key={truck.id} className="flex justify-between border-b px-3 py-2 last:border-b-0">
            <span>{truck.unit}</span>
            <span>{truck.operational}</span>
          </li>
        ))}
      </ul>
      <ul className="rounded-lg border bg-white text-sm">
        {drivers.map((driver) => (
          <li key={driver.id} className="flex justify-between border-b px-3 py-2 last:border-b-0">
            <span>{driver.displayName}</span>
            <span>{driver.availability}</span>
          </li>
        ))}
      </ul>
      <section className="rounded-lg border bg-white p-3 text-sm">
        <h2 className="font-medium">Maintenance reminders</h2>
        <ul className="mt-2 space-y-1">
          {reminders.map((reminder) => (
            <li key={reminder.id}>{reminder.unit} · {reminder.title} · due {reminder.dueOn}</li>
          ))}
        </ul>
      </section>
      {me?.role === "driver" ? (
        <form className="rounded-lg border bg-white p-3" onSubmit={(event) => void submitMileage(event)}>
          <h2 className="font-medium">Report miles</h2>
          <select className="mt-2 w-full rounded-md border px-2 py-1" value={truckId} onChange={(event) => setTruckId(event.target.value)} required>
            <option value="">Truck</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>{truck.unit}</option>
            ))}
          </select>
          <input className="mt-2 w-full rounded-md border px-2 py-1" value={miles} onChange={(event) => setMiles(event.target.value)} placeholder="Miles" required />
          <button className="mt-2 rounded-md bg-[#0c2340] px-3 py-1.5 text-sm text-white" type="submit">Save</button>
          {message ? <p className="mt-2 text-sm">{message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
