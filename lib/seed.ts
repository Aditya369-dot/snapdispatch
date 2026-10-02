import { ensureLedger, driverBalance } from "@/lib/finance";
import { IMPORT_FLOW, EXPORT_FLOW } from "@/lib/flow";
import { DEMO_NOW, addMinutes, iso, roundMoney } from "@/lib/format";
import { FLAT_PAY } from "@/lib/reference";
import { UNIT_STATS } from "@/lib/units";
import type {
  Activity,
  DelayReason,
  DemoData,
  DocumentRecord,
  Driver,
  Expense,
  ExpenseCategory,
  Issue,
  Load,
  LoadStatus,
  LoadType,
  PaidBy,
  PayProfile,
  SampleKey,
  ServiceRecord,
  Truck,
} from "@/lib/types";
import type { PlaceKey as PK } from "@/lib/reference";

const flat = (): PayProfile => ({ kind: "flat", ...FLAT_PAY });

export const TARGET_BALANCES: Record<string, number> = {
  "drv-marcus": 920,
  "drv-elena": 610,
  "drv-james": 840,
  "drv-priya": 1180,
  "drv-derek": 730,
  "drv-sofia": 455,
  "drv-andre": 0,
  "drv-luis": 240,
  "drv-hannah": 680,
  "drv-omar": 360,
  "drv-keisha": 790,
  "drv-tyler": 510,
  "drv-rosa": 740,
  "drv-benito": 280,
  "drv-naomi": 0,
  "drv-patrick": 150,
};

function driver(
  id: string,
  name: string,
  phone: string,
  pay: PayProfile,
  truckId: string | undefined,
  availability: Driver["availability"],
  note?: string,
): Driver {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
  return {
    id,
    name,
    phone,
    email: `${slug}@westshore.example`,
    pay,
    truckId,
    availability,
    availabilityNote: note,
    cdl: "Class A · doubles/triples · tank",
    hired: "2022-04-11",
  };
}

const DRIVERS: Driver[] = [
  driver("drv-marcus", "Marcus Hale", "(510) 555-0172", flat(), "trk-101", "available"),
  driver("drv-elena", "Elena Vasquez", "(510) 555-0138", flat(), "trk-104", "available"),
  driver("drv-james", "James Okonkwo", "(510) 555-0194", flat(), "trk-107", "available"),
  driver("drv-priya", "Priya Shah", "(510) 555-0116", { kind: "percentage", percent: 27 }, "trk-110", "available"),
  driver("drv-derek", "Derek Nguyen", "(510) 555-0181", flat(), "trk-113", "available"),
  driver("drv-sofia", "Sofia Alvarez", "(510) 555-0160", { kind: "hourly", rate: 34 }, "trk-116", "available"),
  driver("drv-andre", "Andre Williams", "(510) 555-0127", flat(), "trk-119", "off", "PTO"),
  driver("drv-luis", "Luis Ortega", "(510) 555-0155", flat(), undefined, "available", "Home truck is in the shop"),
  driver("drv-hannah", "Hannah Brooks", "(510) 555-0104", flat(), "trk-125", "available"),
  driver("drv-omar", "Omar Farouk", "(510) 555-0190", { kind: "hourly", rate: 36 }, "trk-128", "available"),
  driver("drv-keisha", "Keisha Grant", "(510) 555-0144", { kind: "percentage", percent: 27 }, "trk-131", "available"),
  driver("drv-tyler", "Tyler Brennan", "(510) 555-0177", flat(), "trk-134", "available"),
  driver("drv-rosa", "Rosa Delgado", "(510) 555-0122", flat(), undefined, "available", "Available for dispatch"),
  driver("drv-benito", "Benito Cruz", "(510) 555-0188", flat(), undefined, "available"),
  driver("drv-naomi", "Naomi Chen", "(510) 555-0133", flat(), undefined, "off", "Off today"),
  driver("drv-patrick", "Patrick Doyle", "(510) 555-0166", flat(), undefined, "available", "Available this afternoon"),
];

function truck(
  id: string,
  unit: string,
  year: number,
  make: string,
  model: string,
  driverId: string | undefined,
  odometer: number,
  operational: Truck["operational"],
  nextServiceDate: string,
  nextServiceMiles: number,
  plate: string,
  stale = false,
): Truck {
  return {
    id,
    unit,
    year,
    make,
    model,
    driverId,
    odometer,
    operational,
    nextServiceDate,
    nextServiceMiles,
    plate,
    vin: `1WS${unit.replace("-", "")}DEMO${year}`,
    staleLocation: stale,
    asOf: UNIT_STATS[id].asOf,
    periodStart: UNIT_STATS[id].periodStart,
    periodMiles: UNIT_STATS[id].periodMiles,
    gallons: UNIT_STATS[id].gallons,
  };
}

const TRUCKS: Truck[] = [
  truck("trk-101", "WS-101", 2022, "Freightliner", "Cascadia", "drv-marcus", 412840, "in_service", "2026-11-12", 420000, "8Y21901"),
  truck("trk-104", "WS-104", 2021, "Kenworth", "T680", "drv-elena", 389220, "in_service", "2026-10-28", 395000, "8Y21904"),
  truck("trk-107", "WS-107", 2019, "Volvo", "VNL 860", "drv-james", 451640, "in_service", "2026-09-15", 448000, "8Y21907"),
  truck("trk-110", "WS-110", 2023, "Peterbilt", "579", "drv-priya", 367420, "in_service", "2026-10-08", 370000, "8Y21910"),
  truck("trk-113", "WS-113", 2022, "Freightliner", "Cascadia", "drv-derek", 298150, "in_service", "2026-11-02", 310000, "8Y21913"),
  truck("trk-116", "WS-116", 2020, "Kenworth", "T680", "drv-sofia", 334910, "in_service", "2026-10-22", 345000, "8Y21916"),
  truck("trk-119", "WS-119", 2023, "Volvo", "VNL 760", "drv-andre", 276440, "in_service", "2026-11-18", 290000, "8Y21919"),
  truck("trk-122", "WS-122", 2018, "International", "LT", undefined, 401220, "out_of_service", "2026-10-20", 405000, "8Y21922"),
  truck("trk-125", "WS-125", 2024, "Freightliner", "Cascadia", "drv-hannah", 188640, "in_service", "2026-12-02", 200000, "8Y21925", true),
  truck("trk-128", "WS-128", 2021, "Peterbilt", "579", "drv-omar", 355780, "in_service", "2026-10-30", 365000, "8Y21928"),
  truck("trk-131", "WS-131", 2022, "Kenworth", "W990", "drv-keisha", 242310, "in_service", "2026-11-09", 255000, "8Y21931"),
  truck("trk-134", "WS-134", 2020, "Volvo", "VNL 860", "drv-tyler", 319050, "in_service", "2026-10-18", 330000, "8Y21934"),
];

interface Draft {
  id: string;
  container: string;
  booking: string;
  type: LoadType;
  customerId: string;
  pickup: PK;
  drop: PK;
  start: string;
  end: string;
  timelineEnd: string;
  driverId?: string;
  truckId?: string;
  status: LoadStatus;
  rate: number;
  charges?: [string, number][];
  hours?: number;
  lfd?: string;
  emptyBy?: string;
  cutoff?: string;
  notes?: string;
  delay?: { reason: DelayReason; note: string };
}

function span(day: string, start: string, hours: number) {
  const appointmentStart = iso(day, start);
  return { start: appointmentStart, end: addMinutes(appointmentStart, hours * 60) };
}

const L = (
  id: string,
  container: string,
  booking: string,
  type: LoadType,
  customerId: string,
  pickup: PK,
  drop: PK,
  day: string,
  start: string,
  windowHours: number,
  timelineEnd: string,
  status: LoadStatus,
  rate: number,
  driverId?: string,
  truckId?: string,
  extra: Partial<Draft> = {},
): Draft => {
  const window = span(day, start, windowHours);
  return {
    id,
    container,
    booking,
    type,
    customerId,
    pickup,
    drop,
    start: window.start,
    end: window.end,
    timelineEnd,
    status,
    rate,
    driverId,
    truckId,
    ...extra,
  };
};

const DRAFTS: Draft[] = [
  L("LD-10401", "MSCU4412091", "BK-88011", "import", "cus-northbay", "trapac", "northbay", "2026-09-18", "08:00", 4, iso("2026-09-18", "11:20"), "complete", 680, "drv-marcus", "trk-101", { lfd: "2026-09-19", emptyBy: "2026-09-20", charges: [["Chassis", 45]], notes: "Live unload. Receiver was ready." }),
  L("LD-10402", "CMAU2291844", "BK-88012", "export", "cus-lumen", "lumen", "oict", "2026-09-18", "09:30", 4, iso("2026-09-18", "13:00"), "complete", 740, "drv-elena", "trk-104", { cutoff: "2026-09-18", notes: "ERD honored. Full gate-in at OICT." }),
  L("LD-10403", "OOLU7781203", "BK-88013", "import", "cus-redwood", "oict", "redwood", "2026-09-19", "07:30", 5, iso("2026-09-19", "13:40"), "complete", 960, "drv-james", "trk-107", { lfd: "2026-09-19", emptyBy: "2026-09-21", charges: [["Pre-pull", 150]], notes: "Sat in the queue before the out-gate.", delay: { reason: "port_congestion", note: "OICT truck queue was over two hours." } }),
  L("LD-10404", "HLBU3902218", "BK-88014", "import", "cus-apex", "trapac", "apex", "2026-09-19", "10:00", 5, iso("2026-09-19", "15:10"), "complete", 1020, "drv-priya", "trk-110", { lfd: "2026-09-20", emptyBy: "2026-09-22", notes: "Drop and hook at Apex." }),
  L("LD-10405", "ONEU6612044", "BK-88015", "import", "cus-sierra", "everport", "sierra", "2026-09-21", "06:45", 6, iso("2026-09-21", "12:30"), "complete", 1180, "drv-derek", "trk-113", { lfd: "2026-09-22", emptyBy: "2026-09-23", charges: [["Overweight permit", 85]], notes: "Scale ticket on file." }),
  L("LD-10406", "TGBU9182330", "BK-88016", "export", "cus-mesa", "mesa", "trapac", "2026-09-21", "08:15", 6, iso("2026-09-21", "14:00"), "complete", 1080, "drv-sofia", "trk-116", { cutoff: "2026-09-21", hours: 7.5, notes: "Reefer export. Genset checked before departure." }),
  L("LD-10407", "CAIU5520198", "BK-88017", "import", "cus-calvista", "oict", "calvista", "2026-09-22", "09:00", 4, iso("2026-09-22", "12:40"), "complete", 760, "drv-hannah", "trk-125", { lfd: "2026-09-23", emptyBy: "2026-09-24", notes: "Dock 4." }),
  L("LD-10408", "FCIU3301984", "BK-88018", "import", "cus-northbay", "matson", "northbay", "2026-09-22", "11:00", 4, iso("2026-09-22", "15:00"), "complete", 690, "drv-omar", "trk-128", { lfd: "2026-09-23", emptyBy: "2026-09-24", hours: 6, notes: "Appointment held." }),
  L("LD-10409", "TEMU7712450", "BK-88019", "import", "cus-harbor", "trapac", "harbor", "2026-09-22", "13:30", 3, iso("2026-09-22", "16:20"), "complete", 610, "drv-keisha", "trk-131", { lfd: "2026-09-23", emptyBy: "2026-09-24", notes: "Blue sheet was never photographed." }),
  L("LD-10410", "BMOU2201983", "BK-88020", "export", "cus-lumen", "lumen", "everport", "2026-09-23", "07:00", 4, iso("2026-09-23", "10:40"), "complete", 670, "drv-tyler", "trk-134", { cutoff: "2026-09-23", notes: "Loaded and gated in before cutoff." }),
  L("LD-10411", "GCXU6612094", "BK-88021", "import", "cus-mesa", "oict", "mesa", "2026-09-23", "10:30", 5, iso("2026-09-23", "16:00"), "complete", 1040, "drv-marcus", "trk-101", { lfd: "2026-09-24", emptyBy: "2026-09-25", charges: [["Chassis", 45]], notes: "Cold storage check-in at Navy Drive." }),
  L("LD-10412", "MSCU9088123", "BK-88022", "import", "cus-redwood", "trapac", "redwood", "2026-09-23", "14:00", 5, iso("2026-09-23", "19:10"), "complete", 980, "drv-elena", "trk-104", { lfd: "2026-09-24", emptyBy: "2026-09-25", notes: "Receiver pushed the door time.", delay: { reason: "customer_delay", note: "Redwood had no door until 90 minutes past the window." } }),
  L("LD-10413", "TCLU2201988", "BK-88023", "import", "cus-northbay", "trapac", "northbay", "2026-09-24", "08:00", 4, iso("2026-09-24", "11:45"), "complete", 650, "drv-rosa", "trk-119", { lfd: "2026-09-25", emptyBy: "2026-09-26", charges: [["Chassis", 45]], notes: "Rosa covered Andre's truck." }),
  L("LD-10414", "CMAU4412099", "BK-88024", "import", "cus-apex", "oict", "apex", "2026-09-24", "08:30", 6, iso("2026-09-24", "14:10"), "complete", 1010, "drv-benito", "trk-125", { lfd: "2026-09-25", emptyBy: "2026-09-26", notes: "Floater cover on WS-125." }),
  L("LD-10415", "OOLU3309812", "BK-88025", "export", "cus-lumen", "lumen", "matson", "2026-09-24", "13:00", 4, iso("2026-09-24", "16:20"), "complete", 720, "drv-luis", "trk-104", { cutoff: "2026-09-24", notes: "Luis used WS-104 after Elena's morning work." }),
  L("LD-10416", "HLBU7712033", "BK-88026", "import", "cus-calvista", "oict", "calvista", "2026-09-28", "08:20", 4, iso("2026-09-28", "12:00"), "complete", 780, "drv-tyler", "trk-134", { lfd: "2026-09-29", emptyBy: "2026-09-30", notes: "Clean delivery." }),
  L("LD-10417", "ONEU2091844", "BK-88027", "import", "cus-apex", "trapac", "apex", "2026-09-29", "09:00", 5, iso("2026-09-29", "14:20"), "complete", 1045, "drv-priya", "trk-110", { lfd: "2026-09-30", emptyBy: "2026-10-01", notes: "Blue document uploaded, still in review." }),
  L("LD-10418", "TGBU5520911", "BK-88028", "export", "cus-lumen", "lumen", "everport", "2026-09-29", "07:40", 4, iso("2026-09-29", "11:30"), "complete", 710, "drv-derek", "trk-113", { cutoff: "2026-09-29", notes: "Made the vessel cutoff." }),
  L("LD-10419", "CAIU8812034", "BK-88029", "import", "cus-calvista", "matson", "calvista", "2026-09-30", "08:10", 4, iso("2026-09-30", "12:30"), "complete", 770, "drv-sofia", "trk-116", { lfd: "2026-10-01", emptyBy: "2026-10-02", hours: 6.5, notes: "Morning turn, then a second load in the afternoon." }),
  L("LD-10420", "FCIU2093318", "BK-88030", "export", "cus-mesa", "mesa", "oict", "2026-09-30", "13:00", 5, iso("2026-09-30", "18:10"), "complete", 1090, "drv-omar", "trk-128", { cutoff: "2026-09-30", hours: 8, notes: "Late gate-in still made cutoff." }),
  L("LD-10421", "TEMU4412980", "BK-88031", "import", "cus-northbay", "trapac", "northbay", "2026-10-01", "05:30", 2.5, iso("2026-10-01", "07:15"), "complete", 640, "drv-marcus", "trk-101", { lfd: "2026-10-02", emptyBy: "2026-10-03", charges: [["Chassis", 45]], notes: "Early door. Empty returned before breakfast." }),
  L("LD-10422", "BMOU7712091", "BK-88032", "export", "cus-lumen", "lumen", "oict", "2026-10-01", "06:00", 3, iso("2026-10-01", "08:20"), "complete", 730, "drv-elena", "trk-104", { cutoff: "2026-10-01", notes: "First export of the day is already gated in." }),
  L("LD-10423", "GCXU3302188", "BK-88033", "import", "cus-harbor", "oict", "harbor", "2026-10-01", "05:45", 2.5, iso("2026-10-01", "07:35"), "complete", 590, "drv-hannah", "trk-125", { lfd: "2026-10-01", emptyBy: "2026-10-02", notes: "Finished early. Tablet has not checked in since." }),
  L("LD-10424", "MSCU2209144", "BK-88034", "import", "cus-harbor", "matson", "harbor", "2026-09-26", "08:20", 3, iso("2026-09-26", "11:00"), "complete", 620, "drv-keisha", "trk-131", { lfd: "2026-09-27", emptyBy: "2026-09-28", notes: "POD is on file." }),
  L("LD-10425", "TCLU6612033", "BK-88035", "import", "cus-redwood", "oict", "redwood", "2026-10-01", "10:30", 4, iso("2026-10-01", "09:20"), "at_port", 970, "drv-james", "trk-107", { lfd: "2026-10-01", emptyBy: "2026-10-02", charges: [["Chassis", 45]], notes: "Last free day is today. James is in the OICT queue on the overdue truck." }),
  L("LD-10426", "CMAU9088210", "BK-88036", "import", "cus-apex", "trapac", "apex", "2026-10-01", "08:00", 5, iso("2026-10-01", "09:05"), "at_customer", 1060, "drv-priya", "trk-110", { lfd: "2026-10-02", emptyBy: "2026-10-03", notes: "At the Arch Road dock, waiting on a door." }),
  L("LD-10427", "OOLU4412771", "BK-88037", "import", "cus-mesa", "everport", "mesa", "2026-10-01", "08:15", 5, iso("2026-10-01", "09:10"), "picked_up", 1010, "drv-derek", "trk-113", { lfd: "2026-10-02", emptyBy: "2026-10-03", notes: "Out-gated Everport, eastbound on 580.", delay: { reason: "traffic", note: "Slow roll through the Maze before 580." } }),
  L("LD-10428", "HLBU2201984", "BK-88038", "export", "cus-mesa", "mesa", "oict", "2026-10-01", "09:30", 5, iso("2026-10-01", "09:25"), "at_customer", 1120, "drv-omar", "trk-128", { cutoff: "2026-10-01", hours: 7, notes: "At the shipper. Loading has started." }),
  L("LD-10429", "ONEU5520918", "BK-88039", "import", "cus-calvista", "matson", "calvista", "2026-10-01", "11:15", 4, iso("2026-10-01", "08:50"), "accepted", 800, "drv-tyler", "trk-134", { lfd: "2026-10-02", emptyBy: "2026-10-03", notes: "Accepted. Heading toward Matson for an 11:15 out-gate." }),
  L("LD-10430", "TGBU7712440", "BK-88040", "import", "cus-northbay", "trapac", "northbay", "2026-09-30", "13:30", 4, iso("2026-09-30", "16:40"), "empty_return_pending", 680, "drv-sofia", "trk-116", { lfd: "2026-09-30", emptyBy: "2026-10-01", hours: 6, charges: [["Chassis", 45]], notes: "Delivered yesterday. Empty is due back at TraPac today." }),
  L("LD-10431", "CAIU3302199", "BK-88041", "import", "cus-harbor", "oict", "harbor", "2026-09-30", "14:00", 3, iso("2026-09-30", "16:50"), "empty_return_pending", 630, "drv-keisha", "trk-131", { lfd: "2026-09-30", emptyBy: "2026-10-01", notes: "Delivered. Blue document was not uploaded. Empty return is due today." }),
  L("LD-10432", "FCIU8812031", "BK-88042", "import", "cus-lumen", "trapac", "lumen", "2026-10-01", "15:00", 3, iso("2026-10-01", "07:50"), "assigned", 560, "drv-marcus", "trk-101", { lfd: "2026-10-02", emptyBy: "2026-10-03", notes: "Afternoon local after the morning Northbay turn. Not accepted yet." }),
  L("LD-10433", "TEMU2091847", "BK-88043", "export", "cus-lumen", "lumen", "everport", "2026-10-01", "16:30", 3, iso("2026-10-01", "08:00"), "assigned", 690, "drv-elena", "trk-104", { cutoff: "2026-10-02", notes: "Late-day export. Assigned, waiting on acceptance." }),
  L("LD-10434", "BMOU4412095", "BK-88044", "import", "cus-redwood", "oict", "redwood", "2026-10-02", "08:00", 5, iso("2026-10-01", "08:10"), "assigned", 940, "drv-benito", "trk-125", { lfd: "2026-10-03", emptyBy: "2026-10-04", notes: "Tomorrow morning. Benito on WS-125." }),
  L("LD-10435", "GCXU5520188", "BK-88045", "import", "cus-apex", "trapac", "apex", "2026-10-02", "09:30", 5, iso("2026-10-01", "08:20"), "assigned", 1000, "drv-patrick", "trk-119", { lfd: "2026-10-03", emptyBy: "2026-10-04", notes: "Tomorrow. WS-119 is free this afternoon because Andre is off." }),
  L("LD-10436", "MSCU7712304", "BK-88046", "import", "cus-sierra", "trapac", "sierra", "2026-10-03", "08:00", 6, iso("2026-10-01", "07:00"), "created", 1160, undefined, undefined, { lfd: "2026-10-04", emptyBy: "2026-10-05", notes: "Modesto delivery. Still needs a driver." }),
  L("LD-10437", "TCLU3302190", "BK-88047", "export", "cus-lumen", "lumen", "trapac", "2026-10-02", "13:00", 4, iso("2026-10-01", "07:05"), "created", 750, undefined, undefined, { cutoff: "2026-10-02", notes: "Export cutoff Thursday afternoon. Unassigned." }),
  L("LD-10438", "CMAU2201986", "BK-88048", "import", "cus-redwood", "oict", "redwood", "2026-10-02", "07:00", 5, iso("2026-10-01", "06:40"), "created", 990, undefined, undefined, { lfd: "2026-10-02", emptyBy: "2026-10-03", charges: [["Chassis", 45]], notes: "Last free day is tomorrow. No driver yet." }),
  L("LD-10439", "OOLU9088129", "BK-88049", "import", "cus-mesa", "matson", "mesa", "2026-10-06", "09:00", 5, iso("2026-09-30", "15:00"), "created", 1040, undefined, undefined, { lfd: "2026-10-07", emptyBy: "2026-10-08", notes: "Next week pre-pull candidate." }),
  L("LD-10440", "TCLU4829137", "OAK394821", "import", "cus-northbay", "trapac", "northbay", "2026-10-01", "14:30", 1.5, iso("2026-10-01", "07:10"), "created", 640, undefined, undefined, { lfd: "2026-10-02", emptyBy: "2026-10-03", charges: [["Chassis split", 45]], hours: 6.5, notes: "Live unload at Northbay Foods. Appointment 2:30–4:00 PM. TWIC required at TraPac. Call the receiver 30 minutes out. Last free day is tomorrow." }),
];

function buildLoad(draft: Draft): Load {
  const flow = draft.type === "import" ? IMPORT_FLOW : EXPORT_FLOW;
  const index = flow.findIndex((step) => step.status === draft.status);
  const timeline = flow.slice(0, index + 1).map((step, stepIndex) => ({
    id: `${draft.id}-tl-${step.status}`,
    at: addMinutes(draft.timelineEnd, (stepIndex - index) * 26),
    status: step.status,
    label: step.label,
  }));
  const delays = draft.delay
    ? [
        {
          id: `${draft.id}-delay`,
          at: timeline.find((event) => event.status === "at_port" || event.status === "at_customer")?.at ?? draft.timelineEnd,
          reason: draft.delay.reason,
          note: draft.delay.note,
        },
      ]
    : [];
  return {
    id: draft.id,
    containerNumber: draft.container,
    bookingNumber: draft.booking,
    type: draft.type,
    customerId: draft.customerId,
    pickupKey: draft.pickup,
    destinationKey: draft.drop,
    appointmentStart: draft.start,
    appointmentEnd: draft.end,
    lastFreeDay: draft.lfd,
    emptyReturnDeadline: draft.emptyBy,
    cutoff: draft.cutoff,
    driverId: draft.driverId,
    truckId: draft.truckId,
    status: draft.status,
    customerRate: draft.rate,
    additionalCharges: (draft.charges ?? []).map(([label, amount], chargeIndex) => ({
      id: `${draft.id}-ch-${chargeIndex}`,
      label,
      amount,
    })),
    estimatedHours: draft.hours ?? (draft.type === "export" ? 6 : 5.5),
    notes: draft.notes ?? "",
    timeline,
    delays,
    createdAt: timeline[0]?.at ?? draft.timelineEnd,
    completedAt: draft.status === "complete" ? timeline.at(-1)?.at : undefined,
  };
}

interface ExpenseDraft {
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
  status: Expense["status"];
  rejectionReason?: string;
  correctionNote?: string;
  missingReceiptReason?: string;
  sample?: SampleKey;
  createdAt: string;
  reviewedAt?: string;
}

const EXPENSE_DRAFTS: ExpenseDraft[] = [
  { id: "EX-3101", loadId: "LD-10401", driverId: "drv-marcus", truckId: "trk-101", category: "fuel", amount: 186.4, merchant: "Pilot Oakland", date: "2026-09-18", notes: "ULSD before the Northbay turn.", paidBy: "company_card", reimbursementRequested: false, status: "approved", sample: "fuel", createdAt: iso("2026-09-18", "06:40"), reviewedAt: iso("2026-09-18", "17:00") },
  { id: "EX-3102", loadId: "LD-10402", driverId: "drv-elena", truckId: "trk-104", category: "tolls", amount: 45, merchant: "FasTrak", date: "2026-09-18", notes: "Bridge toll, driver paid.", paidBy: "driver", reimbursementRequested: true, status: "approved", sample: "toll", createdAt: iso("2026-09-18", "09:10"), reviewedAt: iso("2026-09-18", "17:10") },
  { id: "EX-3103", loadId: "LD-10403", driverId: "drv-james", truckId: "trk-107", category: "port_fees", amount: 85, merchant: "OICT trouble window", date: "2026-09-19", notes: "Terminal fee paid on the company card.", paidBy: "company_card", reimbursementRequested: false, status: "approved", sample: "generic", createdAt: iso("2026-09-19", "08:20"), reviewedAt: iso("2026-09-19", "16:00") },
  { id: "EX-3104", loadId: "LD-10404", driverId: "drv-priya", truckId: "trk-110", category: "parking", amount: 28, merchant: "Arch Road lot", date: "2026-09-19", notes: "Waiting lot while Apex cleared a door.", paidBy: "driver", reimbursementRequested: true, status: "approved", sample: "parking", createdAt: iso("2026-09-19", "12:15"), reviewedAt: iso("2026-09-19", "16:20") },
  { id: "EX-3105", loadId: "LD-10405", driverId: "drv-derek", truckId: "trk-113", category: "scales", amount: 18, merchant: "CAT Scale Tracy", date: "2026-09-21", notes: "Outbound scale.", paidBy: "company_cash", reimbursementRequested: false, status: "approved", sample: "generic", createdAt: iso("2026-09-21", "09:40"), reviewedAt: iso("2026-09-21", "15:00") },
  { id: "EX-3106", loadId: "LD-10406", driverId: "drv-sofia", truckId: "trk-116", category: "fuel", amount: 210.15, merchant: "Pilot Tracy", date: "2026-09-21", notes: "Fill on the Mesa export.", paidBy: "company_card", reimbursementRequested: false, status: "approved", sample: "fuel", createdAt: iso("2026-09-21", "07:30"), reviewedAt: iso("2026-09-21", "15:10") },
  { id: "EX-3107", loadId: "LD-10407", driverId: "drv-hannah", truckId: "trk-125", category: "chassis", amount: 45, merchant: "DCLI flip", date: "2026-09-22", notes: "Chassis flip at the terminal.", paidBy: "company_card", reimbursementRequested: false, status: "approved", sample: "generic", createdAt: iso("2026-09-22", "09:20"), reviewedAt: iso("2026-09-22", "16:00") },
  { id: "EX-3108", loadId: "LD-10408", driverId: "drv-omar", truckId: "trk-128", category: "tolls", amount: 45, merchant: "FasTrak", date: "2026-09-22", notes: "Driver paid the toll.", paidBy: "driver", reimbursementRequested: true, status: "approved", sample: "toll", createdAt: iso("2026-09-22", "11:40"), reviewedAt: iso("2026-09-22", "16:30") },
  { id: "EX-3109", loadId: "LD-10411", driverId: "drv-marcus", truckId: "trk-101", category: "tolls", amount: 18, merchant: "FasTrak", date: "2026-09-23", notes: "Return trip toll.", paidBy: "driver", reimbursementRequested: true, status: "approved", sample: "toll", createdAt: iso("2026-09-23", "15:10"), reviewedAt: iso("2026-09-23", "18:00") },
  { id: "EX-3110", loadId: "LD-10410", driverId: "drv-tyler", truckId: "trk-134", category: "repairs", amount: 240, merchant: "Portside Truck Repair", date: "2026-09-23", notes: "Marker light and pigtail.", paidBy: "company_card", reimbursementRequested: false, status: "approved", sample: "generic", createdAt: iso("2026-09-23", "15:40"), reviewedAt: iso("2026-09-24", "09:00") },
  { id: "EX-3111", loadId: "LD-10412", driverId: "drv-elena", truckId: "trk-104", category: "miscellaneous", amount: 32, merchant: "Roadside market", date: "2026-09-23", notes: "Meal during the Redwood delay.", paidBy: "driver", reimbursementRequested: true, status: "rejected", rejectionReason: "Personal meals are not reimbursed.", missingReceiptReason: "Receipt was lost.", createdAt: iso("2026-09-23", "17:20"), reviewedAt: iso("2026-09-24", "09:30") },
  { id: "EX-3112", loadId: "LD-10413", driverId: "drv-rosa", truckId: "trk-119", category: "fuel", amount: 164.2, merchant: "Pilot Oakland", date: "2026-09-24", notes: "Company card fill.", paidBy: "company_card", reimbursementRequested: false, status: "approved", sample: "fuel", createdAt: iso("2026-09-24", "06:50"), reviewedAt: iso("2026-09-24", "15:00") },
  { id: "EX-3113", loadId: "LD-10414", driverId: "drv-benito", truckId: "trk-125", category: "tolls", amount: 45, merchant: "FasTrak", date: "2026-09-24", notes: "Driver paid.", paidBy: "driver", reimbursementRequested: true, status: "approved", sample: "toll", createdAt: iso("2026-09-24", "10:05"), reviewedAt: iso("2026-09-24", "15:20") },
  { id: "EX-3114", loadId: "LD-10415", driverId: "drv-luis", truckId: "trk-104", category: "port_fees", amount: 70, merchant: "Matson gate", date: "2026-09-24", notes: "Gate fee on the company card.", paidBy: "company_card", reimbursementRequested: false, status: "approved", sample: "generic", createdAt: iso("2026-09-24", "15:50"), reviewedAt: iso("2026-09-25", "09:00") },
  { id: "EX-3115", loadId: "LD-10405", driverId: "drv-derek", truckId: "trk-113", category: "parking", amount: 24, merchant: "Tracy yard", date: "2026-09-25", notes: "Photo of the total is hard to read.", paidBy: "driver", reimbursementRequested: true, status: "correction_requested", correctionNote: "Upload a clearer photo that shows the $24 total.", sample: "parking", createdAt: iso("2026-09-25", "11:10"), reviewedAt: iso("2026-09-25", "16:40") },
  { id: "EX-3116", loadId: "LD-10430", driverId: "drv-sofia", truckId: "trk-116", category: "tolls", amount: 45, merchant: "FasTrak", date: "2026-09-30", notes: "Toll on the Northbay delivery.", paidBy: "driver", reimbursementRequested: true, status: "approved", sample: "toll", createdAt: iso("2026-09-30", "14:10"), reviewedAt: iso("2026-09-30", "17:30") },
  { id: "EX-3117", loadId: "LD-10431", driverId: "drv-keisha", truckId: "trk-131", category: "tolls", amount: 45, merchant: "FasTrak", date: "2026-09-30", notes: "Driver paid on the Harbor delivery.", paidBy: "driver", reimbursementRequested: true, status: "approved", sample: "toll", createdAt: iso("2026-09-30", "14:40"), reviewedAt: iso("2026-09-30", "17:40") },
  { id: "EX-3118", loadId: "LD-10423", driverId: "drv-hannah", truckId: "trk-125", category: "fuel", amount: 142.1, merchant: "Pilot Oakland", date: "2026-10-01", notes: "Morning fill.", paidBy: "company_card", reimbursementRequested: false, status: "approved", sample: "fuel", createdAt: iso("2026-10-01", "05:15"), reviewedAt: iso("2026-10-01", "08:10") },
  { id: "EX-3119", loadId: "LD-10425", driverId: "drv-james", truckId: "trk-107", category: "fuel", amount: 198.55, merchant: "Pilot Oakland", date: "2026-10-01", notes: "Fill before the OICT queue. Waiting on approval.", paidBy: "company_card", reimbursementRequested: false, status: "awaiting_approval", sample: "fuel", createdAt: iso("2026-10-01", "06:05") },
  { id: "EX-3120", loadId: "LD-10426", driverId: "drv-priya", truckId: "trk-110", category: "scales", amount: 16.5, merchant: "CAT Scale", date: "2026-10-01", notes: "Priya paid and is asking to be reimbursed.", paidBy: "driver", reimbursementRequested: true, status: "awaiting_approval", sample: "generic", createdAt: iso("2026-10-01", "08:40") },
  { id: "EX-3121", loadId: "LD-10428", driverId: "drv-omar", truckId: "trk-128", category: "parking", amount: 22, merchant: "Navy Drive lot", date: "2026-10-01", notes: "Short wait at Mesa.", paidBy: "company_cash", reimbursementRequested: false, status: "approved", sample: "parking", createdAt: iso("2026-10-01", "09:00"), reviewedAt: iso("2026-10-01", "09:20") },
  { id: "EX-3122", loadId: "LD-10416", driverId: "drv-tyler", truckId: "trk-134", category: "miscellaneous", amount: 15, merchant: "Terminal gloves", date: "2026-09-28", notes: "Supplies.", paidBy: "company_cash", reimbursementRequested: false, status: "approved", createdAt: iso("2026-09-28", "08:00"), reviewedAt: iso("2026-09-28", "16:00"), missingReceiptReason: "Bought from a machine with no printout." },
];

function buildExpenses(drafts: ExpenseDraft[], documents: DocumentRecord[]) {
  return drafts.map((draft) => {
    const attachmentIds = documents.filter((doc) => doc.expenseId === draft.id).map((doc) => doc.id);
    return {
      id: draft.id,
      loadId: draft.loadId,
      driverId: draft.driverId,
      truckId: draft.truckId,
      category: draft.category,
      amount: draft.amount,
      merchant: draft.merchant,
      date: draft.date,
      notes: draft.notes,
      paidBy: draft.paidBy,
      reimbursementRequested: draft.reimbursementRequested,
      status: draft.status,
      rejectionReason: draft.rejectionReason,
      correctionNote: draft.correctionNote,
      missingReceiptReason: draft.missingReceiptReason,
      attachmentIds,
      createdAt: draft.createdAt,
      reviewedAt: draft.reviewedAt,
    } satisfies Expense;
  });
}

const POD_PLAN: Record<string, "approved" | "pending" | "rejected" | "missing"> = {
  "LD-10409": "missing",
  "LD-10431": "missing",
  "LD-10417": "pending",
  "LD-10412": "rejected",
};

function buildDocuments(loads: Load[], expenseDrafts: ExpenseDraft[]) {
  const documents: DocumentRecord[] = [];
  let seq = 7001;
  const push = (doc: Omit<DocumentRecord, "id">) => {
    documents.push({ ...doc, id: `DOC-${seq++}` });
  };
  for (const load of loads) {
    const driver = DRIVERS.find((item) => item.id === load.driverId);
    if (load.type === "import" && load.timeline.some((event) => event.status === "delivered")) {
      const plan = POD_PLAN[load.id] ?? "approved";
      if (plan !== "missing") {
        const delivered = load.timeline.find((event) => event.status === "delivered");
        push({
          loadId: load.id,
          driverId: load.driverId,
          type: "pod",
          fileName: `Blue-POD-${load.containerNumber}.svg`,
          mimeType: "image/svg+xml",
          uploadedAt: delivered?.at ?? load.createdAt,
          reviewStatus: plan === "approved" ? "approved" : plan === "pending" ? "pending" : "rejected",
          rejectionReason: plan === "rejected" ? "Blue sheet photo is cut off. Upload the full page, including the signature." : undefined,
          sampleKey: "blue-pod",
          sampleParams: {
            container: load.containerNumber,
            loadId: load.id,
            customer: load.customerId,
            driver: driver?.name ?? "Driver",
            when: delivered?.at ?? "",
            destination: load.destinationKey,
          },
          isSample: true,
        });
      }
      if (load.status === "complete" && load.id !== "LD-10409") {
        push({
          loadId: load.id,
          driverId: load.driverId,
          type: "empty_return",
          fileName: `Empty-return-${load.containerNumber}.svg`,
          mimeType: "image/svg+xml",
          uploadedAt: load.completedAt ?? load.createdAt,
          reviewStatus: "approved",
          sampleKey: "generic",
          sampleParams: { merchant: "Terminal EIR", amount: "$0.00", memo: "Empty in-gate", reference: load.containerNumber },
          isSample: true,
        });
      }
    }
    if (load.type === "export" && load.timeline.some((event) => event.status === "gated_in")) {
      push({
        loadId: load.id,
        driverId: load.driverId,
        type: "gate_receipt",
        fileName: `Gate-in-${load.containerNumber}.svg`,
        mimeType: "image/svg+xml",
        uploadedAt: load.timeline.find((event) => event.status === "gated_in")?.at ?? load.createdAt,
        reviewStatus: "approved",
        sampleKey: "generic",
        sampleParams: { merchant: "Port gate", memo: "Full container in-gate", reference: load.containerNumber, amount: "$0.00" },
        isSample: true,
      });
    }
    if (["LD-10401", "LD-10405", "LD-10421", "LD-10406"].includes(load.id)) {
      push({
        loadId: load.id,
        driverId: load.driverId,
        type: "bol",
        fileName: `BOL-${load.bookingNumber}.svg`,
        mimeType: "image/svg+xml",
        uploadedAt: load.createdAt,
        reviewStatus: "approved",
        sampleKey: "generic",
        sampleParams: { merchant: "Bill of lading", memo: load.bookingNumber, reference: load.containerNumber, amount: "$0.00" },
        isSample: true,
      });
    }
  }
  for (const expense of expenseDrafts) {
    if (!expense.sample) continue;
    push({
      loadId: expense.loadId,
      driverId: expense.driverId,
      expenseId: expense.id,
      type: "expense_receipt",
      fileName: `${expense.sample}-receipt-${expense.id}.svg`,
      mimeType: "image/svg+xml",
      uploadedAt: expense.createdAt,
      reviewStatus: expense.status === "approved" ? "approved" : expense.status === "rejected" ? "rejected" : "pending",
      sampleKey: expense.sample,
      sampleParams: {
        merchant: expense.merchant,
        amount: expense.amount.toLocaleString("en-US", { style: "currency", currency: "USD" }),
        date: expense.date,
        unit: expense.truckId ?? "",
        reference: expense.id,
      },
      isSample: true,
    });
  }
  return documents;
}

function buildServices(): { records: ServiceRecord[]; issues: Issue[] } {
  const records: ServiceRecord[] = [];
  const issues: Issue[] = [
    {
      id: "ISS-1",
      truckId: "trk-122",
      opened: "2026-09-28",
      summary: "Transmission slipping in high range",
      detail: "Driver reported a flare between 9th and 10th. Truck is parked in the shop and is not dispatchable.",
      status: "open",
      estimatedCost: 4800,
    },
    {
      id: "ISS-2",
      truckId: "trk-107",
      opened: "2026-09-16",
      summary: "Preventive service overdue",
      detail: "PM was due September 15 and at 448,000 miles. The truck is still running while the bay is booked.",
      status: "open",
      estimatedCost: 680,
    },
    {
      id: "ISS-3",
      truckId: "trk-101",
      opened: "2026-08-02",
      summary: "Replaced steer tires",
      detail: "Closed in August.",
      status: "closed",
      estimatedCost: 940,
    },
  ];
  TRUCKS.forEach((item, index) => {
    records.push({
      id: `SVC-${item.unit}-1`,
      truckId: item.id,
      date: "2026-06-12",
      odometer: item.odometer - 18000 - index * 120,
      kind: "preventive",
      summary: "A-service, oil, filters, chassis lube",
      cost: 640 + index * 15,
      shop: "Oakland Fleet Services",
    });
    records.push({
      id: `SVC-${item.unit}-2`,
      truckId: item.id,
      date: "2026-03-04",
      odometer: item.odometer - 36000,
      kind: index % 4 === 0 ? "repair" : "preventive",
      summary: index % 4 === 0 ? "Brake chamber replacement" : "B-service and DOT inspection",
      cost: index % 4 === 0 ? 880 : 1120,
      shop: index % 2 === 0 ? "Oakland Fleet Services" : "Portside Truck Repair",
    });
  });
  return { records, issues };
}

function buildActivity(loads: Load[], expenses: Expense[]): Activity[] {
  const events: Activity[] = [];
  for (const load of loads) {
    const last = load.timeline.at(-1);
    if (!last) continue;
    const driver = DRIVERS.find((item) => item.id === load.driverId);
    events.push({
      id: `ACT-${load.id}`,
      at: last.at,
      driverId: load.driverId,
      loadId: load.id,
      truckId: load.truckId,
      kind: "status",
      message: driver
        ? `${driver.name} · ${load.containerNumber} · ${last.label}`
        : `${load.id} created · ${load.containerNumber}`,
    });
  }
  for (const expense of expenses) {
    if (expense.status === "awaiting_approval") {
      const driver = DRIVERS.find((item) => item.id === expense.driverId);
      events.push({
        id: `ACT-${expense.id}`,
        at: expense.createdAt,
        driverId: expense.driverId,
        loadId: expense.loadId,
        truckId: expense.truckId,
        kind: "expense",
        message: `${driver?.name ?? "Driver"} submitted ${expense.merchant} for approval`,
      });
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at));
}

export function buildSeed(): DemoData {
  if (DRAFTS.length !== 40) {
    throw new Error(`Expected 40 loads, found ${DRAFTS.length}`);
  }
  const loads = DRAFTS.map(buildLoad);
  const documents = buildDocuments(loads, EXPENSE_DRAFTS);
  const expenses = buildExpenses(EXPENSE_DRAFTS, documents);
  const { records, issues } = buildServices();
  const openings = DRIVERS.map((item) => ({
    id: `open-${item.id}`,
    driverId: item.id,
    at: iso("2026-09-17", "08:00"),
    type: "opening" as const,
    amount: item.id === "drv-andre" ? 240 : item.id === "drv-naomi" ? 160 : 1000,
    memo: "Opening balance",
  }));
  const adjustments = [
    {
      id: "adj-priya",
      driverId: "drv-priya",
      at: iso("2026-09-20", "09:00"),
      type: "adjustment" as const,
      amount: 75,
      memo: "Detention approved on LD-10404",
      loadId: "LD-10404",
    },
    {
      id: "adj-derek",
      driverId: "drv-derek",
      at: iso("2026-09-22", "09:00"),
      type: "adjustment" as const,
      amount: -40,
      memo: "Shortage correction",
    },
    {
      id: "adv-james",
      driverId: "drv-james",
      at: iso("2026-09-20", "12:00"),
      type: "advance" as const,
      amount: -200,
      memo: "Cash advance",
      method: "Cash" as const,
      reference: "ADV-920",
    },
  ];
  let data: DemoData = {
    drivers: DRIVERS,
    trucks: TRUCKS,
    loads,
    expenses,
    documents,
    ledger: [...openings, ...adjustments],
    activity: buildActivity(loads, expenses),
    serviceRecords: records,
    issues,
    thresholds: { miles: 3000, days: 14 },
    clock: DEMO_NOW,
    excelSync: null,
    settlementApprovals: [],
    counters: { load: 10441, expense: 3300, doc: 8000, activity: 2000 },
  };
  data = { ...data, ledger: ensureLedger(data) };
  const payments = DRIVERS.flatMap((item) => {
    const balance = driverBalance(data.ledger, item.id);
    const target = TARGET_BALANCES[item.id] ?? 0;
    const pay = roundMoney(balance - target);
    if (pay <= 0) return [];
    return [
      {
        id: `pay-seed-${item.id}`,
        driverId: item.id,
        at: iso("2026-09-26", "15:00"),
        type: "payment" as const,
        amount: -pay,
        memo: "Weekly settlement payment",
        method: item.id === "drv-rosa" || item.id === "drv-benito" ? ("Check" as const) : ("ACH" as const),
        reference: `ACH-926-${item.id.slice(-4).toUpperCase()}`,
      },
    ];
  });
  data = { ...data, ledger: [...data.ledger, ...payments] };
  for (const item of DRIVERS) {
    const actual = driverBalance(data.ledger, item.id);
    const target = TARGET_BALANCES[item.id] ?? 0;
    if (Math.abs(actual - target) > 0.02) {
      throw new Error(`${item.name} balance ${actual} does not match target ${target}`);
    }
  }
  return data;
}
