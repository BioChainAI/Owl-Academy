# Tome Knowledge Graph

Node types: Concept, Project, Person, Symbol, Location, Star, Research, Experiment, Geometry. Edge types: references, derives-from, inspires, relates-to, contains, maps-to. Canon prerequisites can produce derives-from edges keyed by stable canonId; missing seats must render as unresolved references rather than silently creating new official curriculum.

`traversal.ts` supplies directed breadth-first reachability with a visited set and maximum depth. It includes the start node, handles cycles, and does not enforce access or a total-size budget. The future graph service must first filter visible edges/nodes and cap returned nodes/edges; never use this primitive directly on an unrestricted private graph.

Next: build a fixture-based graph view with a keyboard/list alternative. Constellation and archive-map views should consume the same access-filtered read model, not maintain separate relationship stores.
