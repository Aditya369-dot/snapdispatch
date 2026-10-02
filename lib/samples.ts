import { copy, type Lang } from "@/lib/i18n/copy";
import { phrase } from "@/lib/i18n/phrases";
import type { SampleKey } from "@/lib/types";

const SAMPLE_CLOCK: Record<string, string> = {
  "Oct 1, 2026": "1 oct 2026",
  "Sep 30, 2026": "30 sep 2026",
  "10:18 AM": "10:18 a. m.",
  "1:10 PM": "1:10 p. m.",
  "3:40 PM": "3:40 p. m.",
};

function show(lang: Lang, value: string) {
  if (lang === "es" && SAMPLE_CLOCK[value]) return SAMPLE_CLOCK[value];
  return value;
}

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function sampleSvg(key: SampleKey, params: Record<string, string> = {}, lang: Lang = "en") {
  if (key === "blue-pod") return bluePod(params, lang);
  if (key === "toll") return tollReceipt(params, lang);
  if (key === "fuel") return fuelReceipt(params, lang);
  if (key === "parking") return parkingReceipt(params, lang);
  return genericReceipt(params, lang);
}

export function sampleDataUrl(key: SampleKey, params: Record<string, string> = {}, lang: Lang = "en") {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleSvg(key, params, lang))}`;
}

function bluePod(params: Record<string, string>, lang: Lang) {
  const s = copy[lang].sample;
  const container = esc(params.container ?? "TCLU0000000");
  const loadId = esc(params.loadId ?? "LD-00000");
  const customer = esc(params.customer ?? "Customer");
  const driver = esc(params.driver ?? "Driver");
  const when = esc(show(lang, params.when ?? "Oct 1, 2026"));
  const destination = esc(phrase(lang, params.destination ?? "Consignee"));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">
  <rect width="720" height="960" fill="#e7f1fb"/>
  <rect x="36" y="36" width="648" height="888" rx="8" fill="#f7fbff" stroke="#1d4f91" stroke-width="3"/>
  <rect x="36" y="36" width="648" height="92" fill="#1d4f91"/>
  <text x="360" y="78" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="22" font-weight="700">${esc(s.blueTitle)}</text>
  <text x="360" y="108" text-anchor="middle" fill="#d6e6f7" font-family="Arial, sans-serif" font-size="13">${esc(s.blueSub)}</text>
  <text x="360" y="210" text-anchor="middle" fill="#1d4f91" font-family="Arial, sans-serif" font-size="54" font-weight="700" opacity="0.16" transform="rotate(-18 360 480)">${esc(s.sample)}</text>
  <g font-family="Arial, sans-serif" fill="#16324f">
    <text x="64" y="168" font-size="13" fill="#5d7590">${esc(s.load)}</text>
    <text x="64" y="190" font-size="20" font-weight="700">${loadId}</text>
    <text x="360" y="168" font-size="13" fill="#5d7590">${esc(s.container)}</text>
    <text x="360" y="190" font-size="20" font-weight="700">${container}</text>
    <text x="64" y="236" font-size="13" fill="#5d7590">${esc(s.consignee)}</text>
    <text x="64" y="258" font-size="18">${customer}</text>
    <text x="64" y="300" font-size="13" fill="#5d7590">${esc(s.deliveredTo)}</text>
    <text x="64" y="322" font-size="16">${destination}</text>
    <text x="64" y="364" font-size="13" fill="#5d7590">${esc(s.deliveryTime)}</text>
    <text x="64" y="386" font-size="16">${when}</text>
    <text x="360" y="364" font-size="13" fill="#5d7590">${esc(s.driver)}</text>
    <text x="360" y="386" font-size="16">${driver}</text>
    <text x="64" y="440" font-size="13" fill="#5d7590">${esc(s.pieces)}</text>
    <text x="64" y="462" font-size="16">${esc(s.piecesValue)}</text>
    <rect x="64" y="500" width="592" height="120" fill="#ffffff" stroke="#9db7d3"/>
    <text x="80" y="528" font-size="13" fill="#5d7590">${esc(s.consigneeSign)}</text>
    <text x="80" y="580" font-size="28" font-family="Georgia, serif" fill="#1d4f91">A. Nguyen</text>
    <text x="64" y="670" font-size="13" fill="#5d7590">${esc(s.driverSign)}</text>
    <text x="64" y="706" font-size="24" font-family="Georgia, serif" fill="#1d4f91">${driver}</text>
  </g>
  <text x="360" y="860" text-anchor="middle" fill="#1d4f91" font-family="Arial, sans-serif" font-size="13" font-weight="700">${esc(s.blueFooter)}</text>
  <text x="360" y="886" text-anchor="middle" fill="#5d7590" font-family="Arial, sans-serif" font-size="12">${esc(s.blueFine)}</text>
</svg>`;
}

function receiptFrame(title: string, rows: string, total: string, footer: string, lang: Lang) {
  const s = copy[lang].sample;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="640" viewBox="0 0 420 640">
  <rect width="420" height="640" fill="#f3f1ea"/>
  <rect x="40" y="28" width="340" height="584" fill="#fffdf8"/>
  <text x="210" y="78" text-anchor="middle" font-family="ui-monospace, monospace" font-size="18" fill="#222">${esc(title)}</text>
  <text x="210" y="104" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" fill="#666">${esc(s.customerCopy)}</text>
  ${rows}
  <text x="70" y="470" font-family="ui-monospace, monospace" font-size="16" fill="#222">${esc(s.total)}</text>
  <text x="350" y="470" text-anchor="end" font-family="ui-monospace, monospace" font-size="16" fill="#222">${esc(total)}</text>
  <text x="210" y="540" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" fill="#8a5a00" font-weight="700">${esc(s.sampleReceipt)}</text>
  <text x="210" y="564" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#777">${esc(footer)}</text>
</svg>`;
}

function row(y: number, label: string, value: string) {
  return `<text x="70" y="${y}" font-family="ui-monospace, monospace" font-size="13" fill="#333">${esc(label)}</text>
  <text x="350" y="${y}" text-anchor="end" font-family="ui-monospace, monospace" font-size="13" fill="#333">${esc(value)}</text>`;
}

function tollReceipt(params: Record<string, string>, lang: Lang) {
  const s = copy[lang].sample;
  return receiptFrame(
    params.merchant ?? "FasTrak",
    [
      row(160, s.date, show(lang, params.date ?? "Oct 1, 2026")),
      row(188, s.time, show(lang, params.time ?? "10:18 AM")),
      row(216, s.plaza, params.plaza ?? "Bay Bridge WB"),
      row(244, s.vehicle, params.unit ?? "WS-119"),
      row(272, s.account, "****1842"),
      row(300, s.reference, params.reference ?? "FT-45921"),
    ].join(""),
    params.amount ?? "$45.00",
    s.tollFooter,
    lang,
  );
}

function fuelReceipt(params: Record<string, string>, lang: Lang) {
  const s = copy[lang].sample;
  return receiptFrame(
    params.merchant ?? "Pilot Travel Center",
    [
      row(160, s.date, show(lang, params.date ?? "Oct 1, 2026")),
      row(188, s.site, params.site ?? "Oakland, CA"),
      row(216, s.product, "ULSD"),
      row(244, s.gallons, params.gallons ?? "48.210"),
      row(272, s.unit, params.unit ?? "WS-101"),
      row(300, s.pump, "4"),
    ].join(""),
    params.amount ?? "$186.40",
    s.fuelFooter,
    lang,
  );
}

function parkingReceipt(params: Record<string, string>, lang: Lang) {
  const s = copy[lang].sample;
  return receiptFrame(
    params.merchant ?? "Harbor Lot",
    [
      row(160, s.date, show(lang, params.date ?? "Sep 30, 2026")),
      row(188, s.location, params.site ?? "San Leandro"),
      row(216, s.stall, s.stallValue),
      row(244, s.in, show(lang, "1:10 PM")),
      row(272, s.out, show(lang, "3:40 PM")),
    ].join(""),
    params.amount ?? "$28.00",
    s.parkingFooter,
    lang,
  );
}

function genericReceipt(params: Record<string, string>, lang: Lang) {
  const s = copy[lang].sample;
  return receiptFrame(
    phrase(lang, params.merchant ?? "Vendor"),
    [
      row(160, s.date, show(lang, params.date ?? "Oct 1, 2026")),
      row(188, s.memo, phrase(lang, params.memo ?? s.demoReceipt)),
      row(216, s.ref, params.reference ?? "SAMPLE"),
    ].join(""),
    params.amount ?? "$0.00",
    s.genericFooter,
    lang,
  );
}
