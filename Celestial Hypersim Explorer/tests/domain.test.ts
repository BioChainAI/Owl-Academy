import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import { can } from "../services/permissions";
import { searchCanon } from "../services/catalog";
import { modules } from "../modules/registry";
import { reachableNodes } from "../knowledge-graph/traversal";
import { DisconnectedAcademyAdapter } from "../integrations/owl-academy/adapter";
import { loadAcademyCatalog } from "../integrations/owl-academy/catalog";
import type { Principal, ResourceScope, KnowledgeEdge } from "../schemas/domain";

const principal: Principal = { uid: "alice", tier: "ACOLYTE", certifiedPlanes: [], authority: "server-verified" };
const own: ResourceScope = { ownerUid: "alice", visibility: "private", plane: "dept-I" };
const other: ResourceScope = { ...own, ownerUid: "bob" };

test("unauthenticated callers cannot use resource capabilities", () => {
  for (const action of ["read", "edit-memory", "author-lesson", "publish-canon", "manage-authority"] as const) assert.equal(can(null, action, own), false);
});
test("a learner may edit own memory, but cannot read another private vault", () => {
  assert.equal(can(principal, "edit-memory", own), true);
  assert.equal(can(principal, "read", other), false);
  assert.equal(can(principal, "edit-memory", other), false);
  assert.equal(can(principal, "read", { ...other, visibility: "academy" }), true);
  assert.equal(can(principal, "author-lesson", own), false);
});
test("Instructor authoring is plane-scoped and never publishes canon", () => {
  const instructor: Principal = { ...principal, tier: "INSTRUCTOR", certifiedPlanes: ["dept-I"] };
  assert.equal(can(instructor, "author-lesson", own), true);
  assert.equal(can(instructor, "author-lesson", { ...own, plane: "dept-IV" }), false);
  assert.equal(can(instructor, "publish-canon", own), false);
  assert.equal(can(instructor, "manage-authority", own), false);
});
test("Archon authority does not grant access to private memories", () => {
  const archon: Principal = { ...principal, tier: "ARCHON", certifiedPlanes: ["*"] };
  assert.equal(can(archon, "manage-authority", own), true);
  assert.equal(can(archon, "publish-canon", own), true);
  assert.equal(can(archon, "read", other), false);
  assert.equal(can(archon, "edit-memory", other), false);
});
test("untrusted or unknown authority context fails closed", () => {
  assert.equal(can({ ...principal, authority: "legacy-registrar" } as unknown as Principal, "read", own), false);
  assert.equal(can({ ...principal, tier: "STAFF" } as unknown as Principal, "read", own), false);
});
test("disconnected adapter supplies no session and rejects live data access", async () => {
  const adapter = new DisconnectedAcademyAdapter();
  assert.equal(await adapter.getSession(), null);
  await assert.rejects(adapter.listMajorTomes(), /not enabled/);
});
test("real canon projection has stable IDs, preserves departments, excludes private fields", async () => {
  const catalog = await loadAcademyCatalog();
  assert.equal(catalog.length, 145);
  assert.equal(new Set(catalog.map(t => t.canonId)).size, 145);
  assert.equal(new Set(catalog.map(t => t.dept)).size, 10);
  assert.equal(catalog.filter(t => t.dept === "X").length, 64);
  assert.ok(catalog.every(t => !("privateJwk" in t) && !("ledgerSeed" in t) && !("email" in t)));
  const results = searchCanon(catalog, "  CLIFFORD  ", "I");
  assert.ok(results.length > 0);
  assert.ok(results.every(t => t.dept === "I" && `${t.title} ${t.canonId} ${t.artifact}`.toLowerCase().includes("clifford")));
  assert.equal(searchCanon(catalog, "nonexistent-fixture-923", "all").length, 0);
});
test("registry entries have unique IDs and honest implementation states", () => {
  assert.equal(modules.length, 6);
  assert.equal(new Set(modules.map(m => m.id)).size, modules.length);
  assert.deepEqual(modules.filter(m => m.status === "scaffold").map(m => m.id), ["grand-archives"]);
  assert.ok(modules.every(m => m.name && m.source && m.data.length > 0));
});
test("traversal handles cycles, respects depth and rejects unsafe depth", () => {
  const edges: KnowledgeEdge[] = [
    { id: "ab", sourceId: "a", targetId: "b", kind: "references" },
    { id: "bc", sourceId: "b", targetId: "c", kind: "contains" },
    { id: "ca", sourceId: "c", targetId: "a", kind: "relates-to" },
  ];
  assert.deepEqual(reachableNodes("a", edges, 0), ["a"]);
  assert.deepEqual(reachableNodes("a", edges, 1), ["a", "b"]);
  assert.deepEqual(reachableNodes("a", edges, 20), ["a", "b", "c"]);
  assert.throws(() => reachableNodes("a", edges, 21));
  assert.throws(() => reachableNodes("a", edges, -1));
});

const schema = JSON.parse(readFileSync("schemas/entities.schema.json", "utf8"));
const examples = JSON.parse(readFileSync("data/examples.json", "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

test("all 19 entity/projection examples pass Draft 2020-12 schemas", () => {
  assert.equal(examples.entities.length, 19);
  assert.equal(Object.keys(schema.$defs).length, 19);
  for (const entity of examples.entities) assert.equal(validate(entity), true, `${entity.entityType}: ${JSON.stringify(validate.errors)}`);
  const concept = { ...examples.entities.find((e: { entityType: string }) => e.entityType === "knowledgeNodes") };
  delete concept.canonId;
  assert.equal(validate(concept), true, "Knowledge nodes may exist independently of the official curriculum");
});
test("schemas reject private signing material, invalid sky coordinates and oversized notes", () => {
  const memory = examples.entities.find((e: { entityType: string }) => e.entityType === "memoryNodes");
  assert.equal(validate({ ...memory, privateJwk: { d: "secret" } }), false);
  assert.equal(validate({ ...memory, notes: "x".repeat(20001) }), false);
  const star = examples.entities.find((e: { entityType: string }) => e.entityType === "starObjects");
  assert.equal(validate({ ...star, rightAscensionDeg: 360 }), false);
  assert.equal(validate({ ...star, declinationDeg: -91 }), false);
});
test("fixture hierarchy and graph references resolve without crossing owners", () => {
  const byId = new Map<string, Record<string, unknown>>(examples.entities.filter((e: { id?: string }) => e.id).map((e: { id: string }) => [e.id, e]));
  const scalar = ["libraryId", "shelfId", "bookId", "chapterId", "sourceId", "targetId", "starId"];
  const arrays = ["mediaIds", "knowledgeNodeIds", "starIds", "linkedNodeIds"];
  for (const entity of examples.entities) {
    const refs: string[] = [...scalar.filter(key => entity[key] && !(entity.entityType === "archiveEntries" && key === "sourceId")).map(key => entity[key]), ...arrays.flatMap(key => entity[key] || [])];
    for (const ref of refs) {
      const target = byId.get(ref);
      assert.ok(target, `${entity.entityType} references missing ${ref}`);
      assert.equal(target.ownerUid, entity.ownerUid);
    }
  }
});
test("API draft parses and every schema/response reference resolves", () => {
  const contract = parse(readFileSync("api/openapi.yaml", "utf8"));
  assert.equal(contract.openapi, "3.1.0");
  const ids = Object.values(contract.paths).flatMap((path: any) => Object.values(path).map((operation: any) => operation.operationId));
  assert.equal(new Set(ids).size, 4);
  const visit = (value: any): void => {
    if (!value || typeof value !== "object") return;
    if (value.$ref) {
      const [file, pointer] = value.$ref.split("#");
      const root = file ? JSON.parse(readFileSync(`api/${file}`, "utf8")) : contract;
      const resolved = pointer.split("/").slice(1).reduce((current: any, part: string) => current?.[part.replace(/~1/g, "/").replace(/~0/g, "~")], root);
      assert.ok(resolved, value.$ref);
    }
    Object.values(value).forEach(visit);
  };
  visit(contract);
});
