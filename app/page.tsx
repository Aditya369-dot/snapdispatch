"use client";

import { FleetMap } from "@/components/fleet-map";
import { PageHeader, StatusBadge, TonePill } from "@/components/status-badge";
import { formatTime, money } from "@/lib/format";
import { attentionItems, overviewMetrics, todayLoads, weekSeries } from "@/lib/metrics";
import { customer } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import { cn } from "cn";
import Link from "next/link";

export default function OverviewPage() {
  const demo = useDemo();
  const metrics = overviewMetrics(demo);
  const attention = attentionItems(demo).slice(0, 7);
  const series = weekSeries(demo);
  const max = Math.max(1, ...series.flatMap((day) => [day.revenue, day.costs]));
  const today = todayLoads(demo.loads);
  const activity = demo.activity.slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Westshore Drayage · Oakland · 12 trucks on the board this morning."
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi href="/dispatch?scope=active" label="Active loads" value={String(metrics.active.length)} hint="Not complete" />
        <Kpi href="/dispatch?assignment=unassigned" label="Unassigned loads" value={String(metrics.unassigned.length)} hint="Need a driver" />
        <Kpi href="/loads?completed=today" label="Completed today" value={String(metrics.completedToday.length)} hint="Closed this morning" />
        <Kpi href="/loads?revenue=week" label="Load revenue this week" value={money(metrics.weekRevenue)} hint="Delivered customer total" />
        <Kpi href="/drivers?balance=outstanding" label="Outstanding balances" value={money(metrics.outstanding)} hint="Owed to drivers" />
        <Kpi href="/trucks?attention=service" label="Trucks needing service" value={String(metrics.service.length)} hint="Overdue, soon, or down" />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-5">
        <section className="xl:col-span-3">
          <FleetMap variant="compact" />
        </section>
        <section className="rounded-lg border bg-white xl:col-span-2">
          <header className="border-b px-3 py-2 text-sm font-semibold">Needs attention</header>
          <ul className="divide-y">
            {attention.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-[#f4f6f9]">
                  <TonePill tone={item.tone}>{item.tone === "late" ? "Now" : "Watch"}</TonePill>
                  <span>
                    <span className="block font-medium">{item.title}</span>
                    <span className="text-xs text-[#5c6b80]">{item.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-5">
        <section className="overflow-hidden rounded-lg border bg-white xl:col-span-3">
          <header className="border-b px-3 py-2 text-sm font-semibold">Today’s dispatch</header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Load</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Driver</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {today.map((load) => (
                  <tr key={load.id} className="border-t">
                    <td className="px-3 py-1.5">
                      <Link href={`/loads/${load.id}`} className="font-medium text-[#1d6fe8]">
                        {load.id}
                      </Link>
                      <div className="text-[11px] text-[#5c6b80]">{load.containerNumber}</div>
                    </td>
                    <td className="px-3 py-1.5">{customer(load.customerId)?.name}</td>
                    <td className="px-3 py-1.5 tabular-nums">{formatTime(load.appointmentStart)}</td>
                    <td className="px-3 py-1.5">{demo.drivers.find((driver) => driver.id === load.driverId)?.name ?? "Unassigned"}</td>
                    <td className="px-3 py-1.5">
                      <StatusBadge load={load} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-lg border bg-white p-3 xl:col-span-2">
          <h2 className="text-sm font-semibold">Revenue vs recorded costs</h2>
          <p className="text-[11px] text-[#5c6b80]">Delivered customer total against posted driver pay and approved expenses.</p>
          <div className="mt-3 flex h-36 items-end gap-3">
            {series.map((day) => (
              <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-28 w-full items-end justify-center gap-1">
                  <div className="w-3 rounded-sm bg-[#1d6fe8]" style={{ height: `${(day.revenue / max) * 100}%` }} title={money(day.revenue)} />
                  <div className="w-3 rounded-sm bg-[#c4a574]" style={{ height: `${(day.costs / max) * 100}%` }} title={money(day.costs)} />
                </div>
                <span className="text-[10px] text-[#5c6b80]">{day.day.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 flex gap-3 text-[11px] text-[#5c6b80]">
            <span className="inline-flex items-center gap-1"><i className="inline-block size-2 rounded-sm bg-[#1d6fe8]" /> Revenue</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block size-2 rounded-sm bg-[#c4a574]" /> Recorded costs</span>
          </p>
        </section>
      </div>
      <section className="mt-3 rounded-lg border bg-white">
        <header className="border-b px-3 py-2 text-sm font-semibold">Recent driver activity</header>
        <ul className="divide-y">
          {activity.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
              <span>{item.message}</span>
              <span className="shrink-0 text-xs text-[#5c6b80]">{formatTime(item.at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ href, label, value, hint }: { href: string; label: string; value: string; hint: string }) {
  return (
    <Link href={href} className={cn("rounded-lg border bg-white px-3 py-2.5 transition-colors hover:border-[#1d6fe8]")}>
      <p className="text-[11px] font-medium tracking-wide text-[#5c6b80] uppercase">{label}</p>
      <p className="mt-1 text-[22px] leading-none font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-[#5c6b80]">{hint}</p>
    </Link>
  );
}
