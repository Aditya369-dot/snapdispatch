"use client";

import { pilotFetch, type Me } from "@/components/pilot/client";
import { formatInZone } from "@/lib/pilot/time";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Load = {
  id: string;
  reference: string;
  status: string;
  appointmentStart: string;
  appointmentEnd: string;
  driverId: string | null;
  truckId: string | null;
  customerRateCents: number | null;
  notes: string;
  events: { id: string; type: string; note: string; reportedStage: string | null; occurredAt: string; actorProfileId: string }[];
  documents: {
    id: string;
    kind: string;
    fileName: string;
    amountCents: number | null;
    reviewStatus: string;
    reviewNote: string;
    uploadCompletedAt: string | null;
  }[];
};

export default function LoadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [me, setMe] = useState<Me | null>(null);
  const [load, setLoad] = useState<Load | null>(null);
  const [drivers, setDrivers] = useState<{ id: string; displayName: string; availability: string }[]>([]);
  const [trucks, setTrucks] = useState<{ id: string; unit: string; operational: string }[]>([]);
  const [driverId, setDriverId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [note, setNote] = useState("");
  const [containerReturn, setContainerReturn] = useState(false);
  const [amount, setAmount] = useState("1234");
  const [message, setMessage] = useState("");
  const [zone, setZone] = useState("UTC");

  const reload = useCallback(async () => {
    const result = await pilotFetch<Load>(`/api/v1/loads/${id}`);
    if (result.status === 200) setLoad(result.body);
    else setMessage(result.body.error?.message ?? "Could not open this load.");
  }, [id]);

  useEffect(() => {
    pilotFetch<Me>("/api/v1/me").then((result) => {
      if (result.status === 200) {
        setMe(result.body);
        setZone(result.body.displayTimezone);
      }
    });
    pilotFetch<Load>(`/api/v1/loads/${id}`).then((result) => {
      if (result.status === 200) setLoad(result.body);
      else setMessage(result.body.error?.message ?? "Could not open this load.");
    });
  }, [id]);

  useEffect(() => {
    if (!me || me.role === "driver") return;
    pilotFetch<{ drivers: typeof drivers }>("/api/v1/drivers").then((result) => {
      if (result.status === 200) setDrivers(result.body.drivers ?? []);
    });
    pilotFetch<{ trucks: typeof trucks }>("/api/v1/trucks").then((result) => {
      if (result.status === 200) setTrucks(result.body.trucks ?? []);
    });
  }, [me]);

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    const result = await pilotFetch(`/api/v1/loads/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ driverId, truckId }),
    });
    setMessage(result.status === 200 ? "Assigned." : (result.body.error?.message ?? "Assign failed."));
    await reload();
  }

  async function acknowledge() {
    const result = await pilotFetch(`/api/v1/loads/${id}/acknowledge`, { method: "POST" });
    setMessage(result.status === 200 ? "Acknowledged." : (result.body.error?.message ?? "Acknowledge failed."));
    await reload();
  }

  async function progress(event: React.FormEvent) {
    event.preventDefault();
    const result = await pilotFetch(`/api/v1/loads/${id}/progress`, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        note,
        reportedStage: containerReturn ? "container_return" : null,
      }),
    });
    setMessage(result.status === 200 ? "Progress saved." : (result.body.error?.message ?? "Progress failed."));
    await reload();
  }

  async function upload(kind: "receipt" | "pod", file: File | null) {
    if (!file) return;
    const result = await pilotFetch<{ uploadUrl: string; uploadHeaders: Record<string, string>; document: { id: string } }>(
      `/api/v1/loads/${id}/documents`,
      {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          kind,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
          amountCents: kind === "receipt" ? Number(amount) : null,
        }),
      },
    );
    if (result.status !== 201) {
      setMessage(result.body.error?.message ?? "Upload registration failed.");
      return;
    }
    const put = await fetch(result.body.uploadUrl, {
      method: "PUT",
      headers: result.body.uploadHeaders,
      body: file,
    });
    if (!put.ok) {
      setMessage("Storage did not accept the file. The document is not complete.");
      return;
    }
    const done = await pilotFetch(`/api/v1/documents/${result.body.document.id}/complete`, { method: "POST" });
    setMessage(done.status === 200 ? "File stored." : (done.body.error?.message ?? "Storage was not confirmed."));
    await reload();
  }

  async function review(documentId: string, decision: "approved" | "rejected") {
    const noteText = decision === "rejected" ? "Rejected in the checkpoint. No pay posted." : "";
    const result = await pilotFetch(`/api/v1/documents/${documentId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, note: noteText }),
    });
    setMessage(result.status === 200 ? "Review saved. No pay was posted." : (result.body.error?.message ?? "Review failed."));
    await reload();
  }

  if (!load) return <p className="text-sm">{message || "Loading…"}</p>;
  const office = me && me.role !== "driver";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{load.reference}</h1>
        <p className="text-sm text-[#5c6b80]">
          {load.status} · {formatInZone(load.appointmentStart, zone)} – {formatInZone(load.appointmentEnd, zone)}
        </p>
        <p className="text-sm">Typed customer rate: {load.customerRateCents == null ? "not entered" : `${load.customerRateCents} cents`}. Pay is not calculated.</p>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      {office && (load.status === "created" || load.status === "assigned") ? (
        <form className="rounded-lg border bg-white p-3" onSubmit={(event) => void assign(event)}>
          <h2 className="font-medium">Assign</h2>
          <select className="mt-2 w-full rounded-md border px-2 py-1" value={driverId} onChange={(event) => setDriverId(event.target.value)} required>
            <option value="">Driver</option>
            {drivers.filter((driver) => driver.availability === "available").map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.displayName}</option>
            ))}
          </select>
          <select className="mt-2 w-full rounded-md border px-2 py-1" value={truckId} onChange={(event) => setTruckId(event.target.value)} required>
            <option value="">Truck</option>
            {trucks.filter((truck) => truck.operational === "in_service").map((truck) => (
              <option key={truck.id} value={truck.id}>{truck.unit}</option>
            ))}
          </select>
          <button className="mt-2 rounded-md bg-[#0c2340] px-3 py-1.5 text-sm text-white" type="submit">Assign</button>
        </form>
      ) : null}
      {me?.role === "driver" && load.status === "assigned" ? (
        <button className="rounded-md bg-[#0c2340] px-3 py-1.5 text-sm text-white" onClick={() => void acknowledge()} type="button">
          Acknowledge
        </button>
      ) : null}
      {me?.role === "driver" && (load.status === "accepted" || load.status === "in_progress") ? (
        <form className="rounded-lg border bg-white p-3" onSubmit={(event) => void progress(event)}>
          <h2 className="font-medium">Progress</h2>
          <textarea className="mt-2 w-full rounded-md border px-2 py-1" value={note} onChange={(event) => setNote(event.target.value)} required />
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={containerReturn} onChange={(event) => setContainerReturn(event.target.checked)} />
            Report container return (assumption only — not a required step)
          </label>
          <button className="mt-2 rounded-md bg-[#0c2340] px-3 py-1.5 text-sm text-white" type="submit">Post update</button>
          <div className="mt-4 space-y-2 text-sm">
            <label>
              Receipt amount (cents)
              <input className="ml-2 rounded-md border px-2 py-1" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label className="block">
              Receipt
              <input className="mt-1 block" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => void upload("receipt", event.target.files?.[0] ?? null)} />
            </label>
            <label className="block">
              POD
              <input className="mt-1 block" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => void upload("pod", event.target.files?.[0] ?? null)} />
            </label>
          </div>
        </form>
      ) : null}
      <section className="rounded-lg border bg-white p-3">
        <h2 className="font-medium">Events</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {load.events.map((event) => (
            <li key={event.id}>
              {event.type} · {formatInZone(event.occurredAt, zone)} {event.note} {event.reportedStage ? `· ${event.reportedStage}` : ""}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg border bg-white p-3">
        <h2 className="font-medium">Documents</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {load.documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center gap-2">
              <span>
                {document.kind} · {document.fileName} · {document.reviewStatus}
                {document.amountCents != null ? ` · ${document.amountCents} cents` : ""}
                {document.uploadCompletedAt ? "" : " · waiting for storage"}
              </span>
              {document.uploadCompletedAt ? (
                <a className="underline" href={`/api/v1/documents/${document.id}/file`}>
                  Download
                </a>
              ) : null}
              {me?.role === "owner" && document.uploadCompletedAt && document.reviewStatus === "pending" ? (
                <>
                  <button className="rounded-md border px-2 py-1" type="button" onClick={() => void review(document.id, "approved")}>Approve</button>
                  <button className="rounded-md border px-2 py-1" type="button" onClick={() => void review(document.id, "rejected")}>Reject</button>
                </>
              ) : null}
              {document.reviewNote ? <span className="text-[#5c6b80]">{document.reviewNote}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
