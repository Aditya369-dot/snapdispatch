export type FixtureUser = {
  key: string;
  email: string;
  role: "owner" | "driver" | "dispatcher";
  driverKey: string | null;
  displayName?: string;
};

export type FixtureDriver = {
  key: string;
  displayName: string;
  availability: "available" | "off";
  availabilityNote?: string;
  payRule: null;
  email?: string;
};

export type FixtureTruck = {
  key: string;
  unit: string;
  operational: "in_service" | "out_of_service";
};

export type FixtureCustomer = { key: string; name: string };
export type FixturePlace = { key: string; name: string; addressLine?: string };

export type FixtureLoad = {
  key: string;
  reference: string;
  containerNumber?: string | null;
  externalReference?: string | null;
  customerKey: string;
  pickupKey: string;
  destinationKey: string;
  appointmentStart: string;
  appointmentEnd: string;
  lastFreeDay?: string | null;
  emptyReturnDeadline?: string | null;
  cutoff?: string | null;
  customerRateCents?: number | null;
  notes?: string;
  status?: "created" | "assigned" | "accepted" | "in_progress";
  driverKey?: string | null;
  truckKey?: string | null;
  progressNote?: string | null;
  reportedStage?: string | null;
};

export type FixtureOrg = {
  name: string;
  syntheticOnly: boolean;
  displayTimezone: string;
  users: FixtureUser[];
  drivers: FixtureDriver[];
  trucks: FixtureTruck[];
  customers?: FixtureCustomer[];
  customer?: FixtureCustomer;
  places: FixturePlace[];
  loads?: FixtureLoad[];
  payRules: null;
  emptyReturnRequired: null;
};

export type FixtureDocument = {
  loadReference: string;
  kind: "receipt" | "pod";
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  amountCents: number | null;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewNote: string;
};

export type StagingExtras = {
  documents: FixtureDocument[];
  mileage: { driverKey: string; truckKey: string; miles: number; reportedOn: string; idempotencyKey: string }[];
  maintenance: { truckKey: string; title: string; dueOn: string; notes: string }[];
  payExamples: { label: string; assumptionNote: string; exampleAmountCents: number }[];
};
