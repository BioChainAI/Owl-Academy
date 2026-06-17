import { getDocument, setDocument } from "../firebase/firestore.js";
import { getRank, getTotalXP } from "./user.service.js";

const profilePath = (uid) => `users/${uid}/profile/main`;

/**
 * Award XP to a specific Art and return the updated arts map.
 * All XP logic lives here — change the formula in one place.
 */
export const awardXP = async (uid, art, amount) => {
  const profile = await getDocument(profilePath(uid));
  if (!profile) throw new Error("Profile not found");

  const current = profile.arts?.[art] ?? 0;
  const updatedArts = { ...profile.arts, [art]: current + amount };
  const totalXP = getTotalXP(updatedArts);
  const newRank = getRank(totalXP);

  await setDocument(profilePath(uid), {
    arts: updatedArts,
    rank: newRank,
  });

  return { arts: updatedArts, rank: newRank, totalXP };
};

/**
 * Award Vis (spendable currency) to a user.
 */
export const awardVis = async (uid, amount) => {
  const profile = await getDocument(profilePath(uid));
  if (!profile) throw new Error("Profile not found");
  const newVis = (profile.vis ?? 0) + amount;
  await setDocument(profilePath(uid), { vis: newVis });
  return newVis;
};

/**
 * Spend Vis. Returns false if insufficient funds, true on success.
 */
export const spendVis = async (uid, amount) => {
  const profile = await getDocument(profilePath(uid));
  if (!profile || (profile.vis ?? 0) < amount) return false;
  await setDocument(profilePath(uid), { vis: profile.vis - amount });
  return true;
};

/**
 * Returns a 0-100 progress value toward next rank threshold.
 */
export const getRankProgress = (arts = {}) => {
  const THRESHOLDS = [0, 100, 250, 500, 900, 1500];
  const total = getTotalXP(arts);
  let lower = 0, upper = THRESHOLDS[THRESHOLDS.length - 1];
  for (let i = 0; i < THRESHOLDS.length - 1; i++) {
    if (total >= THRESHOLDS[i] && total < THRESHOLDS[i + 1]) {
      lower = THRESHOLDS[i];
      upper = THRESHOLDS[i + 1];
      break;
    }
  }
  return Math.min(100, Math.round(((total - lower) / (upper - lower)) * 100));
};
