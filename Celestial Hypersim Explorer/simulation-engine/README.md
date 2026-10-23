# Hyper-Sim Chambers

Proposed scene kinds: archive room, observatory, geometric chamber, educational environment. A scene receives access-filtered domain IDs and immutable descriptors, not raw Firestore clients or private keys. It implements mount, pause/resume and dispose, releasing input handlers, subscriptions, animation loops and GPU resources.

Persistent state stores sceneId, moduleId, revision, seed, position, linked node IDs and schemaVersion. A future service supplies owner/timestamps and uses compare-and-swap revisions. Render objects and credentials never enter saves. Specify migrations and a maximum serialized size before persistence.

Next: one deterministic local room fixture with no network writes, then owner-private emulator saves and conflict recovery. Multiplayer authority, clock synchronization and shared-world moderation are phase 7 work; the current package has no game server.
