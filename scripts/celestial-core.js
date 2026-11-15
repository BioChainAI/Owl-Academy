// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
/**
 * Celestial core: a low-precision sky for the Celestial Control Panel and for the sky lexicon the Lexicon
 * Explorer rebuilds from three numbers. DOM-free and deterministic. It imports nothing.
 * --------------------------------------------------------------------------------------------------------
 * UNITS AND CONVENTIONS
 *   Every angle in this file is in DEGREES (scripts/hyperbolic-moves.js works in radians).
 *   Time goes in as a Julian Day in Universal Time (jdUt). jde = jdUt + deltaT / 86400 is the same instant in
 *   Terrestrial Time and T = (jde - 2451545) / 36525 counts Julian centuries from J2000. Years are
 *   astronomical: 0 is 1 BC and -592 is 593 BC. The calendar in force ("auto") is the Julian one before
 *   15 October 1582 and the Gregorian one from that day on. East longitude is positive.
 *   Sun and Moon longitudes are apparent, geocentric and of the true equinox of date. Right ascension and
 *   declination are of the true equator and equinox of date. Azimuth runs from north through east.
 *   Frames, all right-handed: "hor" (x east, y north, z up), "equ" (true equator and equinox of date),
 *   "ecl" (ecliptic of date), "gal" (x to the galactic centre, z to the north galactic pole). A frame matrix
 *   is a flat array of nine numbers, row-major, and v_to = M . v_from. The matrices are built from the
 *   passive rotations R1, R2, R3 defined below; the project's rotX, rotY, rotZ turn the other way.
 *
 * SOURCES (section A of this project's astronomy report lists every formula and where it was read)
 *   Meeus, Astronomical Algorithms (1991): chapter 7 (Julian Day), 11 (sidereal time, IAU 1982), 14 and 15
 *   (rising and setting, refraction), 20 (precession as a rigorous rotation), 21 (nutation, four terms, and
 *   the obliquity of Laskar 1986), 24 (the Sun, low-accuracy method), 45 (the Moon, 60 + 60 periodic terms,
 *   here with the mean arguments of the second edition) and 46 (phase and bright limb).
 *   Espenak and Meeus, Five Millennium Canon of Solar Eclipses (NASA/TP-2006-214141, 2006), section 2.7, for
 *   Delta T. The IAU 2006 precession angles in polynomial form. The galactic rotation matrix of the Hipparcos
 *   catalogue (volume 1, equation 1.5.11).
 *
 * MEASURED ACCURACY (development measurements, against other ephemerides)
 *   1800 to 2200, 4,000 random instants at equal Terrestrial Time: Sun longitude within 0.0096 degrees, Moon
 *   longitude within 0.0033, Moon latitude within 0.0013, Moon distance within 12 km. Against PyEphem at 48
 *   instants and three sites: altitude and azimuth within 0.010 degrees (Sun) and 0.006 (Moon, Polaris,
 *   Sagittarius A*), new-Moon times within 1.0 minute.
 *   700 to 500 BC at equal Terrestrial Time: Sun within 0.010 degrees, Moon within 0.012. At a given
 *   Universal Time the larger doubt there is Delta T itself (see the limits).
 *
 * LIMITS THE PAGES STATE (section 4.6 of the specification; the sentences are exported as LIMITS)
 *   - Sun within 0.01 degrees and Moon within 0.01 degrees of PyEphem for 1800 to 2200.
 *   - After about 2045 the real uncertainty is the Delta T allowance: 0.04 degrees by 2100 and 0.1 by 2200.
 *   - At 593 BC the Moon is uncertain by about 0.07 degrees, because the slow drift of the Earth's rotation
 *     (Delta T) is known only to about plus or minus 8 minutes for that year.
 *   - Star aberration (0.006 degrees) and proper motion are neglected.
 *   - Sunrise and sunset are when the Sun's centre is 0.83 degrees below the level horizon, the usual
 *     allowance for the bending of light in air and for the Sun's size; all other altitudes are airless.
 *   - Polaris is 0.6 degrees from the pole today and was 15.0 degrees from it in 593 BC. A page prints the
 *     pole distance of date and does not call Polaris the pole star when that exceeds 2 degrees.
 *   - The Delta T polynomial is 6 s too large today (harmless: 0.001 degrees for the Moon).
 *   - deltaTSigma is an allowance of this project, not a measurement. The uncertainty badge is shown
 *     whenever moonLongitudeSigmaDeg(year) is 0.01 degrees or more: before about AD 915 and after about 2045.
 *
 * CHECKS
 *   Development test: 6,900 checks, 0 failures: 3,726 against the Python reference of the same formulas, 2,001
 *   against PyEphem 4.2.1, 1,173 against Swiss-Ephemeris-based positions; Skyfield and native Swiss Ephemeris
 *   values were compared during development only. The committed test runs 2,900 checks (printed by the test).
 *
 * WHAT IS IN HERE
 *   1. The tested reference port: Julian Day, Delta T, obliquity, nutation, precession, Sun, Moon, phase,
 *      sidereal time, horizontal coordinates, sky() and sunsetJdUt(), with every formula and constant kept.
 *   2. Additions for the pages: calendar parts with range checks, sites, anchors, great-circle bearings,
 *      Sun events, seasons, the Delta T allowance, the evening of a phase, the bright limb as the observer
 *      sees it, the four frames, and skyState(), one frozen snapshot of everything a page shows.
 *   3. The chart: a chosen projection (direction computed, depth a logarithmic scale of distance). It is a
 *      reading of this project and not a claim about the shape of space.
 *   4. skyLexiconRows(): the same sky as LEX/1 rows, a pure function of three rounded numbers.
 *
 * Constructors and converters throw a RangeError (a bad number) or an Error (a bad name) whose message is
 * one of the fixed sentences in RANGE_MESSAGES or a fixed sentence below; no message repeats its input.
 */

const DEG = Math.PI / 180;
export const J2000 = 2451545.0;
export const AU_KM = 149597870.7;
export const EARTH_RADIUS_KM = 6378.14;              // equatorial; used for the Moon's parallax
export const EARTH_MEAN_RADIUS_KM = 6371.0088;       // mean; used for great-circle distances
export const KM_PER_LIGHT_SECOND = 299792.458;
export const LIGHT_SECONDS_PER_AU = AU_KM / KM_PER_LIGHT_SECOND;
export const LIGHT_SECONDS_PER_LY = 31557600;        // one Julian year of 365.25 days
export const LY_PER_PC = 3.2615637772;

export const norm360 = (x) => ((x % 360) + 360) % 360;
export const norm180 = (x) => norm360(x + 180) - 180;
const sind = (x) => Math.sin(x * DEG);
const cosd = (x) => Math.cos(x * DEG);
const tand = (x) => Math.tan(x * DEG);
const atan2d = (y, x) => Math.atan2(y, x) / DEG;
const clamp1 = (x) => Math.max(-1, Math.min(1, x));
const asind = (x) => Math.asin(clamp1(x)) / DEG;
const acosd = (x) => Math.acos(clamp1(x)) / DEG;

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
function deepFreeze(o) {
  if (o !== null && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

/** The fixed messages of every RangeError this file throws. A page may compare e.message with one of them. */
export const RANGE_MESSAGES = Object.freeze({
  number: "a finite number is needed",
  latitude: "the latitude must be a number from -90 to 90",
  longitude: "the east longitude must be a number from -180 to 180",
  year: "the year must be a whole number from -1999 to 3000",
  month: "the month must be a whole number from 1 to 12",
  day: "that day does not exist in the calendar in force",
  time: "the time of day must be at least 0 h and less than 24 h",
  calendar: "the calendar must be auto, julian or gregorian",
  dayOfYear: "that day of the year does not exist",
  instant: "the instant must fall in the years -1999 to 3000 at that longitude",
});

function checkLatLon(lat, lonEast) {
  if (!isNum(lat) || lat < -90 || lat > 90) throw new RangeError(RANGE_MESSAGES.latitude);
  if (!isNum(lonEast) || lonEast < -180 || lonEast > 180) throw new RangeError(RANGE_MESSAGES.longitude);
}

// ====================================================================================================
// PART 1. THE REFERENCE PORT (astronomy report, section A). Formulas and constants are kept as tested.
// ====================================================================================================

// ---------------------------------------------------------------- A1. Julian Day (Meeus ch. 7)
export function isGregorianAuto(y, m, d) {
  return y > 1582 || (y === 1582 && (m > 10 || (m === 10 && d >= 15)));
}

// y: astronomical year (0 = 1 BC, -592 = 593 BC); d: day of month with fraction (UT). No range check:
// jdFromParts is the checked entry.
export function jdFromCalendar(y, m, d, calendar = "auto") {
  if (calendar === "auto") calendar = isGregorianAuto(y, m, d) ? "gregorian" : "julian";
  if (m <= 2) { y -= 1; m += 12; }
  let b = 0;
  if (calendar === "gregorian") {
    const a = Math.floor(y / 100);
    b = 2 - a + Math.floor(a / 4);
  }
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

export function calendarFromJd(jd, calendar = "auto") {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  if (calendar === "auto") calendar = z >= 2299161 ? "gregorian" : "julian";
  let a = z;
  if (calendar === "gregorian") {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day };
}

// ---------------------------------------------------------------- A2. Delta T (Espenak and Meeus 2006)
export const decimalYear = (jdUt) => 2000 + (jdUt - 2451544.5) / 365.2425;

export function deltaTSeconds(y) {
  let u, t;
  if (y < -500) { u = (y - 1820) / 100; return -20 + 32 * u * u; }
  if (y < 500) {
    u = y / 100;
    return 10583.6 - 1014.41 * u + 33.78311 * u ** 2 - 5.952053 * u ** 3 - 0.1798452 * u ** 4
      + 0.022174192 * u ** 5 + 0.0090316521 * u ** 6;
  }
  if (y < 1600) {
    u = (y - 1000) / 100;
    return 1574.2 - 556.01 * u + 71.23472 * u ** 2 + 0.319781 * u ** 3 - 0.8503463 * u ** 4
      - 0.005050998 * u ** 5 + 0.0083572073 * u ** 6;
  }
  if (y < 1700) { t = y - 1600; return 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129; }
  if (y < 1800) {
    t = y - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000;
  }
  if (y < 1860) {
    t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4
      + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  if (y < 1900) {
    t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) {
    t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1941) { t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t ** 2 + 0.0020936 * t ** 3; }
  if (y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547; }
  if (y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718; }
  if (y < 2005) {
    t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4
      + 0.00002373599 * t ** 5;
  }
  if (y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t ** 2; }
  if (y < 2150) { u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y); }
  u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

export const jdeFromJdUt = (jdUt) => jdUt + deltaTSeconds(decimalYear(jdUt)) / 86400;
export const centuries = (jde) => (jde - J2000) / 36525;

// ---------------------------------------------------------------- A3. obliquity, nutation
export function meanObliquity(T) {            // Laskar 1986; |T| < 100
  const U = T / 100;
  const sec = -4680.93 * U - 1.55 * U ** 2 + 1999.25 * U ** 3 - 51.38 * U ** 4 - 249.67 * U ** 5
    - 39.05 * U ** 6 + 7.12 * U ** 7 + 27.87 * U ** 8 + 5.79 * U ** 9 + 2.45 * U ** 10;
  return 23 + 26 / 60 + 21.448 / 3600 + sec / 3600;
}

export function moonNode(T) {
  return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T ** 2 + T ** 3 / 450000);
}

export function nutation(T) {                 // returns { dpsi, deps } in degrees
  const om = moonNode(T);
  const L = 280.4665 + 36000.7698 * T;
  const Lp = 218.3165 + 481267.8813 * T;
  const dpsi = -17.20 * sind(om) - 1.32 * sind(2 * L) - 0.23 * sind(2 * Lp) + 0.21 * sind(2 * om);
  const deps = 9.20 * cosd(om) + 0.57 * cosd(2 * L) + 0.10 * cosd(2 * Lp) - 0.09 * cosd(2 * om);
  return { dpsi: dpsi / 3600, deps: deps / 3600 };
}

// ---------------------------------------------------------------- A9. coordinate transforms
export function eclToEqu(lam, beta, eps) {
  const ra = atan2d(sind(lam) * cosd(eps) - tand(beta) * sind(eps), cosd(lam));
  const dec = asind(sind(beta) * cosd(eps) + cosd(beta) * sind(eps) * sind(lam));
  return { ra: norm360(ra), dec };
}

export function equToEcl(ra, dec, eps) {
  const lam = atan2d(sind(ra) * cosd(eps) + tand(dec) * sind(eps), cosd(ra));
  const beta = asind(sind(dec) * cosd(eps) - cosd(dec) * sind(eps) * sind(ra));
  return { lambda: norm360(lam), beta };
}

/** Unit vector of a longitude and a latitude in a right-handed frame. Never give it an azimuth: use dirHor. */
export function dirFromAngles(lonDeg, latDeg) {
  return [cosd(latDeg) * cosd(lonDeg), cosd(latDeg) * sind(lonDeg), sind(latDeg)];
}
/** Longitude (0..360) and latitude of a vector. The longitude is not an azimuth: use horFromDir for "hor". */
export function anglesFromDir(v) {
  return { lon: norm360(atan2d(v[1], v[0])), lat: asind(v[2] / Math.hypot(v[0], v[1], v[2])) };
}
/** m . v for a flat row-major 3 x 3 matrix. */
export function rotate(m, v) {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
export function transpose3(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
/** a . b for flat row-major 3 x 3 matrices. */
export function mul3(a, b) {
  const out = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
  return out;
}

// J2000 equatorial -> galactic (Hipparcos Vol. 1, eq. 1.5.11), row-major. Printed to ten decimals, so it is a
// rotation to about 1e-10 and not to the last bit; every matrix into or out of "gal" inherits that.
const GAL = Object.freeze([
  -0.0548755604, -0.8734370902, -0.4838350155,
  +0.4941094279, -0.4448296300, +0.7469822445,
  -0.8676661490, -0.1980763734, +0.4559837762,
]);
const GAL_T = Object.freeze(transpose3(GAL));

export function equJ2000ToGal(ra, dec) {
  const s = anglesFromDir(rotate(GAL, dirFromAngles(ra, dec)));
  return { l: s.lon, b: s.lat };
}
export function galToEquJ2000(l, b) {
  const s = anglesFromDir(rotate(GAL_T, dirFromAngles(l, b)));
  return { ra: s.lon, dec: s.lat };
}

// ---------------------------------------------------------------- A8. precession (IAU 2006 angles)
export function precessionAngles(T) {
  const zeta = (2.650545 + 2306.083227 * T + 0.2988499 * T ** 2 + 0.01801828 * T ** 3
    - 0.000005971 * T ** 4 - 0.0000003173 * T ** 5) / 3600;
  const z = (-2.650545 + 2306.077181 * T + 1.0927348 * T ** 2 + 0.01826837 * T ** 3
    - 0.000028596 * T ** 4 - 0.0000002904 * T ** 5) / 3600;
  const theta = (2004.191903 * T - 0.4294934 * T ** 2 - 0.04182264 * T ** 3
    - 0.000007089 * T ** 4 - 0.0000001274 * T ** 5) / 3600;
  return { zeta, z, theta };
}

// mean J2000 -> mean equator & equinox of date
export function precessFromJ2000(ra0, dec0, T) {
  const { zeta, z, theta } = precessionAngles(T);
  const A = cosd(dec0) * sind(ra0 + zeta);
  const B = cosd(theta) * cosd(dec0) * cosd(ra0 + zeta) - sind(theta) * sind(dec0);
  const C = sind(theta) * cosd(dec0) * cosd(ra0 + zeta) + cosd(theta) * sind(dec0);
  return { ra: norm360(atan2d(A, B) + z), dec: atan2d(C, Math.hypot(A, B)) };
}

// J2000 catalogue direction -> TRUE equator & equinox of date (precession + nutation; no aberration)
export function starOfDate(ra0, dec0, T) {
  const p = precessFromJ2000(ra0, dec0, T);
  const eps0 = meanObliquity(T);
  const { dpsi, deps } = nutation(T);
  const e = equToEcl(p.ra, p.dec, eps0);
  return eclToEqu(e.lambda + dpsi, e.beta, eps0 + deps);
}

// ---------------------------------------------------------------- A4. Sun (Meeus, low accuracy)
export function sunPosition(jde) {
  const T = centuries(jde);
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T ** 2);
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T ** 2);
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T ** 2;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T ** 2) * sind(M)
    + (0.019993 - 0.000101 * T) * sind(2 * M) + 0.000289 * sind(3 * M);
  const trueLon = norm360(L0 + C);
  const R = 1.000001018 * (1 - e * e) / (1 + e * cosd(M + C));   // au
  const { dpsi, deps } = nutation(T);
  const eps0 = meanObliquity(T);
  const eps = eps0 + deps;
  const lambda = norm360(trueLon - 0.00569 + dpsi);              // apparent
  const { ra, dec } = eclToEqu(lambda, 0, eps);
  return { T, L0, M, e, C, trueLon, lambda, beta: 0, distanceAu: R, eps0, eps, dpsi, deps, ra, dec };
}

// ---------------------------------------------------------------- A5. Moon (Meeus ch. 45; ch. 47 of the 2nd ed.)
// [D, M, M', F, sine coefficient for longitude (1e-6 deg), cosine coefficient for distance (1e-3 km)]
const MOON_LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0], [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958], [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258], [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354], [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0], [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739], [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421], [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0], [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0], [2, 0, 3, 0, 294, 0], [2, 0, -1, -2, 0, 8752],
];
// [D, M, M', F, sine coefficient for latitude (1e-6 deg)]
const MOON_B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833], [0, 0, 1, -3, 777], [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607], [2, 0, 2, -1, 596], [2, -1, 1, -1, 491], [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439], [2, 0, 2, 1, 422], [2, 0, -3, -1, 421], [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351], [4, 0, 0, 1, 331], [2, -1, 1, 1, 315], [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283], [2, 1, 1, -1, -229], [1, 1, 0, -1, 223], [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220], [2, 1, -1, -1, -220], [1, 0, 1, 1, -185], [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177], [4, 0, -2, -1, 176], [4, -1, -1, -1, 166], [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132], [1, 0, -1, -1, -119], [4, -1, 0, -1, 115], [2, -2, 0, 1, 107],
];

export function moonPosition(jde) {
  const T = centuries(jde);
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T ** 2 + T ** 3 / 538841 - T ** 4 / 65194000);
  const D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T ** 2 + T ** 3 / 545868 - T ** 4 / 113065000);
  const M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T ** 2 + T ** 3 / 24490000);
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T ** 2 + T ** 3 / 69699 - T ** 4 / 14712000);
  const F = norm360(93.2720950 + 483202.0175233 * T - 0.0036539 * T ** 2 - T ** 3 / 3526000 + T ** 4 / 863310000);
  const A1 = norm360(119.75 + 131.849 * T);
  const A2 = norm360(53.09 + 479264.290 * T);
  const A3 = norm360(313.45 + 481266.484 * T);
  const E = 1 - 0.002516 * T - 0.0000074 * T ** 2;
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, cl, cr] of MOON_LR) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const w = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sl += w * cl * sind(arg);
    sr += w * cr * cosd(arg);
  }
  sl += 3958 * sind(A1) + 1962 * sind(Lp - F) + 318 * sind(A2);
  for (const [d, m, mp, f, cb] of MOON_B) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const w = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sb += w * cb * sind(arg);
  }
  sb += -2235 * sind(Lp) + 382 * sind(A3) + 175 * sind(A1 - F) + 175 * sind(A1 + F)
    + 127 * sind(Lp - Mp) - 115 * sind(Lp + Mp);
  const lambdaGeom = norm360(Lp + sl / 1e6);       // mean equinox of date
  const beta = sb / 1e6;
  const distanceKm = 385000.56 + sr / 1000;
  const { dpsi, deps } = nutation(T);
  const eps = meanObliquity(T) + deps;
  const lambda = norm360(lambdaGeom + dpsi);       // apparent
  const { ra, dec } = eclToEqu(lambda, beta, eps);
  const hp = asind(EARTH_RADIUS_KM / distanceKm);  // equatorial horizontal parallax
  return { T, Lp, D, M, Mp, F, E, lambdaGeom, lambda, beta, distanceKm, ra, dec, hp, eps, dpsi };
}

// ---------------------------------------------------------------- A6. phase
export function moonPhase(sun, moon) {
  const elongLon = norm360(moon.lambda - sun.lambda);                 // 0 new .. 180 full .. 360
  const elongation = acosd(cosd(moon.beta) * cosd(elongLon));         // 0..180
  const R = sun.distanceAu * AU_KM;
  const phaseAngle = atan2d(R * sind(elongation), moon.distanceKm - R * cosd(elongation));
  const illuminatedFraction = (1 + cosd(phaseAngle)) / 2;
  const brightLimbPa = norm360(atan2d(cosd(sun.dec) * sind(sun.ra - moon.ra),
    sind(sun.dec) * cosd(moon.dec) - cosd(sun.dec) * sind(moon.dec) * cosd(sun.ra - moon.ra)));
  return { elongLon, elongation, phaseAngle, illuminatedFraction, brightLimbPa, waxing: elongLon < 180 };
}

export const PHASE_HALF_WIDTH = 6;      // degrees of (Moon - Sun) longitude, about +-11.8 hours
export function phaseName(elongLon) {
  const w = PHASE_HALF_WIDTH;
  if (elongLon < w || elongLon >= 360 - w) return "New Moon";
  if (elongLon < 90 - w) return "Waxing Crescent";
  if (elongLon < 90 + w) return "First Quarter";
  if (elongLon < 180 - w) return "Waxing Gibbous";
  if (elongLon < 180 + w) return "Full Moon";
  if (elongLon < 270 - w) return "Waning Gibbous";
  if (elongLon < 270 + w) return "Last Quarter";
  return "Waning Crescent";
}

const SYNODIC_RATE = 12.190749;         // deg/day
const SYNODIC_MONTH = 29.530588853;     // days

export function elongLonAt(jdUt) {
  const jde = jdeFromJdUt(jdUt);
  return norm360(moonPosition(jde).lambda - sunPosition(jde).lambda);
}

// instant nearest the guess at which (Moon - Sun) longitude = target
export function findPhaseTime(jdUtGuess, target = 0) {
  let jd = jdUtGuess;
  for (let i = 0; i < 30; i++) {
    const step = norm180(elongLonAt(jd) - target) / SYNODIC_RATE;
    jd -= step;
    if (Math.abs(step) < 1e-7) break;
  }
  return jd;
}

export function previousPhaseTime(jdUt, target = 0) {
  const guess = jdUt - norm360(elongLonAt(jdUt) - target) / SYNODIC_RATE;
  let t = findPhaseTime(guess, target);
  if (t > jdUt + 1e-9) t = findPhaseTime(guess - SYNODIC_MONTH, target);
  return t;
}

export function nextPhaseTime(jdUt, target = 0) {
  const guess = jdUt + norm360(target - elongLonAt(jdUt)) / SYNODIC_RATE;
  let t = findPhaseTime(guess, target);
  if (t < jdUt - 1e-9) t = findPhaseTime(guess + SYNODIC_MONTH, target);
  return t;
}

export const moonAgeDays = (jdUt) => jdUt - previousPhaseTime(jdUt, 0);

// ---------------------------------------------------------------- A7. sidereal time
export function gmstDeg(jdUt) {                   // IAU 1982 (Meeus eq. 11.4)
  const T = (jdUt - J2000) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jdUt - J2000) + 0.000387933 * T ** 2 - T ** 3 / 38710000);
}

export function gastDeg(jdUt, jde = jdeFromJdUt(jdUt)) {
  const T = centuries(jde);
  const { dpsi, deps } = nutation(T);
  return norm360(gmstDeg(jdUt) + dpsi * cosd(meanObliquity(T) + deps));
}

// ---------------------------------------------------------------- A10. horizontal coordinates
// azimuth from north through east; lst and ra in degrees
export function equToHor(ra, dec, lat, lst) {
  const H = lst - ra;
  const alt = asind(sind(lat) * sind(dec) + cosd(lat) * cosd(dec) * cosd(H));
  const az = norm360(atan2d(-cosd(dec) * sind(H), sind(dec) * cosd(lat) - cosd(dec) * cosd(H) * sind(lat)));
  return { alt, az };
}

// parallax in altitude for a spherical Earth (azimuth unchanged)
export const topocentricAltitude = (altGeo, hp) => atan2d(sind(altGeo) - sind(hp), cosd(altGeo));

// Saemundsson: refraction (deg) to ADD to a true altitude; use only for alt > -1 deg. No page uses it.
export const refractionDeg = (altTrue) => 1.02 / tand(altTrue + 10.3 / (altTrue + 5.11)) / 60;

// ---------------------------------------------------------------- everything for one instant (reference form)
// stars: { name: { ra, dec } } J2000 degrees. The pages use skyState(); this is kept for the vector test.
export function sky(jdUt, lat = null, lonEast = null, stars = {}) {
  const deltaT = deltaTSeconds(decimalYear(jdUt));
  const jde = jdUt + deltaT / 86400;
  const T = centuries(jde);
  const sun = sunPosition(jde);
  const moon = moonPosition(jde);
  const phase = moonPhase(sun, moon);
  const out = { jdUt, deltaT, jde, T, sun, moon, phase, gmst: gmstDeg(jdUt), gast: gastDeg(jdUt, jde) };
  if (lat !== null) {
    out.lmst = norm360(out.gmst + lonEast);
    out.last = norm360(out.gast + lonEast);
    out.sunHor = equToHor(sun.ra, sun.dec, lat, out.last);
    const mg = equToHor(moon.ra, moon.dec, lat, out.last);
    out.moonHorGeocentric = mg;
    out.moonHor = { alt: topocentricAltitude(mg.alt, moon.hp), az: mg.az };
    out.stars = {};
    for (const [name, st] of Object.entries(stars)) {
      const p = starOfDate(st.ra, st.dec, T);
      out.stars[name] = { ...p, ...equToHor(p.ra, p.dec, lat, out.last) };
    }
  }
  return out;
}

function sunAltitude(jdUt, lat, lonEast) {
  const jde = jdeFromJdUt(jdUt);
  const s = sunPosition(jde);
  return equToHor(s.ra, s.dec, lat, norm360(gastDeg(jdUt, jde) + lonEast)).alt;
}

// UT instant of sunset (Sun's centre at h0, default -50') on the local day whose noon is near the guess.
// Reference behaviour, kept: it always returns a number, also when the Sun does not set (then one end of the
// half-day). Pages use sunAltitudeEventJd, which answers null in that case.
export function sunsetJdUt(jdUtLocalNoonGuess, lat, lonEast, h0 = -0.8333) {
  let a = jdUtLocalNoonGuess, b = a + 0.5;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (a + b);
    if (sunAltitude(mid, lat, lonEast) > h0) a = mid; else b = mid;
  }
  return 0.5 * (a + b);
}

// ====================================================================================================
// PART 2. ADDITIONS FOR THE PAGES
// ====================================================================================================

// ---------------------------------------------------------------- calendar parts, with range checks
export const YEAR_MIN = -1999, YEAR_MAX = 3000;       // the stated validity of the Delta T formulas
export const MONTH_NAMES = Object.freeze(["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"]);
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CALENDARS = ["auto", "julian", "gregorian"];
const isLeap = (year, calendar) => (calendar === "julian" ? year % 4 === 0 : year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
// The calendar of a whole year's February and of its 1 January under "auto": 1582 still begins Julian.
const yearCalendar = (year, calendar) => (calendar === "auto" ? (year > 1582 ? "gregorian" : "julian") : calendar);
const inForce = (year, month, day) => (isGregorianAuto(year, month, day) ? "gregorian" : "julian");

/** The last day of a month. Under "auto" October 1582 still has 31; its days 5 to 14 are refused by jdFromParts. */
export function daysInMonth(year, month, calendar = "auto") {
  if (!CALENDARS.includes(calendar)) throw new RangeError(RANGE_MESSAGES.calendar);
  if (!Number.isInteger(year)) throw new RangeError(RANGE_MESSAGES.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(RANGE_MESSAGES.month);
  return month === 2 && isLeap(year, yearCalendar(year, calendar)) ? 29 : MONTH_DAYS[month - 1];
}
/** 365 or 366; under "auto" the year 1582 has 355 days. */
export function daysInYear(year, calendar = "auto") {
  if (!CALENDARS.includes(calendar)) throw new RangeError(RANGE_MESSAGES.calendar);
  if (!Number.isInteger(year)) throw new RangeError(RANGE_MESSAGES.year);
  if (calendar === "auto" && year === 1582) return 355;
  return isLeap(year, yearCalendar(year, calendar)) ? 366 : 365;
}

// Returns the calendar the date is in ("julian" or "gregorian"), or throws a RangeError.
function checkDate(year, month, day, calendar) {
  if (!CALENDARS.includes(calendar)) throw new RangeError(RANGE_MESSAGES.calendar);
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) throw new RangeError(RANGE_MESSAGES.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(RANGE_MESSAGES.month);
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month, calendar)) throw new RangeError(RANGE_MESSAGES.day);
  if (calendar === "auto" && year === 1582 && month === 10 && day > 4 && day < 15) throw new RangeError(RANGE_MESSAGES.day);
  return calendar === "auto" ? inForce(year, month, day) : calendar;
}
const calendarOf = (parts) => (parts.calendar === undefined ? "auto" : parts.calendar);

/** Julian Day (UT) of calendar parts. Whole hour 0..23, whole minute 0..59, second 0 up to 60. Throws RangeError
 *  for a year outside -1999..3000, a month or a day that does not exist (also 5 to 14 October 1582 under "auto"). */
export function jdFromParts(parts) {
  const { year, month, day, hour = 0, minute = 0, second = 0 } = parts || {};
  const calendar = checkDate(year, month, day, calendarOf(parts || {}));
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59
    || !isNum(second) || second < 0 || second >= 60) throw new RangeError(RANGE_MESSAGES.time);
  return jdFromCalendar(year, month, day, calendar) + (hour + (minute + second / 60) / 60) / 24;
}

/** Calendar parts of a Julian Day: { year, month, day, hour, minute, second, calendar }. The second is rounded
 *  to 0.001 and a rounded 60 carries into the minute, hour, day, month and year. calendar comes back as the
 *  name of the calendar used, so jdFromParts(partsFromJd(jd)) returns jd to the millisecond. */
export function partsFromJd(jd, calendar = "auto") {
  if (!isNum(jd)) throw new RangeError(RANGE_MESSAGES.number);
  if (!CALENDARS.includes(calendar)) throw new RangeError(RANGE_MESSAGES.calendar);
  const ms = Math.round((jd + 0.5) * 86400000);               // whole milliseconds since JD -0.5
  const z = Math.floor(ms / 86400000);                        // the civil day
  const rest = ms - z * 86400000;
  const used = calendar === "auto" ? (z >= 2299161 ? "gregorian" : "julian") : calendar;
  const c = calendarFromJd(z - 0.5, used);
  return {
    year: c.year, month: c.month, day: c.day,
    hour: Math.floor(rest / 3600000), minute: Math.floor((rest % 3600000) / 60000), second: (rest % 60000) / 1000,
    calendar: used,
  };
}

/** Astronomical year -> { n, era }: 0 is 1 BC, -592 is 593 BC, 2026 is AD 2026. */
export function eraYear(year) {
  if (!Number.isInteger(year)) throw new RangeError(RANGE_MESSAGES.year);
  return year <= 0 ? { n: 1 - year, era: "BC" } : { n: year, era: "AD" };
}
/** The inverse of eraYear: (593, "BC") -> -592. */
export function yearFromEra(n, era) {
  if (!Number.isInteger(n) || n < 1 || (era !== "BC" && era !== "AD")) throw new RangeError(RANGE_MESSAGES.year);
  return era === "BC" ? 1 - n : n;
}

/** "31 July 593 BC (Julian calendar)", "14 November 2026", "1 January AD 500 (Julian calendar)". The calendar is
 *  named unless it is the Gregorian one in its own time. Date only: the time of day is formatClock's. */
export function formatDate(parts) {
  const p = parts || {};
  if (!Number.isInteger(p.year)) throw new RangeError(RANGE_MESSAGES.year);
  if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) throw new RangeError(RANGE_MESSAGES.month);
  if (!Number.isInteger(p.day) || p.day < 1 || p.day > 31) throw new RangeError(RANGE_MESSAGES.day);
  const usual = inForce(p.year, p.month, p.day);
  const calendar = p.calendar === "julian" || p.calendar === "gregorian" ? p.calendar : usual;
  const { n, era } = eraYear(p.year);
  const year = era === "BC" ? n + " BC" : n < 1000 ? "AD " + n : String(n);
  const note = calendar === "julian" ? " (Julian calendar)" : usual === "gregorian" ? "" : " (Gregorian calendar)";
  return p.day + " " + MONTH_NAMES[p.month - 1] + " " + year + note;
}

/** Decimal hours -> "19:00" (hours and minutes; seconds are dropped, as on a clock face). */
export function formatClock(hours) {
  if (!isNum(hours) || hours < 0 || hours >= 24) throw new RangeError(RANGE_MESSAGES.time);
  const s = Math.min(86399, Math.floor(hours * 3600 + 0.0005));      // half a millisecond of slack for 19 + 5/60
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60);
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

/** Local mean time in hours (0 up to 24): Universal Time plus four minutes for every degree of east longitude. */
export function localMeanHours(jdUt, lonEast) {
  if (!isNum(jdUt)) throw new RangeError(RANGE_MESSAGES.number);
  if (!isNum(lonEast) || lonEast < -180 || lonEast > 180) throw new RangeError(RANGE_MESSAGES.longitude);
  const d = jdUt + 0.5 + lonEast / 360;
  return (d - Math.floor(d)) * 24;
}

/** The Julian Day (UT) at which it is `hours` (0 up to 24, local mean time) on the local date `parts`
 *  (year, month, day and optionally calendar; a time of day inside parts is not read). */
export function jdFromLocalMean(parts, hours, lonEast) {
  const p = parts || {};
  const calendar = checkDate(p.year, p.month, p.day, calendarOf(p));
  if (!isNum(hours) || hours < 0 || hours >= 24) throw new RangeError(RANGE_MESSAGES.time);
  if (!isNum(lonEast) || lonEast < -180 || lonEast > 180) throw new RangeError(RANGE_MESSAGES.longitude);
  return jdFromCalendar(p.year, p.month, p.day, calendar) + hours / 24 - lonEast / 360;
}

/** Julian Day (UT) of a device clock reading in milliseconds since 1970. */
export function jdFromUnixMs(ms) {
  if (!isNum(ms)) throw new RangeError(RANGE_MESSAGES.number);
  return ms / 86400000 + 2440587.5;
}

/** Day of the year, 1 for 1 January. parts.calendar says which calendar the date is written in; `calendar`
 *  says which year is counted: "auto" (the default) counts the year as it really ran, so in 1582 the ten
 *  dropped days are not counted and 15 October is day 278; "julian" or "gregorian" counts that calendar's
 *  own year (15 October 1582 is day 288 of the proleptic Gregorian year). */
export function dayOfYear(parts, calendar = "auto") {
  if (!CALENDARS.includes(calendar)) throw new RangeError(RANGE_MESSAGES.calendar);
  const p = parts || {};
  const jd = jdFromCalendar(p.year, p.month, p.day, checkDate(p.year, p.month, p.day, calendarOf(p)));
  const year = calendarFromJd(jd, calendar).year;                     // the year that day falls in, in the counting calendar
  return jd - jdFromCalendar(year, 1, 1, yearCalendar(year, calendar)) + 1;
}
/** The date of day n (1..daysInYear) of a year, at 0 h: the inverse of dayOfYear(parts, calendar). */
export function partsFromDayOfYear(year, n, calendar = "auto") {
  if (!CALENDARS.includes(calendar)) throw new RangeError(RANGE_MESSAGES.calendar);
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) throw new RangeError(RANGE_MESSAGES.year);
  if (!Number.isInteger(n) || n < 1 || n > daysInYear(year, calendar)) throw new RangeError(RANGE_MESSAGES.dayOfYear);
  return partsFromJd(jdFromCalendar(year, 1, 1, yearCalendar(year, calendar)) + n - 1, calendar);
}

// ---------------------------------------------------------------- ranges of a sky
// skyState accepts an instant whose LOCAL mean date at the given longitude lies in the years -1999..3000,
// because that local date is the one a page shows and seals. The upper end is exclusive and has no slack: an
// instant is refused when the local date it carries, rounded to the millisecond exactly as partsFromJd rounds
// it, is at or beyond 0 h on 1 January 3001. So no state and no sealed sky is dated in the year 3001, whatever
// the rounding of a link value or of jdUt + lonEast / 360. The lower end keeps its slack.
const LOCAL_JD_MIN = jdFromCalendar(YEAR_MIN, 1, 1, "julian");
const LOCAL_JD_MAX = jdFromCalendar(YEAR_MAX + 1, 1, 1, "gregorian");
const LOCAL_MS_END = (LOCAL_JD_MAX + 0.5) * 86400000;                // whole milliseconds since JD -0.5, as in partsFromJd
const JD_SLACK = 1e-6;                                               // 0.09 s, for the rounding of jdFromLocalMean (lower end only)
/** lat and lonEast are closed ranges; localJd = jdUt + lonEast / 360 runs from the first to below the second. */
export const RANGES = deepFreeze({ lat: [-90, 90], lonEast: [-180, 180], year: [YEAR_MIN, YEAR_MAX], localJd: [LOCAL_JD_MIN, LOCAL_JD_MAX] });

function checkSkyInputs(jdUt, lat, lonEast) {
  checkLatLon(lat, lonEast);
  if (!isNum(jdUt)) throw new RangeError(RANGE_MESSAGES.instant);
  const local = jdUt + lonEast / 360;
  if (local < LOCAL_JD_MIN - JD_SLACK || Math.round((local + 0.5) * 86400000) >= LOCAL_MS_END) throw new RangeError(RANGE_MESSAGES.instant);
}
/** true exactly when skyState(jdUt, lat, lonEast) would not throw. For link values and typed numbers. */
export function skyInputsValid(jdUt, lat, lonEast) {
  try { checkSkyInputs(jdUt, lat, lonEast); return true; } catch { return false; }
}

const round2 = (x) => Number(x.toFixed(2)) + 0;                      // + 0 turns -0 into 0
/** The three numbers a sealed sky is made of: jd to 5 decimals, latitude and longitude to 2. Both pages round
 *  with this function, so the same link gives the same rows and the same chain. */
export function roundSkyInputs(jdUt, lat, lonEast) {
  if (!isNum(jdUt) || !isNum(lat) || !isNum(lonEast)) throw new RangeError(RANGE_MESSAGES.number);
  return { jdUt: Number(jdUt.toFixed(5)), lat: round2(lat), lonEast: round2(lonEast) };
}
/** The same three numbers as the text of a link: { jd: "1505042.16624", lat: "32.13", lon: "45.23" }. */
export function formatSkyInputs(jdUt, lat, lonEast) {
  const q = roundSkyInputs(jdUt, lat, lonEast);
  return { jd: q.jdUt.toFixed(5), lat: q.lat.toFixed(2), lon: q.lonEast.toFixed(2) };
}

// ---------------------------------------------------------------- anchors, sites, dates (data)
/** Eight fixed directions of J2000. Six are bodies with a measured distance; ngp and nep are directions only.
 *  Every sentence here is a `said` statement: it names who measured or published the value. extra holds
 *  verified facts only. distanceRangeLy is the range this project uses, to three figures: it brackets the
 *  measurements named in distanceNote that this project follows (for the Pleiades, not the Hipparcos value). */
export const ANCHORS = deepFreeze([
  {
    key: "sgr_a_star", label: "Sagittarius A*", raJ2000: 266.416837, decJ2000: -29.007811,
    distanceLy: 26673, distanceRangeLy: [26400, 27100],
    distanceNote: "GRAVITY 2019 (arXiv:1904.05721) measured 8178 ± 13 (stat.) ± 22 (sys.) pc; GRAVITY 2021 (arXiv:2112.07478) gives 8277 ± 9 pc. The two are about 300 light-years apart.",
    positionSource: "Reid and Brunthaler 2004 (arXiv:astro-ph/0408107), table note",
    extra: { distancePc: 8178, distanceRangePc: [8100, 8300] },
  },
  {
    key: "vela_pulsar", label: "Vela pulsar", raJ2000: 128.835881, decJ2000: -45.176354,
    distanceLy: 956, distanceRangeLy: [881, 1020],
    distanceNote: "Dodson and others 2003 (arXiv:astro-ph/0302374v3) measured a parallax of 3.4 ± 0.2 mas, which is 293 (+19, -17) pc.",
    positionSource: "Dodson and others 2003 (arXiv:astro-ph/0302374v3), section 3, epoch 2000.0",
    extra: {
      designation: "PSR B0833-45", distancePc: 293, distanceRangePc: [270, 312],
      rotationPeriodMs: 89, turnsPerSecond: 11, millisecondPulsar: false,
      said: "Helfand and others 2001 (arXiv:astro-ph/0007310) call it “the 89 ms pulsar”: about 11 turns a second. Lorimer 2008 (arXiv:0811.0762) gives millisecond pulsars periods of 1.4 to 30 ms, so this is not one of them.",
    },
  },
  {
    key: "cyg_x1", label: "Cygnus X-1", raJ2000: 299.590303, decJ2000: 35.20159,
    distanceLy: 7240, distanceRangeLy: [5710, 7830],
    distanceNote: "Miller-Jones and others 2021 (arXiv:2102.09091) measured 2.22 (+0.18, -0.17) kpc; Reid and others 2011 (arXiv:1106.3688) had 1.86 (+0.12, -0.11) kpc.",
    positionSource: "Reid and others 2011 (arXiv:1106.3688), Table 1, epoch 2009.570",
    extra: { distancePc: 2220, distanceRangePc: [1750, 2400], blackHoleSolarMasses: 21.2 },
  },
  {
    key: "pleiades", label: "Pleiades", raJ2000: 56.871152, decJ2000: 24.105136,
    distanceLy: 444, distanceRangeLy: [434, 450],
    distanceNote: "Melis and others 2014 (arXiv:1408.6544) measured 136.2 ± 1.2 pc and call the Hipparcos value of 120.2 ± 1.5 pc incompatible with it.",
    positionSource: "the catalogue position usually given for Alcyone, the brightest star of the cluster; it agrees with PyEphem's star catalogue to 0.1 arcsecond",
    extra: { catalogue: "M45", positionOf: "Alcyone", distancePc: 136.2, distanceRangePc: [133, 138] },
  },
  {
    key: "polaris", label: "Polaris", raJ2000: 37.954561, decJ2000: 89.264109,
    distanceLy: 434, distanceRangeLy: [323, 522],
    distanceNote: "Evans and others 2018 (arXiv:1807.06115) list the Hipparcos parallax of 7.54 ± 0.11 mas (132.6 ± 1.9 pc) and 137.2 pc from Gaia for its companion; other published values run from 99 to 160 pc.",
    positionSource: "the catalogue position usually given for Polaris; it agrees with PyEphem's star catalogue to 0.2 arcsecond",
    extra: { distancePc: 133, distanceRangePc: [99, 160] },
  },
  {
    key: "m31", label: "Andromeda galaxy", raJ2000: 10.684708, decJ2000: 41.26875,
    distanceLy: 2480000, distanceRangeLy: [2410000, 2580000],
    distanceNote: "Li and others 2021 (arXiv:2107.08029) measured 761 ± 11 kpc.",
    positionSource: "the catalogue position usually given for the nucleus of the galaxy; recalled, not checked against a source",
    extra: { catalogue: "M31", distancePc: 761000, distanceRangePc: [740000, 790000] },
  },
  {
    key: "ngp", label: "North galactic pole", raJ2000: 192.85948, decJ2000: 27.12825,
    distanceLy: null, distanceRangeLy: null, distanceNote: "a direction, not an object",
    positionSource: "the pole of the IAU 1958 galactic system in its J2000 form, as astropy 8.0.2 has it",
    extra: {},
  },
  {
    key: "nep", label: "North ecliptic pole", raJ2000: 270, decJ2000: 66.560709,
    distanceLy: null, distanceRangeLy: null, distanceNote: "a direction, not an object",
    positionSource: "this file's own arithmetic: 90° minus the mean obliquity of J2000 (23° 26′ 21.448″)",
    extra: { ecliptic: "mean ecliptic of J2000" },
  },
]);
const ANCHOR_KEYS = Object.freeze(ANCHORS.map((a) => a.key));
const ANCHOR_GAL = ANCHORS.map((a) => equJ2000ToGal(a.raJ2000, a.decJ2000));   // fixed for all dates

/** The microwave background. Three different numbers; a page always says which one it shows. */
export const CMB = deepFreeze({
  z: 1089.9, lightTravelGyr: 13.79, comovingGly: 45.3, ageAtEmissionYr: 372000,
  note: "Planck 2018 (arXiv:1807.06209, Table 2) gives a redshift of 1089.92 ± 0.25 for last scattering and an age of 13.797 ± 0.023 billion years. Worked out for this project with the Planck 2018 model in astropy: the light has travelled for 13.79 billion years; the matter that sent it is now about 45.3 billion light-years away; when the light left, that matter was about 41.5 million light-years away and the universe was about 372,000 years old.",
});

/** Place presets. Coordinates are approximate; none was read from the device. */
export const SITES = deepFreeze([
  { key: "kebar", label: "By the Kebar (Nippur)", lat: 32.13, lonEast: 45.23, note: "The Kebar is generally identified with the Kabari canal near Nippur, published by Hilprecht in 1898; an identification, not a certainty; position of Nippur approximate, not checked against a source." },
  { key: "nazareth", label: "Nazareth, Israel", lat: 32.70, lonEast: 35.30, note: "First Explorers' zero point; approximate." },
  { key: "mauna-kea", label: "Mauna Kea, Hawaii, United States", lat: 19.82, lonEast: -155.47, note: "A preset of the prototype; approximate." },
  { key: "giza", label: "Giza, Egypt", lat: 29.97, lonEast: 31.13, note: "A preset of the prototype; approximate." },
  { key: "greenwich", label: "Greenwich, England", lat: 51.4769, lonEast: 0, note: "The Royal Observatory, on the line of longitude zero." },
  { key: "atacama", label: "Atacama, Chile", lat: -23.02, lonEast: -67.75, note: "A preset of the prototype; approximate." },
  { key: "kyoto", label: "Kyoto, Japan", lat: 35.01, lonEast: 135.76, note: "A preset of the prototype; approximate." },
  { key: "south-pole", label: "South Pole, Antarctica", lat: -90, lonEast: 0, note: "A preset of the prototype." },
  { key: "new-york", label: "New York, United States", lat: 40.71, lonEast: -74.01, note: "city centre, approximate" },
  { key: "mexico-city", label: "Mexico City, Mexico", lat: 19.43, lonEast: -99.13, note: "city centre, approximate" },
  { key: "sao-paulo", label: "São Paulo, Brazil", lat: -23.55, lonEast: -46.63, note: "city centre, approximate" },
  { key: "lagos", label: "Lagos, Nigeria", lat: 6.52, lonEast: 3.38, note: "city centre, approximate" },
  { key: "nairobi", label: "Nairobi, Kenya", lat: -1.29, lonEast: 36.82, note: "city centre, approximate" },
  { key: "delhi", label: "Delhi, India", lat: 28.61, lonEast: 77.21, note: "city centre, approximate" },
  { key: "beijing", label: "Beijing, China", lat: 39.90, lonEast: 116.41, note: "city centre, approximate" },
  { key: "sydney", label: "Sydney, Australia", lat: -33.87, lonEast: 151.21, note: "city centre, approximate" },
]);

const fixed = (x, n) => { const s = x.toFixed(n); return Number(s) === 0 ? (0).toFixed(n) : s; };   // never "-0.00"
const latitudeText = (lat) => fixed(Math.abs(lat), 2) + "° " + (lat < 0 ? "south" : "north");
const longitudeText = (lon) => fixed(Math.abs(lon), 2) + "° " + (lon < 0 ? "west" : "east");

/** The place a pair of coordinates stands for: the first preset with the same two numbers after rounding to
 *  two decimals, otherwise a place named by its numbers. The sky lexicon takes its place name from here, so
 *  that a page holding only the three numbers of a link names the place the same way. */
export function siteForCoordinates(lat, lonEast) {
  checkLatLon(lat, lonEast);
  const la = round2(lat), lo = round2(lonEast);
  for (const s of SITES) if (round2(s.lat) === la && round2(s.lonEast) === lo) return s;
  return Object.freeze({ key: null, label: "A place at " + latitudeText(la) + ", " + longitudeText(lo), lat: la, lonEast: lo, note: "A place given by its two numbers." });
}

/** Great-circle bearing (degrees east of north, at the first place) and distance on a sphere of mean radius. */
export function bearingAndDistance(lat1, lon1, lat2, lon2) {
  checkLatLon(lat1, lon1);
  checkLatLon(lat2, lon2);
  const dl = lon2 - lon1;
  const h = sind((lat2 - lat1) / 2) ** 2 + cosd(lat1) * cosd(lat2) * sind(dl / 2) ** 2;
  const km = 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h)))) * EARTH_MEAN_RADIUS_KM;
  const bearing = norm360(atan2d(sind(dl) * cosd(lat2), cosd(lat1) * sind(lat2) - sind(lat1) * cosd(lat2) * cosd(dl)));
  return { bearing, km };
}

/** The published dates for "the fifth day" of Ezekiel 1:1. Each gives the two local days whose sunsets end
 *  and begin that day (a day reckoned from sunset to sunset); `said` names who gives the date. */
export const EZEKIEL_DATES = deepFreeze([
  {
    key: "593-07-31", label: "31 July 593 BC", said: "the date usually given",
    endsDay: { year: -592, month: 7, day: 31, calendar: "julian" }, beginsDay: { year: -592, month: 7, day: 30, calendar: "julian" },
  },
  {
    key: "593-07-01", label: "1 July 593 BC", said: "Finegan 1950, using Parker and Dubberstein's tables",
    endsDay: { year: -592, month: 7, day: 1, calendar: "julian" }, beginsDay: { year: -592, month: 6, day: 30, calendar: "julian" },
  },
  {
    key: "594-07-13", label: "13 July 594 BC", said: "Finegan 1950, counting the exile from 598/597; Kutsch 1985 argues for this year",
    endsDay: { year: -593, month: 7, day: 13, calendar: "julian" }, beginsDay: { year: -593, month: 7, day: 12, calendar: "julian" },
  },
]);
/** A `said` note shown with those dates; it has no button. */
export const EZEKIEL_DATES_NOTE = "Older books give 592 BC (Jewish Encyclopedia; Davidson 1892).";

// ---------------------------------------------------------------- Sun events and seasons
/** The instant (JD, UT) at which the Sun's centre crosses altitude h0 going down ("set") or up ("rise"), in
 *  the 12 hours after or before local mean noon; null when it does not cross h0 in that half-day (polar day or
 *  night). jdUtLocalNoon is the UT instant of local mean noon: jdFromLocalMean(parts, 12, lonEast).
 *  The half-day is searched in half-hour steps and the crossing is then found by bisection. */
export function sunAltitudeEventJd(jdUtLocalNoon, lat, lonEast, which, h0 = -0.8333) {
  if (which !== "set" && which !== "rise") throw new Error("which must be rise or set");
  if (!isNum(jdUtLocalNoon) || !isNum(h0)) throw new RangeError(RANGE_MESSAGES.number);
  checkLatLon(lat, lonEast);
  const start = which === "set" ? jdUtLocalNoon : jdUtLocalNoon - 0.5;
  const up = (jd) => sunAltitude(jd, lat, lonEast) > h0;
  const STEPS = 24;
  let a = start, wasUp = up(a);
  for (let i = 1; i <= STEPS; i++) {
    const b = start + (0.5 * i) / STEPS, isUp = up(b);
    if (which === "set" ? wasUp && !isUp : !wasUp && isUp) {
      let lo = a, hi = b;
      for (let k = 0; k < 40; k++) {
        const mid = 0.5 * (lo + hi);
        if (up(mid) === wasUp) lo = mid; else hi = mid;
      }
      return 0.5 * (lo + hi);
    }
    a = b;
    wasUp = isUp;
  }
  return null;
}

/** Sunrise or sunset (JD, UT) on a local date, or null: sunAltitudeEventJd from that day's local mean noon. */
export function sunEventOnLocalDay(parts, lat, lonEast, which, h0 = -0.8333) {
  return sunAltitudeEventJd(jdFromLocalMean(parts, 12, lonEast), lat, lonEast, which, h0);
}

const SUN_RATE = 0.9856;                 // deg/day, the Sun's mean motion in longitude
const SEASONS = Object.freeze(["march-equinox", "june-solstice", "september-equinox", "december-solstice"]);
const sunLambdaAt = (jdUt) => sunPosition(jdeFromJdUt(jdUt)).lambda;
function seasonTime(guess, target) {     // Newton steps on the Sun's apparent longitude
  let jd = guess;
  for (let i = 0; i < 30; i++) {
    const step = norm180(sunLambdaAt(jd) - target) / SUN_RATE;
    jd -= step;
    if (Math.abs(step) < 1e-9) break;
  }
  return jd;
}
/** The equinox or solstice nearest in time: { key, jdUt }, the instant at which the Sun's apparent longitude
 *  is 0 (march-equinox), 90 (june-solstice), 180 (september-equinox) or 270 (december-solstice). */
export function nearestSeasonJd(jdUt) {
  if (!isNum(jdUt)) throw new RangeError(RANGE_MESSAGES.number);
  const lam = sunLambdaAt(jdUt);
  const k = Math.min(3, Math.floor(lam / 90));
  const before = seasonTime(jdUt - (lam - 90 * k) / SUN_RATE, 90 * k);
  const after = seasonTime(jdUt + (90 * (k + 1) - lam) / SUN_RATE, (90 * (k + 1)) % 360);
  return jdUt - before <= after - jdUt ? { key: SEASONS[k], jdUt: before } : { key: SEASONS[(k + 1) % 4], jdUt: after };
}

// ---------------------------------------------------------------- the Delta T allowance
/** Seconds by which Delta T may be off in a given decimal year. An allowance of this project, not a
 *  measurement: Espenak and Meeus's 0.8 t^2 up to 1200, then straight lines through 5 s (1700), 1 s (1800 to
 *  2005) and 7 s (2030), then 4 s more for every year after 2030. */
export function deltaTSigma(y) {
  if (!isNum(y)) throw new RangeError(RANGE_MESSAGES.number);
  const quadratic = (v) => 0.8 * ((v - 1820) / 100) ** 2;
  if (y <= 1200) return quadratic(y);
  if (y <= 1700) return quadratic(1200) + ((5 - quadratic(1200)) * (y - 1200)) / 500;
  if (y <= 1800) return 5 - (4 * (y - 1700)) / 100;
  if (y <= 2005) return 1;
  if (y <= 2030) return 1 + 0.24 * (y - 2005);
  return 7 + 4 * (y - 2030);
}
/** What that allowance does to the Moon's longitude: 0.549 arcseconds for every second. */
export const moonLongitudeSigmaDeg = (y) => (deltaTSigma(y) * 0.549) / 3600;

// ---------------------------------------------------------------- the Moon's phases as buttons
/** The eight names phaseName returns, each with the (Moon - Sun) longitude at its middle. */
export const PHASE_TARGETS = deepFreeze([
  { name: "New Moon", target: 0 }, { name: "Waxing Crescent", target: 45 }, { name: "First Quarter", target: 90 },
  { name: "Waxing Gibbous", target: 135 }, { name: "Full Moon", target: 180 }, { name: "Waning Gibbous", target: 225 },
  { name: "Last Quarter", target: 270 }, { name: "Waning Crescent", target: 315 },
]);

/** "Find the next night with this Moon": { jdUt, phaseJd }. phaseJd is the next instant, never before the
 *  input, at which (Moon - Sun) longitude equals target. jdUt is one hour after sunset on the local evening
 *  that is nearest in time to phaseJd among the evenings not before the input instant. When the Sun does not
 *  set on those days, jdUt is phaseJd itself.
 *  That evening is within 13 hours of phaseJd, except when the nearest evening had already passed at the
 *  input instant (about 4 inputs in 1,000): then it is the first evening after the input, up to a day after
 *  phaseJd, and the Moon is up to about 15 degrees past the target. */
export function phaseEveningJd(jdUt, target, lat, lonEast) {
  if (!isNum(jdUt) || !isNum(target)) throw new RangeError(RANGE_MESSAGES.number);
  checkLatLon(lat, lonEast);
  const phaseJd = Math.max(jdUt, nextPhaseTime(jdUt, norm360(target)));
  const day = Math.floor(phaseJd + lonEast / 360 + 0.5);            // the local civil day holding phaseJd
  let best = null;
  for (let d = day - 1; d <= day + 1; d++) {
    const set = sunAltitudeEventJd(d - lonEast / 360, lat, lonEast, "set");   // local mean noon of day d is JD d, local
    if (set === null) continue;
    const evening = set + 1 / 24;
    if (evening < jdUt) continue;
    if (best === null || Math.abs(evening - phaseJd) < Math.abs(best - phaseJd)) best = evening;
  }
  return { jdUt: best === null ? phaseJd : best, phaseJd };
}

/** Direction of the middle of the Moon's bright limb as the observer sees it: degrees 0..360 measured from
 *  "up" (towards the zenith) towards increasing azimuth, which is to the right when facing the Moon. It equals
 *  (q - chi) mod 360, with chi the position angle of the bright limb and q the parallactic angle. Give it the
 *  Sun's altitude and azimuth and the Moon's TOPOCENTRIC altitude and azimuth. For drawing, the middle of the
 *  lit limb is at canvas offset (sin Z, -cos Z). */
export function brightLimbFromZenith(sunAlt, sunAz, moonAlt, moonAz) {
  return norm360(atan2d(cosd(sunAlt) * sind(sunAz - moonAz),
    sind(sunAlt) * cosd(moonAlt) - cosd(sunAlt) * sind(moonAlt) * cosd(sunAz - moonAz)));
}
/** The same lean on a clock face: 90 -> 3, 120 -> 4, 0 -> 12 ("bright side towards 4 o'clock"). */
export function limbClockHour(angleFromUp) {
  if (!isNum(angleFromUp)) throw new RangeError(RANGE_MESSAGES.number);
  const h = Math.round(norm360(angleFromUp) / 30) % 12;
  return h === 0 ? 12 : h;
}
const COMPASS = Object.freeze(["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]);
/** An azimuth in words, to the nearest of eight points: 205 -> "south-west". */
export function compassPoint(az) {
  if (!isNum(az)) throw new RangeError(RANGE_MESSAGES.number);
  return COMPASS[Math.round(norm360(az) / 45) % 8];
}

// ---------------------------------------------------------------- frames
export const FRAMES = Object.freeze(["hor", "equ", "ecl", "gal"]);
/** Passive rotations (the axes turn, the vector stays), flat and row-major, angle in degrees. */
export function R1(a) { const c = cosd(a), s = sind(a); return [1, 0, 0, 0, c, s, 0, -s, c]; }
export function R2(a) { const c = cosd(a), s = sind(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; }
export function R3(a) { const c = cosd(a), s = sind(a); return [c, s, 0, -s, c, 0, 0, 0, 1]; }

/** Unit vector in "hor" (x east, y north, z up) of an altitude and an azimuth (from north through east). */
export function dirHor(alt, az) {
  return [cosd(alt) * sind(az), cosd(alt) * cosd(az), sind(alt)];
}
export function horFromDir(v) {
  return { alt: asind(v[2] / Math.hypot(v[0], v[1], v[2])), az: norm360(atan2d(v[0], v[1])) };
}

const BASES = new WeakMap();             // state -> the three matrices out of "equ", built once per snapshot
function frameBases(state) {
  let b = state !== null && typeof state === "object" ? BASES.get(state) : undefined;
  if (b) return b;
  if (!state || !isNum(state.T) || !isNum(state.last) || !isNum(state.lat)) throw new Error("a state made by skyState is needed");
  const T = state.T;
  const { zeta, z, theta } = precessionAngles(T);
  const eps0 = meanObliquity(T);
  const { dpsi, deps } = nutation(T);
  const P = mul3(R3(-z), mul3(R2(theta), R3(-zeta)));                 // precession, J2000 -> mean of date
  const N = mul3(R1(-(eps0 + deps)), mul3(R3(-dpsi), R1(eps0)));      // nutation, mean -> true of date
  b = new Map([
    ["equ", [1, 0, 0, 0, 1, 0, 0, 0, 1]],
    ["hor", mul3(R3(90), mul3(R2(90 - state.lat), R3(state.last)))], // rows: east, north, up
    ["ecl", R1(eps0 + deps)],                                         // the true obliquity
    ["gal", mul3(GAL, transpose3(mul3(N, P)))],                       // equ(date) -> equ(J2000) -> gal
  ]);
  BASES.set(state, b);
  return b;
}
/** The rotation that takes a vector written in frame `from` to the same direction written in frame `to`:
 *  v_to = M . v_from. Built from hor <-> equ (latitude and local apparent sidereal time), equ <-> ecl (true
 *  obliquity), equ(date) <-> equ(J2000) (nutation . precession) and equ(J2000) <-> gal. */
export function frameMatrix(from, to, state) {
  if (!FRAMES.includes(from) || !FRAMES.includes(to)) throw new Error("a frame is hor, equ, ecl or gal");
  const b = frameBases(state);
  return mul3(b.get(to), transpose3(b.get(from)));
}

/** n directions, in frame `inFrame`, round the fundamental circle of frame `of` (the horizon, the celestial
 *  equator, the ecliptic or the galactic plane), starting at that frame's longitude 0 and going with it. */
export function circleDirections(of, inFrame, state, n = 96) {
  if (!Number.isInteger(n) || n < 3 || n > 3600) throw new RangeError(RANGE_MESSAGES.number);
  const m = frameMatrix(of, inFrame, state);
  const out = [];
  for (let i = 0; i < n; i++) out.push(rotate(m, [cosd((360 * i) / n), sind((360 * i) / n), 0]));
  return out;
}
/** The two opposite directions, in frame `inFrame`, where the fundamental circle of frame `of` crosses the
 *  plane of `inFrame`; the first is the ascending one (the circle, followed in its own sense, crosses there
 *  to the side of +z). null when the two circles are the same. */
export function circleNodes(of, inFrame, state) {
  const p = rotate(frameMatrix(of, inFrame, state), [0, 0, 1]);     // the pole of the circle
  const h = Math.hypot(p[0], p[1]);
  if (h < 1e-9) return null;
  return [[-p[1] / h, p[0] / h, 0], [p[1] / h, -p[0] / h, 0]];
}

// ---------------------------------------------------------------- one snapshot for the pages
function uncertaintyNote(sunDeg, moonDeg, sigma) {
  const clock = sigma < 120 ? fixed(sigma, 1) + " s" : fixed(sigma / 60, 1) + " minutes";
  return "For this year: Sun about ± " + fixed(sunDeg, 2) + "°, Moon about ± " + fixed(moonDeg, 2) + "°. The formulas are good to 0.01° (Sun) and 0.012° (Moon); "
    + "the rest is an allowance of ± " + clock + " for Delta T, the slow drift of the Earth's rotation. The allowance is this project's, not a measurement.";
}

/** Everything a page shows for one instant and one place, as one frozen snapshot.
 *  date is Universal Time and belongs in telemetry only; every date a page shows or seals is localDate, the
 *  local mean date at that longitude. moon.alt is topocentric (for the read-out and the bright limb);
 *  moon.altGeocentric and bodyDirection are geocentric. anchors[key].ra and .dec are of date; .galL and .galB
 *  never change. Throws RangeError for a latitude outside -90..90, an east longitude outside -180..180, or an
 *  instant whose local date is outside the years -1999..3000. */
export function skyState(jdUt, lat, lonEast) {
  checkSkyInputs(jdUt, lat, lonEast);
  const year = decimalYear(jdUt);
  const deltaT = deltaTSeconds(year);
  const sigma = deltaTSigma(year);
  const jde = jdUt + deltaT / 86400;
  const T = centuries(jde);
  const s = sunPosition(jde);
  const m = moonPosition(jde);
  const ph = moonPhase(s, m);
  const gmst = gmstDeg(jdUt), gast = gastDeg(jdUt, jde);
  const lmst = norm360(gmst + lonEast), last = norm360(gast + lonEast);
  const sunHor = equToHor(s.ra, s.dec, lat, last);
  const moonGeo = equToHor(m.ra, m.dec, lat, last);
  const moonAlt = topocentricAltitude(moonGeo.alt, m.hp);
  const previousNewMoonJd = Math.min(jdUt, previousPhaseTime(jdUt, 0));
  const nextNewMoonJd = Math.max(jdUt, nextPhaseTime(jdUt, 0));
  const anchors = {};
  ANCHORS.forEach((a, i) => {
    const p = starOfDate(a.raJ2000, a.decJ2000, T);
    const h = equToHor(p.ra, p.dec, lat, last);
    const e = equToEcl(p.ra, p.dec, s.eps);
    anchors[a.key] = { ra: p.ra, dec: p.dec, alt: h.alt, az: h.az, eclLon: e.lambda, eclLat: e.beta, galL: ANCHOR_GAL[i].l, galB: ANCHOR_GAL[i].b };
    if (a.key === "polaris") anchors[a.key].poleDistance = 90 - p.dec;
  });
  const moonSigma = (sigma * 0.549) / 3600;
  const sunDeg = Math.hypot(0.01, (sigma * 0.041) / 3600), moonDeg = Math.hypot(0.012, moonSigma);
  return deepFreeze({
    jdUt, lat, lonEast, decimalYear: year, deltaT, deltaTSigma: sigma, jde, T,
    date: partsFromJd(jdUt),
    localDate: partsFromJd(jdUt + lonEast / 360),
    localMeanHours: localMeanHours(jdUt, lonEast),
    obliquity: s.eps,
    gmst, gast, lmst, last,
    zenith: { ra: last, dec: lat },
    poleAltitude: lat,
    sun: { lambda: s.lambda, ra: s.ra, dec: s.dec, distanceAu: s.distanceAu, lightSeconds: s.distanceAu * LIGHT_SECONDS_PER_AU, alt: sunHor.alt, az: sunHor.az },
    moon: {
      lambda: m.lambda, beta: m.beta, ra: m.ra, dec: m.dec, distanceKm: m.distanceKm, lightSeconds: m.distanceKm / KM_PER_LIGHT_SECOND,
      alt: moonAlt, az: moonGeo.az, altGeocentric: moonGeo.alt,
    },
    phase: {
      elongLon: ph.elongLon, elongation: ph.elongation, phaseAngle: ph.phaseAngle, illuminatedFraction: ph.illuminatedFraction,
      brightLimbPa: ph.brightLimbPa, brightLimbFromZenith: brightLimbFromZenith(sunHor.alt, sunHor.az, moonAlt, moonGeo.az),
      name: phaseName(ph.elongLon), waxing: ph.waxing, ageDays: jdUt - previousNewMoonJd, previousNewMoonJd, nextNewMoonJd,
    },
    anchors,
    uncertainty: { sunDeg, moonDeg, moonLongitudeSigmaDeg: moonSigma, badge: moonSigma >= 0.01, note: uncertaintyNote(sunDeg, moonDeg, sigma) },
  });
}

const BODY_KEYS = Object.freeze(["sun", "moon", "zenith", ...ANCHOR_KEYS]);
/** The keys bodyDirection accepts: sun, moon, zenith and the eight anchors. */
export const BODIES = BODY_KEYS;
/** Geocentric unit vector of a body in a frame. key is sun, moon, zenith or an anchor key; anything else throws. */
export function bodyDirection(state, key, frame) {
  if (!BODY_KEYS.includes(key)) throw new Error("a body is sun, moon, zenith or an anchor key");
  if (!FRAMES.includes(frame)) throw new Error("a frame is hor, equ, ecl or gal");
  const bases = frameBases(state);
  const at = key === "zenith" ? state.zenith : key === "sun" ? state.sun : key === "moon" ? state.moon : state.anchors && state.anchors[key];
  if (!at || !isNum(at.ra) || !isNum(at.dec)) throw new Error("a state made by skyState is needed");
  return rotate(bases.get(frame), dirFromAngles(at.ra, at.dec));
}
/** Distance of a body in light-seconds, for the depth of the chart; null for a direction (zenith, ngp, nep). */
export function bodyLightSeconds(state, key) {
  if (!BODY_KEYS.includes(key)) throw new Error("a body is sun, moon, zenith or an anchor key");
  if (key === "sun" || key === "moon") {
    const ls = state && state[key] && state[key].lightSeconds;
    if (!isNum(ls)) throw new Error("a state made by skyState is needed");
    return ls;
  }
  const a = ANCHORS.find((x) => x.key === key);
  return a && a.distanceLy !== null ? a.distanceLy * LIGHT_SECONDS_PER_LY : null;
}

// ====================================================================================================
// PART 3. THE CHART (a reading: a chosen projection, not a claim about space)
// ====================================================================================================
export const DEPTH = Object.freeze({ rho0: 0.5, kappa: 0.135 });
/** Hyperbolic distance from the centre of the chart for a distance in light-seconds. Disc radius = tanh(rho / 2). */
export function depthRho(lightSeconds) {
  return Math.max(0.1, DEPTH.rho0 + DEPTH.kappa * Math.log10(lightSeconds));
}
/** The inverse of depthRho, valid for 0.0011 light-seconds and more (below that depthRho is held at 0.1). */
export function depthLightSeconds(rho) {
  return Math.pow(10, (rho - DEPTH.rho0) / DEPTH.kappa);
}
export const DEPTH_WORDING = "The two constants were chosen so that the Sun falls near the prototype's second shell (0.42) and the Galaxy's objects near its third (0.76). The Moon then sits at 0.25 and Andromeda at 0.83.";
export const CHART_WORDING = "Direction: computed. Depth: a logarithmic scale of the measured distance. The curved geometry is how this chart makes room; it is not a claim that space has this shape.";

/** Depth rings of the chart. The last is the shell of the microwave background at its present distance. */
export const RINGS = deepFreeze([
  ["light-second", "1 light-second", 1],
  ["light-minute", "1 light-minute", 60],
  ["light-hour", "1 light-hour", 3600],
  ["light-year", "1 light-year", LIGHT_SECONDS_PER_LY],
  ["thousand-light-years", "1,000 light-years", 1e3 * LIGHT_SECONDS_PER_LY],
  ["million-light-years", "1 million light-years", 1e6 * LIGHT_SECONDS_PER_LY],
  ["billion-light-years", "1 billion light-years", 1e9 * LIGHT_SECONDS_PER_LY],
  ["microwave-background", "microwave background: 45.3 billion light-years, present distance", CMB.comovingGly * 1e9 * LIGHT_SECONDS_PER_LY],
].map(([key, label, lightSeconds]) => ({ key, label, lightSeconds, rho: depthRho(lightSeconds) })));

/** Hyperboloid point of the chart for a unit direction and a depth: [sinh rho . d, cosh rho]. */
export function chartPoint(dir, rho) {
  const sh = Math.sinh(rho);
  return [sh * dir[0], sh * dir[1], sh * dir[2], Math.cosh(rho)];
}
/** The flat chart: direction round the frame's plane, and depth; height above the plane is not shown. null
 *  when the direction has no bearing in the plane (the zenith in "hor", the pole in "gal"). In "hor" the
 *  screen angle is 90 degrees minus the azimuth: north up, east right. */
export function chartPoint2D(dir, rho) {
  const h = Math.hypot(dir[0], dir[1]);
  if (!(h >= 1e-9)) return null;
  return chartPoint([dir[0] / h, dir[1] / h, 0], rho);
}

/** Section 4.6 as sentences for the "What is real here?" dialog. Each number is pinned by a unit test. */
export const LIMITS = Object.freeze([
  "For the years 1800 to 2200 the Sun is within 0.01° and the Moon within 0.01° of PyEphem.",
  "After about 2045 the real uncertainty is the ΔT allowance: 0.04° for the Moon by 2100 and 0.1° by 2200.",
  "At 593 BC the Moon is uncertain by about 0.07°, because the slow drift of the Earth's rotation (ΔT) is known only to about ± 8 minutes for that year.",
  "Star aberration (0.006°) and proper motion are neglected.",
  "Sunrise and sunset are when the Sun's centre is 0.83° below the level horizon, the usual allowance for the bending of light in air and for the Sun's size; all other altitudes are airless.",
  "Polaris is 0.6° from the pole today and was 15.0° from it in 593 BC.",
  "The ΔT polynomial is 6 s too large today (harmless: Moon 0.001°).",
]);

// ====================================================================================================
// PART 4. THE SKY AS LEX/1 ROWS
// ====================================================================================================
function grouped(n) {                    // 26700 -> "26,700" (no locale tables: the same text on every engine)
  const s = String(Math.round(n));
  let out = "";
  for (let i = 0; i < s.length; i++) out += (i > 0 && (s.length - i) % 3 === 0 ? "," : "") + s[i];
  return out;
}
function lightYearsText(ly) {            // three significant figures
  if (ly >= 1e6) return fixed(ly / 1e6, 2) + " million light-years";
  let p = 1;
  while (ly / p >= 1000) p *= 10;
  return grouped(Math.round(ly / p) * p) + " light-years";
}
function lightYearsRangeText(range) {
  if (range[1] >= 1e6) return fixed(range[0] / 1e6, 2) + " to " + fixed(range[1] / 1e6, 2) + " million";
  return grouped(range[0]) + " to " + grouped(range[1]);
}

/** The sky of a state as rows [address, layer, kind, name, text] in canonical order: about 25 rows under four
 *  top-level entries (four epochs). Every field is a string and every number has fixed decimals.
 *  The rows are a pure function of three rounded numbers: the state's jdUt to 5 decimals and its latitude and
 *  longitude to 2 (roundSkyInputs). The sky is computed again from those three, so two pages holding the same
 *  link build the same rows and the same chain, whatever else they hold. The place name comes from
 *  siteForCoordinates. `site` is optional: when given, its lat and lonEast must round to the state's, or the
 *  call throws; its label is not used. */
export function skyLexiconRows(state, site) {
  if (!state || !isNum(state.jdUt) || !isNum(state.lat) || !isNum(state.lonEast)) throw new Error("a state made by skyState is needed");
  const q = roundSkyInputs(state.jdUt, state.lat, state.lonEast);
  if (site !== undefined && site !== null) {
    if (!isNum(site.lat) || !isNum(site.lonEast) || round2(site.lat) !== q.lat || round2(site.lonEast) !== q.lonEast) throw new Error("the site is not the place of the state");
  }
  const st = skyState(q.jdUt, q.lat, q.lonEast);
  const place = siteForCoordinates(q.lat, q.lonEast);
  const where = "Latitude " + latitudeText(q.lat) + ", longitude " + longitudeText(q.lonEast) + ".";
  const dateText = formatDate(st.localDate);
  const clock = String(st.localDate.hour).padStart(2, "0") + ":" + String(st.localDate.minute).padStart(2, "0");
  const deg = (x) => fixed(x, 2) + "°";
  const rows = [];
  const add = (address, layer, kind, name, text) => rows.push([address, layer, kind, name, text]);

  add("1", "reading", "fix", "Where and when",
    "Three numbers fix this sky: a latitude, a longitude and a Julian Day in Universal Time. Whoever made this lexicon chose them. The Sun, the Moon and every altitude below are worked out from these three and from nothing else.");
  add("1.1", "reading", "place", place.label, where + " " + place.note);
  add("1.2", "reading", "time", dateText,
    "Local date at this longitude: " + dateText + ". Local mean time " + clock + ": the Sun's average time at this longitude, without time zones. Julian Day " + q.jdUt.toFixed(5) + " (Universal Time).");
  add("1.3", "checked", "moon", "Moon: " + st.phase.name,
    st.phase.name + ". " + fixed(100 * st.phase.illuminatedFraction, 1) + " % lit and " + (st.phase.waxing ? "growing" : "shrinking") + ". "
    + fixed(st.phase.ageDays, 2) + " days after new Moon.");

  add("2", "checked", "shell", "Sun and Moon",
    "Worked out for the place and the instant above with the formulas of Meeus (1991) and the ΔT of Espenak and Meeus (2006). For this year the Sun is good to about "
    + deg(st.uncertainty.sunDeg) + " and the Moon to about " + deg(st.uncertainty.moonDeg)
    + ". Altitudes are airless. The Moon's altitude is the one seen from this place. Azimuth runs from north through east.");
  add("2.1", "checked", "body", "Sun",
    "Ecliptic longitude " + deg(st.sun.lambda) + ". Altitude " + deg(st.sun.alt) + ", azimuth " + deg(st.sun.az) + ". Distance "
    + fixed(st.sun.distanceAu, 5) + " au, which is " + fixed(st.sun.lightSeconds, 2) + " light-seconds.");
  add("2.2", "checked", "body", "Moon",
    "Ecliptic longitude " + deg(st.moon.lambda) + ", latitude " + deg(st.moon.beta) + ". Elongation " + deg(st.phase.elongation) + " from the Sun, "
    + (st.phase.waxing ? "waxing" : "waning") + ". Altitude " + deg(st.moon.alt) + ", azimuth " + deg(st.moon.az) + ". Distance "
    + grouped(st.moon.distanceKm) + " km, which is " + fixed(st.moon.lightSeconds, 3) + " light-seconds.");

  add("3", "said", "shell", "Anchors in the Galaxy and beyond",
    "Six objects whose places and distances are those given by the sources named in each entry. This page works out only where each one stands in this sky.");
  let n = 0;
  for (const a of ANCHORS) {
    if (a.distanceLy === null) continue;
    n += 1;
    const sk = st.anchors[a.key];
    add("3." + n, "said", "body", a.label,
      "J2000 position: right ascension " + fixed(a.raJ2000, 4) + "°, declination " + fixed(a.decJ2000, 4) + "°, from " + a.positionSource + ". Distance: about "
      + lightYearsText(a.distanceLy) + " (range used here: " + lightYearsRangeText(a.distanceRangeLy) + "). " + a.distanceNote + (a.extra.said ? " " + a.extra.said : ""));
    add("3." + n + ".1", "checked", "sky", a.label + " in this sky",
      "Altitude " + deg(sk.alt) + ", azimuth " + deg(sk.az) + " at this place and instant. Precession and nutation are applied; aberration and proper motion are neglected."
      + (a.key === "polaris" ? " Polaris stands " + fixed(sk.poleDistance, 1) + "° from the north celestial pole on this date." : ""));
  }

  add("4", "said", "shell", "The rim",
    "At the rim of this chart: the microwave background as the Planck and WMAP teams measured it, one fact of the chart's own geometry, and two ideas of physicists quoted from Pasterski (2021), Raclariu (2021), Strominger (2017) and the NANOGrav collaboration (2025).");
  add("4.1", "said", "measured", "Cosmic microwave background",
    "The WMAP team (2003) wrote: “Decoupling was 379+8-7 kyr after the Big Bang at a redshift of 1089 +/- 1.” " + CMB.note);
  add("4.2", "checked", "geometry", "The celestial sphere",
    "The rim of this ball is where directions live: every sight line from the centre ends at one point of the rim, however far the thing seen. Every move of the ball sends circles on the rim to circles.");
  add("4.3", "said", "proposal", "Celestial holography",
    "A proposal. Pasterski (2021, arXiv:2108.04801) writes: “Celestial Holography proposes a duality between gravitational scattering in asymptotically flat spacetimes and a conformal field theory (CFT) living in two dimensions lower on the celestial sphere.” "
    + "Raclariu (2021, arXiv:2107.02075) writes: “A concrete realization of this duality in any but asymptotically negatively curved backgrounds remains an important open problem.”");
  add("4.4", "said", "predicted", "Gravitational-wave memory",
    "Predicted, not detected. Strominger (2017, arXiv:1703.05448, section 6) writes of this effect: “The effect is harder to see than gravity waves themselves but has a decent chance of being measured in the coming decades.” "
    + "The NANOGrav collaboration (2025, arXiv:2502.18599) reports: “We find no significant evidence for memory signals in the dataset”.");
  return rows;
}
