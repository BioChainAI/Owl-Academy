/**
 * Output encoding for values that come from Firestore records, other users,
 * files or network responses.
 *
 *   escapeHtml(v)  text placed between tags
 *   escapeAttr(v)  a value placed inside a quoted attribute ("..." or '...')
 *   jsArg(v)       a string argument inside an inline handler, e.g.
 *                  onclick="open(${jsArg(id)})"  (gives a quoted JS string)
 *   safeUrl(v)     a URL for href/src: http(s), mailto and relative URLs pass,
 *                  anything else becomes "about:blank" (escape it as well)
 *   textEl(tag, text, attrs)  builds an element whose text is set with
 *                  textContent, so the value is never parsed as HTML
 *
 * Owl pages load shared code as ES modules (`<script type="module">` with
 * imports), so this file is an ES module. It also sets `globalThis.OwlEscape`
 * for classic scripts: include it with
 * `<script type="module" src=".../scripts/ui/escape.js"></script>` and call
 * `OwlEscape.escapeHtml(...)` from code that runs after the page has loaded.
 *
 * Firebase-free and DOM-free (except textEl), so it can be tested in Node.
 */

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};
const ATTR_ESCAPES = { ...HTML_ESCAPES, "=": "&#61;" };

function asText(value) {
  return value === null || value === undefined ? "" : String(value);
}

/** Escape a value for use as text content inside HTML. null/undefined -> "". */
export function escapeHtml(value) {
  return asText(value).replace(/[&<>"'`]/g, (c) => HTML_ESCAPES[c]);
}

/** Escape a value for use inside a quoted HTML attribute value. */
export function escapeAttr(value) {
  return asText(value).replace(/[&<>"'`=]/g, (c) => ATTR_ESCAPES[c]);
}

/**
 * A JS string literal for an inline event handler attribute.
 * The HTML parser decodes the entities first, so the handler sees a plain
 * JSON string literal: onclick="f(${jsArg(id)})" -> f("the id").
 */
export function jsArg(value) {
  return escapeAttr(JSON.stringify(asText(value)));
}

const SAFE_SCHEMES = new Set(["http", "https", "mailto"]);

/**
 * Return the URL if it is relative or uses http, https or mailto;
 * otherwise "about:blank". Browsers ignore ASCII whitespace and control
 * characters inside a scheme, so they are removed before the check.
 */
export function safeUrl(value) {
  const raw = asText(value).trim();
  if (!raw) return "about:blank";
  const probe = raw.replace(/[\u0000- \u007f-\u009f]/g, "");
  const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(probe);
  if (!m) {
    // No scheme before the first "/", "?" or "#": a relative URL.
    return raw;
  }
  return SAFE_SCHEMES.has(m[1].toLowerCase()) ? raw : "about:blank";
}

/**
 * Create an element and set its text with textContent.
 * attrs: { className, title, ... } set with setAttribute (className -> class);
 * a value of null/undefined/false is skipped.
 */
export function textEl(tag, text, attrs = {}, doc = globalThis.document) {
  const el = doc.createElement(tag);
  el.textContent = asText(text);
  for (const [name, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    el.setAttribute(name === "className" ? "class" : name, asText(value));
  }
  return el;
}

const OwlEscape = Object.freeze({ escapeHtml, escapeAttr, jsArg, safeUrl, textEl });
if (typeof globalThis !== "undefined" && !globalThis.OwlEscape) {
  globalThis.OwlEscape = OwlEscape;
}
export default OwlEscape;
