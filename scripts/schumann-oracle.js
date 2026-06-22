/**
 * Schumann Oracle — the timing system for all minor tomes.
 * ----------------------------------------------------------------------------
 * NOAA does not publish the ~7.83 Hz Schumann resonance directly, so we drive
 * a nominal 7.83 Hz base and MODULATE it with NOAA SWPC's real, CORS-accessible
 * planetary K-index (geomagnetic activity). Every minor tome and seal is stamped
 * with the resulting "tick" — a shared time-window token so seals minted in the
 * same geomagnetic window are temporally bound together.
 *
 * Firebase-free → the pure `computeTick` math is unit-testable in Node.
 */

export const SCHUMANN_BASE_HZ = 7.83;            // fundamental Schumann resonance
export const NOAA_KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const CADENCE_MS = 3 * 60 * 60 * 1000;            // SWPC Kp cadence: 3-hour windows

/**
 * Pure: turn a Kp value + timestamp into a deterministic Schumann tick.
 * Seals sharing the same (windowId, kp) share a `token` → temporal cohort.
 */
export function computeTick({ kp = null, now = Date.now(), cadenceMs = CADENCE_MS, source = "local-base" } = {}) {
  const k = kp == null ? 2 : Math.max(0, Math.min(9, Number(kp)));
  const freq = +(SCHUMANN_BASE_HZ * (1 + k / 100)).toFixed(4);  // geomagnetic stretches the base
  const windowId = Math.floor(now / cadenceMs);
  const amplitude = +(1 + k / 3).toFixed(3);
  const phase = +(((now % cadenceMs) / cadenceMs) * 2 * Math.PI).toFixed(4);
  const token = `SCHU.${windowId}.${freq}.${k}`;
  return { base: SCHUMANN_BASE_HZ, freq, kp: k, amplitude, phase, windowId, token, source, ts: new Date(now).toISOString() };
}

/** Pure: parse the SWPC Kp product (array of rows, first row is a header). */
export function parseLatestKp(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const kp = parseFloat(last[1]);
  return Number.isFinite(kp) ? kp : null;
}

let _cache = null;       // { tick, fetchedAt }
const FRESH_MS = 5 * 60 * 1000;

/** Live tick: fetch NOAA SWPC Kp (browser), fall back to the deterministic base. */
export async function getTick({ force = false } = {}) {
  if (!force && _cache && Date.now() - _cache.fetchedAt < FRESH_MS) return _cache.tick;
  let kp = null, source = "local-base";
  try {
    const res = await fetch(NOAA_KP_URL, { cache: "no-store" });
    if (res.ok) { kp = parseLatestKp(await res.json()); if (kp != null) source = "noaa-swpc-kp"; }
  } catch (_) { /* offline → base clock */ }
  const tick = computeTick({ kp, source });
  _cache = { tick, fetchedAt: Date.now() };
  return tick;
}

/** A short human label for the header readouts. */
export function tickLabel(t) {
  return `${t.freq.toFixed(2)} Hz · Kp ${t.kp} · win ${t.windowId} · ${t.source === "noaa-swpc-kp" ? "NOAA" : "base"}`;
}
