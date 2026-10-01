"use client";

import { PageHeader } from "@/components/status-badge";
import { DELAY_LABEL } from "@/lib/labels";
import { delayTotals, driverReport } from "@/lib/metrics";
import { useDemo } from "@/lib/store";
import type { DelayReason } from "@/lib/types";

export default function ReportsPage() {
  const demo = useDemo();
  const rows = driverReport(demo);
  const delays = delayTotals(demo);
  return (
    <div>
      <PageHeader
        title="Driver performance"
        description="Ranked by completed loads in this demo window. Port and customer delays are listed so they are not treated as the driver’s fault. This report does not change pay."
      />
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
            <tr>
              {["Driver", "Completed", "Sample size", "Completion", "On time", "POD complete", "Delays"].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.driver.id} className="border-t">
                <td className="px-3 py-1.5 font-medium">{index + 1}. {row.driver.name}</td>
                <td className="px-3 py-1.5 tabular-nums">{row.completed}</td>
                <td className="px-3 py-1.5 tabular-nums">{row.assignedInWindow} loads through today</td>
                <td className="px-3 py-1.5">{pct(row.completionRate)}</td>
                <td className="px-3 py-1.5">{row.onTimePool ? `${pct(row.onTimeRate)} · ${row.onTimeCount}/${row.onTimePool}` : "—"}</td>
                <td className="px-3 py-1.5">{row.podPool ? `${pct(row.podRate)} · ${row.podOk}/${row.podPool}` : "No import deliveries"}</td>
                <td className="px-3 py-1.5 text-xs">{row.delays.length ? row.delays.map((delay) => DELAY_LABEL[delay.reason]).join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="mt-3 rounded-lg border bg-white p-3 text-sm">
        <h2 className="font-semibold">Delay reasons in the book</h2>
        <ul className="mt-2 space-y-1">
          {delays.map(([reason, count]) => (
            <li key={reason}>
              {DELAY_LABEL[reason as DelayReason]} · {count}
              {reason === "port_congestion" || reason === "customer_delay" ? " · not scored against the driver" : ""}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[#5c6b80]">Small samples move the percentages a lot. There is no speed ranking and no automatic pay change.</p>
      </section>
    </div>
  );
}

function pct(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}
