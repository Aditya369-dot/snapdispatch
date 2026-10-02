"use client";

import { PageHeader } from "@/components/status-badge";
import { driverBalance } from "@/lib/finance";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function DriversPage() {
  const { c } = useI18n();
  return (
    <Suspense fallback={<p className="text-sm">{c.loadingDrivers}</p>}>
      <DriversScreen />
    </Suspense>
  );
}

function DriversScreen() {
  const { c, text } = useI18n();
  const demo = useDemo();
  const outstandingOnly = useSearchParams().get("balance") === "outstanding";
  const d = c.drivers;
  const rows = demo.drivers
    .map((driver) => {
      const completed = demo.loads.filter((load) => load.driverId === driver.id && load.status === "complete").length;
      const earned = demo.ledger.filter((entry) => entry.driverId === driver.id && entry.type === "earning").reduce((sum, entry) => sum + entry.amount, 0);
      const reimbursements = demo.ledger.filter((entry) => entry.driverId === driver.id && entry.type === "reimbursement").reduce((sum, entry) => sum + entry.amount, 0);
      const payments = demo.ledger.filter((entry) => entry.driverId === driver.id && entry.type === "payment").reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
      return { driver, completed, earned, reimbursements, payments, balance: driverBalance(demo.ledger, driver.id) };
    })
    .filter((row) => (outstandingOnly ? row.balance > 0.009 : true));
  return (
    <div>
      <PageHeader title={d.title} description={outstandingOnly ? d.owed : d.all} />
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-[11px] tracking-wide text-[#5c6b80] uppercase">
            <tr>
              {[d.driver, d.truck, d.completed, d.earned, d.reimbursements, d.payments, d.balance].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.driver.id} className="border-t">
                <td className="px-3 py-1.5">
                  <Link className="font-medium text-[#1d6fe8]" href={`/drivers/${row.driver.id}`}>{row.driver.name}</Link>
                  <div className="text-[11px] text-[#5c6b80]">{row.driver.availability === "off" ? text(row.driver.availabilityNote ?? c.off) : c.available}</div>
                </td>
                <td className="px-3 py-1.5">{demo.trucks.find((truck) => truck.id === row.driver.truckId)?.unit ?? "—"}</td>
                <td className="px-3 py-1.5 tabular-nums">{row.completed}</td>
                <td className="px-3 py-1.5 tabular-nums">{money(row.earned)}</td>
                <td className="px-3 py-1.5 tabular-nums">{money(row.reimbursements)}</td>
                <td className="px-3 py-1.5 tabular-nums">{money(row.payments)}</td>
                <td className="px-3 py-1.5 font-medium tabular-nums">{money(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
