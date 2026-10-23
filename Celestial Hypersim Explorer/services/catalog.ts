import type { CanonTome, Department } from "../schemas/domain";

export function searchCanon(tomes: CanonTome[], query: string, department: Department | "all"): CanonTome[] {
  const term = query.trim().toLocaleLowerCase();
  return tomes.filter(tome => (department === "all" || tome.dept === department)
    && `${tome.title} ${tome.canonId} ${tome.artifact}`.toLocaleLowerCase().includes(term));
}
