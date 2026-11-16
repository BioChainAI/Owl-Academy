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

All of First Explorers' checkable logic is in `scripts/strix-overwatch.js`
(Firebase-free, DOM-free; tests in `tests/unit/strix-overwatch.test.mjs`). The page
file `first-explorers.js` is interface only.

Two later pages build on it: the **Lexicon Explorer**, described from "Tree lexicons"
on in this document, and the **Celestial Control Panel**, described in
`CELESTIAL_CONTROL_PANEL.md`. Their checkable logic is in three cores, each
DOM-free and tested, and in one DOM-free model module per page:

| Core | What it holds | Tests |
|---|---|---|
| `scripts/strix-overwatch.js` | the formats, the checks, the seals; now also LEX/1, LEXICON/2, `readHyperpack`, `witnessQuorum` and the word figures | `tests/unit/strix-overwatch.test.mjs`, `tests/unit/strix-lexicon.test.mjs` |
| `scripts/hyperbolic-moves.js` | geometry in binary64, for drawing and demonstration only: nothing it computes is committed to a chain | `tests/unit/hyperbolic-moves.test.mjs` |
| `scripts/celestial-core.js` | the Sun, the Moon and eight anchors (six distant objects and two poles) for a place and a time; imports nothing | `tests/unit/celestial-core.test.mjs` |

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
  history.
- **This project's view of the book**, a READING and nothing this project checked:
  most Christians and many historians would disagree with parts of the book, and
  some of its sources are dated. Row `0.4.3` of the Ezekiel lexicon says the first
  of these and the dialogs of the two newer pages say both, under the READING label
  and opening with the words "This project's view".
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

## Tree lexicons (drafts: no RFC, nothing registered)

A journey's lexicon (LEXICON/1) lists what one visitor observed. A **tree lexicon**
lists entries that somebody wrote down and arranged: verses, the words in them, what
named sources say about those words, counts, and notes. Two formats were added for
it:

```
LEX/1|<address>|<layer>|<kind>|<name>|<text>       one entry, one canonical line
LEXICON/2   text    every LEX/1 line followed by a newline, in the one canonical order
            object  { format, dims, entries: [{ address, layer, kind, name, lineSha }], root }
            root    sha256(LEXICON/2|<number of entries>, then address|layer|kind|name|lineSha
                    for every entry, the lines joined by newlines)
```

and three things a page needs around them: `readHyperpack`, the one way a text from
outside becomes a package ("The front door"); `witnessQuorum`, which counts the
answers of receivers ("The witness rule"); and five functions that lay one 64-bit
word out as a wheel and as a square ("The word figures"). All of it is in
`scripts/strix-overwatch.js`, tested in `tests/unit/strix-lexicon.test.mjs`.

OVERWATCH/1, HYPERPACK/1 and HANDSHAKE/1 are unchanged. What the text of a chain is,
a journey or a tree, is decided by the `format` member of its lexicon (`profileOf`):
`LEXICON/2` selects the tree reading; anything else, a missing lexicon included, is
read as a journey, as before. The ten Overwatch checks keep their names and their
order. For a tree, `meaning` reads LEX/1 lines, `lexicon` compares the lexicon object
with the one the entries give, and `lineage` expects one epoch per top-level entry.

**Both formats are drafts.** Neither is an RFC, nothing is registered, and either may
change. They are not the address format of the Hyperbolic Lexicon
(BioChainAI/Ebayednoob) either, so item 3 of "Towards the full system" is still to
do.

## LEX/1: one entry, one line

| Part | Rule |
|---|---|
| `address` | 1 to 8 indices joined by dots; each index a whole number from 0 to 9999, written without a sign or a leading zero |
| `layer` | one of `text`, `said`, `checked`, `reading` (`LAYERS`): the kind of statement the entry makes |
| `kind` | a lower-case letter, then at most 15 lower-case letters, digits or hyphens; a label for display, to which no check gives a meaning |
| `name` | after NFC normalisation, 1 to 96 code points: letters, marks, numbers, punctuation, symbols and single spaces; no space first or last, no two spaces in a row, no mark first, nothing default-ignorable |
| `text` | after NFC, 0 to 1200 code points from the same set, or the newline; nothing default-ignorable |

In `name` and `text` the characters `%`, `|` and the newline are written `%25`,
`%7C` and `%0A`, so a line always splits at `|` into exactly six parts, and the whole
line must be its own NFC form. `makeEntry` builds an entry and its line; `parseEntry`
reads a line back and refuses it unless it is the canonical line of the entry it
gives. One entry therefore has exactly one line.

What the rule keeps out of a line: every control and format character (so no
zero-width character and no bidi control), private-use, unassigned and surrogate code
points, and every separator but the ordinary space. Two things it does not keep out:
a symbol that draws nothing (U+2800, the blank Braille pattern) and right-to-left
letters, which take part in bidi layout like any text. The pages therefore show the
address beside a name and isolate every string they did not write. NFC and the
character categories are those of the Unicode version of the engine that runs the
code, so an engine with a newer Unicode can accept a letter an older one refuses.

Every error these functions throw is a fixed sentence (for a lexicon text, with a
line number in front): none repeats its input.

**The four layers, and what each may claim.** The layer is the label the writer of
an entry gives it. It is part of the line, so it is sealed with the entry; no check
tests whether it is deserved.

| Layer | Badge on the pages | An entry of this layer may claim |
|---|---|---|
| `text` | TEXT (WRITTEN at the first reading level) | that its words stand in a named source, letter for letter; anyone can check by reading the source |
| `said` | SAID | that a named person, tradition, catalogue, paper or search says this; always attributed, never the page's own voice |
| `checked` | CHECKED | that this code counts or computes it and a visitor can repeat it; it does not mean that the words beside it are proved |
| `reading` | READING (OUR IDEA at the first reading level) | nothing beyond itself: it is this project's interpretation or choice, the author's notes among them |

By this project's rule nothing moves a statement from `reading` to another layer.

## LEXICON/2: a tree lexicon

**The text** is every line followed by a newline (`lexiconText`), in one fixed order:
the depth-first listing of the tree, with the children of every entry in increasing
index order. `parseLexiconText` accepts nothing else. The first line is a top-level
entry. For every later line with address `P.k` (P the address without its last index;
empty for a top-level entry), P is empty, or is the address of the line before, or is
that address with trailing indices removed; and k is greater, as a number, than the
index of the last line seen with parent P. So one tree has exactly one text.

**Sparse indices: an address can be a citation.** Indices must increase, but they
need not be consecutive. In the Ezekiel lexicon the first index of a scripture
address is the number of the book in the King James e-text, the second the chapter
and the third the verse: `43.3.16` is John 3:16 and `26.1.9` is Ezekiel 1:9. The
book number is a filing convention and carries no meaning.

**Limits.** A lexicon text holds at most 60,000 bytes of UTF-8 (`MAX_LEXICON_BYTES`),
3,000 entries (`MAX_ENTRIES`) and 16 top-level entries (`MAX_EPOCHS`).

**The lexicon object** (`treeLexiconOf`) lists every entry by address, layer, kind and
name with the SHA-256 of its line, in exactly that member order, because the
`lexicon` check compares JSON text. Its root is in the signed OVERWATCH/1 line. The
layer is part of each line and of the root, so a package in which a label was changed
no longer fits its certificate. This protects a label after sealing. It does not show
that the label was right when it was sealed, and anyone can seal a relabelled lexicon
with a key of their own.

**One epoch per top-level entry** (`treeEpochTexts`). A tree grows in address order:
epoch k is the text up to the line before top-level entry k + 1, and the last epoch
is the whole text. `growLexicon` grows the first epoch with `growBiochain` and every
later one with `extendBiochain` (strict check enforced), both without the optional
engram layer, so a lexicon chain is an ordinary `shdccp/2` record.
`buildLexiconBundle` does this for all epochs and writes the ledger: one `genesis`
entry and one `chain.grown` entry per epoch, each holding that epoch's commitment.
For a given time stamp the bundle is deterministic. The epochs are where the format
cuts the text. They are no record of when, or in what order, anything was written.

**How lineage is recomputed from the final text.** The `lineage` check needs, for
every epoch, the chain id and Merkle root a chain grown from that epoch's text has.
For a journey each epoch is regrown from its text. For a tree, `treeLineage` computes
all of them once from the last text. Every epoch text is a beginning of the last one,
and the `shdccp/2` cut puts 720 bytes in every chunk but the last, so all epochs share
their full chunks: the leaf hash and the running chiral weave of each full chunk are
computed once, each epoch adds only its own last, shorter chunk, and the chain id is
`BC-` and the first 24 hex digits of `sha256(merkleRoot|weaveChiral)`. Only functions
that `scripts/biomesh-core.js` exports are used. A unit test shows the result equal
to regrowing every epoch on 30 random lexicons (1 to 16 epochs, ASCII and multi-byte)
and on epochs that end exactly on a chunk boundary. The check then also requires that
the last epoch is the chain itself and that the chain's parent link, epoch number and
added bytes are the recomputed ones.

**Helpers.** `parentOf`, `depthOf`, `childrenIndex`, `layerCounts`;
`countWord(text, word)`, the number of times a word stands in a text as a whole word,
whatever its case; `lexiconPackets(text)`, the 16-hex-digit packet of every 720-byte
chunk without growing a chain (equal to `chainPackets` of the grown chain);
`entryPacketIndex`, the packet that holds the first byte of an entry's line;
`entriesOfPack`, the entries of a package, to be called only after the package was
accepted.

## The front door: `readHyperpack`

The wire form of a package is `JSON.stringify(makeHyperpack(...))` with no
indentation. Download and send use this exact string, HANDSHAKE/1 hashes it, and the
order of the members is part of the format. `readHyperpack(text)` is the one way a
text that did not originate in a page becomes a package. It returns
`{ ok, failed, checks, pack }` and never rejects or throws.

Before any check runs it refuses, as `failed: "parse"` with a fixed sentence, in this
order:

1. anything that is not a string;
2. a text of more than 1,500,000 characters (`MAX_PACK_CHARS`), before parsing it;
3. a text that is not JSON;
4. a value that is not a plain object;
5. nesting deeper than 12 levels (the package itself is level 1), or a string or
   member name that is not well-formed Unicode; this walk uses no recursion, so no
   depth of nesting can exhaust the stack;
6. anything but exactly the seven members `format`, `route`, `chain`, `lexicon`,
   `lineage`, `trace`, `certificate`, in that order, with `format` equal to
   `HYPERPACK/1`, the four records objects and the two lists arrays;
7. a member this format does not know in the chain or in the certificate;
8. a certificate that does not hold all seven of its members (`format`,
   `commitment`, `traceHead`, `issuedAt`, `sealId`, `publicJwk`, `sig`), six of them
   strings and the public key an object. Without this a certificate with no
   `traceHead` would be read as one that names no ledger entry: its signature would
   cover no point of the ledger, and anyone could write another ledger under the
   same seal;
9. more than 4,096 ledger entries, or a ledger entry that is not an object or has a
   member this format does not know;
10. more than 64 lineage rows, or more than 3,000 lexicon entries;
11. a text that is not exactly the JSON its own value is written as (so no
    indentation, no padding and no member named twice).

Then it runs `verifyHyperpack` (the thirteen package checks). If a check throws, that
too is reported as a refusal at `parse`. `pack`, the parsed package, is returned only
when every check passed; a package that fails is not to be shown beyond its failure.

What the front door never does:

- It never says whose key signed, or when the key was made. A passing verdict means
  that the lexicon, its labels and the ledger up to the signed point have not
  changed since some key signed them. The detail of the passed signature check is
  `ECDSA P-256 by S-…` and nothing more; a page may add "(a key made for this
  visit)" beside a seal it made itself, and never does so for a package from a file.
- It never vouches for what the signed line does not cover: the route, `issuedAt`,
  ledger entries after the certified head, and anything in the key's record beside
  the key itself (`x` and `y`). The Lexicon Explorer shows the route, the time of
  issue and the number of later ledger entries under the heading "Not covered by the
  signature", and shows nothing else of the key's record.
- It never hands back a package that failed.

Two notes for a maintainer. `answerHyperpack`, the receiver's side, calls
`verifyHyperpack` directly and not the front door, so a page must hand its simulated
receivers only a wire it made itself or one the front door accepted. And a page
checks the size of a file (at most 4,500,000 bytes) before reading it.

## The witness rule: `witnessQuorum`

`witnessQuorum(answers, sentWire, { need = 2, known, exclude = [] })` counts the
HANDSHAKE/1 answers that witness one sent wire and returns
`{ met, need, accepted: [sealId], rejected: [{ index, failed }] }`. An answer counts
only if all of this holds:

- `verifyAnswer` passes: the answer is whole, the receiver read exactly the wire that
  was sent, and it accepted (otherwise `signature`, `echo` or `refused`);
- its key and signature are spelled in the one canonical way, so one key cannot
  appear under two seal ids: an EC P-256 key whose `x` and `y` are 43 base64url
  characters each, the last of them one that leaves the two spare bits zero, and a
  signature of 128 lower-case hex digits (otherwise `form`);
- its seal id is not excluded; a page passes the sealer's own seal id here, because a
  key that seals never answers (otherwise `sealer`);
- its seal id is one the caller already holds, listed in `known`, which is required
  (otherwise `unknown`);
- that seal id has not been counted already (otherwise `repeat`).

`need` is a whole number of at least 1 and is 2 unless the caller says otherwise.

**What is counted is seal ids, not parties.** One seal is one witness, and what a
quorum shows depends on who holds the keys. On the Lexicon Explorer the four
receivers (Antioch, Alexandria, Athens and Rome, as in First Explorers) run inside
the one page, with the same code, each with a key made a moment before. A quorum of
them is a demonstration of how a two-witness rule is checked. It is not independent
testimony. The sentence the page prints with every count says so: all four run
inside the page, and the count does not show that independent parties have looked.

## The word figures, and their limits

One SHD-CCP word is 64 bits, written as 16 hex digits. Read left to right, each
digit's bits high to low, the bits are numbered i = 0 to 63 (i = 0 is bit 63). Five
functions give two pictures of the same 64 cells and three small facts about them:

| Function | What it gives |
|---|---|
| `glyphCells(hex)` | the 64 cells, each with `sector` (i >> 2: one hex digit, one sixteenth of the word), `ring` (i & 3; 0 is the outer ring), `quadrant` (i >> 4: sixteen bits), `row` and `col` (the 8 × 8 square, row by row), whether it is on, and the packet field that holds it; `glyphHex` gives the word back |
| `seedMirror(fourBits)` | the author's mirror rule (the "1/16 M.C. ESCHER SYMMETRY" button of Loom Weave): four seed bits in one corner of the 8 × 8 square are mirrored until all 64 cells are filled |
| `squareQuarters(hex)` | the four 4 × 4 corner squares of the 8 × 8 square |
| `fourthFromThree(a, b, c)` | the bottom-right corner square predicted from each of the other three by mirroring, and whether the three predictions agree |
| `quarterParities(hex)` | the parity of each 16-bit quadrant |

The wheel has 16 sectors of 4 rings; the Lexicon Explorer draws it with ring radii
from `equalAreaRings(1.5, 4)` of the geometry core, so that all 64 cells have the
same hyperbolic area, 0.1328 each.

What they show, each one tested:

- The parity bit (bit 59) is the XOR of the other 63. Sixty-three bits fix the
  sixty-fourth, and flipping any one cell breaks parity.
- In a word whose parity holds, the parities of three quadrants fix the parity of the
  fourth. This was tested on 2,000 crystallised packets.
- Four cells, one sixteenth of the word, fill all 64 by the mirror rule. There are 16
  such words; parity holds in every one, and in each of them any three corner squares
  give the fourth bit for bit, while one flipped bit in the fourth is caught.

What they do not show:

- Parity catches an odd number of flipped bits only. Any two flips leave it whole
  although the word has changed; the crystal check of the chain catches that.
- "Three quarters fix the fourth" is the parity rule said another way. It is not a
  further check.
- The corner rule holds in the 16 mirror words because of how they are built. It is
  not a property of packets: for none of the 69 packets of the Ezekiel lexicon do the
  three predictions for the fourth corner agree.
- These are properties of words. They say nothing about what a word means, and no
  check of a chain depends on any figure.

## The Lexicon Explorer page

`Library/Experimental_Systems/Lexicon_Explorer/` shows one tree lexicon as a tree in
hyperbolic space and lets a visitor read it, count in it, seal it and send it. Its
built-in lexicon is the Ezekiel lexicon of the next section. It needs no account,
stores nothing, and makes no request to another host except for web fonts.

| File | What it is |
|---|---|
| `index.html`, `lexicon-explorer.js` | the page and its shell: stations, reader, tabs, seal, send, load |
| `lexicon-explorer-model.js` | all state and all wording, DOM-free; tested in `tests/unit/lexicon-explorer-model.test.mjs` |
| `lexicon-canvas.js` | drawing and pointer only: the tree, the word wheel and square, the figures of the last station |
| `ezekiel-1.js` | the lexicon's rows |
| `passage-as-supplied.js` | the wording of the passage as the author supplied it (see "The supplied passage") |
| `../explorer-kit.js`, `../explorer-kit.css` | DOM helpers and the look, shared with the Celestial Control Panel |

**What it shows.** On a wide screen there are three columns; on a phone the same
parts stand in one column, in reading order. On the left STRIX, the scripted guide of
the page, speaks for the open station above one verse of the passage, with the gold
box under it; the nine verses of Ezekiel 1:1-9 stand in the box "The passage", every
term a button. In the middle, the tree: every entry owns a cell of the hyperbolic
plane and no two cells overlap (`treeLayout` of the geometry core), so a centred
entry has its children near the rim; a tap brings an entry to the centre; a 3D view
shows the same tree in the ball; under the map the same entries are a list that can
be walked with the arrow keys. On the right, the Entry: the words of the chosen entry
and its children with their badges, in a fixed order of seven groups: "In short" (the
plain rows), "Verses set beside it", "Under this entry", "Quoted", "Checked", "Said"
and "Our reading". A verse reached through a link row is cited with its translation
("Psalm 69:8, King James Version"). While nothing is chosen the card says where the
author's ten lines are and offers a button to them.

Three reading levels, called lenses, give the same facts at three depths: Stargazer
("ages 6 and up"), Navigator ("names, dates and sources") and Holographer ("formats
and hashes"). At Stargazer the Entry is the only tab, and three entries (`0`, `0.3`
and `100`) open with one short sentence of the page's own, the row's text standing
under "More for older readers". From Navigator up there is also the Wheel, then Chain
and Overwatch once the lexicon is sealed and Witnesses once it has been sent.

**The seven stations**, free to visit in any order:

| Station | What happens | Code that does it |
|---|---|---|
| 1 Read | the passage; choose a word and read what is written, said and checked about it | `readerView`, `entryView` |
| 2 Count | the number words thirtieth, fourth, fifth and four, counted live in the nine committed verses (1, 1, 3 and 5 times) | `countWord`, `countTable` |
| 3 Place | every verse has an address that is its citation; a flight along the tree from one entry to another, reported as "steps along the tree" and "straight distance in the chart" | `treeLayout`, `relativeFrames`, `flightPlan`, `placeNumbers` |
| 4 Layers | the four layers; the tree marked and filtered by layer; the count per layer | `layerCounts` |
| 5 Seal | the chain grown epoch by epoch, the ten checks, a certificate signed with a key made in the page, the chain's name under the verdict at every lens, and the eight tampers | `buildLexiconBundle`, `issueCertificate`, `LEXICON_TAMPERS`, `readHyperpack` |
| 6 Send | the wire sent to the four receivers, each verifying it and signing its answer; a noise switch that damages two of the four copies; the count against two and against three, with the sentence on what the count does not show directly under it | `answerHyperpack`, `witnessQuorum` |
| 7 The fourth square | the author's line 6 run live in five figures: three squared distances and the area of their triangle; the mirror word with one corner hidden; three quarter parities and the fourth; the squares 1, 4, 9 and 16; a flat corner beside a corner of the {4,5} tiling | `gramTqf`, `seedMirror`, `fourthFromThree`, `quarterParities`, `squareNumbersNext`, `lambertAngle`, `tilingConstants` |

At the Stargazer lens four stations are shown (Read, Count, "Kinds of sentence",
"Stamp it") and three of the eight tampers ("Change a word", "Drop a thing", "Add a
thing"). One line by the stations says what the Navigator level adds (the chain, the
Overwatch checks, four receivers, the path to John 3:16 and the fourth square) and
has a button that switches to it. "Stamp it" also holds, in a closed box, the one
figure of the last station a Stargazer is shown: the mirror word with one corner
hidden, "Three corners give the fourth".

**The gold boxes** follow one line from station to station, from Ezekiel's river to
John 3:16. They quote several writers, each named where it is quoted; where a box
quotes van Paassen, the words in quotation marks are his and were compared with a
scan of the book. The first box has a button "Go to John 3:16" and a link to First
Explorers. While John 3:16 (`43.3.16`) is the chosen entry the gold box is the box of
that verse at every lens, with a button "Fly here from the river" that walks the tree
from the river term to the verse; the verse's own Entry has buttons to the two
entries that point to it (the author's line 3 and the outline). A row under the
author's lines 5, 6, 9 and 10 or under the outline whose last words send the reader
somewhere ("Open the Wheel tab", "See it on the sky page") carries a button to that
place, and only where the lens on show has the place.

**The tampers** are one table, `LEXICON_TAMPERS`. Seven are refused, each at the
check the table names: a changed word at `crystal`; a dropped entry, an added entry,
two exchanged addresses and a READING relabelled as TEXT at `lexicon`; a removed
ledger entry at `trace`; an altered signature at `signature`. The eighth is the
documented limit: the same relabelling done in the text, with everything rebuilt and
sealed again under a new key, is **accepted**. It is a different package under a
different key. A seal protects what was sealed. It cannot tell that a label is
deserved, or whose key it is. On the page the relabelling tampers act on the page's
own reading (row `0`), never on one of the author's lines. The verdict of a tamper
is the front door's answer to the changed package, and its sentence is worded for
the lens on show.

**The key of a seal** is made in the page, with the browser's own cryptography, each
time the visitor seals, and is kept in the page's memory only: nothing is stored, and
the key is gone when the page is closed or reloaded. The package holds the public
half and the signature. So the signature shows that the text is unchanged since it
was sealed. It does not show who signed it, and once the page is closed nothing can
be signed with that key again. Beside a seal the page made itself it prints "Signed
by key S-… (a key made for this visit)"; it never prints those words for a package
that came in as a file. The Celestial Control Panel does the same for a sky, with one
key for the whole visit.

**What a certificate covers**, in the page's words: certified are these bytes, their
order, their addresses, the label each entry was given, the lineage and the ledger,
unchanged since they were sealed with this key. Not certified: that a TEXT entry
matches its source, that a SAID entry is faithful, that a CHECKED number is right,
that any READING is true, or who sealed it. A fourth sentence, labelled SAID because
it is this project's report about itself, says what the labels of the shipped
lexicon rest on: the tests compared the verse entries with the Project Gutenberg
King James files (November 2026), and the builders compared each quotation with the
source named. That review, not the seal, is the reason to trust the labels, and it
can be repeated: "Running the letter-for-letter test" below says how.

**Links.** Both new pages read one grammar, `#key=value&key=value`. A key given
twice, an unknown key or a value that does not fit is ignored, and the page says "a
link value was ignored". This page reads three keys:

| Link | What it does |
|---|---|
| `#entry=ADDRESS` | selects and centres that entry. The page writes it into the address bar on each selection, so Back returns to the entry before and an entry can be cited by its link. Back and Forward through entries the page wrote itself bring back the entry and keep the reading level that is on show; a link that is typed or pasted sets the level it names. An address the lexicon does not have is ignored with a note |
| `#sky=JD,LAT,LON` | a Julian Day, a latitude and an east longitude, judged after they are rounded as the Celestial Control Panel rounds them. The page recomputes that sky's lexicon from the three numbers and shows it as its own; sealed here it gets the same chain id as on the sky page. A banner says that the sky was built from a link, a place and a time, and that the same place and time always get the same name; it has a button back to the Ezekiel lexicon and a link to the Celestial Control Panel. For a sky the reader, Count, Read and The fourth square are put away, and the Send station is a Navigator station, as for the Ezekiel lexicon |
| `#lens=` | `stargazer`, `navigator` or `holographer` |

Links the page writes to the Celestial Control Panel, each with the lens:

- `#preset=ezekiel`, from the date term; the sky page opens at its second step with
  that day and its Moon on show;
- `#lab=square`, from the term "they turned not when they went" and from two rows
  under the author's lines 6 and 9;
- `#jd=JD&lat=LAT&lon=LON`, from the banner over a sky: the place and the time of that
  sky in the sky page's own keys, so the visitor can go back and forth. No seal and
  no chain name is ever put into a link;
- the lens alone, from the gold box of the Send station.

The dialog "What is real here?" ends with the section "Other pages": First
Explorers, the Celestial Control Panel and the index of Experimental Systems, each
as a plain link. On a screen of 1240 px or wider the header links to that index too.

**Lexicons from outside come in by file only.** "Load a package file" is one file
input; there is no paste box and no link that carries a package. The file's size is
checked, its text goes through `readHyperpack`, and nothing of it is drawn until the
visitor presses "Show it" under a notice of three sentences: "This lexicon was not
made by this page. Its words and its labels are its sender's. The checks below show
only that the lexicon, its labels and the ledger up to the signed point have not
changed since some key signed them." While it is shown, a banner that stays in view
as the page scrolls repeats the notice (on a phone in a shorter form, with the whole
notice once below it) and holds the button back. Everything that could lend the
sender this page's voice is withheld: the badges are drawn outlined ("labelled TEXT
by its sender"); the legend is headed "What these labels would mean on this page's
own lexicon. Here they are the sender's claims."; the rows under an entry stand
under the one heading "Entries under this one, as their sender labelled them"; the
tree shows plain hollow dots and the switch that marks it by layer is not offered;
no station, narration or gold box is shown for it, and the reader stays the built-in
passage. An outside lexicon gets the tree, the Entry and the list of checks. Its
signature row reads "signed by key S-…; this page cannot know whose key that is". A
string of its ledger longer than 96 characters is shown as its first 95 and a mark,
with a line saying so. A First Explorers journey loaded this way shows its checks
and one line saying what it is.

### The supplied passage

The author supplied Ezekiel 1:1-9 in the wording of the New International Version.
Two decisions were taken about it, and both can be changed.

1. **The King James Version is the sealed text.** Every verse row of the lexicon is
   King James, from the Project Gutenberg e-text, and only those rows are sealed,
   packaged, downloaded or placed in a link.
2. **The supplied wording is shown beside it, from a separate file that is never
   sealed.** `passage-as-supplied.js` holds the nine verses as supplied (the footnote
   mark left out) and, for each of the 29 terms of those verses, the matching words.
   At the Stargazer lens the passage opens in the wording the author supplied; at
   Navigator and Holographer it opens in King James, the sealed text. A switch
   between the two wordings is there at every lens, and at Stargazer one sentence
   under it says that the Bible has been put into English many times, that these are
   two of them, and that Kebar and Chebar are one river. Counts are always made in
   the King James words. The file is **not under the repository's MIT licence**. It
   quotes under the allowance the publisher prints in NIV Bibles for short quotations
   (up to 500 verses, less than a quarter of the quoting work), with the publisher's
   notice shown at the foot of the reader and of a verse's Entry whenever the wording
   is shown (at Stargazer behind the closed line "About these words").

One exception is named in the tests: the author's line 9 (row `100.9`) quotes seven
words of verse 9 in that wording and is sealed as the author's line. No other row
holds five words in a row that stand in the supplied passage and not in the King
James verses.

**The residual risk.** No separate permission was asked, and the publisher's current
terms were not confirmed: the allowance was read from the copyright pages of printed
NIV Bibles, and the publisher's own site was not reached. The page says this in its
note under the wording.

**How to remove it.** Set `SUPPLIED_VERSES` to `{}` in `passage-as-supplied.js`. The
wording switch and the notice then disappear, the reader shows King James only, and
the two tests of the supplied passage skip with a message. Nothing sealed changes,
because nothing of that file is sealed.

## The Ezekiel lexicon

`Library/Experimental_Systems/Lexicon_Explorer/ezekiel-1.js` holds 335 rows, each
`[address, layer, kind, name, text]`: 49,291 bytes as LEXICON/2 text, 69 packets.
It lists words, translations and sources for Ezekiel 1:1-9 in the King James Version,
and ten lines the author wrote under the passage, each with the nearest things that
can be checked. It does not explain the vision.

| Layer | Rows | What they are |
|---|---|---|
| `text` | 72 | 38 verse rows and the 34 terms, each term a case-sensitive part of its verse |
| `said` | 81 | what dictionaries, translations, early writers, historians, this project's own specifications and its searches say; every sentence names its speaker, or is on a short list of reviewed sentences that continue the sentence before, or tells how to repeat a search |
| `checked` | 68 | counts over the committed rows, numbers the cores compute, and plain rows that restate them |
| `reading` | 114 | 12 book and 20 chapter headings, 45 links, the rules of the lexicon, the bridge note, the author's ten lines and this project's notes on them |

There are 19 kinds. Rows of kind `plain` (64 of them) are the short reading for the
first level: under every term and every one of the author's lines the first one to
three children are plain rows of at most two sentences. A `link` row is a READING
whose text is exactly one address that exists. A `count` row (24) is recounted by the
tests from rows the page ships. A `search` row (7) reports a search of a text the
page does not ship and is always SAID. A search finds words, not meanings: what this
project takes a word to mean stands in a READING row beside the search (row
`100.1.16`, on the word alien, is one).

**Top-level entries and epochs.** Fourteen top-level entries give fourteen epochs,
and the ledger of a sealed lexicon has 15 entries (one `genesis`, fourteen
`chain.grown`):

| Epoch | Address | Entry | Bytes it adds |
|---|---|---|---|
| 1 | `0` | About this lexicon: its rules, the King James notice, the note on Jewish tradition, the 1949 book, the bridge | 3,299 |
| 2 | `5` | Deuteronomy | 326 |
| 3 | `14` | 2 Chronicles | 254 |
| 4 | `19` | Psalms | 335 |
| 5 | `20` | Proverbs | 196 |
| 6 | `26` | Ezekiel: verses 1:1 to 1:9 and five further verses, with the 34 terms and what is said, checked and read about each | 21,865 |
| 7 | `27` | Daniel | 260 |
| 8 | `40` | Matthew | 873 |
| 9 | `41` | Mark | 217 |
| 10 | `42` | Luke | 222 |
| 11 | `43` | John | 1,643 |
| 12 | `49` | Ephesians | 452 |
| 13 | `66` | Revelation | 272 |
| 14 | `100` | The author's notes: ten lines and one outline | 19,077 |

Epochs follow address order. The author's notes are sealed last because 100 is the
largest index, not because they continue the Bible. Sealed, the lexicon has the chain
id `BC-00fa3b6cf9427251925ac928`; anyone who seals the same rows gets the same id,
whatever key signs. Any change to a row changes it, with the bytes and the hash
below.

`HANDLES` lists the 14 addresses the page hangs its buttons on. Rows may be reworded
or deleted; those addresses may not be renumbered. `ROWS_SHA256` is the SHA-256 of
`JSON.stringify(ROWS)` and must be set again after any change to a row; a test
compares it.

**Sources.** Every verse row is in the King James Version. Other translations are
quoted only in SAID rows that name them (the Douay Bible, the Septuagint and
others). Pierre van Paassen's *Why Jesus Died* (1949) is quoted in rows `0.4`,
`0.4.2`, `100.1.12`, `100.3.6`, `100.4.11` and `100.10.13`, eight quotations in all,
each compared with the scans; this document does not repeat them. Row `0.4` reports
only what the book and its writer say of themselves; this project's own view of the
book stands in the READING row `0.4.3`. Every quotation in a SAID row is pinned in
`tests/unit/ezekiel-lexicon.test.mjs` (`QUOTATIONS`), so a new or changed quotation
fails until it has been compared with its source and listed. The same file fails
when a sentence of a SAID row names no speaker and is not on its list of reviewed
sentences (`REVIEWED_WITHOUT_SPEAKER`). Every CHECKED row is mapped there to a
recomputation (`CHECKED_FACTS`).

### How the search counts were made

Seven rows of kind `search` report a search. Six of them searched the whole King
James Bible, which the repository does not ship, and one plain row (`100.1.1`)
restates one of the six in two sentences. The seventh (row `0.4.1`) searched two
scans of the 1949 book; it was compared by hand and cannot be run again from the
repository. Because these are counts over a text that is not here, the rows are SAID,
not CHECKED. Each of the six begins "A search of the Project Gutenberg King James
e-text made for this project (November 2026) found" and ends with how to repeat it.

**The e-text.** Project Gutenberg's King James Bible in 66 per-book files (eBooks
8001 to 8066, file names `bib0110.txt` to `bib6610.txt`, each marked "Edition: 10"),
read in November 2026 from the copies the Internet Archive keeps (items
`thebiblekingjame08001gut` to `thebiblekingjame08066gut`) and saved as plain text
under the names `thebiblekingjame080NNgut__bibNN10.txt.plain`. The e-text follows no
single printed edition and does not mark the translators' italics.

**The counting method.** For each book, every line that begins with a label of the
form `43:003:016` starts a verse; the lines after it, up to the next empty line, are
joined to it with single spaces. That gives 31,102 verses. A search is a regular
expression tried on the text of every verse; its result is the list of verses that
match, in order, and the test compares that list with the citations the row prints.

| Row | Searched for | Found |
|---|---|---|
| `26.1.1.5.8` | `the heavens were opened` | 2 verses: Ezekiel 1:1 and Matthew 3:16 |
| `26.1.16.1.3` | `a wheel in the middle of a wheel`; in Ezekiel, the first verse with `wheel` or `wheels` as a whole word | 1 verse: Ezekiel 1:16; the first wheel of the book is in 1:15 |
| `100.1.1`, `100.1.11` | `alien` or `aliens` as a whole word, in any case; in those verses, `stranger`, `strangers` or `strange` | 8 verses, once in each; 7 of the 8 also hold stranger, strangers or strange (not Hebrews 11:34); `alienate` and `alienated` are in other verses and were not counted |
| `100.6.16` | `three witnesses` | 6 verses, each of which gives the rule of two or three |
| `100.7.8` | `nothing but the truth`, in any case; also `the whole truth` and `so help you God` | 1 verse: 2 Chronicles 18:15; the other two phrases in no verse |
| `100.9.6` | `they turned not when they went`; `they turned not as they went` | 3 verses: Ezekiel 1:9, 1:12 and 1:17; the second phrase twice in Ezekiel 10:11 |
| `0.5` (a READING) | `bridge` or `bridges` as a whole word, in any case | no verse |

These are counts of English words in one translation.

**The files.** SHA-256 of each of the 66 files used (the name of each file is
`thebiblekingjame080NNgut__` followed by the name given here):

```text
bib0110.txt.plain  f583905f0896432af0fa79dafba804a7cc6c343ed6a156f7d2e9c0bb3b5815c2
bib0210.txt.plain  2f503402f79bae20fecff2dbd3740a8e4481f1fd8f9940f26a0bbbd5e8378119
bib0310.txt.plain  e1d159395f4a2f4ba057772ab3c2a1b4cf1dfaecb9712ed8378638db7e75c058
bib0410.txt.plain  214b9abca67234f995ccf0145b9b3ab432f712bc945cfd2cbe7ba4fc07d106f5
bib0510.txt.plain  c3816e30c45f88f89a6395d2aed60bfd52ca99a370a7644f83cb2e0aeb9cb2b9
bib0610.txt.plain  bb6debeb2b37a9d863faef5828a80549622f45beb556c17b317eaa090d7b818b
bib0710.txt.plain  e514532d01caadb3932aa714ac59f94b4599551a7b93ba76ba7e4fe53f638b12
bib0810.txt.plain  5aa55d86da582a551d915d89ba04c70f1af63fb4c07d4f0daa3ccd8c7e37dbb4
bib0910.txt.plain  56ecc9a1dde714a9e80b4a2fcd1e355da8e3dfa7d2e805b19e2670ed5e7ad2d1
bib1010.txt.plain  e7c42510f0e5e0fc8e93f0e40e80cc4a7a635fa3fe0c816278994aed798c6e67
bib1110.txt.plain  8e33b1b9dab03ca2f434c11b70eca95c2994b6ffe04228a2476dce91e099a125
bib1210.txt.plain  b16056be3bee55dc3d5ba078f816d7f641415d744a339368471a735f00889b20
bib1310.txt.plain  6b203ff20a8a27680f338424c103dfedb274d0f7cd30520471a40e5378640c7c
bib1410.txt.plain  6783ed6c7a74befc1bae9ac5cbda69867c7c62221f934ed51d50489b0c45b8b5
bib1510.txt.plain  8ee6516a073e25307fa69735e56e301c3a3d502be5c0af938328133330bb93f4
bib1610.txt.plain  3f1244cd823995d2debd6aa6d75545eca9bdc63568a504dec22c939536f95ae8
bib1710.txt.plain  92def0bee19102bff9c3b0aa1843207ee30bd70badf9093cca0d330aae0294fc
bib1810.txt.plain  2a414abdf21dcb00ad8896481e7b8697c4edb505fe65ea3df4b9e2989da8d99c
bib1910.txt.plain  60a85468bb889e679a2c9cff5348715c800438e0691e416db4b3da3425c48c11
bib2010.txt.plain  79f88756fa75546fba1fccbbad9e7270a678b6c89464c0afda40ea37bd228f3b
bib2110.txt.plain  cc9a7aed575bea61d64e55cb3f7198254748478dbd71568a8fd6836b285e43e7
bib2210.txt.plain  98cc010bd0c09dc9dde97f6878e3d82b9a70f812775d471208ca8fff91cca52e
bib2310.txt.plain  b397f0a92aeeb897759fd6eb54ec4c3c38950cb70056e5fbc7b008e7018554e7
bib2410.txt.plain  73416b21e58dfc84ab8ce9a70e48def83b96b0384c24841d822ab48efa9e225c
bib2510.txt.plain  870c2b72ba58ca96144978b1cb9da35d87fbef267f67ea8efc6a65c08a70bfe1
bib2610.txt.plain  7e399adc811687248b607fb939dffb8253dd6146e24e12a0bb9d17ad6333ddd8
bib2710.txt.plain  ea6ff3dd35d7ca989d52fc35ea6f48988cbdc5b35a78c6d583a7b266192f4707
bib2810.txt.plain  efb864715d7a1d3497ae18ddfcee4a5b04d66aeee9ede4237e4ae269ccaa6dd4
bib2910.txt.plain  4b1de1dba2cdc48d1a811f79ea6f075e64a27864bd19bc9a184cceb23fafcb94
bib3010.txt.plain  b767c32c656bb4c6fe5edef3290016c9091ab971f1a86de2292c27975a58fb21
bib3110.txt.plain  688b5ef1327e025089e18cef23b468c2a1312d14f40543c804801277482ebfbb
bib3210.txt.plain  fcee78f6e37bd6da888172017eeae60939b40ee404be477c47785ae322c8948c
bib3310.txt.plain  0c9ee66d1038495ada6b3969843b13e57d30c07c8cf5e3b95a10114b70739f0d
bib3410.txt.plain  e0014d1c5774b0f5ae32f956105534b1358de561c01d5385f497b016f0c9a6ea
bib3510.txt.plain  b542466c1bf093f3c4b877792a1e54e768210cf0c1576b9f7c9ba77741df8db4
bib3610.txt.plain  53bf297331fc9dd54925e7cac40e61969901365f2d6afcb275d5da75e2f41a25
bib3710.txt.plain  2fb83609d4470a54cac446304bfff4e973b6a59bccacff0f20de6c9a6f1738e5
bib3810.txt.plain  962df5a3e572cbab0f69066e94c6cbce0f5a39c4e3e2972108bb39fb0f46d362
bib3910.txt.plain  432d52fa758f5ece632dc4fc5ab6ccfef713426954633bcd4a71dea81bdf30d9
bib4010.txt.plain  527dcaa971c90ba858a7638d47a4960a4ec11bbc285e759907f74988d1db6a16
bib4110.txt.plain  d277a448407992b91e1bf74b75348984202d597f4586f9642876d336a198c599
bib4210.txt.plain  dcfac927fe4bd77c800d416c09b4386b8c66b9f976b7cfbd5e2d848d94328742
bib4310.txt.plain  1bc96cebe18972d5c9f05c96fa070cb8d90b5294eab8ec6bbc89d840854a0940
bib4410.txt.plain  39b5015e6149df02def38882eac53030ed2ff852fa2390d6dc0be5e2288f7a96
bib4510.txt.plain  cd1e3ce823cee89439bda7e42f2d08934d9f6ae3b07d2eeffcc071de3e31c4d6
bib4610.txt.plain  937d8966d2ff57db8d1ef9fc138abd08d77200aebaeda3f0de849fe3c71f4295
bib4710.txt.plain  4982dffcca1d52159ced75c79e9a61fea54b77239047020bbc18a3e71f6b4f4a
bib4810.txt.plain  8a1390ed3a340db379c964a292efef3f73fbf4815bb7a0d07472551b6149c008
bib4910.txt.plain  5760c262ee0ba9b7fde7e3b4410e48f001b5996eeee7b7f198429daa1f27d6f8
bib5010.txt.plain  9e987f404dee622ab27edea0d862c7d471787adb8bfd4cf1a1929e88b9638a09
bib5110.txt.plain  709fd73236d4dd84864cc8bb149b9350ba418904fd30cfc228b8bd11026612da
bib5210.txt.plain  2316f5c2e45bdbb4b0a70e6a340d9adc64fbee0821c0ae4e546742b326d4aac5
bib5310.txt.plain  8a92651c7c80f1039633284216f8f1526972b11aae8e84ec303c9ce2fb0b7ef0
bib5410.txt.plain  addc5b9f6e59bf5d4100d2080baa19166cccbaf719cf7b2591d077af1efb0607
bib5510.txt.plain  7890e2c8f1c74a24408ac60c32f1fe1ace4f4a0000c15ad335d92a06685c1ebf
bib5610.txt.plain  519a1679680e99c4552c4faa844de7fcea25870801f68e949589ebe186370f08
bib5710.txt.plain  9da58dd4629d736413225cd59720897a9a69b8c98bca0d7f23ea0e801a456996
bib5810.txt.plain  93c794d9c5e6a925e0d8183b19a8680a2c04ed1a36c0a4d5999c4949bd9f1498
bib5910.txt.plain  dbdc780c5bb0e7cd194b574476d4221b19a3639084e6bd31bcab90cdd782c343
bib6010.txt.plain  0177693447b00fcad414b71d8925a05721f8a63fab983e92cfe9e65e96f85a85
bib6110.txt.plain  c6ab80ae66934289c62913543f0a4efcb7b2c546d1f34411bc66a69f7c86f6e1
bib6210.txt.plain  2acc5fc61d0ced92757656e111162107e9302ee20fb9391c5f23f9e4637fa65c
bib6310.txt.plain  29bb4f05f08cee87857cad125388a2f2453102a2f6da9ee2f161ff29b1b39685
bib6410.txt.plain  21d043aceb0b477f8cad4a9225aee64c3e5434ff0b00380d7274bd773a8fc4b4
bib6510.txt.plain  dba12ec625d80bebb871ef7555d95540f973f69b36ad4cdb589cf9bba64e30f3
bib6610.txt.plain  528172a138704298ff9bcd5eb8150a1d327984f668ecfb4ae188546b7ec78efb
```

During the research every verse row was also compared with a second Project
Gutenberg e-text, the single file `kjv10.txt` (SHA-256
`250aa38774726a24c588d78fe864a7239a6033a877e532097765a7a46a9587d0`); all 38 rows stand
in it as running text. The test does not read that file.

**Running the letter-for-letter test.** The repository does not ship the King James
e-text, so the comparison of the verse rows with their source runs only when it is
told where the text is. Point `OWL_KJV_DIR` at a folder that holds the 66 per-book
Project Gutenberg King James files, eBooks #8001 to #8066: one file per book, its
name ending in `bibNN10.txt` (`bib0110.txt` for Genesis to `bib6610.txt` for
Revelation), with or without something before that and with or without the ending
`.plain`:

```sh
OWL_KJV_DIR=/path/to/the/66/files node --test tests/unit/ezekiel-lexicon.test.mjs
```

The last test of the file then compares every verse row with the e-text letter for
letter (John 18:36 as its opening words, up to the first colon), compares the name of
every book row and the label printed before John 3:16, and runs the searches above
again. Without the variable that one test is skipped with a message that says what
to set, and the rest of the file runs. This is the review the page points to when it
says that the labels can be checked again by opening the sources.

## Decisions taken on the author's behalf (lexicon, formats, the ten lines)

Each of these was a choice made while building, not something the author asked for
in these words. Each can be changed; the note after it says where.

1. **The King James Version is the sealed scripture text; the wording the author
   supplied is shown beside it from a separate, unsealed file**, under the
   publisher's printed allowance and without the publisher's confirmation. See "The
   supplied passage".
2. **The ten lines are shown in the author's words and order, with spelling
   corrected in two places** (row `100` says so). Each line stands in quotation marks
   under the label "READING · the author's note" ("OUR IDEA · the author's note" at
   Stargazer), beside the nearest things that can be checked or attributed. Line 1 is
   called the author's wordplay. Line 8 is shown only as the author's words, on its
   own card and in the list of the ten lines, with one framing directly under the
   quotation saying that the page quotes them and is not saying them to the visitor;
   the narration never speaks it. For line 2 a reader meets, in this order, Ezekiel's
   own wheels set beside the line, what a magazine reports about crop circles, and
   the sentence that the line is the author's own belief, on which no check depends.
   To change any of this, edit the rows under `100` and the tests that pin them.
3. **Lines 3, 4, 5, 6 and 10 are read as one outline: reference, book, chapter,
   verse** (row `100.11`). Lines 6 and 10 are answered with two rules of the author's
   own: the collinearity rule of SHD-CCP RFC 02, section 3 (`gramTqf`), and the
   mirror rule of the Loom Weave page (`seedMirror`). The outline is a READING.
4. **John is filed as book 43, so John 3:16 is `43.3.16`.** The number is that of
   the book's file in the e-text. Another numbering would change every scripture
   address and the chain id.
5. **How much of the bridge reading appears.** Each page states once, in its first
   gold box, that it reads Jesus of Nazareth as the line through the zero point, and
   adds that this is the project's reading, that no check depends on it, and that the
   word bridge is not in the King James Bible. The later gold boxes follow that line
   and keep the same label; on the Lexicon Explorer they end at John 3:16.
6. **The note on Jewish tradition (row `0.3`), and no code to crack.** The row says
   that Ezekiel 1 belongs first to the Hebrew Bible and reports, from the Jewish
   Encyclopedia, the Mishnah's rule on who may have the chapter explained to them.
   Its first sentence and its last two stand above the nine verses, under the READING
   label because putting them there is this page's choice, with a button "What Jewish
   tradition says about this chapter" that opens the row. The lexicon lists words,
   translations and sources and does not present the chapter as a puzzle with a
   solution. The page and its narration never say that the vision happened or that
   it did not.
7. **LEX/1 and LEXICON/2 are drafts; one epoch per top-level entry; two witnesses
   are "enough" only as a demonstration.** The mark on the Send station reads "two:
   enough for the rule of Deuteronomy 19:15, as a demonstration" and counts simulated
   receivers. Directly under the count the page says that this shows how a
   two-witness rule is checked and does not show that independent parties have
   looked, and it adds that it borrows a number from that rule and nothing more.
8. **The reading levels are named Stargazer, Navigator and Holographer on this page
   too**, with the hints "ages 6 and up", "names, dates and sources" and "formats and
   hashes", so that the third is not read as a physics decoding of the vision. They
   are the three levels First Explorers calls Stargazer, Explorer and Architect.
9. **No package link and no paste box.** A lexicon from outside enters only as a
   file and is shown as its sender's.
10. **First Explorers and Loom Weave were left as they are.** The new pages reuse
    the four receivers and the mirror rule without changing either page.

## What guards what

Two kinds of check stand behind these pages, and each covers what the other cannot.

| Part | Guarded by |
|---|---|
| the three cores (`scripts/strix-overwatch.js`, `scripts/hyperbolic-moves.js`, `scripts/celestial-core.js`) | `node --test`: `tests/unit/strix-overwatch.test.mjs`, `strix-lexicon.test.mjs`, `hyperbolic-moves.test.mjs`, `celestial-core.test.mjs` |
| the two model modules (`lexicon-explorer-model.js`, `celestial-panel-model.js`): all state, every sentence, every link | `node --test`: `tests/unit/lexicon-explorer-model.test.mjs`, `celestial-panel-model.test.mjs` |
| the rows (`ezekiel-1.js`) and the supplied passage | `node --test`: `tests/unit/ezekiel-lexicon.test.mjs`, and with `OWL_KJV_DIR` the comparison with the e-text |
| what the two pages, the cores and the two documents say of each other, the numbers of the `facts` blocks among them | `node --test`: `tests/unit/explorers-integration.test.mjs` |
| the shells (`lexicon-explorer.js`, `celestial-control-panel.js`), the drawing modules (`lexicon-canvas.js`, `celestial-chart.js`), the DOM helpers of the kit, the style sheets (`explorer-kit.css` and the style block of each page) and the two `index.html` files: what a visitor sees and can reach, on a wide screen and on a phone, with a pointer and with the keyboard | the browser walkthroughs in `tests/browser/` |

`node --test` never opens a page. Of the shells, the drawing modules and the two
`index.html` files it reads only the text: `tests/static/explorers-policy.test.mjs`
and `tests/static/sinks.test.mjs` look for forbidden names, for the content policy
and for ids that do not exist, and the integration test for links it has not tried.
Whether a button is on the screen, a label fits, or the focus lands where it should
is seen only in a browser.

`tests/browser/` holds the three walkthroughs as optional scripts,
`lexicon-explorer.cjs`, `celestial-control-panel.cjs` and `first-explorers.cjs`, with
a `lib/` folder and a `README.md`. Each is run by hand with
`node tests/browser/<name>.cjs` and needs Playwright with Chromium. They are not run
by `node --test` or by the CI workflow, so after a change to a shell, a drawing
module, a style sheet or an `index.html` nothing has looked at the page until
someone runs them.

## Hosting

Each of the two pages carries its Content-Security-Policy in a `meta` element, the
first element of its head. A policy given that way cannot forbid framing: browsers
ignore `frame-ancestors` in a `meta` element. Whoever hosts the site should send the
response header `Content-Security-Policy: frame-ancestors 'none'` with these pages.
Until the host does, another site can show them inside a frame of its own.

## Checked numbers

Every number in this block is recomputed from the code by
`tests/unit/explorers-integration.test.mjs`. `tests.….declared` is the number of
lines in that test file that begin with `test(`; `node --test` reports more where a
test has subtests.

```facts
lex.layers = 4
lex.address.indices.max = 8
lex.address.index.max = 9999
lex.kind.characters.max = 16
lex.name.codepoints.max = 96
lex.text.codepoints.max = 1200
lexicon.bytes.max = 60000
lexicon.entries.max = 3000
lexicon.epochs.max = 16
packet.chunk.bytes = 720
pack.characters.max = 1500000
pack.members = 7
pack.certificate.members = 7
pack.depth.max = 12
pack.lineage.rows.max = 64
pack.ledger.entries.max = 4096
pack.file.bytes.max = 4500000
pack.ledger.string.characters.shown.max = 96
overwatch.checks = 10
package.checks = 13
witness.need.default = 2
witness.receivers = 4
witness.marks = 2,3
tampers = 8
tampers.refused = 7
tampers.accepted = 1
tampers.stargazer = 3
word.bits = 64
word.sectors = 16
word.rings = 4
word.quadrants = 4
word.rows = 8
word.fields = 7
word.parity.bit = 59
word.mirror.words = 16
word.wheel.cell.area = 0.1328
stations = 7
stations.stargazer = 4
stations.sky.navigator = 4
stations.sky.stargazer = 2
stations.outside = 0
tabs = 5
lexicon.rows = 335
lexicon.bytes = 49291
lexicon.epochs = 14
lexicon.epoch.bytes = 3299,326,254,335,196,21865,260,873,217,222,1643,452,272,19077
lexicon.packets = 69
lexicon.packets.with.agreeing.corners = 0
lexicon.rows.text = 72
lexicon.rows.said = 81
lexicon.rows.checked = 68
lexicon.rows.reading = 114
lexicon.kinds = 19
lexicon.books = 12
lexicon.chapters = 20
lexicon.verses = 38
lexicon.terms = 34
lexicon.plain = 64
lexicon.links = 45
lexicon.counts = 24
lexicon.searches = 7
lexicon.author.lines = 10
lexicon.handles = 14
lexicon.chain.id = BC-00fa3b6cf9427251925ac928
lexicon.ledger.entries = 15
reader.verses = 9
reader.terms = 29
count.thirtieth = 1
count.fourth = 1
count.fifth = 3
count.four = 5
supplied.verses = 9
supplied.terms = 29
tests.strix.overwatch.declared = 10
tests.strix.lexicon.declared = 37
tests.ezekiel.lexicon.declared = 31
tests.lexicon.explorer.model.declared = 53
```
