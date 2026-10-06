import { COIN_KNOWLEDGE_IDS, FOUNDRY_KNOWLEDGE_IDS, HOLLOW_KNOWLEDGE_IDS, CIPHER_KNOWLEDGE_IDS, type KnowledgeId } from "@/content/knowledge";
import type { ScenarioId } from "@/content/scenarios";

// Public teaching checkpoints, not serialized private puzzle/results snapshots.
export const CHECKPOINT_TOWNS = [
  { prefix: "ct", title: "Coin Town", location: "coinTown", scenario: "coin", cards: COIN_KNOWLEDGE_IDS, missions: ["coin"] },
  { prefix: "ft", title: "Foundry Town", location: "foundry", scenario: "grover", cards: FOUNDRY_KNOWLEDGE_IDS, missions: ["grover"] },
  { prefix: "ht", title: "Hollow Town", location: "hollow", scenario: "vault", cards: HOLLOW_KNOWLEDGE_IDS, missions: ["vault"] },
  { prefix: "ci", title: "Cipher Town", location: "cipher", scenario: "rsa", cards: CIPHER_KNOWLEDGE_IDS, missions: ["1", "2", "3", "4"] },
] as const;
export interface TeachingCheckpoint {
  code: string;
  title: string;
  stage: 1 | 2 | 3;
  location: "coinTown" | "foundry" | "hollow" | "cipher" | "town";
  cards: KnowledgeId[];
  completed: Partial<Record<ScenarioId, string[]>>;
}
export function checkpoint(code: string): TeachingCheckpoint | null {
  const normalized = code.trim().toLowerCase();
  const hub = normalized === "qt1";
  const index = hub ? 4 : CHECKPOINT_TOWNS.findIndex((town) => new RegExp(`^${town.prefix}[123]$`).test(normalized));
  if (index < 0) return null;
  const stage = (hub ? 1 : Number(normalized.at(-1))) as 1 | 2 | 3;
  const cards: KnowledgeId[] = [];
  const completed: TeachingCheckpoint["completed"] = {};
  for (const [i, town] of CHECKPOINT_TOWNS.entries()) {
    if (i < index || (i === index && stage >= 2)) cards.push(...town.cards);
    if (i < index || (i === index && stage === 3)) completed[town.scenario] = [...town.missions, "town"];
  }
  const town = CHECKPOINT_TOWNS[index];
  return { code: normalized, title: hub ? "Quantum Town" : town.title, stage, location: hub ? "town" : town.location, cards, completed };
}
export function currentCheckpoint(location: string, cards: readonly KnowledgeId[], completed: Record<string, string[]>): string {
  if (location === "town") return "qt1";
  const town = CHECKPOINT_TOWNS.find((item) => item.location === location || (location === "coin" && item.scenario === "coin") || (location === "grover" && item.scenario === "grover") || (location === "vault" && item.scenario === "vault")) ?? CHECKPOINT_TOWNS[0];
  const allCards = town.cards.every((card) => cards.includes(card));
  const allMissions = town.missions.every((mission) => completed[town.scenario]?.includes(mission));
  return `${town.prefix}${allCards ? allMissions ? 3 : 2 : 1}`;
}
