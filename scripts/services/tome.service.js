import { getDocument, setDocument } from "../firebase/firestore.js";
import { awardXP, awardVis } from "./arts.service.js";

// XP and Vis rewards per tier of completion
const COMPLETION_REWARDS = {
  started:   { xp: 5,  vis: 0  },
  reading:   { xp: 10, vis: 5  },
  mastered:  { xp: 50, vis: 20 },
};

// Maps tome IDs to their associated Art
const TOME_ART_MAP = {
  "tier-1": "mathematics",
  "tier-2": "computation",
  "tier-3": "biochain",
  "tier-4": "geometry",
  "spire-manual": "sacred_sciences",
  "shd-ccp-intro": "computation",
  "biochain-spire": "biochain",
};

const tomePath = (uid, tomeId) => `users/${uid}/tomes/${tomeId}`;

export const getTomeProgress = (uid, tomeId) =>
  getDocument(tomePath(uid, tomeId));

export const setTomeStatus = async (uid, tomeId, status, progressPct = null) => {
  const existing = await getDocument(tomePath(uid, tomeId));
  const prevStatus = existing?.status;

  const data = {
    status,
    lastOpened: new Date().toISOString(),
    ...(progressPct !== null && { progress: progressPct }),
  };

  await setDocument(tomePath(uid, tomeId), data);

  // Only award XP when advancing to a new status level
  const statusOrder = ["started", "reading", "mastered"];
  const prevIdx = statusOrder.indexOf(prevStatus);
  const newIdx = statusOrder.indexOf(status);

  if (newIdx > prevIdx) {
    const reward = COMPLETION_REWARDS[status];
    const art = TOME_ART_MAP[tomeId] ?? "mathematics";
    await awardXP(uid, art, reward.xp);
    if (reward.vis > 0) await awardVis(uid, reward.vis);
    return reward;
  }

  return null;
};

export const getAllTomes = (uid) =>
  getDocument(`users/${uid}/profile/main`).then((p) => p?.tomes ?? {});
