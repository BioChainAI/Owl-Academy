# Owl Academy — First Explorers & STRIX Overwatch (draft 0)

## Overview

**First Explorers** (`Library/Experimental_Systems/First_Explorers/`) is a standalone
introduction: the visitor and STRIX start in darkness at the origin of hyperbolic
space and learn, one station at a time, how a signal becomes geometry, an SHD-CCP
packet, a traced biochain and a certificate a receiver can check, and are pointed
along the way to a bridge (see "The bridge narrative"). It needs no account, stores
nothing and publishes nothing.

| Station | What happens | Code that does it |
|---|---|---|
| 0 Darkness | a key pair for this visit; entry 0 of the ledger | `newSessionKeys`, `traceAppend` |
| 1 A signal | a sound, colour, touch stroke, word or count, shown in its native shape | `senseGlyph` (display only) |
| 2 Measure | the observation as one canonical line of integers, then bytes | `makeObservation` / `parseObservation` (OBS/1) |
| 3 Shape | the crystal quaternion; an exact lexicon address, drawn in the 2D disc and the 3D ball | `crystalPoint`, `lexiconOf`, `lexiconFrame` |
| 4 The packet | the 64-bit `shdccp/2` crystal packet, bit by bit; parity | `decodePacket`, `flipBit` |
| 5 The chain | one real biochain epoch per observation, commitment signed | `growJourney` → `growBiochain` / `extendBiochain` |
| 6 Overwatch | ten checks, a signed certificate, a tamper lab | `issueCertificate`, `verifyHyperpack` |
| 7 Across space | the package sent along a geodesic to one of four receivers, verified again from its text, answered and the answer checked | `makeHyperpack`, `answerHyperpack`, `verifyAnswer`, `receiverFrame` |
| 8 The way | the roads to the four receivers; in the 3D ball, the geodesic through the zero point at right angles to the map | `frameParameters` (display only) |

All checkable logic is in `scripts/strix-overwatch.js` (Firebase-free, DOM-free;
tests in `tests/unit/strix-overwatch.test.mjs`). The page file
`first-explorers.js` is interface only.

## What is reused, unchanged

- The grow cell, growth epochs, `GROWN/1` / `GROWTH/1` commitments and the strict
  verifier `verifyIntegrityStrict` (RFC 07 section 12) of `scripts/biomesh-core.js`.
  Every chain the page makes is an ordinary `shdccp/2` record.
- ECDSA P-256 signing from `scripts/seal-crypto.js`.

## What is new (draft 0: no RFC, nothing registered)

```
OBS/1|<sense>|<name>|<fields>                      one observation, one canonical line
LEXICON/1   entries: address|sense|name|sha256(line)   address = <sense index>.<n-th of that sense>
TRACE/1     hash = sha256(TRACE/1|n|actor|event|at|sha256(detail)|prev)
OVERWATCH/1|chainId|merkleRoot|epoch|lexiconRoot|2D+3D|traceHead|strict+meaning+lexicon+lineage+trace
HYPERPACK/1 { route, chain, lexicon, lineage, trace, certificate }   as JSON
HANDSHAKE/1|sha256(text received)|chainId or -|accepted or refused|failed check or -   signed by the receiver
```

**Overwatch checks**, in order, stopping at the first failure:
`parity → canonical → crystal → leaves → weaves → derived` (the strict verifier,
check for check) `→ meaning` (the recreated text is canonical OBS/1 lines)
`→ lexicon` (exactly the lexicon the observations give) `→ lineage` (every epoch
regrown from the text has the listed chainId and root) `→ trace` (the ledger's
hash chain is whole and records every epoch's commitment). A receiver adds
`parse` before them and `commitment → signature` after.

**The handshake.** A receiver verifies the package from its text and signs a
HANDSHAKE/1 line with its own key. The sender checks `signature → echo → accepted`:
the answer is whole, the receiver read exactly the text that was sent, and it
accepted. Damage on the way is therefore seen twice: the receiver refuses, and
the sender's echo check fails. This is not RFC 06 (the frame-free alignment
handshake in `SHD-CCP/geometric-engine-spec`), whose six steps are still to be
written.

**The crossroads.** The four receivers (`CROSSROADS`) are Antioch, Alexandria,
Athens and Rome, standing for the Syrians, Egyptians, Greeks and Romans. Each has
its own zero point in the plane z = 0, at its rounded compass bearing from Galilee
(11°, 253°, 303°, 304°; north is +y) and at hyperbolic distance
`0.8 ln(1 + km / 60)`. The distance between two zero points is the same from
either side (`frameParameters`). Positions are binary64 and for display.

The lexicon **address is exact** (two integers) and is what gets committed. The 2D
disc and 3D ball positions are computed from it with Lorentz frames in binary64,
for display; they are never signed.

## The bridge narrative

Every station carries a gold box, "The Bridge", at the three reading levels. It
reads Jesus of Nazareth as the bridge between the source of love and the world of
nations, and station 8 draws it: on the flat map of peoples the bridge is hidden in
one point, the zero point; in the 3D ball it is the geodesic through that point at
right angles to every road. A cube view of the packet (4 × 4 × 4) shows the 64 bits
growing from one point.

- **It is an interpretation chosen by this project.** No check depends on it.
- **The history is from one book**, read in full: Pierre van Paassen, *Why Jesus
  Died* (Dial Press, 1949; Internet Archive `in.ernet.dli.2015.165919`). Text in
  quotation marks is his and was checked against the scan's text.
- **What the book argues:** Jesus was a Galilean Jew in the line of Israel's
  prophets who announced the Kingdom of God on earth; Pontius Pilate alone ordered
  his death; later tellings moved the blame onto the Jewish people; Greek-speaking
  missionaries, starting from Antioch, remade the message. The author writes as a
  Unitarian and does not take the resurrection, the virgin birth or the Trinity as
  history. Most Christians and many historians disagree with parts of this, and
  some of his sources are dated.
- **What is this project's and not the book's:** the bridge, the axis through the
  zero point, and the cross as a figure of two directions. The book uses none of
  them. Where it and this reading meet is its picture of a love that "embraced the
  entire human race" and of "the community of mankind".
- "64-bit cubit" is not defined anywhere in the specifications yet (RFC 05's cubit
  is an acoustic unit, in outline). The page shows the cube and says so.

## Limits

- The signing key is made per visit and not kept. A valid signature shows a
  certificate is unchanged since it was issued, not who issued it.
- STRIX on this page is a scripted guide; the engram familiar is not run.
- The receivers are simulated in the same page; each signs with a key made for the visit.
- The lexicon is the small one the visitor builds.

## Towards the full system

The target is SHD-CCP biochains with STRIX Overwatch verification and certification
for general 2D and 3D lexicons, packaged for transmission through hyperbolic space.
Still to do, roughly in order:

1. Specify OBS/1, LEXICON/1, TRACE/1, OVERWATCH/1, HYPERPACK/1 and HANDSHAKE/1 as an RFC in
   BioChainAI/SHD-CCP-core, with contract vectors (as RFC 07 has).
2. Sign Overwatch certificates with a registered seal (minor-tome seal or a
   Genesis-issued Overwatch key) and check the signer against the seal registry.
3. General lexicons: connect the Hyperbolic Lexicon's exact addresses and its
   attested package verifier (BioChainAI/Ebayednoob, `verifyPackage`) so a
   HYPERPACK can carry any 2D or 3D lexicon, not only a journey's.
4. Real sensor input (microphone, camera, device motion) behind the same OBS/1
   integer measurements.
5. Publishing a certified journey to the Biomesh (Firestore rules, Console cards).
