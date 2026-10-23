export interface ExplorerModule {
  id: string;
  name: string;
  phase: number;
  status: "scaffold" | "planned";
  purpose: string;
  source: string;
  data: string[];
}
export const modules: ExplorerModule[] = [
  { id: "grand-archives", name: "Grand Archives", phase: 1, status: "scaffold", purpose: "Search the Major Tome canon and navigate Academy research systems.", source: "Library/Grand_Archives.html", data: ["archiveEntries", "majorTomes"] },
  { id: "tome-knowledge-graph", name: "Tome Knowledge Graph", phase: 2, status: "planned", purpose: "Connect concepts, canon prerequisites, research, and geometric systems.", source: "canon/canon.manifest.json", data: ["knowledgeNodes", "knowledgeEdges"] },
  { id: "minor-tome-memory-vault", name: "Minor Tome Memory Vault", phase: 3, status: "planned", purpose: "Organize private memories into libraries, shelves, books, chapters, and nodes.", source: "scripts/minor-tome.js", data: ["memoryLibraries", "memoryShelves", "memoryBooks", "memoryChapters", "memoryNodes"] },
  { id: "celestial-observatory", name: "Celestial Observatory", phase: 4, status: "planned", purpose: "Link astronomical observations to Academy research; keep stars distinct from Genesis positions.", source: "mage_tower/Constellation_Map.html", data: ["starObjects", "skyConstellations", "observations"] },
  { id: "sacred-geometry", name: "Sacred Geometry & Topology", phase: 5, status: "planned", purpose: "Explore Platonic solids, Clifford tori, lattices, and rational geometric computation.", source: "Library/DepartmentI/Sacred_Geometry/Platonic_Solids/index.html", data: ["geometryObjects", "geometryRelationships"] },
  { id: "hyper-sim-chambers", name: "Hyper-Sim Chambers", phase: 6, status: "planned", purpose: "Host independent archive-room, observatory, and learning scenes with versioned saves.", source: "scripts/services/user.service.js (Hyper-Sim Topologist school)", data: ["simulationStates"] },
];
