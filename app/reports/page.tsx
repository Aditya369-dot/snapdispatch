"use client";

import { PageHeader } from "@/components/status-badge";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/say";
import { delayTotals, driverReport } from "@/lib/metrics";
import { useDemo } from "@/lib/store";
import type { DelayReason } from "@/lib/types";

export default function ReportsPage() {
  const { c } = useI18n();
  const demo = useDemo();
  const rows = driverReport(demo);
  const delays = delayTotals(demo);
  const r = c.reports;
  return (
    <div>
      <PageHeader title={r.title} description={r.description} />
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
            <tr>
              {[r.driver, r.completed, r.sample, r.completion, r.onTime, r.pod, r.delays].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.driver.id} className="border-t">
                <td className="px-3 py-1.5 font-medium">{index + 1}. {row.driver.name}</td>
                <td className="px-3 py-1.5 tabular-nums">{row.completed}</td>
                <td className="px-3 py-1.5 tabular-nums">{fill(r.loadsThrough, { count: row.assignedInWindow })}</td>
                <td className="px-3 py-1.5">{pct(row.completionRate)}</td>
                <td className="px-3 py-1.5">{row.onTimePool ? `${pct(row.onTimeRate)} · ${row.onTimeCount}/${row.onTimePool}` : "—"}</td>
                <td className="px-3 py-1.5">{row.podPool ? `${pct(row.podRate)} · ${row.podOk}/${row.podPool}` : r.noImports}</td>
                <td className="px-3 py-1.5 text-xs">{row.delays.length ? row.delays.map((delay) => c.delay[delay.reason]).join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="mt-3 rounded-lg border bg-white p-3 text-sm">
        <h2 className="font-semibold">{r.delayTitle}</h2>
        <ul className="mt-2 space-y-1">
          {delays.map(([reason, count]) => (
            <li key={reason}>
              {c.delay[reason as DelayReason]} · {count}
              {reason === "port_congestion" || reason === "customer_delay" ? ` · ${r.notScored}` : ""}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[#5c6b80]">{r.small}</p>
      </section>
    </div>
  );
}

function pct(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}
