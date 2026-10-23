export const TIERS = ["ACOLYTE", "INSTRUCTOR", "ARCHON"] as const;
export type Tier = typeof TIERS[number];
export type Department = "I" | "II" | "III" | "IV" | "V" | "VI" | "VII" | "VIII" | "IX" | "X";
export type Plane = `dept-${Department}`;

export interface CanonTome {
  canonId: string;
  globalIndex: number;
  title: string;
  dept: Department;
  artifact: string;
  requiredTier: Tier;
  status: "active" | "manuscript" | "reference" | "sealed";
  contentPath: string | null;
  prereqs: string[];
}

/** Only a future trusted token verifier may construct an authenticated principal. */
export interface Principal {
  uid: string;
  tier: Tier;
  certifiedPlanes: (Plane | "*")[];
  authority: "server-verified";
}
export interface ResourceScope {
  ownerUid: string;
  visibility: "private" | "academy";
  plane: Plane;
}
export type KnowledgeKind = "Concept" | "Project" | "Person" | "Symbol" | "Location" | "Star" | "Research" | "Experiment" | "Geometry";
export type EdgeKind = "references" | "derives-from" | "inspires" | "relates-to" | "contains" | "maps-to";
export interface KnowledgeNode { id: string; label: string; kind: KnowledgeKind; canonId?: string }
export interface KnowledgeEdge { id: string; sourceId: string; targetId: string; kind: EdgeKind }
