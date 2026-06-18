/**
 * Vis Token Service
 *
 * Vis is the academy's internal currency. It is earned through:
 *   - Leveling up (20 Vis per level)
 *   - Receiving stamps on authored tomes (2 Vis per stamp, capped at 20 stamps per tome)
 *
 * Anti-spam measures:
 *   - Max 10 stamps a user may give per day
 *   - Creator only earns Vis from the first 20 unique stamps per tome
 *   - Stamp Vis is synced pull-based from the creator's own Codex load (no cross-user writes)
 */

import { db } from "../firebase/config.js";
import { getDocument, setDocument } from "../firebase/firestore.js";
import { getTotalXP } from "./user.service.js";
import {
  collection, addDoc, query, orderBy, limit as firestoreLimit,
  getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ── Anti-spam constants ───────────────────────────────────────────────────────
export const ANTI_SPAM = {
  MAX_STAMPS_PER_DAY:       10,  // max stamps a user can give per day
  VIS_PER_STAMP:             2,  // vis creator earns per stamp received
  STAMP_VIS_CAP_PER_TOME:   20,  // max stamps that generate vis per tome (40 vis max)
  MIN_ACCOUNT_AGE_DAYS:      1,  // account must be this old before stamps yield creator vis
  STAMP_XP:                  5,  // xp per stamp (informational — used in Codex)
};

// ── Level math ────────────────────────────────────────────────────────────────
// XP needed to reach level N: sum_{i=1}^{N} (100 + 10*(i-1)) = N*100 + 10*N*(N-1)/2

function xpForLevel(n) {
  return n * 100 + 10 * n * (n - 1) / 2;
}

/**
 * Returns level info derived from total XP.
 * @param {number} totalXP
 * @returns {{ level, xpIntoCurrentLevel, xpNeededForNext, progress }}
 */
export function getLevelInfo(totalXP) {
  let level = 0;
  while (xpForLevel(level + 1) <= totalXP) {
    level++;
  }
  const xpAtCurrentLevel = xpForLevel(level);
  const xpAtNextLevel    = xpForLevel(level + 1);
  const xpIntoCurrentLevel = totalXP - xpAtCurrentLevel;
  const xpNeededForNext    = xpAtNextLevel - xpAtCurrentLevel;
  const progress = Math.round((xpIntoCurrentLevel / xpNeededForNext) * 100);
  return { level, xpIntoCurrentLevel, xpNeededForNext, progress };
}

// ── Vis transaction writer ────────────────────────────────────────────────────
async function writeTransaction(uid, data) {
  await addDoc(collection(db, `users/${uid}/transactions`), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Award Vis to a user and record a transaction.
 * Only writes to the user's own documents — no cross-user writes.
 */
export async function awardVis(uid, amount, reason, meta = {}) {
  if (amount <= 0) return;
  const profilePath = `users/${uid}/profile/main`;
  const profile = await getDocument(profilePath);
  const current = profile?.vis ?? 0;
  await setDocument(profilePath, { vis: current + amount });
  await writeTransaction(uid, { type: 'award', amount, reason, ...meta });
}

/**
 * Spend Vis on a store item.
 * Throws if balance insufficient.
 * @returns {number} new Vis balance
 */
export async function spendVis(uid, amount, itemId, itemTitle) {
  const profilePath = `users/${uid}/profile/main`;
  const profile = await getDocument(profilePath);
  const current = profile?.vis ?? 0;
  if (current < amount) throw new Error('Insufficient Vis');
  const newBalance = current - amount;
  await setDocument(profilePath, { vis: newBalance });
  await writeTransaction(uid, { type: 'purchase', amount: -amount, itemId, itemTitle });
  // Record in inventory
  await setDocument(`users/${uid}/inventory/${itemId}`, {
    itemId,
    itemTitle,
    purchasedAt: serverTimestamp(),
    active: true,
  });
  return newBalance;
}

/**
 * Check if the user has leveled up since last recorded level and award Vis if so.
 * Call this on profile load / after XP sync.
 * @param {string} uid
 * @param {object} arts  — arts XP map from profile
 * @returns {{ leveled: boolean, newLevel?: number, visAwarded?: number }}
 */
export async function checkAndAwardLevelUp(uid, arts) {
  const totalXP = getTotalXP(arts);
  const { level: computedLevel } = getLevelInfo(totalXP);

  const profilePath = `users/${uid}/profile/main`;
  const profile = await getDocument(profilePath);
  const storedLevel = profile?.level ?? 0;

  if (computedLevel <= storedLevel) return { leveled: false };

  const diff = computedLevel - storedLevel;
  const visAwarded = diff * 20;

  // Award vis and update level in one write
  const current = profile?.vis ?? 0;
  await setDocument(profilePath, { vis: current + visAwarded, level: computedLevel });
  await writeTransaction(uid, {
    type: 'level_up',
    amount: visAwarded,
    fromLevel: storedLevel,
    toLevel: computedLevel,
    reason: 'XP level-up',
  });

  return { leveled: true, newLevel: computedLevel, visAwarded };
}

/**
 * Pull-sync Vis rewards for stamps received on creator's tomes.
 * Only awards Vis for stamps up to STAMP_VIS_CAP_PER_TOME per tome.
 * Tracks progress in profile.stampVisData to never double-award.
 *
 * @param {string} uid
 * @param {{ id: string, stampCount: number }[]} tomes — creator's tomes
 * @returns {number} total new Vis awarded this sync
 */
export async function syncStampVis(uid, tomes) {
  if (!tomes.length) return 0;

  const profilePath = `users/${uid}/profile/main`;
  const profile = await getDocument(profilePath);
  const stampVisData = profile?.stampVisData ?? {};

  let totalNew = 0;
  const updatedStampVisData = { ...stampVisData };

  for (const tome of tomes) {
    const capped = Math.min(tome.stampCount || 0, ANTI_SPAM.STAMP_VIS_CAP_PER_TOME);
    const alreadyAwarded = stampVisData[tome.id] || 0;
    const newStamps = Math.max(0, capped - alreadyAwarded);
    if (newStamps > 0) {
      totalNew += newStamps * ANTI_SPAM.VIS_PER_STAMP;
      updatedStampVisData[tome.id] = capped;
    }
  }

  if (totalNew > 0) {
    const current = profile?.vis ?? 0;
    await setDocument(profilePath, { vis: current + totalNew, stampVisData: updatedStampVisData });
    await writeTransaction(uid, {
      type: 'award',
      amount: totalNew,
      reason: 'stamp_reward',
      tomeCount: tomes.length,
    });
  }

  return totalNew;
}

/**
 * Fetch the last N transactions for a user.
 */
export async function getTransactions(uid, limitN = 20) {
  const snap = await getDocs(
    query(
      collection(db, `users/${uid}/transactions`),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitN),
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch all inventory items for a user.
 */
export async function getInventory(uid) {
  const snap = await getDocs(collection(db, `users/${uid}/inventory`));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
