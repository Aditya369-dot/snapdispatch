export type LoadType = "import" | "export";

export type LoadStatus =
  | "created"
  | "assigned"
  | "accepted"
  | "at_port"
  | "picked_up"
  | "at_customer"
  | "delivered"
  | "empty_return_pending"
  | "empty_returned"
  | "gated_in"
  | "complete";

export type DelayReason =
  | "port_congestion"
  | "customer_delay"
  | "container_unavailable"
  | "traffic"
  | "equipment_issue"
  | "other";

export type ExpenseCategory =
  | "fuel"
  | "tolls"
  | "parking"
  | "scales"
  | "chassis"
  | "repairs"
  | "port_fees"
  | "miscellaneous";

export type PaidBy = "driver" | "company_card" | "company_cash";

export type ExpenseStatus =
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "correction_requested";

export type DocType =
  | "pod"
  | "bol"
  | "gate_receipt"
  | "empty_return"
  | "expense_receipt";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type SampleKey = "blue-pod" | "toll" | "fuel" | "parking" | "generic";

export type PayProfile =
  | {
      kind: "flat";
      importDelivery: number;
      importEmpty: number;
      exportMove: number;
    }
  | { kind: "hourly"; rate: number }
  | { kind: "percentage"; percent: number };

export type LedgerType =
  | "opening"
  | "earning"
  | "reimbursement"
  | "adjustment"
  | "advance"
  | "payment";

export type PayMethod = "ACH" | "Check" | "Cash";

export type EarnLeg = "delivery" | "empty" | "move";

export interface Charge {
  id: string;
  label: string;
  amount: number;
}

export interface TimelineEvent {
  id: string;
  at: string;
  status: LoadStatus;
  label: string;
  note?: string;
}

export interface Delay {
  id: string;
  at: string;
  reason: DelayReason;
  note: string;
}

export interface Load {
  id: string;
  containerNumber: string;
  bookingNumber: string;
  type: LoadType;
  customerId: string;
  pickupKey: string;
  destinationKey: string;
  appointmentStart: string;
  appointmentEnd: string;
  lastFreeDay?: string;
  emptyReturnDeadline?: string;
  cutoff?: string;
  driverId?: string;
  truckId?: string;
  status: LoadStatus;
  customerRate: number;
  additionalCharges: Charge[];
  estimatedHours: number;
  notes: string;
  timeline: TimelineEvent[];
  delays: Delay[];
  createdAt: string;
  completedAt?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  pay: PayProfile;
  truckId?: string;
  availability: "available" | "off";
  availabilityNote?: string;
  cdl: string;
  hired: string;
}

export interface Truck {
  id: string;
  unit: string;
  year: number;
  make: string;
  model: string;
  driverId?: string;
  odometer: number;
  operational: "in_service" | "out_of_service";
  nextServiceDate: string;
  nextServiceMiles: number;
  plate: string;
  vin: string;
  scheduledNote?: string;
  staleLocation?: boolean;
}

export interface Expense {
  id: string;
  loadId?: string;
  driverId: string;
  truckId?: string;
  category: ExpenseCategory;
  amount: number;
  merchant: string;
  date: string;
  notes: string;
  paidBy: PaidBy;
  reimbursementRequested: boolean;
  status: ExpenseStatus;
  rejectionReason?: string;
  correctionNote?: string;
  missingReceiptReason?: string;
  attachmentIds: string[];
  createdAt: string;
  reviewedAt?: string;
}

export interface DocumentRecord {
  id: string;
  loadId?: string;
  driverId?: string;
  expenseId?: string;
  type: DocType;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  reviewStatus: ReviewStatus;
  rejectionReason?: string;
  sampleKey?: SampleKey;
  sampleParams?: Record<string, string>;
  blobId?: string;
  isSample: boolean;
}

export interface LedgerEntry {
  id: string;
  driverId: string;
  loadId?: string;
  expenseId?: string;
  at: string;
  type: LedgerType;
  amount: number;
  memo: string;
  method?: PayMethod;
  reference?: string;
}

export interface Activity {
  id: string;
  at: string;
  driverId?: string;
  loadId?: string;
  truckId?: string;
  message: string;
  kind:
    | "status"
    | "assign"
    | "expense"
    | "document"
    | "delay"
    | "payment"
    | "maintenance";
}

export interface ServiceRecord {
  id: string;
  truckId: string;
  date: string;
  odometer: number;
  kind: "preventive" | "repair";
  summary: string;
  cost: number;
  shop: string;
}

export interface Issue {
  id: string;
  truckId: string;
  opened: string;
  summary: string;
  detail: string;
  status: "open" | "closed";
  estimatedCost?: number;
}

export interface Thresholds {
  miles: number;
  days: number;
}

export interface ExcelSync {
  at: string;
  loads: number;
  drivers: number;
  expenses: number;
  payments: number;
  maintenance: number;
  message: string;
}

export interface SettlementApproval {
  driverId: string;
  at: string;
}

export interface TourState {
  selectedLoadId?: string;
  financialsLoadId?: string;
  sawEmptyReturn?: boolean;
}

export interface WalkthroughState {
  active: boolean;
  step: number;
  startedAt: string;
}

export interface Counters {
  load: number;
  expense: number;
  doc: number;
  activity: number;
}

export interface DemoData {
  drivers: Driver[];
  trucks: Truck[];
  loads: Load[];
  expenses: Expense[];
  documents: DocumentRecord[];
  ledger: LedgerEntry[];
  activity: Activity[];
  serviceRecords: ServiceRecord[];
  issues: Issue[];
  thresholds: Thresholds;
  clock: string;
  excelSync: ExcelSync | null;
  settlementApprovals: SettlementApproval[];
  counters: Counters;
}

export interface EarningLine {
  leg: EarnLeg;
  amount: number;
  memo: string;
  postWhen: "delivered" | "empty" | "done";
}
