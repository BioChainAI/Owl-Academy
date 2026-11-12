// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
// First Explorers: the page. All logic that can be checked lives in scripts/strix-overwatch.js (tested in
// tests/unit/strix-overwatch.test.mjs); this file is the interface. Every value is written with textContent.
import * as OW from "../../../scripts/strix-overwatch.js";
import { crystallize, recreateText } from "../../../scripts/biomesh-core.js";
import { signPayload, sealIdFromPublic } from "../../../scripts/seal-crypto.js";

const $ = (id) => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const short = (s, a = 10, b = 6) => (s && s.length > a + b + 1 ? s.slice(0, a) + "…" + s.slice(-b) : s);
const utf8 = (s) => [...new TextEncoder().encode(s)];
const hex2 = (b) => b.toString(16).toUpperCase().padStart(2, "0");

const SENSE = {
  sound: { label: "Sound", c: "#fbbf24" }, light: { label: "Light", c: "#38bdf8" }, touch: { label: "Touch", c: "#fb7185" },
  symbol: { label: "Word", c: "#c084fc" }, number: { label: "Count", c: "#34d399" },
};
const FIELD = {
  form: ["#c084fc", "kind of packet (9 = crystal)"], parity: ["#fb7185", "guard bit over the other 63"], spin: ["#94a3b8", "unused in a crystal packet (0)"],
  quat32: ["#38bdf8", "the crystal: four signed bytes"], payload16: ["#fbbf24", "length of the chunk in bytes"],
  freq: ["#34d399", "byte-sum checksum, high 5 bits"], amp: ["#a3e635", "byte-sum checksum, low 3 bits"],
};
const STATIONS = [
  { title: "Darkness", tab: "trace", say: [
    "It is dark. I am STRIX, an owl who has not seen anything yet, just like you. One thing we do know: we are here. That dot is us.",
    "We start with nothing but a position. No stars, no words, no numbers. Everything we come to know has to arrive as a signal and be written down in a way that can be checked.",
    "Empty state: one observer at the origin of hyperbolic space and an empty ledger. Nothing is assumed. Every later claim can be recomputed from what gets recorded."],
    bridge: [
      "Two thousand years ago a boy grew up in Galilee, a name that means “circle”. He watched the same dark sky we are looking at. His people called the One who made it all Father, and so did he. Keep him in mind. He is where this road is going.",
      "This journey points somewhere. Its bridge is a person: Jesus of Nazareth, a Jewish teacher from Galilee. The name Galilee means “circle”. Hold two pictures as we go: a circle, and one point at its centre. By the last station they will be a map of nations and a line of love crossing it.",
      "The gold boxes read Jesus of Nazareth as the bridge between the source of love and the world of nations. The history comes from Pierre van Paassen’s Why Jesus Died (1949): a Galilean Jew in the line of Israel’s prophets, put to death by Rome. The geometric reading is this project’s own. Van Paassen never uses the image."],
    note: [
      "Press Begin and we will open our eyes together.",
      "Beginning makes two things: a ledger that will remember every step, and a signing key that exists only for this visit.",
      "Begin creates an ECDSA P-256 key pair (Web Crypto, not stored) and entry 0 of a TRACE/1 ledger: each entry hashes the one before, so the history cannot be edited quietly."] },
  { title: "A signal", tab: "trace", say: [
    "Something reaches us! Choose how we sense it: a sound, a colour, a touch, a word or a count. Then give it a name so we can remember it.",
    "Each sense has its own natural shape. Pitch winds round a spiral, colour lives inside a solid, a touch is a path. Pick one and watch its shape before we record it.",
    "Five input kinds, each with a native embedding: pitch helix, colour solid, an 8-direction chain code on a 32 by 32 grid, UTF-8 bytes on a 256-gon, golden-angle turns."],
    bridge: [
      "Jesus taught with pictures: a lost sheep, a seed, a lamp. A picture is a signal anybody can catch, whatever language they speak at home.",
      "“Jesus thinks in images,” van Paassen writes. “He does not argue or try to prove anything.” A parable is a signal shaped so that fishermen and farmers receive it whole. Our five senses are five doors for one kind of signal.",
      "Van Paassen’s Jesus speaks Aramaic, knows “not a word” of Greek, and teaches in concrete parables. This station makes a narrower, checkable point: five unlike inputs can be given one shared form. That a picture crosses languages better than an argument is the analogy, and only an analogy."],
    note: [
      "The glowing shape in the dark is what the signal looks like before we write it down.",
      "The preview is only a picture. What we keep is a handful of whole numbers, because whole numbers mean the same thing to everyone.",
      "The preview is display only. What is recorded is integers in fixed ranges: no floating point enters the record."] },
  { title: "Measure", tab: "trace", say: [
    "To remember it exactly, we write it as one careful line. The same thing sensed gives the same line, every time, for anyone.",
    "Measuring means turning the signal into whole numbers and writing them in one agreed way. That line becomes bytes, the one thing any computer anywhere can agree on.",
    "The OBS/1 line: sense, name, integer fields as canonical decimals. One observation has exactly one line, and the line reads back to the observation."],
    bridge: [
      "Jesus said you can tell what someone truly believes by how they live, and by how they treat people who need help. That is a kind of measuring, and everyone can read it.",
      "Van Paassen sums up the parable of the Last Judgment in one line: “The measure of your religion is your life.” A measurement is worth something when anyone can repeat it. A life can be read by all. A private claim cannot.",
      "The line is van Paassen’s paraphrase of Matthew 25, not a verse. The parallel with OBS/1 is one of form: a statement that reads the same to every reader and asks nobody to take the speaker’s word for it."],
    note: [
      "The ring of marks around us is our line, one mark for each letter.",
      "Each mark on the ring is one byte of the line: its position is its place in the line, its length is its value from 0 to 255.",
      "The bytes are the UTF-8 of the line plus a newline. A journey is these lines in order; that text is the only input to everything that follows."] },
  { title: "Shape", tab: "chain", say: [
    "Now the bytes fold into a tiny gem that points one way. And our new word gets its own place on the map.",
    "Two geometries appear. The crystal is a fingerprint: the bytes folded into a rotation. The address is where the observation lives in our lexicon: a branch for its sense, a leaf for itself.",
    "crystalQuat folds the bytes to 32 bits, reads four signed bytes and normalises them to a unit quaternion. The lexicon address sense.index is exact; disc and ball positions derive from it."],
    bridge: [
      "In his town the little streets ran like the spokes of a wheel to the market in the middle, where everyone met. Our map has a middle too, and every road starts from it.",
      "Van Paassen pictures Nazareth’s streets running “like the spokes of a wheel into the hub of the market place”, beside “the highway from Egypt to Damascus”. Hub and spokes: a centre with straight roads leaving it. In our space the straight roads are called geodesics, and the hub is the zero point.",
      "Two loves give two directions. Asked for the supreme law, Jesus quotes the Torah: love the Lord thy God. And he commands his followers to love one another, which van Paassen traces to Israel’s bond of shared “sonship” in “the fatherhood of God”. One source, therefore kin. In the geometry: one axis to the source, and a plane of neighbours at right angles to it."],
    note: [
      "The diamond is the gem. The coloured dot with the name is its home. Tap any dot to fly there.",
      "Hyperbolic space has room for every branch: the further out, the more space there is. Switch between the 2D disc and the 3D ball above. The address stays the same.",
      "The diamond is the quaternion (w, x, y, z) with w ≥ 0 drawn at (x, y, z) / (1 + w). Positions are binary64 and for display only; the address (two integers) is what gets committed."] },
  { title: "The packet", tab: "packet", say: [
    "The gem rides inside a message of 64 lights. One light is a guard: change any light and the guard notices. Try it, tap a light!",
    "An SHD-CCP packet is one 64-bit word: what kind it is, a guard bit, the crystal and the length. Flip any bit and the guard catches it.",
    "The shdccp/2 crystal packet of RFC 07 section 5: form 9, parity at bit 59 over the other 63 bits, the four raw crystal bytes, the chunk length, and the byte-sum checksum in the low 8 bits."],
    bridge: [
      "A small message can carry a great thing. His fits in a breath: love God, and love one another. Small enough to carry anywhere, and plain enough that you notice if someone changes it.",
      "Sixty-four bits, and one stands guard over the rest. Van Paassen says Jesus restated the demands of the Kingdom of God “in unequivocal terms”. A message that plain is hard to bend without someone noticing, which is what the guard bit is for.",
      "The cube view grows the 64 bits out of one point: 1, 4, 16, 64. Whether that is what the wider ecosystem will mean by a 64-bit cubit is not settled: RFC 05’s cubit is an acoustic unit and still an outline. Here the cube is one more way to look at the same word."],
    note: [
      "Bright squares are lights that are on. Tap one to flip it, then put it back.",
      "The packet shown is the real one at the front of our chain. Flipping bits here changes only this picture, never the chain.",
      "This is packet 0 of the journey's stream: crystallize(chunk 0), where chunk 0 is the journey text so far (up to 720 bytes). It changes each time the journey grows."] },
  { title: "The chain", tab: "chain", say: [
    "Each new thing we learn adds a link to our chain. Nobody can sneak a change into an old link, because the whole chain would stop matching.",
    "The journey is grown into a biochain: packets plus a packed copy of the text, hashed into one root. Each observation makes a new epoch that points back to the one before.",
    "growBiochain and extendBiochain from biomesh-core.js, unchanged: 720-byte chunks, rank-coded residuals, leaf hashes, Merkle root, chiral and mirror weaves, the engram layer."],
    bridge: [
      "Jesus did not start from nothing. He learned from the prophets before him, and people after him passed his words on, hand to hand, like the links of our chain.",
      "“Jesus joins hands across the ages with all the pioneers of the spirit,” van Paassen writes: Moses, the Prophets, then him. Each epoch of our chain points back to the one before in the same way. Nothing in it starts from nowhere.",
      "Van Paassen’s title question is about a record being changed. He argues that Pilate “acted alone”, that the Jewish people and authorities “had no interest whatever in seeing Jesus arrested and executed”, and that later tellings fastened “the responsibility and guilt” on them, with centuries of suffering as the result. Historians debate his details. The engineering lesson needs none of them: keep a lineage anyone can regrow and check."],
    note: [
      "The chain's name starts with BC. It is made from everything inside it, so a different journey gets a different name.",
      "The same journey always grows the same chain, on any machine. That is why someone else can check ours by growing it again.",
      "Epoch 1 commits with GROWN/1, later epochs with GROWTH/1 (parent id and root → child id and root). The commitment is signed with this visit's key and written to the ledger."] },
  { title: "Overwatch", tab: "overwatch", say: [
    "Overwatch is me checking our work step by step, taking nothing on trust. If every step passes, I stamp it. Then try to trick me!",
    "Ten checks in order, stopping at the first that fails: six for the chain itself, then meaning, lexicon, lineage and trace. A pass earns a signed certificate.",
    "verifyIntegrityStrict (parity, canonical, crystal, leaves, weaves, derived), then the OBS/1 re-parse, the LEXICON/1 recomputation, every epoch regrown from the text, and the TRACE/1 chain."],
    bridge: [
      "Jesus taught that good things cannot be built in bad ways. You cannot cheat your way to something true. Overwatch works the same: every step has to be honest, or there is no stamp.",
      "“The Kingdom of God could not come by ungodly means. The means must correspond with the goal.” That is how van Paassen states what Jesus held in Jerusalem. Overwatch is the same rule made mechanical: a result counts only if every step that led to it checks out.",
      "The sentence comes from van Paassen’s reconstruction of the last days, in which armed followers try force and Jesus will not have it. That reconstruction leans on Robert Eisler, and few historians accept it now. The principle does not depend on it: the means are part of the result, and that is what a verifier checks."],
    note: [
      "The tamper lab changes a copy of our package in a sneaky way. Watch which check catches it.",
      "The tamper lab never touches the real journey. It changes one thing in a copy and runs the receiver's checks on it.",
      "OVERWATCH/1 is one signed line: chainId, Merkle root, epoch, lexicon root, dims, the ledger head at inspection, and the scope. A receiver rebuilds the line from the evidence before checking the signature."] },
  { title: "Across space", tab: "overwatch", say: [
    "Let's send our discovery to explorers far away. They start in the dark too, but they know the same rules, so they can check everything themselves. Then they answer, and we shake hands.",
    "The package travels the straightest path through hyperbolic space. The receiver repeats every check from the bytes alone and signs an answer. Add noise and watch them refuse it.",
    "HYPERPACK/1 carries chain, lexicon, lineage, trace and certificate as JSON. The receiver runs parse, the ten Overwatch checks, commitment and signature, then signs a HANDSHAKE/1 line: the hash of what it read, and its verdict. We check signature, echo and verdict."],
    bridge: [
      "After Jesus died, the news of him went down the roads: north to Antioch, south to Alexandria, west to Athens and on to Rome. Send our message down the same roads, and let each people check it for themselves.",
      "Lay our zero point over Galilee. The roads run to Antioch of the Syrians, Alexandria of the Egyptians, Athens of the Greeks and Rome, each at its true compass bearing. Athens and Rome lie on one road. Rome ruled them all, and van Paassen still writes that Jesus’ love “embraced the entire human race”, the oppressors too.",
      "Van Paassen’s account of these roads is a hard one. He holds that in Antioch, “that great melting pot of the North”, and the Greek cities beyond, the Galilean prophet was remade into what Theodore Reinach called “a Greek mystery-religion grafted upon a Jewish historical fact”. Most Christians read the same roads as good news arriving. This page takes neither side. It shows what the question is: did what arrived match what was sent? That is the echo check."],
    note: [
      "You can save the package and the ledger as files, then go and observe something new.",
      "Integrity needs no trust in the sender or the path: any damage breaks a check. Who the sender is, is a separate question this page does not answer yet.",
      "The receivers are simulated in this page: the package is serialised, optionally damaged by one hex digit, and verified from that text alone. Each receiver signs its answer with its own key for this visit."] },
  { title: "The way", tab: "overwatch", say: [
    "Look how far our little signal went. We began as one dot in the dark, and now there are roads from us to four great cities, with a hand shaken at the end.",
    "Every receiver has its own zero point. From where they stand, they are the centre and we are far away. The distance between us is the same from either side, and that is what lets two strangers agree.",
    "Each receiver frame is a Lorentz boost of ours. The distance between two zero points is frame-free: the same number from both sides. HANDSHAKE/1 adds the signed echo. RFC 06, the frame-free alignment handshake, is still an outline; this is not it."],
    bridge: [
      "Here is the secret of the map. From above, the bridge is one tiny point: the place where we stand. Turn the map and the point becomes a shining line through the middle of every road. Love comes along that line from its source and goes out along all the roads, to friends and to enemies too. That is the way this story points.",
      "On the flat map of peoples the bridge hides in a single point. In the ball it is a line through that point, at right angles to every road at once: the one direction that belongs to no nation and touches them all. We read Jesus as that line: love from its source, meeting the whole landscape at the zero point. Van Paassen names where the roads then lead: “towards one world and one mankind.”",
      "Plainly: this is an interpretation, and it is ours. Van Paassen’s Jesus is a Jewish prophet, “an announcer and trail blazer of the idea of the community of mankind”; he would not have drawn this figure, and he rejects much that the churches teach. What the geometry itself establishes is small and exact: a geodesic at right angles to a plane projects to one point of it, and two zero points are the same distance apart from either side. The rest is the way we choose to point. His book ends: “It stands before the door! Open that door!”"],
    note: [
      "Press the gold button to turn the flat map and look at it from the side.",
      "In the flat map, the line that crosses it at right angles is hidden inside one point: the zero point. Turn the map into the ball and the point turns out to be a line.",
      "The 2D disc is the plane z = 0 of the 3D ball. The geodesic through the origin along z is perpendicular to that plane, so in the disc view it projects to a single point. Display geometry only: nothing here is committed."] },
];
const TAMPERS = [
  ["Flip one bit of a packet", "parity", (p) => { p.chain.stream = swapHex(p.chain.stream, 15); }],
  ["Change the packed text", "canonical", (p) => { p.chain.stream = p.chain.stream.slice(0, -1) + swapHex(p.chain.stream.slice(-1), 0); }],
  ["Change a leaf hash", "leaves", (p) => { p.chain.leafHashes[0] = swapHex(p.chain.leafHashes[0], 3); }],
  ["Rename the chain", "weaves", (p) => { p.chain.chainId = "BC-" + "0".repeat(24); }],
  ["Miscount the engrams", "derived", (p) => { p.chain.engramCount += 1; }],
  ["Rename a word in the lexicon", "lexicon", (p) => { p.lexicon.entries[0].name = "forged"; }],
  ["Swap an ancestor epoch", "lineage", (p) => { p.lineage[0].chainId = "BC-" + "f".repeat(24); }],
  ["Rewrite a ledger entry", "trace", (p) => { p.trace[1].detail = "nothing happened"; }],
  ["Change the certificate's line", "commitment", (p) => { p.certificate.commitment = p.certificate.commitment.replace("|2D+3D|", "|4D|"); }],
  ["Forge the signature", "signature", (p) => { p.certificate.sig = swapHex(p.certificate.sig, 10); }],
];
function swapHex(s, i) { return s.slice(0, i) + (s[i] === "0" ? "1" : "0") + s.slice(i + 1); }

// ─── state ───────────────────────────────────────────────────────────────────
const S = {
  lens: 0, dims: "2D", station: 0, maxStation: 0, tab: "trace", sound: false,
  keys: null, sealId: null, trace: [], observations: [], chain: null, lineage: [], lexicon: null,
  certificate: null, report: null, tamper: null, busy: false, error: "",
  dest: OW.CROSSROADS[0].id, rxKeys: {}, hands: {}, last: null, cube: false,
  draft: { sense: "sound", name: "", sound: { hz: 432, ms: 600 }, light: { hex: "#38bdf8" }, touch: { at: null, path: "" }, symbol: { text: "owl" }, number: { text: "1, 1, 2, 3, 5, 8" } },
  flips: new Set(), selected: null, view: OW.IDENT.slice(), flyTo: null, send: null,
};
const latest = () => S.observations[S.observations.length - 1] || null;
const log = (actor, event, detail) => OW.traceAppend(S.trace, actor, event, detail);
const bundle = () => ({ chain: S.chain, lexicon: S.lexicon, lineage: S.lineage, trace: S.trace });

function draftInput() {
  const d = S.draft;
  if (d.sense === "sound") return { ...d.sound };
  if (d.sense === "light") { const v = parseInt(d.light.hex.slice(1), 16); return { r: v >> 16, g: (v >> 8) & 255, b: v & 255 }; }
  if (d.sense === "touch") return { at: d.touch.at, path: d.touch.path };
  if (d.sense === "symbol") return { text: d.symbol.text };
  const parts = d.number.text.split(",").map((s) => s.trim()).filter((s) => s.length);
  return { seq: parts.map((s) => (/^\d+$/.test(s) ? Number(s) : NaN)) };
}
function defaultName() {
  const d = S.draft, n = S.observations.filter((o) => o.sense === d.sense).length + 1;
  return d.sense === "sound" ? `tone ${d.sound.hz}` : `${SENSE[d.sense].label.toLowerCase()} ${n}`;
}
function draftObservation() {
  try { return OW.makeObservation(S.draft.sense, draftInput(), S.draft.name.trim() || defaultName()); } catch { return null; }
}

// ─── actions ─────────────────────────────────────────────────────────────────
async function begin() {
  S.busy = true; render();
  S.keys = await OW.newSessionKeys();
  S.sealId = await sealIdFromPublic(S.keys.publicJwk);
  log("system", "genesis", "an observer at the origin; nothing known");
  log("system", "key.created", `${S.sealId} (ECDSA P-256, this visit only)`);
  S.busy = false; chime(220); go(1, true);
}
async function observe() {
  S.error = "";
  let obs;
  try {
    if (S.observations.length >= OW.MAX_OBSERVATIONS) throw new Error(`a journey holds at most ${OW.MAX_OBSERVATIONS} observations`);
    obs = OW.makeObservation(S.draft.sense, draftInput(), S.draft.name.trim() || defaultName());
    if (utf8(OW.journeyText([...S.observations, obs])).length > 60000) throw new Error("the journey is full");
  } catch (e) { S.error = e.message; render(); return; }
  S.busy = true; render();
  try {
    log("human", "observe", obs.line);
    const chain = await OW.growJourney(S.chain, obs);
    const commitment = OW.epochCommitment(chain);
    log("strix", "chain.grown", commitment);
    log("strix", "chain.sealed", `${S.sealId}|${await signPayload(S.keys.privateJwk, commitment)}`);
    S.chain = chain; S.observations.push(obs); S.lineage.push(OW.lineageRow(chain)); S.lexicon = OW.lexiconOf(S.observations);
    S.certificate = null; S.report = null; S.tamper = null; S.hands = {}; S.last = null; S.flips.clear();
    S.selected = S.lexicon.entries[S.lexicon.entries.length - 1].address;
    S.draft.name = ""; S.draft.touch = { at: null, path: "" };
    if (obs.sense === "sound") tone(obs.hz, obs.ms); else chime(330);
  } catch (e) { S.error = e.message; }
  S.busy = false; go(2, true);
}
async function inspect() {
  S.busy = true; S.tamper = null; render();
  const { certificate, report } = await OW.issueCertificate(bundle(), S.keys);
  log("overwatch", "inspection", report.ok ? "all ten checks pass" : "failed at " + report.failed);
  if (certificate) log("overwatch", "certificate.issued", certificate.commitment);
  S.certificate = certificate; S.report = report; S.hands = {}; S.last = null; S.busy = false;
  chime(report.ok ? 528 : 110); render();
}
const pack = () => OW.makeHyperpack({ ...bundle(), certificate: S.certificate });
async function runTamper(index) {
  const [label, expected, change] = TAMPERS[index];
  const p = pack(); change(p);
  const verdict = await OW.verifyHyperpack(JSON.stringify(p));
  S.tamper = { label, expected, verdict };
  log("overwatch", "tamper.test", `${label}: ${verdict.ok ? "accepted" : "rejected at " + verdict.failed}`);
  chime(verdict.ok ? 528 : 150); render();
}
const place = (id) => OW.CROSSROADS.find((c) => c.id === id);
function transmit(noise) {
  if (S.send || !S.certificate) return;
  const to = S.dest, sent = JSON.stringify(pack());
  let wire = sent;
  log("human", "package.sent", `HYPERPACK/1, ${sent.length} characters, to ${place(to).city}${noise ? ", through noise" : ""}`);
  if (noise) wire = swapHex(sent, sent.indexOf('"stream":"') + 13 + (S.trace.length * 7) % 12);
  S.send = { t: 0, leg: "out", to, sent, wire, noise };
  S.last = null; S.flyTo = null; S.view = homeView();
  chime(392); render();
}
async function arrive() {
  const m = S.send;
  S.rxKeys[m.to] = S.rxKeys[m.to] || await OW.newSessionKeys();
  const { verdict, answer } = await OW.answerHyperpack(m.wire, S.rxKeys[m.to]);
  log("overwatch", "package.received", `${place(m.to).city}: ${verdict.ok ? "accepted, every check repeated" : "refused at " + verdict.failed}`);
  log("overwatch", "handshake.answered", answer.line);
  Object.assign(m, { verdict, answer, leg: "back", t: 0, done: false });
  chime(verdict.ok ? 660 : 130); render();
}
async function complete() {
  const m = S.send, result = await OW.verifyAnswer(m.answer, m.sent);
  S.hands[m.to] = { verdict: m.verdict, answer: m.answer, result, noise: m.noise, size: m.wire.length };
  S.last = m.to; S.send = null;
  log("human", result.ok ? "handshake.complete" : "handshake.failed", `${place(m.to).city}: ${result.ok ? "signature, echo and verdict all hold" : "stopped at " + result.failed}`);
  if (result.ok) S.maxStation = Math.max(S.maxStation, 8);
  chime(result.ok ? 792 : 120); render();
}
function download(name, value) {
  const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(value, null, 1)], { type: "application/json" })), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function go(n, unlock) {
  if (unlock) S.maxStation = Math.max(S.maxStation, n);
  if (n > S.maxStation) return;
  const sceneChanges = (n >= 7) !== (S.station >= 7);
  S.station = n;
  if (sceneChanges && !S.send) { S.flyTo = null; S.view = homeView(); } S.tab = STATIONS[n].tab; S.error = "";
  render();
}

// ─── sound ───────────────────────────────────────────────────────────────────
let audio = null;
function tone(hz, ms, vol = 0.12) {
  if (!S.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime, d = ms / 1000;
    o.frequency.value = hz; o.type = "sine";
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + d + 0.05);
  } catch { /* no audio available */ }
}
const chime = (hz) => tone(hz, 260, 0.06);

// ─── left panel ──────────────────────────────────────────────────────────────
function renderStations() {
  $("stations").replaceChildren(...STATIONS.map((st, i) => h("li", null, h("button", {
    "aria-current": i === S.station ? "step" : null, class: i < S.maxStation ? "done" : "", disabled: i > S.maxStation,
    onclick: () => go(i),
  }, h("b", null, String(i)), st.title))));
}
function nextBtn(label = "Next") { return h("button", { class: "btn", onclick: () => go(S.station + 1, true) }, label + " →"); }
function slider(label, value, min, max, step, shown, oninput) {
  const out = h("b", null, shown());
  return h("label", { class: "f" }, h("span", null, label, out),
    h("input", { type: "range", min, max, step, value, oninput: (e) => { oninput(Number(e.target.value)); out.textContent = shown(); refreshDraft(); } }));
}
function refreshDraft() {
  const o = draftObservation(), el = $("draftLine");
  if (el) el.textContent = o ? o.line : "not a valid observation yet";
  const nm = $("nameInput"); if (nm) nm.placeholder = defaultName();
}
function senseControls() {
  const d = S.draft;
  if (d.sense === "sound") return [
    slider("Pitch (Hz)", Math.round(Math.log2(d.sound.hz / 55) * 12), 0, 60, 1, () => `${d.sound.hz} Hz`, (v) => { d.sound.hz = Math.round(55 * 2 ** (v / 12)); }),
    slider("Length (ms)", d.sound.ms, 100, 2000, 50, () => `${d.sound.ms} ms`, (v) => { d.sound.ms = v; }),
    h("div", { class: "row" }, h("button", { class: "btn ghost", onclick: () => { if (!S.sound) toggleSound(); tone(d.sound.hz, d.sound.ms); } }, "Hear it")),
  ];
  if (d.sense === "light") return [h("label", { class: "f" }, h("span", null, "Colour"), h("input", { type: "color", value: d.light.hex, oninput: (e) => { d.light.hex = e.target.value; refreshDraft(); } }))];
  if (d.sense === "symbol") return [h("label", { class: "f" }, h("span", null, "A word or a short phrase"), h("input", { type: "text", maxlength: 120, value: d.symbol.text, oninput: (e) => { d.symbol.text = e.target.value; refreshDraft(); } }))];
  if (d.sense === "number") return [
    h("label", { class: "f" }, h("span", null, "Whole numbers 0 to 65535, with commas (up to 16)"), h("input", { type: "text", id: "numInput", value: d.number.text, oninput: (e) => { d.number.text = e.target.value; refreshDraft(); } })),
    h("div", { class: "row" }, ...[["Counting", "1, 2, 3, 4, 5, 6, 7, 8"], ["Primes", "2, 3, 5, 7, 11, 13, 17, 19"], ["Squares", "1, 4, 9, 16, 25, 36, 49"]].map(([l, v]) =>
      h("button", { class: "btn ghost", onclick: () => { d.number.text = v; $("numInput").value = v; refreshDraft(); } }, l))),
  ];
  const pad = h("canvas", { id: "touchPad", width: 224, height: 224, "aria-label": "Touch pad: draw one stroke" });
  queueMicrotask(() => wireTouchPad(pad));
  return [h("span", { class: "note" }, "Draw one stroke in the square."), pad,
    h("div", { class: "row" }, h("button", { class: "btn ghost", onclick: () => { d.touch = { at: null, path: "" }; drawTouchPad(pad); refreshDraft(); } }, "Clear"))];
}
function wireTouchPad(pad) {
  const cell = (e) => { const r = pad.getBoundingClientRect(); const c = (v) => Math.max(0, Math.min(OW.TOUCH_GRID - 1, Math.floor(v * OW.TOUCH_GRID))); return [c((e.clientX - r.left) / r.width), c((e.clientY - r.top) / r.height)]; };
  let down = false, cur = null;
  pad.addEventListener("pointerdown", (e) => { down = true; pad.setPointerCapture(e.pointerId); cur = cell(e); S.draft.touch = { at: cur.slice(), path: "" }; drawTouchPad(pad); refreshDraft(); });
  pad.addEventListener("pointermove", (e) => {
    if (!down) return;
    const to = cell(e), t = S.draft.touch;
    while ((cur[0] !== to[0] || cur[1] !== to[1]) && t.path.length < OW.TOUCH_MAX_STEPS) {
      const dx = Math.sign(to[0] - cur[0]), dy = Math.sign(to[1] - cur[1]);
      t.path += OW.TOUCH_STEPS.findIndex((s) => s[0] === dx && s[1] === dy);
      cur = [cur[0] + dx, cur[1] + dy];
    }
    drawTouchPad(pad); refreshDraft();
  });
  const up = () => { down = false; };
  pad.addEventListener("pointerup", up); pad.addEventListener("pointercancel", up);
  drawTouchPad(pad);
}
function drawTouchPad(pad) {
  const g = pad.getContext("2d"), k = pad.width / OW.TOUCH_GRID, t = S.draft.touch;
  g.clearRect(0, 0, pad.width, pad.height);
  g.fillStyle = "rgba(148,163,184,.12)";
  for (let i = 0; i < OW.TOUCH_GRID; i += 4) for (let j = 0; j < OW.TOUCH_GRID; j += 4) g.fillRect(i * k + k / 2 - 1, j * k + k / 2 - 1, 2, 2);
  if (!t.at) return;
  g.fillStyle = SENSE.touch.c;
  for (const [x, y] of OW.touchCells(t.at, t.path)) g.fillRect(x * k + 1, y * k + 1, k - 2, k - 2);
}
function controlsFor(n) {
  const o = latest();
  if (n === 0) return [h("div", { class: "row" }, h("button", { class: "btn gold", disabled: S.busy, onclick: S.keys ? () => go(1, true) : begin }, S.keys ? "Continue →" : "Begin"))];
  if (n === 1) {
    return [
      h("div", { class: "sense-pick", role: "group", "aria-label": "Sense" }, ...OW.SENSES.map((s) =>
        h("button", { "aria-pressed": String(S.draft.sense === s), style: `--c:${SENSE[s].c}`, onclick: () => { S.draft.sense = s; S.error = ""; render(); } }, h("i"), SENSE[s].label))),
      ...senseControls(),
      h("label", { class: "f" }, h("span", null, "Name it (optional)"), h("input", { type: "text", id: "nameInput", maxlength: 24, value: S.draft.name, placeholder: defaultName(), oninput: (e) => { S.draft.name = e.target.value; refreshDraft(); } })),
      S.lens > 0 && h("code", { id: "draftLine" }, (draftObservation() || { line: "not a valid observation yet" }).line),
      h("div", { class: "err" }, S.error),
      h("div", { class: "row" }, h("button", { class: "btn gold", disabled: S.busy, onclick: observe }, S.busy ? "Recording…" : "Observe and record"),
        S.observations.length > 0 && h("button", { class: "btn ghost", onclick: () => go(Math.min(S.maxStation, 2)) }, "Back to the journey")),
    ];
  }
  if (!o) return [];
  const bytes = utf8(o.line + "\n");
  if (n === 2) return [
    h("h3", null, "The line"), h("code", null, o.line),
    h("h3", { style: "margin-top:6px" }, `${bytes.length} bytes`), h("code", null, bytes.map(hex2).join(" ")),
    h("div", { class: "row" }, nextBtn("Fold it into a shape")),
  ];
  if (n === 3) {
    const c = OW.crystalPoint(bytes), e = S.lexicon.entries[S.lexicon.entries.length - 1];
    return [
      h("dl", { class: "kv" },
        h("dt", null, "Crystal"), h("dd", null, c.quat.map((v) => v.toFixed(4)).join(", ")),
        h("dt", null, "Address"), h("dd", null, `${e.address}  (${SENSE[e.sense].label.toLowerCase()} branch, leaf ${e.address.split(".")[1]})`),
        h("dt", null, "Line hash"), h("dd", null, short(e.obsSha, 16, 8))),
      h("div", { class: "row" }, nextBtn("Open the packet")),
    ];
  }
  if (n === 4) return [
    h("span", { class: "note" }, S.observations.length > 1
      ? "With more than one observation, the chain's packet folds the whole journey so far, not this line alone."
      : `This line alone crystallizes to ${crystallize(bytes)}, the same word that opens the chain.`),
    h("div", { class: "row" }, nextBtn("See the chain")),
  ];
  if (n === 5) return [
    h("dl", { class: "kv" }, h("dt", null, "Chain"), h("dd", null, S.chain.chainId), h("dt", null, "Epoch"), h("dd", null, String(S.chain.epoch || 1)),
      h("dt", null, "Root"), h("dd", null, short(S.chain.merkleRoot, 16, 8))),
    h("div", { class: "row" }, nextBtn("Call Overwatch")),
  ];
  if (n === 6) return [
    h("div", { class: "row" },
      h("button", { class: "btn gold", disabled: S.busy, onclick: inspect }, S.certificate ? "Inspect again" : "Run the inspection"),
      S.certificate && nextBtn("Send it")),
    S.certificate && h("label", { class: "f" }, h("span", null, "Tamper lab: change a copy, then check it"),
      h("select", { id: "tamperSel" }, ...TAMPERS.map(([l], i) => h("option", { value: i }, l)))),
    S.certificate && h("div", { class: "row" }, h("button", { class: "btn warn", onclick: () => runTamper(Number($("tamperSel").value)) }, "Tamper and verify")),
  ];
  const hand = S.hands[S.dest], sending = !!S.send;
  const destPick = h("div", { class: "sense-pick", style: "grid-template-columns:repeat(4,1fr)", role: "group", "aria-label": "Receiver" }, ...OW.CROSSROADS.map((c) =>
    h("button", { "aria-pressed": String(S.dest === c.id), style: "--c:#c084fc", disabled: sending, onclick: () => { S.dest = c.id; S.last = S.hands[c.id] ? c.id : S.last; render(); } },
      h("i", { style: S.hands[c.id] ? `background:${S.hands[c.id].result.ok ? "#34d399" : "#fb7185"}` : "" }), c.city)));
  if (n === 7) return [
    !S.certificate && h("span", { class: "note" }, "The journey changed since the last certificate. Run the inspection at station 6 first."),
    destPick,
    h("div", { class: "row" },
      h("button", { class: "btn gold", disabled: !S.certificate || sending, onclick: () => transmit(false) }, `Send to ${place(S.dest).city}`),
      h("button", { class: "btn warn", disabled: !S.certificate || sending, onclick: () => transmit(true) }, "Send through noise")),
    sending && h("span", { class: "note" }, S.send.leg === "out" ? "The package is on its way…" : "Their answer is on its way back…"),
    hand && !sending && h("div", { class: "row" },
      h("span", { class: "badge " + (hand.result.ok ? "ok" : "bad") }, hand.result.ok ? "HANDSHAKE COMPLETE" : "NO HANDSHAKE: " + hand.result.failed.toUpperCase()),
      h("button", { class: "btn ghost", onclick: () => { S.flyTo = OW.originOf(OW.receiverFrame(S.dest)); } }, "Stand where they stand")),
    h("div", { class: "row" },
      h("button", { class: "btn ghost", disabled: !S.certificate, onclick: () => download(`hyperpack-${S.chain.chainId}.json`, pack()) }, "Save package"),
      h("button", { class: "btn ghost", onclick: () => download("first-explorers-trace.json", S.trace) }, "Save ledger")),
    S.maxStation >= 8 && h("div", { class: "row" }, nextBtn("See the way")),
  ];
  const met = OW.CROSSROADS.filter((c) => S.hands[c.id] && S.hands[c.id].result.ok).map((c) => c.city);
  return [
    h("span", { class: "note" }, met.length ? `Hands joined so far: ${met.join(", ")}.` : "No handshake stands for this journey yet. Send it again from station 7."),
    S.dims === "2D" && h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { S.dims = "3D"; S.flyTo = null; S.view = homeView(); render(); } }, "Turn the map: see the bridge")),
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: () => go(7) }, "Reach another people"),
      h("button", { class: "btn", onclick: () => go(1) }, "Observe something new")),
    h("div", { class: "row" },
      h("a", { class: "btn ghost", href: "../Engram_Mind_Eye.html" }, "Meet the STRIX familiar"),
      h("a", { class: "btn ghost", href: "../../SHD-CCP/SHD-CCP_Introduction.html" }, "SHD-CCP introduction")),
  ];
}

// ─── right panel ─────────────────────────────────────────────────────────────
function checkList(checks) {
  return h("ul", { class: "checks" }, ...checks.map((c) => h("li", { class: c.ok === true ? "ok" : c.ok === false ? "bad" : "skip" },
    h("b", null, c.ok === true ? "✓" : c.ok === false ? "✕" : "·"), h("em", null, c.name), h("span", null, c.detail))));
}
const empty = (text) => [h("p", { class: "note" }, text)];
function tabPacket() {
  if (!S.chain) return empty("No packet yet. Record an observation first.");
  const original = S.chain.stream.slice(0, 16);
  let hex = original; for (const b of S.flips) hex = OW.flipBit(hex, b);
  const d = OW.decodePacket(hex);
  const fieldOf = (bit) => OW.PACKET_FIELDS.find((f) => bit <= f.hi && bit >= f.lo).key;
  const bitButtons = [...d.bits].map((v, i) => {
    const bit = 63 - i;
    return h("button", { class: (v === "1" ? "on" : "") + (S.flips.has(bit) ? " flipped" : ""), style: `--c:${FIELD[fieldOf(bit)][0]}`, title: `bit ${bit} (${fieldOf(bit)})`,
      onclick: () => { S.flips.has(bit) ? S.flips.delete(bit) : S.flips.add(bit); chime(S.flips.size ? 160 : 440); render(); } }, v);
  });
  return [
    h("div", null, h("h3", null, "Packet 0 of the chain (64 bits)"), h("div", { class: "hexbig" }, d.hex.replace(/(.{4})/g, "$1 ").trim())),
    h("div", { class: "row" }, h("span", { class: "badge " + (d.parityOk ? "ok" : "bad") }, d.parityOk ? "PARITY HOLDS" : "PARITY BROKEN"),
      S.flips.size > 0 && h("button", { class: "btn ghost", onclick: () => { S.flips.clear(); render(); } }, "Restore")),
    h("div", { class: "row" }, h("div", { class: "seg", role: "group", "aria-label": "Arrangement of the 64 bits" },
      h("button", { "aria-pressed": String(!S.cube), onclick: () => { S.cube = false; render(); } }, "Row of 64"),
      h("button", { "aria-pressed": String(S.cube), onclick: () => { S.cube = true; render(); } }, "Cube 4 × 4 × 4")),
      S.cube && h("span", { class: "note" }, "1 → 4 → 16 → 64")),
    S.cube
      ? h("div", { class: "cube", role: "group", "aria-label": "The 64 bits as four layers of four by four, bit 63 first. Select a bit to flip it." },
        ...[0, 1, 2, 3].map((layer) => h("div", null, h("div", { class: "bits four" }, ...bitButtons.slice(layer * 16, layer * 16 + 16)), h("span", { class: "note" }, `layer ${layer + 1}`))))
      : h("div", { class: "bits", role: "group", "aria-label": "The 64 bits, bit 63 first. Select a bit to flip it." }, ...bitButtons),
    h("div", { class: "fields" }, ...OW.PACKET_FIELDS.flatMap((f) => [
      h("i", { style: `--c:${FIELD[f.key][0]}` }),
      h("code", null, `${f.key} = ${f.key === "quat32" ? "0x" + d.quat32.toString(16).toUpperCase().padStart(8, "0") : d[f.key]}`),
      h("span", null, `bits ${f.hi === f.lo ? f.hi : f.hi + "–" + f.lo}: ${FIELD[f.key][1]}`)])),
    S.flips.size > 0 && h("p", { class: "note" }, "This is a copy for experimenting. The chain still holds " + original + "."),
  ];
}
function tabChain() {
  if (!S.chain) return empty("No chain yet. Record an observation first.");
  const c = S.chain, sel = S.lexicon.entries.find((e) => e.address === S.selected);
  const kv = (pairs) => h("dl", { class: "kv" }, ...pairs.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, String(v))]));
  return [
    h("div", null, h("h3", null, "Biochain record (shdccp/2)"), kv([
      ["chainId", c.chainId], ["epoch", c.epoch || 1], ["merkleRoot", c.merkleRoot], ["stream", `${c.stream.length / 2} bytes: ${short(c.stream, 24, 8)}`],
      ["leaves", c.leafHashes.length], ["weaveChiral", c.weaveChiral], ["engrams", `${c.engramCount} tokens`], ["origBytes", c.origBytes], ["shipped", c.shippedBytes],
      ...(c.parentChainId ? [["parent", c.parentChainId], ["addedBytes", c.addedBytes]] : []),
    ])),
    h("div", null, h("h3", null, "Lexicon (LEXICON/1): exact addresses, 2D and 3D"),
      h("table", null, h("thead", null, h("tr", null, ...["addr", "sense", "name", S.dims + " position"].map((t) => h("th", null, t)))),
        h("tbody", null, ...S.lexicon.entries.map((e) => h("tr", { style: e.address === S.selected ? "background:rgba(56,189,248,.1)" : "" },
          h("td", null, h("button", { class: "pill", style: "padding:1px 7px", onclick: () => select(e.address) }, e.address)),
          h("td", { style: `color:${SENSE[e.sense].c}` }, e.sense), h("td", null, e.name),
          h("td", null, OW.lexiconPoint(e.address, S.dims).slice(0, S.dims === "2D" ? 2 : 3).map((v) => v.toFixed(3)).join(", ")))))),
      h("p", { class: "note", style: "margin-top:6px" }, "root " + short(S.lexicon.root, 16, 8))),
    sel && h("div", { class: "box" }, h("h3", null, `Selected: ${sel.name}`), h("code", null, S.observations[S.lexicon.entries.indexOf(sel)].line)),
    h("div", null, h("h3", null, "Lineage: one epoch per observation"),
      h("table", null, h("tbody", null, ...S.lineage.map((r) => h("tr", null, h("td", null, "epoch " + r.epoch), h("td", null, r.chainId), h("td", null, short(r.merkleRoot, 8, 6))))))),
    S.lens === 2 && h("div", null, h("h3", null, "Recreated text"), h("code", { style: "white-space:pre-wrap" }, recreateText(c))),
  ];
}
function tabOverwatch() {
  if (!S.chain) return empty("Nothing to inspect yet.");
  const out = [];
  if (!S.report) out.push(h("p", { class: "note" }, "Not inspected yet. Go to station 6 and run the inspection."));
  else {
    out.push(h("div", null, h("h3", null, "Inspection of this journey"),
      h("div", { class: "row", style: "margin-bottom:7px" }, h("span", { class: "badge " + (S.report.ok ? "ok" : "bad") }, S.report.ok ? "ALL CHECKS PASS" : "FAILED AT " + S.report.failed.toUpperCase())),
      checkList(S.report.checks)));
  }
  if (S.certificate) out.push(h("div", { class: "box cert" }, h("h3", null, "Certificate (OVERWATCH/1)"),
    h("code", null, S.certificate.commitment),
    h("dl", { class: "kv", style: "margin-top:7px" }, h("dt", null, "signed by"), h("dd", null, S.certificate.sealId + " (this visit's key)"),
      h("dt", null, "signature"), h("dd", null, short(S.certificate.sig, 20, 10)), h("dt", null, "issued"), h("dd", null, S.certificate.issuedAt))));
  if (S.tamper) out.push(h("div", null, h("h3", null, "Tamper lab: " + S.tamper.label),
    h("div", { class: "row", style: "margin-bottom:7px" }, h("span", { class: "badge " + (S.tamper.verdict.ok ? "ok" : "bad") }, S.tamper.verdict.ok ? "ACCEPTED" : "REJECTED AT " + S.tamper.verdict.failed.toUpperCase())),
    checkList(S.tamper.verdict.checks)));
  const hd = S.last && S.hands[S.last];
  if (hd) {
    const c = place(S.last), f = OW.frameParameters(OW.receiverFrame(S.last));
    out.push(h("div", null, h("h3", null, `${c.city}'s verdict${hd.noise ? " (one hex digit damaged on the way)" : ""}`),
      h("div", { class: "row", style: "margin-bottom:7px" }, h("span", { class: "badge " + (hd.verdict.ok ? "ok" : "bad") }, hd.verdict.ok ? "ACCEPTED" : "REFUSED AT " + hd.verdict.failed.toUpperCase()),
        h("span", { class: "note" }, `${hd.size} characters received`)),
      checkList(hd.verdict.checks)));
    out.push(h("div", { class: "box" + (hd.result.ok ? " cert" : "") }, h("h3", null, `Handshake with ${c.city} (HANDSHAKE/1)`),
      h("code", null, hd.answer.line),
      h("dl", { class: "kv", style: "margin:7px 0" }, h("dt", null, "signed by"), h("dd", null, hd.answer.sealId + ` (${c.city}'s key for this visit)`),
        h("dt", null, "distance"), h("dd", null, `${f.distance.toFixed(3)} from our zero point, ${f.distanceBack.toFixed(3)} from theirs`),
        h("dt", null, "bearing"), h("dd", null, `we see them at ${c.bearing}° east of north; they see us straight back along the same road`)),
      checkList(hd.result.checks)));
  }
  return out;
}
function tabTrace() {
  if (!S.trace.length) return empty("The ledger is empty. Nothing has happened yet.");
  const v = OW.verifyTrace(S.trace);
  return [
    h("div", { class: "row" }, h("span", { class: "badge " + (v.ok ? "ok" : "bad") }, v.ok ? `${S.trace.length} ENTRIES, CHAIN WHOLE` : "BROKEN AT " + v.brokenAt),
      h("button", { class: "btn ghost", onclick: () => download("first-explorers-trace.json", S.trace) }, "Save")),
    h("ol", { class: "ledger" }, ...S.trace.slice().reverse().map((e) => h("li", null,
      h("div", { class: "top" }, h("span", { class: "who " + e.actor }, e.actor), h("b", null, e.event), h("span", { class: "hash" }, `#${e.n} ${e.hash.slice(0, 10)}`)),
      h("div", { class: "detail" }, e.detail.length > 150 ? e.detail.slice(0, 150) + "…" : e.detail)))),
  ];
}

// ─── render ──────────────────────────────────────────────────────────────────
function render() {
  const st = STATIONS[S.station];
  renderStations();
  $("stationTitle").textContent = `${S.station}. ${st.title}`;
  $("strixSay").textContent = st.say[S.lens];
  $("lensNote").textContent = st.note[S.lens];
  $("bridgeSay").textContent = st.bridge ? st.bridge[S.lens] : "";
  $("bridgeSay").hidden = !st.bridge;
  $("controls").replaceChildren(...controlsFor(S.station).filter(Boolean));
  for (const b of $("lensSeg").children) b.setAttribute("aria-pressed", String(Number(b.dataset.lens) === S.lens));
  for (const b of $("dimSeg").children) b.setAttribute("aria-pressed", String(b.dataset.dims === S.dims));
  for (const b of $("tabs").children) b.setAttribute("aria-selected", String(b.dataset.tab === S.tab));
  $("tabpane").replaceChildren(...({ packet: tabPacket, chain: tabChain, overwatch: tabOverwatch, trace: tabTrace })[S.tab]().filter(Boolean));
  $("soundBtn").textContent = S.sound ? "Sound on" : "Sound off"; $("soundBtn").setAttribute("aria-pressed", String(S.sound));
  $("hudLeft").textContent = `${S.observations.length} observation${S.observations.length === 1 ? "" : "s"} · epoch ${S.chain ? S.chain.epoch || 1 : 0}`;
  $("dragHint").textContent = S.dims === "2D" ? "Drag to travel. Select a dot to fly to it." : "Drag to turn. Select a dot to fly to it.";
  const seen = [...new Set(S.observations.map((o) => o.sense))];
  $("legend").replaceChildren(h("span", { style: "--c:#e2e8f0" }, h("i"), "us"), ...seen.map((s) => h("span", { style: `--c:${SENSE[s].c}` }, h("i"), SENSE[s].label)),
    S.station >= 7 && h("span", { style: "--c:#c084fc" }, h("i"), "the crossroads") || "",
    S.station >= 8 && S.dims === "3D" && h("span", { style: "--c:#fbbf24" }, h("i"), "the bridge") || "");
}
function toggleSound() { S.sound = !S.sound; render(); if (S.sound) chime(440); }
function select(address) {
  S.selected = address;
  S.flyTo = OW.originOf(OW.lexiconFrame(address, S.dims));
  if (S.tab !== "chain" && S.station !== 1) S.tab = "chain";
  render();
}
// 3D home: the lexicon seen at a slant; from station 7 the map plane lies like ground and its normal stands upright.
const homeView = () => (S.dims === "2D" ? OW.IDENT.slice() : S.station >= 7 ? OW.rotX(-1.15) : OW.lmul(OW.rotX(-0.35), OW.rotY(0.5)));

// ─── the space canvas ────────────────────────────────────────────────────────
const cv = $("space"), ctx = cv.getContext("2d");
let W = 0, R = 0, dpr = 1, hits = [];
function resize() {
  const box = $("canvasWrap").getBoundingClientRect();
  const size = Math.max(260, Math.min(box.width, Math.max(340, window.innerHeight - 250)));
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = cv.style.height = size + "px"; cv.width = cv.height = Math.round(size * dpr);
  W = size; R = size / 2 - 14;
}
const ballToHyp = (p) => { const r2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2], k = 1 / (1 - r2); return [2 * p[0] * k, 2 * p[1] * k, 2 * p[2] * k, (1 + r2) * k]; };
function screen(hp) {
  const b = OW.toBall(OW.lapply(S.view, hp));
  if (S.dims === "2D") return { x: W / 2 + R * b[0], y: W / 2 - R * b[1], z: 0, k: 1, r: Math.hypot(b[0], b[1]) };
  const k = 1 / (1 - 0.28 * b[2]);
  return { x: W / 2 + R * b[0] * k * 0.78, y: W / 2 - R * b[1] * k * 0.78, z: b[2], k: k * 0.78, r: Math.hypot(...b) };
}
let veil = 1;   // below 1 while something is drawn as background (the lexicon, from station 7 on)
function path(points, colour, width = 1, alpha = 1) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.globalAlpha = alpha * veil; ctx.stroke(); ctx.globalAlpha = 1;
}
function dot(p, radius, colour, glow = 0) {
  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.6, radius * p.k * (1 - 0.55 * p.r * p.r)), 0, 7);
  const ga = ctx.globalAlpha;
  ctx.fillStyle = colour; ctx.shadowColor = colour; ctx.shadowBlur = glow * veil; ctx.globalAlpha = ga * veil; ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = ga;
}
function label(p, text, colour) {
  if (p.r > 0.95 || veil < 1) return;
  ctx.font = `500 ${Math.round(11 * Math.max(0.75, 1 - 0.3 * p.r))}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = colour; ctx.globalAlpha = 0.9; ctx.fillText(text, p.x + 8, p.y - 7); ctx.globalAlpha = 1;
}
const ORIGIN = [0, 0, 0, 1];
function glyphPoints(o) { return OW.senseGlyph(o).map((p) => (S.dims === "2D" ? [p[0], p[1], 0] : p)).map(ballToHyp).map(screen); }

function draw(time) {
  const t = time / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, W);
  const lit = Math.min(1, S.maxStation / 5);
  const scale3 = S.dims === "3D" ? 0.78 / (1 - 0.28 * 0) : 1, Rb = R * scale3;
  // the edge of the world, brighter as more is known
  const g = ctx.createRadialGradient(W / 2, W / 2, Rb * 0.1, W / 2, W / 2, Rb);
  g.addColorStop(0, `rgba(56,189,248,${0.05 * lit})`); g.addColorStop(1, `rgba(124,58,237,${0.1 * lit})`);
  ctx.beginPath(); ctx.arc(W / 2, W / 2, Rb, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = `rgba(148,163,184,${0.06 + 0.4 * lit})`; ctx.lineWidth = 1.2; ctx.stroke();
  for (let d = 1; d <= 4; d++) {   // circles of equal hyperbolic distance from the centre of the view
    ctx.beginPath(); ctx.arc(W / 2, W / 2, Rb * Math.tanh(d / 2), 0, 7);
    ctx.strokeStyle = `rgba(148,163,184,${0.09 * lit})`; ctx.lineWidth = 0.6; ctx.stroke();
  }
  hits = [];
  const o = latest(), entries = S.lexicon ? S.lexicon.entries : [];

  if (S.station === 1) { const d = draftObservation(); if (d) drawGlyph(d, 0.95, t); }
  else if (o && S.station === 2) {
    drawGlyph(o, 0.5, t);
    const bytes = utf8(o.line + "\n");
    bytes.forEach((b, i) => {
      const a = Math.PI / 2 - (i / bytes.length) * 2 * Math.PI, r0 = Rb * 0.8, r1 = r0 + 4 + (b / 255) * Rb * 0.16;
      ctx.beginPath(); ctx.moveTo(W / 2 + r0 * Math.cos(a), W / 2 - r0 * Math.sin(a)); ctx.lineTo(W / 2 + r1 * Math.cos(a), W / 2 - r1 * Math.sin(a));
      ctx.strokeStyle = SENSE[o.sense].c; ctx.globalAlpha = 0.75; ctx.lineWidth = Math.max(1, (Rb * 4) / bytes.length * 0.45); ctx.stroke(); ctx.globalAlpha = 1;
    });
  }

  // the lexicon: origin → sense → observation, along geodesics
  const showTree = S.station >= 3 && entries.length, far = S.station >= 7;
  if (showTree) {
    veil = far ? 0.2 : 1;
    const senses = [...new Set(entries.map((e) => e.address.split(".")[0]))];
    for (const s of senses) {
      const hp = OW.originOf(OW.lexiconFrame(s, S.dims)), c = SENSE[OW.SENSES[s]].c;
      path(OW.geodesic(ORIGIN, hp, 16).map(screen), c, 1.3, 0.55);
      const p = screen(hp); dot(p, 5, c, 8); label(p, SENSE[OW.SENSES[s]].label, c);
    }
    for (const e of entries) {
      const hp = OW.originOf(OW.lexiconFrame(e.address, S.dims)), parent = OW.originOf(OW.lexiconFrame(e.address.split(".")[0], S.dims)), c = SENSE[e.sense].c;
      path(OW.geodesic(parent, hp, 14).map(screen), c, 1, 0.5);
      const p = screen(hp), on = e.address === S.selected;
      dot(p, on ? 7 : 5, on ? "#ffffff" : c, on ? 16 : 6); label(p, e.name, on ? "#ffffff" : "#cbd5e1");
      if (!far) hits.push({ x: p.x, y: p.y, address: e.address });
    }
    veil = 1;
  }
  if (o && S.station === 3) {   // the crystal of the latest line
    const c = OW.crystalPoint(utf8(o.line + "\n")).point, p = screen(ballToHyp(S.dims === "2D" ? [c[0] * 0.999, c[1] * 0.999, 0] : c.map((v) => v * 0.999)));
    const s = 7 + Math.sin(t * 3);
    ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s * 0.7, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s * 0.7, p.y); ctx.closePath();
    ctx.fillStyle = "#fbbf24"; ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
    label(p, "crystal", "#fbbf24");
  }
  if (S.station >= 7) {   // the crossroads: one road (geodesic) from our zero point to each receiver
    for (const c of OW.CROSSROADS) {
      const rh = OW.originOf(OW.receiverFrame(c.id)), geo = OW.geodesic(ORIGIN, rh, 40), hand = S.hands[c.id], on = c.id === S.dest;
      const colour = hand ? (hand.result.ok ? "#34d399" : "#fb7185") : "#c084fc";
      path(geo.map(screen), colour, hand && hand.result.ok ? 1.8 : 1, on || hand ? 0.7 : 0.3);
      const p = screen(rh); dot(p, on ? 7 : 5, colour, on ? 14 : 8);
      ctx.textAlign = c.id === "rome" ? "right" : "left";
      label(c.id === "rome" ? { ...p, x: p.x - 16 } : p, S.lens === 0 ? c.city : `${c.city} · ${c.people}`, on ? "#f5f3ff" : "#c4b5fd");
      ctx.textAlign = "left";
      if (S.send && S.send.to === c.id) {
        const m = S.send, back = m.leg === "back";
        m.t = Math.min(1, m.t + 0.01);
        const at = Math.round((back ? 1 - m.t : m.t) * (geo.length - 1));
        const tint = back ? (m.verdict.ok ? "#34d399" : "#fb7185") : m.noise && m.t > 0.5 ? "#fb7185" : "#fbbf24";
        path((back ? geo.slice(at) : geo.slice(0, at + 1)).map(screen), tint, 2.2, 0.9);
        dot(screen(geo[at]), 6, tint, 18);
        if (m.t >= 1 && !m.done) { m.done = true; (back ? complete : arrive)(); }
      }
    }
  }
  if (S.station >= 8) {   // the bridge: the geodesic through the zero point at right angles to the whole map
    const axis = [];
    for (let i = -40; i <= 40; i++) { const d = i * 0.12; axis.push([0, 0, Math.sinh(d), Math.cosh(d)]); }
    if (S.dims === "3D") {
      ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 16; path(axis.map(screen), "#fbbf24", 2.4, 0.95); ctx.shadowBlur = 0;
      label(screen(axis[62]), "the source", "#fde68a");
    } else {
      const c0 = screen(ORIGIN), ring = 10 + 4 * Math.sin(t * 2);
      ctx.beginPath(); ctx.arc(c0.x, c0.y, ring, 0, 7); ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.6; ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
      label({ ...c0, x: c0.x + 8, y: c0.y + 30 }, "the bridge, seen end-on", "#fde68a");
    }
  }
  // us
  const us = screen(ORIGIN), pulse = 3.2 + Math.sin(t * 2) * (S.maxStation ? 0.6 : 1.1);
  dot(us, pulse, S.maxStation ? "#e2e8f0" : "#64748b", S.maxStation ? 14 : 5);
  if (S.maxStation >= 3) label(us, "us", "#94a3b8");

  // fly towards a selected point, a fraction of the remaining distance per frame
  if (S.flyTo) {
    const b = OW.toBall(OW.lapply(S.view, S.flyTo)), r = Math.hypot(...b), d = 2 * Math.atanh(Math.min(0.999999, r));
    if (d < 0.01) S.flyTo = null;
    else S.view = OW.lmul(OW.boostAlong(b.map((v) => v / r), -Math.min(d, d * 0.14 + 0.01)), S.view);
  }
  const c = OW.toBall(OW.lapply(S.view, ORIGIN)), dist = 2 * Math.atanh(Math.min(0.999999, Math.hypot(...c)));
  $("hudRight").textContent = `we are ${dist.toFixed(2)} from the centre of the view`;
  requestAnimationFrame(draw);
}
function drawGlyph(o, alpha, t) {
  const pts = glyphPoints(o), c = SENSE[o.sense].c;
  ctx.shadowColor = c; ctx.shadowBlur = 12; path(pts, c, 2, alpha * 0.8); ctx.shadowBlur = 0;
  pts.forEach((p, i) => { ctx.globalAlpha = alpha; dot(p, 2 + 1.2 * Math.sin(t * 3 + i * 0.6), c, 6); ctx.globalAlpha = 1; });
  if (o.sense === "light") dot(pts[pts.length - 1], 9, `rgb(${o.r},${o.g},${o.b})`, 22);
}

// pointer: drag to travel (2D) or turn (3D); a short press selects a dot
let drag = null;
const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); const [x, y] = local(e); drag = { x, y, moved: 0 }; });
cv.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const [x, y] = local(e), dx = x - drag.x, dy = y - drag.y, len = Math.hypot(dx, dy);
  drag.moved += len; drag.x = x; drag.y = y;
  if (len === 0 || S.send) return;
  S.flyTo = null;
  if (S.dims === "2D") S.view = OW.lmul(OW.boostAlong([dx / len, -dy / len, 0], 2 * Math.atanh(Math.min(0.9, len / R / 2))), S.view);
  else S.view = OW.lmul(OW.lmul(OW.rotY(dx * 0.008), OW.rotX(dy * 0.008)), S.view);
});
cv.addEventListener("pointerup", (e) => {
  if (drag && drag.moved < 5) {
    const [x, y] = local(e), hit = hits.find((p) => Math.hypot(p.x - x, p.y - y) < 16);
    if (hit) select(hit.address);
  }
  drag = null;
});
cv.addEventListener("pointercancel", () => { drag = null; });

// ─── wiring ──────────────────────────────────────────────────────────────────
$("lensSeg").addEventListener("click", (e) => { if (e.target.dataset.lens) { S.lens = Number(e.target.dataset.lens); render(); } });
$("dimSeg").addEventListener("click", (e) => {
  if (!e.target.dataset.dims || S.send) return;
  S.dims = e.target.dataset.dims; S.flyTo = null; S.view = homeView(); render();
});
$("tabs").addEventListener("click", (e) => { if (e.target.dataset.tab) { S.tab = e.target.dataset.tab; render(); } });
$("soundBtn").addEventListener("click", toggleSound);
$("homeBtn").addEventListener("click", () => { S.flyTo = null; S.view = homeView(); });
$("aboutBtn").addEventListener("click", () => $("about").showModal());
$("aboutClose").addEventListener("click", () => $("about").close());
window.addEventListener("resize", resize);
window.FirstExplorers = { state: S };   // for the browser check and for the curious

resize(); render(); requestAnimationFrame(draw);
