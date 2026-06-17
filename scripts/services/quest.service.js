import { getDocument, setDocument, addToCollection } from "../firebase/firestore.js";
import { awardXP, awardVis } from "./arts.service.js";

// Quest definitions — add new quests here without touching any other file
export const QUESTS = [
  {
    id: "daily-resonance",
    title: "Daily Resonance",
    description: "Open any tome and read for at least 5 minutes.",
    type: "daily",
    reward: { art: "mathematics", xp: 15, vis: 10 },
  },
  {
    id: "first-tome",
    title: "The First Scroll",
    description: "Complete Tier 1: Foundational Literacy.",
    type: "milestone",
    reward: { art: "mathematics", xp: 100, vis: 50 },
  },
  {
    id: "shd-practitioner",
    title: "SHD-CCP Practitioner",
    description: "Master the SHD-CCP Introduction tome.",
    type: "milestone",
    reward: { art: "computation", xp: 150, vis: 75 },
  },
  {
    id: "biochain-architect",
    title: "Biochain Architect",
    description: "Master the Biochain SPIRE integration tome.",
    type: "milestone",
    reward: { art: "biochain", xp: 200, vis: 100 },
  },
];

const questPath = (uid, questId) => `users/${uid}/quests/${questId}`;

export const getQuestStatus = (uid, questId) =>
  getDocument(questPath(uid, questId));

export const completeQuest = async (uid, questId) => {
  const quest = QUESTS.find((q) => q.id === questId);
  if (!quest) throw new Error(`Unknown quest: ${questId}`);

  const existing = await getQuestStatus(uid, questId);
  if (existing?.status === "completed") return null; // already done

  await setDocument(questPath(uid, questId), {
    status: "completed",
    completedAt: new Date().toISOString(),
  });

  const { art, xp, vis } = quest.reward;
  await awardXP(uid, art, xp);
  await awardVis(uid, vis);

  // Log to chronicle
  await addToCollection(`chronicles`, {
    uid,
    questId,
    questTitle: quest.title,
    action: "quest_completed",
  });

  return quest.reward;
};

export const getActiveQuests = async (uid) => {
  const results = [];
  for (const quest of QUESTS) {
    const status = await getQuestStatus(uid, quest.id);
    if (!status || status.status !== "completed") {
      results.push({ ...quest, progress: status ?? null });
    }
  }
  return results;
};
