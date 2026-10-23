# Celestial Observatory

Proposed input records: starObjects (catalogId, name, right ascension, declination, epoch/frame, provenance), skyConstellations (star IDs and source), and owner-private observations. The existing `mage_tower/Constellation_Map.html` maps Genesis identities; its positions are not astronomical data.

Example Sirius coordinates are illustrative and explicitly labeled; do not use them for navigation or scientific conclusions. Before implementation, select a licensed catalog and specify time scales, observer location handling, epoch/precession transformations, units and accuracy tests.

Future adapters may evaluate Stellarium Web Engine, Three.js or WebGPU after compatibility/license review. First build an object-detail web view linked to canon/research; only then add a celestial-sphere renderer. Device location is opt-in and should not be persisted by default.
