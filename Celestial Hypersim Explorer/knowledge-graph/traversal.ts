import type { KnowledgeEdge } from "../schemas/domain";

/** Bounded, cycle-safe directed traversal for future memory/constellation views. */
export function reachableNodes(startId: string, edges: KnowledgeEdge[], maxDepth = 3): string[] {
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 20) throw new Error("Depth must be an integer from 0 to 20");
  const visited = new Set([startId]);
  let frontier = [startId];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: string[] = [];
    for (const node of frontier) for (const edge of edges) {
      if (edge.sourceId === node && !visited.has(edge.targetId)) {
        visited.add(edge.targetId); next.push(edge.targetId);
      }
    }
    frontier = next;
  }
  return [...visited];
}
