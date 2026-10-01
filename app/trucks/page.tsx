"use client";

import { PageHeader, TonePill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { miles } from "@/lib/format";
import { maintenanceTone, needsService } from "@/lib/metrics";
import { useDemo } from "@/lib/store";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const TONE_LABEL = {
  healthy: "Healthy",
  due_soon: "Due soon",
  overdue: "Overdue",
  out_of_service: "Out of service",
} as const;

export default function TrucksPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading trucks…</p>}>
      <TrucksScreen />
    </Suspense>
  );
}

function TrucksScreen() {
  const demo = useDemo();
  const attention = useSearchParams().get("attention") === "service";
  const [mileWindow, setMileWindow] = useState(String(demo.thresholds.miles));
  const [dayWindow, setDayWindow] = useState(String(demo.thresholds.days));
  const rows = demo.trucks.filter((truck) => (attention ? needsService(truck, demo.thresholds) : true));
  return (
    <div>
      <PageHeader title="Trucks & maintenance" description="One truck is down, one service is overdue, and one is coming due. The rest are healthy." />
      <form
        className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          demo.setThresholds(Number(mileWindow), Number(dayWindow));
        }}
      >
        <Label>
          Due soon within miles
          <Input className="mt-1 w-28" value={mileWindow} onChange={(event) => setMileWindow(event.target.value)} />
        </Label>
        <Label>
          or days
          <Input className="mt-1 w-24" value={dayWindow} onChange={(event) => setDayWindow(event.target.value)} />
        </Label>
        <Button type="submit" variant="outline">Update thresholds</Button>
        <p className="text-xs text-[#5c6b80]">Sample rule only. It changes which trucks show as coming due.</p>
      </form>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
            <tr>
              {["Unit", "Equipment", "Driver", "Odometer", "Status", "Next service", "Maintenance"].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((truck) => {
              const tone = maintenanceTone(truck, demo.thresholds);
              return (
                <tr key={truck.id} className="border-t">
                  <td className="px-3 py-1.5">
                    <Link className="font-medium text-[#1d6fe8]" href={`/trucks/${truck.id}`}>{truck.unit}</Link>
                  </td>
                  <td className="px-3 py-1.5">{truck.year} {truck.make} {truck.model}</td>
                  <td className="px-3 py-1.5">{demo.drivers.find((driver) => driver.id === truck.driverId)?.name ?? "—"}</td>
                  <td className="px-3 py-1.5 tabular-nums">{miles(truck.odometer)}</td>
                  <td className="px-3 py-1.5">{truck.operational === "out_of_service" ? "Out of service" : "In service"}</td>
                  <td className="px-3 py-1.5">{truck.nextServiceDate} · {miles(truck.nextServiceMiles)}</td>
                  <td className="px-3 py-1.5">
                    <TonePill tone={tone === "healthy" ? "ok" : tone === "due_soon" ? "warn" : "late"}>{TONE_LABEL[tone]}</TonePill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
