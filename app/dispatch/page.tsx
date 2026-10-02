"use client";

import { AssignSheet } from "@/components/assign-sheet";
import { PageHeader, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reached } from "@/lib/flow";
import { loadRevenue } from "@/lib/finance";
import { addMinutes, formatTime, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/say";
import { laneLabel } from "@/lib/metrics";
import { CUSTOMERS, PITCH_LOAD_ID, PLACES, customer } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import { WALK_STEPS } from "@/lib/walkthrough";
import type { Load, LoadType } from "@/lib/types";
import { cn } from "cn";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";

export default function DispatchPage() {
  const { c } = useI18n();
  return (
    <Suspense fallback={<p className="text-sm text-[#5c6b80]">{c.loadingDispatch}</p>}>
      <DispatchScreen />
    </Suspense>
  );
}

function DispatchScreen() {
  const { c } = useI18n();
  const d = c.dispatch;
  const demo = useDemo();
  const params = useSearchParams();
  const [mode, setMode] = useState<"table" | "board">("table");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [driverId, setDriverId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignLoad, setAssignLoad] = useState<Load | null>(null);
  const assignment = params.get("assignment") ?? "all";
  const scope = params.get("scope") ?? "all";
  const walk = demo.walkthrough;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return demo.loads
      .filter((load) => {
        if (assignment === "unassigned" && load.status !== "created") return false;
        if (scope === "active" && load.status === "complete") return false;
        if (type !== "all" && load.type !== type) return false;
        if (driverId === "none" && load.driverId) return false;
        if (driverId !== "all" && driverId !== "none" && load.driverId !== driverId) return false;
        if (!needle) return true;
        const driver = demo.drivers.find((item) => item.id === load.driverId)?.name ?? "";
        const blob = [load.id, load.containerNumber, load.bookingNumber, customer(load.customerId)?.name, driver].join(" ").toLowerCase();
        return blob.includes(needle);
      })
      .sort((a, b) => {
        const aDone = a.status === "complete" ? 1 : 0;
        const bDone = b.status === "complete" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return a.appointmentStart.localeCompare(b.appointmentStart);
      });
  }, [assignment, demo.drivers, demo.loads, driverId, query, scope, type]);

  return (
    <div>
      <PageHeader
        title={d.title}
        description={d.description}
        actions={
          <>
            <div className="flex rounded-lg bg-[#eef2f6] p-0.5">
              <button className={cn("rounded-md px-2 py-1 text-xs", mode === "table" && "bg-white shadow-sm")} onClick={() => setMode("table")}>
                {d.table}
              </button>
              <button className={cn("rounded-md px-2 py-1 text-xs", mode === "board" && "bg-white shadow-sm")} onClick={() => setMode("board")}>
                {d.board}
              </button>
            </div>
            <Button onClick={() => setCreateOpen(true)}>{d.create}</Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={d.search} className="w-full sm:w-72" />
        <Filter value={type} onChange={setType} options={[["all", d.allTypes], ["import", c.import], ["export", c.export]]} />
        <Filter
          value={driverId}
          onChange={setDriverId}
          options={[["all", d.allDrivers], ["none", d.unassigned], ...demo.drivers.map((driver) => [driver.id, driver.name] as [string, string])]}
        />
        {(assignment !== "all" || scope !== "all") && (
          <Link href="/dispatch" className="self-center text-xs text-[#1d6fe8]">
            {d.clearFilters}
          </Link>
        )}
      </div>
      {mode === "table" ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[1100px] text-left text-[13px]">
            <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
              <tr>
                {[d.load, d.container, d.type, d.customer, d.lane, d.appointment, d.driver, d.truck, d.status, d.price, d.documents, ""].map((label) => (
                  <th key={label} className="px-2 py-2 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((load) => {
                const highlight = walk?.active && WALK_STEPS[walk.step]?.target === "pitch-load" && load.id === PITCH_LOAD_ID;
                return (
                  <tr
                    key={load.id}
                    data-tour={load.id === PITCH_LOAD_ID ? "pitch-load" : undefined}
                    className={cn("border-t hover:bg-[#f8fafc]", highlight && "ring-2 ring-[#1d6fe8] ring-inset")}
                    onClick={() => demo.markTour({ selectedLoadId: load.id })}
                  >
                    <td className="px-2 py-1.5">
                      <Link href={`/loads/${load.id}`} className="font-medium text-[#1d6fe8]">
                        {load.id}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5">{load.containerNumber}</td>
                    <td className="px-2 py-1.5">{load.type === "import" ? c.import : c.export}</td>
                    <td className="px-2 py-1.5">{customer(load.customerId)?.name}</td>
                    <td className="px-2 py-1.5">{laneLabel(load)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{formatTime(load.appointmentStart)}</td>
                    <td className="px-2 py-1.5">{demo.drivers.find((driver) => driver.id === load.driverId)?.name ?? "—"}</td>
                    <td className="px-2 py-1.5">{demo.trucks.find((truck) => truck.id === load.truckId)?.unit ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      <StatusBadge load={load} />
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{money(loadRevenue(load))}</td>
                    <td className="px-2 py-1.5">{docLabel(load, demo.documents, c)}</td>
                    <td className="px-2 py-1.5 text-right">
                      {load.status !== "complete" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          data-tour={load.id === PITCH_LOAD_ID ? "assign-pitch" : undefined}
                          className={walk?.active && walk.step === 1 && load.id === PITCH_LOAD_ID ? "ring-2 ring-[#1d6fe8]" : ""}
                          onClick={(event) => {
                            event.stopPropagation();
                            demo.markTour({ selectedLoadId: load.id });
                            setAssignLoad(load);
                          }}
                        >
                          {load.driverId ? d.reassign : d.assign}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="p-4 text-sm text-[#5c6b80]">{d.empty}</p> : null}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            [d.colUnassigned, (load: Load) => load.status === "created"],
            [d.colAssigned, (load: Load) => load.status === "assigned"],
            [d.colProgress, (load: Load) => ["accepted", "at_port", "picked_up", "at_customer", "delivered", "gated_in"].includes(load.status)],
            [d.colEmpty, (load: Load) => load.status === "empty_return_pending" || load.status === "empty_returned"],
            [d.colComplete, (load: Load) => load.status === "complete"],
          ].map(([title, test]) => (
            <div key={title as string} className="w-64 shrink-0 rounded-lg border bg-[#f8fafc]">
              <p className="border-b px-2 py-1.5 text-xs font-semibold">
                {title as string} · {rows.filter(test as (load: Load) => boolean).length}
              </p>
              <div className="space-y-2 p-2">
                {rows.filter(test as (load: Load) => boolean).slice(0, 8).map((load) => (
                  <button
                    key={load.id}
                    className="w-full rounded-md border bg-white p-2 text-left text-xs"
                    onClick={() => {
                      demo.markTour({ selectedLoadId: load.id });
                      setAssignLoad(load);
                    }}
                  >
                    <p className="font-medium">{load.containerNumber}</p>
                    <p className="text-[#5c6b80]">{customer(load.customerId)?.name}</p>
                    <p className="mt-1">{demo.drivers.find((driver) => driver.id === load.driverId)?.name ?? c.unassigned}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <AssignSheet load={assignLoad} open={Boolean(assignLoad)} onOpenChange={(open) => !open && setAssignLoad(null)} />
      <CreateLoadDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function docLabel(load: Load, documents: { loadId?: string; type: string; reviewStatus: "pending" | "approved" | "rejected" }[], c: ReturnType<typeof useI18n>["c"]) {
  if (load.type === "export") {
    const gate = documents.find((doc) => doc.loadId === load.id && doc.type === "gate_receipt");
    return gate ? fill(c.dispatch.gateStatus, { status: c.review[gate.reviewStatus] }) : reached(load, "gated_in") ? c.dispatch.gateMissing : "—";
  }
  if (!reached(load, "delivered")) return c.dispatch.podNotDue;
  const pod = documents.find((doc) => doc.loadId === load.id && doc.type === "pod");
  if (!pod) return c.dispatch.podMissing;
  return fill(c.dispatch.podStatus, { status: c.review[pod.reviewStatus] });
}

function Filter({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([id, label]) => (
          <SelectItem key={id} value={id}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateLoadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { c, text } = useI18n();
  const d = c.dispatch;
  const createLoad = useDemo((state) => state.createLoad);
  const router = useRouter();
  const [type, setType] = useState<LoadType>("import");
  const [container, setContainer] = useState("");
  const [booking, setBooking] = useState("");
  const [customerId, setCustomerId] = useState<string>(CUSTOMERS[0].id);
  const [pickup, setPickup] = useState("trapac");
  const [drop, setDrop] = useState("northbay");
  const [when, setWhen] = useState("2026-10-02T09:00");
  const [rate, setRate] = useState("750");
  const [notes, setNotes] = useState("");
  const places = Object.entries(PLACES);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{d.create}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="sm:col-span-2">
            {d.typeLabel}
            <Select value={type} onValueChange={(value) => setType(value as LoadType)}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="import">{c.import}</SelectItem>
                <SelectItem value="export">{c.export}</SelectItem>
              </SelectContent>
            </Select>
          </Label>
          <Field label={d.containerLabel} value={container} onChange={setContainer} placeholder={d.placeholderContainer} />
          <Field label={d.booking} value={booking} onChange={setBooking} />
          <Label className="sm:col-span-2">
            {d.customerLabel}
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMERS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <PlaceSelect label={d.pickup} value={pickup} onChange={setPickup} places={places} />
          <PlaceSelect label={d.destination} value={drop} onChange={setDrop} places={places} />
          <Field label={d.appointmentLabel} value={when} onChange={setWhen} type="datetime-local" />
          <Field label={d.rate} value={rate} onChange={setRate} />
          <Label className="sm:col-span-2">
            {d.notes}
            <Input className="mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Label>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              const start = when.length === 16 ? `${when}:00-07:00` : when;
              const result = createLoad({
                type,
                containerNumber: container,
                bookingNumber: booking,
                customerId,
                pickupKey: pickup,
                destinationKey: drop,
                appointmentStart: start,
                appointmentEnd: addMinutes(start, 180),
                customerRate: Number(rate),
                notes,
              });
              if (!result.ok) {
                toast.error(text(result.reason));
                return;
              }
              toast.success(fill(d.createdToast, { id: result.id ?? "" }));
              onOpenChange(false);
              if (result.id) router.push(`/loads/${result.id}`);
            }}
          >
            {d.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <Label>
      {label}
      <Input className="mt-1" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </Label>
  );
}

function PlaceSelect({
  label,
  value,
  onChange,
  places,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  places: [string, { name: string }][];
}) {
  return (
    <Label>
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {places.map(([key, place]) => (
            <SelectItem key={key} value={key}>
              {place.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Label>
  );
}
