# Owl Academy · Templates

A small repository of reusable **aesthetic** snippets for the Owl Academy — the
visual pieces that recur across pages (sigils, headers, badges, panels). Keep
each template self-contained and copy-paste friendly so every page can pull from
one source of truth instead of re-deriving the markup.

## Contents

| Template | What it is |
|---|---|
| [`owl-sigils.html`](owl-sigils.html) | The signature header pair — the **Left Sigil** (Mathematical Manifold, rotating 24-stream manifold + hexagram + 7-point star + counter-rotating Chi-Rho) and the **Right Sigil** (Archive Cipher, spinning twin-triangle frame + static Chi-Rho). Live preview + the CSS animations + clearly marked `COPY ▸ … / END COPY ▸ …` blocks. |

## Conventions

- **Self-contained.** A template renders on its own (open it in a browser).
  Production pages already load Tailwind + Cinzel/Inter, so templates mirror that.
- **Copy markers.** Reusable regions are wrapped in
  `<!-- ════ COPY ▸ NAME ════ -->` … `<!-- ════ END COPY ▸ NAME ════ -->`
  so you can lift exactly the right block.
- **Unique gradient ids.** SVG gradients use page-scoped ids
  (`goldGradLeft`, `goldGradRight`, …). If two sigils share a page, their ids
  must differ — a duplicate id makes the browser apply only the first gradient.
- **Theme tokens.** Gold `#D4AF37` (`--color-primary`), void `#05030a`
  (`--color-void`), gold gradient stops `#C59B3F → #FFF2C8 → #996515`.

## Where these are used

- **Left Sigil** — top-left of `index.html`, `Learning-Hub.html`, and
  `Library/Grand_Archives.html` headers.
- **Right Sigil** — top-right "return" link on the same headers.

## Adding a template

Drop a new self-contained `.html` (or `.svg` / `.css`) file in this folder,
wrap the reusable region in `COPY ▸ …` markers, and add a row to the table above.
