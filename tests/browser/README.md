# Browser walkthroughs (optional)

Three scripts that open a real page of this repository in headless Chromium, use it the way a
visitor would, and compare what the page shows with what it should show:

| Script | Page |
| --- | --- |
| `lexicon-explorer.cjs` | `Library/Experimental_Systems/Lexicon_Explorer/` |
| `celestial-control-panel.cjs` | `Library/Experimental_Systems/Celestial_Control_Panel/` |
| `first-explorers.cjs` | `Library/Experimental_Systems/First_Explorers/` |

They exist because `node --test` never opens a page. The unit tests prove the cores and the two
model modules; the static tests read the text of the page scripts. Whether a button is on the
screen, a label fits, a tap lands, the focus goes where it should or a narrow window scrolls
sideways is seen only in a browser. The parts of the pages that nothing else exercises are the
shells (`lexicon-explorer.js`, `celestial-control-panel.js`, `first-explorers.js`), the drawing
modules, the style sheets and the `index.html` files.

They are optional. They are **not** run by `node --test` (no file here ends in `.test.mjs`) and
**not** by the CI workflow. Run them by hand after a change to a shell, a drawing module, a style
sheet or an `index.html`.

## Installing Playwright

The one thing they need is [Playwright](https://playwright.dev) with its Chromium.
`tests/package.json` does not list it and nothing here adds it. (`tests/engines/` pins a Playwright
of its own for the D7 measurement; only that measurement's workflow installs it, and it was not
used for these walkthroughs.) Install Playwright in a folder of your choice and tell Node where it
is:

```sh
mkdir ~/walk-tools && cd ~/walk-tools
npm i -D playwright && npx playwright install chromium
export NODE_PATH=~/walk-tools/node_modules
```

A global install works the same way (`npm i -g playwright && npx playwright install chromium`,
then `export NODE_PATH="$(npm root -g)"`). Without Playwright each script prints one line saying
so and ends with exit code 2.

## Running

From the repository root, or from anywhere else (each script finds the repository from its own
place):

```sh
node tests/browser/lexicon-explorer.cjs
node tests/browser/celestial-control-panel.cjs
node tests/browser/first-explorers.cjs
```

Each script starts its own server on `127.0.0.1` and a free port, serves the repository from it,
and closes it at the end. Nothing else is reached: any request that would leave the computer is
refused. The two font hosts the pages ask (`fonts.googleapis.com`, `fonts.gstatic.com`) are
answered with an empty style sheet by the first two scripts and refused by the third (which
answers them empty only for the Lexicon Explorer it opens to load a saved package); see "What
they do not cover". Nothing is written into the repository. Files a walkthrough needs while it
runs (the packages the Lexicon Explorer loads, two of them with a long ledger, and the files the
three pages save) go to a folder under the system's temporary folder and are removed at the end.

Options all three take:

| Option | What it does |
| --- | --- |
| `--shots=<folder>` | Writes the screenshots there (PNG, two device pixels per CSS pixel) with a `manifest.json` that says what each shows. Off by default. |
| `--json=<file>` | Writes the full record: every check with its viewport, section, name, expected and actual. |
| `--root=<folder>` | Walks a copy of the repository in that folder and not this one (the page and the modules the expectations are computed from are both taken from there). For trying a change without touching the checkout. |
| `--verbose` | Prints every check as it is made. By default only failures are printed as they happen, and one line per section. |
| `--help` | Prints the options of the script. |

Options of one script:

| Script | Option |
| --- | --- |
| `lexicon-explorer.cjs` | `--part=phone,desk,small,fonts` (one or more parts), `--only=S06,S07` (some of the sections S01 to S22, at `phone` and `desk` unless `--part` names one of them) |
| `celestial-control-panel.cjs` | `--only=journey,lenses,details,links,touch,motion,aborted,small` (sections), `--vp=1440` or `--vp=390` (one viewport; leaves out `small`) |
| `first-explorers.cjs` | `--only=desktop` or `--only=phone` |

What is printed: a line per section as it ends (per screen for First Explorers), each failed check
with expected against actual, then the totals per viewport, the fonts the text was drawn with, and
every failure once more. The last line is always of the form

```
1832 checks, 1832 passed, 0 failed
```

Exit code 0 only when every check passed; 1 when a check failed or the walk stopped; 2 when the
script could not run at all (no Playwright, an unknown option, no page under `--root`).

A few checks measure time (a flight of at most 600 ms, four slides in at most 8 s, the Checks tab
of a package with a long ledger open in under half a second, no animation frame while idle). On
a busy computer one of them can fail once; run the walkthrough again before concluding anything.

## What each covers

### `lexicon-explorer.cjs`

Four parts. `phone` is a 390 x 844 window with touch (taps and one-finger swipes made of real
touch events); `desk` is 1440 x 900 with the mouse and the keyboard. Both go through the same 22
sections, each on a freshly opened page or continuing from the one before:

| Sections | What is walked |
| --- | --- |
| S01 to S03 | The first screen (state, title, STRIX's first line, the legend, the canvas as an image with a caption, one status line, the order of the page on a phone and the three columns on a wide screen); the first minute by pointer and again by keyboard alone. |
| S04, S05 | The reader in both wordings, letter for letter against the model, with every term and verse button; the Count station for each number word. |
| S06, S07 | The tree: labels of 13 px or more that do not lie on each other, a tap on each verse cell, Home, Up, Next and Previous, the nudge buttons, the list under the map as a keyboard tree, the 3D ball. A finger on the canvas: a swipe scrolls the page, the switch "Drag the map" lets one finger drag the view, a cancelled touch picks nothing, no animation frame while idle. |
| S08 to S12, S18 | The stations Kinds of sentence, Stamp it (sealing epoch by epoch with the controls locked, the three tampers at Stargazer and the eight from Navigator up, the Chain and Overwatch tabs, the downloaded package), Send (four receivers and the count line "4 of 4 handshakes in this page" at the station and on the Witnesses tab, then noise on two roads), The fourth square, the wheel and the 8 by 8 square, Place. |
| S13, S14 | The three reading levels at every station and tab; the dialog "What is real here?" at each level. |
| S15, S16 | Loading a package file: one this page made, one with a changed word, a file that is not a package, one over the size limit, a journey of First Explorers, and an invented lexicon with markup in a text, a right-to-left name and a word of 120 letters. The links `#entry`, `#lens` and `#sky`; Back and Forward: through the page's own entries they keep the reading level on show, a typed link sets its level once, and while a lexicon from a file is shown no entry of the history loses its address, also when a link is typed there and a reading level is then chosen over it (the entry keeps its address, and Back and then Forward bring its entry back at the level on show). A sky link typed into the open tab is said in the status line; three sky links with one faulty part each (`&lens=bogus`, `&entry=9.9`, `&foo=1`) say the note and then the sky's title, each once. |
| S17 | Reduced motion. |
| S19 to S21 | The author's notes (on the phone the button "The author's ten lines"), John 3:16, the buttons under rows that name a place of the page (one that leads to a figure brings its heading to the top of the window), the line about the Navigator level before the station's box on the phone, the links out (each to a file that exists); after "Switch to Navigator" the station button that has the focus lies inside the window, at 390 x 844, 320 x 568 and 699 x 900, for the Ezekiel lexicon and for a sky, and at 1440 x 900 nothing scrolls; the layout at 1440, 1280, 1180 and 1100 px, the banner that stays in view, a sky opened from a link (its title said once in the status line and named in the document's title, and the line about the Navigator level at Stargazer); the keyboard, what the status line announces, Stargazer wording, the names of the card's section and of the map at each level, STRIX's line in whole sentences with its button; in phone windows of 320 x 568 and 375 x 667, at every station and reading level, for the Ezekiel lexicon and for a sky, as the page opens and again sealed and sent, STRIX shows at least its first sentence wherever the card's first line is below the window's bottom edge, and a sky's sentences about the link are not moved out of the banner there; arriving by a link. |
| S22 | The names a Stargazer is shown (in the list, on the card, in the status line and on the map) and the opening sentences of entries `0.1` to `0.5`; the name of entry `0.1` on the map following the lens buttons (Navigator and back to Stargazer); the buttons under the author's lines 2 and 7 at the three levels; where the focus goes after a "Go to …" button; two packages with long ledgers, made at run time (200 rows and the line that counts the rest, the Checks tab open in under half a second); the two buttons of the gold box bringing the map into the window before the flight, also with reduced motion; a tap on each top-level marker, and names that are not drawn over another entry's marker; and, in the `desk` part, what is scrolled to at 700, 768, 820, 1000, 1099 and 1100 px wide, with and without the banner of a lexicon from a file. |

`small` opens the page at 720 x 450 (mouse) and at 320 x 256 (touch) and looks for sideways
scrolling at every reading level, station and tab, with every box open, in the dialog and with an
outside lexicon shown. It then opens 320 x 568 (touch) at the Navigator level with the map as a
ball: the root view keeps the name of the author's notes (`100`), and the centred entry has its
name on the map at `26.1` and at `100`. `fonts` runs the first minute at both viewports with the
two font hosts aborted: the page must work, and the style sheet's load error must be the only
console message.

At every station it asserts: visible text is 17 or 14 px (13 px only for hashes); every enabled
control is at least 44 x 44 px for a finger and 32 x 32 px for the mouse (term words inside a
verse of double line height are exempt); no horizontal overflow; on the phone the first line of
the explanation card ends above y = 844; text contrast at least 4.5 to 1 and no faded text; after
every activation the focus is not on the body and, on the wide screen, not under the sticky
header. For every page it opens: no console error or warning, no page error, no script dialog, no
request to another host but the fonts.

### `celestial-control-panel.cjs`

Two viewports, 1440 x 900 (mouse and keyboard) and 390 x 844 (touch), each through seven
sections; then `small`. The device clock is fixed at Saturday 14 November 2026, 16:00 UT, so the
day the page proposes, the Moon and every time button are the same in every run.

| Section | What is walked |
| --- | --- |
| `journey` | The five steps from the dark first screen to the seal: the place (the three buttons, a typed place), the day question and the dates (BC and AD, days that do not exist), the Moon picture and its words, the time buttons, the Kebar preset, the chart (the list, taps, dives, the rim), the lab ("they turned not when they went"), sealing, the link and the downloaded package, the gold box of each step, the two dialogs, and the link on to the Lexicon Explorer. |
| `lenses` | The three reading levels on every step, in 2D and 3D, with every box open. |
| `details` | The layout of the first screen (with the tooltips of the eight arrow buttons), the "Next" buttons, STRIX's line in whole sentences, a choice in the list bringing the map into view and the caption naming what is in the middle with its article, the sticky header never over the focused control, single sentences and dates, a path of the lab that crosses itself (near home and far from it), and the day question after midnight, for which the clock is moved inside the run: the question asked again the next morning; "Yes" pressed after the day changed (not taken, the question shown again and the status line saying so, then taken); the page coming into view again (a simulated `visibilitychange`); "Change the day"; the status line where a place is chosen; steps 3 to 5 and a lab link opened the next morning; the further controls of step 2 used the next morning with the day unanswered ("Sunrise", then "Noon" two days later; a Moon button on the night of 14 to 15 June 2026, for which the clock is moved to June; the slider through the year and a typed time at the Navigator level); and the same controls after a link with a time, which the clock never changes. |
| `links` | The preset link `#preset=ezekiel`, a change of the hash while the page is open (the keys that are taken, an unknown key named in one line, and the note said in the status line on arrival), `#lab=square`, a link with a place and the lab and the sky lit on leaving it, a link with a place and no date, the copied link opening the same sky, a sky at the very end of the year range read whole and written again, a place where the Sun does not set. |
| `touch` | A finger on the canvas (a swipe scrolls the page, the switch "Drag the map" lets one finger drag the view, a cancelled drag, a tap that picks), the mouse (drags in 2D and 3D, what counts as a click), and the keyboard reaching every control in order and never the canvas. |
| `motion` | No animation frame while idle; reduced motion. |
| `aborted` | The two font hosts aborted: the page works, the style sheet's load error is the one console message, and the whole `journey` passes once more that way. |
| `small` | 720 x 450 and 320 x 256 with the mouse, 320 x 256 and 390 x 844 with touch: no sideways scrolling on any step, in 2D and 3D, with every box open, in the lab and in the dialog. 700, 800, 1000, 1099 and 1100 x 900: what is scrolled to stops below the header, which has two rows under 1100 px, and no focused control is hidden by it. 320 x 568 with touch, at all three reading levels and steps 1 to 5: STRIX is left with the button alone only where that brings the card's first line into the window, and has at least its first sentence wherever the line is below the window's bottom edge. |

At every station it asserts: no visible text under 14 px outside hashes, three text sizes only
(17, 14, and 13 for hashes), no hash-size text at the Stargazer level; no enabled control under
44 x 44 px for a finger or 32 x 32 px for the mouse; text contrast at least 4.5 to 1; no
`user-select: none` on text and no CSS `order`; no horizontal overflow; on the phone the first
line of the explanation card ends above y = 844 at scroll position 0; after every activation the
focus is not on the body; no console error or warning.

### `first-explorers.cjs`

One journey on a desktop screen (1440 x 900, mouse and keyboard) and again on a phone screen
(390 x 844, touch): the nine stations from 0, Darkness, to 8, The way. It records five
observations, one per sense (a sound, a colour, a drawn wave, a word, a list of primes); looks at
the line and its bytes, the crystal and the address, the 64 bits of the packet and its guard bit
(one flip, two flips, restore, the cube); the chain and the ledger; runs the Overwatch
inspection; tries each of the ten tamper experiments on a journey of one and again on a journey
of five; sends the package to the four receivers clean, through noise and clean again; presses
each of the three "Save" buttons once; turns the map into the 3D ball and drags it; reads every
station at the three reading levels; opens, scrolls and closes the dialog.

The saved package must be the wire text (one line, the JSON of its own value). It is read back
by the script, put through the front door in Node (`readHyperpack`, all thirteen checks) and
loaded into the Lexicon Explorer, which the script opens for that in a window of its own at the
same size, with the font hosts answered empty: thirteen passed checks, the line "This is a First
Explorers journey." and no "Show it" button. The same package indented must be refused. Both saved ledgers must equal the ledger
the page holds, indented by one space.

What the page should show is worked out outside the browser: the five lines are written by hand
in the script, the repository's own modules (`scripts/strix-overwatch.js`,
`scripts/biomesh-core.js`) grow the same journey in Node, and signatures, the ledger and the
parity bit are checked again with the script's own code. The canvas is judged by counting solid
pixels by colour family. After every step it asserts that nothing overflows sideways; at the end,
that there was no console error, no page error, no failed request and no request off this
computer but the font style sheet, exactly three downloads (the package and the ledger twice), no
pop-up, and that the address never changed.

## How long they take

Measured on the computer they were written on (4 cores, Linux, Playwright 1.63.0, headless
Chromium 153, other browsers running at the same time), with the number of checks each made on
the pages as they were then:

| Script | Checks | Time | With `--shots` |
| --- | --- | --- | --- |
| `lexicon-explorer.cjs` | 1,832 (887 counted under 390 x 844, 852 under 1440 x 900, 93 in the three small windows) | about 10 minutes (619 s) | not measured since checks were added; 400 s and 156 pictures when it made 1,597 checks |
| `celestial-control-panel.cjs` | 5,314 | about 13 minutes (768 s) | not measured since checks were added; 663 s and 164 pictures when it made 4,872 checks |
| `first-explorers.cjs` | 1,879 (940 desktop, 939 phone) | 2 to 3 minutes (140 and 143 s) | not measured since checks were added; 151 s and 39 pictures when it made 1,843 checks |

The numbers of checks change when a check is added; what matters is the last line.

## What they do not cover

- **Real web fonts.** The font hosts are never reached, so the pages are drawn with fonts
  installed on the computer; the summary names them ("text drawn with ..."). The computer these
  walkthroughs were written on has Inter and JetBrains Mono installed, the families the pages ask
  for, so the positions the checks measure (the first line of a card above y = 844, labels that do
  not overlap, no sideways scrolling) are positions with those fonts. On a computer without them
  the browser falls back to its system fonts, and a check of a position can fail for that reason
  alone. Space Grotesk, which First Explorers asks for in its heading, was not installed and was
  never seen.
- **Browsers other than Chromium.** Nothing here runs in Firefox or Safari.
- **Real devices.** The phone is a 390 x 844 window with touch events and a coarse pointer, at two
  device pixels per CSS pixel: no real finger, no on-screen keyboard, no safe areas, no slow
  processor.
- **A real screen reader.** Roles, labels, the caption of each canvas and the text of the status
  line are read from the DOM; nothing is listened to. The sound First Explorers plays is not
  heard either.
- **The other pages of the repository.** Links out of the three pages are checked for leading to
  a file that exists; the only one followed is the sky page's link to the Lexicon Explorer. The
  First Explorers walkthrough also opens the Lexicon Explorer, by its address and not by a link,
  to load the package it saved.

## Files

| File | What it is |
| --- | --- |
| `lexicon-explorer.cjs`, `celestial-control-panel.cjs`, `first-explorers.cjs` | The three walkthroughs. |
| `lib/walk-kit.cjs` | What they share: finding Playwright, the options, the static server, the routing of the font hosts, the record of expected against actual and its summary, the screenshots and their manifest, the temporary folder. |
| `lib/lexicon-page.cjs` | The Lexicon Explorer walkthrough's own helpers: the measurements made inside the page, the gestures, and two of the package files it loads, made at run time with the repository's own modules (the two with long ledgers are made by the script itself). |
