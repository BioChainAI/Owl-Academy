# Environment descriptors

Future environments reference module IDs, scene kind, data schema version, deterministic seed, resource budget and required rendering capabilities. Use stable IDs rather than executable script URLs. A room/sky/geometry renderer consumes the same domain read models as the traditional dashboard.

No world files or runtime scene loader exist yet. Next slice: a validated archive-room descriptor containing only public canon IDs, followed by explicit validation and a graceful text fallback when WebGL is unavailable. Environments cannot request extra user permissions or alter resource ownership through their descriptor.
