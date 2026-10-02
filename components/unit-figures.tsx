"use client";

import { fill } from "@/lib/i18n/say";
import { useI18n } from "@/lib/i18n";
import { formatDate, gallons, miles, money } from "@/lib/format";
import { useDemo } from "@/lib/store";
import { healTruck, unitCost } from "@/lib/units";
import type { Truck } from "@/lib/types";
import { cn } from "cn";

export function useUnitFigures(truck: Truck) {
  const demo = useDemo();
  const unit = healTruck(truck);
  const cost = unitCost(unit.id, demo.expenses, demo.serviceRecords, demo.issues);
  return { unit, cost };
}

export function UnitFigures({ truck, variant = "card" }: { truck: Truck; variant?: "card" | "detail" | "strip" }) {
  const { c } = useI18n();
  const { unit, cost } = useUnitFigures(truck);
  const asOf = formatDate(`${unit.asOf}T12:00:00-07:00`);
  const start = formatDate(`${unit.periodStart}T12:00:00-07:00`);
  const labels = c.trucks;

  if (variant === "strip") {
    return (
      <p className="text-xs text-[#5c6b80]">
        <span className="font-medium text-[#152033]">{labels.asOf}</span> {asOf}
        {" · "}
        <span className="font-medium text-[#152033]">{labels.gallons}</span> {gallons(unit.gallons)}
        {" · "}
        <span className="font-medium text-[#152033]">{labels.miles}</span> {miles(unit.periodMiles)}
        {" · "}
        <span className="font-medium text-[#152033]">{labels.expenses}</span> {money(cost.total)}
      </p>
    );
  }

  const cells = [
    { label: labels.asOf, value: asOf, hint: fill(labels.period, { start, end: asOf }) },
    { label: labels.gallons, value: gallons(unit.gallons), hint: labels.fuelLog },
    { label: labels.miles, value: miles(unit.periodMiles), hint: fill(labels.odoLine, { miles: miles(unit.odometer) }) },
    { label: labels.expenses, value: money(cost.total), hint: labels.expensesOnFile },
  ];

  return (
    <div className={cn(variant === "detail" && "rounded-lg border bg-white p-3")}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-md bg-[#f8fafc] px-2.5 py-2">
            <p className="text-[11px] font-medium tracking-wide text-[#5c6b80] uppercase">{cell.label}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{cell.value}</p>
            <p className="text-[11px] text-[#5c6b80]">{cell.hint}</p>
          </div>
        ))}
      </div>
      {variant === "detail" ? (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <Line label={labels.fuelReceipts} value={money(cost.fuel)} />
            <Line label={labels.tollReceipts} value={money(cost.tolls)} />
            <Line label={labels.otherReceipts} value={money(cost.other)} />
            <Line label={labels.shop} value={money(cost.maintenance)} />
            <Line label={labels.total} value={money(cost.total)} strong />
          </div>
          <div>
            <Line label={labels.pending} value={money(cost.pending)} />
            <Line label={labels.openEstimate} value={money(cost.openEstimate)} />
            <p className="mt-2 text-[11px] leading-4 text-[#5c6b80]">{labels.totalHint}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#5c6b80]">{labels.demoNote}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3 py-0.5", strong && "font-semibold")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
