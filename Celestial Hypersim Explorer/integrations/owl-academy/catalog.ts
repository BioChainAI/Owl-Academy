import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CanonTome } from "../../schemas/domain";

/** Build-time, read-only projection of the actual canon, not a second curriculum. */
export async function loadAcademyCatalog(): Promise<CanonTome[]> {
  const file = path.resolve(process.cwd(), "../canon/canon.manifest.json");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  if (manifest.format !== "owl-canon/1" || !Array.isArray(manifest.tomes)) throw new Error("Unsupported Owl Academy canon");
  return manifest.tomes.map((tome: CanonTome) => ({
    canonId: tome.canonId, globalIndex: tome.globalIndex, title: tome.title, dept: tome.dept,
    artifact: tome.artifact, requiredTier: tome.requiredTier, status: tome.status,
    contentPath: tome.contentPath, prereqs: tome.prereqs,
  }));
}
