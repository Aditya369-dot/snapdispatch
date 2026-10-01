"use client";

import { PageHeader, StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { countsAsRevenue, loadRevenue, revenueStamp } from "@/lib/finance";
import { DEMO_DAY, dayKey, isThisWeek, money } from "@/lib/format";
import { customer } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function LoadsPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading loads…</p>}>
      <LoadsScreen />
    </Suspense>
  );
}

function LoadsScreen() {
  const loads = useDemo((state) => state.loads);
  const drivers = useDemo((state) => state.drivers);
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const completed = params.get("completed");
  const revenue = params.get("revenue");
  const rows = loads.filter((load) => {
    if (completed === "today" && !(load.status === "complete" && load.completedAt && dayKey(load.completedAt) === DEMO_DAY)) return false;
    if (revenue === "week") {
      const stamp = revenueStamp(load);
      if (!stamp || !countsAsRevenue(load) || !isThisWeek(stamp)) return false;
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [load.id, load.containerNumber, customer(load.customerId)?.name].join(" ").toLowerCase().includes(needle);
  });
  return (
    <div>
      <PageHeader
        title="Loads"
        description={
          completed === "today" ? "Loads completed today." : revenue === "week" ? "Loads that count toward this week’s delivered revenue." : "Every container in the demo book."
        }
      />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="mb-3 w-full sm:w-64" />
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
            <tr>
              {["Load", "Container", "Customer", "Driver", "Appointment", "Status", "Customer total"].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((load) => (
              <tr key={load.id} className="border-t">
                <td className="px-3 py-1.5">
                  <Link className="font-medium text-[#1d6fe8]" href={`/loads/${load.id}`}>{load.id}</Link>
                </td>
                <td className="px-3 py-1.5">{load.containerNumber}</td>
                <td className="px-3 py-1.5">{customer(load.customerId)?.name}</td>
                <td className="px-3 py-1.5">{drivers.find((driver) => driver.id === load.driverId)?.name ?? "—"}</td>
                <td className="px-3 py-1.5">{load.appointmentStart.slice(0, 16).replace("T", " ")}</td>
                <td className="px-3 py-1.5"><StatusBadge load={load} /></td>
                <td className="px-3 py-1.5 tabular-nums">{money(loadRevenue(load))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-4 text-sm text-[#5c6b80]">No loads in this view.</p> : null}
      </div>
    </div>
  );
}
