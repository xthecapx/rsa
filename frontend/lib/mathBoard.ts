import type { RsaKeygenResponse } from "@/lib/api";
import type { ActNumber, MessagePayload, Tier } from "@/store/game";

export interface MathSection {
  title: string;
  prose?: string;
  equations: string[];
}

export interface MathBoardContent {
  prose: string;
  /** Worked examples — shown at every tier so you can talk through them. */
  sections: MathSection[];
  /** Extra theory equations (tier ≥ 2). */
  theory: string[];
}

function modPow(base: number, exp: number, mod: number): number {
  let result = 1;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0) {
    if (e & 1) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1;
  }
  return result;
}

function letterValue(char: string | null): number | null {
  if (!char || char.length !== 1) return null;
  const code = char.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) return null;
  return code - 64;
}

function caesarBoard(
  tier: Tier,
  shift: number,
  selectedChar: string | null,
  payload: MessagePayload | null,
): MathBoardContent {
  const letter = payload?.char ?? selectedChar;
  const m = letterValue(letter);
  const k = shift;
  // Same 0-based wrap as backend: ((m-1+k) mod 26) then back to 1..26
  const cVal =
    m != null ? ((((m - 1 + k) % 26) + 26) % 26) + 1 : null;
  const cChar =
    cVal != null ? String.fromCharCode(64 + cVal) : null;
  const plain = letter?.toUpperCase() ?? "m";
  // Display values used in the talk equations (1-based alphabet index)
  const encExpr =
    m != null && cVal != null
      ? `((${m} - 1 + ${k}) \\bmod 26) + 1 = ${cVal}`
      : null;
  const decExpr =
    m != null && cVal != null
      ? `((${cVal} - 1 - ${k}) \\bmod 26) + 1 = ${m}`
      : null;

  const sections: MathSection[] = [];

  if (m != null && cVal != null && cChar && encExpr && decExpr) {
    sections.push({
      title: "Ale encrypts (public shift k)",
      prose: `Letter ${plain} maps to m = ${m}. Ale adds the shift and wraps mod 26.`,
      equations: [
        `${plain} \\mapsto m = ${m}`,
        `c = (m + k) \\bmod 26`,
        `c = ${encExpr}`,
        `${cVal} \\mapsto ${cChar} \\quad\\text{(ciphertext on the cable)}`,
      ],
    });
    sections.push({
      title: "Brayan decrypts (same k)",
      prose: `Brayan subtracts k from the ciphertext value to recover the letter.`,
      equations: [
        `m = (c - k) \\bmod 26`,
        `m = ${decExpr}`,
        `${m} \\mapsto ${plain}`,
      ],
    });
  } else {
    sections.push({
      title: "Ale encrypts",
      prose: "Pick a letter to fill numbers into the encrypt equation.",
      equations: [
        "c = (m + k) \\bmod 26",
        `k = ${k}`,
      ],
    });
    sections.push({
      title: "Brayan decrypts",
      prose: "Same shift undoes the cipher.",
      equations: ["m = (c - k) \\bmod 26"],
    });
  }

  const theory =
    tier >= 3
      ? ["|K| = 25 \\quad\\text{(brute-force is trivial)}"]
      : tier >= 2
        ? [`k = ${k}`, "\\text{Hacker tries all } k \\in \\{1,\\ldots,25\\}"]
        : [];

  return {
    prose:
      tier === 1
        ? "Caesar: Ale adds k, Brayan subtracts k. The Hacker can try every k."
        : "Worked encrypt / decrypt with the live letter and shift.",
    sections,
    theory,
  };
}

function rsaBoard(
  tier: Tier,
  keys: RsaKeygenResponse | null,
  selectedChar: string | null,
  payload: MessagePayload | null,
  rsaCipher: number | null,
): MathBoardContent {
  const letter = (payload?.char ?? selectedChar)?.toUpperCase() ?? null;
  const m = letterValue(letter);
  const N = keys?.N ?? null;
  const e = keys?.e ?? null;
  const d = keys?.d ?? null;
  const p = keys?.p ?? null;
  const q = keys?.q ?? null;
  const phi = keys?.phi ?? null;

  const cFromStore =
    rsaCipher ??
    (payload?.ciphertext != null ? Number(payload.ciphertext) : null);
  const c =
    cFromStore != null && !Number.isNaN(cFromStore)
      ? cFromStore
      : m != null && e != null && N != null
        ? modPow(m, e, N)
        : null;
  const mRecovered =
    c != null && d != null && N != null ? modPow(c, d, N) : null;

  const sections: MathSection[] = [];

  if (keys && p != null && q != null && phi != null && e != null && d != null) {
    sections.push({
      title: "Brayan builds the keys",
      prose: "Private key stays with Brayan. Public key is published on the cable.",
      equations: [
        `N = p \\cdot q = ${p} \\cdot ${q} = ${keys.N}`,
        `\\varphi(N) = (p-1)(q-1) = ${p - 1}\\cdot${q - 1} = ${phi}`,
        `\\text{public } (e, N) = (${e},\\, ${keys.N})`,
        `\\text{private } (d, N) = (${d},\\, ${keys.N})`,
        `e \\cdot d = ${e}\\cdot${d} = ${e * d} \\equiv 1 \\pmod{${phi}}`,
      ],
    });
  }

  if (m != null && e != null && N != null && c != null && letter) {
    sections.push({
      title: "Ale encrypts with the public key",
      prose: `Ale maps ${letter} → m = ${m}, then raises to e and reduces mod N. Only the public key is needed.`,
      equations: [
        `${letter} \\mapsto m = ${m}`,
        `c = m^{e} \\bmod N`,
        `c = ${m}^{${e}} \\bmod ${N} = ${c}`,
        `\\text{send ciphertext } c = ${c} \\text{ on the public cable}`,
      ],
    });
  } else {
    sections.push({
      title: "Ale encrypts with the public key",
      prose: "Pick a letter (coprime to N) to fill m, e, N and see c.",
      equations: [
        "c = m^{e} \\bmod N",
        e != null && N != null
          ? `\\text{public key } (e, N) = (${e},\\, ${N})`
          : "\\text{waiting for keygen…}",
      ],
    });
  }

  if (
    c != null &&
    d != null &&
    N != null &&
    mRecovered != null &&
    letter
  ) {
    sections.push({
      title: "Brayan decrypts with the private key",
      prose: `Brayan raises the ciphertext to d mod N. The Hacker has c and (e, N) but not d.`,
      equations: [
        `m = c^{d} \\bmod N`,
        `m = ${c}^{${d}} \\bmod ${N} = ${mRecovered}`,
        `${mRecovered} \\mapsto ${letter}`,
      ],
    });
  } else {
    sections.push({
      title: "Brayan decrypts with the private key",
      prose: "After c arrives, Brayan uses d (never on the cable).",
      equations: [
        "m = c^{d} \\bmod N",
        d != null && N != null
          ? `\\text{private key } (d, N) = (${d},\\, ${N})`
          : "\\text{waiting for keygen…}",
      ],
    });
  }

  const theory: string[] = [];
  if (tier >= 2) {
    theory.push("\\gcd(m, N) = 1 \\quad\\text{(required for this toy demo)}");
  }
  if (tier >= 3) {
    theory.push(
      "\\text{Security: hard to find } d \\text{ from } (e, N) \\text{ without factoring } N",
    );
    theory.push(
      "\\text{Hacker inventory: public } (e, N) \\text{ and } c \\text{ — not enough}",
    );
  }

  return {
    prose:
      tier === 1
        ? "Talk track: Brayan makes keys → Ale encrypts with (e, N) → Brayan decrypts with d."
        : "Live substitution: every symbol below is the value on stage right now.",
    sections,
    theory,
  };
}

function plaintextBoard(
  tier: Tier,
  selectedChar: string | null,
  payload: MessagePayload | null,
): MathBoardContent {
  const letter = (payload?.char ?? selectedChar)?.toUpperCase() ?? null;
  const m = letterValue(letter);
  const sections: MathSection[] = [
    {
      title: "What travels on the cable",
      prose: "No encryption — the letter itself is the payload.",
      equations:
        m != null && letter
          ? [
              `${letter} \\mapsto m = ${m}`,
              `\\text{payload} = ${letter} \\quad\\text{(Hacker reads it instantly)}`,
            ]
          : ["\\text{payload} = \\text{the letter itself}"],
    },
  ];
  const theory =
    tier >= 2
      ? [
          "m \\in \\{1,\\ldots,26\\}",
          "A \\mapsto 1,\\; Z \\mapsto 26",
        ]
      : [];
  if (tier >= 3) {
    theory.push("I(M;E)=H(M) \\quad\\text{(no secrecy)}");
  }
  return {
    prose:
      "Plaintext: Ale and Brayan share a letter; the Hacker sees the same letter.",
    sections,
    theory,
  };
}

function shorBoard(tier: Tier, modulus: number, a: number): MathBoardContent {
  return {
    prose:
      "Shor finds the period r of a^x mod N, then classical post-processing yields factors.",
    sections: [
      {
        title: "Period finding",
        prose: `Find the order of a = ${a} modulo N = ${modulus}.`,
        equations: [
          `a^{r} \\equiv 1 \\pmod{${modulus}}`,
          `\\gcd(a^{r/2}\\pm 1,\\, ${modulus}) \\;\\Rightarrow\\; \\text{factors}`,
        ],
      },
    ],
    theory:
      tier >= 3
        ? [
            "T_{\\text{classical}} \\sim O(\\sqrt{N})",
            "T_{\\text{Shor}} \\sim O((\\log N)^{3})",
          ]
        : tier >= 2
          ? ["\\text{QFT estimates phase } s/r"]
          : [],
  };
}

export function buildMathBoard(opts: {
  act: ActNumber;
  tier: Tier;
  shift: number;
  modulus: number;
  shorA: number;
  selectedChar: string | null;
  payload: MessagePayload | null;
  rsaKeys: RsaKeygenResponse | null;
  rsaCipher: number | null;
}): MathBoardContent {
  const { act, tier } = opts;
  if (act === 1) {
    return plaintextBoard(tier, opts.selectedChar, opts.payload);
  }
  if (act === 2) {
    return caesarBoard(tier, opts.shift, opts.selectedChar, opts.payload);
  }
  if (act === 3) {
    return rsaBoard(
      tier,
      opts.rsaKeys,
      opts.selectedChar,
      opts.payload,
      opts.rsaCipher,
    );
  }
  return shorBoard(tier, opts.modulus, opts.shorA);
}
