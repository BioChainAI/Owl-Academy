// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Browser walkthrough of First Explorers (Library/Experimental_Systems/First_Explorers/). Optional, run by hand; it
// is not part of node --test. One journey, the way a visitor would go, on a desktop screen (1440 x 900, mouse and
// keyboard) and on a phone screen (390 x 844, touch): the nine stations from Darkness to The way, five
// observations (one per sense), the packet and its bits, the chain and its ledger, the Overwatch checks, the
// tamper lab, the four receivers with and without noise, the three files the page saves, the bridge in 2D and
// 3D, the three reading levels, the dialog. Every check records what was expected and what the page really showed
// or held.
//
//   node tests/browser/first-explorers.cjs                     both screens, about three minutes
//   node tests/browser/first-explorers.cjs --only=desktop      one screen (desktop or phone)
//   --root=<folder>    walk a copy of the repository in another folder
//   --shots=<folder>   write the pictures (PNG, two device pixels per CSS pixel) and manifest.json there
//   --json=<file>      write every check with expected and actual, and what was noted at each station
//   --verbose          print every step and every check, not only the failures and one line per screen
//
// What the page should show is worked out here, outside the browser: the five lines are written by hand, the
// repository's own modules (scripts/strix-overwatch.js, scripts/biomesh-core.js) grow the journey in Node, and
// signatures, the ledger and parity are checked again with this script's own code.
//
// Rules it keeps:  - every request that would leave this computer is refused, the page's web fonts among them
//                    (so the page is seen with the fonts of this computer; the last step checks that the
//                    font style sheet was the only such request);
//                  - each of the three "Save" buttons is pressed once, with the journey of five, and nothing
//                    else is downloaded: the package is read back here, given to the front door in Node
//                    (readHyperpack) and loaded into the Lexicon Explorer, opened for that in a window of its
//                    own; the ledger is compared with the one the page holds. The files go to a folder under
//                    the system's temporary folder and are removed at the end;
//                  - the repository is read, never written to.
//
// It needs Playwright with Chromium (see tests/browser/README.md) and serves the repository itself on 127.0.0.1
// and a free port. Exit code 0 only when every check passed.
'use strict';
const kit = require('./lib/walk-kit.cjs');
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { pathToFileURL } = require('url');

const USAGE = 'node tests/browser/first-explorers.cjs [--only=desktop|phone] [--root=<folder>] [--shots=<folder>] [--json=<file>] [--verbose]';
const OPTS = kit.options(__dirname, USAGE, ['only']);
const ROOT = OPTS.root;
const PAGE_PATH = '/Library/Experimental_Systems/First_Explorers/index.html';
const LEXICON_PATH = '/Library/Experimental_Systems/Lexicon_Explorer/index.html';   // where the saved package is loaded
kit.needFile(ROOT, PAGE_PATH.slice(1));
kit.needFile(ROOT, LEXICON_PATH.slice(1));
const ONLY = kit.listOption(OPTS.only, ['desktop', 'phone'], 'only');
const RECORD = new kit.Record('First Explorers', { verbose: OPTS.verbose });
const SHOTS = new kit.Shots(OPTS.shots, 'Pictures of the First Explorers walkthrough (tests/browser/first-explorers.cjs). PNG, two device pixels per CSS pixel.');
let ORIGIN = '', PAGE = '';   // the walkthrough's own server and the page on it, known once the server listens
let SAVED = '';               // the folder the page's downloads are kept in while the walkthrough runs

const T0 = Date.now();
const log = (...a) => { if (OPTS.verbose) console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a); };
const sha256 = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const short = (s, a = 10, b = 6) => (s && s.length > a + b + 1 ? s.slice(0, a) + '…' + s.slice(-b) : s);   // how the page shortens long values
const hexBytes = (s) => [...Buffer.from(s, 'utf8')].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const J = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

// ─── the journey the visitor makes: five observations, one per sense ─────────
// The lines are written here by hand from the inputs the script gives, so they do not come from the page.
const TOUCH_START = [3, 16], TOUCH_PATH = '7777001111111100777777770';   // a wave: up, along, down, along, up
const JOURNEY = [
  { sense: 'sound', button: 'Sound', name: 'owl call', typed: 'owl call', line: 'OBS/1|sound|owl call|hz=880;ms=1500', address: '0.0', branch: 'sound' },
  { sense: 'light', button: 'Light', name: 'sunrise', typed: 'sunrise', line: 'OBS/1|light|sunrise|r=245;g=158;b=11', address: '1.0', branch: 'light' },
  { sense: 'touch', button: 'Touch', name: 'wave', typed: 'wave', line: `OBS/1|touch|wave|at=${TOUCH_START.join(',')};path=${TOUCH_PATH}`, address: '2.0', branch: 'touch' },
  { sense: 'symbol', button: 'Word', name: 'word 1', typed: '', line: 'OBS/1|symbol|word 1|text=night owl 100%25', address: '3.0', branch: 'word' },
  { sense: 'number', button: 'Count', name: 'primes', typed: 'primes', line: 'OBS/1|number|primes|seq=2,3,5,7,11,13,17,19', address: '4.0', branch: 'count' },
];
const STATION_NAMES = ['Darkness', 'A signal', 'Measure', 'Shape', 'The packet', 'The chain', 'Overwatch', 'Across space', 'The way'];
// The tamper lab: what each option is named, and the check the page's own table names for it (read from first-explorers.js).
const TAMPER = [
  ['Flip one bit of a packet', 'parity'], ['Change the packed text', 'canonical'], ['Change a leaf hash', 'leaves'], ['Rename the chain', 'weaves'],
  ['Miscount the engrams', 'derived'], ['Rename a word in the lexicon', 'lexicon'], ['Swap an ancestor epoch', 'lineage'], ['Rewrite a ledger entry', 'trace'],
  ["Change the certificate's line", 'commitment'], ['Forge the signature', 'signature'],
];
const OVERWATCH_CHECKS = ['parity', 'canonical', 'crystal', 'leaves', 'weaves', 'derived', 'meaning', 'lexicon', 'lineage', 'trace'];
const PACKAGE_CHECKS = ['parse', ...OVERWATCH_CHECKS, 'commitment', 'signature'];
const CITIES = [   // from STRIX_OVERWATCH.md: compass bearing from Galilee and distance in km; map distance = 0.8 ln(1 + km / 60)
  { id: 'antioch', city: 'Antioch', people: 'Syrians', bearing: 11, km: 397 }, { id: 'alexandria', city: 'Alexandria', people: 'Egyptians', bearing: 253, km: 534 },
  { id: 'athens', city: 'Athens', people: 'Greeks', bearing: 303, km: 1201 }, { id: 'rome', city: 'Rome', people: 'Romans', bearing: 304, km: 2252 },
];
for (const c of CITIES) c.distance = 0.8 * Math.log(1 + c.km / 60);

// ─── checks done outside the browser, with this script's own code ────────────
async function verifySignature(jwk, text, sigHex) {   // ECDSA P-256 over SHA-256, signature as 64 raw bytes in hex
  const key = await crypto.webcrypto.subtle.importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return crypto.webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(sigHex, 'hex'), Buffer.from(text, 'utf8'));
}
const sealIdOf = (jwk) => 'S-' + sha256(`${jwk.x}|${jwk.y}`).slice(0, 24);
function verifyLedger(ledger) {   // TRACE/1: every entry hashes its own fields and the hash of the entry before it
  let prev = '0'.repeat(64);
  for (let i = 0; i < ledger.length; i++) {
    const e = ledger[i];
    const want = sha256(['TRACE/1', e.n, e.actor, e.event, e.at, sha256(e.detail), e.prev].join('|'));
    if (e.n !== i || e.prev !== prev || e.hash !== want) return { ok: false, brokenAt: i };
    prev = e.hash;
  }
  return { ok: true, entries: ledger.length };
}
function parityOf(hex16) {   // bit 59 guards the other 63 bits: it is 1 when they hold an odd number of ones
  const w = BigInt('0x' + hex16); let ones = 0;
  for (let b = 0n; b < 64n; b++) if (b !== 59n && (w >> b) & 1n) ones++;
  return (ones & 1) === Number((w >> 59n) & 1n);
}
const flipBits = (hex16, bits) => bits.reduce((w, b) => w ^ (1n << BigInt(b)), BigInt('0x' + hex16)).toString(16).toUpperCase().padStart(16, '0');
const bitsDiffer = (a, b) => { let x = parseInt(a, 16) ^ parseInt(b, 16), n = 0; while (x) { n += x & 1; x >>= 1; } return n; };
const httpStatus = (url) => new Promise((res) => { const r = http.request(url, { method: 'HEAD' }, (m) => { m.resume(); res(m.statusCode); }); r.on('error', (e) => res('error: ' + e.message)); r.end(); });

// The narration the source file holds, to compare with what the page shows at each reading level.
function stationsFromSource() {
  const src = fs.readFileSync(path.join(ROOT, 'Library', 'Experimental_Systems', 'First_Explorers', 'first-explorers.js'), 'utf8');
  const a = src.indexOf('const STATIONS = ['), b = src.indexOf('];\nconst TAMPERS');
  if (a < 0 || b < 0) throw new Error('could not find the STATIONS table in first-explorers.js');
  return new Function('return ' + src.slice(a + 'const STATIONS = '.length, b + 1))();
}

// What the repository's own modules give for this journey when run in Node, outside the browser.
async function expectations() {
  const OW = await import(pathToFileURL(path.join(ROOT, 'scripts', 'strix-overwatch.js')).href);
  const BM = await import(pathToFileURL(path.join(ROOT, 'scripts', 'biomesh-core.js')).href);
  const epochs = []; const obs = []; let chain = null;
  for (const j of JOURNEY) {
    const o = OW.parseObservation(j.line);   // throws unless the hand-written line is the one canonical line
    obs.push(o);
    chain = await OW.growJourney(chain, o);
    const lineBytes = [...Buffer.from(j.line + '\n')];
    epochs.push({
      epoch: chain.epoch || 1, chainId: chain.chainId, merkleRoot: chain.merkleRoot, packet0: chain.stream.slice(0, 16), origBytes: chain.origBytes,
      parent: chain.parentChainId || null, addedBytes: chain.addedBytes === undefined ? null : chain.addedBytes, lexRoot: OW.lexiconOf(obs).root,
      crystalOfLine: BM.crystallize(lineBytes), quat: OW.crystalPoint(lineBytes).quat.map((v) => v.toFixed(4)).join(', '), text: OW.journeyText(obs),
    });
  }
  const dot = (address, dims) => OW.lexiconPoint(address, dims);
  const dotDistance = (address) => OW.hypDist([0, 0, 0, 1], OW.originOf(OW.lexiconFrame(address, '2D')));
  return { OW, BM, epochs, dot, dotDistance, verifyHyperpack: OW.verifyHyperpack };
}

// ─── counting colours on a canvas (runs inside the page) ─────────────────────
// The map is drawn on a canvas, so its content is not text. This counts solid pixels by colour family.
// From station 7 on, the lexicon stays on the map as a faint background; where its faint shapes overlap a few
// pixels pass the bar, so road colours are judged by the change in a count, and the bridge by fully solid gold.
function countColours(sel) {
  const c = document.querySelector(sel); if (!c) return null;
  const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const fam = { gold: [28, 56], green: [140, 176], cyan: [186, 216], violet: [255, 292], rose: [335, 372] };
  const out = { w, h, lit: 0, centreAlpha: d[(Math.floor(h / 2) * w + Math.floor(w / 2)) * 4 + 3] };
  for (const k of [...Object.keys(fam), 'white', 'solidGold']) out[k] = { n: 0, x0: w, y0: h, x1: -1, y1: -1 };
  const add = (o, x, y) => { o.n++; if (x < o.x0) o.x0 = x; if (x > o.x1) o.x1 = x; if (y < o.y0) o.y0 = y; if (y > o.y1) o.y1 = y; };
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    if (d[i + 3] < 110) continue;   // faint glows and the veiled background are not counted
    out.lit++;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), ch = mx - mn;
    if (mx < 0.55) continue;
    if (ch / mx < 0.3) { if (mx > 0.8 && ch / mx < 0.12) add(out.white, x, y); continue; }
    const hue = 60 * (mx === r ? ((g - b) / ch + 6) % 6 : mx === g ? (b - r) / ch + 2 : (r - g) / ch + 4);
    for (const k in fam) if ((hue >= fam[k][0] && hue <= fam[k][1]) || (hue + 360 >= fam[k][0] && hue + 360 <= fam[k][1])) { add(out[k], x, y); if (k === 'gold' && d[i + 3] >= 200) add(out.solidGold, x, y); }
  }
  for (const k of [...Object.keys(fam), 'white', 'solidGold']) { const o = out[k]; o.height = o.n ? (o.y1 - o.y0 + 1) / h : 0; o.width = o.n ? (o.x1 - o.x0 + 1) / w : 0; }
  return out;
}

// ─── one pass at one screen size ─────────────────────────────────────────────
async function pass(browser, vp, EXP, SRC) {
  const R = { viewport: vp.tag, size: `${vp.viewport.width}x${vp.viewport.height}`, completed: false, steps: [], checks: [], consoleErrors: [], pageErrors: [], blockedRequests: [], failedRequests: [],
    downloads: [], dialogs: [], maxOverflow: 0, overflowAt: [], stations: {}, pictures: [], facts: {}, observations: [] };
  const ctx = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: 2, isMobile: vp.touch, hasTouch: vp.touch });
  await kit.refuseOutside(ctx, ORIGIN, { fonts: true, seen: (url) => R.blockedRequests.push(url) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const cdp = await ctx.newCDPSession(page);
  page.on('console', (m) => { if (m.type() === 'error') R.consoleErrors.push({ text: m.text(), url: (m.location() || {}).url || '' }); });
  page.on('pageerror', (e) => R.pageErrors.push(String(e && e.message || e)));
  page.on('requestfailed', (r) => R.failedRequests.push({ url: r.url(), why: (r.failure() || {}).errorText || '' }));
  page.on('download', (d) => R.downloads.push(d.suggestedFilename()));
  page.on('dialog', (d) => { R.dialogs.push(d.type() + ': ' + d.message()); d.dismiss().catch(() => {}); });

  let cur = null;
  const check = (name, expected, actual, ok) => {
    const c = { step: cur.name, name, expected: J(expected), actual: J(actual), pass: !!ok };
    cur.checks.push(c); R.checks.push(c);
    if (!ok) cur.ok = false;
    return RECORD.add({ part: vp.tag, section: cur.name, step: name, expected: c.expected, actual: c.actual, ok: c.pass, group: vp.tag });
  };
  const eq = (name, expected, actual) => check(name, expected, actual, J(expected) === J(actual));
  const observe = (what, evidence) => { R.observations.push({ step: cur ? cur.name : '', what, evidence: J(evidence) }); };
  const has = (name, needle, hay) => check(name, `contains “${needle}”`, hay, String(hay).includes(needle));
  const st = (fn, arg) => page.evaluate(fn, arg);
  const text = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel);
  const press = (loc) => (vp.touch ? loc.tap() : loc.click());
  const button = (name, scope) => (scope || page).getByRole('button', { name, exact: true });
  const frames = (n = 2) => page.evaluate((k) => new Promise((res) => { const f = () => (k-- > 0 ? requestAnimationFrame(f) : res()); f(); }), n);
  const colours = (sel = '#space') => page.evaluate(countColours, sel);
  const snap = () => st(() => {
    const S = window.FirstExplorers.state;
    return { station: S.station, maxStation: S.maxStation, lens: S.lens, dims: S.dims, tab: S.tab, sound: S.sound, busy: S.busy, error: S.error, nObs: S.observations.length,
      lines: S.observations.map((o) => o.line), chainId: S.chain ? S.chain.chainId : null, epoch: S.chain ? S.chain.epoch || 1 : 0, merkleRoot: S.chain ? S.chain.merkleRoot : null,
      packet0: S.chain ? S.chain.stream.slice(0, 16) : null, parent: (S.chain && S.chain.parentChainId) || null, origBytes: S.chain ? S.chain.origBytes : null,
      addedBytes: S.chain && S.chain.addedBytes !== undefined ? S.chain.addedBytes : null, lexicon: S.lexicon ? S.lexicon.entries.map((e) => [e.address, e.sense, e.name, e.obsSha]) : [],
      lexRoot: S.lexicon ? S.lexicon.root : null, lineage: S.lineage.map((r) => [r.epoch, r.chainId, r.merkleRoot]), traceN: S.trace.length, events: S.trace.map((e) => e.event),
      hasCert: !!S.certificate, reportOk: S.report ? S.report.ok : null, dest: S.dest, last: S.last, sending: !!S.send, selected: S.selected, flips: [...S.flips].sort((a, b) => a - b),
      cube: S.cube, sealId: S.sealId, hasKeys: !!S.keys, view: S.view.map((v) => +v.toFixed(6)), flying: !!S.flyTo,
      hands: Object.fromEntries(Object.entries(S.hands).map(([k, h]) => [k, { accepted: h.verdict.ok, refusedAt: h.verdict.failed, handshake: h.result.ok, stoppedAt: h.result.failed, noise: h.noise }])) };
  });
  const overflow = async (where) => {
    const o = await st(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth, iw: window.innerWidth }));
    const over = Math.max(o.sw, o.bw) - vp.viewport.width;
    if (over > R.maxOverflow) R.maxOverflow = over;
    if (over > 0) R.overflowAt.push(`${where}: document is ${Math.max(o.sw, o.bw)} px wide on a ${vp.viewport.width} px screen`);
    return over;
  };
  async function step(name, fn) {
    cur = { name, checks: [], ok: true, t0: Date.now() };
    try { await fn(); }
    catch (e) {
      cur.error = String(e && e.message || e).split('\n').slice(0, 3).join(' | ');
      check('the step ran to its end', 'no script error', cur.error, false);
      R.steps.push({ name, ok: false, ms: Date.now() - cur.t0, checks: cur.checks.length, failed: cur.checks.filter((c) => !c.pass).length, error: cur.error });
      await SHOTS.error(page, `error-${vp.short}.png`);
      throw e;
    }
    const over = await overflow(name);
    check('no sideways overflow after this step', `document no wider than ${vp.viewport.width} px`, over > 0 ? `${over} px too wide` : 'fits', over <= 0);
    R.steps.push({ name, ok: cur.ok, ms: Date.now() - cur.t0, checks: cur.checks.length, failed: cur.checks.filter((c) => !c.pass).length });
    log(`${cur.ok ? '  ok ' : ' FAIL'} [${vp.tag}] ${name} (${cur.checks.length} checks, ${Date.now() - cur.t0} ms)`);
  }

  // ----- pictures -----
  const docBox = (sel) => st((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY }; }, sel);
  async function shot(id, meta, opt = {}) {
    if (opt.only && opt.only !== vp.tag) return;
    if (opt.pane) await st((needle) => {   // desktop: the right-hand panel scrolls inside itself; bring the named section to its top
      const pane = document.getElementById('tabpane'); const h = [...pane.querySelectorAll('h3')].find((e) => e.textContent.includes(needle));
      if (h) pane.scrollTop += h.getBoundingClientRect().top - pane.getBoundingClientRect().top - 6;
    }, opt.pane);
    const file = `fe-${vp.short}-${id}.png`; let how;
    if (vp.tag === 'desktop') {
      await st(() => window.scrollTo(0, 0));
      await page.mouse.move(3, vp.viewport.height - 3);   // park the pointer in a corner, so no button shows its hover look by accident
      if (!opt.live) await frames(3);
      const extra = await st(() => document.documentElement.scrollHeight - window.innerHeight);
      how = extra > 4 ? 'whole page (taller than the 900 px window)' : 'the 1440 x 900 window';
      await SHOTS.take(page, file, { id, viewport: vp.tag, how, ...meta }, { fullPage: extra > 4 });
    } else if (opt.region) {   // phone: a slice of the long single-column page, from one part to another
      const a = opt.region[0] === 'top' ? { top: 0 } : await docBox(opt.region[0]);
      const b = opt.region[1] === 'bottom' ? { bottom: await st(() => document.documentElement.scrollHeight) } : await docBox(opt.region[1]);
      const docH = await st(() => document.documentElement.scrollHeight);
      const y0 = Math.max(0, Math.floor(a.top - 8)), y1 = Math.min(docH, Math.ceil(b.bottom + 8));
      if (!opt.live) await page.waitForTimeout(500);   // a tap leaves a short blue flash on the button; let it fade
      how = `page slice from ${y0} to ${y1} px of ${docH} px, about ${((y1 - y0) / vp.viewport.height).toFixed(1)} phone screens tall`;
      await SHOTS.take(page, file, { id, viewport: vp.tag, how, ...meta }, { fullPage: true, clip: { x: 0, y: y0, width: vp.viewport.width, height: y1 - y0 } });
    } else {
      if (!opt.live) await page.waitForTimeout(500);
      how = 'one 390 x 844 phone screen';
      await SHOTS.take(page, file, { id, viewport: vp.tag, how, ...meta });
    }
    if (opt.pane) await st(() => { document.getElementById('tabpane').scrollTop = 0; });
    if (SHOTS.on) R.pictures.push({ file, id, viewport: vp.tag, how, ...meta });
  }

  // ----- pointer helpers: a mouse on the desktop, a finger on the phone -----
  const tapAt = (x, y) => (vp.touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  async function dragPath(points) {   // points in screen coordinates; one pointer move per animation frame, so none are merged
    if (vp.touch) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points[0][0], y: points[0][1] }] });
      for (const p of points.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0], y: p[1] }] }); await frames(2); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(points[0][0], points[0][1]); await page.mouse.down(); await frames(2);
      for (const p of points.slice(1)) { await page.mouse.move(p[0], p[1]); await frames(2); }
      await page.mouse.up();
    }
    await frames(2);
  }
  async function centred(sel) { await st((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); await frames(2); return page.locator(sel).boundingBox(); }
  async function setSlider(index, target, min, max) {
    const rng = page.locator('#controls input[type=range]').nth(index);
    await st((i) => document.querySelectorAll('#controls input[type=range]')[i].scrollIntoView({ block: 'center' }), index);
    const b = await rng.boundingBox();
    await tapAt(b.x + 8 + ((target - min) / (max - min)) * (b.width - 16), b.y + b.height / 2);   // the thumb is 16 px wide
    let v = Number(await rng.inputValue()), nudges = 0;
    while (v !== target && nudges < 6) { await rng.press(v < target ? 'ArrowRight' : 'ArrowLeft'); v = Number(await rng.inputValue()); nudges++; }
    return { value: v, nudges };
  }
  const stationButton = (n) => page.locator('#stations button').nth(n);
  const goStation = async (n) => { await press(stationButton(n)); await page.waitForFunction((k) => window.FirstExplorers.state.station === k, n); };
  const controls = () => st(() => [...document.querySelectorAll('#controls button, #controls a')].map((b) => b.textContent + (b.disabled ? ' [disabled]' : '')));
  const noteStation = async (n, key) => {   // what the page itself shows at a station: its title, its label in the list, its buttons
    const seen = await st((k) => ({ title: document.getElementById('stationTitle').textContent, list: document.querySelectorAll('#stations button')[k].textContent,
      say: document.getElementById('strixSay').textContent, note: document.getElementById('lensNote').textContent,
      buttons: [...document.querySelectorAll('#controls button, #controls a')].map((b) => b.textContent) }), n);
    R.stations[n] = R.stations[n] || {}; R.stations[n][key] = seen; return seen;
  };
  const arrive = async (n, key = 'arrival') => {
    const seen = await noteStation(n, key);
    eq(`the title reads “${n}. ${STATION_NAMES[n]}”`, `${n}. ${STATION_NAMES[n]}`, seen.title);
    eq(`page state: station ${n}`, n, (await snap()).station);
    eq(`station ${n} is marked as the current one in the list`, 'step', await stationButton(n).getAttribute('aria-current'));
    return seen;
  };

  try {
    // ═══ STATION 0 ═══════════════════════════════════════════════════════════
    await step('Open the page (station 0, Darkness)', async () => {
      await page.goto(PAGE);
      await page.waitForFunction(() => window.FirstExplorers && document.getElementById('stationTitle').textContent.length > 0);
      const s = await snap();
      eq('page state at the start: station 0, nothing unlocked, no key, empty ledger, no observation', { station: 0, maxStation: 0, hasKeys: false, traceN: 0, nObs: 0 },
        { station: s.station, maxStation: s.maxStation, hasKeys: s.hasKeys, traceN: s.traceN, nObs: s.nObs });
      await arrive(0);
      eq('the station list names nine stations, 0 to 8', STATION_NAMES.map((t, i) => i + t), await st(() => [...document.querySelectorAll('#stations button')].map((b) => b.textContent)));
      eq('stations 1 to 8 cannot be opened yet', [false, true, true, true, true, true, true, true, true], await st(() => [...document.querySelectorAll('#stations button')].map((b) => b.disabled)));
      eq('the only button under the narration is “Begin”', ['Begin'], await controls());
      eq('the right-hand panel says the ledger is empty', 'The ledger is empty. Nothing has happened yet.', await text('#tabpane'));
      eq('the counter above the map', '0 observations · epoch 0', await text('#hudLeft'));
      eq('reading level buttons, with their tooltips; “Stargazer” is chosen', ['Stargazer (Ages 6 and up):true', 'Explorer (Ages 12 and up):false', 'Architect (Technical):false'], await st(() => [...document.querySelectorAll('#lensSeg button')].map((b) => `${b.textContent} (${b.title}):${b.getAttribute('aria-pressed')}`)));
      // which fonts the browser really used (the web fonts are refused, so the page falls back to fonts on this computer)
      try {
        await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
        const root = (await cdp.send('DOM.getDocument')).root.nodeId, used = {};
        for (const [k, sel] of [['heading', 'header h1'], ['stationTitle', '#stationTitle'], ['narration', '#strixSay'], ['numbers', '#hudLeft']]) {
          const id = (await cdp.send('DOM.querySelector', { nodeId: root, selector: sel })).nodeId;
          used[k] = (await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id })).fonts.map((f) => f.familyName).join(' + ');
        }
        R.facts.fontsUsed = used; R.facts.fontsAsked = await st(() => ({ heading: getComputedStyle(document.querySelector('header h1')).fontFamily, narration: getComputedStyle(document.getElementById('strixSay')).fontFamily, numbers: getComputedStyle(document.getElementById('hudLeft')).fontFamily }));
        observe('With the web-font request refused, the browser drew the page with fonts installed on this computer.', used);
      } catch (e) { R.facts.fontsUsed = 'could not be read: ' + String(e.message).split('\n')[0]; }
      const c = await colours();
      check('the map is dark: one small dot and nothing else', 'fewer than 700 solid pixels, and the centre pixel is drawn', `${c.lit} solid pixels, centre alpha ${c.centreAlpha}`, c.lit > 0 && c.lit < 700 && c.centreAlpha > 0);
      await shot('01-station-0-darkness', { station: 0, title: 'Station 0: Darkness', level: 'Stargazer',
        caption: vp.tag === 'desktop' ? 'The page as it opens. The map is dark with one dot, “us”. STRIX says it is dark, and the only button is “Begin”. Stations 1 to 8 are greyed out.'
          : 'The whole page at phone width as it opens, top to bottom. Everything is in one column: the header, the dark map with one dot, the station list, STRIX’s words with the “Begin” button, and the empty ledger.' }, { region: ['top', 'bottom'] });
    });

    await step('Press “Begin”', async () => {
      await press(button('Begin'));
      await page.waitForFunction(() => window.FirstExplorers.state.station === 1 && !window.FirstExplorers.state.busy);
      const s = await snap();
      eq('page state: now at station 1, a key exists, the ledger has two entries', { station: 1, maxStation: 1, hasKeys: true, events: ['genesis', 'key.created'] }, { station: s.station, maxStation: s.maxStation, hasKeys: s.hasKeys, events: s.events });
      const jwk = await st(() => { const k = window.FirstExplorers.state.keys.publicJwk; return { kty: k.kty, crv: k.crv, x: k.x, y: k.y }; });
      eq('the key is an ECDSA P-256 public key', { kty: 'EC', crv: 'P-256' }, { kty: jwk.kty, crv: jwk.crv });
      eq('the key’s short name is the fingerprint of the key (worked out again outside the browser)', sealIdOf(jwk), s.sealId);
      has('the ledger panel shows two linked entries', '2 ENTRIES, CHAIN WHOLE', await text('#tabpane'));
      R.facts.sealId = s.sealId;
    });

    // ═══ STATION 1: the first observation, a sound ═══════════════════════════
    await step('Station 1 (A signal): choose a sound', async () => {
      await arrive(1);
      eq('five senses to choose from', ['Sound', 'Light', 'Touch', 'Word', 'Count'], await st(() => [...document.querySelectorAll('.sense-pick[aria-label="Sense"] button')].map((b) => b.textContent)));
      eq('“Sound” is the one chosen at first', 'true', await page.locator('.sense-pick[aria-label="Sense"] button', { hasText: 'Sound' }).getAttribute('aria-pressed'));
      const p = await setSlider(0, 48, 0, 60), l = await setSlider(1, 1500, 100, 2000);
      const d = await st(() => ({ ...window.FirstExplorers.state.draft.sound, labels: [...document.querySelectorAll('#controls label.f span b')].map((b) => b.textContent) }));
      eq('pitch slider moved to step 48 gives 880 Hz (55 Hz doubled four times)', { hz: 880, label: '880 Hz' }, { hz: d.hz, label: d.labels[0] });
      eq('length slider moved to 1500 ms', { ms: 1500, label: '1500 ms' }, { ms: d.ms, label: d.labels[1] });
      R.facts.sliderNudges = (R.facts.sliderNudges || 0) + p.nudges + l.nudges;
      const c = await colours();
      check('the map shows a glowing gold shape (the pitch spiral)', 'more than 300 gold pixels', `${c.gold.n} gold pixels`, c.gold.n > 300);
    });

    await step('Station 1: press “Hear it”, then switch the sound off again', async () => {
      await press(button('Hear it'));
      eq('sound switched on: the header button reads “Sound on”', { sound: true, label: 'Sound on', pressed: 'true' }, { sound: (await snap()).sound, label: await text('#soundBtn'), pressed: await page.locator('#soundBtn').getAttribute('aria-pressed') });
      await press(page.locator('#soundBtn'));
      eq('sound switched off again: the header button reads “Sound off”', { sound: false, label: 'Sound off' }, { sound: (await snap()).sound, label: await text('#soundBtn') });
    });

    await step('Station 1: name the sound “owl call” and press “Observe and record”', async () => {
      await page.locator('#nameInput').fill(JOURNEY[0].typed);
      eq('the name is held as typed', 'owl call', await st(() => window.FirstExplorers.state.draft.name));
      await st(() => window.scrollTo(0, 0));
      await shot('02-station-1-signal-sound', { station: 1, title: 'Station 1: A signal (sound)', level: 'Stargazer',
        caption: 'The visitor chose Sound, set the pitch to 880 Hz and the length to 1500 ms, and typed the name “owl call”. The gold spiral on the map is the shape of that pitch.' }, { only: 'desktop' });
      await press(button('Observe and record'));
      await page.waitForFunction(() => window.FirstExplorers.state.station === 2 && !window.FirstExplorers.state.busy);
      const s = await snap(), E = EXP.epochs[0];
      eq('one observation is recorded, with exactly the expected line', [JOURNEY[0].line], s.lines);
      eq('no error message', '', s.error);
      eq('the chain grown in the page is the one Node grows from the same line', { chainId: E.chainId, merkleRoot: E.merkleRoot, epoch: 1 }, { chainId: s.chainId, merkleRoot: s.merkleRoot, epoch: s.epoch });
      eq('the lexicon gives the sound the address 0.0, with the SHA-256 of its line', [['0.0', 'sound', 'owl call', sha256(JOURNEY[0].line)]], s.lexicon);
      eq('three new ledger entries: observe, chain.grown, chain.sealed', ['genesis', 'key.created', 'observe', 'chain.grown', 'chain.sealed'], s.events);
      const led = await st(() => window.FirstExplorers.state.trace.map((e) => ({ n: e.n, actor: e.actor, event: e.event, detail: e.detail, at: e.at, prev: e.prev, hash: e.hash })));
      const pub = await st(() => window.FirstExplorers.state.keys.publicJwk);
      const sealed = led[4].detail.split('|');
      check('the “chain.sealed” entry is a real signature of the “chain.grown” line (checked outside the browser)', 'signature verifies with this visit’s public key',
        (await verifySignature(pub, led[3].detail, sealed[1])) ? 'verifies' : 'does NOT verify', sealed[0] === s.sealId && await verifySignature(pub, led[3].detail, sealed[1]));
      R.facts.firstChain = s.chainId;
    });

    // ═══ STATION 2 ═══════════════════════════════════════════════════════════
    await step('Station 2 (Measure): the line and its bytes', async () => {
      await arrive(2);
      const line = JOURNEY[0].line, n = Buffer.byteLength(line + '\n');
      eq('the panel shows the line, the byte count and the bytes in hex', { heads: ['The line', `${n} bytes`], codes: [line, hexBytes(line + '\n')] },
        await st(() => ({ heads: [...document.querySelectorAll('#controls h3')].map((e) => e.textContent), codes: [...document.querySelectorAll('#controls code')].map((e) => e.textContent) })));
      eq('the button that moves on', ['Fold it into a shape →'], await controls());
      const c = await colours();
      check('the map shows a ring of gold marks, one per byte', 'more than 600 gold pixels', `${c.gold.n} gold pixels`, c.gold.n > 600);
      await shot('03-station-2-measure', { station: 2, title: 'Station 2: Measure', level: 'Stargazer',
        caption: `After “Observe and record”. The sound is now one line of text, ${line}, and ${n} bytes. The ring of gold marks around the centre has one mark per byte.` }, { only: 'desktop' });
      await press(button('Fold it into a shape →'));
    });

    // ═══ STATION 3 ═══════════════════════════════════════════════════════════
    await step('Station 3 (Shape): the crystal and the address', async () => {
      await arrive(3);
      const E = EXP.epochs[0];
      eq('crystal, address and line hash under the narration', ['Crystal', E.quat, 'Address', '0.0  (sound branch, leaf 0)', 'Line hash', short(sha256(JOURNEY[0].line), 16, 8)],
        await st(() => [...document.querySelectorAll('#controls dl.kv > *')].map((e) => e.textContent)));
      eq('the right-hand panel switched to “Chain”', 'chain', await st(() => document.querySelector('#tabs button[aria-selected="true"]').dataset.tab));
      const c = await colours();
      check('the map shows the gold crystal and the sound’s dot', 'gold pixels present', `${c.gold.n} gold pixels`, c.gold.n > 150);
      await shot('04-station-3-shape', { station: 3, title: 'Station 3: Shape', level: 'Stargazer',
        caption: 'After “Fold it into a shape”. The gold diamond is the crystal: the bytes folded into one direction. The dot named “owl call” is the observation’s place on the map, at address 0.0.' }, { only: 'desktop' });
    });

    await step('Station 3: switch the map to the 3D ball and back', async () => {
      await press(page.locator('#dimSeg button[data-dims="3D"]'));
      eq('page state and hint after “3D ball”', { dims: '3D', hint: 'Drag to turn. Select a dot to fly to it.' }, { dims: (await snap()).dims, hint: await text('#dragHint') });
      eq('the lexicon table now gives three coordinates', ['addr', 'sense', 'name', '3D position'], await st(() => [...document.querySelectorAll('#tabpane table thead th')].map((e) => e.textContent)));
      await press(page.locator('#dimSeg button[data-dims="2D"]'));
      eq('page state and hint after “2D disc”', { dims: '2D', hint: 'Drag to travel. Select a dot to fly to it.' }, { dims: (await snap()).dims, hint: await text('#dragHint') });
      eq('the button that moves on', ['Open the packet →'], await controls());
      await press(button('Open the packet →'));
    });

    // ═══ STATION 4 ═══════════════════════════════════════════════════════════
    const packetView = () => st(() => ({ hex: document.querySelector('#tabpane .hexbig').textContent.replace(/ /g, ''), badge: document.querySelector('#tabpane .badge').textContent,
      bits: [...document.querySelectorAll('#tabpane .bits button')].map((b) => b.textContent).join(''), flipped: [...document.querySelectorAll('#tabpane .bits button.flipped')].map((b) => b.title),
      restore: !!document.querySelector('#tabpane button.btn.ghost'), fields: [...document.querySelectorAll('#tabpane .fields code')].map((e) => e.textContent),
      note: [...document.querySelectorAll('#tabpane > p.note')].map((e) => e.textContent).join(' ') }));
    await step('Station 4 (The packet): 64 bits, parity holds', async () => {
      await arrive(4);
      const E = EXP.epochs[0], v = await packetView(), bytes = [...Buffer.from(JOURNEY[0].line + '\n')], sum = bytes.reduce((a, b) => a + b, 0) & 255;
      eq('the packet shown is the first 64 bits of the chain, as Node computes them', E.packet0, v.hex);
      eq('64 bit squares spell the same word in binary', BigInt('0x' + E.packet0).toString(2).padStart(64, '0'), v.bits);
      eq('the guard verdict', 'PARITY HOLDS', v.badge);
      check('this script’s own parity count agrees', 'parity holds', parityOf(v.hex) ? 'parity holds' : 'parity broken', parityOf(v.hex));
      eq('the fields read back: kind 9, length = bytes of the line, checksum = byte sum', [`form = 9`, `payload16 = ${bytes.length}`, `freq = ${sum >> 3}`, `amp = ${sum & 7}`], [v.fields[0], v.fields[4], v.fields[5], v.fields[6]]);
      has('the note says this one line makes the same word', `This line alone crystallizes to ${E.crystalOfLine}, the same word that opens the chain.`, (await st(() => document.querySelector('#controls .note').textContent)));
      eq('the chain’s packet equals the crystal of the single line', E.crystalOfLine, v.hex);
      await shot('05-station-4-packet', { station: 4, title: 'Station 4: The packet', level: 'Stargazer',
        caption: `After “Open the packet”. The right-hand panel shows the 64 bits of the first packet, ${E.packet0}, coloured by field, and the green verdict “PARITY HOLDS”.` }, { only: 'desktop' });
      R.facts.packet1 = v.hex;
    });

    await step('Station 4: flip one bit and watch the guard', async () => {
      const before = await packetView(), chainBefore = (await snap()).packet0;
      await press(page.locator('#tabpane .bits button[title^="bit 43 "]'));
      const v = await packetView();
      eq('the verdict changes', 'PARITY BROKEN', v.badge);
      eq('the word shown differs from the real one in exactly bit 43', flipBits(before.hex, [43]), v.hex);
      eq('one square is outlined as flipped', ['bit 43 (quat32)'], v.flipped);
      check('a “Restore” button appears', 'Restore button shown', v.restore ? 'shown' : 'missing', v.restore);
      has('the page says this is only a copy', `This is a copy for experimenting. The chain still holds ${chainBefore}.`, v.note);
      eq('the chain itself is unchanged', chainBefore, (await snap()).packet0);
      await shot('06-packet-one-bit-flipped', { station: 4, title: 'One bit flipped: the guard notices', level: 'Stargazer',
        caption: `The visitor pressed bit 43. The square is outlined in white, the word changed to ${v.hex}, and the verdict is now “PARITY BROKEN”. A “Restore” button appeared.` }, { only: 'desktop' });
      R.facts.flipped1 = v.hex;
    });

    await step('Station 4: flip a second bit (an even number of flips)', async () => {
      const real = (await snap()).packet0;
      await press(page.locator('#tabpane .bits button[title^="bit 22 "]'));
      const v = await packetView();
      eq('the word now differs in bits 43 and 22', flipBits(real, [43, 22]), v.hex);
      eq('the one-bit guard alone does not notice two flips (two changes cancel out)', 'PARITY HOLDS', v.badge);
      R.facts.twoFlips = `${v.hex} shows ${v.badge}`;
      observe('With two bits flipped the packet view shows “PARITY HOLDS” again. One guard bit can notice an odd number of changed bits, not an even number.', { shown: v.hex, real: real, verdict: v.badge });
    });

    await step('Station 4: press “Restore”', async () => {
      const real = (await snap()).packet0;
      await press(button('Restore'));
      const v = await packetView();
      eq('the real word is back, parity holds, nothing is outlined, the Restore button is gone', { hex: real, badge: 'PARITY HOLDS', flipped: [], restore: false }, { hex: v.hex, badge: v.badge, flipped: v.flipped, restore: v.restore });
      eq('page state: no flipped bits', [], (await snap()).flips);
    });

    await step('Station 4: look at the bits as a cube, then as a row again', async () => {
      await press(button('Cube 4 × 4 × 4'));
      eq('four layers of sixteen squares', { layers: 4, squares: 64, labels: ['layer 1', 'layer 2', 'layer 3', 'layer 4'] },
        await st(() => ({ layers: document.querySelectorAll('#tabpane .cube > div').length, squares: document.querySelectorAll('#tabpane .cube .bits button').length, labels: [...document.querySelectorAll('#tabpane .cube .note')].map((e) => e.textContent) })));
      has('the cube note', '1 → 4 → 16 → 64', await text('#tabpane'));
      await shot('07-packet-as-a-cube', { station: 4, title: 'The same 64 bits as a cube', level: 'Stargazer', extra: true,
        caption: 'The visitor pressed “Cube 4 × 4 × 4”. The same 64 bits are shown as four layers of sixteen squares.' }, { only: 'desktop' });
      await press(button('Row of 64'));
      eq('back to one row of 64', { cube: 0, row: 64 }, await st(() => ({ cube: document.querySelectorAll('#tabpane .cube').length, row: document.querySelectorAll('#tabpane > .bits button').length })));
      eq('the button that moves on', ['See the chain →'], await controls());
      await press(button('See the chain →'));
    });

    // ═══ STATION 5 ═══════════════════════════════════════════════════════════
    const chainView = () => st(() => ({ kv: [...document.querySelectorAll('#controls dl.kv > *')].map((e) => e.textContent),
      record: Object.fromEntries([...document.querySelectorAll('#tabpane dl.kv dt')].map((dt) => [dt.textContent, dt.nextElementSibling.textContent])),
      lexicon: [...document.querySelectorAll('#tabpane table')[0].querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent)),
      lineage: [...document.querySelectorAll('#tabpane table')[1].querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent)),
      selected: document.querySelector('#tabpane .box') ? [...document.querySelector('#tabpane .box').children].map((e) => e.textContent) : null,
      notes: [...document.querySelectorAll('#tabpane p.note')].map((e) => e.textContent) }));
    await step('Station 5 (The chain): the chain view', async () => {
      await arrive(5);
      const E = EXP.epochs[0], v = await chainView();
      eq('chain name, epoch and root under the narration', ['Chain', E.chainId, 'Epoch', '1', 'Root', short(E.merkleRoot, 16, 8)], v.kv);
      eq('the record: name, epoch, full root and size', { chainId: E.chainId, epoch: '1', merkleRoot: E.merkleRoot, origBytes: String(E.origBytes) }, { chainId: v.record.chainId, epoch: v.record.epoch, merkleRoot: v.record.merkleRoot, origBytes: v.record.origBytes });
      eq('the size is the byte length of the journey text', Buffer.byteLength(JOURNEY[0].line + '\n'), Number(v.record.origBytes));
      eq('lexicon table: one row, the sound at 0.0', ['0.0', 'sound', 'owl call'], v.lexicon[0].slice(0, 3));
      eq('lineage: one epoch with the chain’s name', [['epoch 1', E.chainId, short(E.merkleRoot, 8, 6)]], v.lineage);
      eq('the selected word and its line', ['Selected: owl call', JOURNEY[0].line], v.selected);
      await shot('08-station-5-chain', { station: 5, title: 'Station 5: The chain', level: 'Stargazer',
        caption: `After “See the chain”. The right-hand panel lists the chain record: its name ${E.chainId}, epoch 1, its root hash, the lexicon with one word at address 0.0, and one line of lineage.` }, { only: 'desktop' });
    });

    await step('Station 5: open the “Trace” tab (the ledger)', async () => {
      await press(page.locator('#tabs button[data-tab="trace"]'));
      has('five linked entries', '5 ENTRIES, CHAIN WHOLE', await text('#tabpane .badge'));
      eq('newest entry first', ['chain.sealed', 'chain.grown', 'observe', 'key.created', 'genesis'], await st(() => [...document.querySelectorAll('#tabpane .ledger li b')].map((e) => e.textContent)));
      const led = await st(() => window.FirstExplorers.state.trace.map((e) => ({ n: e.n, actor: e.actor, event: e.event, detail: e.detail, at: e.at, prev: e.prev, hash: e.hash })));
      eq('this script’s own check of the ledger’s hash chain', { ok: true, entries: 5 }, verifyLedger(led));
      check('a “Save” button is offered (it is pressed later, with the whole ledger)', 'present', (await button('Save').count()) === 1 ? 'present' : 'missing', (await button('Save').count()) === 1);
      await press(page.locator('#tabs button[data-tab="chain"]'));
      eq('the button that moves on', ['Call Overwatch →'], await controls());
      await press(button('Call Overwatch →'));
    });

    // ═══ STATION 6 ═══════════════════════════════════════════════════════════
    const overwatchView = () => st(() => {
      const pane = document.getElementById('tabpane'), secs = {};
      for (const h of pane.querySelectorAll('h3')) {
        const box = h.parentElement;
        secs[h.textContent] = { badge: box.querySelector('.badge') ? box.querySelector('.badge').textContent : null,
          rows: [...box.querySelectorAll('ul.checks li')].map((li) => [li.querySelector('b').textContent, li.querySelector('em').textContent, li.querySelector('span').textContent]),
          code: box.querySelector('code') ? box.querySelector('code').textContent : null,
          kv: Object.fromEntries([...box.querySelectorAll('dl.kv dt')].map((dt) => [dt.textContent, dt.nextElementSibling.textContent])),
          note: [...box.querySelectorAll('.note')].map((e) => e.textContent).join(' ') };
      }
      return { secs, plain: [...pane.querySelectorAll(':scope > p.note')].map((e) => e.textContent) };
    });
    const frozenJourney = () => st(() => { const S = window.FirstExplorers.state; return JSON.stringify([S.chain, S.lexicon, S.lineage, S.certificate, S.observations]); });

    async function inspection(nObs, label, picture) {
      const before = await snap();
      await press(button(before.hasCert ? 'Inspect again' : 'Run the inspection'));
      await page.waitForFunction((n) => { const S = window.FirstExplorers.state; return !S.busy && S.certificate && S.trace.length > n; }, before.traceN);
      const s = await snap(), E = EXP.epochs[nObs - 1], v = await overwatchView(), sec = v.secs['Inspection of this journey'];
      eq('page state: the report passes and a certificate exists', { reportOk: true, hasCert: true }, { reportOk: s.reportOk, hasCert: s.hasCert });
      eq('the verdict badge', 'ALL CHECKS PASS', sec.badge);
      eq('ten checks, in order, each with a tick', OVERWATCH_CHECKS.map((n) => '✓ ' + n), sec.rows.map((r) => r[0] + ' ' + r[1]));
      eq('what the meaning, lexicon and lineage checks report', [`${nObs} canonical OBS/1 line${nObs === 1 ? '' : 's'}`, `${nObs} exact address${nObs === 1 ? '' : 'es'}, 2D and 3D`, `${nObs} epoch${nObs === 1 ? '' : 's'} regrown from the text`], [sec.rows[6][2], sec.rows[7][2], sec.rows[8][2]]);
      const cert = await st(() => { const c = window.FirstExplorers.state.certificate; return { format: c.format, commitment: c.commitment, traceHead: c.traceHead, sealId: c.sealId, publicJwk: c.publicJwk, sig: c.sig, issuedAt: c.issuedAt }; });
      const wantLine = ['OVERWATCH/1', E.chainId, E.merkleRoot, String(nObs), E.lexRoot, '2D+3D', cert.traceHead, 'strict+meaning+lexicon+lineage+trace'].join('|');
      eq('the certificate line binds chain, root, epoch, lexicon and ledger (built here from Node’s values)', wantLine, cert.commitment);
      const cs = v.secs['Certificate (OVERWATCH/1)'];
      eq('the certificate box shows that line and who signed it', { line: wantLine, by: `${s.sealId} (this visit's key)`, sig: short(cert.sig, 20, 10) }, { line: cs.code, by: cs.kv['signed by'], sig: cs.kv.signature });
      const good = await verifySignature(cert.publicJwk, cert.commitment, cert.sig), bad = await verifySignature(cert.publicJwk, cert.commitment.replace('|2D+3D|', '|4D|'), cert.sig);
      check('the signature is real: it verifies outside the browser, and fails for a changed line', 'verifies / does not verify for a changed line', `${good ? 'verifies' : 'FAILS'} / ${bad ? 'VERIFIES (wrong)' : 'does not verify'}`, good && !bad && sealIdOf(cert.publicJwk) === cert.sealId);
      eq('the ledger gained “inspection” and “certificate.issued”', ['inspection', 'certificate.issued'], s.events.slice(-2));
      const ctl = await controls();
      eq('buttons now offered', ['Inspect again', 'Send it →', 'Tamper and verify'], ctl);
      eq('the tamper lab lists ten ways to cheat', TAMPER.map((t) => t[0]), await st(() => [...document.querySelectorAll('#tamperSel option')].map((o) => o.textContent)));
      if (picture) await picture();
      R.facts['certificate' + nObs] = `epoch ${nObs}, signed by ${cert.sealId}`;
    }

    async function tamperLab(nObs, pictureAt) {
      for (let i = 0; i < TAMPER.length; i++) {
        const [label, named] = TAMPER[i];
        await step(`Tamper lab, journey of ${nObs}: “${label}”`, async () => {
          const frozen = await frozenJourney(), n0 = (await snap()).traceN, digit15 = await st(() => window.FirstExplorers.state.chain.stream[15]);
          await page.locator('#tamperSel').selectOption(String(i));
          await press(button('Tamper and verify'));
          await page.waitForFunction((n) => window.FirstExplorers.state.trace.length > n && window.FirstExplorers.state.tamper, n0);
          const t = await st(() => { const T = window.FirstExplorers.state.tamper; return { label: T.label, named: T.expected, ok: T.verdict.ok, failed: T.verdict.failed, checks: T.verdict.checks.map((c) => [c.name, c.ok]) }; });
          const v = await overwatchView(), sec = v.secs['Tamper lab: ' + label];
          eq('the lab ran the option that was chosen', label, t.label);
          check('the changed copy is refused', 'refused', t.ok ? 'ACCEPTED' : 'refused at ' + t.failed, t.ok === false);
          eq('the page’s own table names the same check as this script’s table', named, t.named);
          const why = i === 0 ? ` (this option turned hex digit “${digit15}” of the packet into “${digit15 === '0' ? '1' : '0'}”: ${bitsDiffer(digit15, digit15 === '0' ? '1' : '0')} bit(s) changed)` : '';
          check(`it is refused at the check the page names for this option: ${named}`, `refused at ${named}`, `refused at ${t.failed}${t.failed === named ? '' : why}`, t.failed === named);
          eq('the badge on screen names the check that really failed', 'REJECTED AT ' + String(t.failed).toUpperCase(), sec ? sec.badge : 'no tamper section on screen');
          const at = PACKAGE_CHECKS.indexOf(t.failed);
          eq('on screen: ticks before the failed check, a cross on it, dots after it (checks stop at the first failure)',
            PACKAGE_CHECKS.map((n, k) => (k < at ? '✓ ' : k === at ? '✕ ' : '· ') + n), sec ? sec.rows.map((r) => r[0] + ' ' + r[1]) : []);
          check('the real journey is untouched by the experiment', 'chain, lexicon, lineage and certificate identical before and after', (await frozenJourney()) === frozen ? 'identical' : 'CHANGED', (await frozenJourney()) === frozen);
          eq('the ledger records the experiment', `${label}: rejected at ${t.failed}`, await st(() => window.FirstExplorers.state.trace.at(-1).detail));
          R.facts.tamper = R.facts.tamper || {}; (R.facts.tamper[nObs] = R.facts.tamper[nObs] || []).push({ option: label, named, actual: t.failed, digit15: i === 0 ? digit15 : undefined });
          const shownAfter = await st(() => { const x = document.getElementById('tamperSel'); return x.options[x.selectedIndex].textContent; });
          R.facts.tamperSelectShowsAfter = R.facts.tamperSelectShowsAfter || {}; R.facts.tamperSelectShowsAfter[label] = shownAfter;
          if (i === 5 && nObs === 1) observe('After a tamper test the drop-down shows its first option again, not the option that was just tested.', { tested: label, dropDownShows: shownAfter });
          if (pictureAt && pictureAt.index === i) await pictureAt.take(t);
        });
      }
    }

    await step('Station 6 (Overwatch): before the inspection', async () => {
      await arrive(6);
      eq('the right-hand panel says nothing is inspected yet', ['Not inspected yet. Go to station 6 and run the inspection.'], (await overwatchView()).plain);
      eq('the only button', ['Run the inspection'], await controls());
      await shot('09-station-6-overwatch', { station: 6, title: 'Station 6: Overwatch', level: 'Stargazer',
        caption: 'After “Call Overwatch”, before anything is checked. The right-hand panel says “Not inspected yet”, and the gold button reads “Run the inspection”.' }, { only: 'desktop' });
    });

    await step('Station 6: press “Run the inspection” (journey of 1)', async () => {
      await inspection(1, 'first', async () => {
        await noteStation(6, 'afterAction');
        await shot('10-overwatch-all-checks-pass', { station: 6, title: 'Overwatch: all ten checks pass', level: 'Stargazer',
          caption: 'After “Run the inspection”. Ten checks, each with a green tick, under the badge “ALL CHECKS PASS”. Below them is the signed certificate line. The tamper lab and “Send it” are now offered.' }, { only: 'desktop' });
      });
    });

    await tamperLab(1, { index: 5, take: async (t) => {
      await shot('11-tamper-lab-refused', { station: 6, title: 'Tamper lab: a changed copy is refused', level: 'Stargazer',
        caption: `The visitor chose “Rename a word in the lexicon” and pressed “Tamper and verify”. On the right the copy is “REJECTED AT ${String(t.failed).toUpperCase()}”: ticks down to that check, a red cross on it, and the later checks not run. The drop-down on the left has jumped back to its first option, as it does after every test.` },
      { only: 'desktop', pane: 'Tamper lab' });
    } });

    await step('Station 6: press “Inspect again” after the ten experiments', async () => { await inspection(1, 'again'); eq('the tamper result is cleared from the panel', false, Object.keys((await overwatchView()).secs).some((k) => k.startsWith('Tamper lab'))); await press(button('Send it →')); });

    // ═══ STATION 7 ═══════════════════════════════════════════════════════════
    const receiverButton = (city) => page.locator('.sense-pick[aria-label="Receiver"] button', { hasText: city });
    const flight = () => st(() => { const m = window.FirstExplorers.state.send; return m ? { leg: m.leg, to: m.to, noise: m.noise, t: m.t } : null; });

    async function send(c, noise, nObs, pic = {}) {
      const E = EXP.epochs[nObs - 1];
      await press(receiverButton(c.city));
      eq(`“${c.city}” is the chosen receiver`, { pressed: 'true', dest: c.id }, { pressed: await receiverButton(c.city).getAttribute('aria-pressed'), dest: (await snap()).dest });
      const sendLabel = `Send to ${c.city}`;
      check(`the gold button reads “${sendLabel}”`, sendLabel, (await controls()).find((b) => b.startsWith('Send to')), (await button(sendLabel).count()) === 1);
      const n0 = (await snap()).traceN, col0 = await colours();
      await press(button(noise ? 'Send through noise' : sendLabel));
      const wires = await st(() => { const m = window.FirstExplorers.state.send; return m ? { sent: m.sent, wire: m.wire, leg: m.leg, to: m.to, noise: m.noise } : null; });
      check('a package is on its way', `in flight to ${c.id}, ${noise ? 'with' : 'without'} noise`, wires ? `in flight to ${wires.to}, ${wires.noise ? 'with' : 'without'} noise, leg “${wires.leg}”` : 'nothing in flight', !!wires && wires.to === c.id && wires.noise === noise && wires.leg === 'out');
      has('the page says so', 'The package is on its way…', await text('#controls'));
      eq('while it flies, the send buttons and the receiver buttons are switched off', [true, true, true, true, true, true],
        await st(() => [...document.querySelectorAll('.sense-pick[aria-label="Receiver"] button'), ...[...document.querySelectorAll('#controls button')].filter((b) => /^Send /.test(b.textContent))].map((b) => b.disabled)));
      let diff = [];
      for (let i = 0; i < wires.sent.length; i++) if (wires.sent[i] !== wires.wire[i]) diff.push(i);
      const streamAt = wires.sent.indexOf('"stream":"') + 10;
      if (noise) {
        check('noise changed exactly one character, a hex digit inside the first packet of the chain', 'one character differs, at digit 3 to 14 of the stream',
          `${diff.length} character(s) differ` + (diff.length === 1 ? `, digit ${diff[0] - streamAt} of the stream: “${wires.sent[diff[0]]}” became “${wires.wire[diff[0]]}”` : ''),
          diff.length === 1 && wires.sent.length === wires.wire.length && diff[0] - streamAt >= 3 && diff[0] - streamAt <= 14);
      } else check('without noise the text that travels is the text that was sent', 'identical', diff.length ? `${diff.length} character(s) differ` : 'identical', diff.length === 0);
      if (pic.out) {
        await page.waitForFunction(() => { const m = window.FirstExplorers.state.send; return m && m.leg === 'out' && m.t >= 0.45; });
        const a = await flight(), col = await colours();
        check('half-way there, the map shows the travelling package in gold', 'flying out, gold pixels on the map', `${a ? a.leg + ' ' + a.t.toFixed(2) : 'landed'}, ${col.gold.n} gold pixels`, !!a && a.leg === 'out' && col.gold.n > 60);
        if (vp.tag === 'desktop') {
          await pic.out();
          const b = await flight();
          check('the picture was taken while the package was on the road', 'in flight before and after the picture', `before: ${a ? a.leg + ' ' + a.t.toFixed(2) : 'landed'}, after: ${b ? b.leg + ' ' + b.t.toFixed(2) : 'landed'}`, !!a && a.leg === 'out' && !!b);
        }
      }
      await page.waitForFunction(() => { const m = window.FirstExplorers.state.send; return !m || m.leg === 'back'; }, null, { timeout: 15000 });
      const back = await flight();
      if (back) has('then the page says the answer is coming back', 'Their answer is on its way back…', await text('#controls'));
      if (pic.back && back) {
        await page.waitForFunction(() => { const m = window.FirstExplorers.state.send; return !m || (m.leg === 'back' && m.t >= 0.35); });
        const a = await flight(), col = await colours();
        check('half-way back, the map shows the answer in green', 'flying back, green pixels on the map', `${a ? a.leg + ' ' + a.t.toFixed(2) : 'landed'}, ${col.green.n} green pixels`, !!a && a.leg === 'back' && col.green.n > 60);
        if (vp.tag === 'desktop') await pic.back();
      }
      await page.waitForFunction((id) => !window.FirstExplorers.state.send && window.FirstExplorers.state.hands[id], c.id, { timeout: 15000 });
      const h = await st((id) => { const S = window.FirstExplorers.state, x = S.hands[id]; return { verdict: { ok: x.verdict.ok, failed: x.verdict.failed, checks: x.verdict.checks.map((k) => [k.name, k.ok]) },
        result: { ok: x.result.ok, failed: x.result.failed, checks: x.result.checks.map((k) => [k.name, k.ok, k.detail]) }, line: x.answer.line, sealId: x.answer.sealId, jwk: x.answer.publicJwk, sig: x.answer.sig, noise: x.noise, size: x.size, last: S.last, ours: S.sealId }; }, c.id);
      const s = await snap(), v = await overwatchView();
      const nodeVerdict = await EXP.verifyHyperpack(wires.wire);   // the same module, run in Node on the text that travelled
      const verdictSec = v.secs[`${c.city}'s verdict${noise ? ' (one hex digit damaged on the way)' : ''}`], hsSec = v.secs[`Handshake with ${c.city} (HANDSHAKE/1)`];
      eq('the receiver’s answer is signed with its own key, not ours, and the signature is real (checked outside the browser)', { ownKey: true, verifies: true, id: sealIdOf(h.jwk) }, { ownKey: h.sealId !== h.ours, verifies: await verifySignature(h.jwk, h.line, h.sig), id: h.sealId });
      eq('the answer echoes the SHA-256 of the text the receiver read (worked out here from the captured text)', sha256(wires.wire), h.line.split('|')[1]);
      eq('the ledger records: sent, received, answered, and the handshake result', ['package.sent', 'package.received', 'handshake.answered', noise ? 'handshake.failed' : 'handshake.complete'], s.events.slice(n0));
      if (!noise) {
        eq('the receiver accepts: all thirteen checks pass', { ok: true, checks: PACKAGE_CHECKS.map((n) => [n, true]) }, { ok: h.verdict.ok, checks: h.verdict.checks });
        eq('Node, given the same text, also accepts', true, nodeVerdict.ok);
        eq('our side checks the answer: signature, echo, accepted', { ok: true, checks: [['signature', true], ['echo', true], ['accepted', true]] }, { ok: h.result.ok, checks: h.result.checks.map((k) => k.slice(0, 2)) });
        eq('the answer line', `HANDSHAKE/1|${sha256(wires.sent)}|${E.chainId}|accepted|-`, h.line);
        eq('on screen under the receivers', 'HANDSHAKE COMPLETE', await text('#controls .badge'));
        eq(`on screen: ${c.city}’s verdict`, { badge: 'ACCEPTED', size: `${wires.wire.length} characters received`, rows: PACKAGE_CHECKS.map((n) => '✓ ' + n) }, verdictSec ? { badge: verdictSec.badge, size: verdictSec.note, rows: verdictSec.rows.map((r) => r[0] + ' ' + r[1]) } : 'section missing');
        eq('on screen: the handshake box', { line: h.line, by: `${h.sealId} (${c.city}'s key for this visit)`, distance: `${c.distance.toFixed(3)} from our zero point, ${c.distance.toFixed(3)} from theirs`,
          bearing: `we see them at ${c.bearing}° east of north; they see us straight back along the same road`, rows: ['✓ signature', '✓ echo', '✓ accepted'] },
        hsSec ? { line: hsSec.code, by: hsSec.kv['signed by'], distance: hsSec.kv.distance, bearing: hsSec.kv.bearing, rows: hsSec.rows.map((r) => r[0] + ' ' + r[1]) } : 'section missing');
      } else {
        const d = diff[0], bitsChanged = bitsDiffer(wires.sent[d], wires.wire[d]);
        const damaged = wires.wire.slice(streamAt, streamAt + 16), guard = parityOf(damaged);
        check('the receiver refuses the damaged package', 'refused', h.verdict.ok ? 'ACCEPTED' : 'refused at ' + h.verdict.failed, h.verdict.ok === false);
        eq('it is refused at the same check Node stops at for the same text', nodeVerdict.failed, h.verdict.failed);
        check(`the damage changed ${bitsChanged} bit(s): this script’s own parity count says the guard bit ${guard ? 'still holds, so a later check must catch it' : 'is broken, so the parity check must catch it'}`,
          guard ? 'refused at a check after parity' : 'refused at parity', 'refused at ' + h.verdict.failed, guard ? h.verdict.failed !== 'parity' && h.verdict.failed !== 'parse' : h.verdict.failed === 'parity');
        eq('our side: the signature is whole, but the echo shows the receiver read a different text', { ok: false, stoppedAt: 'echo', checks: [['signature', true], ['echo', false], ['accepted', null]] }, { ok: h.result.ok, stoppedAt: h.result.failed, checks: h.result.checks.map((k) => k.slice(0, 2)) });
        eq('the answer line says refused, and where', `HANDSHAKE/1|${sha256(wires.wire)}|${E.chainId}|refused|${h.verdict.failed}`, h.line);
        eq('on screen under the receivers', 'NO HANDSHAKE: ECHO', await text('#controls .badge'));
        const at = PACKAGE_CHECKS.indexOf(h.verdict.failed);
        eq(`on screen: ${c.city}’s verdict`, { badge: 'REFUSED AT ' + String(h.verdict.failed).toUpperCase(), rows: PACKAGE_CHECKS.map((n, k) => (k < at ? '✓ ' : k === at ? '✕ ' : '· ') + n) }, verdictSec ? { badge: verdictSec.badge, rows: verdictSec.rows.map((r) => r[0] + ' ' + r[1]) } : 'section missing');
        eq('on screen: the handshake box', ['✓ signature', '✕ echo', '· accepted'], hsSec ? hsSec.rows.map((r) => r[0] + ' ' + r[1]) : 'section missing');
      }
      await frames(2);
      const col = await colours(), gained = noise ? col.rose.n - col0.rose.n : col.green.n - col0.green.n;
      check(`the road to ${c.city} turned ${noise ? 'red' : 'green'} on the map`, `more than 250 new ${noise ? 'red' : 'green'} pixels`, `${gained} new ${noise ? 'red' : 'green'} pixels`, gained > 250);
      eq('the receiver’s dot in the row of buttons has the same colour', noise ? 'rgb(251, 113, 133)' : 'rgb(52, 211, 153)', await st((city) => getComputedStyle([...document.querySelectorAll('.sense-pick[aria-label="Receiver"] button')].find((b) => b.textContent === city).querySelector('i')).backgroundColor, c.city));
      (R.facts.sends = R.facts.sends || []).push({ journey: nObs, to: c.city, noise, verdict: h.verdict.ok ? 'accepted' : 'refused at ' + h.verdict.failed, handshake: h.result.ok ? 'complete' : 'stopped at ' + h.result.failed,
        characters: wires.wire.length, damage: noise ? `stream digit ${diff[0] - streamAt}: ${wires.sent[diff[0]]}→${wires.wire[diff[0]]}` : null });
      return h;
    }

    await step('Station 7 (Across space): the crossroads', async () => {
      await arrive(7);
      eq('four receivers, Antioch chosen', ['Antioch:true', 'Alexandria:false', 'Athens:false', 'Rome:false'], await st(() => [...document.querySelectorAll('.sense-pick[aria-label="Receiver"] button')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed'))));
      eq('buttons offered (the two Save buttons are pressed later, with the journey of five)', ['Send to Antioch', 'Send through noise', 'Save package', 'Save ledger'], (await controls()).filter((b) => !CITIES.some((c) => c.city === b)));
      eq('station 8 is still locked', true, await stationButton(8).isDisabled());
      has('the legend under the map names the crossroads', 'the crossroads', await text('#legend'));
      observe('The note at station 7 says “go and observe something new”, but station 7 has no button for it. “Observe something new” is on station 8; the station list also leads back to station 1.', { note: await text('#lensNote'), buttonsHere: await controls() });
      const c = await colours();
      check('the map shows the four roads in violet', 'more than 300 violet pixels', `${c.violet.n} violet pixels`, c.violet.n > 300);
      await shot('12-station-7-across-space', { station: 7, title: 'Station 7: Across space', level: 'Stargazer',
        caption: 'After “Send it”. The map now shows four violet roads from “us” to Antioch, Alexandria, Athens and Rome. Antioch is chosen. Nothing has been sent yet.' }, { only: 'desktop' });
    });

    await step('Station 7: send the package to Antioch (journey of 1)', async () => {
      await send(CITIES[0], false, 1);
      const s = await snap();
      eq('a completed handshake unlocks station 8', { maxStation: 8, locked: false }, { maxStation: s.maxStation, locked: await stationButton(8).isDisabled() });
      await noteStation(7, 'afterAction');
      check('the button that moves on appears', 'See the way →', (await controls()).at(-1), (await controls()).includes('See the way →'));
      await press(button('See the way →'));
    });

    // ═══ STATION 8 ═══════════════════════════════════════════════════════════
    const links = async () => {
      const hrefs = await st(() => [...document.querySelectorAll('#controls a.btn'), document.querySelector('header .brand a')].map((a) => [a.textContent, a.href]));
      const out = []; for (const [t, href] of hrefs) out.push(`${t}: ${href.replace(ORIGIN_RE, '')} → ${await httpStatus(href)}`);
      return out;
    };
    const ORIGIN_RE = new RegExp('^' + ORIGIN.replace(/[.]/g, '\\.'));
    await step('Station 8 (The way): first arrival, flat map', async () => {
      await arrive(8);
      eq('the page lists the handshake made so far', 'Hands joined so far: Antioch.', await st(() => document.querySelector('#controls .note').textContent));
      eq('buttons and links offered', ['Turn the map: see the bridge', 'Reach another people', 'Observe something new', 'Meet the STRIX familiar', 'SHD-CCP introduction'], await controls());
      eq('the three links lead to pages that exist on the local server (asked for with HEAD, not opened)',
        ['Meet the STRIX familiar: /Library/Experimental_Systems/Engram_Mind_Eye.html → 200', 'SHD-CCP introduction: /Library/SHD-CCP/SHD-CCP_Introduction.html → 200', 'Owl Academy experimental systems: /Library/Experimental_Systems/index.html → 200'], await links());
      const c = await colours();
      check('flat map: the bridge is only a small gold ring at the centre', 'solid gold present, less than a quarter of the map high', `${c.solidGold.n} solid gold pixels, ${(c.solidGold.height * 100).toFixed(0)} % of the map’s height`, c.solidGold.n > 100 && c.solidGold.height < 0.25);
      await shot('13-station-8-the-way', { station: 8, title: 'Station 8: The way', level: 'Stargazer',
        caption: 'After the first handshake and “See the way”. The flat map shows the green road to Antioch and a small gold ring at the centre, labelled “the bridge, seen end-on”. The page says “Hands joined so far: Antioch.”' }, { only: 'desktop' });
      R.facts.gold2D = +c.solidGold.height.toFixed(3);
    });

    async function turnAndDrag(pics = {}) {
      await press(button('Turn the map: see the bridge'));
      await frames(3);
      const s = await snap(), c = await colours(), home = J(s.view);
      eq('page state after “Turn the map”: the 3D ball', '3D', s.dims);
      has('the legend gains “the bridge”', 'the bridge', await text('#legend'));
      check('the “Turn the map” button is gone in 3D', 'not shown', (await controls()).includes('Turn the map: see the bridge') ? 'still shown' : 'not shown', !(await controls()).includes('Turn the map: see the bridge'));
      check('in the ball the bridge is a long gold line through the centre', 'solid gold line more than 40 % of the map’s height', `${c.solidGold.n} solid gold pixels, ${(c.solidGold.height * 100).toFixed(0)} % of the map’s height`, c.solidGold.height > 0.4);
      R.facts.gold3D = +c.solidGold.height.toFixed(3);
      if (pics.ball) await pics.ball();
      const b = await centred('#space'), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      await dragPath([[cx, cy], [cx + 15, cy + 5], [cx + 35, cy + 12], [cx + 60, cy + 20], [cx + 90, cy + 30], [cx + 120, cy + 38]]);
      const after = await snap();
      check('dragging turns the ball (the view held by the page changes)', 'view differs from the starting view', J(after.view) === home ? 'unchanged' : 'changed', J(after.view) !== home);
      if (pics.turned) await pics.turned();
      await press(button('Return to origin'));
      await frames(2);
      eq('“Return to origin” puts the starting view back', home, J((await snap()).view));
    }

    await step('Station 8: turn the map into the 3D ball, drag it, return', async () => {
      await turnAndDrag();
      await press(page.locator('#dimSeg button[data-dims="2D"]'));
      eq('back to the flat map with “2D disc”', '2D', (await snap()).dims);
      check('the “Turn the map” button is back', 'shown', (await controls()).includes('Turn the map: see the bridge') ? 'shown' : 'missing', (await controls()).includes('Turn the map: see the bridge'));
    });

    // ═══ PART 2: four more observations, one per remaining sense ═════════════
    async function record(k, prepare, picture) {
      const j = JOURNEY[k], E = EXP.epochs[k], P = EXP.epochs[k - 1];
      await press(page.locator('.sense-pick[aria-label="Sense"] button', { hasText: j.button }));
      eq(`“${j.button}” is chosen`, { pressed: 'true', sense: j.sense }, { pressed: await page.locator('.sense-pick[aria-label="Sense"] button', { hasText: j.button }).getAttribute('aria-pressed'), sense: await st(() => window.FirstExplorers.state.draft.sense) });
      await prepare();
      if (j.typed) await page.locator('#nameInput').fill(j.typed);
      else eq('with no name typed, the name box suggests one', j.name, await page.locator('#nameInput').getAttribute('placeholder'));
      if (picture) await picture();
      await press(button('Observe and record'));
      await page.waitForFunction((n) => { const S = window.FirstExplorers.state; return !S.busy && (S.observations.length === n || S.error); }, k + 1);
      const s = await snap();
      eq('no error message', '', s.error);
      eq(`observation ${k + 1} is recorded with exactly the expected line`, j.line, s.lines[k]);
      eq('the page moved to station 2 and shows the new line', { station: 2, line: j.line, bytes: `${Buffer.byteLength(j.line + '\n')} bytes`, hex: hexBytes(j.line + '\n') },
        await st(() => ({ station: window.FirstExplorers.state.station, line: document.querySelectorAll('#controls code')[0].textContent, bytes: document.querySelectorAll('#controls h3')[1].textContent, hex: document.querySelectorAll('#controls code')[1].textContent })));
      eq(`the chain grew by one epoch and points back to the one before (as Node grows it)`, { epoch: k + 1, chainId: E.chainId, merkleRoot: E.merkleRoot, parent: P.chainId, addedBytes: Buffer.byteLength(j.line + '\n') },
        { epoch: s.epoch, chainId: s.chainId, merkleRoot: s.merkleRoot, parent: s.parent, addedBytes: s.addedBytes });
      eq(`the lexicon gives it the address ${j.address}`, [j.address, j.sense, j.name, sha256(j.line)], s.lexicon[k]);
      eq('the old certificate, report and handshakes no longer stand', { hasCert: false, reportOk: null, hands: {} }, { hasCert: s.hasCert, reportOk: s.reportOk, hands: s.hands });
      eq('the counter above the map', `${k + 1} observations · epoch ${k + 1}`, await text('#hudLeft'));
    }

    await step('Station 8: press “Observe something new”, then record a colour (Light)', async () => {
      await press(button('Observe something new'));
      eq('back at station 1', 1, (await snap()).station);
      check('station 1 now also offers “Back to the journey”', 'offered', (await controls()).includes('Back to the journey') ? 'offered' : 'missing', (await controls()).includes('Back to the journey'));
      await press(button('Back to the journey'));
      eq('“Back to the journey” leads to station 2, which still shows the sound’s line', { station: 2, line: JOURNEY[0].line }, { station: (await snap()).station, line: await st(() => document.querySelector('#controls code').textContent) });
      await goStation(1);
      await record(1, async () => {
        await page.locator('#controls input[type=color]').fill('#f59e0b');
        eq('the colour held by the page', '#f59e0b', await st(() => window.FirstExplorers.state.draft.light.hex));
        await frames(3);
        const c = await colours();
        check('the map shows the colour’s shape: a blue line ending in a big amber dot', 'cyan and amber pixels', `${c.cyan.n} cyan, ${c.gold.n} amber pixels`, c.cyan.n > 50 && c.gold.n > 300);
      }, async () => {
        await shot('14-sense-light', { station: 1, title: 'A second sense: light', level: 'Stargazer', extra: true,
          caption: 'Back at station 1 through “Observe something new”. The visitor chose Light, picked an amber colour and typed the name “sunrise”. The map shows the colour as a line from the centre ending in a dot of that colour.' }, { only: 'desktop' });
      });
    });

    await step('Stations 7 and 8 after a new observation: the old certificate and handshake no longer count', async () => {
      await goStation(7);
      has('station 7 asks for a new inspection', 'The journey changed since the last certificate. Run the inspection at station 6 first.', await text('#controls'));
      eq('both send buttons are switched off', ['Send to Antioch [disabled]', 'Send through noise [disabled]'], (await controls()).filter((b) => b.startsWith('Send ')));
      await goStation(8);
      eq('station 8 says no handshake stands', 'No handshake stands for this journey yet. Send it again from station 7.', await st(() => document.querySelector('#controls .note').textContent));
      await goStation(1);
    });

    await step('Station 1: Touch. First try to record with nothing drawn, then draw a wave', async () => {
      await press(page.locator('.sense-pick[aria-label="Sense"] button', { hasText: 'Touch' }));
      await press(button('Observe and record'));
      await frames(2);
      const s0 = await snap();
      eq('with an empty square the page refuses politely and records nothing', { error: 'touch needs a start cell', shown: 'touch needs a start cell', nObs: 2, station: 1 }, { error: s0.error, shown: await text('#controls .err'), nObs: s0.nObs, station: s0.station });
      await record(2, async () => {
        const b = await centred('#touchPad');
        check('the whole drawing square is on screen before drawing', 'inside the screen', `top ${Math.round(b.y)}, bottom ${Math.round(b.y + b.height)} of ${vp.viewport.height}`, b.y >= 0 && b.y + b.height <= vp.viewport.height);
        const STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
        const cells = [TOUCH_START.slice()]; for (const d of TOUCH_PATH) { const m = STEPS[Number(d)], c = cells[cells.length - 1]; cells.push([c[0] + m[0], c[1] + m[1]]); }
        await dragPath(cells.map(([x, y]) => [b.x + ((x + 0.5) / 32) * b.width, b.y + ((y + 0.5) / 32) * b.height]));
        eq(`the stroke drawn with the ${vp.touch ? 'finger' : 'mouse'} is held as start cell and steps`, { at: TOUCH_START, path: TOUCH_PATH }, await st(() => window.FirstExplorers.state.draft.touch));
        const pad = await colours('#touchPad'), c = await colours();
        check('the square shows the stroke in rose', 'rose pixels in the square', `${pad.rose.n} rose pixels`, pad.rose.n > 300);
        check('the map shows the same stroke as a glowing shape', 'rose pixels on the map', `${c.rose.n} rose pixels`, c.rose.n > 200);
      }, async () => {
        await shot('15-sense-touch', { station: 1, title: 'A third sense: touch', level: 'Stargazer', extra: true,
          caption: vp.tag === 'desktop' ? 'The visitor chose Touch and drew one wave in the square with the mouse, then typed the name “wave”. The same stroke glows on the map. With the drawing square the page is taller than the window, so this picture shows the whole page.'
            : 'Touch at phone width. The visitor chose Touch, drew one wave in the square with a finger and typed the name “wave”. The picture shows STRIX’s panel only; the map is above it on the page.' }, { region: ['section[aria-live]', 'section[aria-live]'] });
      });
    });

    await step('Station 1: Word. Look at the Explorer level’s preview line, then record', async () => {
      await goStation(1);
      await record(3, async () => {
        await page.locator('#controls input[type=text]').first().fill('night owl 100%');
        eq('the text held by the page', 'night owl 100%', await st(() => window.FirstExplorers.state.draft.symbol.text));
        await press(page.locator('#lensSeg button[data-lens="1"]'));
        eq('at the Explorer level a preview of the line appears; the percent sign is written as %25', JOURNEY[3].line, await text('#draftLine'));
        eq('the typed text survived the change of reading level', 'night owl 100%', await page.locator('#controls input[type=text]').first().inputValue());
        await press(page.locator('#lensSeg button[data-lens="0"]'));
        eq('at the Stargazer level the preview line is not shown', 0, await page.locator('#draftLine').count());
        await frames(3);
        const c = await colours();
        check('the map shows the word’s shape in violet', 'violet pixels on the map', `${c.violet.n} violet pixels`, c.violet.n > 200);
      }, async () => {
        await shot('16-sense-word', { station: 1, title: 'A fourth sense: a word', level: 'Stargazer', extra: true,
          caption: 'The visitor chose Word and typed “night owl 100%”. No name was typed, so the name box suggests “word 1”. Each letter is one corner of the violet line on the map.' }, { only: 'desktop' });
      });
    });

    await step('Station 1: Count. First a list with a word in it, then the “Primes” button', async () => {
      await goStation(1);
      await press(page.locator('.sense-pick[aria-label="Sense"] button', { hasText: 'Count' }));
      await page.locator('#numInput').fill('1, two, 3');
      await press(button('Observe and record'));
      await frames(2);
      const s0 = await snap();
      eq('a list that is not all whole numbers is refused politely and nothing is recorded', { error: 'term must be a whole number from 0 to 65535', nObs: 4, station: 1 }, { error: s0.error, nObs: s0.nObs, station: s0.station });
      await record(4, async () => {
        await press(button('Primes'));
        eq('the “Primes” button fills in the first eight primes', '2, 3, 5, 7, 11, 13, 17, 19', await page.locator('#numInput').inputValue());
        await frames(3);
        const c = await colours();
        check('the map shows the numbers’ shape in green', 'green pixels on the map', `${c.green.n} green pixels`, c.green.n > 200);
      }, async () => {
        await shot('17-sense-count', { station: 1, title: 'A fifth sense: a count', level: 'Stargazer', extra: true,
          caption: 'The visitor chose Count, pressed “Primes” to fill in 2, 3, 5, 7, 11, 13, 17, 19 and typed the name “primes”. Each number is one corner of the green line on the map.' }, { only: 'desktop' });
      });
      eq('all five senses are now recorded, each as its own observation', JOURNEY.map((j) => j.line), (await snap()).lines);
      R.facts.finalChain = (await snap()).chainId;
    });

    // ----- station 3 with five senses: the reading levels, the ball, flying to a dot -----
    const narration = () => st(() => ({ title: document.getElementById('stationTitle').textContent, say: document.getElementById('strixSay').textContent, note: document.getElementById('lensNote').textContent,
      bridge: document.getElementById('bridgeSay').hidden ? null : document.getElementById('bridgeSay').textContent, lens: window.FirstExplorers.state.lens }));
    await step('Station 3 with five senses: the same view at the three reading levels', async () => {
      await goStation(3);
      eq('the legend under the map names all five senses', 'usSoundLightTouchWordCount', await text('#legend'));
      eq('the lexicon table lists five addresses', JOURNEY.map((j) => [j.address, j.sense, j.name]), (await chainView()).lexicon.map((r) => r.slice(0, 3)));
      const c = await colours();
      check('the map shows five coloured branches', 'gold, cyan, rose, violet and green all present', `gold ${c.gold.n}, cyan ${c.cyan.n}, rose ${c.rose.n}, violet ${c.violet.n}, green ${c.green.n}`, [c.gold.n, c.cyan.n, c.rose.n, c.violet.n, c.green.n].every((n) => n > 60));
      const LV = ['Stargazer', 'Explorer', 'Architect'];
      const capt = [
        'Station 3 after five observations, with “Stargazer” chosen in the header (the button’s tooltip says “Ages 6 and up”). STRIX speaks in short, plain sentences. The map shows five coloured branches, one per sense, and the gold crystal of the latest observation.',
        'The same station and the same map with “Explorer” chosen (tooltip “Ages 12 and up”). STRIX’s words, the note and the gold box are longer and name the ideas: the crystal as a fingerprint, the address as a branch and a leaf.',
        'The same station with “Architect” chosen (tooltip “Technical”). The words now name the functions and formats. At this level the Chain panel on the right also gains a “Recreated text” section at its end, just visible at the bottom.',
      ];
      for (const lens of [0, 1, 2]) {
        await press(page.locator(`#lensSeg button[data-lens="${lens}"]`));
        const n = await narration();
        eq(`${LV[lens]}: STRIX’s words, the note and the gold box are the source file’s text for this level`, { lens, say: SRC[3].say[lens], note: SRC[3].note[lens], bridge: SRC[3].bridge[lens] }, { lens: n.lens, say: n.say, note: n.note, bridge: n.bridge });
        await shot(`${18 + lens}-reading-level-${LV[lens].toLowerCase()}`, { station: 3, title: `Reading level: ${LV[lens]}`, level: LV[lens],
          caption: capt[lens] }, { only: 'desktop' });
        if (lens === 0) await shot('18-station-3-shape', { station: 3, title: 'Station 3 on a phone: Shape', level: 'Stargazer',
          caption: 'Station 3 at phone width after five observations. The map comes first, with five coloured branches and the gold crystal. Below it are the station list and STRIX’s words.' }, { only: 'phone', region: ['.stage', 'section[aria-live]'] });
      }
      await press(page.locator('#lensSeg button[data-lens="0"]'));
    });

    await step('Station 3: tap the dot “sunrise” on the map and fly to it, then return', async () => {
      await st(() => window.scrollTo(0, 0));
      const b = await page.locator('#space').boundingBox(), p = EXP.dot('1.0', '2D'), Rr = b.width / 2 - 14;
      await tapAt(b.x + b.width / 2 + Rr * p[0], b.y + b.width / 2 - Rr * p[1]);
      await page.waitForFunction(() => window.FirstExplorers.state.selected === '1.0');
      await page.waitForFunction(() => !window.FirstExplorers.state.flyTo, null, { timeout: 15000 });
      await frames(3);
      const hud = await text('#hudRight'), d = Number((hud.match(/we are ([0-9.]+) from/) || [])[1]);
      check('the view flew to the dot: “we” are now as far from the centre of the view as the dot is from us', `about ${EXP.dotDistance('1.0').toFixed(2)}`, hud, Math.abs(d - EXP.dotDistance('1.0')) < 0.03);
      eq('the Chain panel shows the selected word and its line', ['Selected: sunrise', JOURNEY[1].line], (await chainView()).selected);
      await press(button('Return to origin'));
      await frames(3);
      eq('“Return to origin” brings us back to the centre', 'we are 0.00 from the centre of the view', await text('#hudRight'));
    });

    await step('Station 3: the five senses in the 3D ball; drag to turn it', async () => {
      await press(page.locator('#dimSeg button[data-dims="3D"]'));
      await frames(3);
      const home = J((await snap()).view);
      await shot('21-lexicon-in-the-3d-ball', { station: 3, title: 'The same lexicon in the 3D ball', level: 'Stargazer', extra: true,
        caption: 'The visitor pressed “3D ball” in the header. The five branches and their dots are the same words at the same addresses, now placed inside a ball instead of on a flat disc. The white dot is “sunrise”, which the visitor tapped just before.' }, { only: 'desktop' });
      const b = await centred('#space'), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      await dragPath([[cx, cy], [cx - 20, cy + 6], [cx - 45, cy + 14], [cx - 70, cy + 20], [cx - 100, cy + 24]]);
      check('dragging turns the ball', 'view changed', J((await snap()).view) === home ? 'unchanged' : 'changed', J((await snap()).view) !== home);
      await press(button('Return to origin'));
      await press(page.locator('#dimSeg button[data-dims="2D"]'));
      eq('back on the flat disc', '2D', (await snap()).dims);
    });

    await step('Station 4 with five observations: the packet folds the whole journey', async () => {
      await goStation(4);
      const E = EXP.epochs[4], v = await packetView();
      eq('the packet shown is the one Node computes for the five-line journey', E.packet0, v.hex);
      eq('its length field is the byte length of all five lines', `payload16 = ${Buffer.byteLength(E.text)}`, v.fields[4]);
      eq('the note under the narration changed', 'With more than one observation, the chain\'s packet folds the whole journey so far, not this line alone.', await st(() => document.querySelector('#controls .note').textContent));
      eq('the guard verdict', 'PARITY HOLDS', v.badge);
      await shot('22-station-4-packet', { station: 4, title: 'Station 4 on a phone: the packet', level: 'Stargazer',
        caption: `Station 4 at phone width after five observations. STRIX’s words come first, then the 64 bits of the packet ${E.packet0} with the verdict “PARITY HOLDS”.` }, { only: 'phone', region: ['section[aria-live]', '.col:last-child .panel'] });
    });

    await step('Station 5 with five observations: five epochs; the Architect level shows the text', async () => {
      await goStation(5);
      const E = EXP.epochs[4], v = await chainView();
      eq('chain name and epoch 5 under the narration', ['Chain', E.chainId, 'Epoch', '5', 'Root', short(E.merkleRoot, 16, 8)], v.kv);
      eq('the record links to its parent, the epoch-4 chain', { parent: EXP.epochs[3].chainId, addedBytes: String(Buffer.byteLength(JOURNEY[4].line + '\n')), origBytes: String(Buffer.byteLength(E.text)) }, { parent: v.record.parent, addedBytes: v.record.addedBytes, origBytes: v.record.origBytes });
      eq('lineage lists five epochs with the names Node computes', EXP.epochs.map((e) => ['epoch ' + e.epoch, e.chainId, short(e.merkleRoot, 8, 6)]), v.lineage);
      await press(page.locator('#lensSeg button[data-lens="2"]'));
      eq('at the Architect level the panel also shows the text recreated from the chain: the five lines', E.text, await st(() => { const h = [...document.querySelectorAll('#tabpane h3')].find((e) => e.textContent === 'Recreated text'); return h ? h.nextElementSibling.textContent : null; }));
      await press(page.locator('#lensSeg button[data-lens="0"]'));
      eq('at the Stargazer level that section is not shown', false, await st(() => [...document.querySelectorAll('#tabpane h3')].some((e) => e.textContent === 'Recreated text')));
    });

    await step('Station 6 with five observations: run the inspection', async () => {
      await goStation(6);
      eq('the button reads “Run the inspection” again', ['Run the inspection'], await controls());
      await inspection(5, 'five', async () => {
        await shot('23-station-6-overwatch', { station: 6, title: 'Station 6 on a phone: Overwatch', level: 'Stargazer',
          caption: 'Station 6 at phone width after “Run the inspection” on the journey of five. Below STRIX’s words: the tamper lab, then ten green ticks under “ALL CHECKS PASS” and the signed certificate.' }, { only: 'phone', region: ['section[aria-live]', '.col:last-child .panel'] });
      });
    });

    await tamperLab(5);

    let base7 = null;
    await step('Station 6: press “Inspect again”, then “Send it”', async () => { await inspection(5, 'again'); await press(button('Send it →')); eq('at station 7', 7, (await snap()).station); await frames(3); base7 = await colours(); });

    // ----- station 7: all four receivers, clean; then through noise; then clean again -----
    for (let i = 0; i < CITIES.length; i++) {
      const c = CITIES[i];
      await step(`Send to ${c.city} (journey of 5)`, async () => {
        await send(c, false, 5, {
          out: i === 1 ? async () => shot('24-package-travelling', { station: 7, title: 'A package on its way', level: 'Stargazer',
            caption: 'The visitor chose Alexandria and pressed “Send to Alexandria”. The gold dot on the road is the package, part of the way there. The page says “The package is on its way…” and the buttons are switched off until it lands. The road to Antioch is already green from the send before.' }, { only: 'desktop', live: true }) : null,
          back: i === 2 ? async () => shot('25-answer-coming-back', { station: 7, title: 'The answer on its way back', level: 'Stargazer', extra: true,
            caption: 'After “Send to Athens”. Athens has checked the package and accepted it. The green dot is its signed answer travelling back to us. The page says “Their answer is on its way back…”.' }, { only: 'desktop', live: true }) : null,
        });
      });
    }

    await step('Station 7: all four receivers have answered', async () => {
      const s = await snap();
      eq('page state: four handshakes, all complete', Object.fromEntries(CITIES.map((c) => [c.id, { accepted: true, refusedAt: null, handshake: true, stoppedAt: null, noise: false }])), s.hands);
      const c = await colours();
      check('all four roads are green and none is red', 'over 2000 new green pixels and no new red ones, compared with the map before sending', `${c.green.n - base7.green.n} new green, ${c.rose.n - base7.rose.n} new red pixels`, c.green.n - base7.green.n > 2000 && Math.abs(c.rose.n - base7.rose.n) < 100);
      await shot('26-all-four-receivers-answered', { station: 7, title: 'All four receivers have answered', level: 'Stargazer',
        caption: 'The visitor sent the package to Antioch, Alexandria, Athens and Rome in turn. All four roads and all four receiver dots are green. The right-hand panel shows Rome’s verdict, “ACCEPTED”, with every check ticked.' },
      { only: 'desktop', pane: "Rome's verdict" });
    });

    await step('Station 7: “Stand where they stand” (Rome), then return', async () => {
      await press(button('Stand where they stand'));
      await page.waitForFunction(() => !window.FirstExplorers.state.flyTo, null, { timeout: 15000 });
      await frames(3);
      const hud = await text('#hudRight'), d = Number((hud.match(/we are ([0-9.]+) from/) || [])[1]);
      check('from Rome’s zero point we are as far away as Rome is from us', `about ${CITIES[3].distance.toFixed(2)}`, hud, Math.abs(d - CITIES[3].distance) < 0.03);
      await press(button('Return to origin'));
      await frames(3);
      eq('back at our own zero point', 'we are 0.00 from the centre of the view', await text('#hudRight'));
    });

    for (let i = 0; i < CITIES.length; i++) {
      const c = CITIES[i];
      await step(`Send to ${c.city} through noise (journey of 5)`, async () => {
        const h = await send(c, true, 5);
        if (i === 1) await shot('27-noisy-package-refused', { station: 7, title: 'A damaged package is refused', level: 'Stargazer',
          caption: `The visitor chose Alexandria and pressed “Send through noise”, which damages one hex digit on the way. On the right, Alexandria’s verdict is “REFUSED AT ${String(h.verdict.failed).toUpperCase()}”. Its road and dot turned red and the page shows “NO HANDSHAKE: ECHO”. Antioch is red too, because it was sent through noise just before. Athens and Rome are still green. The right-hand panel is scrolled to its end.` },
        { only: 'desktop', pane: "Alexandria's verdict" });
      });
    }
    await step('Station 7: after noise, no handshake stands', async () => {
      const s = await snap();
      eq('page state: four refusals', [false, false, false, false], CITIES.map((c) => s.hands[c.id].handshake));
      eq('station 8 stays open (it was unlocked earlier)', false, await stationButton(8).isDisabled());
    });
    for (const c of CITIES) await step(`Send to ${c.city} again, clean (journey of 5)`, async () => { await send(c, false, 5); });

    // ----- the files the page saves -----
    // Presses a "Save" button and returns what was saved: the name the page gave the file, where it is kept, its text.
    async function save(loc) {
      const [d] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), press(loc)]);
      const name = d.suggestedFilename(), file = path.join(SAVED, `${vp.short}-${R.downloads.length}-${name.replace(/[^\w.-]/g, '_')}`);
      await d.saveAs(file);
      return { name, file, text: fs.readFileSync(file, 'utf8') };
    }
    const parsed = (t) => { try { return JSON.parse(t); } catch { return undefined; } };
    const ledgerOfPage = () => st(() => JSON.stringify(window.FirstExplorers.state.trace, null, 1));

    await step('Station 7: “Save package” saves the wire text, and the front door accepts the file as saved', async () => {
      const E = EXP.epochs[4], before = await snap();
      eq('“Save package” is offered and can be pressed', { n: 1, disabled: false }, { n: await button('Save package').count(), disabled: await button('Save package').isDisabled() });
      const got = await save(button('Save package')), pack = parsed(got.text);
      R.facts.savedPackage = { name: got.name, characters: got.text.length };
      eq('the file is named after the chain', `hyperpack-${E.chainId}.json`, got.name);
      eq('the saved text is the wire text: exactly the JSON of its own value, on one line, with no indentation', { json: true, wire: true, lineBreaks: 0, begins: '{"format":"HYPERPACK/1",' },
        { json: pack !== undefined, wire: pack !== undefined && JSON.stringify(pack) === got.text, lineBreaks: got.text.split('\n').length - 1, begins: got.text.slice(0, 24) });
      eq('it is this journey: the chain, the root and the lexicon Node grew, five words, a certificate', { chainId: E.chainId, merkleRoot: E.merkleRoot, lexiconRoot: E.lexRoot, words: 5, lineage: 5, certificate: true },
        pack ? { chainId: pack.chain.chainId, merkleRoot: pack.chain.merkleRoot, lexiconRoot: pack.lexicon.root, words: pack.lexicon.entries.length, lineage: pack.lineage.length, certificate: !!(pack.certificate && pack.certificate.sig) } : null);
      const door = await EXP.OW.readHyperpack(got.text);
      eq('the front door (readHyperpack of scripts/strix-overwatch.js, run in Node) accepts the file as saved: all thirteen checks', { ok: true, failed: null, checks: PACKAGE_CHECKS.map((n) => n + ':true') },
        { ok: door.ok, failed: door.failed, checks: door.checks.map((c) => `${c.name}:${c.ok}`) });
      const indented = await EXP.OW.readHyperpack(JSON.stringify(pack, null, 1));
      eq('the same package written with indentation is refused at the door, so the check above can fail', { ok: false, failed: 'parse', detail: 'not in wire form: the text is not exactly the JSON of its own value' },
        { ok: indented.ok, failed: indented.failed, detail: indented.checks[0].detail });
      eq('saving changed nothing on the page', before, await snap());
      R.saved = got;
    });

    await step('The Lexicon Explorer reads the saved package and names it a First Explorers journey', async () => {
      const got = R.saved, seen = { messages: [], errors: [] };
      const lexCtx = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: 2, isMobile: vp.touch, hasTouch: vp.touch });
      try {
        await kit.refuseOutside(lexCtx, ORIGIN, { fonts: false });
        await kit.routeFonts(lexCtx, 'empty');
        const lex = await lexCtx.newPage();
        lex.setDefaultTimeout(10000);
        lex.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') seen.messages.push(m.type() + ': ' + m.text()); });
        lex.on('pageerror', (e) => seen.errors.push(String(e && e.message || e)));
        await lex.goto(ORIGIN + LEXICON_PATH + '#lens=navigator');
        await lex.waitForFunction(() => window.LexiconExplorer && window.LexiconExplorer.ready);
        await lex.evaluate(() => window.LexiconExplorer.ready);
        has('its load box invites a file made by First Explorers', 'made by this page or by First Explorers', await lex.evaluate(() => (document.querySelector('label[for="loadInput"]') || {}).textContent || ''));
        const summary = lex.locator('#loadBox > summary');
        await summary.scrollIntoViewIfNeeded();
        await (vp.touch ? summary.tap() : summary.click());
        await lex.setInputFiles('#loadInput', got.file);
        await lex.waitForFunction(() => !window.LexiconExplorer.state.busy && document.getElementById('loadOut').childElementCount > 0, null, { timeout: 60000 });
        const out = await lex.evaluate(() => {
          const rows = [...document.querySelectorAll('#loadOut .checks li')], one = (id) => { const e = document.getElementById(id); return e ? e.textContent : null; };
          return { refused: one('loadRefused'), passed: rows.filter((li) => li.className === 'ok').length, notPassed: rows.filter((li) => li.className !== 'ok').map((li) => li.textContent),
            first: rows.length ? rows[0].textContent : null, line: one('loadJourney'), showIt: !!document.getElementById('showItBtn'), lexicon: window.LexiconExplorer.state.lexicon.origin };
        });
        eq('every check passed and the page says what the file is; it is not offered as a lexicon to show', { refused: null, passed: PACKAGE_CHECKS.length, notPassed: [], line: 'This is a First Explorers journey.', showIt: false, lexicon: 'builtin' },
          { refused: out.refused, passed: out.passed, notPassed: out.notPassed, line: out.line, showIt: out.showIt, lexicon: out.lexicon });
        has('the first check it shows is the wire form', 'The text is a package in wire form.', out.first);
        eq('the Lexicon Explorer wrote no console error or warning and threw nothing', { messages: [], errors: [] }, seen);
        R.facts.savedPackage.lexiconExplorer = out.line;
      } finally { await lexCtx.close().catch(() => {}); }
    });

    await step('Station 7: “Save ledger” saves the ledger the page holds, indented as before', async () => {
      const want = await ledgerOfPage(), got = await save(button('Save ledger')), led = parsed(got.text);
      eq('the file’s name', 'first-explorers-trace.json', got.name);
      eq('the saved text is the page’s ledger, one space of indentation per level', { same: true, secondLine: ' {' }, { same: got.text === want, secondLine: got.text.split('\n')[1] });
      eq('this script’s own check of every hash link in the saved file', { ok: true, entries: (await snap()).traceN }, Array.isArray(led) ? verifyLedger(led) : null);
    });

    await step('Station 7: the whole ledger is still one unbroken chain', async () => {
      await press(page.locator('#tabs button[data-tab="trace"]'));
      const led = await st(() => window.FirstExplorers.state.trace.map((e) => ({ n: e.n, actor: e.actor, event: e.event, detail: e.detail, at: e.at, prev: e.prev, hash: e.hash })));
      eq('the page’s badge', `${led.length} ENTRIES, CHAIN WHOLE`, await text('#tabpane .badge'));
      eq('this script’s own check of every hash link', { ok: true, entries: led.length }, verifyLedger(led));
      R.facts.ledgerEntries = led.length;
      const want = await ledgerOfPage(), got = await save(button('Save'));
      eq('the “Save” button of the ledger tab saves the same ledger under the same name', { name: 'first-explorers-trace.json', same: true }, { name: got.name, same: got.text === want });
      await press(page.locator('#tabs button[data-tab="overwatch"]'));
      await press(button('See the way →'));
    });

    // ----- station 8, the end of the road -----
    await step('Station 8 with all four handshakes: the flat map', async () => {
      await arrive(8, 'final');
      eq('the page lists all four', 'Hands joined so far: Antioch, Alexandria, Athens, Rome.', await st(() => document.querySelector('#controls .note').textContent));
      const c = await colours();
      check('four green roads, and the bridge as a small gold ring', 'green roads; solid gold less than a quarter of the map high', `${c.green.n} green pixels; solid gold ${(c.solidGold.height * 100).toFixed(0)} % of the map’s height`, c.green.n > 600 && c.solidGold.n > 100 && c.solidGold.height < 0.25);
      await shot('28-the-way-flat-map', { station: 8, title: 'The way, on the flat map (2D)', level: 'Stargazer',
        caption: 'Station 8 after all four handshakes. On the flat map the four roads are green and the bridge is one small gold ring at the centre, “seen end-on”. The page says “Hands joined so far: Antioch, Alexandria, Athens, Rome.”' }, { only: 'desktop' });
    });

    await step('Station 8: turn the map (3D), drag the ball, return', async () => {
      await turnAndDrag({
        ball: async () => shot('29-the-way-3d-ball', { station: 8, title: 'The way, in the 3D ball', level: 'Stargazer',
          caption: 'The visitor pressed “Turn the map: see the bridge”. The map now lies flat like ground inside a ball, and the bridge is a gold line standing upright through the centre, with “the source” at its top.' },
        { only: 'desktop' }),
        turned: async () => shot('30-the-way-3d-ball-turned', { station: 8, title: 'The ball after dragging it', level: 'Stargazer', extra: true,
          caption: 'The visitor dragged the ball with the mouse. The roads and the gold line turn together, so the bridge can be seen from another side.' }, { only: 'desktop' }),
      });
    });

    await step('Station 8: “Reach another people” leads back to station 7', async () => {
      await press(button('Reach another people'));
      eq('at station 7', 7, (await snap()).station);
      eq('the map is still the 3D ball there', '3D', (await snap()).dims);
      await press(button('See the way →'));
      await press(page.locator('#dimSeg button[data-dims="2D"]'));
      eq('back at station 8, flat map', { station: 8, dims: '2D' }, { station: (await snap()).station, dims: (await snap()).dims });
    });

    // ----- every station at every reading level -----
    for (let n = 0; n <= 8; n++) {
      await step(`Reading levels at station ${n} (${STATION_NAMES[n]})`, async () => {
        await goStation(n);
        const seen = {};
        for (const lens of [1, 2, 0]) {
          await press(page.locator(`#lensSeg button[data-lens="${lens}"]`));
          const v = await narration(); seen[lens] = v;
          const name = ['Stargazer', 'Explorer', 'Architect'][lens];
          eq(`${name}: STRIX’s words are the source file’s text`, SRC[n].say[lens], v.say);
          eq(`${name}: the note is the source file’s text`, SRC[n].note[lens], v.note);
          eq(`${name}: the gold “bridge” box is the source file’s text`, SRC[n].bridge[lens], v.bridge);
          const vis = await st(() => ['strixSay', 'lensNote', 'bridgeSay'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 50 && r.height > 10; }));
          eq(`${name}: all three texts are laid out on the page (not empty, not hidden)`, [true, true, true], vis);
          const over = await overflow(`station ${n}, ${name}`);
          check(`${name}: no sideways overflow`, `document no wider than ${vp.viewport.width} px`, over > 0 ? `${over} px too wide` : 'fits', over <= 0);
        }
        check('the three levels really differ from each other', 'three different texts', `${new Set([seen[0].say, seen[1].say, seen[2].say]).size} different texts, ${seen[0].say.length}/${seen[1].say.length}/${seen[2].say.length} characters`, new Set([seen[0].say, seen[1].say, seen[2].say]).size === 3);
        (R.facts.narrationLengths = R.facts.narrationLengths || []).push([n, seen[0].say.length, seen[1].say.length, seen[2].say.length]);
        if (n === 0) {
          eq('back at station 0 the button now reads “Continue →” instead of “Begin”', ['Continue →'], await controls());
          await noteStation(0, 'later');
          await press(button('Continue →'));
          eq('“Continue →” leads to station 1 and keeps the same key', { station: 1, sealId: R.facts.sealId }, { station: (await snap()).station, sealId: (await snap()).sealId });
        }
      });
    }

    // ----- phone pictures of the last two stations, taken at the end -----
    if (vp.tag === 'phone') await step('Phone pictures of stations 7 and 8', async () => {
      await goStation(7);
      await shot('31-station-7-across-space', { station: 7, title: 'Station 7 on a phone: Across space', level: 'Stargazer',
        caption: 'Station 7 at phone width after all four handshakes. The map with four green roads comes first, then the station list, STRIX’s words and the four receiver buttons with the badge “HANDSHAKE COMPLETE”.' }, { region: ['.stage', 'section[aria-live]'] });
      await goStation(8);
      await press(button('Turn the map: see the bridge'));
      await frames(3);
      await shot('32-station-8-the-way', { station: 8, title: 'Station 8 on a phone: The way', level: 'Stargazer',
        caption: 'Station 8 at phone width after “Turn the map: see the bridge”. The gold line through the centre of the ball is the bridge. Below are the station list and STRIX’s words.' }, { region: ['.stage', 'section[aria-live]'] });
      await press(page.locator('#dimSeg button[data-dims="2D"]'));
      eq('flat map again', '2D', (await snap()).dims);
    });

    // ----- the dialog -----
    const dialogView = () => st(() => {
      const x = document.getElementById('about'), r = x.getBoundingClientRect(), t = x.querySelector('h2').getBoundingClientRect();
      const first = [...x.querySelectorAll('h2, h4, p, li')].find((e) => e.getBoundingClientRect().bottom > r.top + 14);
      return { open: x.open, modal: x.matches(':modal'), h2: x.querySelector('h2').textContent, h4: [...x.querySelectorAll('h4')].map((e) => e.textContent), items: x.querySelectorAll('li').length,
        box: [r.left, r.top, r.right, r.bottom].map(Math.round), inner: x.scrollHeight, shown: x.clientHeight, scrolled: Math.round(x.scrollTop), titleInView: t.top >= r.top && t.bottom <= r.bottom,
        firstInView: first ? first.textContent.slice(0, 60) : '', closeInView: (() => { const c = document.getElementById('aboutClose').getBoundingClientRect(); return c.top >= r.top && c.bottom <= r.bottom; })(),
        focus: document.activeElement ? document.activeElement.id || document.activeElement.tagName : '' };
    });
    await step('Open “What is real here?”', async () => {
      await st(() => window.scrollTo(0, 0));
      await press(page.locator('#aboutBtn'));
      await frames(3);
      const d = await dialogView();
      eq('a dialog opens over the page', { open: true, modal: true, title: 'What is real here, and what is a draft' }, { open: d.open, modal: d.modal, title: d.h2 });
      eq('its four headings', ['Real, and shared with the rest of Owl Academy', 'New in this page: draft 0, not yet specified in an RFC', 'The bridge narrative (the gold boxes)', 'Limits to keep in mind'], d.h4);
      eq('it lists sixteen points', 16, d.items);
      check('the dialog fits inside the screen and scrolls inside itself when it is longer', 'inside the screen', `box ${d.box.join(', ')}; ${d.inner} px of text in a ${d.shown} px tall box`, d.box[0] >= 0 && d.box[1] >= 0 && d.box[2] <= vp.viewport.width && d.box[3] <= vp.viewport.height);
      check('the dialog opens at its beginning, with its title in view', 'not scrolled; the title “What is real here, and what is a draft” in view',
        d.scrolled === 0 && d.titleInView ? 'not scrolled; title in view' : `already scrolled ${d.scrolled} px down, to its end: the title is out of view above. The first thing in view is “${d.firstInView}…”. The keyboard focus is on the “Close” button (${d.focus}).`, d.scrolled === 0 && d.titleInView);
      R.facts.dialog = { textHeight: d.inner, boxHeight: d.shown, opensScrolledBy: d.scrolled, titleInViewOnOpening: d.titleInView, firstInViewOnOpening: d.firstInView, focusOnOpening: d.focus, screenHeight: vp.viewport.height };
      await shot('33-dialog-as-it-opens', { station: null, title: 'The dialog as it first opens', level: 'Stargazer', extra: true,
        caption: `The dialog straight after pressing “What is real here?”. It opens already scrolled ${d.scrolled} px down, to its end, so its title is out of view above. This picture records that fault.` });
    });

    await step('Scroll the dialog back to its top', async () => {
      const b = await page.locator('#about').boundingBox();
      let swipes = 0;
      if (vp.touch) {   // a finger swipe downwards inside the dialog, repeated until its top is reached
        const x = b.x + b.width / 2, pts = []; for (let i = 0; i <= 12; i++) pts.push([x, 200 + (560 * i) / 12]);
        while ((await st(() => document.getElementById('about').scrollTop)) > 0 && swipes < 8) { await dragPath(pts); await page.waitForTimeout(350); swipes++; }
      } else { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.wheel(0, -4000); }
      await page.waitForFunction(() => document.getElementById('about').scrollTop === 0, null, { timeout: 5000 });
      R.facts.dialog.swipesToReachTop = swipes;
      await frames(3);
      const d = await dialogView();
      eq(`after scrolling up with the ${vp.touch ? 'finger' : 'mouse wheel'} the title is in view`, { scrolled: 0, titleInView: true, first: 'What is real here, and what is a draft' }, { scrolled: d.scrolled, titleInView: d.titleInView, first: d.firstInView });
      eq('the first paragraph says nothing is uploaded, stored or published', 'This page is a first-principles introduction. It runs entirely in your browser: nothing is uploaded, stored or published, and no account is needed.', await st(() => document.querySelector('#about > p').textContent));
      R.facts.dialog.closeButtonInViewAtTop = d.closeInView;
      await shot('34-what-is-real-here', { station: null, title: 'The “What is real here?” dialog', level: 'Stargazer',
        caption: vp.tag === 'desktop' ? 'The dialog opened by “What is real here?” in the header, after scrolling it back to its top. It says which parts are real and shared with the rest of Owl Academy, which are a first draft, and what the gold “bridge” boxes are. It scrolls inside itself; its last lines and the “Close” button are below the part shown.'
          : 'The dialog at phone width, after scrolling it back to its top. It is more than two screens long and scrolls inside itself. The “Close” button is at its end.' });
    });

    await step('Close the dialog', async () => {
      if (vp.touch) {
        await page.touchscreen.tap(4, 6);   // a tap on the dark area outside the dialog
        await frames(2);
        R.facts.dialogClosesOnOutsideTap = !(await st(() => document.getElementById('about').open));
        observe('On the phone a tap on the dark area outside the dialog does not close it. The only way out is the “Close” button at the end of the text.', { stillOpenAfterTapOutside: !R.facts.dialogClosesOnOutsideTap, textHeight: R.facts.dialog.textHeight, boxHeight: R.facts.dialog.boxHeight });
      } else {
        await page.keyboard.press('Escape');
        await frames(2);
        eq('the Escape key closes it', false, await st(() => document.getElementById('about').open));
        await press(page.locator('#aboutBtn'));
        eq('it opens again', true, await st(() => document.getElementById('about').open));
      }
      if (await st(() => document.getElementById('about').open)) await press(page.locator('#aboutClose'));
      await frames(2);
      eq('the “Close” button at the end of the dialog closes it', false, await st(() => document.getElementById('about').open));
      eq('the page behind is where we left it', { station: 8, lens: 0 }, { station: (await snap()).station, lens: (await snap()).lens });
    });

    await step('After the whole walkthrough: errors, downloads, overflow', async () => {
      const fontHosts = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
      const realConsole = R.consoleErrors.filter((e) => !fontHosts.test(e.url)), realFailed = R.failedRequests.filter((f) => !fontHosts.test(f.url));
      eq('console errors, leaving out the web-font request this script refuses', [], realConsole);
      eq('errors thrown by the page’s own code', [], R.pageErrors);
      eq('failed requests, leaving out the refused web-font request', [], realFailed);
      eq('requests that would have left this computer: only the page’s web-font stylesheet, and it was refused', ['fonts.googleapis.com'], [...new Set(R.blockedRequests.map((u) => new URL(u).hostname))]);
      eq('files downloaded: the package and the ledger twice, one for each press of a “Save” button, and nothing else', [`hyperpack-${EXP.epochs[4].chainId}.json`, 'first-explorers-trace.json', 'first-explorers-trace.json'], R.downloads);
      eq('pop-up boxes (alert, confirm)', [], R.dialogs);
      eq('the address in the browser never changed', PAGE, page.url());
      check('widest sideways overflow seen at any step', '0 px', `${Math.max(0, R.maxOverflow)} px`, R.maxOverflow <= 0);
      const s = await snap();
      eq('at the end: five observations, epoch 5, four handshakes', { nObs: 5, epoch: 5, hands: 4 }, { nObs: s.nObs, epoch: s.epoch, hands: Object.values(s.hands).filter((h) => h.handshake).length });
    });
    R.completed = true;
  } catch (e) {
    R.fatal = String(e && e.message || e).split('\n').slice(0, 4).join(' | ');
    console.log(`!! [${vp.tag}] stopped: ${R.fatal}`);
  }
  delete R.saved;
  await ctx.close();
  R.stepsTotal = R.steps.length; R.stepsPassed = R.steps.filter((s) => s.ok).length;
  R.checksTotal = R.checks.length; R.checksPassed = R.checks.filter((c) => c.pass).length;
  return R;
}

// ─── run ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await kit.launch(), version = browser.version();
  const EXP = await expectations(), SRC = stationsFromSource();
  log(`journey as Node grows it: ${EXP.epochs.map((e) => e.chainId).join(' → ')}`);
  const VPS = [
    { tag: 'desktop', short: 'desk', viewport: { width: 1440, height: 900 }, touch: false },
    { tag: 'phone', short: 'phone', viewport: { width: 390, height: 844 }, touch: true },
  ].filter((v) => !ONLY || ONLY.includes(v.tag));
  const server = await kit.serve(ROOT);
  ORIGIN = server.base; PAGE = ORIGIN + PAGE_PATH;
  SAVED = kit.tempFolder('first-explorers-walk');
  console.log('First Explorers walkthrough · ' + VPS.map((v) => v.tag).join(', ') + ' · ' + ROOT + ' at ' + ORIGIN + ' · Chromium ' + version);
  const passes = {}, notes = [await kit.fontsDrawn(browser, PAGE)];
  for (const vp of VPS) {
    const t = Date.now();
    const R = await pass(browser, vp, EXP, SRC);
    R.seconds = +((Date.now() - t) / 1000).toFixed(1);
    passes[vp.tag] = R;
    log(`== ${vp.tag}: ${R.completed ? 'completed' : 'NOT completed'}, ${R.stepsPassed}/${R.stepsTotal} steps, ${R.checksPassed}/${R.checksTotal} checks, ${R.seconds} s, ${R.pictures.length} pictures`);
    notes.push(`${vp.tag}: ${R.completed ? 'the walk reached its end' : 'the walk stopped early: ' + R.fatal}, ${R.stepsPassed} of ${R.stepsTotal} steps without a failed check`);
  }
  await browser.close().catch(() => {});
  await server.close();
  if (SHOTS.on) notes.push(SHOTS.list.length + ' pictures in ' + SHOTS.folder);
  for (const R of Object.values(passes)) delete R.checks;   // every check is a row of the record
  kit.leave(kit.finish(RECORD, { opts: OPTS, shots: SHOTS, notes, extra: { root: ROOT, page: PAGE_PATH, chromium: version, passes } }));
})().catch((e) => { console.error('FAIL', e && e.stack || e); process.exit(1); });
