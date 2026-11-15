// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
// scripts/celestial-core.js (the astronomy core of the Celestial Control Panel): the reference port against a
// reduced copy of the development vectors (tests/unit/fixtures/celestial-vectors.json: the Python reference of
// the same formulas, PyEphem 4.2.1 and Swiss-Ephemeris-based positions), Meeus's worked examples, the sky over
// Nippur on the published dates of Ezekiel 1:1, the bright limb as the observer sees it, the four frames, the
// chart, calendar parts and their ranges, Sun events, seasons, the Delta T allowance, the evening of a phase,
// the data tables, the limits the pages state, and the sky as LEX/1 rows.
// It imports no other core: that every sky row is accepted by makeEntry is tested in
// tests/unit/explorers-integration.test.mjs.
// Run: node --test tests/unit/celestial-core.test.mjs   (about 10 seconds; it prints its number of vector checks)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.OWL_TEST_ROOT || path.resolve(import.meta.dirname, "../..");
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const C = await load("scripts/celestial-core.js");
const SOURCE = readFileSync(path.join(ROOT, "scripts/celestial-core.js"), "utf8");
const FIX = JSON.parse(readFileSync(new URL("./fixtures/celestial-vectors.json", import.meta.url), "utf8"));

// ─── helpers ─────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const n180 = (x) => ((((x + 180) % 360) + 360) % 360) - 180;
/** Great-circle distance in degrees between two directions given as altitude and azimuth. */
function sep(alt1, az1, alt2, az2) {
  const a1 = alt1 * DEG, a2 = alt2 * DEG, dz = (az1 - az2) * DEG;
  const h = Math.sin((a1 - a2) / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dz / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(Math.max(0, h)))) / DEG;
}
const near = (got, want, tol, label) => assert.ok(Math.abs(got - want) <= tol, `${label}: got ${got}, want ${want} within ${tol}`);
const nearAngle = (got, want, tol, label) => assert.ok(Math.abs(n180(got - want)) <= tol, `${label}: got ${got}, want ${want} within ${tol}`);
/** mulberry32: the same seed always gives the same numbers. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const det3 = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
const maxDiff = (a, b) => { assert.equal(a.length, b.length); return Math.max(...a.map((x, i) => Math.abs(x - b[i]))); };
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const deepFrozen = (o) => o === null || typeof o !== "object" || (Object.isFrozen(o) && Object.values(o).every(deepFrozen));
const site = (key) => { const s = C.SITES.find((x) => x.key === key); assert.ok(s, "site " + key); return s; };
const KEBAR = site("kebar"), NAZARETH = site("nazareth"), GREENWICH = site("greenwich");
const SANTIAGO = FIX.meta.sites.santiago;                          // { lat: -33.45, lon_east: -70.67 }
const vectorJd = (v) => { const i = v.input; return C.jdFromCalendar(i.year, i.month, i.day + (i.hour + (i.minute + i.second / 60) / 60) / 24, i.calendar); };
const sunsetOn = (parts, s = KEBAR) => C.sunEventOnLocalDay(parts, s.lat, s.lonEast, "set");
const NIPPUR_SUNSET = sunsetOn(C.EZEKIEL_DATES[0].endsDay);        // the sunset that ends the fifth day, 31 July 593 BC
const STARS = Object.fromEntries(Object.entries(FIX.meta.stars).map(([k, v]) => [k, { ra: v.ra, dec: v.dec }]));

// The numbers of the sentence in the header of the core (section 4.1): 100 checks for every vector.
const PER_VECTOR = { spec: 54, ephem: 29, rigorous: 17 };
const DEVELOPMENT_VECTORS = 69, COMMITTED_VECTORS = 29;
const COMMITTED_CHECKS = COMMITTED_VECTORS * (PER_VECTOR.spec + PER_VECTOR.ephem + PER_VECTOR.rigorous);

// ─── 1. the vector file ──────────────────────────────────────────────────────

test("vectors: the port equals the Python reference, and agrees with PyEphem and the Swiss-Ephemeris-based block", (t) => {
  const tol = FIX.meta.tolerances, sites = FIX.meta.sites;
  const tally = { spec: 0, ephem: 0, rigorous: 0 }, failures = [];
  let id = "";
  const check = (label, group, got, want, tolerance, angular = false) => {
    if (want === null || want === undefined) return;      // nothing is missing: the totals are asserted below
    let d = got - want;
    if (angular) d = n180(d);
    d = Math.abs(d);
    tally[group.split("/")[0]] += 1;
    if (!(d <= tolerance)) failures.push(`${id} ${group} ${label}: got ${got}, want ${want}, |diff| ${d} > ${tolerance}`);
  };
  for (const v of FIX.vectors) {
    id = v.id;
    const i = v.input;
    const day = i.day + (i.hour + (i.minute + i.second / 60) / 60) / 24;
    const jd = C.jdFromCalendar(i.year, i.month, day, i.calendar);
    const sp = v.spec, ts = tol.vs_spec;
    // (1) against the Python reference of the same formulas
    check("jd_ut", "spec", jd, v.jd_ut, ts.jd_days);
    const back = C.calendarFromJd(jd, i.calendar);
    check("inverse year", "spec", back.year, i.year, 0);
    check("inverse month", "spec", back.month, i.month, 0);
    check("inverse day", "spec", back.day, day, 1e-6);
    const o = C.sky(jd);
    check("delta_t_s", "spec", o.deltaT, sp.delta_t_s, ts.delta_t_s);
    check("jde", "spec", o.jde, sp.jde, ts.jd_days);
    check("obliquity_true", "spec", o.sun.eps, sp.obliquity_true_deg, ts.angles_deg);
    check("dpsi", "spec", o.sun.dpsi * 3600, sp.nutation_dpsi_arcsec, ts.nutation_arcsec);
    check("gmst", "spec", o.gmst, sp.gmst_deg, ts.angles_deg, true);
    check("gast", "spec", o.gast, sp.gast_deg, ts.angles_deg, true);
    check("sun lambda", "spec", o.sun.lambda, sp.sun.lambda_deg, ts.angles_deg, true);
    check("sun ra", "spec", o.sun.ra, sp.sun.ra_deg, ts.angles_deg, true);
    check("sun dec", "spec", o.sun.dec, sp.sun.dec_deg, ts.angles_deg);
    check("sun distance", "spec", o.sun.distanceAu, sp.sun.distance_au, ts.distance_au);
    check("moon lambda", "spec", o.moon.lambda, sp.moon.lambda_deg, ts.angles_deg, true);
    check("moon beta", "spec", o.moon.beta, sp.moon.beta_deg, ts.angles_deg);
    check("moon ra", "spec", o.moon.ra, sp.moon.ra_deg, ts.angles_deg, true);
    check("moon dec", "spec", o.moon.dec, sp.moon.dec_deg, ts.angles_deg);
    check("moon distance", "spec", o.moon.distanceKm, sp.moon.distance_km, ts.distance_km);
    check("elong_lon", "spec", o.phase.elongLon, sp.phase.elong_lon_deg, ts.angles_deg, true);
    check("elongation", "spec", o.phase.elongation, sp.phase.elongation_deg, ts.angles_deg);
    check("phase angle", "spec", o.phase.phaseAngle, sp.phase.phase_angle_deg, ts.angles_deg);
    check("illuminated fraction", "spec", o.phase.illuminatedFraction, sp.phase.illuminated_fraction, ts.illuminated_fraction);
    check("bright limb PA", "spec", o.phase.brightLimbPa, sp.phase.bright_limb_pa_deg, 1e-3, true);
    tally.spec += 1;
    if (C.phaseName(o.phase.elongLon) !== sp.phase.name) failures.push(`${id} spec phase name: got ${C.phaseName(o.phase.elongLon)}, want ${sp.phase.name}`);
    const tNew = C.previousPhaseTime(jd, 0);
    check("previous new moon", "spec", tNew, sp.phase.previous_new_moon_jd_ut, ts.age_days_and_new_moon_jd);
    check("age", "spec", jd - tNew, sp.phase.age_days, ts.age_days_and_new_moon_jd);

    // (2) against PyEphem (native) and the rigorous block, with the tolerances of the vector's era
    const era = v.era, te = tol.vs_ephem[era], tr = tol.vs_rigorous[era], e = v.ephem, r = v.rigorous;
    const g = "ephem/" + era, gr = "rigorous/" + era;
    check("sun.lambda", g, o.sun.lambda, e.sun.lambda_deg, te["sun.lambda_deg"], true);
    check("sun.ra", g, o.sun.ra, e.sun.ra_deg, te["sun.ra_deg"], true);
    check("sun.dec", g, o.sun.dec, e.sun.dec_deg, te["sun.dec_deg"]);
    check("sun.distance", g, o.sun.distanceAu, e.sun.distance_au, te["sun.distance_au"]);
    check("moon.lambda", g, o.moon.lambda, e.moon.lambda_deg, te["moon.lambda_deg"], true);
    check("moon.beta", g, o.moon.beta, e.moon.beta_deg, te["moon.beta_deg"]);
    check("moon.ra", g, o.moon.ra, e.moon.ra_deg, te["moon.ra_deg"], true);
    check("moon.dec", g, o.moon.dec, e.moon.dec_deg, te["moon.dec_deg"]);
    check("moon.distance", g, o.moon.distanceKm, e.moon.distance_km, te["moon.distance_km"]);
    check("phase.elong_lon", g, o.phase.elongLon, e.phase.elong_lon_deg, te["phase.elong_lon_deg"], true);
    check("phase.elongation", g, o.phase.elongation, e.phase.elongation_deg, te["phase.elongation_deg"]);
    check("phase.illuminated_fraction", g, o.phase.illuminatedFraction, e.phase.illuminated_fraction, te["phase.illuminated_fraction"]);
    check("phase.age_days", g, jd - tNew, e.phase.age_days, te["phase.age_days"]);
    check("gast", g, o.gast, e.gast_deg, te["gast_deg"], true);
    check("sun.lambda", gr, o.sun.lambda, r.sun.lambda_deg, tr["sun.lambda_deg"], true);
    check("moon.lambda", gr, o.moon.lambda, r.moon.lambda_deg, tr["moon.lambda_deg"], true);
    check("moon.beta", gr, o.moon.beta, r.moon.beta_deg, tr["moon.beta_deg"]);
    check("gmst", gr, o.gmst, r.gmst_deg, tr["gmst_deg"], true);
    check("gast", gr, o.gast, r.gast_deg, tr["gast_deg"], true);

    for (const [key, s] of Object.entries(sites)) {
      const so = C.sky(jd, s.lat, s.lon_east, STARS);
      const ss = sp.sites[key];
      check("last", "spec", so.last, ss.last_deg, ts.angles_deg, true);
      const objs = { sun: so.sunHor, moon: so.moonHor, polaris: so.stars.polaris, sgr_a_star: so.stars.sgr_a_star };
      for (const [name, h] of Object.entries(objs)) {
        check(name + " alt", "spec", h.alt, ss[name].alt_deg, ts.angles_deg);
        check(name + " direction", "spec", sep(h.alt, h.az, ss[name].alt_deg, ss[name].az_deg), 0, ts.angles_deg);
        check("sites." + name + ".direction", g, sep(h.alt, h.az, e.sites[key][name].alt_deg, e.sites[key][name].az_deg), 0, te["sites." + name + ".direction_deg"]);
        check("sites." + name + ".direction", gr, sep(h.alt, h.az, r.sites[key][name].alt_deg, r.sites[key][name].az_deg), 0, tr["sites." + name + ".direction_deg"]);
      }
      check("sites.last", g, so.last, e.sites[key].last_deg, te["sites.last_deg"], true);
    }
  }
  const total = tally.spec + tally.ephem + tally.rigorous;
  t.diagnostic(`celestial vectors: ${FIX.vectors.length} vectors, ${total} checks (${tally.spec} against the Python reference of the same formulas, `
    + `${tally.ephem} against PyEphem 4.2.1, ${tally.rigorous} against Swiss-Ephemeris-based positions), ${failures.length} failures`);
  assert.deepEqual(failures, []);
  assert.equal(FIX.vectors.length, COMMITTED_VECTORS);
  assert.deepEqual(tally, { spec: COMMITTED_VECTORS * PER_VECTOR.spec, ephem: COMMITTED_VECTORS * PER_VECTOR.ephem, rigorous: COMMITTED_VECTORS * PER_VECTOR.rigorous });
  assert.equal(total, COMMITTED_CHECKS);
  assert.equal(COMMITTED_CHECKS, 2900);
});

test("vectors: the fixture is the reduced file section 4.5 describes", () => {
  const ids = FIX.vectors.map((v) => v.id);
  assert.equal(new Set(ids).size, 29);
  assert.equal(ids.filter((x) => x.startsWith("modern_")).length, 12);
  assert.equal(ids.filter((x) => x.startsWith("ancient_")).length, 6);
  assert.equal(ids.filter((x) => !/^(modern|ancient)_\d\d$/.test(x)).length, 11);
  for (const name of ["j2000_noon_ut", "eclipse_2024_04_08", "today_2026_11_14_0000", "ezekiel_593bc_07_31_0h", "ezekiel_593bc_07_30_sunset",
    "ezekiel_593bc_07_31_sunset", "ezekiel_593bc_08_01_sunset", "ezekiel_593bc_07_01_sunset"]) assert.ok(ids.includes(name), name);
  for (const v of FIX.vectors) {
    assert.deepEqual(Object.keys(v), ["id", "label", "input", "jd_ut", "era", "spec", "ephem", "rigorous"], v.id);
    assert.equal(v.era, v.jd_ut < 1600000 ? "ancient" : "modern", v.id);       // the era rule of the file
  }
  assert.deepEqual(Object.keys(FIX.meta), ["title", "note", "generated_on", "independent_libraries", "conventions", "sites", "stars", "anchors", "scale_objects", "tolerances"]);
  assert.match(FIX.meta.note, /The full file.*was used in development: 69 vectors, 6,900 checks, 0 failures\./);
  assert.equal(FIX.meta.independent_libraries.ephem.version, "4.2.1");
  const bytes = readFileSync(new URL("./fixtures/celestial-vectors.json", import.meta.url)).length;
  assert.ok(bytes <= 200000, `the fixture is ${bytes} bytes`);
});

test("vectors: the reference values the development test did not read, and skyState on the same instants", (t) => {
  let n = 0;
  const ok = (cond, label) => { n += 1; assert.ok(cond, label); };
  const close = (got, want, tol, label, angular = false) => ok(Math.abs(angular ? n180(got - want) : got - want) <= tol, `${label}: got ${got}, want ${want} within ${tol}`);
  for (const v of FIX.vectors) {
    const jd = vectorJd(v), sp = v.spec, o = C.sky(jd), L = v.id + " ";
    close(o.T, sp.T, 1e-11, L + "T");
    close(C.meanObliquity(o.T), sp.obliquity_mean_deg, 2e-6, L + "mean obliquity");
    close(o.sun.deps * 3600, sp.nutation_deps_arcsec, 0.001, L + "deps");
    close(o.gmst / 15, sp.gmst_h, 2e-7, L + "gmst_h");
    close(o.gast / 15, sp.gast_h, 2e-7, L + "gast_h");
    close(o.sun.beta, sp.sun.beta_deg, 0, L + "sun beta");
    close(o.sun.trueLon, sp.sun.true_longitude_deg, 2e-6, L + "sun true longitude", true);
    close(o.sun.L0, sp.sun.mean_longitude_deg, 2e-6, L + "sun mean longitude", true);
    close(o.sun.M, sp.sun.mean_anomaly_deg, 2e-6, L + "sun mean anomaly", true);
    close(o.moon.hp, sp.moon.horizontal_parallax_deg, 2e-6, L + "moon parallax");
    for (const k of ["Lp", "D", "M", "Mp", "F"]) close(o.moon[k], sp.moon.args_deg[k], 2e-6, L + "moon argument " + k, true);
    ok(o.phase.waxing === sp.phase.waxing, L + "waxing");
    for (const [key, s] of Object.entries(FIX.meta.sites)) {
      const ss = sp.sites[key], so = C.sky(jd, s.lat, s.lon_east, STARS), st = C.skyState(jd, s.lat, s.lon_east), S = L + key + " ";
      close(so.lmst, ss.lmst_deg, 2e-6, S + "lmst", true);
      close(so.last / 15, ss.last_h, 2e-7, S + "last_h");
      close(so.moonHorGeocentric.alt, ss.moon.alt_geocentric_deg, 2e-6, S + "moon geocentric altitude");
      for (const name of ["polaris", "sgr_a_star"]) {
        close(so.stars[name].ra, ss[name].ra_of_date_deg, 2e-6 / Math.cos(ss[name].dec_of_date_deg * DEG), S + name + " ra of date", true);
        close(so.stars[name].dec, ss[name].dec_of_date_deg, 2e-6, S + name + " dec of date");
        // the anchors of skyState use the same two stars, with coordinates rounded to six decimals
        close(sep(st.anchors[name].alt, st.anchors[name].az, ss[name].alt_deg, ss[name].az_deg), 0, 3e-6, S + name + " anchor direction");
      }
      // skyState is the same computation as sky(): equal to the last bit
      for (const k of ["deltaT", "jde", "T", "gmst", "gast", "lmst", "last"]) ok(st[k] === so[k], S + "state " + k);
      for (const k of ["lambda", "ra", "dec", "distanceAu"]) ok(st.sun[k] === so.sun[k], S + "state sun " + k);
      for (const k of ["lambda", "beta", "ra", "dec", "distanceKm"]) ok(st.moon[k] === so.moon[k], S + "state moon " + k);
      for (const k of ["elongLon", "elongation", "phaseAngle", "illuminatedFraction", "brightLimbPa", "waxing"]) ok(st.phase[k] === so.phase[k], S + "state phase " + k);
      ok(st.sun.alt === so.sunHor.alt && st.sun.az === so.sunHor.az, S + "state sun altitude and azimuth");
      ok(st.moon.alt === so.moonHor.alt && st.moon.az === so.moonHor.az && st.moon.altGeocentric === so.moonHorGeocentric.alt, S + "state moon altitude and azimuth");
      ok(st.obliquity === so.sun.eps, S + "state obliquity");
      ok(st.phase.name === sp.phase.name, S + "state phase name");
      close(st.phase.previousNewMoonJd, sp.phase.previous_new_moon_jd_ut, 1e-5, S + "state previous new moon");
      close(st.phase.ageDays, sp.phase.age_days, 1e-5, S + "state age");
      close(sep(st.sun.alt, st.sun.az, v.ephem.sites[key].sun.alt_deg, v.ephem.sites[key].sun.az_deg), 0, FIX.meta.tolerances.vs_ephem[v.era]["sites.sun.direction_deg"], S + "state sun against PyEphem");
      close(sep(st.moon.alt, st.moon.az, v.ephem.sites[key].moon.alt_deg, v.ephem.sites[key].moon.az_deg), 0, FIX.meta.tolerances.vs_ephem[v.era]["sites.moon.direction_deg"], S + "state moon against PyEphem");
    }
  }
  t.diagnostic(`further checks on the same ${FIX.vectors.length} vectors (values the development test did not read, and skyState): ${n}`);
  assert.equal(n, FIX.vectors.length * (16 + 3 * 39));
});

// ─── 2. Meeus's worked examples (astronomy report, sections A1, A4, A5, A7) ──

test("A1 Julian Day: the examples of Meeus chapter 7 and this project's dates", () => {
  near(C.jdFromCalendar(1957, 10, 4.81), 2436116.31, 1e-9, "1957 October 4.81");
  assert.equal(C.jdFromCalendar(333, 1, 27.5), 1842713.0);
  assert.equal(C.jdFromCalendar(-1000, 7, 12.5), 1356001.0);
  assert.equal(C.jdFromCalendar(-4712, 1, 1.5), 0);
  assert.equal(C.jdFromCalendar(-592, 7, 31, "julian"), 1505041.5);
  assert.equal(C.jdFromCalendar(2026, 11, 14), 2461358.5);
  near(C.jdFromCalendar(2024, 4, 8.7625), 2460409.2625, 1e-9, "2024 April 8.7625");
  assert.deepEqual(C.calendarFromJd(2436116.31), { year: 1957, month: 10, day: C.calendarFromJd(2436116.31).day });
  near(C.calendarFromJd(2436116.31).day, 4.81, 1e-6, "inverse of 2436116.31");
  assert.deepEqual(C.calendarFromJd(1842713.0), { year: 333, month: 1, day: 27.5 });
  assert.deepEqual(C.calendarFromJd(1507900.13), { year: -584, month: 5, day: C.calendarFromJd(1507900.13).day });   // Meeus: -584 May 28.63
  near(C.calendarFromJd(1507900.13).day, 28.63, 1e-6, "inverse of 1507900.13");
  assert.equal(C.isGregorianAuto(1582, 10, 15), true);
  assert.equal(C.isGregorianAuto(1582, 10, 14), false);
  assert.equal(C.jdFromCalendar(1582, 10, 15) - C.jdFromCalendar(1582, 10, 4), 1, "15 October 1582 follows 4 October");
});

test("A4 Sun: Meeus's example for 13 October 1992 (JDE 2448908.5)", () => {
  const s = C.sunPosition(2448908.5);
  near(s.L0, 201.807197, 1e-6, "L0");
  near(s.M, 278.993966, 1e-6, "M");
  near(s.C, -1.897324, 1e-6, "C");
  near(s.trueLon, 199.909873, 1e-6, "true longitude");
  near(s.distanceAu, 0.997662, 1e-6, "R");
  near(s.lambda, 199.908635, 1e-6, "apparent longitude");
  near(s.ra, 198.38052, 1e-5, "right ascension");
  near(s.dec, -7.78500, 1e-5, "declination");
  assert.equal(s.beta, 0);
});

test("A5 Moon: Meeus's example for 12 April 1992 (JDE 2448724.5)", () => {
  const m = C.moonPosition(2448724.5);
  near(m.Lp, 134.290182, 1e-6, "L'");
  near(m.D, 113.842304, 1e-6, "D");
  near(m.M, 97.643514, 1e-6, "M");
  near(m.Mp, 5.150833, 1e-6, "M'");
  near(m.F, 219.889721, 1e-6, "F");
  near(m.E, 1.000194, 1e-6, "E");
  near(m.lambdaGeom, 133.162655, 1e-6, "longitude");
  near(m.beta, -3.229126, 1e-6, "latitude");
  near(m.distanceKm, 368409.68, 0.01, "distance");
  near(m.hp, 0.991990, 1e-6, "horizontal parallax");
});

test("A7 sidereal time: Meeus's example for 10 April 1987, 19:21:00 UT", () => {
  const jd = C.jdFromCalendar(1987, 4, 10 + (19 + 21 / 60) / 24);
  near(C.gmstDeg(jd), 128.7378734, 5e-7, "mean sidereal time");
  near(C.gmstDeg(2451545.0) / 15, 18.697375, 1e-6, "GMST at J2000 noon UT, hours");
  const T = C.centuries(C.jdeFromJdUt(jd)), n = C.nutation(T);
  near(n180(C.gastDeg(jd) - C.gmstDeg(jd)), n.dpsi * Math.cos((C.meanObliquity(T) + n.deps) * DEG), 1e-12, "equation of the equinoxes");
});

// ─── 3. Nippur, on the published dates of Ezekiel 1:1 ────────────────────────

test("31 July 593 BC over Nippur: the sunset that ends the fifth day, and the Moon at that sunset", () => {
  assert.equal(C.jdFromParts({ year: -592, month: 7, day: 31, calendar: "julian" }), 1505041.5);
  assert.equal(C.jdFromParts({ year: -592, month: 7, day: 31 }), 1505041.5, "the calendar in force is the Julian one");
  assert.equal(KEBAR.lat, 32.13);
  assert.equal(KEBAR.lonEast, 45.23);
  near(NIPPUR_SUNSET, C.jdFromParts({ year: -592, month: 7, day: 31, hour: 15, minute: 59 }), 1 / 1440, "sunset at 15:59 UT");
  near(C.localMeanHours(NIPPUR_SUNSET, KEBAR.lonEast), 19, 1 / 60, "19:00 local mean time");
  assert.equal(C.formatClock(C.localMeanHours(NIPPUR_SUNSET, KEBAR.lonEast)), "19:00");
  const st = C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast);
  near(st.sun.alt, -0.8333, 1e-6, "the Sun's centre at sunset");
  near(100 * st.phase.illuminatedFraction, 50.2, 0.3, "per cent lit");
  near(st.phase.elongation, 90.1, 0.2, "degrees from the Sun");
  near(st.phase.ageDays, 6.78, 0.02, "days old");
  assert.equal(st.phase.name, "First Quarter");
  assert.equal(st.phase.waxing, true);
  near(st.moon.alt, 41.9, 0.2, "topocentric altitude");
  nearAngle(st.moon.az, 205.3, 0.3, "azimuth");
  near(st.moon.altGeocentric - st.moon.alt, 0.70, 0.02, "parallax in altitude");
  near((NIPPUR_SUNSET - C.previousPhaseTime(NIPPUR_SUNSET, 90)) * 1440, 11.9, 0.5, "first quarter, minutes before that sunset");
  near(st.deltaT, 18588, 1, "Delta T, seconds");
  assert.deepEqual({ ...st.localDate, second: 0 }, { year: -592, month: 7, day: 31, hour: 19, minute: 0, second: 0, calendar: "julian" });
  assert.equal(C.formatDate(st.localDate), "31 July 593 BC (Julian calendar)");
  nearAngle(st.anchors.sgr_a_star.az, 181.0, 0.3, "Sagittarius A* azimuth");
  near(st.anchors.sgr_a_star.alt, 34.6, 0.2, "Sagittarius A* altitude");
  near(st.anchors.polaris.poleDistance, 15.0, 0.1, "Polaris from the pole in 593 BC");
  near(st.obliquity, 23.764, 0.001, "obliquity in 593 BC");
});

test("the six sunsets that begin and end the fifth day on the three published dates", () => {
  const lit = (parts) => 100 * C.skyState(sunsetOn(parts), KEBAR.lat, KEBAR.lonEast).phase.illuminatedFraction;
  const want = { "593-07-31": [39.8, 50.2], "593-07-01": [33.4, 44.3], "594-07-13": [38.0, 48.0] };
  assert.deepEqual(C.EZEKIEL_DATES.map((d) => d.key), Object.keys(want));
  for (const d of C.EZEKIEL_DATES) {
    near(lit(d.beginsDay), want[d.key][0], 0.5, d.label + ", the sunset that begins the day");
    near(lit(d.endsDay), want[d.key][1], 0.5, d.label + ", the sunset that ends the day");
    near(sunsetOn(d.endsDay) - sunsetOn(d.beginsDay), 1, 0.002, d.label + ": one day from sunset to sunset");
    assert.equal(C.jdFromParts(d.endsDay) - C.jdFromParts(d.beginsDay), 1);
  }
  // the fixture's own instants for 30 July and 1 July 593 BC (sunset rounded to the minute)
  const byId = (id) => FIX.vectors.find((v) => v.id === id);
  near(sunsetOn(C.EZEKIEL_DATES[0].beginsDay), byId("ezekiel_593bc_07_30_sunset").jd_ut, 1.5 / 1440, "30 July");
  near(sunsetOn(C.EZEKIEL_DATES[1].endsDay), byId("ezekiel_593bc_07_01_sunset").jd_ut, 1.5 / 1440, "1 July");
});

test("Polaris today, and the June solstice of 593 BC", () => {
  const today = C.skyState(C.jdFromParts({ year: 2026, month: 11, day: 14 }), GREENWICH.lat, GREENWICH.lonEast);
  near(today.anchors.polaris.poleDistance, 0.6, 0.1, "Polaris from the pole in 2026");
  near(today.anchors.polaris.alt, GREENWICH.lat, 0.7, "Polaris stands near the pole's altitude");
  assert.equal(today.poleAltitude, GREENWICH.lat);
  const s = C.nearestSeasonJd(C.jdFromParts({ year: -592, month: 7, day: 31 }));
  assert.equal(s.key, "june-solstice");
  const p = C.partsFromJd(s.jdUt);
  assert.deepEqual([p.year, p.month, p.day, p.calendar], [-592, 6, 29, "julian"]);
  near(p.hour + p.minute / 60 + p.second / 3600, 9.9, 0.3, "the solstice, hours UT");
});

// ─── 4. the bright limb ──────────────────────────────────────────────────────

test("brightLimbFromZenith: the three named skies, north and south of the equator", () => {
  const nippur = C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast);
  near(nippur.phase.brightLimbFromZenith, 91.0, 0.5, "Nippur: lit side to the right, level");
  const greenwich = C.skyState(C.jdFromParts({ year: 2025, month: 3, day: 6, hour: 18, minute: 30 }), GREENWICH.lat, GREENWICH.lonEast);
  near(greenwich.phase.brightLimbFromZenith, 105.35, 0.5, "Greenwich, 6 March 2025, 18:30 UT");
  const santiago = C.skyState(C.jdFromParts({ year: 2025, month: 3, day: 6, hour: 23, minute: 30 }), SANTIAGO.lat, SANTIAGO.lon_east);
  near(santiago.phase.brightLimbFromZenith, 266.68, 0.5, "Santiago, 6 March 2025, 23:30 UT");
  assert.ok(greenwich.phase.brightLimbFromZenith < 180, "a waxing Moon is lit on the right in the north");
  assert.ok(santiago.phase.brightLimbFromZenith > 180, "and on the left in the south, on the same evening");
  assert.ok(greenwich.phase.waxing && santiago.phase.waxing && greenwich.moon.alt > 0 && santiago.moon.alt > 0);
  // the state's value is the formula on the Sun and the topocentric Moon of the state
  for (const st of [nippur, greenwich, santiago]) {
    assert.equal(st.phase.brightLimbFromZenith, C.brightLimbFromZenith(st.sun.alt, st.sun.az, st.moon.alt, st.moon.az));
  }
  assert.equal(C.limbClockHour(nippur.phase.brightLimbFromZenith), 3);
  assert.equal(C.limbClockHour(greenwich.phase.brightLimbFromZenith), 4, "bright side towards 4 o'clock");
  assert.equal(C.limbClockHour(santiago.phase.brightLimbFromZenith), 9);
});

test("brightLimbFromZenith: simple skies, and what it means on the canvas", () => {
  // Moon due south and low, Sun set in the west: the lit side is to the right (west is to the right when facing south).
  near(C.brightLimbFromZenith(-5, 270, 30, 180), 90, 25, "lit on the right");
  assert.ok(C.brightLimbFromZenith(-5, 270, 30, 180) > 0 && C.brightLimbFromZenith(-5, 270, 30, 180) < 180);
  // Sun in the east, Moon in the south: lit on the left
  assert.ok(C.brightLimbFromZenith(10, 90, 30, 180) > 180);
  // Sun straight above the Moon in the same azimuth: lit at the top; straight below: lit at the bottom
  near(n180(C.brightLimbFromZenith(60, 180, 20, 180)), 0, 1e-9, "lit at the top");
  near(C.brightLimbFromZenith(-30, 180, 20, 180), 180, 1e-9, "lit at the bottom");
  // it is the angle, seen by the observer, from "up" to the Sun: atan2(s . right, s . up)
  const next = rng(77);
  for (let i = 0; i < 500; i++) {
    const aS = -80 + 160 * next(), AS = 360 * next(), aM = -80 + 160 * next(), AM = 360 * next();
    const m = C.dirHor(aM, AM), s = C.dirHor(aS, AS);
    const up = [-Math.sin(aM * DEG) * Math.sin(AM * DEG), -Math.sin(aM * DEG) * Math.cos(AM * DEG), Math.cos(aM * DEG)];   // d m / d altitude
    const right = [Math.cos(AM * DEG), -Math.sin(AM * DEG), 0];                                                             // towards increasing azimuth
    near(maxDiff(cross(m, up), right), 0, 1e-12, "right = m x up");
    nearAngle(C.brightLimbFromZenith(aS, AS, aM, AM), Math.atan2(dot(s, right), dot(s, up)) / DEG, 1e-9, "the angle from up towards the right");
  }
  const z = C.brightLimbFromZenith(-5, 270, 30, 180);
  assert.ok(Math.sin(z * DEG) > 0, "canvas offset (sin Z, -cos Z): the lit limb is drawn to the right");
  for (const [angle, hour] of [[0, 12], [14.9, 12], [15.1, 1], [90, 3], [120, 4], [180, 6], [270, 9], [345.1, 12], [359.9, 12], [-90, 9], [450, 3]]) assert.equal(C.limbClockHour(angle), hour, "clock " + angle);
  assert.throws(() => C.limbClockHour(NaN), RangeError);
});

test("brightLimbFromZenith: the PyEphem vectors with elongation 20 to 160 degrees", (t) => {
  const { vectors, tolerance_deg: tol } = FIX.bright_limb;
  assert.equal(tol, 0.3);
  assert.equal(vectors.length, 10);
  let n = 0;
  for (const v of vectors) {
    assert.ok(v.elongation_deg >= 20 && v.elongation_deg <= 160, v.label);
    // (a) the formula, on PyEphem's own altitudes and azimuths, against parallactic angle minus position angle
    const f = C.brightLimbFromZenith(v.sun_alt_deg, v.sun_az_deg, v.moon_alt_deg, v.moon_az_deg);
    nearAngle(f, v.q_minus_chi_deg, 1e-3, v.label + " " + v.date_ut + ": the formula against q - chi");
    nearAngle(f, v.limb_from_zenith_deg, 1e-5, v.label + " " + v.date_ut + ": the formula as PyEphem's script wrote it");
    // (b) the whole computation of this core at the same instant and place
    const st = C.skyState(v.jd_ut, v.lat, v.lon_east);
    nearAngle(st.phase.brightLimbFromZenith, v.limb_from_zenith_deg, tol, v.label + " " + v.date_ut + ": this core against PyEphem");
    near(st.phase.elongation, v.elongation_deg, 1.1, v.label + ": elongation (PyEphem's is seen from the place, this one from the Earth's centre)");
    n += 4;
  }
  assert.ok(vectors.some((v) => v.limb_from_zenith_deg < 180) && vectors.some((v) => v.limb_from_zenith_deg > 180));
  t.diagnostic(`bright limb: ${vectors.length} PyEphem vectors, ${n} checks`);
});

test("compassPoint: an azimuth in words", () => {
  for (const [az, word] of [[0, "north"], [22.4, "north"], [22.6, "north-east"], [90, "east"], [135, "south-east"], [180, "south"], [205.3, "south-west"],
    [270, "west"], [315, "north-west"], [337.6, "north"], [359.9, "north"], [-90, "west"], [720, "north"]]) assert.equal(C.compassPoint(az), word, String(az));
  assert.equal(C.compassPoint(C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast).moon.az), "south-west");
  assert.throws(() => C.compassPoint("north"), RangeError);
});

// ─── 5. frames ───────────────────────────────────────────────────────────────

const FRAME_STATES = () => [
  C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast),
  C.skyState(C.jdFromParts({ year: 2026, month: 11, day: 14, hour: 20 }), GREENWICH.lat, GREENWICH.lonEast),
  C.skyState(C.jdFromParts({ year: 2025, month: 3, day: 6, hour: 23, minute: 30 }), SANTIAGO.lat, SANTIAGO.lon_east),
  C.skyState(C.jdFromParts({ year: 1066, month: 10, day: 14, hour: 9 }), 0, 180),
  C.skyState(C.jdFromParts({ year: 2500, month: 6, day: 1, hour: 3 }), -90, 0),
  C.skyState(C.jdFromParts({ year: -1500, month: 2, day: 28, hour: 23 }), 90, -120),
];

test("frames: the three passive rotations are the ones the specification prints", () => {
  const c = Math.cos(30 * DEG), s = Math.sin(30 * DEG);
  near(maxDiff(C.R1(30), [1, 0, 0, 0, c, s, 0, -s, c]), 0, 1e-15, "R1");
  near(maxDiff(C.R2(30), [c, 0, -s, 0, 1, 0, s, 0, c]), 0, 1e-15, "R2");
  near(maxDiff(C.R3(30), [c, s, 0, -s, c, 0, 0, 0, 1]), 0, 1e-15, "R3");
  // passive: the axes turn. A vector on +x, seen from axes turned by 30 degrees about z, has longitude -30.
  nearAngle(C.anglesFromDir(C.rotate(C.R3(30), [1, 0, 0])).lon, -30, 1e-12, "R3 is passive");
  near(maxDiff(C.rotate(C.R1(90), [0, 0, 1]), [0, 1, 0]), 0, 1e-15, "R1(90) takes +z to +y");
  near(maxDiff(C.rotate(C.R2(90), [1, 0, 0]), [0, 0, 1]), 0, 1e-15, "R2(90) takes +x to +z");
  near(maxDiff(C.mul3(C.R3(20), C.R3(40)), C.R3(60)), 0, 1e-15, "mul3");
  near(maxDiff(C.transpose3(C.R1(25)), C.R1(-25)), 0, 1e-15, "transpose3");
  assert.deepEqual(C.rotate([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 0, -1]), [-2, -2, -2], "row-major");
  assert.deepEqual(C.mul3([1, 2, 3, 4, 5, 6, 7, 8, 9], I3), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(C.FRAMES, ["hor", "equ", "ecl", "gal"]);
});

test("frames: every frameMatrix is a rotation with determinant +1, and the matrices compose and invert", () => {
  for (const st of FRAME_STATES()) {
    for (const from of C.FRAMES) for (const to of C.FRAMES) {
      const m = C.frameMatrix(from, to, st), label = `${from} -> ${to} at ${st.jdUt}`;
      // The galactic matrix is published to ten decimals, so a matrix through "gal" is a rotation to 1e-9.
      const tol = (...frames) => (frames.includes("gal") ? 1e-9 : 1e-12);
      assert.equal(m.length, 9);
      near(maxDiff(C.mul3(m, C.transpose3(m)), I3), 0, tol(from, to), label + " is orthogonal");
      near(det3(m), 1, tol(from, to), label + " has determinant +1");
      near(maxDiff(m, C.transpose3(C.frameMatrix(to, from, st))), 0, 1e-15, label + " is the transpose of the way back");
      if (from === to) near(maxDiff(m, I3), 0, tol(from), label + " is the identity");
      for (const via of C.FRAMES) near(maxDiff(m, C.mul3(C.frameMatrix(via, to, st), C.frameMatrix(from, via, st))), 0, tol(from, to, via), label + " via " + via);
    }
  }
  const st = FRAME_STATES()[0];
  assert.throws(() => C.frameMatrix("hor", "icrs", st), /a frame is hor, equ, ecl or gal/);
  assert.throws(() => C.frameMatrix("HOR", "equ", st), Error);
  assert.throws(() => C.frameMatrix("hor", "equ", null), /a state made by skyState is needed/);
  assert.throws(() => C.frameMatrix("hor", "equ", { T: 0 }), /a state made by skyState is needed/);
});

test("frames: hor has x east, y north, z up; the zenith in equ is (local sidereal time, latitude)", () => {
  for (const st of FRAME_STATES()) {
    const toHor = C.frameMatrix("equ", "hor", st), th = st.last * DEG, ph = st.lat * DEG;
    // rows: east, north, up, written in equatorial coordinates
    near(maxDiff(toHor, [-Math.sin(th), Math.cos(th), 0, -Math.sin(ph) * Math.cos(th), -Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)]), 0, 1e-12, "rows east, north, up");
    const zen = C.anglesFromDir(C.rotate(C.frameMatrix("hor", "equ", st), [0, 0, 1]));
    near(zen.lat, st.lat, 1e-9, "zenith declination = latitude");
    if (Math.abs(st.lat) < 90) nearAngle(zen.lon, st.last, 1e-9, "zenith right ascension = local apparent sidereal time");
    assert.deepEqual(st.zenith, { ra: st.last, dec: st.lat });
    near(maxDiff(C.bodyDirection(st, "zenith", "hor"), [0, 0, 1]), 0, 1e-12, "the zenith is +z in hor");
    // the celestial pole stands due north at the altitude of the latitude
    const pole = C.horFromDir(C.rotate(toHor, [0, 0, 1]));
    near(pole.alt, st.lat, 1e-9, "pole altitude");
    if (Math.abs(st.lat) < 89) nearAngle(pole.az, 0, 1e-9, "the north celestial pole is on the meridian, due north (below the horizon in the south)");
    // a point of the equator a quarter turn east of the meridian is the east point of the horizon
    near(maxDiff(C.rotate(toHor, C.dirFromAngles(st.last + 90, 0)), [1, 0, 0]), 0, 1e-12, "the east point");
  }
  near(maxDiff(C.dirHor(0, 0), [0, 1, 0]), 0, 1e-15, "north is +y");
  near(maxDiff(C.dirHor(0, 90), [1, 0, 0]), 0, 1e-15, "altitude 0, azimuth 90 is (1, 0, 0)");
  near(maxDiff(C.dirHor(90, 123), [0, 0, 1]), 0, 1e-15, "up is +z");
  near(maxDiff(C.dirHor(0, 180), [0, -1, 0]), 0, 1e-15, "south is -y");
  near(maxDiff(C.dirHor(0, 270), [-1, 0, 0]), 0, 1e-15, "west is -x");
  near(maxDiff(cross(C.dirHor(0, 90), C.dirHor(0, 0)), [0, 0, 1]), 0, 1e-15, "east x north = up: right-handed");
});

test("frames: bodyDirection agrees with the read-out; the Sun lies in the ecliptic; an altitude 0, azimuth 90 body is (1, 0, 0)", () => {
  assert.deepEqual(C.BODIES, ["sun", "moon", "zenith", "sgr_a_star", "vela_pulsar", "cyg_x1", "pleiades", "polaris", "m31", "ngp", "nep"]);
  for (const st of FRAME_STATES()) {
    for (const key of C.BODIES) {
      for (const frame of C.FRAMES) near(Math.hypot(...C.bodyDirection(st, key, frame)), 1, frame === "gal" ? 1e-9 : 1e-12, key + " in " + frame + " is a unit vector");
      // round trips through every frame
      const equ = C.bodyDirection(st, key, "equ");
      for (const frame of C.FRAMES) near(maxDiff(C.rotate(C.frameMatrix(frame, "equ", st), C.bodyDirection(st, key, frame)), equ), 0, frame === "gal" ? 1e-9 : 1e-12, key + " round trip through " + frame);
    }
    const h = (key) => C.horFromDir(C.bodyDirection(st, key, "hor"));
    near(sep(h("sun").alt, h("sun").az, st.sun.alt, st.sun.az), 0, 1e-9, "Sun in hor");
    near(sep(h("moon").alt, h("moon").az, st.moon.altGeocentric, st.moon.az), 0, 1e-9, "Moon in hor is geocentric");
    for (const a of C.ANCHORS) near(sep(h(a.key).alt, h(a.key).az, st.anchors[a.key].alt, st.anchors[a.key].az), 0, 1e-9, a.key + " in hor");
    const sunEcl = C.anglesFromDir(C.bodyDirection(st, "sun", "ecl"));
    assert.ok(Math.abs(sunEcl.lat) < 0.001, "the Sun's ecliptic latitude is below 0.001 degrees");
    near(sunEcl.lat, 0, 1e-9, "the Sun's ecliptic latitude");
    nearAngle(sunEcl.lon, st.sun.lambda, 1e-9, "the Sun's ecliptic longitude");
    const moonEcl = C.anglesFromDir(C.bodyDirection(st, "moon", "ecl"));
    near(moonEcl.lat, st.moon.beta, 1e-9, "the Moon's ecliptic latitude");
    nearAngle(moonEcl.lon, st.moon.lambda, 1e-9, "the Moon's ecliptic longitude");
    for (const a of C.ANCHORS) {
      const e = C.anglesFromDir(C.bodyDirection(st, a.key, "ecl")), s = st.anchors[a.key];
      near(e.lat, s.eclLat, 1e-9, a.key + " ecliptic latitude of date");
      if (Math.abs(s.eclLat) < 89) nearAngle(e.lon, s.eclLon, 1e-9 / Math.cos(s.eclLat * DEG), a.key + " ecliptic longitude of date");
    }
  }
  // A body at altitude 0 and azimuth 90: the zenith of a place a quarter of the way east along the equator.
  const jd = C.jdFromParts({ year: 2026, month: 11, day: 14, hour: 20 });
  const here = C.skyState(jd, 0, 0), east = C.skyState(jd, 0, 90);
  const seen = C.rotate(C.frameMatrix("equ", "hor", here), C.bodyDirection(east, "zenith", "equ"));
  near(maxDiff(seen, [1, 0, 0]), 0, 1e-12, "(1, 0, 0)");
  near(C.horFromDir(seen).alt, 0, 1e-10, "altitude 0");
  nearAngle(C.horFromDir(seen).az, 90, 1e-10, "azimuth 90");
  assert.throws(() => C.bodyDirection(here, "mars", "hor"), /a body is sun, moon, zenith or an anchor key/);
  assert.throws(() => C.bodyDirection(here, "constructor", "hor"), Error);
  assert.throws(() => C.bodyDirection(here, "sun", "xyz"), /a frame is hor, equ, ecl or gal/);
  assert.throws(() => C.bodyDirection({}, "sun", "hor"), /a state made by skyState is needed/);
});

test("frames: the anchors' galactic and J2000 ecliptic coordinates match the table of the vector file", () => {
  const table = new Map(FIX.meta.anchors.map((a) => [a.key, a]));
  assert.deepEqual([...table.keys()].sort(), C.ANCHORS.map((a) => a.key).sort());
  for (const st of FRAME_STATES()) {
    for (const a of C.ANCHORS) {
      const row = table.get(a.key), s = st.anchors[a.key];
      near(s.galB, row.gal_b_deg, 1e-3, a.key + " galactic latitude");
      if (Math.abs(row.gal_b_deg) < 89.9) nearAngle(s.galL, row.gal_l_deg, 1e-3, a.key + " galactic longitude");
      // the matrix path, from the place of date back through nutation and precession to J2000 and on to gal
      const g = C.anglesFromDir(C.rotate(C.frameMatrix("equ", "gal", st), C.dirFromAngles(s.ra, s.dec)));
      near(g.lat, row.gal_b_deg, 1e-3, a.key + " galactic latitude through frameMatrix");
      if (Math.abs(row.gal_b_deg) < 89.9) nearAngle(g.lon, row.gal_l_deg, 1e-3 / Math.cos(row.gal_b_deg * DEG), a.key + " galactic longitude through frameMatrix");
      near(sep(g.lat, g.lon, s.galB, s.galL), 0, 1e-7, a.key + ": the matrix path equals the trigonometric path");
    }
  }
  for (const a of C.ANCHORS) {
    const row = table.get(a.key);
    assert.equal(a.raJ2000, row.ra_j2000_deg, a.key);
    assert.equal(a.decJ2000, row.dec_j2000_deg, a.key);
    const g = C.equJ2000ToGal(a.raJ2000, a.decJ2000), back = C.galToEquJ2000(g.l, g.b);
    near(sep(back.dec, back.ra, a.decJ2000, a.raJ2000), 0, 1e-7, a.key + " galactic round trip (the matrix has ten decimals)");
    const e = C.equToEcl(a.raJ2000, a.decJ2000, 23 + 26 / 60 + 21.448 / 3600);
    near(e.beta, row.ecl_lat_j2000_deg, 1e-3, a.key + " ecliptic latitude J2000");
    if (Math.abs(row.ecl_lat_j2000_deg) < 89.9) nearAngle(e.lambda, row.ecl_lon_j2000_deg, 1e-3 / Math.cos(row.ecl_lat_j2000_deg * DEG), a.key + " ecliptic longitude J2000");
  }
  // gal: x points at the galactic centre, z at the north galactic pole
  const st = FRAME_STATES()[1];
  near(sep(C.anglesFromDir(C.bodyDirection(st, "sgr_a_star", "gal")).lat, C.anglesFromDir(C.bodyDirection(st, "sgr_a_star", "gal")).lon, 0, 0), 0, 0.08, "Sagittarius A* is 4 arcminutes from +x");
  near(maxDiff(C.bodyDirection(st, "ngp", "gal"), [0, 0, 1]), 0, 1e-6, "the north galactic pole is +z");
});

test("frames: dirFromAngles, anglesFromDir, dirHor and horFromDir round trip", () => {
  const next = rng(5);
  for (let i = 0; i < 500; i++) {
    const lon = 360 * next(), lat = -89 + 178 * next();
    const a = C.anglesFromDir(C.dirFromAngles(lon, lat));
    nearAngle(a.lon, lon, 1e-9, "longitude");
    near(a.lat, lat, 1e-9, "latitude");
    const h = C.horFromDir(C.dirHor(lat, lon));
    nearAngle(h.az, lon, 1e-9, "azimuth");
    near(h.alt, lat, 1e-9, "altitude");
    assert.ok(a.lon >= 0 && a.lon < 360 && h.az >= 0 && h.az < 360);
    // a longitude runs anticlockwise from +x, an azimuth clockwise from +y: longitude = 90 - azimuth
    near(maxDiff(C.dirHor(lat, lon), C.dirFromAngles(90 - lon, lat)), 0, 1e-12, "longitude = 90 - azimuth");
    near(C.anglesFromDir(C.dirFromAngles(lon, lat).map((x) => 7 * x)).lat, lat, 1e-9, "the length of the vector does not matter");
  }
  assert.deepEqual(C.dirFromAngles(0, 0), [1, 0, 0]);
  near(maxDiff(C.dirFromAngles(90, 0), [0, 1, 0]), 0, 1e-15, "longitude 90 is +y");
  near(maxDiff(C.dirFromAngles(0, 90), [0, 0, 1]), 0, 1e-15, "latitude 90 is +z");
});

test("frames: great circles and where they cross the chart's plane", () => {
  for (const st of FRAME_STATES()) {
    for (const of of C.FRAMES) for (const inFrame of C.FRAMES) {
      // The galactic matrix is published to ten decimals, so a direction taken through "gal" is a unit vector to 1e-9.
      const tol = of === "gal" || inFrame === "gal" ? 1e-9 : 1e-12;
      const pole = C.rotate(C.frameMatrix(of, inFrame, st), [0, 0, 1]);
      const dirs = C.circleDirections(of, inFrame, st, 24);
      assert.equal(dirs.length, 24);
      for (const d of dirs) { near(Math.hypot(...d), 1, tol, "unit"); near(dot(d, pole), 0, tol, "on the circle"); }
      near(dot(cross(dirs[0], dirs[1]), pole), Math.sin(15 * DEG), tol, "it runs the way the frame's longitude runs");
      const nodes = C.circleNodes(of, inFrame, st);
      if (of === inFrame) { assert.equal(nodes, null); continue; }
      if (nodes === null) { assert.ok(Math.hypot(pole[0], pole[1]) < 1e-9); continue; }
      assert.equal(nodes.length, 2);
      near(maxDiff(nodes[0], nodes[1].map((x) => -x)), 0, 1e-15, "the two crossings are opposite");
      for (const nd of nodes) { near(nd[2], 0, 0, "in the chart's plane"); near(dot(nd, pole), 0, tol, "on the circle"); near(Math.hypot(...nd), 1, 1e-12, "unit"); }
      assert.ok(cross(pole, nodes[0])[2] > 0, "the first crossing is the ascending one");
    }
    // the ecliptic climbs through the equator at the March equinox, right ascension 0
    near(maxDiff(C.circleNodes("ecl", "equ", st)[0], [1, 0, 0]), 0, 1e-12, "the ascending node of the ecliptic on the equator");
  }
  assert.equal(C.circleDirections("hor", "gal", FRAME_STATES()[0]).length, 96);
  assert.throws(() => C.circleDirections("hor", "gal", FRAME_STATES()[0], 2), RangeError);
  assert.throws(() => C.circleNodes("hor", "sky", FRAME_STATES()[0]), Error);
});

// ─── 6. the chart ────────────────────────────────────────────────────────────

test("chart: the constants and the disc radii of section 4.3", () => {
  assert.deepEqual(C.DEPTH, { rho0: 0.5, kappa: 0.135 });
  assert.ok(Object.isFrozen(C.DEPTH));
  assert.equal(C.KM_PER_LIGHT_SECOND, 299792.458);
  assert.equal(C.LIGHT_SECONDS_PER_AU, C.AU_KM / C.KM_PER_LIGHT_SECOND);
  near(C.LIGHT_SECONDS_PER_AU, 499.004784, 1e-6, "light-seconds in an astronomical unit");
  assert.equal(C.LIGHT_SECONDS_PER_LY, 31557600);
  assert.equal(C.LIGHT_SECONDS_PER_LY, 365.25 * 86400);
  assert.equal(C.LY_PER_PC, 3.2615637772);
  near(C.LY_PER_PC, (C.AU_KM * 648000 / Math.PI) / (C.KM_PER_LIGHT_SECOND * C.LIGHT_SECONDS_PER_LY), 1e-9, "light-years in a parsec");
  const radius = (lightSeconds) => Math.tanh(C.depthRho(lightSeconds) / 2);
  const scale = new Map(FIX.meta.scale_objects.map((o) => [o.key, o]));
  const ly = (key) => C.ANCHORS.find((a) => a.key === key).distanceLy * C.LIGHT_SECONDS_PER_LY;
  near(radius(scale.get("moon").mean_distance_km / C.KM_PER_LIGHT_SECOND), 0.25, 0.005, "Moon");
  near(radius(scale.get("sun").mean_distance_km / C.KM_PER_LIGHT_SECOND), 0.41, 0.005, "Sun");
  near(radius(ly("pleiades")), 0.73, 0.005, "Pleiades");
  near(radius(ly("polaris")), 0.73, 0.005, "Polaris");
  near(radius(ly("vela_pulsar")), 0.74, 0.005, "Vela pulsar");
  near(radius(ly("cyg_x1")), 0.77, 0.005, "Cygnus X-1");
  near(radius(ly("sgr_a_star")), 0.78, 0.005, "Sagittarius A*");
  near(radius(ly("m31")), 0.83, 0.005, "Andromeda");
  near(radius(C.CMB.comovingGly * 1e9 * C.LIGHT_SECONDS_PER_LY), 0.90, 0.005, "the microwave background");
  // the same radii from a live state, whatever the Moon's and the Sun's distance on the day
  for (const st of FRAME_STATES()) {
    near(radius(C.bodyLightSeconds(st, "moon")), 0.25, 0.005, "Moon of date");
    near(radius(C.bodyLightSeconds(st, "sun")), 0.41, 0.005, "Sun of date");
    assert.equal(C.bodyLightSeconds(st, "moon"), st.moon.lightSeconds);
    assert.equal(st.moon.lightSeconds, st.moon.distanceKm / C.KM_PER_LIGHT_SECOND);
    assert.equal(st.sun.lightSeconds, st.sun.distanceAu * C.LIGHT_SECONDS_PER_AU);
    assert.equal(C.bodyLightSeconds(st, "m31"), ly("m31"));
    for (const key of ["zenith", "ngp", "nep"]) assert.equal(C.bodyLightSeconds(st, key), null, key + " is a direction");
  }
  assert.throws(() => C.bodyLightSeconds(FRAME_STATES()[0], "mars"), Error);
  // the wording that goes with the constants names these radii
  assert.equal(C.DEPTH_WORDING, "The two constants were chosen so that the Sun falls near the prototype's second shell (0.42) and the Galaxy's objects near its third (0.76). The Moon then sits at 0.25 and Andromeda at 0.83.");
  assert.equal(radius(scale.get("moon").mean_distance_km / C.KM_PER_LIGHT_SECOND).toFixed(2), "0.25");
  assert.equal(radius(ly("m31")).toFixed(2), "0.83");
  near(radius(scale.get("sun").mean_distance_km / C.KM_PER_LIGHT_SECOND), 0.42, 0.02, "the Sun near the second shell");
  for (const key of ["pleiades", "polaris", "vela_pulsar", "cyg_x1", "sgr_a_star"]) near(radius(ly(key)), 0.76, 0.03, key + " near the third shell");
  assert.equal(C.CHART_WORDING, "Direction: computed. Depth: a logarithmic scale of the measured distance. The curved geometry is how this chart makes room; it is not a claim that space has this shape.");
});

test("chart: depthRho, its inverse and the rings", () => {
  assert.equal(C.depthRho(1), 0.5);
  near(C.depthRho(10) - C.depthRho(1), 0.135, 1e-15, "0.135 for every factor of ten");
  for (let k = 0; k <= 400; k++) {
    const x = 0.0011 * Math.pow(10, (k / 400) * 21.5);            // 0.0011 light-seconds to beyond the microwave background
    near(C.depthLightSeconds(C.depthRho(x)) / x, 1, 1e-9, "inverse at " + x);
    if (k) assert.ok(C.depthRho(x) > C.depthRho(0.0011 * Math.pow(10, ((k - 1) / 400) * 21.5)), "depth grows with distance");
  }
  assert.equal(C.depthRho(0.0005), 0.1, "held at 0.1 below 0.0011 light-seconds");
  assert.equal(C.depthRho(0), 0.1);
  assert.ok(C.depthLightSeconds(0.1) < 0.0011 && C.depthLightSeconds(0.1) > 0.00108);
  assert.ok(Number.isNaN(C.depthRho(NaN)) && Number.isNaN(C.depthRho(-1)), "a distance that is not a positive number gives no depth");
  assert.deepEqual(C.RINGS.map((r) => r.key), ["light-second", "light-minute", "light-hour", "light-year", "thousand-light-years", "million-light-years", "billion-light-years", "microwave-background"]);
  assert.deepEqual(C.RINGS.map((r) => r.lightSeconds), [1, 60, 3600, 31557600, 31557600e3, 31557600e6, 31557600e9, 45.3e9 * 31557600]);
  assert.deepEqual(C.RINGS.map((r) => r.label), ["1 light-second", "1 light-minute", "1 light-hour", "1 light-year", "1,000 light-years", "1 million light-years", "1 billion light-years",
    "microwave background: 45.3 billion light-years, present distance"]);
  assert.deepEqual(C.RINGS.map((r) => Math.tanh(r.rho / 2).toFixed(3)), ["0.245", "0.354", "0.454", "0.639", "0.744", "0.821", "0.877", "0.901"]);
  for (const r of C.RINGS) assert.equal(r.rho, C.depthRho(r.lightSeconds), r.key);
  assert.ok(deepFrozen(C.RINGS));
});

test("chart: chartPoint and the flat chart; in hor north is at the top and east to the right", () => {
  const next = rng(31);
  for (let i = 0; i < 300; i++) {
    const dir = C.dirFromAngles(360 * next(), -90 + 180 * next()), rho = 4 * next();
    const p = C.chartPoint(dir, rho);
    assert.equal(p.length, 4);
    near(p[3] * p[3] - p[0] * p[0] - p[1] * p[1] - p[2] * p[2], 1, 1e-9 * p[3] * p[3], "on the hyperboloid");
    near(Math.acosh(p[3]), rho, 1e-9, "at hyperbolic distance rho from the centre");
    // in the ball it sits at radius tanh(rho / 2) along the direction
    near(maxDiff([p[0], p[1], p[2]].map((x) => x / (1 + p[3])), dir.map((x) => Math.tanh(rho / 2) * x)), 0, 1e-12, "ball point");
    const q = C.chartPoint2D(dir, rho), h = Math.hypot(dir[0], dir[1]);
    if (h < 1e-9) { assert.equal(q, null); continue; }
    assert.equal(q[2], 0, "height above the plane is not shown");
    near(Math.acosh(q[3]), rho, 1e-9, "the depth is kept");
    near(Math.atan2(q[1], q[0]), Math.atan2(dir[1], dir[0]), 1e-12, "and so is the bearing round the plane");
  }
  assert.deepEqual(C.chartPoint([1, 0, 0], 0), [0, 0, 0, 1]);
  assert.equal(C.chartPoint2D([0, 0, 1], 1), null, "the zenith in hor has no compass direction");
  assert.equal(C.chartPoint2D([1e-10, 0, 1], 1), null);
  assert.equal(C.chartPoint2D([NaN, 0, 1], 1), null);
  const north = C.chartPoint2D(C.dirHor(0, 0), 1), east = C.chartPoint2D(C.dirHor(0, 90), 1), high = C.chartPoint2D(C.dirHor(60, 0), 1);
  near(north[0], 0, 1e-15, "north: no x"); assert.ok(north[1] > 0, "north maps to the top (+y)");
  near(east[1], 0, 1e-15, "east: no y"); assert.ok(east[0] > 0, "east maps to the right (+x)");
  near(maxDiff(high, north), 0, 1e-12, "a body 60 degrees up in the north is drawn where the north point is");
  // the screen angle in hor is 90 degrees minus the azimuth
  for (const az of [0, 37, 90, 181, 270, 359]) nearAngle(Math.atan2(C.chartPoint2D(C.dirHor(10, az), 2)[1], C.chartPoint2D(C.dirHor(10, az), 2)[0]) / DEG, 90 - az, 1e-9, "azimuth " + az);
});

test("chart: the rim is where directions live, and a move sends circles on the rim to circles (row 4.2 of the sky lexicon)", () => {
  // Every sight line from the centre ends at one rim point: the ball point of chartPoint(dir, rho) tends to dir.
  const dir = C.dirFromAngles(123, -41);
  let last = 0;
  for (const rho of [1, 2, 4, 8, 16, 32]) {
    const p = C.chartPoint(dir, rho), b = [p[0], p[1], p[2]].map((x) => x / (1 + p[3]));
    near(maxDiff(b.map((x) => x / Math.hypot(...b)), dir), 0, 1e-12, "the same direction at every depth");
    assert.ok(Math.hypot(...b) > last && Math.hypot(...b) <= 1, "nearer the rim with depth, never beyond it");
    last = Math.hypot(...b);
  }
  near(last, 1, 1e-12, "at depth 32 the point is on the rim to twelve places");
  // A move of the ball acts on rim directions as a boost acts on light rays (aberration). Written out here, so
  // that this file needs no other core: n' = (n + ((cosh d - 1)(n . u) + sinh d) u) / (cosh d + sinh d (n . u)).
  const boost = (n, u, d) => {
    const k = dot(n, u), f = (Math.cosh(d) - 1) * k + Math.sinh(d), w = Math.cosh(d) + Math.sinh(d) * k;
    return [(n[0] + f * u[0]) / w, (n[1] + f * u[1]) / w, (n[2] + f * u[2]) / w];
  };
  const next = rng(42);
  for (let i = 0; i < 200; i++) {
    const axis = C.dirFromAngles(360 * next(), -90 + 180 * next()), u = C.dirFromAngles(360 * next(), -90 + 180 * next());
    const radius = 5 + 80 * next(), d = 2.5 * next();
    // a circle of directions: all at angle `radius` from `axis`
    const e1 = cross(axis, Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]).map((x, _, v) => x / Math.hypot(...v)), e2 = cross(axis, e1);
    const image = [];
    for (let k = 0; k < 12; k++) {
      const a = (k * 30) * DEG, c = Math.cos(radius * DEG), s = Math.sin(radius * DEG);
      const n = [0, 1, 2].map((j) => c * axis[j] + s * (Math.cos(a) * e1[j] + Math.sin(a) * e2[j]));
      const m = boost(n, u, d);
      near(Math.hypot(...m), 1, 1e-12, "the image is a direction");
      image.push(m);
    }
    // twelve points of the unit sphere lie on one circle exactly when they lie in one plane
    const normal = cross([0, 1, 2].map((j) => image[4][j] - image[0][j]), [0, 1, 2].map((j) => image[8][j] - image[0][j]));
    const len = Math.hypot(...normal);
    assert.ok(len > 1e-6, "three image points span a plane");
    for (const m of image) near(dot([0, 1, 2].map((j) => m[j] - image[0][j]), normal) / len, 0, 1e-9, "a circle goes to a circle");
  }
});

// ─── 7. places ───────────────────────────────────────────────────────────────

test("bearingAndDistance: the four roads from Nazareth, and the Kebar due east", () => {
  assert.deepEqual([NAZARETH.lat, NAZARETH.lonEast], [32.70, 35.30]);
  const roads = [["Antioch", 36.20, 36.16, 11.2, 397], ["Alexandria", 31.20, 29.92, 253.2, 534], ["Athens", 37.98, 23.73, 302.5, 1201], ["Rome", 41.90, 12.50, 303.6, 2252]];
  for (const [city, lat, lon, bearing, km] of roads) {
    const r = C.bearingAndDistance(NAZARETH.lat, NAZARETH.lonEast, lat, lon);
    nearAngle(r.bearing, bearing, 0.3, city + " bearing");
    near(r.km, km, 3, city + " distance");
  }
  const kebar = C.bearingAndDistance(NAZARETH.lat, NAZARETH.lonEast, KEBAR.lat, KEBAR.lonEast);
  nearAngle(kebar.bearing, 91.2, 0.3, "the Kebar lies due east");
  near(kebar.km, 934, 3, "934 km");
  near(Math.abs(NAZARETH.lat - KEBAR.lat), 0.57, 1e-9, "0.57 degrees apart in latitude");
  // the same stars cross straight overhead at both, 39.7 minutes of sidereal time apart
  const jd = C.jdFromParts({ year: 2026, month: 11, day: 14, hour: 20 });
  const lag = n180(C.skyState(jd, KEBAR.lat, KEBAR.lonEast).last - C.skyState(jd, NAZARETH.lat, NAZARETH.lonEast).last) * 4;
  near(lag, 39.7, 0.05, "minutes of sidereal time");
  // simple cases and the range
  assert.deepEqual(C.bearingAndDistance(10, 20, 10, 20), { bearing: 0, km: 0 });
  near(C.bearingAndDistance(0, 0, 0, 90).km, (Math.PI / 2) * 6371.0088, 1e-6, "a quarter of the equator");
  nearAngle(C.bearingAndDistance(0, 0, 0, 90).bearing, 90, 1e-9, "east along the equator");
  nearAngle(C.bearingAndDistance(0, 0, 45, 0).bearing, 0, 1e-9, "north along a meridian");
  near(C.bearingAndDistance(90, 0, -90, 0).km, Math.PI * 6371.0088, 1e-6, "pole to pole");
  assert.equal(C.EARTH_MEAN_RADIUS_KM, 6371.0088);
  const back = C.bearingAndDistance(KEBAR.lat, KEBAR.lonEast, NAZARETH.lat, NAZARETH.lonEast);
  near(back.km, kebar.km, 1e-9, "the same distance both ways");
  assert.throws(() => C.bearingAndDistance(91, 0, 0, 0), RangeError);
  assert.throws(() => C.bearingAndDistance(0, 0, 0, 181), RangeError);
  assert.throws(() => C.bearingAndDistance(0, 0, NaN, 0), RangeError);
});

test("SITES: the presets of section 4.2", () => {
  const want = [
    ["kebar", 32.13, 45.23], ["nazareth", 32.70, 35.30], ["mauna-kea", 19.82, -155.47], ["giza", 29.97, 31.13], ["greenwich", 51.4769, 0], ["atacama", -23.02, -67.75],
    ["kyoto", 35.01, 135.76], ["south-pole", -90, 0], ["new-york", 40.71, -74.01], ["mexico-city", 19.43, -99.13], ["sao-paulo", -23.55, -46.63], ["lagos", 6.52, 3.38],
    ["nairobi", -1.29, 36.82], ["delhi", 28.61, 77.21], ["beijing", 39.90, 116.41], ["sydney", -33.87, 151.21],
  ];
  assert.deepEqual(C.SITES.map((s) => [s.key, s.lat, s.lonEast]), want);
  assert.ok(deepFrozen(C.SITES));
  for (const s of C.SITES) {
    assert.deepEqual(Object.keys(s), ["key", "label", "lat", "lonEast", "note"], s.key);
    assert.ok(typeof s.label === "string" && s.label.length > 0 && s.label.length <= 40 && typeof s.note === "string" && s.note.length > 0, s.key);
    assert.ok(C.skyInputsValid(2461358.5, s.lat, s.lonEast), s.key);
  }
  assert.equal(KEBAR.label, "By the Kebar (Nippur)");
  assert.equal(KEBAR.note, "The Kebar is generally identified with the Kabari canal near Nippur, published by Hilprecht in 1898; an identification, not a certainty; position of Nippur approximate, not checked against a source.");
  assert.match(NAZARETH.note, /First Explorers' zero point/);
  const countries = { "new-york": "United States", "mexico-city": "Mexico", "sao-paulo": "Brazil", lagos: "Nigeria", nairobi: "Kenya", delhi: "India", beijing: "China", sydney: "Australia" };
  for (const [key, country] of Object.entries(countries)) {
    assert.ok(site(key).label.endsWith(", " + country), key + " carries its country");
    assert.equal(site(key).note, "city centre, approximate");
  }
  for (const s of C.SITES) if (s.key !== "kebar") assert.match(s.label, /, [A-Z]/, s.key + " names where it is");
  assert.equal(site("sao-paulo").label.normalize("NFC"), site("sao-paulo").label);
  // the place a pair of numbers stands for
  assert.equal(C.siteForCoordinates(32.13, 45.23), KEBAR);
  assert.equal(C.siteForCoordinates(51.48, 0), GREENWICH, "a preset is found by its numbers rounded to two decimals");
  assert.equal(C.siteForCoordinates(51.4769, -0.001), GREENWICH);
  for (const s of C.SITES) assert.equal(C.siteForCoordinates(s.lat, s.lonEast), s, s.key);
  const other = C.siteForCoordinates(48.8566, -2.3522);
  assert.deepEqual(other, { key: null, label: "A place at 48.86° north, 2.35° west", lat: 48.86, lonEast: -2.35, note: "A place given by its two numbers." });
  assert.ok(Object.isFrozen(other));
  assert.equal(C.siteForCoordinates(-0.001, -0.004).label, "A place at 0.00° north, 0.00° east", "no negative zero");
  assert.equal(C.siteForCoordinates(-33.5, 0).label, "A place at 33.50° south, 0.00° east");
  assert.throws(() => C.siteForCoordinates(120, 0), RangeError);
});

test("ANCHORS and CMB: the table of the vector file, with verified extras only", () => {
  assert.deepEqual(C.ANCHORS.map((a) => a.key), ["sgr_a_star", "vela_pulsar", "cyg_x1", "pleiades", "polaris", "m31", "ngp", "nep"]);
  assert.ok(deepFrozen(C.ANCHORS) && deepFrozen(C.CMB));
  const table = new Map(FIX.meta.anchors.map((a) => [a.key, a]));
  for (const a of C.ANCHORS) {
    assert.deepEqual(Object.keys(a), ["key", "label", "raJ2000", "decJ2000", "distanceLy", "distanceRangeLy", "distanceNote", "positionSource", "extra"], a.key);
    const row = table.get(a.key);
    assert.equal(a.raJ2000, row.ra_j2000_deg);
    assert.equal(a.decJ2000, row.dec_j2000_deg);
    assert.ok(a.label.length > 0 && a.distanceNote.length > 0 && a.positionSource.length > 0, a.key);
    if (row.distance_pc === null) {
      assert.equal(a.distanceLy, null, a.key + " is a direction");
      assert.equal(a.distanceRangeLy, null);
      continue;
    }
    assert.equal(a.distanceLy, row.distance_ly, a.key);
    assert.equal(a.extra.distancePc, row.distance_pc, a.key);
    assert.deepEqual(a.extra.distanceRangePc, row.distance_pc_range, a.key);
    near(a.distanceLy / (row.distance_pc * C.LY_PER_PC), 1, 0.001, a.key + ": light-years from parsecs");
    a.distanceRangeLy.forEach((ly, i) => near(ly / (row.distance_pc_range[i] * C.LY_PER_PC), 1, 0.005, a.key + ": the range to three figures"));
    assert.ok(a.distanceRangeLy[0] < a.distanceLy && a.distanceLy < a.distanceRangeLy[1], a.key);
    // every number of parsecs the note prints is in the table or in the report's quotations
    assert.match(a.distanceNote, /\(arXiv:[\w./-]+\)/, a.key + " names its source");
  }
  assert.deepEqual(C.ANCHORS.filter((a) => a.distanceLy === null).map((a) => a.key), ["ngp", "nep"]);
  const vela = C.ANCHORS[1], row = table.get("vela_pulsar");
  assert.equal(vela.extra.rotationPeriodMs, row.rotation_period_ms);
  assert.equal(vela.extra.rotationPeriodMs, 89);
  assert.equal(vela.extra.turnsPerSecond, Math.round(1000 / 89));
  assert.equal(vela.extra.turnsPerSecond, 11);
  assert.equal(vela.extra.millisecondPulsar, row.is_millisecond_pulsar);
  assert.equal(vela.extra.millisecondPulsar, false);
  near(C.ANCHORS[7].decJ2000, 90 - (23 + 26 / 60 + 21.448 / 3600), 1e-6, "the ecliptic pole: 90 degrees minus the obliquity of J2000");
  const cmb = FIX.meta.scale_objects.find((o) => o.key === "cmb");
  assert.deepEqual(Object.keys(C.CMB), ["z", "lightTravelGyr", "comovingGly", "ageAtEmissionYr", "note"]);
  assert.deepEqual([C.CMB.z, C.CMB.lightTravelGyr, C.CMB.comovingGly, C.CMB.ageAtEmissionYr], [1089.9, 13.79, 45.3, 372000]);
  assert.deepEqual([C.CMB.z, C.CMB.lightTravelGyr, C.CMB.comovingGly, C.CMB.ageAtEmissionYr], [cmb.redshift, cmb.light_travel_time_gyr, cmb.comoving_distance_gly, cmb.age_at_emission_kyr * 1000]);
  for (const piece of ["13.79 billion years", "45.3 billion light-years", String(cmb.proper_distance_at_emission_mly) + " million light-years", "372,000 years"]) assert.ok(C.CMB.note.includes(piece), piece);
});

test("EZEKIEL_DATES: the three published dates, with who gives each", () => {
  assert.ok(deepFrozen(C.EZEKIEL_DATES));
  assert.deepEqual(JSON.parse(JSON.stringify(C.EZEKIEL_DATES)), [
    { key: "593-07-31", label: "31 July 593 BC", said: "the date most reference works give",
      endsDay: { year: -592, month: 7, day: 31, calendar: "julian" }, beginsDay: { year: -592, month: 7, day: 30, calendar: "julian" } },
    { key: "593-07-01", label: "1 July 593 BC", said: "Finegan 1950, using Parker and Dubberstein's tables",
      endsDay: { year: -592, month: 7, day: 1, calendar: "julian" }, beginsDay: { year: -592, month: 6, day: 30, calendar: "julian" } },
    { key: "594-07-13", label: "13 July 594 BC", said: "Finegan 1950, counting the exile from 598/597; Kutsch 1985 argues for this year",
      endsDay: { year: -593, month: 7, day: 13, calendar: "julian" }, beginsDay: { year: -593, month: 7, day: 12, calendar: "julian" } },
  ]);
  for (const d of C.EZEKIEL_DATES) {
    assert.equal(C.formatDate(d.endsDay), d.label + " (Julian calendar)", "the label is the day that ends at the sunset");
    assert.equal(d.key, `${C.eraYear(d.endsDay.year).n}-${String(d.endsDay.month).padStart(2, "0")}-${String(d.endsDay.day).padStart(2, "0")}`);
  }
  assert.equal(C.EZEKIEL_DATES_NOTE, "Older books give 592 BC (Jewish Encyclopedia; Davidson 1892).");
});

// ─── 8. calendar parts ───────────────────────────────────────────────────────

test("time: jdFromParts and partsFromJd round trip, and a rounded second carries all the way", () => {
  assert.equal(C.jdFromParts({ year: 2026, month: 11, day: 14 }), 2461358.5);
  assert.equal(C.jdFromParts({ year: 2000, month: 1, day: 1, hour: 12 }), 2451545.0);
  near(C.jdFromParts({ year: 2024, month: 4, day: 8, hour: 18, minute: 18 }), 2460409.2625, 1e-9, "the eclipse vector");
  assert.deepEqual(C.partsFromJd(2451545.0), { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0, calendar: "gregorian" });
  assert.deepEqual(C.partsFromJd(1505041.5), { year: -592, month: 7, day: 31, hour: 0, minute: 0, second: 0, calendar: "julian" });
  assert.deepEqual(C.partsFromJd(1505041.5, "gregorian"), { year: -592, month: 7, day: 25, hour: 0, minute: 0, second: 0, calendar: "gregorian" }, "25 July in the proleptic Gregorian calendar");
  assert.deepEqual(C.partsFromJd(2299160.5), { year: 1582, month: 10, day: 15, hour: 0, minute: 0, second: 0, calendar: "gregorian" });
  assert.deepEqual(C.partsFromJd(2299160.5 - 1e-9), { year: 1582, month: 10, day: 15, hour: 0, minute: 0, second: 0, calendar: "gregorian" }, "a rounded second carries across the change of calendar");
  assert.deepEqual(C.partsFromJd(2299159.5), { year: 1582, month: 10, day: 4, hour: 0, minute: 0, second: 0, calendar: "julian" });
  // 59.9996 s rounds to 60.000 and carries through minute, hour, day, month and year
  const eve = C.jdFromParts({ year: 2026, month: 12, day: 31, hour: 23, minute: 59, second: 59.9996 });
  assert.deepEqual(C.partsFromJd(eve), { year: 2027, month: 1, day: 1, hour: 0, minute: 0, second: 0, calendar: "gregorian" });
  assert.deepEqual(C.partsFromJd(C.jdFromParts({ year: -1, month: 12, day: 31, hour: 23, minute: 59, second: 59.9996 })), { year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0, calendar: "julian" });
  assert.deepEqual(C.partsFromJd(C.jdFromParts({ year: 2024, month: 2, day: 28, hour: 23, minute: 59, second: 59.9996 })), { year: 2024, month: 2, day: 29, hour: 0, minute: 0, second: 0, calendar: "gregorian" });
  assert.equal(C.partsFromJd(C.jdFromParts({ year: 2026, month: 5, day: 5, hour: 7, minute: 8, second: 9.1234 })).second, 9.123, "rounded to 0.001");
  const next = rng(11);
  for (let i = 0; i < 3000; i++) {
    const jd = 990924 + next() * 1826228;
    for (const calendar of ["auto", "julian", "gregorian"]) {
      const p = C.partsFromJd(jd, calendar);
      assert.ok(Number.isInteger(p.year) && Number.isInteger(p.month) && Number.isInteger(p.day) && Number.isInteger(p.hour) && Number.isInteger(p.minute));
      assert.ok(p.month >= 1 && p.month <= 12 && p.day >= 1 && p.day <= C.daysInMonth(p.year, p.month, p.calendar) && p.hour >= 0 && p.hour <= 23 && p.minute >= 0 && p.minute <= 59 && p.second >= 0 && p.second < 60);
      assert.equal(p.second, Math.round(p.second * 1000) / 1000);
      assert.ok(p.calendar === "julian" || p.calendar === "gregorian");
      if (calendar !== "auto") assert.equal(p.calendar, calendar);
      near(C.jdFromParts(p), jd, 0.0006 / 86400, "back to the same instant within the half millisecond of the rounding");
      assert.deepEqual(C.partsFromJd(C.jdFromParts(p), calendar), p, "parts are a fixed point");
      // the same day as the reference inverse gives
      const c = C.calendarFromJd(C.jdFromParts({ ...p, hour: 12, minute: 0, second: 0 }), p.calendar);
      assert.deepEqual([c.year, c.month, Math.floor(c.day)], [p.year, p.month, p.day]);
    }
  }
  assert.equal(C.partsFromJd(2461358.5).calendar, "gregorian");
  assert.throws(() => C.partsFromJd(NaN), RangeError);
  assert.throws(() => C.partsFromJd(2461358.5, "hebrew"), RangeError);
});

test("time: eraYear, formatDate and formatClock", () => {
  assert.deepEqual(C.eraYear(0), { n: 1, era: "BC" });
  assert.deepEqual(C.eraYear(-592), { n: 593, era: "BC" });
  assert.deepEqual(C.eraYear(1), { n: 1, era: "AD" });
  assert.deepEqual(C.eraYear(2026), { n: 2026, era: "AD" });
  for (const y of [-1999, -592, -1, 0, 1, 33, 1582, 3000]) { const e = C.eraYear(y); assert.equal(C.yearFromEra(e.n, e.era), y); }
  assert.equal(C.yearFromEra(593, "BC"), -592);
  assert.throws(() => C.eraYear(1.5), RangeError);
  assert.throws(() => C.yearFromEra(0, "BC"), RangeError);
  assert.throws(() => C.yearFromEra(5, "BCE"), RangeError);
  assert.equal(C.formatDate({ year: -592, month: 7, day: 31, calendar: "julian" }), "31 July 593 BC (Julian calendar)");
  assert.equal(C.formatDate({ year: -592, month: 7, day: 31 }), "31 July 593 BC (Julian calendar)");
  assert.equal(C.formatDate({ year: 2026, month: 11, day: 14 }), "14 November 2026");
  assert.equal(C.formatDate(C.partsFromJd(2461358.5)), "14 November 2026");
  assert.equal(C.formatDate({ year: 0, month: 12, day: 25 }), "25 December 1 BC (Julian calendar)");
  assert.equal(C.formatDate({ year: 500, month: 1, day: 1 }), "1 January AD 500 (Julian calendar)");
  assert.equal(C.formatDate({ year: 1582, month: 10, day: 4 }), "4 October 1582 (Julian calendar)");
  assert.equal(C.formatDate({ year: 1582, month: 10, day: 15 }), "15 October 1582");
  assert.equal(C.formatDate({ year: 1917, month: 10, day: 25, calendar: "julian" }), "25 October 1917 (Julian calendar)");
  assert.equal(C.formatDate({ year: -592, month: 7, day: 25, calendar: "gregorian" }), "25 July 593 BC (Gregorian calendar)");
  assert.deepEqual(C.MONTH_NAMES, ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
  assert.throws(() => C.formatDate({ year: 2026, month: 13, day: 1 }), RangeError);
  assert.throws(() => C.formatDate({ year: 2026.5, month: 1, day: 1 }), RangeError);
  assert.throws(() => C.formatDate(null), RangeError);
  assert.equal(C.formatClock(0), "00:00");
  assert.equal(C.formatClock(19), "19:00");
  assert.equal(C.formatClock(19 + 5 / 60), "19:05", "19 + 5/60 is a hair below 19:05 in binary and still reads 19:05");
  assert.equal(C.formatClock(19.0051), "19:00");
  assert.equal(C.formatClock(23.9999), "23:59", "seconds are dropped, never rounded up into the next day");
  assert.equal(C.formatClock(9.5), "09:30");
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m++) assert.equal(C.formatClock(h + m / 60), String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"));
  assert.throws(() => C.formatClock(24), RangeError);
  assert.throws(() => C.formatClock(-0.1), RangeError);
});

test("time: local mean time, the device clock, and the day of the year", () => {
  near(C.localMeanHours(NIPPUR_SUNSET, KEBAR.lonEast), 19.0051, 0.0005, "Nippur: UT + 3 h 00 m 55 s");
  assert.equal(C.localMeanHours(2461358.5, 0), 0);
  assert.equal(C.localMeanHours(2461358.5, 180), 12);
  assert.equal(C.localMeanHours(2461358.5, -90), 18);
  const next = rng(21);
  for (let i = 0; i < 1000; i++) {
    const p = C.partsFromJd(990925 + next() * 1826226), hours = 24 * next(), lon = -180 + 360 * next();
    const jd = C.jdFromLocalMean(p, hours, lon);
    near(n180((C.localMeanHours(jd, lon) - hours) * 15) / 15, 0, 1e-7, "the local mean time asked for");
    const local = C.partsFromJd(jd + lon / 360, p.calendar);
    if (hours * 3600 < 86399.999) assert.deepEqual([local.year, local.month, local.day], [p.year, p.month, p.day], "on the local date asked for");
    near(jd, C.jdFromParts({ year: p.year, month: p.month, day: p.day, calendar: p.calendar }) + hours / 24 - lon / 360, 1e-9, "UT = local mean time - longitude / 15");
  }
  // Kyoto: 02:00 local mean time on 14 November is 16:57 UT on the 13th, so a page must show the local date
  const kyoto = site("kyoto"), st = C.skyState(C.jdFromLocalMean({ year: 2026, month: 11, day: 14 }, 2, kyoto.lonEast), kyoto.lat, kyoto.lonEast);
  assert.deepEqual([st.localDate.year, st.localDate.month, st.localDate.day, st.localDate.hour, st.localDate.minute], [2026, 11, 14, 2, 0]);
  assert.deepEqual([st.date.year, st.date.month, st.date.day, st.date.hour, st.date.minute], [2026, 11, 13, 16, 56]);
  assert.throws(() => C.jdFromLocalMean({ year: 2026, month: 11, day: 14 }, 24, 0), RangeError);
  assert.throws(() => C.jdFromLocalMean({ year: 2026, month: 11, day: 31 }, 12, 0), RangeError);
  assert.throws(() => C.jdFromLocalMean({ year: 2026, month: 11, day: 14 }, 12, 200), RangeError);
  assert.throws(() => C.localMeanHours(2461358.5, 181), RangeError);
  assert.equal(C.jdFromUnixMs(0), 2440587.5);
  assert.equal(C.jdFromUnixMs(Date.UTC(2026, 10, 14)), 2461358.5);
  assert.equal(C.jdFromUnixMs(Date.UTC(2000, 0, 1, 12)), 2451545.0);
  assert.throws(() => C.jdFromUnixMs("now"), RangeError);
  // the day of the year, in the calendar in force
  assert.equal(C.dayOfYear({ year: 2026, month: 1, day: 1 }), 1);
  assert.equal(C.dayOfYear({ year: 2026, month: 11, day: 14 }), 318);
  assert.equal(C.dayOfYear({ year: 2024, month: 12, day: 31 }), 366);
  assert.equal(C.dayOfYear({ year: -592, month: 7, day: 31 }), 213, "593 BC is a leap year of the Julian calendar");
  assert.equal(C.dayOfYear({ year: 1582, month: 10, day: 4 }), 277);
  assert.equal(C.dayOfYear({ year: 1582, month: 10, day: 15 }), 278, "the ten dropped days are not counted");
  assert.equal(C.dayOfYear({ year: 1582, month: 12, day: 31 }), 355);
  assert.equal(C.dayOfYear({ year: 1582, month: 10, day: 20, calendar: "gregorian" }), 283, "parts from partsFromJd count the year as it ran");
  assert.equal(C.dayOfYear(C.partsFromJd(2299160.5)), 278);
  assert.equal(C.dayOfYear({ year: 1582, month: 10, day: 15 }, "gregorian"), 288, "the proleptic Gregorian year counts the ten days");
  assert.equal(C.dayOfYear({ year: 1582, month: 10, day: 20, calendar: "julian" }), 293, "20 October Julian is 30 October Gregorian, day 278 + 15");
  assert.equal(C.dayOfYear({ year: 1582, month: 10, day: 20, calendar: "julian" }, "julian"), 293);
  assert.equal(C.dayOfYear({ year: 1501, month: 1, day: 7, calendar: "gregorian" }), 363, "7 January 1501 Gregorian is 28 December 1500 as that year ran");
  assert.equal(C.dayOfYear({ year: 1501, month: 1, day: 7, calendar: "gregorian" }, "gregorian"), 7);
  for (const [year, calendar, days] of [[2026, "auto", 365], [2024, "auto", 366], [1900, "auto", 365], [2000, "auto", 366], [1500, "auto", 366], [1900, "julian", 366], [1500, "gregorian", 365],
    [-592, "auto", 366], [-591, "auto", 365], [0, "auto", 366], [1582, "auto", 355], [1582, "julian", 365], [1582, "gregorian", 365]]) {
    assert.equal(C.daysInYear(year, calendar), days, `${year} ${calendar}`);
    let month = 0, total = 0;
    for (let n = 1; n <= days; n++) {
      const p = C.partsFromDayOfYear(year, n, calendar);
      assert.equal(p.year, year);
      assert.equal(C.dayOfYear(p, calendar), n, `${year} ${calendar} day ${n}`);
      assert.equal(C.dayOfYear({ year: p.year, month: p.month, day: p.day, calendar }, calendar), n);
      assert.equal(C.jdFromParts(p), C.jdFromParts(C.partsFromDayOfYear(year, 1, calendar)) + n - 1, "one day for every step");
      if (p.month !== month) { month = p.month; total += 1; }
      assert.ok(p.hour === 0 && p.minute === 0 && p.second === 0);
    }
    assert.equal(total, 12);
    assert.throws(() => C.partsFromDayOfYear(year, days + 1, calendar), RangeError);
    assert.throws(() => C.partsFromDayOfYear(year, 0, calendar), RangeError);
  }
  assert.deepEqual(C.partsFromDayOfYear(1582, 278), { year: 1582, month: 10, day: 15, hour: 0, minute: 0, second: 0, calendar: "gregorian" });
  assert.deepEqual([28, 29, 29, 28, 29, 28, 29, 31, 30], [C.daysInMonth(2026, 2), C.daysInMonth(2024, 2), C.daysInMonth(1500, 2), C.daysInMonth(1900, 2), C.daysInMonth(1900, 2, "julian"),
    C.daysInMonth(1500, 2, "gregorian"), C.daysInMonth(-592, 2), C.daysInMonth(1582, 10), C.daysInMonth(2026, 11)]);
  assert.throws(() => C.partsFromDayOfYear(3001, 1), RangeError);
  assert.throws(() => C.daysInYear(2026.5), RangeError);
  assert.throws(() => C.daysInMonth(2026, 0), RangeError);
  assert.throws(() => C.dayOfYear({ year: 2026, month: 2, day: 30 }), RangeError);
  assert.throws(() => C.dayOfYear({ year: 2026, month: 2, day: 3 }, "hebrew"), RangeError);
});

test("ranges: a year outside -1999..3000, a month or a day that does not exist, a place off the Earth: RangeError with a fixed message", () => {
  const M = C.RANGE_MESSAGES;
  assert.ok(Object.isFrozen(M));
  const refused = (fn, message, label) => assert.throws(fn, (e) => e instanceof RangeError && e.name === "RangeError" && e.message === message, label);
  const good = { year: 2026, month: 11, day: 14 };
  assert.equal(C.jdFromParts({ year: -1999, month: 1, day: 1 }), C.RANGES.localJd[0]);
  assert.equal(C.jdFromParts({ year: 3000, month: 12, day: 31 }) + 1, C.RANGES.localJd[1]);
  for (const year of [-2000, 3001, 2026.5, NaN, Infinity, "2026", null, undefined]) refused(() => C.jdFromParts({ ...good, year }), M.year, "year " + year);
  for (const month of [0, 13, 1.5, NaN, "11", null, undefined]) refused(() => C.jdFromParts({ ...good, month }), M.month, "month " + month);
  for (const day of [0, 31, 1.5, -1, NaN, "14", null, undefined]) refused(() => C.jdFromParts({ ...good, day }), M.day, "day " + day);
  refused(() => C.jdFromParts({ year: 2026, month: 2, day: 29 }), M.day, "29 February in a common year");
  refused(() => C.jdFromParts({ year: 1900, month: 2, day: 29 }), M.day, "1900 is not a leap year of the Gregorian calendar");
  assert.equal(C.jdFromParts({ year: 1500, month: 2, day: 29 }) + 1, C.jdFromParts({ year: 1500, month: 3, day: 1 }), "1500 is a leap year of the Julian calendar");
  assert.equal(C.jdFromParts({ year: 2000, month: 2, day: 29 }) + 1, C.jdFromParts({ year: 2000, month: 3, day: 1 }));
  assert.equal(C.jdFromParts({ year: -592, month: 2, day: 29 }) + 1, C.jdFromParts({ year: -592, month: 3, day: 1 }));
  refused(() => C.jdFromParts({ year: -591, month: 2, day: 29 }), M.day, "592 BC is a common year");
  for (let day = 5; day <= 14; day++) refused(() => C.jdFromParts({ year: 1582, month: 10, day }), M.day, day + " October 1582 does not exist");
  assert.equal(C.jdFromParts({ year: 1582, month: 10, day: 15 }) - C.jdFromParts({ year: 1582, month: 10, day: 4 }), 1);
  assert.equal(C.jdFromParts({ year: 1582, month: 10, day: 10, calendar: "julian" }), C.jdFromParts({ year: 1582, month: 10, day: 20, calendar: "gregorian" }), "a named calendar has no gap");
  for (const time of [{ hour: 24 }, { hour: -1 }, { hour: 1.5 }, { minute: 60 }, { minute: 0.5 }, { second: 60 }, { second: -1 }, { second: NaN }, { hour: "3" }]) refused(() => C.jdFromParts({ ...good, ...time }), M.time, JSON.stringify(time));
  refused(() => C.jdFromParts({ ...good, calendar: "hebrew" }), M.calendar, "calendar");
  refused(() => C.jdFromParts(), M.year, "no argument");
  refused(() => C.jdFromParts(null), M.year, "null");
  // skyState
  const jd = 2461358.5;
  for (const lat of [-90.01, 90.01, NaN, "51", null, undefined, Infinity]) refused(() => C.skyState(jd, lat, 0), M.latitude, "latitude " + lat);
  for (const lon of [-180.01, 180.01, NaN, "0", null, undefined]) refused(() => C.skyState(jd, 0, lon), M.longitude, "longitude " + lon);
  for (const bad of [NaN, Infinity, "2461358.5", null, undefined, 0, 990923.4, 2817152.6, -5]) refused(() => C.skyState(bad, 0, 0), M.instant, "instant " + bad);
  assert.equal(C.skyState(jd, -90, -180).lat, -90);
  assert.equal(C.skyState(jd, 90, 180).lonEast, 180);
  // the range of the instant is the range of the LOCAL date: the first and the last local midnight are in, at any longitude
  for (const lon of [-180, -45.23, 0, 135.76, 180]) {
    const first = C.jdFromLocalMean({ year: -1999, month: 1, day: 1 }, 0, lon), last = C.jdFromLocalMean({ year: 3000, month: 12, day: 31 }, 23.999, lon);
    assert.equal(C.skyState(first, 0, lon).localDate.year, -1999, "first local day at " + lon);
    assert.equal(C.skyState(last, 0, lon).localDate.year, 3000, "last local day at " + lon);
    refused(() => C.skyState(first - 0.01, 0, lon), M.instant, "before the first local day at " + lon);
    refused(() => C.skyState(last + 0.01, 0, lon), M.instant, "after the last local day at " + lon);
    assert.equal(C.skyInputsValid(first, 0, lon), true);
    assert.equal(C.skyInputsValid(first - 0.01, 0, lon), false);
  }
  assert.equal(C.skyInputsValid(jd, 91, 0), false);
  assert.equal(C.skyInputsValid(jd, 0, "0"), false);
  assert.equal(C.skyInputsValid("x", 0, 0), false);
  assert.equal(C.skyInputsValid(jd, 51.4769, 0), true);
  assert.deepEqual(C.RANGES, { lat: [-90, 90], lonEast: [-180, 180], year: [-1999, 3000], localJd: [990923.5, 2817152.5] });
  assert.ok(deepFrozen(C.RANGES));
  assert.deepEqual([C.YEAR_MIN, C.YEAR_MAX], [-1999, 3000]);
  // no message repeats what was typed
  for (const message of Object.values(M)) assert.ok(typeof message === "string" && /^[a-zA-Z0-9 ,.:-]+$/.test(message), message);
  try { C.jdFromParts({ year: "<b>x</b>", month: 1, day: 1 }); assert.fail("accepted"); } catch (e) { assert.equal(e.message, M.year); }
});

// ─── 9. Sun events, seasons, Delta T ─────────────────────────────────────────

test("sunAltitudeEventJd: sunrise and sunset against PyEphem, and null where the Sun does not cross", (t) => {
  const { sun_events: events, sun_event_tolerance_seconds: tol } = FIX.extra;
  assert.equal(events.length, 13);
  let n = 0;
  for (const e of events) {
    for (const which of ["set", "rise"]) {
      const got = C.sunAltitudeEventJd(e.local_noon_jd_ut, e.lat, e.lon_east, which), want = e[which + "_jd_ut"];
      n += 1;
      if (want === null) { assert.equal(got, null, e.label + " " + which + ": the Sun does not cross"); continue; }
      assert.ok(got !== null, e.label + " " + which);
      near((got - want) * 86400, 0, tol, e.label + " " + which + ", seconds from PyEphem");
      const alt = (jd) => C.skyState(jd, e.lat, e.lon_east).sun.alt;
      near(alt(got), -0.8333, 1e-6, e.label + " " + which + ": the Sun's centre is 0.8333 degrees below the horizon");
      assert.ok(which === "set" ? alt(got - 1e-4) > alt(got + 1e-4) : alt(got - 1e-4) < alt(got + 1e-4), e.label + " " + which + ": going the right way");
      assert.ok(which === "set" ? got > e.local_noon_jd_ut && got <= e.local_noon_jd_ut + 0.5 : got < e.local_noon_jd_ut && got >= e.local_noon_jd_ut - 0.5, "in its half-day");
    }
  }
  assert.ok(events.some((e) => e.set_jd_ut === null) && events.some((e) => e.set_jd_ut !== null));
  t.diagnostic(`Sun events: ${n} risings and settings against PyEphem`);
  // the South Pole in midwinter, and in midsummer
  const pole = site("south-pole");
  for (const [month, label] of [[6, "midwinter"], [12, "midsummer"]]) for (const which of ["set", "rise"]) {
    assert.equal(C.sunEventOnLocalDay({ year: 2026, month, day: 21 }, pole.lat, pole.lonEast, which), null, "the South Pole in " + label + ", " + which);
  }
  assert.ok(C.skyState(C.jdFromParts({ year: 2026, month: 6, day: 21, hour: 12 }), -90, 0).sun.alt < -20, "midwinter: the Sun is far below");
  assert.ok(C.skyState(C.jdFromParts({ year: 2026, month: 12, day: 21, hour: 12 }), -90, 0).sun.alt > 20, "midsummer: the Sun is up all day");
  // sunsetJdUt keeps the reference behaviour: the same root where the Sun sets, and a number even where it does not
  const next = rng(8);
  for (let i = 0; i < 300; i++) {
    const lat = -60 + 120 * next(), lon = -180 + 360 * next(), noon = Math.floor(990925 + next() * 1826226) - lon / 360;   // local mean noon
    const a = C.sunAltitudeEventJd(noon, lat, lon, "set"), b = C.sunsetJdUt(noon, lat, lon);
    assert.ok(a !== null);
    near(a, b, 1e-8, "the same sunset as the reference bisection");
    const rise = C.sunAltitudeEventJd(noon, lat, lon, "rise");
    assert.ok(rise !== null && rise < noon && noon < a, "sunrise, noon, sunset");
  }
  assert.equal(typeof C.sunsetJdUt(2461213, -90, 0), "number");
  near(C.sunsetJdUt(2461213, -90, 0), 2461213, 1e-9, "polar night: the reference returns the start of the half-day");
  near(C.sunsetJdUt(2461396, -90, 0), 2461396.5, 1e-9, "polar day: the reference returns its end");
  // a lower altitude is reached later in the evening and earlier in the morning
  const noon = C.jdFromLocalMean({ year: 2026, month: 11, day: 14 }, 12, GREENWICH.lonEast);
  const set = C.sunAltitudeEventJd(noon, GREENWICH.lat, GREENWICH.lonEast, "set"), dusk = C.sunAltitudeEventJd(noon, GREENWICH.lat, GREENWICH.lonEast, "set", -6);
  const rise = C.sunAltitudeEventJd(noon, GREENWICH.lat, GREENWICH.lonEast, "rise"), dawn = C.sunAltitudeEventJd(noon, GREENWICH.lat, GREENWICH.lonEast, "rise", -6);
  assert.ok(dusk > set && (dusk - set) * 1440 > 30 && (dusk - set) * 1440 < 45, "civil dusk follows sunset by about 36 minutes at Greenwich in November");
  assert.ok(dawn < rise);
  near(C.skyState(dusk, GREENWICH.lat, GREENWICH.lonEast).sun.alt, -6, 1e-6, "the altitude asked for");
  assert.equal(C.sunEventOnLocalDay({ year: 2026, month: 11, day: 14 }, GREENWICH.lat, GREENWICH.lonEast, "set"), set);
  // the answer is null exactly when the Sun stays on one side at every half-hour of the half-day
  for (let i = 0; i < 400; i++) {
    const lat = (next() < 0.5 ? -1 : 1) * (60 + 30 * next()), lon = -180 + 360 * next();
    const noonJd = Math.floor(2451545 + next() * 20000) - lon / 360, which = next() < 0.5 ? "set" : "rise";
    const got = C.sunAltitudeEventJd(noonJd, lat, lon, which);
    const start = which === "set" ? noonJd : noonJd - 0.5;
    const up = []; for (let k = 0; k <= 24; k++) up.push(C.skyState(start + k / 48, lat, lon).sun.alt > -0.8333);
    const crosses = up.some((u, k) => k > 0 && (which === "set" ? up[k - 1] && !u : !up[k - 1] && u));
    assert.equal(got !== null, crosses, `${which} at ${lat}, ${lon}, ${noonJd}`);
    if (got !== null) near(C.skyState(got, lat, lon).sun.alt, -0.8333, 1e-6, "on the altitude");
  }
  assert.throws(() => C.sunAltitudeEventJd(noon, 51, 0, "noon"), /which must be rise or set/);
  assert.throws(() => C.sunAltitudeEventJd(NaN, 51, 0, "set"), RangeError);
  assert.throws(() => C.sunAltitudeEventJd(noon, 95, 0, "set"), RangeError);
});

test("nearestSeasonJd: equinoxes and solstices against PyEphem, and nearest in time", () => {
  const { seasons, season_tolerance_minutes: tol } = FIX.extra;
  assert.equal(seasons.length, 16);
  const target = { "march-equinox": 0, "june-solstice": 90, "september-equinox": 180, "december-solstice": 270 };
  for (const s of seasons) {
    for (const offset of [-40, -3, 0, 3, 40]) {
      const r = C.nearestSeasonJd(s.jd_ut + offset);
      assert.deepEqual(Object.keys(r), ["key", "jdUt"]);
      assert.equal(r.key, s.key, `${s.year} ${s.key} from ${offset} days away`);
      near((r.jdUt - s.jd_ut) * 1440, 0, tol, `${s.year} ${s.key}, minutes from PyEphem`);
      nearAngle(C.sunPosition(C.jdeFromJdUt(r.jdUt)).lambda, target[s.key], 1e-6, "the Sun's apparent longitude at that instant");
    }
  }
  // nearest in time, against a search that does not use Newton steps: scan the Sun's longitude day by day, then bisect
  const lam = (jd) => C.sunPosition(C.jdeFromJdUt(jd)).lambda;
  const next = rng(3);
  for (let i = 0; i < 150; i++) {
    const jd = 990925 + 60 + next() * (1826226 - 120);
    const found = [];
    for (let d = -100; d < 100; d++) {
      const a = jd + d, b = a + 1, qa = Math.floor(lam(a) / 90), qb = Math.floor(lam(b) / 90);
      if (qa === qb) continue;
      const goal = (qb * 90) % 360;
      let lo = a, hi = b;
      for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (n180(lam(mid) - goal) < 0) lo = mid; else hi = mid; }
      found.push({ key: Object.keys(target).find((k) => target[k] === goal), jdUt: (lo + hi) / 2 });
    }
    assert.ok(found.length >= 2);
    const best = found.reduce((p, q) => (Math.abs(q.jdUt - jd) < Math.abs(p.jdUt - jd) ? q : p));
    const r = C.nearestSeasonJd(jd);
    assert.equal(r.key, best.key, "the nearest season at " + jd);
    near(r.jdUt, best.jdUt, 1e-6, "its instant");
    assert.ok(Math.abs(r.jdUt - jd) < 47.5, "never more than half the longest season away");
  }
  // 14 November 2026: 52 days after the September equinox, 38 before the December solstice
  const today = C.nearestSeasonJd(2461358.5);
  assert.equal(today.key, "december-solstice");
  near(today.jdUt - 2461358.5, 37.87, 0.02, "days to the solstice");
  assert.throws(() => C.nearestSeasonJd(NaN), RangeError);
});

test("deltaTSigma: the allowance, its joins, and what it does to the Moon and the Sun", () => {
  near(C.deltaTSigma(-592), 465, 5, "465 s at 593 BC");
  near(C.deltaTSigma(C.decimalYear(NIPPUR_SUNSET)), 465, 5, "at the decimal year of the Nippur sunset");
  near(C.deltaTSigma(2026.9), 6.2, 0.1, "6.2 s at 2026.9");
  // the table of Espenak and Meeus
  for (const [y, s] of [[-1000, 636], [-500, 431], [0, 265], [500, 139], [1000, 54]]) near(C.deltaTSigma(y), s, 0.5, "year " + y);
  assert.equal(C.deltaTSigma(1700), 5);
  assert.equal(C.deltaTSigma(1800), 1);
  assert.equal(C.deltaTSigma(1900), 1);
  assert.equal(C.deltaTSigma(2005), 1);
  near(C.deltaTSigma(2030), 7, 1e-12, "7 s at 2030");
  near(C.deltaTSigma(2100), 287, 1e-9, "287 s at 2100");
  near(C.deltaTSigma(2200), 687, 1e-9, "687 s at 2200");
  near(C.deltaTSigma(1200), 0.8 * 6.2 * 6.2, 1e-12, "30.752 s at 1200");
  for (const join of [1200, 1700, 1800, 2005, 2030]) near(C.deltaTSigma(join - 1e-7), C.deltaTSigma(join + 1e-7), 1e-5, "continuous at " + join);
  for (let y = -1999; y <= 1800; y += 7) assert.ok(C.deltaTSigma(y) >= C.deltaTSigma(y + 7), "it shrinks towards the telescope age, at " + y);
  for (let y = 2005; y <= 3000; y += 5) assert.ok(C.deltaTSigma(y + 5) > C.deltaTSigma(y), "and grows into the future, at " + y);
  assert.equal(C.moonLongitudeSigmaDeg(-592), (C.deltaTSigma(-592) * 0.549) / 3600);
  near(C.moonLongitudeSigmaDeg(-592), 0.071, 0.001, "the Moon at 593 BC");
  // in a state
  for (const st of FRAME_STATES()) {
    const sigma = C.deltaTSigma(C.decimalYear(st.jdUt));
    assert.equal(st.deltaTSigma, sigma);
    assert.equal(st.decimalYear, C.decimalYear(st.jdUt));
    assert.equal(st.deltaT, C.deltaTSeconds(st.decimalYear));
    assert.equal(st.uncertainty.moonLongitudeSigmaDeg, C.moonLongitudeSigmaDeg(st.decimalYear));
    assert.equal(st.uncertainty.moonDeg, Math.hypot(0.012, C.moonLongitudeSigmaDeg(st.decimalYear)));
    assert.equal(st.uncertainty.sunDeg, Math.hypot(0.01, (sigma * 0.041) / 3600));
    assert.equal(st.uncertainty.badge, C.moonLongitudeSigmaDeg(st.decimalYear) >= 0.01);
    assert.ok(st.uncertainty.note.includes("± " + st.uncertainty.moonDeg.toFixed(2) + "°") && st.uncertainty.note.includes("not a measurement"), st.uncertainty.note);
  }
  const then = C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast), now = C.skyState(2461358.5, 51.4769, 0);
  assert.equal(then.uncertainty.badge, true);
  assert.equal(now.uncertainty.badge, false);
  near(then.uncertainty.moonDeg, 0.072, 0.001, "Moon at 593 BC");
  near(now.uncertainty.moonDeg, 0.012, 0.0005, "Moon today");
  assert.match(then.uncertainty.note, /^For this year: Sun about ± 0\.01°, Moon about ± 0\.07°\..*± 7\.8 minutes for Delta T/);
  assert.match(now.uncertainty.note, /^For this year: Sun about ± 0\.01°, Moon about ± 0\.01°\..*± 6\.2 s for Delta T/);
  assert.throws(() => C.deltaTSigma(NaN), RangeError);
});

test("LIMITS: every number in the sentences of section 4.6 is recomputed here", () => {
  assert.deepEqual(C.LIMITS, [
    "For the years 1800 to 2200 the Sun is within 0.01° and the Moon within 0.01° of PyEphem.",
    "After about 2045 the real uncertainty is the ΔT allowance: 0.04° for the Moon by 2100 and 0.1° by 2200.",
    "At 593 BC the Moon is uncertain by about 0.07°, because the slow drift of the Earth's rotation (ΔT) is known only to about ± 8 minutes for that year.",
    "Star aberration (0.006°) and proper motion are neglected.",
    "Sunrise and sunset are when the Sun's centre is 0.83° below the level horizon, the usual allowance for the bending of light in air and for the Sun's size; all other altitudes are airless.",
    "Polaris is 0.6° from the pole today and was 15.0° from it in 593 BC.",
    "The ΔT polynomial is 6 s too large today (harmless: Moon 0.001°).",
  ]);
  assert.ok(Object.isFrozen(C.LIMITS));
  // 1. within 0.01 degrees of PyEphem on every vector of 1800 to 2200
  const modern = FIX.vectors.filter((v) => v.input.year >= 1800 && v.input.year <= 2200);
  assert.equal(modern.length, 18);
  for (const v of modern) {
    const o = C.sky(vectorJd(v));
    assert.ok(Math.abs(n180(o.sun.lambda - v.ephem.sun.lambda_deg)) < 0.01, v.id + ": Sun within 0.01 degrees");
    assert.ok(Math.abs(n180(o.moon.lambda - v.ephem.moon.lambda_deg)) < 0.01, v.id + ": Moon within 0.01 degrees");
    assert.ok(Math.abs(o.moon.beta - v.ephem.moon.beta_deg) < 0.01, v.id + ": Moon latitude within 0.01 degrees");
  }
  // 2. the allowance: 0.04 degrees by 2100, 0.1 by 2200; the badge before about AD 915 and after about 2045
  assert.equal(C.moonLongitudeSigmaDeg(2100).toFixed(2), "0.04");
  assert.equal(C.moonLongitudeSigmaDeg(2200).toFixed(1), "0.1");
  const edge = (lo, hi, risingRight) => { for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if ((C.moonLongitudeSigmaDeg(mid) >= 0.01) === risingRight) hi = mid; else lo = mid; } return (lo + hi) / 2; };
  assert.equal(Math.round(edge(0, 1200, false)), 915, "the badge is shown before about AD 915");
  assert.equal(Math.round(edge(2005, 2100, true)), 2045, "and after about 2045");
  assert.equal(C.skyState(C.jdFromParts({ year: 900, month: 1, day: 1 }), 0, 0).uncertainty.badge, true);
  assert.equal(C.skyState(C.jdFromParts({ year: 930, month: 1, day: 1 }), 0, 0).uncertainty.badge, false);
  assert.equal(C.skyState(C.jdFromParts({ year: 2040, month: 1, day: 1 }), 0, 0).uncertainty.badge, false);
  assert.equal(C.skyState(C.jdFromParts({ year: 2050, month: 1, day: 1 }), 0, 0).uncertainty.badge, true);
  // 3. 593 BC: 0.07 degrees, plus or minus 8 minutes
  const y = C.decimalYear(NIPPUR_SUNSET);
  assert.equal(C.moonLongitudeSigmaDeg(y).toFixed(2), "0.07");
  assert.equal(Math.round(C.deltaTSigma(y) / 60), 8);
  // 4. aberration: 20.5 arcseconds
  assert.equal((20.5 / 3600).toFixed(3), "0.006");
  // 5. the altitude of sunrise and sunset
  assert.equal(Math.abs(C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast).sun.alt).toFixed(2), "0.83");
  // 6. Polaris
  assert.equal(C.skyState(2461358.5, 51.4769, 0).anchors.polaris.poleDistance.toFixed(1), "0.6");
  assert.equal(C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast).anchors.polaris.poleDistance.toFixed(1), "15.0");
  // 7. the polynomial against the measured 69.25 s of November 2026 (IERS, read in the astronomy research)
  const excess = C.deltaTSeconds(C.decimalYear(2461358.5)) - 69.25;
  assert.equal(Math.round(excess), 6);
  assert.equal(((excess * 0.549) / 3600).toFixed(3), "0.001");
});

// ─── 10. the evening of a phase ──────────────────────────────────────────────

test("PHASE_TARGETS: the eight names phaseName returns, each at the middle of its span", () => {
  assert.deepEqual(C.PHASE_TARGETS.map((p) => p.target), [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.deepEqual(C.PHASE_TARGETS.map((p) => p.name), ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"]);
  assert.ok(deepFrozen(C.PHASE_TARGETS));
  for (const p of C.PHASE_TARGETS) assert.equal(C.phaseName(p.target), p.name);
  const names = new Set();
  for (let e = 0; e < 360; e += 0.25) names.add(C.phaseName(e));
  assert.deepEqual([...names].sort(), C.PHASE_TARGETS.map((p) => p.name).sort());
  assert.equal(C.PHASE_HALF_WIDTH, 6);
  assert.deepEqual([C.phaseName(5.99), C.phaseName(6), C.phaseName(83.99), C.phaseName(84), C.phaseName(95.99), C.phaseName(96), C.phaseName(354), C.phaseName(353.99)],
    ["New Moon", "Waxing Crescent", "Waxing Crescent", "First Quarter", "First Quarter", "Waxing Gibbous", "New Moon", "Waning Crescent"]);
});

test("phaseEveningJd: 2,000 random instants and sites between 60 south and 60 north", (t) => {
  const next = rng(4242);
  const HOUR = 1 / 24;
  let late = 0, worstHours = 0, worstDegrees = 0;
  for (let i = 0; i < 2000; i++) {
    const jd = 990925 + next() * 1826226, lat = -60 + 120 * next(), lon = -180 + 360 * next(), target = 45 * (i % 8);
    const r = C.phaseEveningJd(jd, target, lat, lon), label = `instant ${jd}, target ${target}, place ${lat}, ${lon}`;
    assert.deepEqual(Object.keys(r), ["jdUt", "phaseJd"]);
    // never earlier than the input
    assert.ok(r.phaseJd >= jd, label + ": the phase is not before the input");
    assert.ok(r.jdUt >= jd, label + ": the evening is not before the input");
    // phaseJd is the next instant of that phase: on target there, and no earlier one since the input
    nearAngle(C.elongLonAt(r.phaseJd), target, 1e-5, label + ": on target at phaseJd");
    assert.ok(r.phaseJd - jd < 29.9, label + ": within one lunation");
    if (r.phaseJd - jd > 1e-6) assert.ok(n180(C.elongLonAt(jd) - target) > 0 || n180(C.elongLonAt(jd) - target) < -1e-9, label);
    near(r.phaseJd, C.nextPhaseTime(jd, target), 1e-9, label + ": nextPhaseTime");
    // jdUt is one hour after a sunset
    const sun = C.skyState(r.jdUt - HOUR, lat, lon).sun;
    near(sun.alt, -0.8333, 1e-5, label + ": one hour before, the Sun is setting");
    assert.ok(C.skyState(r.jdUt - HOUR + 1e-4, lat, lon).sun.alt < sun.alt, label + ": going down");
    // and it is the evening nearest to phaseJd among those not before the input: rebuilt here from five local
    // days with the reference bisection
    const day = Math.floor(r.phaseJd + lon / 360 + 0.5), evenings = [];
    for (let d = day - 2; d <= day + 2; d++) evenings.push(C.sunsetJdUt(d - lon / 360, lat, lon) + HOUR);
    const nearestOf = (list) => list.reduce((p, q) => (Math.abs(q - r.phaseJd) < Math.abs(p - r.phaseJd) ? q : p));
    near(r.jdUt, nearestOf(evenings.filter((e) => e >= jd)), 1e-7, label + ": the nearest evening not before the input");
    const hours = Math.abs(r.jdUt - r.phaseJd) * 24, degrees = Math.abs(n180(C.elongLonAt(r.jdUt) - target));
    if (nearestOf(evenings) >= jd) {
      // the usual case: within 13 hours of phaseJd, and within 7.5 degrees of the target
      assert.ok(hours <= 13, label + `: ${hours} hours from the phase`);
      assert.ok(degrees <= 7.5, label + `: ${degrees} degrees from the target`);
      worstHours = Math.max(worstHours, hours);
      worstDegrees = Math.max(worstDegrees, degrees);
    } else {
      // the nearest evening had already passed when the visitor asked: the first evening after the input
      late += 1;
      assert.ok(nearestOf(evenings) < jd && r.jdUt - nearestOf(evenings) > 0.9 && r.jdUt - nearestOf(evenings) < 1.1, label + ": the evening after the one that passed");
      assert.ok(r.jdUt > r.phaseJd && hours > 11.5 && hours <= 25, label + `: ${hours} hours after the phase`);
      assert.ok(r.jdUt - jd < 1.05, label + ": within a day of the input");
      assert.ok(degrees <= 15.5 && n180(C.elongLonAt(r.jdUt) - target) > 0, label + `: ${degrees} degrees past the target`);
    }
  }
  t.diagnostic(`phaseEveningJd: 2000 instants; usual case at most ${worstHours.toFixed(2)} h and ${worstDegrees.toFixed(2)} degrees from the phase; `
    + `${late} instants (${(late / 20).toFixed(2)} %) where the nearest evening had already passed`);
  assert.ok(worstHours > 11 && worstDegrees > 6, "the sample reaches the edges of the usual case");
  assert.ok(late >= 1 && late <= 40, `${late} late cases: about one instant in 200`);
});

test("phaseEveningJd: named cases, the polar branch and bad input", () => {
  // Greenwich, 14 November 2026, 20:00 UT: the next Full Moon is on 24 November at 14:53 UT
  const jd = C.jdFromParts({ year: 2026, month: 11, day: 14, hour: 20 });
  const full = C.phaseEveningJd(jd, 180, GREENWICH.lat, GREENWICH.lonEast);
  const p = C.partsFromJd(full.phaseJd), e = C.partsFromJd(full.jdUt);
  assert.deepEqual([p.year, p.month, p.day], [2026, 11, 24]);
  assert.deepEqual([e.year, e.month, e.day, e.hour], [2026, 11, 24, 17], "one hour after the sunset of 24 November (about 16:00 UT)");
  near(full.jdUt - 1 / 24, C.sunEventOnLocalDay({ year: 2026, month: 11, day: 24 }, GREENWICH.lat, GREENWICH.lonEast, "set"), 1e-9, "one hour after that sunset");
  assert.equal(C.skyState(full.jdUt, GREENWICH.lat, GREENWICH.lonEast).phase.name, "Full Moon");
  // asked again from that evening itself, the answer is the same evening; asked a minute later, the next Full Moon
  assert.equal(C.phaseEveningJd(full.jdUt - 0.2, 180, GREENWICH.lat, GREENWICH.lonEast).jdUt, full.jdUt);
  const later = C.phaseEveningJd(full.jdUt + 0.001, 180, GREENWICH.lat, GREENWICH.lonEast);
  assert.ok(later.phaseJd - full.phaseJd > 29 && later.phaseJd - full.phaseJd < 30, "the Full Moon of December");
  // all eight buttons from one evening: none earlier, and in the order of the lunation
  const all = C.PHASE_TARGETS.map((ph) => C.phaseEveningJd(jd, ph.target, GREENWICH.lat, GREENWICH.lonEast));
  for (const r of all) assert.ok(r.jdUt >= jd && r.phaseJd >= jd && r.phaseJd - jd < 29.9);
  const start = C.elongLonAt(jd);                                   // 61 degrees: a waxing crescent
  const order = C.PHASE_TARGETS.map((ph, i) => [((ph.target - start) % 360 + 360) % 360, all[i].phaseJd]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < order.length; i++) assert.ok(order[i][1] > order[i - 1][1], "later phases come later");
  // a target outside 0..360 is the same phase
  assert.deepEqual(C.phaseEveningJd(jd, 540, GREENWICH.lat, GREENWICH.lonEast), full);
  assert.deepEqual(C.phaseEveningJd(jd, -180, GREENWICH.lat, GREENWICH.lonEast), full);
  // where the Sun does not set on those days the answer is the instant of the phase itself
  const pole = site("south-pole");
  const polar = C.phaseEveningJd(C.jdFromParts({ year: 2026, month: 6, day: 1 }), 90, pole.lat, pole.lonEast);
  assert.equal(polar.jdUt, polar.phaseJd);
  nearAngle(C.elongLonAt(polar.jdUt), 90, 1e-5, "on the phase");
  const midnightSun = C.phaseEveningJd(C.jdFromParts({ year: 2026, month: 6, day: 1 }), 180, 78, 15);
  assert.equal(midnightSun.jdUt, midnightSun.phaseJd);
  assert.throws(() => C.phaseEveningJd(NaN, 0, 0, 0), RangeError);
  assert.throws(() => C.phaseEveningJd(jd, "full", 0, 0), RangeError);
  assert.throws(() => C.phaseEveningJd(jd, 0, 91, 0), RangeError);
  assert.throws(() => C.phaseEveningJd(jd, 0, 0, -181), RangeError);
});

// ─── 11. the snapshot ────────────────────────────────────────────────────────

test("skyState: one frozen snapshot with the members section 4.2 lists", () => {
  const st = C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast);
  assert.deepEqual(Object.keys(st), ["jdUt", "lat", "lonEast", "decimalYear", "deltaT", "deltaTSigma", "jde", "T", "date", "localDate", "localMeanHours", "obliquity",
    "gmst", "gast", "lmst", "last", "zenith", "poleAltitude", "sun", "moon", "phase", "anchors", "uncertainty"]);
  assert.deepEqual(Object.keys(st.sun), ["lambda", "ra", "dec", "distanceAu", "lightSeconds", "alt", "az"]);
  assert.deepEqual(Object.keys(st.moon), ["lambda", "beta", "ra", "dec", "distanceKm", "lightSeconds", "alt", "az", "altGeocentric"]);
  assert.deepEqual(Object.keys(st.phase), ["elongLon", "elongation", "phaseAngle", "illuminatedFraction", "brightLimbPa", "brightLimbFromZenith", "name", "waxing", "ageDays",
    "previousNewMoonJd", "nextNewMoonJd"]);
  assert.deepEqual(Object.keys(st.anchors), C.ANCHORS.map((a) => a.key));
  for (const a of C.ANCHORS) assert.deepEqual(Object.keys(st.anchors[a.key]), a.key === "polaris" ? ["ra", "dec", "alt", "az", "eclLon", "eclLat", "galL", "galB", "poleDistance"] : ["ra", "dec", "alt", "az", "eclLon", "eclLat", "galL", "galB"]);
  assert.deepEqual(Object.keys(st.uncertainty), ["sunDeg", "moonDeg", "moonLongitudeSigmaDeg", "badge", "note"]);
  assert.deepEqual(Object.keys(st.zenith), ["ra", "dec"]);
  assert.deepEqual(Object.keys(st.date), ["year", "month", "day", "hour", "minute", "second", "calendar"]);
  assert.ok(deepFrozen(st), "frozen all the way down");
  assert.throws(() => { st.jdUt = 0; }, TypeError);
  assert.throws(() => { st.sun.alt = 90; }, TypeError);
  assert.throws(() => { st.anchors.polaris.alt = 90; }, TypeError);
  assert.throws(() => { st.anchors.mars = {}; }, TypeError);
  assert.throws(() => { st.localDate.day = 1; }, TypeError);
  const walk = (o, where) => { for (const [k, v] of Object.entries(o)) { if (v !== null && typeof v === "object") walk(v, where + k + "."); else if (typeof v === "number") assert.ok(Number.isFinite(v), where + k + " is a finite number"); } };
  for (const s of FRAME_STATES()) walk(s, "");
  // what each member is
  assert.deepEqual([st.jdUt, st.lat, st.lonEast], [NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast]);
  assert.equal(st.jde, st.jdUt + st.deltaT / 86400);
  assert.equal(st.T, (st.jde - 2451545) / 36525);
  assert.deepEqual(st.date, C.partsFromJd(st.jdUt));
  assert.deepEqual(st.localDate, C.partsFromJd(st.jdUt + st.lonEast / 360));
  assert.equal(st.localMeanHours, C.localMeanHours(st.jdUt, st.lonEast));
  near(st.localDate.hour + st.localDate.minute / 60 + st.localDate.second / 3600, st.localMeanHours, 1e-6, "the local date and the local mean time agree");
  assert.equal(st.lmst, C.norm360(st.gmst + st.lonEast));
  assert.equal(st.last, C.norm360(st.gast + st.lonEast));
  assert.equal(st.gmst, C.gmstDeg(st.jdUt));
  assert.equal(st.poleAltitude, st.lat);
  assert.equal(st.phase.name, C.phaseName(st.phase.elongLon));
  assert.equal(st.phase.ageDays, st.jdUt - st.phase.previousNewMoonJd);
  near(st.phase.previousNewMoonJd, C.previousPhaseTime(st.jdUt, 0), 1e-9, "the new Moon before");
  near(st.phase.nextNewMoonJd, C.nextPhaseTime(st.jdUt, 0), 1e-9, "the new Moon after");
  assert.ok(st.phase.previousNewMoonJd <= st.jdUt && st.jdUt <= st.phase.nextNewMoonJd);
  near(st.phase.nextNewMoonJd - st.phase.previousNewMoonJd, 29.53, 0.3, "one lunation");
  assert.equal(st.anchors.polaris.poleDistance, 90 - st.anchors.polaris.dec);
  for (const a of C.ANCHORS) {
    const p = C.starOfDate(a.raJ2000, a.decJ2000, st.T);
    assert.deepEqual([st.anchors[a.key].ra, st.anchors[a.key].dec], [p.ra, p.dec], a.key + " of date");
    const g = C.equJ2000ToGal(a.raJ2000, a.decJ2000);
    assert.deepEqual([st.anchors[a.key].galL, st.anchors[a.key].galB], [g.l, g.b], a.key + " galactic");
  }
  // at the instant of a new Moon the age is zero, not a negative rounding
  const atNew = C.skyState(st.phase.previousNewMoonJd, KEBAR.lat, KEBAR.lonEast);
  assert.ok(atNew.phase.ageDays >= 0 && atNew.phase.ageDays < 1e-6, "age " + atNew.phase.ageDays);
  assert.ok(atNew.phase.nextNewMoonJd >= atNew.jdUt);
  // the same inputs give the same snapshot
  assert.deepEqual(C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast), st);
});

// ─── 12. the sky as LEX/1 rows ───────────────────────────────────────────────

const LAYERS = ["text", "said", "checked", "reading"];
const ADDRESS = /^(0|[1-9]\d{0,3})(\.(0|[1-9]\d{0,3})){0,7}$/;
const KIND = /^[a-z][a-z0-9-]{0,15}$/;
const NAME = /^(?! )(?!.* $)(?!.*  )(?!\p{M})[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u;
const TEXT = /^[\p{L}\p{M}\p{N}\p{P}\p{S} \n]*$/u;
const IGNORABLE = /\p{Default_Ignorable_Code_Point}/u;
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/** The field rules of LEX/1 as section 5.2 words them, and the order rule of 5.3 (the real makeEntry check is
 *  in explorers-integration.test.mjs). */
function assertLexRows(rows, label) {
  const last = new Map();
  let prev = null;
  for (const row of rows) {
    assert.equal(row.length, 5, label);
    for (const field of row) assert.equal(typeof field, "string", label + ": every field is a string");
    const [address, layer, kind, name, text] = row, where = label + " " + address;
    assert.match(address, ADDRESS, where);
    assert.ok(LAYERS.includes(layer), where + " layer");
    assert.match(kind, KIND, where + " kind");
    assert.ok([...name].length >= 1 && [...name].length <= 96 && NAME.test(name) && !IGNORABLE.test(name), where + " name: " + name);
    assert.ok([...text].length <= 1200 && TEXT.test(text) && !IGNORABLE.test(text), where + " text");
    assert.equal(name.normalize("NFC"), name, where);
    assert.equal(text.normalize("NFC"), text, where);
    assert.ok(text.length > 0 && !/\s\s/.test(text) && text.trim() === text, where + ": no doubled or stray spaces");
    assert.doesNotMatch(name + text, /NaN|undefined|null|Infinity|-0\.0+\b(?!\d)|\[object/, where);
    const cut = address.lastIndexOf("."), parent = cut < 0 ? "" : address.slice(0, cut), index = Number(address.slice(cut + 1));
    assert.ok(parent === "" || prev === parent || (prev !== null && prev.startsWith(parent + ".")), where + " is in depth-first order");
    if (prev === null) assert.equal(parent, "", where);
    assert.ok(!last.has(parent) || index > last.get(parent), where + ": indices grow under one parent");
    last.set(parent, index);
    prev = address;
  }
}

test("skyLexiconRows: the tree of section 4.4, every field a string, deterministic", () => {
  const st = C.skyState(...Object.values(C.roundSkyInputs(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast)));
  const rows = C.skyLexiconRows(st, KEBAR);
  assertLexRows(rows, "Kebar");
  assert.deepEqual(rows.map((r) => r.slice(0, 3).join(" ")), [
    "1 reading fix", "1.1 reading place", "1.2 reading time", "1.3 checked moon",
    "2 checked shell", "2.1 checked body", "2.2 checked body",
    "3 said shell", "3.1 said body", "3.1.1 checked sky", "3.2 said body", "3.2.1 checked sky", "3.3 said body", "3.3.1 checked sky",
    "3.4 said body", "3.4.1 checked sky", "3.5 said body", "3.5.1 checked sky", "3.6 said body", "3.6.1 checked sky",
    "4 said shell", "4.1 said measured", "4.2 checked geometry", "4.3 said proposal", "4.4 said predicted",
  ]);
  assert.equal(rows.length, 25, "about 26 rows");
  assert.equal(rows.filter((r) => !r[0].includes(".")).length, 4, "four epochs");
  const name = (address) => rows.find((r) => r[0] === address)[3], text = (address) => rows.find((r) => r[0] === address)[4];
  assert.deepEqual(["1", "2", "3", "4", "2.1", "2.2", "4.1", "4.2", "4.3", "4.4"].map(name),
    ["Where and when", "Sun and Moon", "Anchors in the Galaxy and beyond", "The rim", "Sun", "Moon", "Cosmic microwave background", "The celestial sphere", "Celestial holography", "Gravitational-wave memory"]);
  assert.deepEqual(["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"].map(name), C.ANCHORS.filter((a) => a.distanceLy !== null).map((a) => a.label), "one body for every anchor with a distance");
  // deterministic, and a pure function of the three rounded numbers
  assert.deepEqual(C.skyLexiconRows(st, KEBAR), rows);
  assert.deepEqual(C.skyLexiconRows(st), rows, "the site argument adds nothing");
  assert.deepEqual(C.skyLexiconRows(C.skyState(st.jdUt, st.lat, st.lonEast)), rows, "a second state from the same three numbers");
  assert.deepEqual(C.skyLexiconRows(C.skyState(NIPPUR_SUNSET, KEBAR.lat, KEBAR.lonEast)), rows, "a state from numbers that round to the same three");
  assert.deepEqual(C.skyLexiconRows(C.skyState(st.jdUt + 4e-6, st.lat + 0.004, st.lonEast - 0.004)), rows);
  assert.deepEqual(C.skyLexiconRows({ jdUt: st.jdUt, lat: st.lat, lonEast: st.lonEast, sun: { alt: 99 } }), rows, "only the three numbers of the state are read");
  assert.deepEqual(C.skyLexiconRows(st, { label: "Somewhere else", lat: 32.134, lonEast: 45.226 }), rows, "a label passed in is not used");
  assert.notDeepEqual(C.skyLexiconRows(C.skyState(st.jdUt + 2e-5, st.lat, st.lonEast)), rows, "another instant is another lexicon");
  assert.notDeepEqual(C.skyLexiconRows(C.skyState(st.jdUt, st.lat + 0.01, st.lonEast)), rows, "another latitude is another lexicon");
  assert.notEqual(C.skyLexiconRows(st), C.skyLexiconRows(st), "a fresh array every time");
  assert.throws(() => C.skyLexiconRows(st, { lat: 32.14, lonEast: 45.23 }), /the site is not the place of the state/);
  assert.throws(() => C.skyLexiconRows(st, { lat: "32.13", lonEast: 45.23 }), /the site is not the place of the state/);
  assert.throws(() => C.skyLexiconRows(null), /a state made by skyState is needed/);
  assert.throws(() => C.skyLexiconRows({ jdUt: 1 }), /a state made by skyState is needed/);
  assert.throws(() => C.skyLexiconRows({ jdUt: 5, lat: 0, lonEast: 0 }), RangeError, "an instant outside the range");
  // the Kebar preset, word for word where the numbers are
  assert.equal(name("1.1"), "By the Kebar (Nippur)");
  assert.equal(text("1.1"), "Latitude 32.13° north, longitude 45.23° east. " + KEBAR.note);
  assert.equal(name("1.2"), "31 July 593 BC (Julian calendar)");
  assert.equal(text("1.2"), "Local date at this longitude: 31 July 593 BC (Julian calendar). Local mean time 19:00: the Sun's average time at this longitude, without time zones. Julian Day 1505042.16624 (Universal Time).");
  assert.equal(name("1.3"), "Moon: First Quarter");
  assert.equal(text("1.3"), "First Quarter. 50.2 % lit and growing. 6.78 days after new Moon.");
  assert.equal(text("2.1"), "Ecliptic longitude 121.05°. Altitude -0.83°, azimuth 294.64°. Distance 1.00797 au, which is 502.98 light-seconds.");
  assert.equal(text("2.2"), "Ecliptic longitude 211.15°, latitude 0.34°. Elongation 90.10° from the Sun, waxing. Altitude 41.94°, azimuth 205.27°. Distance 387,932 km, which is 1.294 light-seconds.");
  assert.match(text("2"), /the Sun is good to about 0\.01° and the Moon to about 0\.07°/);
  assert.equal(text("3.1.1"), "Altitude 34.58°, azimuth 181.06° at this place and instant. Precession and nutation are applied; aberration and proper motion are neglected.");
  assert.ok(text("3.5.1").endsWith("Polaris stands 15.0° from the north celestial pole on this date."));
  assert.equal(name("3.2.1"), "Vela pulsar in this sky");
  assert.equal(sha256(JSON.stringify(rows)), "ea6be2c58729f9fdfea56ee04fb941817f51f331211e13002f9ca670cde44221", "the sky lexicon of the Kebar preset, to the letter");
});

test("skyLexiconRows: the numbers in the rows are the numbers of the state, for places and dates all over the range", () => {
  const next = rng(2026);
  const cases = C.SITES.map((s, i) => [2461358.5 + 37.123 * i, s.lat, s.lonEast]);
  for (let i = 0; i < 150; i++) cases.push([990925 + next() * 1826226, -90 + 180 * next(), -180 + 360 * next()]);
  cases.push([990923.5, 0, 0], [2817152.4999, 0, 0], [2299160.5, 10, 10], [2299159.5, -10, -10], [2461358.5, -0.001, -0.001], [2461358.5, 90, 180], [2461358.5, -90, -180]);
  const num = "(-?\\d+\\.\\d+)";
  for (const [jd, lat, lon] of cases) {
    const q = C.roundSkyInputs(jd, lat, lon), st = C.skyState(q.jdUt, q.lat, q.lonEast), label = `sky ${q.jdUt}, ${q.lat}, ${q.lonEast}`;
    const rows = C.skyLexiconRows(C.skyState(jd, lat, lon));
    assertLexRows(rows, label);
    assert.equal(rows.length, 25, label);
    assert.deepEqual(C.skyLexiconRows(st), rows, label + ": the same rows from the rounded inputs");
    const text = (address) => rows.find((r) => r[0] === address)[4], name = (address) => rows.find((r) => r[0] === address)[3];
    const grab = (address, pattern) => { const m = new RegExp(pattern).exec(text(address)); assert.ok(m, `${label} row ${address}: ${text(address)}`); return m.slice(1).map(Number); };
    const same = (got, want, decimals, what) => assert.equal(got, Number(want.toFixed(decimals)) + 0, `${label} ${what}: printed ${got}, state ${want}`);
    // 1.1 the place, two decimals with a hemisphere
    const place = C.siteForCoordinates(q.lat, q.lonEast);
    assert.equal(name("1.1"), place.label, label);
    const [la, lo] = grab("1.1", `^Latitude (\\d+\\.\\d\\d)° (?:north|south), longitude (\\d+\\.\\d\\d)° (?:east|west)\\. `);
    assert.equal(la, Math.abs(q.lat)); assert.equal(lo, Math.abs(q.lonEast));
    assert.ok(text("1.1").includes(q.lat < 0 ? "° south," : "° north,") && text("1.1").includes(q.lonEast < 0 ? "° west." : "° east."), label);
    assert.ok(text("1.1").endsWith(place.note), label);
    // 1.2 the local date, the local mean time and the Julian Day to five decimals
    assert.equal(name("1.2"), C.formatDate(st.localDate), label);
    assert.ok(text("1.2").includes("Julian Day " + q.jdUt.toFixed(5) + " (Universal Time)."), label);
    assert.ok(text("1.2").includes("Local mean time " + String(st.localDate.hour).padStart(2, "0") + ":" + String(st.localDate.minute).padStart(2, "0") + ":"), label);
    assert.ok(text("1.2").startsWith("Local date at this longitude: " + C.formatDate(st.localDate) + ". "), label);
    // 1.3 the Moon
    assert.equal(name("1.3"), "Moon: " + st.phase.name);
    const [lit, age] = grab("1.3", `^${st.phase.name}\\. ${num} % lit and (?:growing|shrinking)\\. ${num} days after new Moon\\.$`);
    same(lit, 100 * st.phase.illuminatedFraction, 1, "per cent lit"); same(age, st.phase.ageDays, 2, "age");
    assert.ok(text("1.3").includes(st.phase.waxing ? "growing" : "shrinking"), label);
    // 2 the uncertainty of the year
    const [sunDeg, moonDeg] = grab("2", `the Sun is good to about ${num}° and the Moon to about ${num}°`);
    same(sunDeg, st.uncertainty.sunDeg, 2, "Sun uncertainty"); same(moonDeg, st.uncertainty.moonDeg, 2, "Moon uncertainty");
    // 2.1 the Sun
    const sun = grab("2.1", `^Ecliptic longitude ${num}°\\. Altitude ${num}°, azimuth ${num}°\\. Distance ${num} au, which is ${num} light-seconds\\.$`);
    same(sun[0], st.sun.lambda, 2, "Sun longitude"); same(sun[1], st.sun.alt, 2, "Sun altitude"); same(sun[2], st.sun.az, 2, "Sun azimuth");
    same(sun[3], st.sun.distanceAu, 5, "Sun distance"); same(sun[4], st.sun.lightSeconds, 2, "Sun light-seconds");
    // 2.2 the Moon: the topocentric altitude
    const moon = grab("2.2", `^Ecliptic longitude ${num}°, latitude ${num}°\\. Elongation ${num}° from the Sun, (?:waxing|waning)\\. Altitude ${num}°, azimuth ${num}°\\. Distance (\\d{3}),(\\d{3}) km, which is ${num} light-seconds\\.$`);
    same(moon[0], st.moon.lambda, 2, "Moon longitude"); same(moon[1], st.moon.beta, 2, "Moon latitude"); same(moon[2], st.phase.elongation, 2, "elongation");
    same(moon[3], st.moon.alt, 2, "Moon altitude"); same(moon[4], st.moon.az, 2, "Moon azimuth");
    assert.equal(moon[5] * 1000 + moon[6], Math.round(st.moon.distanceKm), label + " Moon distance");
    same(moon[7], st.moon.lightSeconds, 3, "Moon light-seconds");
    assert.ok(text("2.2").includes(st.phase.waxing ? ", waxing." : ", waning."), label);
    // 3.n.1 the anchors in this sky
    C.ANCHORS.filter((a) => a.distanceLy !== null).forEach((a, i) => {
      const [alt, az] = grab(`3.${i + 1}.1`, `^Altitude ${num}°, azimuth ${num}° at this place and instant\\.`);
      same(alt, st.anchors[a.key].alt, 2, a.key + " altitude"); same(az, st.anchors[a.key].az, 2, a.key + " azimuth");
      assert.equal(name(`3.${i + 1}.1`), a.label + " in this sky");
      if (a.key === "polaris") same(grab(`3.${i + 1}.1`, `Polaris stands ${num}° from the north celestial pole on this date\\.$`)[0], st.anchors.polaris.poleDistance, 1, "pole distance");
    });
  }
});

test("skyLexiconRows: the said rows name their sources and quote the verified sentences", () => {
  const rows = C.skyLexiconRows(C.skyState(2461358.5, GREENWICH.lat, GREENWICH.lonEast));
  const text = (address) => rows.find((r) => r[0] === address)[4];
  // the anchors: position, distance, source strings
  C.ANCHORS.filter((a) => a.distanceLy !== null).forEach((a, i) => {
    const t = text(`3.${i + 1}`);
    assert.ok(t.startsWith(`J2000 position: right ascension ${a.raJ2000.toFixed(4)}°, declination ${a.decJ2000.toFixed(4)}°, from ${a.positionSource}. Distance: about `), a.key);
    assert.ok(t.includes(a.distanceNote), a.key + " carries its distance note");
    assert.match(t, /\(range used here: [\d,.]+ to [\d,.]+( million)?\)\./, a.key);
  });
  assert.match(text("3.1"), /Distance: about 26,700 light-years \(range used here: 26,400 to 27,100\)\./);
  assert.match(text("3.2"), /Distance: about 956 light-years \(range used here: 881 to 1,020\)\./);
  assert.match(text("3.6"), /Distance: about 2\.48 million light-years \(range used here: 2\.41 to 2\.58 million\)\./);
  assert.match(text("3.2"), /“the 89 ms pulsar”: about 11 turns a second\..*so this is not one of them\.$/);
  // the rim: the sentences the prototype audit verified, letter for letter
  assert.ok(text("4.1").includes("“Decoupling was 379+8-7 kyr after the Big Bang at a redshift of 1089 +/- 1.”"));
  assert.ok(text("4.1").endsWith(C.CMB.note));
  assert.ok(text("4.3").includes("Pasterski (2021, arXiv:2108.04801) writes: “Celestial Holography proposes a duality between gravitational scattering in asymptotically flat spacetimes and a conformal field theory (CFT) living in two dimensions lower on the celestial sphere.”"));
  assert.ok(text("4.3").includes("Raclariu (2021, arXiv:2107.02075) writes: “A concrete realization of this duality in any but asymptotically negatively curved backgrounds remains an important open problem.”"));
  assert.ok(text("4.3").startsWith("A proposal. "));
  assert.ok(text("4.4").startsWith("Predicted, not detected. "));
  assert.ok(text("4.4").includes("The NANOGrav collaboration (2025, arXiv:2502.18599) reports: “We find no significant evidence for memory signals in the dataset”."));
  assert.ok(text("4.4").includes("Strominger (2017, arXiv:1703.05448, section 6) writes of this effect: “The effect is harder to see than gravity waves themselves but has a decent chance of being measured in the coming decades.”"));
  assert.equal(text("4.2"), "The rim of this ball is where directions live: every sight line from the centre ends at one point of the rim, however far the thing seen. Every move of the ball sends circles on the rim to circles.");
  // outside its quotations a said row uses none of these words (section 1.6, Voice)
  for (const r of rows.filter((x) => x[1] === "said")) assert.doesNotMatch(r[4].replace(/“[^”]*”/g, ""), /\b(but|however|in fact|actually)\b/i, r[0]);
  assert.match(text("4.3").replace(/“[^”]*”/g, "Q"), /^A proposal\. Pasterski \(2021, arXiv:2108\.04801\) writes: Q Raclariu \(2021, arXiv:2107\.02075\) writes: Q$/);
  // every said body names a published source or says where its position comes from
  for (const r of rows.filter((x) => x[1] === "said" && x[2] === "body")) assert.match(r[4], /arXiv:/, r[0]);
});

test("roundSkyInputs and formatSkyInputs: the three numbers of a link", () => {
  assert.deepEqual(C.roundSkyInputs(NIPPUR_SUNSET, 32.13, 45.23), { jdUt: 1505042.16624, lat: 32.13, lonEast: 45.23 });
  assert.deepEqual(C.formatSkyInputs(NIPPUR_SUNSET, 32.13, 45.23), { jd: "1505042.16624", lat: "32.13", lon: "45.23" });
  assert.deepEqual(C.formatSkyInputs(2461358.5, 51.4769, 0), { jd: "2461358.50000", lat: "51.48", lon: "0.00" });
  assert.deepEqual(C.formatSkyInputs(2461358.123456, -33.8688, 151.2093), { jd: "2461358.12346", lat: "-33.87", lon: "151.21" });
  assert.deepEqual(C.formatSkyInputs(2461358.5, -0.001, -0.004), { jd: "2461358.50000", lat: "0.00", lon: "0.00" }, "no negative zero in a link");
  assert.ok(Object.is(C.roundSkyInputs(2461358.5, -0.001, -0.004).lat, 0) && Object.is(C.roundSkyInputs(2461358.5, -0.001, -0.004).lonEast, 0));
  const next = rng(64);
  for (let i = 0; i < 2000; i++) {
    const jd = 990925 + next() * 1826226, lat = -90 + 180 * next(), lon = -180 + 360 * next();
    const q = C.roundSkyInputs(jd, lat, lon), f = C.formatSkyInputs(jd, lat, lon);
    // a page that reads the link back gets the very same three numbers, and they are a fixed point
    assert.deepEqual({ jdUt: Number(f.jd), lat: Number(f.lat), lonEast: Number(f.lon) }, q);
    assert.deepEqual(C.roundSkyInputs(q.jdUt, q.lat, q.lonEast), q);
    assert.ok(Math.abs(q.jdUt - jd) <= 0.5000001e-5 && Math.abs(q.lat - lat) <= 0.005000001 && Math.abs(q.lonEast - lon) <= 0.005000001);
    // the link grammar of section 7.2
    assert.match(f.jd, /^\d{1,7}(\.\d{1,6})?$/); assert.match(f.lat, /^-?\d{1,2}(\.\d{1,4})?$/); assert.match(f.lon, /^-?\d{1,3}(\.\d{1,4})?$/);
    assert.ok(C.skyInputsValid(q.jdUt, q.lat, q.lonEast));
  }
  assert.throws(() => C.roundSkyInputs("1", 0, 0), RangeError);
  assert.throws(() => C.formatSkyInputs(1, NaN, 0), RangeError);
});

// ─── 13. the file itself ─────────────────────────────────────────────────────

test("the core imports nothing, carries its licence lines, and its header states the checks this test runs", () => {
  assert.ok(SOURCE.startsWith("// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 Ebayednoob\n"));
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /^\s*import\b/m, "no import statement");
  assert.doesNotMatch(code, /\bimport\s*\(|\brequire\s*\(|\bglobalThis\b|\bwindow\b|\bdocument\b|\bprocess\b|\bDate\b|Math\.random/, "no loader, no DOM, no clock, no dice");
  const header = SOURCE.slice(0, SOURCE.indexOf("*/")).replace(/\n \*/g, "\n").replace(/\s+/g, " ");
  const dev = DEVELOPMENT_VECTORS * (PER_VECTOR.spec + PER_VECTOR.ephem + PER_VECTOR.rigorous);
  const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sentence = `Development test: ${group(dev)} checks, 0 failures: ${group(DEVELOPMENT_VECTORS * PER_VECTOR.spec)} against the Python reference of the same formulas, `
    + `${group(DEVELOPMENT_VECTORS * PER_VECTOR.ephem)} against PyEphem 4.2.1, ${group(DEVELOPMENT_VECTORS * PER_VECTOR.rigorous)} against Swiss-Ephemeris-based positions; `
    + `Skyfield and native Swiss Ephemeris values were compared during development only. The committed test runs ${group(COMMITTED_CHECKS)} checks (printed by the test).`;
  assert.equal(sentence, "Development test: 6,900 checks, 0 failures: 3,726 against the Python reference of the same formulas, 2,001 against PyEphem 4.2.1, 1,173 against "
    + "Swiss-Ephemeris-based positions; Skyfield and native Swiss Ephemeris values were compared during development only. The committed test runs 2,900 checks (printed by the test).");
  assert.ok(header.includes(sentence), "the sentence of section 4.1, with the number this test prints");
  for (const piece of ["Meeus, Astronomical Algorithms (1991)", "Espenak and Meeus", "IAU 2006 precession", "Every angle in this file is in DEGREES",
    "Star aberration (0.006 degrees) and proper motion are neglected", "0.83 degrees below the level horizon", "0.04 degrees by 2100 and 0.1 by 2200",
    "known only to about plus or minus 8 minutes for that year", "Polaris is 0.6 degrees from the pole today and was 15.0 degrees from it in 593 BC",
    "6 s too large today", "before about AD 915 and after about 2045", "not a claim about the shape of space"]) assert.ok(header.includes(piece), "the header says: " + piece);
  // every export of the reference port is still exported
  for (const name of ["J2000", "AU_KM", "EARTH_RADIUS_KM", "norm360", "norm180", "isGregorianAuto", "jdFromCalendar", "calendarFromJd", "decimalYear", "deltaTSeconds", "jdeFromJdUt",
    "centuries", "meanObliquity", "moonNode", "nutation", "eclToEqu", "equToEcl", "equJ2000ToGal", "galToEquJ2000", "precessionAngles", "precessFromJ2000", "starOfDate", "sunPosition",
    "moonPosition", "moonPhase", "PHASE_HALF_WIDTH", "phaseName", "elongLonAt", "findPhaseTime", "previousPhaseTime", "nextPhaseTime", "moonAgeDays", "gmstDeg", "gastDeg", "equToHor",
    "topocentricAltitude", "refractionDeg", "sky", "sunsetJdUt"]) assert.ok(name in C, "export " + name);
  assert.deepEqual([C.J2000, C.AU_KM, C.EARTH_RADIUS_KM], [2451545.0, 149597870.7, 6378.14]);
});
