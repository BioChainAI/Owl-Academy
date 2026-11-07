// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// tests/vendor/VENDOR.json, offline: every file under tests/vendor/ is listed (or is one of the folder's own files),
// every listed file exists with its recorded SHA-256, and each compat text has the SHA-256 and length that
// biomesh_compat_v1.json records for it. Run from the repository root: node --test tests/unit/vendor.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "./support/declarations.mjs";

const ROOT = resolve(process.env.OWL_TEST_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const DIR = join(ROOT, "tests", "vendor");
const VENDOR = JSON.parse(readFileSync(join(DIR, "VENDOR.json"), "utf8"));
const listed = VENDOR.sources.flatMap((s) => s.files.map((f) => ({ ...f, source: s })));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [relative(DIR, join(dir, e.name)).split(sep).join("/")]);
}

test("VENDOR.json names its sources", () => {
  assert.equal(VENDOR.format, "owl-vendor/1");
  for (const s of VENDOR.sources) {
    assert.match(s.id, /^[a-z0-9-]+$/);
    assert.match(s.repository, /^[\w.-]+\/[\w.-]+$/, `${s.id}: repository`);
    assert.match(s.commit || "", /^[0-9a-f]{40}$/, `${s.id}: the source commit, a full SHA`);
    assert.ok(s.licence, `${s.id}: licence`);
    assert.ok(s.files.length > 0);
    for (const u of s.usedBy) assert.ok(existsSync(join(ROOT, u)), `${s.id}: ${u} exists`);
  }
});

test("every vendored file is listed and has its SHA-256", () => {
  const paths = listed.map((f) => f.path);
  assert.equal(new Set(paths).size, paths.length, "no file is listed twice");
  for (const f of listed) {
    const p = join(DIR, f.path);
    assert.ok(existsSync(p), `${f.path} exists`);
    assert.equal(sha256(readFileSync(p)), f.sha256, `${f.path}: SHA-256`);
    assert.ok(f.upstream || f.generated, `${f.path}: has an upstream path or says how it was generated`);
  }
  const own = new Set(VENDOR.own);
  const unlisted = walk(DIR).filter((p) => !own.has(p) && !paths.includes(p));
  assert.deepEqual(unlisted, [], "files under tests/vendor/ that VENDOR.json does not list");
});

test("each compat text has the SHA-256 and length biomesh_compat_v1.json records", () => {
  const compat = JSON.parse(readFileSync(join(DIR, "biomesh-compat-v1", "biomesh_compat_v1.json"), "utf8"));
  const texts = listed.filter((f) => f.path.startsWith("biomesh-compat-v1/texts/")).map((f) => f.path).sort();
  assert.equal(texts.length, compat.texts.length);
  compat.texts.forEach((t, i) => {
    const buf = readFileSync(join(DIR, texts[i]));
    assert.equal(buf.length, t.bytes, `${t.name}: bytes`);
    assert.equal(sha256(buf), t.sha256, `${t.name}: SHA-256`);
  });
});
