// Tidy's regional price suggestion.
// National reference (2026 public ranges, Angi / Housecall Pro): standard 1 bd $75–110, 2 bd $100–150, 3 bd $130–200,
// 4 bd $150–210; deep ≈ 1.5× standard; move-in/out $220–400 (≈ 1.8×). Calibrated as base + per bedroom + per bathroom,
// then scaled by the state's cost of living (BEA Regional Price Parities, 2024, US = 100).
export const RPP: Record<string, number> = {
  AL: 88.8, AK: 102.4, AZ: 100.7, AR: 86.9, CA: 110.7, CO: 103.1, CT: 103.6, DE: 99.8, DC: 109.9, FL: 103.4, GA: 96.3, HI: 110.0,
  ID: 95.5, IL: 100.0, IN: 93.3, IA: 87.8, KS: 90.1, KY: 90.2, LA: 88.2, ME: 97.1, MD: 105.0, MA: 105.8, MI: 96.2, MN: 98.6,
  MS: 87.0, MO: 90.8, MT: 94.6, NE: 90.1, NV: 100.0, NH: 104.2, NJ: 108.8, NM: 92.2, NY: 107.9, NC: 94.3, ND: 89.0, OH: 92.8,
  OK: 87.8, OR: 103.4, PA: 97.6, RI: 102.3, SC: 93.7, SD: 88.6, TN: 91.9, TX: 97.1, UT: 98.9, VT: 98.0, VA: 101.1, WA: 107.0,
  WV: 89.5, WI: 94.1, WY: 92.7,
};
const NATIONAL = { base: 5000, bed: 2200, bath: 2000, deep: 1.5, move: 1.8, cleanerHour: 5000, costHour: 2300 };
const r5 = (c: number) => Math.round(c / 500) * 500;

export type RegionSuggestion = {
  state: string; index: number;
  res_base: number; res_bed: number; res_bath: number; com_cost_hour: number;
  standard: { label: string; beds: number; baths: number; cents: number }[];
  deep3: number; move3: number; hourPerCleaner: number;
};

export function suggestFor(state: string | null | undefined): RegionSuggestion | null {
  const st = (state || '').toUpperCase();
  const idx = RPP[st];
  if (!idx) return null;
  const f = idx / 100;
  const base = r5(NATIONAL.base * f), bed = r5(NATIONAL.bed * f), bath = r5(NATIONAL.bath * f);
  const price = (b: number, ba: number) => r5(base + bed * b + bath * ba);
  const std3 = price(3, 2);
  return {
    state: st, index: idx, res_base: base, res_bed: bed, res_bath: bath, com_cost_hour: r5(NATIONAL.costHour * f),
    standard: [[1, 1], [2, 1], [3, 2], [4, 2.5]].map(([b, ba]) => ({ label: `${b}/${ba}`, beds: b, baths: ba, cents: price(b, ba) })),
    deep3: r5(std3 * NATIONAL.deep), move3: r5(std3 * NATIONAL.move), hourPerCleaner: r5(NATIONAL.cleanerHour * f),
  };
}

/** Company's own price for a 3 bd / 2 ba standard clean vs the region (negative = below) */
export function gapVsRegion(pricing: { res_base: number; res_bed: number; res_bath: number }, state: string | null | undefined) {
  const s = suggestFor(state);
  if (!s) return null;
  const mine = pricing.res_base + pricing.res_bed * 3 + pricing.res_bath * 2;
  const theirs = s.standard[2].cents;
  return { mine, theirs, pct: Math.round(((mine - theirs) / theirs) * 100), s };
}
