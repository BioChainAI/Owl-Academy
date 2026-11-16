# Owl Academy — Celestial Control Panel (draft)

## Overview

The **Celestial Control Panel** (`Library/Experimental_Systems/Celestial_Control_Panel/`,
subtitle "Celestial Holography: a Poincaré ball explorer", shown under the title on
a wide screen from Navigator up) starts at the centre of a
dark disc with three questions: where on Earth am I standing, what day of the year is
it, and what shape is the Moon tonight. The visitor answers the first two; the page
computes the sky for that place and day, the Moon included, and the visitor looks up
and checks it. Far things are drawn near the rim of the disc until a tap brings them
to the centre. The same facts are told at three reading levels, called lenses:
Stargazer ("ages 6 and up"), Navigator ("astronomy") and Holographer ("physics").

The page was rebuilt from a prototype the author supplied (a single HTML file,
"Celestial Holography — Poincaré Ball Explorer"). What was kept, rewritten and
removed is listed under "What changed from the prototype, and why".

It needs no account, stores nothing and publishes nothing. The place is typed or
chosen and is never read from the device. The only request to another host is for
web fonts; the page works without them.

| Step | Question | What happens | Code that does it |
|---|---|---|---|
| 1 Earth | Where am I standing on Earth? | a place by preset or by latitude and longitude; the compass points and the straight-up line appear | `chooseSite`, `typePlace`, `skyState` |
| 2 Sun and Moon | What day of the year is it? What shape is the Moon tonight? | the day, from the device clock and confirmed by the visitor, or chosen; the Sun and the Moon appear; the Moon is drawn as it looks from that place | `confirmDay`, `pickDate`, `timeButton`, `moonFigure`, `findMoon` |
| 3 Project | Which great circles and which depths frame this sky? | the stars, the depth rings and the rim; horizon, celestial equator, ecliptic and galactic plane as switches; a horizon frame and a galactic frame; a flat chart and a ball | `scene`, `circleDirections`, `frameMatrix` |
| 4 Dive | What does the move T_c(z) = (z − c)/(1 − c̄z) bring to the centre? | anything is brought to the centre by a tap or a button; a lab on slides that never turn | `dive`, `tapView`, `centreOn`, `slidePath`, `homecoming` |
| 5 Seal | Can someone else rebuild this sky and get the same chain? | the sky as a small tree lexicon, grown into a chain and certified; a file and a link | `sealSky`, `skyLexiconRows`, `buildLexiconBundle`, `issueCertificate` |

At the Stargazer lens the five steps are called My place, My day and Moon, Look
around, Slide the map and Stamp it. They can be visited in any order; at the second
step (once the day is answered), the third and the fourth, the card under the map
ends with a button to the next one ("Next: Look around"). STRIX, the scripted guide
of the page, is named beside the first line it speaks.

| File | What it is |
|---|---|
| `index.html`, `celestial-control-panel.js` | the page and its shell: steps, controls, inspector, dialogs, seal |
| `celestial-panel-model.js` | all state and all wording, DOM-free; tested in `tests/unit/celestial-panel-model.test.mjs` |
| `celestial-chart.js` | drawing and pointer only: the chart, the Moon picture, the lab |
| `scripts/celestial-core.js` | the astronomy; imports nothing; tested in `tests/unit/celestial-core.test.mjs` |
| `scripts/hyperbolic-moves.js` | the geometry of the chart and of the lab; tested in `tests/unit/hyperbolic-moves.test.mjs` |
| `scripts/strix-overwatch.js` | the formats, checks and seals of step 5 (see `STRIX_OVERWATCH.md`) |
| `../explorer-kit.js`, `../explorer-kit.css` | DOM helpers and the look, shared with the Lexicon Explorer |

Every sentence a visitor reads carries one of four labels (TEXT, SAID, CHECKED,
READING), defined in `STRIX_OVERWATCH.md` under "LEX/1". This document uses the same
words: CHECKED for what the code computes, SAID for what a named source says, READING
for a choice or an interpretation of this project.

## What the page computes, and to what accuracy

**Computed** (CHECKED), for a latitude, an east longitude and an instant given as a
Julian Day in Universal Time:

- the Sun: apparent ecliptic longitude, right ascension and declination, distance,
  altitude and azimuth; sunrise and sunset; the nearest equinox or solstice;
- the Moon: longitude, latitude and distance; altitude and azimuth as seen from the
  place (parallax applied); the lit fraction, the elongation from the Sun, the age,
  the phase name, and the lean of the bright side as the observer sees it; the next
  evening on which the Moon has a chosen phase;
- sidereal time, the place of the zenith among the stars and the altitude of the
  pole;
- where six distant objects stand in that sky (Sagittarius A*, the Vela pulsar,
  Cygnus X-1, the Pleiades, Polaris, the Andromeda galaxy), by precession and
  nutation from their J2000 positions, and where two poles lie (the north galactic
  pole and the north pole of the ecliptic).

It works for the years −1999 to 3000 (2000 BC to AD 3000; year 0 is 1 BC), in the
calendar in force: Julian before 15 October 1582, Gregorian from that day on. Every
date the page shows or seals is the local date at the place.

**Not computed here** (SAID): the J2000 positions and the distances of the six
objects, the numbers for the cosmic microwave background, and every sentence about
celestial holography and gravitational-wave memory. Each comes from the source named
beside it in the object's inspector.

**The formulas** are low-precision ones, chosen to be short enough to read: Meeus,
*Astronomical Algorithms* (1991), for the Julian Day, sidereal time, rising and
setting, nutation, the Sun, the Moon and the phase; Espenak and Meeus (2006) for ΔT,
the slow drift of the Earth's rotation against uniform time; the IAU 2006 precession
angles; the galactic rotation matrix of the Hipparcos catalogue. The header of
`scripts/celestial-core.js` lists the chapters.

**Accuracy, and what it was compared with:**

| What | How good | Compared with | Where it is pinned |
|---|---|---|---|
| Sun, ecliptic longitude, 1800 to 2200 | within 0.01° | PyEphem 4.2.1 | on the 18 committed test vectors of those years the largest difference is 0.0062° |
| Moon, ecliptic longitude, 1800 to 2200 | within 0.01° | PyEphem 4.2.1 | largest difference on the same vectors 0.0042°, and 0.0007° in latitude |
| every value of the 29 committed vectors (18 modern instants and 11 ancient ones, five of them skies of 593 BC) | each within its own tolerance | the Python reference of the same formulas, PyEphem 4.2.1, and positions based on the Swiss Ephemeris | 2,900 checks, printed by `tests/unit/celestial-core.test.mjs` |
| sunrise and sunset | within 30 seconds | 26 risings and settings from PyEphem 4.2.1 | the same test |
| the Moon after about 2045 | ± 0.04° by 2100, ± 0.1° by 2200 | nothing: this is an allowance for ΔT, which cannot be known ahead | `deltaTSigma`, `moonLongitudeSigmaDeg` |
| the Moon in 593 BC | about ± 0.07° | nothing: ΔT is known only to about ± 8 minutes for that year | the same functions |

The 29 vectors are a reduced copy of the 69 used while the core was written; the
larger run (6,900 checks, also against Skyfield and the native Swiss Ephemeris) is
recorded in the core's header and is not repeated by the committed test.

**Limits the page states** (in the dialog "What is real here?"; most are the
sentences of the core's `LIMITS`):

- The ΔT allowance is this project's, not a measurement. The page shows an
  uncertainty note whenever the allowance moves the Moon by 0.01° or more: before
  about AD 915 and after about 2045.
- Star aberration (0.006°) and proper motion are neglected.
- Sunrise and sunset are when the Sun's centre is 0.83° below the level horizon, the
  usual allowance for the bending of light in air and for the Sun's size. All other
  altitudes are airless.
- Polaris is 0.6° from the pole today and was 15.0° from it in 593 BC. The inspector
  prints its distance from the pole on the chosen date.
- The ΔT polynomial is 6 s too large today, which moves the Moon by 0.001°.

One limit the page does not state: the chain id of a sealed sky depends on the last
digit of numbers printed after trigonometric functions. It has been computed only in
the V8 engine (Node, and Chromium while the page was built), so it has not been
shown that every browser engine prints the same rows.

## The chart is a reading

The chart shows two things about each object. Its **direction** is computed. Its
**depth** is a choice: a logarithmic scale of the measured distance,

```
ρ = max(0.1, 0.5 + 0.135 · log10(distance in light-seconds))      disc radius = tanh(ρ / 2)
```

drawn in the Poincaré disc (2D) or ball (3D). The page's own words: "Direction:
computed. Depth: a logarithmic scale of the measured distance. The curved geometry is
how this chart makes room; it is not a claim that space has this shape." The whole
scale carries the label READING.

**The depth scale and the shell radii are this project's choice.** The two constants
0.5 and 0.135 were chosen so that the Sun falls near the prototype's second shell
(0.42) and the Galaxy's objects near its third (0.76):

| Object | Disc radius | Object | Disc radius |
|---|---|---|---|
| Moon | 0.25 | Cygnus X-1 | 0.77 |
| Sun | 0.41 | Sagittarius A* | 0.78 |
| Pleiades | 0.73 | Andromeda galaxy | 0.83 |
| Polaris | 0.73 | microwave background | 0.90 |
| Vela pulsar | 0.74 | | |

So the Sun, about 400 times farther than the Moon, is drawn 1.6 times as far out.
Eight rings mark 1 light-second, 1 light-minute, 1 light-hour, 1 light-year, 1,000,
1 million and 1 billion light-years, and the microwave background at its present
distance of 45.3 billion light-years. The dialog "Blueprint" draws the prototype's
four shells as named ranges over these rings (the centre; 0.24 to 0.45; 0.64 to 0.82;
0.82 to the rim). Other choices of this project on the chart: the places of the
proposals on the rim (the poles of the ecliptic and of the galactic frame), and that
the microwave-background shell is the outermost ring. That shell is not the rim: the
rim is the sphere of directions.

**The flat chart** (2D) is a map of direction round the frame's plane and of depth.
Height above the plane is not shown: in the horizon frame north is up and east is to
the right, a body below the horizon is drawn hollow, and the zenith is a dot at the
centre, because straight up has no compass direction. **The ball** (3D) keeps all
three dimensions and draws each great circle on it; there the zenith is a line.

**What the geometry does, stated exactly.** In 2D the view is always the slide T_c
that brings the chosen point to the centre, a member of PSU(1,1), the 3-parameter
group of the disc; going from one such view to another is a slide and a turn. The
6-parameter group PSL(2,C), which acts on the celestial sphere, needs the ball.
Every move sends circles to circles, and three points of the rim fix where every
fourth goes: from Navigator up, step 4 marks four points of the rim and prints the
fourth's place as predicted from the other three (`mobiusFromThree`) beside its
actual place. An object's detail is drawn only when it lies within hyperbolic
distance 1.5 of the view's centre; elsewhere it is a glyph and a short name.

## The five steps and the lab

**1 Earth.** The first screen is the dark disc with one dot and three buttons: "Start
at Greenwich", "Pick a place" (15 presets; the sixteenth site, by the Kebar, opens
only by its preset or a link) and "Type my place" (two numbers with North/South and
East/West switches). The page then shows where the zenith lies among
the stars (declination equal to the latitude, right ascension equal to the local
sidereal time), the altitude of the pole, and how far Polaris is from the pole on
that date.

**2 Sun and Moon.** The day is read from the device clock and shown for confirmation:
"Your device says today is … Is that right?" Where the date at the chosen place is
not the device's own date (a place far to the east or west, or the preset by the
Kebar), the question gives both: "At … it is now …. Your device says …. Is that the
day you want?" Once the day is answered, the card under the map begins with that date
beside the Moon picture. Day buttons: Today, Day before, Day after, Pick another day.
Time buttons: Now, Sunrise, Noon, Sunset, Midnight; noon and midnight are 12:00 and
0:00 local mean time, the time by the Sun at that place. From Navigator up there are
also a year with BC or AD, a slider through the year and a typed time. A day that
does not exist gets a plain message and never rolls over silently; a year typed as 0
or below gets the same message ("That day does not exist."), because the year before
AD 1 is 1 BC. When the Sun does not rise or set, the button says so. **The Moon is
computed from the date.** The third question is therefore a check: "Does my Moon look
like yours? If not, check three things in this order: the place (north or south of
the equator turns it over), the day, the time." When the Moon is below the horizon
the picture is dimmed and the question is not asked. Eight buttons, one per phase,
"Find the next night with this Moon": each moves the time to one hour after sunset on
the evening nearest that phase and never to an earlier night, and says so: "This
changes the day."

**3 Project.** Depth rings and sight lines; four great circles as switches. In 3D a
circle is drawn on the ball. On the flat chart a circle other than the frame's own
is shown by the two points where it crosses the chart's plane, labelled in words,
and the frame's own circle is the rim. From Navigator up the frame can be the
horizon or the galactic plane.

**4 Dive.** A tap on the chart brings that point to the centre at once. A press on
a quick button (Home, Moon, Sun, Sagittarius A*, The rim) or on the list first
centres the point half way between home and the object and then the object. "The
rim" is the point of the microwave-background shell in the direction of the current
selection, or straight up when nothing is selected. A flight lasts at most 600 ms
and becomes a jump when the visitor's device asks for reduced motion. Once the view
has left home, the caption under the chart ends by saying what is in the middle of
the map, or which way the map has slid.

**The lab** is named with words of Ezekiel 1:9 in the King James Version, "they
turned not when they went". Opening it clears the sky and shows a plain disc with
the caption "This is the curved map by itself. It is not the sky." A walker slides
forward, left, back and right without ever turning.

| What the lab shows | Number | Function |
|---|---|---|
| four slides of 1 (forward, left, back, right) end this far from home | 0.874463 | `slidePath`, `homecoming` |
| slid straight home, the walker is found turned clockwise by | 78.0148° | `homecoming` |
| the step length: default, smallest, largest (largest on a canvas under 400 px) | 1, 0.25, 1.5 (1.25) | `LAB` |
| the side of a square of the {4,5} tiling, in which five squares meet at each corner | 1.253739 | `tilingConstants(4, 5)` |
| four slides of that length at headings 0°, 108°, 216° and 324° come home turned clockwise by | 72° | `slidePath`, `homecoming` |
| the step at which five slides (forward, left, back, right, forward) come home | 1.061275, found to within 0.005 | `rightAngledPolygonSide(5)` |
| one slide of the "Four slides" animation lasts | 2,000 ms | `LAB.slideMs` |

On a flat floor the four slides would bring the walker home, not turned. No slide
turns the walker: the turn found on coming home equals the area the path went round
(1.362 for the unit slides, the same number as 78.0148° in radians). After "Slide
home" the lab prints that area, worked out from the corners of the path itself
(`labArea`) and not from the turn. For a path that goes round more than half a turn's
worth, the area and the turn shown differ by whole turns, and from Navigator up the
line says so; for a path with no inside (out and back along one line) or one that
crosses itself, no area is printed. A walker who is not turned is told so in a whole
sentence ("You are home, facing the way you began."). With reduced motion, "Four
slides" draws all four at once and the status line says so. This is a fact about the
curved map, not about the sky. The lab is the CHECKED fact the fourth gold box sets
beside the verse; what the page makes of the pair is a READING.

**5 Seal.** See "What the seal of a sky does and does not show".

**The gold boxes.** Each step has one box headed THE BRIDGE in two parts: "Our
reading" (a READING, written once per lens) and "What it stands on" (TEXT, SAID and
CHECKED sentences with their labels). Every TEXT sentence is cut out of a King James
verse row of the Ezekiel lexicon by the code, never typed again, and links to its row
in the Lexicon Explorer. The first box states the reading once: that First Explorers
read Jesus of Nazareth as the line through the zero point, that on this page that
line is the visitor's straight-up line, and that this is the project's reading, on
which no check depends. The gold boxes quote several writers, each named where it is
quoted: Pierre van Paassen (*Why Jesus Died*, 1949; see `STRIX_OVERWATCH.md` under
"The bridge narrative"), Parker and Dubberstein on Babylonian months, and Origen,
whom the third box names as the early Christian writer who set Ezekiel's river beside
the Jordan. Van Paassen's book never mentions Ezekiel; the links between Ezekiel and
the Gospels shown here come from early Christian writers and from this project. A
gold box that names the river writes "the Kebar (Chebar in the King James Version)"
where it first does, so that the river of the page and the river of the verse are
seen to be one.

## The link grammar

Both new pages read one grammar: `#key=value&key=value`, with values made of letters,
digits and the characters `. _ - ,`. A key given twice, an unknown key or a value
that does not fit is ignored, and one line on the page says "a link value was
ignored". The link is read when the page loads and whenever the fragment changes.
This page reads eight keys:

| Key | Value | What it does |
|---|---|---|
| `preset` | `ezekiel` | the Kebar site at the sunset that ends the fifth day on the date usually given; applied before every other key. The page opens at step 2 with the day answered, so the date and the Moon picture are on show |
| `site` | the key of a preset place | chooses that place |
| `lat`, `lon` | a latitude from −90 to 90 and an east longitude from −180 to 180, at most four decimals | a typed place; one without the other is ignored |
| `jd` | a Julian Day in Universal Time, at most seven digits and six decimals, inside the year range | sets the time. The range is judged twice: at Greenwich when the link is read, and at the place once the place is known. Within half a day of either end of the range a link to a place far east or west of Greenwich can therefore lose its time: the place opens at the present day, with the note |
| `focus` | the key of an object | selects it and brings it to the centre. Ignored, with the note, when the link gives no place, and for an object that is not on show in the sky the link opens: the seven depth rings (they are listed only while the "Depth rings" switch is on or the view has left home, and no link key does either), the galactic centre and the north galactic pole (shown only in the galactic frame, which no link key sets), the opposite point (it needs a selection of its own), and the shadow transform unless the link also carries `lens=holographer` |
| `lab` | `square` | opens the lab at step 4 |
| `lens` | `stargazer`, `navigator` or `holographer` | sets the reading level |

Links the page writes:

- "Copy a link to this sky": its own address with `jd`, `lat`, `lon` and `lens`, the
  Julian Day rounded to 5 decimals and the two angles to 2;
- to the Lexicon Explorer, `#sky=JD,LAT,LON` with the same three rounded numbers (the
  sealed sky, rebuilt there), and `#entry=ADDRESS` from every TEXT sentence to its
  row; both carry the lens. The last gold box links on to John 3:16 there
  (`#entry=43.3.16`);
- to First Explorers and to the index of Experimental Systems, as plain links.

Links the page receives from the Lexicon Explorer: `#preset=ezekiel` (from the date
term), `#lab=square` (from the term "they turned not when they went" and two rows of
the author's notes), the lens alone, and `#jd=…&lat=…&lon=…` from the banner over a
sky that was opened there, so that a visitor can go from a sky to its lexicon and
back.

A link with a place skips the first question. The scene by the Kebar appears only
by the preset or by a link that carries its Julian Day. The page never writes its
own address bar. Beside a sealed sky and beside "Copy a link to this sky" it says
what the two things hold: "This link contains the place and the time you entered.
The file also holds the moment it was stamped and the public half of this visit's
key." (At the Stargazer lens the same is said in three shorter sentences.)

## What the seal of a sky does and does not show

Step 5 turns the sky into a tree lexicon (LEXICON/2, a draft format; see
`STRIX_OVERWATCH.md`). `skyLexiconRows` writes 25 rows under four top-level entries
(where and when; Sun and Moon; six anchors in the Galaxy and beyond; the rim), with
every number in fixed decimals. `sealSky` grows them into a chain of four epochs, runs
the ten Overwatch checks, signs a certificate with a key made for the visit, and
offers the package as a file (`hyperpack-<chain id>.json`) and as a link to the
Lexicon Explorer.

The key is made in the page, with the browser's own cryptography, the first time the
visitor seals; it is used again for later seals of the same visit and is kept in the
page's memory only. Nothing is stored, and the key is gone when the page is closed
or reloaded. The file holds the public half and the signature.

The rows are a function of three rounded numbers only: the Julian Day to 5 decimals,
the latitude and the longitude to 2. The name of the place is taken from those
numbers, not from what the visitor typed. So anyone who enters the same three
numbers gets the same rows and the same chain id, whatever key signs. For the Kebar
preset the chain id is `BC-d8772576788818e2c5969e60`, and the page shows it large
with the words "Everyone who seals this same sky gets this same name. Compare with a
friend."

**What a passing seal shows:** that these rows, their order, their addresses and
their labels are unchanged since they were sealed with this key. The page words a
pass as "unchanged since it was sealed".

**What it does not show:**

- that a computed number is right, that a SAID row reports its source faithfully, or
  that any READING is true;
- who sealed it: the key is made for the visit and shows integrity, not identity;
- that the visitor stood at that place at that time. The three numbers are whatever
  was entered;
- agreement by anyone else. One seal is one witness. The page sends the visitor on
  to the Lexicon Explorer, whose Send station lets four receivers answer. That
  station belongs to the Navigator and Holographer levels, and the Stargazer
  sentence of this page says so ("the Navigator level shows pretend receivers
  checking it too"). The receivers run inside that page and are a demonstration, not
  independent witnesses.

A seal belongs to one place and one time: the page drops it when either changes.

## What changed from the prototype, and why

The prototype was a 2D disc with 12 hand-placed nodes, four steps, three
vocabularies, sound, and a dialog on its own design. Its geometry was real: the move
T_c and its geodesics were correct. Its astronomy was decoration: latitude moved
nothing, the Moon's phase and the sidereal time were free sliders, and the stars were
tied to the Sun, the Moon and the zenith. The rebuild keeps the design and replaces
every decorative quantity with a computed one.

**Kept**

| What | Now |
|---|---|
| the three questions at the centre | kept; the page opens with them |
| the move T_c(z) = (z − c)/(1 − c̄z) that brings the rim to the centre | kept, and now exact: the view is that move, a flight follows it, and a tap centres the point itself |
| three reading levels: Stargazer, Navigator, Holographer | kept, with a form of every step name, control label and narration for each |
| the layout: controls, chart, inspector | kept on wide screens; one column in reading order on a phone |
| the palette (`#03050a`, `#38bdf8`, `#fbbf24`, `#a855f7`, `#34d399`) and a glyph per object | kept; every glyph has a written name beside it |
| the telemetry strip | kept from Navigator up, with computed values |
| the dialog on the design: three pillars, four shells, the three levels | kept as "Blueprint", reworded, and labelled as this project's reading |
| the sentence that the zenith's declination equals the latitude and its right ascension the local sidereal time | kept: it was true, and the chart now uses it |

**Rewritten**

| The prototype said or did | Now | Why |
|---|---|---|
| the Moon's phase was a slider; the visitor was told to move the Moon until its shape matched the sky | the Moon is computed from the date and the visitor checks it; eight buttons find the next night with a chosen Moon | the shape of the Moon follows from the day; a free slider could show a Moon that cannot be in that sky |
| "Reset Today" set a fixed day and showed a wrong date and Moon | "Today" reads the device clock and asks whether it is right | the button was hard-coded |
| latitude moved nothing; longitude turned three nodes by half its change | latitude and longitude set the horizon frame, the zenith, the pole and every altitude | the controls were decoration |
| the node radius was the depth in the tree (about 0.4, 0.7 and 0.9) | depth is a logarithmic scale of measured distance, with labelled rings | a radius that looked like a distance was not one |
| the Moon goes round the Earth every 29.5 days | the Moon circles the Earth in about 27 days and its shapes repeat every 29 and a half | 29.5 days is the cycle of the phases, not of the orbit |
| the Sun glides through 12 starry neighbourhoods | the Sun seems to glide once round the sky in a year | the Sun's path crosses 13 constellations |
| everything in our galaxy orbits the black hole Sagittarius A* | everything in our galaxy circles the galaxy's centre, where this black hole sits | stars orbit the mass of the whole Galaxy; the black hole is a tiny part of it |
| the Vela pulsar as a "millisecond" beacon that spins faster than a kitchen blender | it turns 11 times a second, as a SAID sentence with its source | its period is 89 milliseconds; it is not a millisecond pulsar |
| the Pleiades as a nursery of baby stars | a family of young blue stars with the age astronomers give them | a cluster of that age is not forming stars |
| space shrinks toward the boundary | equal-sized things are drawn smaller toward the rim; "Only the map is squeezed. Space is not." | the squeezing belongs to the map |
| dragging the disc "executes" Möbius boosts of PSL(2,C) | in 2D the view is a slide of PSU(1,1); PSL(2,C) is named only for the ball | a disc carries only the 3-parameter group |
| the hologram at the edge stated as fact, at every level | "Celestial holography", a SAID object marked as a proposal, with the sentences of the papers that call it one | a proposal was presented as established |
| gravitational-wave memory stated as an observed effect | a SAID object marked predicted, not detected | no memory signal has been found |
| the edge called the two-dimensional boundary "null infinity" | "The celestial sphere", a CHECKED object: the rim is where directions live | the two-dimensional thing is the celestial sphere |
| one node for the antipodal map and the shadow transform | two objects, "The opposite point" (CHECKED) and "The shadow transform" (SAID, Holographer only), and a sentence that they are different operations | the prototype told one idea where there are two |
| the microwave background as a node on the rim | a SAID object on the outermost depth ring, with the measured numbers and their sources | it has a distance, so it has a depth; the rim is not a place |
| HUD names "Bubble Zoom", "Disk Radius", "Poincaré Boost" for one number | "the view's centre is … from home (disc radius …)" | one real number had three misleading names |
| telemetry "Conformal Density" at a node's home radius | the conformal factor 2 / (1 − \|w\|²) at the selected point's present place on screen, labelled as such | the value was mislabelled and did not follow the view |
| "unpack hidden sub-nodes" by pulling a node to the centre | an object's detail is drawn only within distance 1.5 of the view's centre | nothing was unpacked before |
| the three pillars | reworded; the third now says that the three vocabularies are this project's analogy and are not claimed to be one object | the old wording equated a child's picture with a physicist's formula |

**Removed**

| What | Why |
|---|---|
| the parent links from the Sun to Sagittarius A* and on to the rim, from the Moon to the Vela pulsar and the Pleiades, and from the zenith to Cygnus X-1 | they made fixed stars move with the Sun, the Moon and the clock: Sagittarius A* stood 25.8° ahead of the Sun on every date. Each object now stands where it is computed to stand, and no tree joins them |
| the "light beams" along geodesics from the Earth through the Sun and the Moon to the rim, and the chords between nodes | they had no physical meaning. The chart draws great circles, depth rings and sight lines from home, each named |
| Tailwind (loaded from a CDN) and the icon font | they brought three third-party hosts and, for the icon font alone, six stylesheets of about 650 kB; with those hosts blocked the page showed every panel at once, unstyled, and a slow one left it blank. The page now uses plain CSS and text glyphs; its only outside request is for web fonts |
| inline event handlers and inline scripts | the page has one module script and a content policy that allows nothing else |
| sound | it was on by default; nothing replaced it |
| the Holographer texts on the observer, the Sun, the Moon and the Pleiades that had no checkable content | nothing in them could be checked or attributed |
| the pulsar-timing-array and "Goldstone mode" labels | Vela is not in a timing array, and the label joined two different objects of the theory |
| the names "Solar Gate" and "Story Ring", the random background stars, the moving dots on the edges | decoration; the prototype's shell names survive only in the Blueprint, as the prototype's |

**Added**

| What | Why |
|---|---|
| the ball (3D) | the prototype was named for a ball and drew a disc; the 6-parameter group needs the ball |
| Polaris, the Andromeda galaxy, the compass points, the galactic frame, the depth rings | a pole to check, a depth beyond the Galaxy, and the directions the three questions fix |
| the Moon picture, with its lean in words | the third question needs something to compare with the sky |
| the lab | a place where "they turned not when they went" can be tried as a fact about the curved map |
| a fifth step, Seal | so that a sky can be rebuilt and compared by someone else |
| the dialog "What is real here?" | one place that says what is computed, what others measured, and what is this project's reading |
| keyboard access, a list of the objects as buttons, a status line, reduced motion, a phone layout | the prototype's chart could not be used without a pointer |

## The vision's date and place

The gold boxes set the page's three questions beside Ezekiel 1:1, which gives a place
("by the river of Chebar") and a day ("in the fourth month, in the fifth day of the
month"), and Ezekiel 1:2, which gives the year as the fifth of king Jehoiachin's
captivity. The three verses give a day and no hour (the page says this as something
read from the verse rows it keeps, and a test reads them). Turning that into a place
and a date on this chart took three decisions.

**The default date.** The preset places the fifth day so that it ended at sunset on
**31 July 593 BC** (Julian calendar), and opens the sky at that sunset: Julian Day
1505042.16624, 19:00 local mean time. A second button opens the sunset that began the
day, on 30 July. The core calls this "the date usually given" and names no work for
it.

**Two other published dates**, each a button with its source:

| Date | The core's attribution | Moon at the sunset that began the day | at the sunset that ended it |
|---|---|---|---|
| 31 July 593 BC (default) | the date usually given | 40 % lit | 50 % lit |
| 1 July 593 BC | Finegan 1950, using Parker and Dubberstein's tables | 33 % | 44 % |
| 13 July 594 BC | Finegan 1950, counting the exile from 598/597; Kutsch 1985 argues for this year | 38 % | 48 % |

A SAID note without a button adds that older books give 592 BC (Jewish Encyclopedia;
Davidson 1892). On the default date the Moon reached first quarter about 12 minutes
before the second sunset, give or take 8 minutes for the clock (ΔT) and a day for
the calendar tables. The page states all of this conditionally: if the day is placed
there, this is what the Moon did.

**The place.** The preset "By the Kebar (Nippur)" is at 32.13° north, 45.23° east.
The Kebar (Chebar in the King James Version) is generally identified with the Kabari
canal near Nippur, published by Hilprecht in 1898. From Nazareth, the zero point of
First Explorers, the core computes a bearing of 91° and a distance of 934 km to that
site, and a difference of 0.57° in latitude. Because the position of Nippur is
approximate, the page states these with the hedge they deserve, in one sentence
that both pages share: the two places "lie about half a degree apart in latitude, so
almost the same stars pass overhead at both, about 40 minutes apart", and the site
lies "roughly due east, about 930 km".

**What could not be confirmed:**

- Which works give 31 July 593 BC. The research behind the page met that date only
  in search results and opened no reference work that gives it. The core and the
  lexicon (row `26.1.1.2.3`) therefore say "the date usually given" and name no
  work; a maintainer who opens one should cite it there.
- The position of Nippur. The site's own note says: approximate, not checked against
  a source.
- The identification of the Kebar with the Kabari canal: an identification, not a
  certainty, as the note says.
- The minute of first quarter. It depends on ΔT, which is known only to about
  ± 8 minutes for that year; other ephemerides, with other ΔT models, place it
  several minutes earlier or later.
- The hour of the vision, and the vision. The page says what the book says, what can
  be computed for that place and day, and who has read the date how. It does not say
  what was seen.

## Decisions taken on the author's behalf (this page)

Each of these was a choice made while building. Each can be changed.

1. **The name "Celestial Control Panel"**, with "Celestial Holography" kept in the
   subtitle. The dialog names three neighbours so the name is not mistaken: the
   Learning Hub's "Control Panel", the Biomesh AI Control Panel, and the Celestial
   Observatory planned in the Celestial Hypersim Explorer, toward which this page is
   a static sketch.
2. **The reading levels keep the prototype's names**, Stargazer, Navigator and
   Holographer. They are the three levels First Explorers calls Stargazer, Explorer
   and Architect.
3. **The Moon is computed from the date**, and the third question became a check
   with "Find the next night with this Moon" buttons.
4. **Which prototype sentences were rewritten or removed, and which rim objects
   stayed**: the list above. Six rim objects remain, each with a fixed status: the
   celestial sphere and the opposite point (CHECKED geometry), celestial holography
   and the shadow transform (SAID, proposals), gravitational-wave memory (SAID,
   predicted and not detected), the microwave background (SAID, measured).
5. **The vision's date and place**: the fifth day ending at sunset on 31 July 593 BC
   by default, two other published dates, and Nippur for the Kebar.
6. **The depth scale and the shell radii** are this project's choice, and the chart
   says so.
7. **How much of the bridge reading appears**: one gold box per step, the reading
   stated once and labelled as this project's; no number depends on a verse.
8. **A fifth step, Seal, was added. There is no sound, no location service, and
   nothing is stored.**
9. **The Celestial Hypersim Explorer and First Explorers were left as they are.**
10. **Tailwind and the icon font were removed and the palette kept.**

The decisions about the scripture text, the formats and the author's ten lines are
listed in `STRIX_OVERWATCH.md`. One of them applies here too: every verse this page
quotes is in the King James Version, cut from the rows of the Ezekiel lexicon.

## Hosting

The page carries its Content-Security-Policy in a `meta` element, the first element
of its head. A policy given that way cannot forbid framing: browsers ignore
`frame-ancestors` in a `meta` element. Whoever hosts the site should send the
response header `Content-Security-Policy: frame-ancestors 'none'` with this page and
with the Lexicon Explorer. Until the host does, another site can show them inside a
frame of its own. `STRIX_OVERWATCH.md` says under "What guards what" which parts of
the page are checked by `node --test` and which only by the browser walkthroughs in
`tests/browser/`.

## Checked numbers

Every number in this block is recomputed from the code by
`tests/unit/explorers-integration.test.mjs`. `tests.….declared` is the number of
lines in that test file that begin with `test(`; `node --test` reports more where a
test has subtests.

```facts
steps = 5
lenses = 3
sites = 16
sites.offered = 15
objects = 28
objects.bodies = 8
objects.directions = 7
objects.rim = 6
objects.rings = 7
anchors = 8
anchors.with.distance = 6
year.min = -1999
year.max = 3000
vectors = 29
vectors.modern = 18
vectors.ancient = 11
vectors.checks = 2900
vectors.sun.events = 26
vectors.sun.events.tolerance.seconds = 30
accuracy.sun.longitude.worst.deg = 0.0062
accuracy.moon.longitude.worst.deg = 0.0042
accuracy.moon.latitude.worst.deg = 0.0007
allowance.moon.by.twentyonehundred.deg = 0.04
allowance.moon.by.twentytwohundred.deg = 0.1
allowance.moon.ezekiel.deg = 0.07
allowance.deltat.ezekiel.minutes = 8
allowance.badge.before.year = 915
allowance.badge.after.year = 2045
sunset.altitude.deg = 0.83
polaris.pole.distance.today.deg = 0.6
polaris.pole.distance.ezekiel.deg = 15.0
depth.rho.zero = 0.5
depth.kappa = 0.135
rings = 8
radius.moon = 0.25
radius.sun = 0.41
radius.pleiades = 0.73
radius.polaris = 0.73
radius.vela = 0.74
radius.cygnus = 0.77
radius.sagittarius = 0.78
radius.andromeda = 0.83
radius.background = 0.90
sun.moon.distance.ratio = 400
sun.moon.drawn.ratio = 1.6
view.near = 1.5
view.flight.ms = 600
preset.ezekiel.jd = 1505042.16624
preset.ezekiel.latitude = 32.13
preset.ezekiel.longitude = 45.23
preset.ezekiel.local.time = 19:00
ezekiel.dates = 3
moon.lit.default.begins = 40
moon.lit.default.ends = 50
moon.lit.first.alternative.begins = 33
moon.lit.first.alternative.ends = 44
moon.lit.second.alternative.begins = 38
moon.lit.second.alternative.ends = 48
moon.first.quarter.minutes.before.sunset = 12
kebar.nazareth.latitude.apart.deg = 0.57
kebar.nazareth.minutes.apart = 40
kebar.bearing.deg = 91
kebar.km = 934
kebar.km.rounded = 930
lab.step.default = 1
lab.step.min = 0.25
lab.step.max = 1.5
lab.step.max.small = 1.25
lab.small.canvas.px = 400
lab.slide.ms = 2000
lab.four.gap = 0.874463
lab.four.turn.deg = 78.0148
lab.four.area = 1.362
lab.tile.side = 1.253739
lab.tile.turn.deg = 72
lab.tile.squares.at.corner = 5
lab.five.side = 1.061275
lab.five.tolerance = 0.005
seal.rows = 25
seal.epochs = 4
seal.kebar.chain.id = BC-d8772576788818e2c5969e60
link.keys = 8
tests.celestial.core.declared = 46
tests.hyperbolic.moves.declared = 40
tests.celestial.panel.model.declared = 28
tests.explorers.policy.declared = 18
```
