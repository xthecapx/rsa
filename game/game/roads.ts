/**
 * Which roads are open. Towns open strictly in challenge order, each by the
 * badge of the town before it:
 *
 *   Coin Town ─(Coin Town badge)→ Foundry Town (east)
 *             ─(Foundry Badge)──→ Hollow Town (west)
 *             ─(Hollow Badge)───→ Cipher Town (north) ─(Cipher Badge)→ Quantum Town
 *
 * A road stays open once a later badge is earned. Saves from before the towns
 * existed keep their way in: they already met Professor Thecap in Quantum Town,
 * or ran RSA acts on its street. The temporary travel pass opens everything.
 */
export interface RoadFacts {
  pass: boolean;
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

export function openRoads({ pass, badges, metThecap, rsaActs }: RoadFacts): Roads {
  const legacy = metThecap || rsaActs > 0;
  const cipherNorth = pass || badges.cipher || metThecap;
  const coinNorth = pass || badges.hollow || badges.cipher || legacy;
  const coinWest = coinNorth || badges.foundry;
  const coinEast = coinWest || badges.coin;
  return { coinEast, coinWest, coinNorth, cipherNorth };
}
