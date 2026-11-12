# Owl Academy — First Explorers & STRIX Overwatch (draft 0)

## Overview

**First Explorers** (`Library/Experimental_Systems/First_Explorers/`) is a standalone
introduction: the visitor and STRIX start in darkness at the origin of hyperbolic
space and learn, one station at a time, how a signal becomes geometry, an SHD-CCP
packet, a traced biochain and a certificate a receiver can check. It needs no
account, stores nothing and publishes nothing.

| Station | What happens | Code that does it |
|---|---|---|
| 0 Darkness | a key pair for this visit; entry 0 of the ledger | `newSessionKeys`, `traceAppend` |
| 1 A signal | a sound, colour, touch stroke, word or count, shown in its native shape | `senseGlyph` (display only) |
| 2 Measure | the observation as one canonical line of integers, then bytes | `makeObservation` / `parseObservation` (OBS/1) |
| 3 Shape | the crystal quaternion; an exact lexicon address, drawn in the 2D disc and the 3D ball | `crystalPoint`, `lexiconOf`, `lexiconFrame` |
| 4 The packet | the 64-bit `shdccp/2` crystal packet, bit by bit; parity | `decodePacket`, `flipBit` |
| 5 The chain | one real biochain epoch per observation, commitment signed | `growJourney` → `growBiochain` / `extendBiochain` |
| 6 Overwatch | ten checks, a signed certificate, a tamper lab | `issueCertificate`, `verifyHyperpack` |
| 7 Across space | the package sent along a geodesic and verified again from its text | `makeHyperpack`, `verifyHyperpack` |

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
```

**Overwatch checks**, in order, stopping at the first failure:
`parity → canonical → crystal → leaves → weaves → derived` (the strict verifier,
check for check) `→ meaning` (the recreated text is canonical OBS/1 lines)
`→ lexicon` (exactly the lexicon the observations give) `→ lineage` (every epoch
regrown from the text has the listed chainId and root) `→ trace` (the ledger's
hash chain is whole and records every epoch's commitment). A receiver adds
`parse` before them and `commitment → signature` after.

The lexicon **address is exact** (two integers) and is what gets committed. The 2D
disc and 3D ball positions are computed from it with Lorentz frames in binary64,
for display; they are never signed.

## Limits

- The signing key is made per visit and not kept. A valid signature shows a
  certificate is unchanged since it was issued, not who issued it.
- STRIX on this page is a scripted guide; the engram familiar is not run.
- The receiver is simulated in the same page.
- The lexicon is the small one the visitor builds.

## Towards the full system

The target is SHD-CCP biochains with STRIX Overwatch verification and certification
for general 2D and 3D lexicons, packaged for transmission through hyperbolic space.
Still to do, roughly in order:

1. Specify OBS/1, LEXICON/1, TRACE/1, OVERWATCH/1 and HYPERPACK/1 as an RFC in
   BioChainAI/SHD-CCP-core, with contract vectors (as RFC 07 has).
2. Sign Overwatch certificates with a registered seal (minor-tome seal or a
   Genesis-issued Overwatch key) and check the signer against the seal registry.
3. General lexicons: connect the Hyperbolic Lexicon's exact addresses and its
   attested package verifier (BioChainAI/Ebayednoob, `verifyPackage`) so a
   HYPERPACK can carry any 2D or 3D lexicon, not only a journey's.
4. Real sensor input (microphone, camera, device motion) behind the same OBS/1
   integer measurements.
5. Publishing a certified journey to the Biomesh (Firestore rules, Console cards).
