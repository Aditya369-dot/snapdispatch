export const COMPANY = {
  name: "Westshore Drayage",
  product: "SnapDispatch",
  city: "Oakland, California",
  yard: "1700 Maritime Street, Oakland, CA 94607",
  phone: "(510) 555-0148",
  mc: "MC 948221",
  dot: "USDOT 3122488",
};

export const PITCH_LOAD_ID = "LD-10440";
export const PITCH_DRIVER_ID = "drv-rosa";
export const PITCH_TRUCK_ID = "trk-119";
export const PITCH_CONTAINER = "TCLU4829137";

export interface Place {
  name: string;
  address: string;
  city: string;
  x: number;
  y: number;
}

export const PLACES = {
  trapac: {
    name: "TraPac Oakland",
    address: "2800 7th Street, Oakland, CA 94607",
    city: "Oakland",
    x: 168,
    y: 188,
  },
  oict: {
    name: "Oakland International Container Terminal",
    address: "1717 Middle Harbor Road, Oakland, CA 94607",
    city: "Oakland",
    x: 142,
    y: 214,
  },
  everport: {
    name: "Everport Terminal",
    address: "1155 Middle Harbor Road, Oakland, CA 94607",
    city: "Oakland",
    x: 156,
    y: 168,
  },
  matson: {
    name: "Matson Oakland",
    address: "1555 Middle Harbor Road, Oakland, CA 94607",
    city: "Oakland",
    x: 188,
    y: 206,
  },
  yard: {
    name: "Westshore Yard",
    address: "1700 Maritime Street, Oakland, CA 94607",
    city: "Oakland",
    x: 214,
    y: 196,
  },
  shop: {
    name: "Westshore Shop",
    address: "1750 Maritime Street, Oakland, CA 94607",
    city: "Oakland",
    x: 230,
    y: 228,
  },
  northbay: {
    name: "Northbay Foods DC",
    address: "25800 Industrial Boulevard, Hayward, CA 94545",
    city: "Hayward",
    x: 292,
    y: 332,
  },
  lumen: {
    name: "Lumen Electronics",
    address: "7800 Edgewater Drive, Oakland, CA 94621",
    city: "Oakland",
    x: 236,
    y: 176,
  },
  harbor: {
    name: "Harbor & Pine DC",
    address: "1400 Doolittle Drive, San Leandro, CA 94577",
    city: "San Leandro",
    x: 248,
    y: 286,
  },
  calvista: {
    name: "CalVista Auto Parts",
    address: "46500 Fremont Boulevard, Fremont, CA 94538",
    city: "Fremont",
    x: 318,
    y: 402,
  },
  redwood: {
    name: "Redwood Building Supply",
    address: "1900 North Tracy Boulevard, Tracy, CA 95376",
    city: "Tracy",
    x: 548,
    y: 308,
  },
  apex: {
    name: "Apex Home Goods",
    address: "4120 Arch Road, Stockton, CA 95215",
    city: "Stockton",
    x: 690,
    y: 214,
  },
  mesa: {
    name: "Mesa Cold Storage",
    address: "2450 Navy Drive, Stockton, CA 95206",
    city: "Stockton",
    x: 712,
    y: 248,
  },
  sierra: {
    name: "Sierra Ag Co-op",
    address: "1201 Crows Landing Road, Modesto, CA 95358",
    city: "Modesto",
    x: 848,
    y: 368,
  },
} as const satisfies Record<string, Place>;

export type PlaceKey = keyof typeof PLACES;

export function place(key: string) {
  return PLACES[key as PlaceKey];
}

export const CUSTOMERS = [
  { id: "cus-northbay", name: "Northbay Foods", place: "northbay" },
  { id: "cus-apex", name: "Apex Home Goods", place: "apex" },
  { id: "cus-redwood", name: "Redwood Building Supply", place: "redwood" },
  { id: "cus-lumen", name: "Lumen Electronics", place: "lumen" },
  { id: "cus-sierra", name: "Sierra Ag Co-op", place: "sierra" },
  { id: "cus-harbor", name: "Harbor & Pine Retail", place: "harbor" },
  { id: "cus-calvista", name: "CalVista Auto Parts", place: "calvista" },
  { id: "cus-mesa", name: "Mesa Cold Storage", place: "mesa" },
] as const;

export function customer(id: string) {
  return CUSTOMERS.find((item) => item.id === id);
}

export const FLAT_PAY = {
  importDelivery: 185,
  importEmpty: 95,
  exportMove: 250,
} as const;
