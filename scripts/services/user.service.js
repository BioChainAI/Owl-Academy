import { getDocument, setDocument, watchDocument } from "../firebase/firestore.js";

export const SCHOOLS = [
  "Geometer",
  "Arithmetician",
  "Sacred Scientist",
  "Biochain Architect",
  "Hyper-Sim Topologist",
];

const DEFAULT_ARTS = {
  mathematics: 0,
  geometry: 0,
  sacred_sciences: 0,
  biochain: 0,
  computation: 0,
};

const RANK_THRESHOLDS = [
  { min: 0,    label: "Initiate" },
  { min: 100,  label: "Adept" },
  { min: 250,  label: "Scholar" },
  { min: 500,  label: "Magister" },
  { min: 900,  label: "Archon" },
];

export const getRank = (totalXP) => {
  let rank = RANK_THRESHOLDS[0].label;
  for (const tier of RANK_THRESHOLDS) {
    if (totalXP >= tier.min) rank = tier.label;
  }
  return rank;
};

export const getTotalXP = (arts = {}) =>
  Object.values(arts).reduce((sum, v) => sum + (v || 0), 0);

const profilePath = (uid) => `users/${uid}/profile/main`;

export const getOrCreateProfile = async (user) => {
  const path = profilePath(user.uid);
  const existing = await getDocument(path);
  if (existing) return existing;

  const profile = {
    displayName: user.displayName || "Unknown Scholar",
    email: user.email,
    avatarUrl: user.photoURL || null,
    school: null,
    vis: 50,           // starting Vis stipend
    arts: { ...DEFAULT_ARTS },
    tomes: {},
    completedQuests: [],
  };

  await setDocument(path, profile);
  return profile;
};

export const updateProfile = (uid, data) => setDocument(profilePath(uid), data);

export const watchProfile = (uid, callback) =>
  watchDocument(profilePath(uid), callback);
