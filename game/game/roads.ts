import type { MedalId } from "@/content/medals";

/**
 * Which roads are open. Towns open strictly in challenge order, each by the
 * challenge medal of the town before it (older town badges also count):
 *
 *   Coin Town ─(Quantum Coin)────────→ Foundry Town (east)
 *             ─(Amplitude Amplifier)─→ Hollow Town (west)
 *             ─(Ghost Key)───────────→ Cipher Town (north) ─(four RSA medals)→ Quantum Town
 *
 * A road stays open once a later badge is earned. Saves from before the towns
 * existed keep their way in: they already met Professor Thecap in Quantum Town,
 * or ran RSA acts on its street. Explicit checkpoints restore badge progress.
 */
export interface RoadFacts {
  badges: { coin: boolean; foundry: boolean; hollow: boolean; cipher: boolean };
  /** Professor Thecap has welcomed this save in Quantum Town. */
  metThecap: boolean;
  /** RSA acts finished, which before Cipher Town only Quantum Town's street offered. */
  rsaActs: number;
}
export interface Roads {
  /** Coin Town's east road to Foundry Town. */
  coinEast: boolean;
  /** Coin Town's west road to Hollow Town. */
  coinWest: boolean;
  /** Coin Town's north road to Cipher Town. */
  coinNorth: boolean;
  /** Cipher Town's north road to Quantum Town. */
  cipherNorth: boolean;
}

/** Roads use earned challenges, independently of optional knowledge cards or ceremonies. */
export function roadBadges(earned: Partial<Record<MedalId, string>>): RoadFacts["badges"] {
  return {
    coin: !!(earned["quantum-coin"] || earned["coin-town"]),
    foundry: !!(earned.amplifier || earned["foundry-town"]),
    hollow: !!(earned["ghost-key"] || earned["hollow-town"]),
    cipher: !!earned["cipher-town"] || (["codebook", "key-ring", "prime-cutter", "period-lens"] as const).every((id) => !!earned[id]),
  };
}

export function openRoads({ badges, metThecap, rsaActs }: RoadFacts): Roads {
  const legacy = metThecap || rsaActs > 0;
  const cipherNorth = badges.cipher || metThecap;
  const coinNorth = badges.hollow || badges.cipher || legacy;
  const coinWest = coinNorth || badges.foundry;
  const coinEast = coinWest || badges.coin;
  return { coinEast, coinWest, coinNorth, cipherNorth };
}
