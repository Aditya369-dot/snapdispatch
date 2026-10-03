"use client";

import { pilotFetch } from "@/components/pilot/client";
import { zonedLocalToUtc } from "@/lib/pilot/time";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Option = { id: string; name: string };

export default function NewLoadPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Option[]>([]);
  const [places, setPlaces] = useState<Option[]>([]);
  const [zone, setZone] = useState("UTC");
  const [reference, setReference] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [pickupPlaceId, setPickupPlaceId] = useState("");
  const [destinationPlaceId, setDestinationPlaceId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rate, setRate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      pilotFetch<{ displayTimezone: string }>("/api/v1/me"),
      pilotFetch<{ customers: Option[] }>("/api/v1/customers"),
      pilotFetch<{ places: Option[] }>("/api/v1/places"),
    ]).then(([me, customerResult, placeResult]) => {
      if (me.status === 200) setZone(me.body.displayTimezone);
      if (customerResult.status === 200) setCustomers(customerResult.body.customers ?? []);
      if (placeResult.status === 200) setPlaces(placeResult.body.places ?? []);
    });
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const result = await pilotFetch<{ id: string }>("/api/v1/loads", {
      method: "POST",
      body: JSON.stringify({
        reference,
        customerId,
        pickupPlaceId,
        destinationPlaceId,
        appointmentStart: zonedLocalToUtc(start, zone),
        appointmentEnd: zonedLocalToUtc(end, zone),
        customerRateCents: rate === "" ? null : Number(rate),
        notes: "",
      }),
    });
    if (result.status !== 201) {
      setError(result.body.error?.message ?? "Could not create the load.");
      return;
    }
    router.push(`/app/loads/${result.body.id}`);
  }

  return (
    <form className="max-w-lg rounded-lg border bg-white p-4" onSubmit={(event) => void onSubmit(event)}>
      <h1 className="text-lg font-semibold">Create load</h1>
      <p className="mt-1 text-sm text-[#5c6b80]">Appointment times are interpreted in {zone}, then stored as UTC. A typed rate is not driver pay.</p>
      <label className="mt-3 block text-sm">
        Reference
        <input className="mt-1 w-full rounded-md border px-2 py-1" value={reference} onChange={(event) => setReference(event.target.value)} required />
      </label>
      <Select label="Customer" value={customerId} onChange={setCustomerId} options={customers} />
      <Select label="Pickup" value={pickupPlaceId} onChange={setPickupPlaceId} options={places} />
      <Select label="Destination" value={destinationPlaceId} onChange={setDestinationPlaceId} options={places} />
      <label className="mt-3 block text-sm">
        Appointment start
        <input className="mt-1 w-full rounded-md border px-2 py-1" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required />
      </label>
      <label className="mt-3 block text-sm">
        Appointment end
        <input className="mt-1 w-full rounded-md border px-2 py-1" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required />
      </label>
      <label className="mt-3 block text-sm">
        Typed customer rate (cents, optional)
        <input className="mt-1 w-full rounded-md border px-2 py-1" inputMode="numeric" value={rate} onChange={(event) => setRate(event.target.value)} />
      </label>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button className="mt-4 rounded-md bg-[#0c2340] px-3 py-1.5 text-sm text-white" type="submit">
        Create
      </button>
    </form>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <label className="mt-3 block text-sm">
      {label}
      <select className="mt-1 w-full rounded-md border px-2 py-1" value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Choose</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
