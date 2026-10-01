"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { currentLoad, openLoadWarning, validateAssignment } from "@/lib/finance";
import { payRuleLabel } from "@/lib/labels";
import { maintenanceTone } from "@/lib/metrics";
import { PITCH_DRIVER_ID, PITCH_LOAD_ID, PITCH_TRUCK_ID, customer } from "@/lib/reference";
import { useDemo } from "@/lib/store";
import type { Load, WalkthroughState } from "@/lib/types";
import { useState } from "react";
import { toast } from "sonner";

export function AssignSheet({
  load,
  open,
  onOpenChange,
}: {
  load: Load | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const demo = useDemo();
  const walk = useDemo((state) => state.walkthrough);
  const preset = assignmentPreset(load, open, walk);
  const presetKey = `${open}:${load?.id ?? ""}:${preset.driverId ?? ""}:${preset.truckId ?? ""}`;
  const [seenKey, setSeenKey] = useState(presetKey);
  const [driverId, setDriverId] = useState<string | undefined>(preset.driverId);
  const [truckId, setTruckId] = useState<string | undefined>(preset.truckId);
  if (seenKey !== presetKey) {
    setSeenKey(presetKey);
    setDriverId(preset.driverId);
    setTruckId(preset.truckId);
  }

  if (!load) return null;
  const preview =
    driverId && truckId ? validateAssignment(demo, load.id, driverId, truckId) : { ok: false as const, reason: "Choose a driver and a truck." };
  const warning = driverId && truckId ? openLoadWarning(demo.loads, load.id, driverId, truckId) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{load.driverId ? "Reassign load" : "Assign driver"}</SheetTitle>
          <p className="text-sm text-[#5c6b80]">
            {load.id} · {load.containerNumber} · {customer(load.customerId)?.name}
          </p>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label>Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose driver" />
              </SelectTrigger>
              <SelectContent>
                {demo.drivers.map((driver) => {
                  const active = currentLoad(demo.loads, driver.id);
                  return (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                      {driver.availability === "off" ? " · off" : active ? ` · on ${active.id}` : " · clear"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {driverId ? (
              <p className="text-xs text-[#5c6b80]">{payRuleLabel(demo.drivers.find((driver) => driver.id === driverId)!.pay)}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Truck</Label>
            <Select value={truckId} onValueChange={setTruckId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose truck" />
              </SelectTrigger>
              <SelectContent>
                {demo.trucks.map((truck) => {
                  const tone = maintenanceTone(truck, demo.thresholds);
                  return (
                    <SelectItem key={truck.id} value={truck.id}>
                      {truck.unit} · {truck.operational === "out_of_service" ? "Out of service" : tone === "overdue" ? "Service overdue" : tone === "due_soon" ? "Service soon" : "In service"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {!preview.ok ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{preview.reason}</p> : null}
          {preview.ok && warning ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {warning.id} is still open on this driver or truck, but the appointments do not overlap.
            </p>
          ) : null}
          {preview.ok ? <p className="text-sm text-emerald-800">This assignment fits the current board.</p> : null}
        </div>
        <SheetFooter className="border-t bg-white">
          <Button
            className="w-full"
            data-testid="assign-load"
            disabled={!preview.ok}
            onClick={() => {
              if (!driverId || !truckId) return;
              const result = demo.assignLoad(load.id, driverId, truckId);
              if (!result.ok) {
                toast.error(result.reason);
                return;
              }
              const driver = demo.drivers.find((item) => item.id === driverId);
              const truck = demo.trucks.find((item) => item.id === truckId);
              toast.success(`${load.containerNumber} assigned to ${driver?.name} · ${truck?.unit}`);
              onOpenChange(false);
            }}
          >
            {load.driverId ? "Save reassignment" : "Assign load"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function assignmentPreset(load: Load | null, open: boolean, walk: WalkthroughState | null) {
  if (!open || !load) return { driverId: undefined, truckId: undefined };
  if (load.driverId) return { driverId: load.driverId, truckId: load.truckId };
  if (walk?.active && walk.step <= 1 && load.id === PITCH_LOAD_ID) {
    return { driverId: PITCH_DRIVER_ID, truckId: PITCH_TRUCK_ID };
  }
  return { driverId: undefined, truckId: undefined };
}
