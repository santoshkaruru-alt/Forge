// Unit helpers. Weights are stored in kg and speeds in mph; both are shown in
// the unit the user picks (lb + mph, or kg + km/h).

export const KG_PER_LB = 0.45359237;
export const KMH_PER_MPH = 1.609344;

export const toKg = (v, unit) => (unit === 'lb' ? v * KG_PER_LB : v);
export const fromKg = (kg, unit) => (unit === 'lb' ? kg / KG_PER_LB : kg);
export const speedUnit = (unit) => (unit === 'lb' ? 'mph' : 'km/h');
export const toMph = (v, unit) => (unit === 'lb' ? v : v / KMH_PER_MPH);
export const fromMph = (mph, unit) => (unit === 'lb' ? mph : mph * KMH_PER_MPH);

/** Trim floating noise: 22.5 -> "22.5", 50.0000001 -> "50". */
export function trimNum(n, dp = 1) {
  if (!Number.isFinite(n)) return '';
  const f = 10 ** dp;
  return String(Math.round(n * f) / f);
}

export const fmtWeight = (kg, unit) => trimNum(fromKg(kg, unit), 1);
export const fmtSpeed = (mph, unit) => (Math.round(fromMph(mph, unit) * 10) / 10).toFixed(1);

/** The jump between loads you can actually pick up, in the display unit. */
export function loadStep(unit, equip) {
  if (unit === 'lb') return 5;
  if (equip === 'db' || equip === 'kb') return 2;
  return 2.5;
}

/** Snap a kg value to the nearest loadable weight in the user's unit; returns kg. */
export function snapKg(kg, unit, equip) {
  const step = loadStep(unit, equip);
  const shown = Math.max(step, Math.round(fromKg(kg, unit) / step) * step);
  return toKg(shown, unit);
}
