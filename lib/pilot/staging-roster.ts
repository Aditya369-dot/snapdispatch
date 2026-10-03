import type { FixtureLoad, FixtureOrg, StagingExtras } from "@/lib/pilot/fixture-types";

/**
 * Reproducible synthetic staging carrier.
 * 10 trucks, 12 drivers, 1 owner, 1 dispatcher, 5 customers, 100 loads across 30 days.
 * Pay examples are labeled assumptions. No formula runs. Empty return is not required;
 * one progress note uses reported stage "container_return" as a test scenario only.
 */

const START = Date.UTC(2026, 8, 8);

function iso(day: number, hour: number): string {
  return new Date(START + day * 86_400_000 + hour * 3_600_000).toISOString();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function pad3(value: number): string {
  return String(value).padStart(3, "0");
}

export function buildStagingRoster(): { organization: FixtureOrg; extras: StagingExtras } {
  const drivers = Array.from({ length: 12 }, (_, index) => {
    const n = index + 1;
    return {
      key: `driver${pad(n)}`,
      displayName: `Synthetic Roster Driver ${pad(n)}`,
      availability: "available" as const,
      payRule: null,
      email: `driver.staging.${pad(n)}@synthetic.example`,
    };
  });

  const trucks = Array.from({ length: 10 }, (_, index) => {
    const n = index + 1;
    return { key: `truck${pad(n)}`, unit: `SYN-S${pad(n)}`, operational: "in_service" as const };
  });

  const customers = Array.from({ length: 5 }, (_, index) => ({
    key: `customer${index + 1}`,
    name: `Synthetic Roster Customer ${index + 1}`,
  }));

  const places = [
    { key: "pickupA", name: "Synthetic Roster Pickup A", addressLine: "100 Fixture Road" },
    { key: "pickupB", name: "Synthetic Roster Pickup B", addressLine: "200 Fixture Road" },
    { key: "dropA", name: "Synthetic Roster Drop A", addressLine: "300 Fixture Road" },
    { key: "dropB", name: "Synthetic Roster Drop B", addressLine: "400 Fixture Road" },
  ];

  const loads: FixtureLoad[] = [];
  const inProgressRefs: string[] = [];

  for (let day = 0; day < 30; day += 1) {
    const n = loads.length + 1;
    loads.push({
      key: `open${pad3(n)}`,
      reference: `SYN-ROSTER-${pad3(n)}`,
      customerKey: customers[day % 5].key,
      pickupKey: day % 2 === 0 ? "pickupA" : "pickupB",
      destinationKey: day % 2 === 0 ? "dropA" : "dropB",
      appointmentStart: iso(day, 12),
      appointmentEnd: iso(day, 14),
      customerRateCents: null,
      notes: "Unassigned synthetic load. No pay formula.",
      status: "created",
    });
  }

  let assigned = 0;
  for (let day = 0; day < 30; day += 1) {
    const count = day < 10 ? 3 : 2;
    for (let slot = 0; slot < count; slot += 1) {
      assigned += 1;
      const n = loads.length + 1;
      const driverIndex = (day * 3 + slot) % 12;
      const truckIndex = (day + slot) % 10;
      const status =
        assigned <= 6 ? "in_progress" : assigned <= 30 ? "in_progress" : assigned <= 50 ? "accepted" : "assigned";
      const reference = `SYN-ROSTER-${pad3(n)}`;
      const containerReturn = assigned === 1;
      loads.push({
        key: `work${pad3(assigned)}`,
        reference,
        customerKey: customers[(day + slot) % 5].key,
        pickupKey: slot % 2 === 0 ? "pickupA" : "pickupB",
        destinationKey: slot % 2 === 0 ? "dropB" : "dropA",
        appointmentStart: iso(day, 15 + slot * 2),
        appointmentEnd: iso(day, 17 + slot * 2),
        customerRateCents: null,
        notes: containerReturn
          ? "Includes an optional container-return progress note. Empty-return rules are open (Q3, Q18)."
          : "Synthetic roster load. Driver-pay calculations are disabled.",
        status,
        driverKey: drivers[driverIndex].key,
        truckKey: trucks[truckIndex].key,
        progressNote:
          status === "in_progress"
            ? containerReturn
              ? "Assumption only: container returned to the yard. This is not a required step."
              : "Synthetic progress note. Empty return was not required."
            : null,
        reportedStage: containerReturn ? "container_return" : null,
      });
      if (assigned <= 6) inProgressRefs.push(reference);
    }
  }

  if (loads.length !== 100) {
    throw new Error(`staging roster expected 100 loads, got ${loads.length}`);
  }

  const organization: FixtureOrg = {
    name: "Synthetic Staging Roster",
    syntheticOnly: true,
    displayTimezone: "America/Los_Angeles",
    payRules: null,
    emptyReturnRequired: null,
    users: [
      {
        key: "owner",
        email: "owner.staging@synthetic.example",
        role: "owner",
        driverKey: null,
        displayName: "Synthetic Roster Owner",
      },
      {
        key: "dispatcher",
        email: "dispatcher.staging@synthetic.example",
        role: "dispatcher",
        driverKey: null,
        displayName: "Synthetic Roster Dispatcher",
      },
      ...drivers.map((driver) => ({
        key: driver.key,
        email: driver.email,
        role: "driver" as const,
        driverKey: driver.key,
        displayName: driver.displayName,
      })),
    ],
    drivers,
    trucks,
    customers,
    places,
    loads,
  };

  const documents: StagingExtras["documents"] = inProgressRefs.flatMap((reference, index) => {
    const amount = 1500 + index * 100;
    return [
      {
        loadReference: reference,
        kind: "receipt" as const,
        fileName: `roster-receipt-${index + 1}.jpg`,
        mimeType: "image/jpeg" as const,
        amountCents: amount,
        reviewStatus: index % 2 === 0 ? ("approved" as const) : ("rejected" as const),
        reviewNote: index % 2 === 0 ? "" : "Fixture rejection. Must not post pay.",
      },
      {
        loadReference: reference,
        kind: "pod" as const,
        fileName: `roster-pod-${index + 1}.pdf`,
        mimeType: "application/pdf" as const,
        amountCents: null,
        reviewStatus: "approved" as const,
        reviewNote: "",
      },
    ];
  });

  const extras: StagingExtras = {
    documents,
    mileage: drivers.map((driver, index) => ({
      driverKey: driver.key,
      truckKey: trucks[index % 10].key,
      miles: 40 + index * 3.5,
      reportedOn: "2026-10-01",
      idempotencyKey: `roster-miles-${pad(index + 1)}`,
    })),
    maintenance: trucks.map((truck, index) => ({
      truckKey: truck.key,
      title: `Synthetic service reminder ${truck.unit}`,
      dueOn: `2026-10-${String(10 + index).padStart(2, "0")}`,
      notes: "Fixture reminder. Not a live maintenance program.",
    })),
    payExamples: [
      {
        label: "Day example (assumption)",
        assumptionNote:
          "Fixture-only illustration of a typed day amount. Not a formula. Driver-pay calculations are disabled until Q4.",
        exampleAmountCents: 4100,
      },
      {
        label: "Load example (assumption)",
        assumptionNote: "Fixture-only illustration. Do not multiply a customer rate by this. Not production pay.",
        exampleAmountCents: 2750,
      },
      {
        label: "Receipt example (assumption)",
        assumptionNote: "A typed receipt is not money owed. Approval does not reimburse. Q5 is open.",
        exampleAmountCents: 1800,
      },
    ],
  };

  return { organization, extras };
}
