// Unit tests for scripts/ui/escape.js. Run from the repository root: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, escapeAttr, jsArg, safeUrl, textEl } from "../../scripts/ui/escape.js";

test("escapeHtml encodes the HTML metacharacters", () => {
  assert.equal(escapeHtml(`<b class="x">'&'</b>` + "`"), "&lt;b class=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;&#96;");
});

test("escapeHtml turns any value into text", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(0), "0");
  assert.equal(escapeHtml(12.5), "12.5");
  assert.equal(escapeHtml(false), "false");
  assert.equal(escapeHtml({ toString: () => "<i>" }), "&lt;i&gt;");
  assert.equal(escapeHtml("plain text · ✓"), "plain text · ✓");
});

test("escapeHtml output contains no markup characters", () => {
  const record = `<img src=x onerror="window.__ran=1">"'><script>x</script>`;
  const out = escapeHtml(record);
  assert.doesNotMatch(out, /[<>"'`]/);
});

test("escapeAttr also encodes = for attribute values", () => {
  assert.equal(escapeAttr(`a" onmouseover=alert(1) x="`), "a&quot; onmouseover&#61;alert(1) x&#61;&quot;");
  assert.equal(escapeAttr(null), "");
});

test("jsArg gives an attribute-safe JS string literal", () => {
  const value = `x');alert(1);//\\"<`;
  const attr = jsArg(value);
  assert.doesNotMatch(attr, /[<>"'`]/);
  // What the handler sees after the HTML parser decodes the entities:
  const decoded = attr
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#96;/g, "`").replace(/&#61;/g, "=").replace(/&amp;/g, "&");
  assert.equal(JSON.parse(decoded), value);
});

test("safeUrl keeps http(s), mailto and relative URLs", () => {
  for (const u of [
    "https://example.org/a?b=c#d", "http://example.org", "mailto:owl@example.org",
    "../login.html", "/abs/path", "page.html?x=a:b", "#frag", "//cdn.example.org/x.js",
  ]) assert.equal(safeUrl(u), u);
});

test("safeUrl replaces other schemes, including obfuscated ones", () => {
  for (const u of [
    "javascript:alert(1)", "JavaScript:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)",
    "java\nscript:alert(1)", "\u0001javascript:alert(1)", "data:text/html,<b>x</b>", "vbscript:x",
    "blob:https://example.org/uuid", "file:///etc/passwd",
  ]) assert.equal(safeUrl(u), "about:blank", JSON.stringify(u));
  assert.equal(safeUrl(""), "about:blank");
  assert.equal(safeUrl(null), "about:blank");
});

test("textEl sets text with textContent and attributes with setAttribute", () => {
  const made = [];
  const fakeDoc = {
    createElement(tag) {
      const el = { tag, attrs: {}, textContent: "", setAttribute(k, v) { this.attrs[k] = v; } };
      made.push(el);
      return el;
    },
  };
  const el = textEl("span", "<img src=x onerror=alert(1)>", { className: "pill ok", title: 'a"b', hidden: false }, fakeDoc);
  assert.equal(el.tag, "span");
  assert.equal(el.textContent, "<img src=x onerror=alert(1)>");
  assert.deepEqual(el.attrs, { class: "pill ok", title: 'a"b' });
  assert.equal(made.length, 1);
});

test("the module also exposes a global for classic scripts", () => {
  assert.equal(typeof globalThis.OwlEscape?.escapeHtml, "function");
  assert.equal(globalThis.OwlEscape.escapeHtml("<"), "&lt;");
});
