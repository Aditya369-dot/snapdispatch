import type { SampleKey } from "@/lib/types";

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function sampleSvg(key: SampleKey, params: Record<string, string> = {}) {
  if (key === "blue-pod") return bluePod(params);
  if (key === "toll") return tollReceipt(params);
  if (key === "fuel") return fuelReceipt(params);
  if (key === "parking") return parkingReceipt(params);
  return genericReceipt(params);
}

export function sampleDataUrl(key: SampleKey, params: Record<string, string> = {}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleSvg(key, params))}`;
}

function bluePod(params: Record<string, string>) {
  const container = esc(params.container ?? "TCLU0000000");
  const loadId = esc(params.loadId ?? "LD-00000");
  const customer = esc(params.customer ?? "Customer");
  const driver = esc(params.driver ?? "Driver");
  const when = esc(params.when ?? "Oct 1, 2026");
  const destination = esc(params.destination ?? "Consignee");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">
  <rect width="720" height="960" fill="#e7f1fb"/>
  <rect x="36" y="36" width="648" height="888" rx="8" fill="#f7fbff" stroke="#1d4f91" stroke-width="3"/>
  <rect x="36" y="36" width="648" height="92" fill="#1d4f91"/>
  <text x="360" y="78" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="28" font-weight="700">BLUE DELIVERY DOCUMENT</text>
  <text x="360" y="108" text-anchor="middle" fill="#d6e6f7" font-family="Arial, sans-serif" font-size="13">Proof of delivery · Westshore Drayage</text>
  <text x="360" y="210" text-anchor="middle" fill="#1d4f91" font-family="Arial, sans-serif" font-size="54" font-weight="700" opacity="0.16" transform="rotate(-18 360 480)">SAMPLE</text>
  <g font-family="Arial, sans-serif" fill="#16324f">
    <text x="64" y="168" font-size="13" fill="#5d7590">Load</text>
    <text x="64" y="190" font-size="20" font-weight="700">${loadId}</text>
    <text x="360" y="168" font-size="13" fill="#5d7590">Container</text>
    <text x="360" y="190" font-size="20" font-weight="700">${container}</text>
    <text x="64" y="236" font-size="13" fill="#5d7590">Consignee</text>
    <text x="64" y="258" font-size="18">${customer}</text>
    <text x="64" y="300" font-size="13" fill="#5d7590">Delivered to</text>
    <text x="64" y="322" font-size="16">${destination}</text>
    <text x="64" y="364" font-size="13" fill="#5d7590">Delivery time</text>
    <text x="64" y="386" font-size="16">${when}</text>
    <text x="360" y="364" font-size="13" fill="#5d7590">Driver</text>
    <text x="360" y="386" font-size="16">${driver}</text>
    <text x="64" y="440" font-size="13" fill="#5d7590">Pieces / condition</text>
    <text x="64" y="462" font-size="16">1 × 40' container · seals intact · no visible damage</text>
    <rect x="64" y="500" width="592" height="120" fill="#ffffff" stroke="#9db7d3"/>
    <text x="80" y="528" font-size="13" fill="#5d7590">Consignee signature</text>
    <text x="80" y="580" font-size="28" font-family="Georgia, serif" fill="#1d4f91">A. Nguyen</text>
    <text x="64" y="670" font-size="13" fill="#5d7590">Driver signature</text>
    <text x="64" y="706" font-size="24" font-family="Georgia, serif" fill="#1d4f91">${driver}</text>
  </g>
  <text x="360" y="860" text-anchor="middle" fill="#1d4f91" font-family="Arial, sans-serif" font-size="15" font-weight="700">SYNTHETIC SAMPLE — NOT A REAL DELIVERY DOCUMENT</text>
  <text x="360" y="886" text-anchor="middle" fill="#5d7590" font-family="Arial, sans-serif" font-size="12">Generated for the SnapDispatch demo. Do not treat this as a legal POD.</text>
</svg>`;
}

function receiptFrame(title: string, rows: string, total: string, footer: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="640" viewBox="0 0 420 640">
  <rect width="420" height="640" fill="#f3f1ea"/>
  <rect x="40" y="28" width="340" height="584" fill="#fffdf8"/>
  <text x="210" y="78" text-anchor="middle" font-family="ui-monospace, monospace" font-size="18" fill="#222">${esc(title)}</text>
  <text x="210" y="104" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" fill="#666">CUSTOMER COPY</text>
  ${rows}
  <text x="70" y="470" font-family="ui-monospace, monospace" font-size="16" fill="#222">TOTAL</text>
  <text x="350" y="470" text-anchor="end" font-family="ui-monospace, monospace" font-size="16" fill="#222">${esc(total)}</text>
  <text x="210" y="540" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" fill="#8a5a00" font-weight="700">SAMPLE RECEIPT</text>
  <text x="210" y="564" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#777">${esc(footer)}</text>
</svg>`;
}

function row(y: number, label: string, value: string) {
  return `<text x="70" y="${y}" font-family="ui-monospace, monospace" font-size="13" fill="#333">${esc(label)}</text>
  <text x="350" y="${y}" text-anchor="end" font-family="ui-monospace, monospace" font-size="13" fill="#333">${esc(value)}</text>`;
}

function tollReceipt(params: Record<string, string>) {
  return receiptFrame(
    params.merchant ?? "FasTrak",
    [
      row(160, "Date", params.date ?? "Oct 1, 2026"),
      row(188, "Time", params.time ?? "10:18 AM"),
      row(216, "Plaza", params.plaza ?? "Bay Bridge WB"),
      row(244, "Vehicle", params.unit ?? "WS-119"),
      row(272, "Account", "****1842"),
      row(300, "Reference", params.reference ?? "FT-45921"),
    ].join(""),
    params.amount ?? "$45.00",
    "Synthetic sample. Not a real toll charge.",
  );
}

function fuelReceipt(params: Record<string, string>) {
  return receiptFrame(
    params.merchant ?? "Pilot Travel Center",
    [
      row(160, "Date", params.date ?? "Oct 1, 2026"),
      row(188, "Site", params.site ?? "Oakland, CA"),
      row(216, "Product", "ULSD"),
      row(244, "Gallons", params.gallons ?? "48.210"),
      row(272, "Unit", params.unit ?? "WS-101"),
      row(300, "Pump", "4"),
    ].join(""),
    params.amount ?? "$186.40",
    "Synthetic sample. Not a real fuel purchase.",
  );
}

function parkingReceipt(params: Record<string, string>) {
  return receiptFrame(
    params.merchant ?? "Harbor Lot",
    [
      row(160, "Date", params.date ?? "Sep 30, 2026"),
      row(188, "Location", params.site ?? "San Leandro"),
      row(216, "Stall", "Truck row B"),
      row(244, "In", "1:10 PM"),
      row(272, "Out", "3:40 PM"),
    ].join(""),
    params.amount ?? "$28.00",
    "Synthetic sample. Not a real parking charge.",
  );
}

function genericReceipt(params: Record<string, string>) {
  return receiptFrame(
    params.merchant ?? "Vendor",
    [
      row(160, "Date", params.date ?? "Oct 1, 2026"),
      row(188, "Memo", params.memo ?? "Demo receipt"),
      row(216, "Ref", params.reference ?? "SAMPLE"),
    ].join(""),
    params.amount ?? "$0.00",
    "Synthetic sample receipt.",
  );
}
