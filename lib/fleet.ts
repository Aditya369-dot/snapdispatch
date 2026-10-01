import { place, PLACES } from "@/lib/reference";
import type { Load, Truck } from "@/lib/types";

export interface FleetMarker {
  truck: Truck;
  load?: Load;
  x: number;
  y: number;
  moving: boolean;
  nextStop: string;
  eta: string;
  stale: boolean;
  lastUpdate: string;
}

function mix(ax: number, ay: number, bx: number, by: number, t: number) {
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
}

export function fleetMarkers(trucks: Truck[], loads: Load[], clock: string): FleetMarker[] {
  const idle = trucks.filter((truck) => {
    if (truck.operational === "out_of_service" || truck.staleLocation) return false;
    const load = activeLoad(loads, truck.id);
    return !load;
  });
  return trucks.map((truck) => {
    const load = activeLoad(loads, truck.id);
    const stale = Boolean(truck.staleLocation);
    if (truck.operational === "out_of_service") {
      return marker(truck, load, PLACES.shop.x, PLACES.shop.y, false, "Westshore Shop", "—", false, clock);
    }
    if (stale) {
      return marker(
        truck,
        load,
        PLACES.harbor.x + 22,
        PLACES.harbor.y + 16,
        false,
        "Last ping near San Leandro",
        "Stale",
        true,
        "2026-10-01T03:05:00-07:00",
      );
    }
    if (!load) {
      const index = Math.max(0, idle.findIndex((item) => item.id === truck.id));
      return marker(
        truck,
        undefined,
        PLACES.yard.x + (index % 3) * 18 - 18,
        PLACES.yard.y + Math.floor(index / 3) * 16,
        false,
        "Westshore Yard",
        "—",
        false,
        clock,
      );
    }
    const from = place(load.pickupKey) ?? PLACES.yard;
    const to = place(load.destinationKey) ?? PLACES.yard;
    const spot = positionFor(load, from, to);
    const remaining = spot.moving ? sampleEta(spot.x, spot.y, to.x, to.y) : "On site";
    return marker(truck, load, spot.x, spot.y, spot.moving, spot.nextStop, remaining, false, clock);
  });
}

function activeLoad(loads: Load[], truckId: string) {
  return loads
    .filter((load) => load.truckId === truckId && load.status !== "complete" && load.status !== "created")
    .sort((a, b) => a.appointmentStart.localeCompare(b.appointmentStart))[0];
}

function positionFor(
  load: Load,
  from: { x: number; y: number; name: string; city: string },
  to: { x: number; y: number; name: string; city: string },
) {
  const yard = PLACES.yard;
  if (load.type === "import") {
    if (load.status === "assigned" || load.status === "accepted") {
      const point = mix(yard.x, yard.y, from.x, from.y, load.status === "accepted" ? 0.55 : 0.2);
      return { ...point, moving: load.status === "accepted", nextStop: from.name };
    }
    if (load.status === "at_port") return { x: from.x, y: from.y, moving: false, nextStop: to.name };
    if (load.status === "picked_up") {
      const point = mix(from.x, from.y, to.x, to.y, 0.42);
      return { ...point, moving: true, nextStop: to.name };
    }
    if (load.status === "empty_returned") {
      const point = mix(to.x, to.y, from.x, from.y, 0.45);
      return { ...point, moving: true, nextStop: from.name };
    }
    return { x: to.x, y: to.y + 12, moving: false, nextStop: load.status === "empty_return_pending" ? from.name : to.name };
  }
  if (load.status === "assigned" || load.status === "accepted") {
    const point = mix(yard.x, yard.y, from.x, from.y, load.status === "accepted" ? 0.6 : 0.25);
    return { ...point, moving: load.status === "accepted", nextStop: from.name };
  }
  if (load.status === "at_customer") return { x: from.x, y: from.y, moving: false, nextStop: to.name };
  if (load.status === "picked_up") {
    const point = mix(from.x, from.y, to.x, to.y, 0.5);
    return { ...point, moving: true, nextStop: to.name };
  }
  return { x: to.x, y: to.y, moving: false, nextStop: to.name };
}

function sampleEta(x: number, y: number, tx: number, ty: number) {
  const miles = Math.hypot(tx - x, ty - y) / 7.5;
  const minutes = Math.max(12, Math.round(miles * 1.4));
  return `Sample ETA ${minutes} min`;
}

function marker(
  truck: Truck,
  load: Load | undefined,
  x: number,
  y: number,
  moving: boolean,
  nextStop: string,
  eta: string,
  stale: boolean,
  lastUpdate: string,
): FleetMarker {
  return { truck, load, x, y, moving, nextStop, eta, stale, lastUpdate };
}
