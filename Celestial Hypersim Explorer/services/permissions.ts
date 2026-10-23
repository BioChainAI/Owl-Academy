import { TIERS, type Principal, type ResourceScope } from "../schemas/domain";

export type Action = "read" | "edit-memory" | "author-lesson" | "publish-canon" | "manage-authority";

/** Draft policy, used for tests/design only; never substitutes for Firebase rules. */
export function can(principal: Principal | null, action: Action, resource: ResourceScope): boolean {
  if (!principal || principal.authority !== "server-verified" || !principal.uid || !TIERS.includes(principal.tier)) return false;
  const owns = principal.uid === resource.ownerUid;
  const scoped = principal.certifiedPlanes.includes("*") || principal.certifiedPlanes.includes(resource.plane);
  switch (action) {
    case "read": return owns || resource.visibility === "academy";
    case "edit-memory": return owns;
    case "author-lesson": return scoped && (principal.tier === "INSTRUCTOR" || principal.tier === "ARCHON");
    case "publish-canon":
    case "manage-authority": return principal.tier === "ARCHON" && scoped;
    default: return false;
  }
}
