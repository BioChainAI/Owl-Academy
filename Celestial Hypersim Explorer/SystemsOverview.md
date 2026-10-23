# Systems overview

The Grand Archives module is the Explorer shell, not a replacement for `Library/Grand_Archives.html`. All presentations share stable canonical references and typed read models rather than maintaining separate curricula per renderer.

```mermaid
flowchart TD
  Canon[Existing Major Tome canon] --> Archive[Grand Archives read model]
  Identity[Future verified Firebase UID + authority] -.-> Policy[Resource policy]
  Policy -.-> Archive
  Archive --> Web[Traditional web dashboard]
  Archive -.-> Graph[Tome Knowledge Graph]
  Archive -.-> Vault[Minor Tome Memory Vault]
  Graph -.-> Sky[Celestial Observatory]
  Graph -.-> Geometry[Sacred Geometry & Topology]
  Vault -.-> Scenes[Hyper-Sim Chambers / 3D archive]
  Sky -.-> Scenes
  Geometry -.-> Scenes
  Scenes -.-> AI[Future reviewed AI world proposals]
```

Solid arrows represent current file projection and dashboard use; dotted arrows are planned. Module boundaries, ownership, data contracts, next work and acceptance criteria are in `modules/README.md`. Each engine directory contains a scoped continuation contract. No subsystem may interpret a future scene, AI output, or personal note as authority to issue certificates or award progression.
