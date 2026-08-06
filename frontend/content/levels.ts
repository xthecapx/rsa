import type { ActNumber, Tier } from "@/store/game";

export interface LevelCopy {
  headline: string;
  subhead: string;
  blackboard: {
    tier1: string;
    tier2: string;
    tier3: string;
  };
  sendLabel: string;
  hint?: string;
}

export const ACT_TITLES: Record<ActNumber, string> = {
  1: "Plaintext",
  2: "Caesar",
  3: "RSA",
  4: "Shor",
};

export const ACT_SUBTITLES: Record<ActNumber, string> = {
  1: "No secrets on the wire",
  2: "Shift cipher, brute-forceable",
  3: "Public key, hidden factors",
  4: "Quantum period finding",
};

export const LEVELS: Record<ActNumber, Record<Tier, LevelCopy>> = {
  1: {
    1: {
      headline: "Send a letter in the clear",
      subhead: "One cable Ale → Brayan. Hacker can tap it.",
      blackboard: {
        tier1:
          "Ale sends the letter on a public cable. The Hacker taps the same cable and reads the message instantly. No encryption — what you send is what Eve sees.",
        tier2:
          "We map each letter to a number before we talk about encryption.",
        tier3:
          "Threat model: a passive eavesdropper on the public channel. Confidentiality is zero because the message itself is on the wire.",
      },
      sendLabel: "Send plaintext",
      hint: "Pick a letter, then Send (Space).",
    },
    2: {
      headline: "Map letters to numbers",
      subhead: "A→1, B→2, … Z→26 before we encrypt anything.",
      blackboard: {
        tier1: "Each letter becomes a number from 1 to 26.",
        tier2:
          "Same mapping every act will reuse. The number m is what later ciphers protect.",
        tier3:
          "char_to_message maps a letter to its alphabet index plus one.",
      },
      sendLabel: "Send plaintext",
    },
    3: {
      headline: "Threat model: passive eavesdropper",
      subhead: "The channel is public; confidentiality is zero.",
      blackboard: {
        tier1: "Hacker sees every bit of the payload on the tap.",
        tier2:
          "If the eavesdropper always sees the message, learning the ciphertext leaks everything about m.",
        tier3:
          "Perfect secrecy would need that seeing the wire tells you nothing new about the message. Plaintext fails that test immediately.",
      },
      sendLabel: "Send plaintext",
    },
  },
  2: {
    1: {
      headline: "Caesar shift by k",
      subhead: "Encrypt with shift=1 (configurable). Hacker tries all 25 shifts.",
      blackboard: {
        tier1: "Add k to the letter position, wrap at 26.",
        tier2: "c = (m + k) \\bmod 26",
        tier3:
          "Encryption: c \\equiv m + k \\pmod{26}.\\; Key space |K| = 25.",
      },
      sendLabel: "Send encrypted",
      hint: "Watch the Hacker terminal brute-force k, then Brayan still receives the letter.",
    },
    2: {
      headline: "Brute force in milliseconds",
      subhead: "Only 25 non-identity keys — classical search is trivial.",
      blackboard: {
        tier1: "Try shift 1, 2, 3 … until plaintext appears.",
        tier2: "m' = (c - k) \\bmod 26,\\quad k \\in \\{1,\\ldots,25\\}",
        tier3:
          "Worst-case 25 decryptions. Complexity O(|K|) — fine for Caesar, catastrophic scale for RSA.",
      },
      sendLabel: "Send encrypted",
    },
    3: {
      headline: "Timing the classical attack",
      subhead: "Wall-clock ms for 25 trials — compare to Act 4.",
      blackboard: {
        tier1: "Elapsed time shown after crack completes.",
        tier2: "T_{\\text{crack}} \\approx 25 \\cdot T_{\\text{decrypt}}",
        tier3:
          "Caesar: exponential in key length? No — linear in |K|. RSA: |K| \\approx 2^{2048}.",
      },
      sendLabel: "Send encrypted",
    },
  },
  3: {
    1: {
      headline: "Toy RSA with N = 15 or 21",
      subhead: "Generate keys, encrypt m, factor N instantly on toy modulus.",
      blackboard: {
        tier1:
          "Brayan makes keys. Ale encrypts with (e, N). Brayan decrypts with d.",
        tier2:
          "Open Math: live c = m^e mod N and m = c^d mod N with numbers filled in.",
        tier3:
          "Hacker has (e, N) and c — without d (or factors of N) plaintext stays hidden.",
      },
      sendLabel: "Encrypt & send",
      hint: "First Brayan publishes PK (Hacker copies it). Then Ale encrypts; Hacker gets PK + c only.",
    },
    2: {
      headline: "Modular exponentiation trace",
      subhead: "Square-and-multiply steps for tier 2+.",
      blackboard: {
        tier1: "Raise m to power e, reduce mod N each step.",
        tier2: "Math drawer shows the substituted encrypt and decrypt lines.",
        tier3:
          "Binary exponentiation is what the terminal traces while Ale encrypts.",
      },
      sendLabel: "Encrypt & send",
    },
    3: {
      headline: "Toy crack vs RSA-2048 projection",
      subhead: "Trial division is instant for N=15; GNFS years for 2048-bit RSA.",
      blackboard: {
        tier1: "Factor toy N now. Counter shows projected years for RSA-2048.",
        tier2: "N = pq and φ(N) appear in the keygen section of Math.",
        tier3:
          "At scale, factoring N is what protects d — Shor attacks that hardness.",
      },
      sendLabel: "Encrypt & send",
    },
  },
  4: {
    1: {
      headline: "Shor's period-finding pipeline",
      subhead: "Run QWARD Shor on AerSimulator, or load a cached IBM batch.",
      blackboard: {
        tier1: "Find period r of a^x mod N. Period reveals factors.",
        tier2: "a^{r} \\equiv 1 \\pmod{N} \\;\\Rightarrow\\; \\gcd(a^{r/2}\\pm 1, N)",
        tier3:
          "QFT on control register estimates phase s/r. Continued fractions recover r.",
      },
      sendLabel: "Run Shor on AerSimulator",
      hint: "Aer builds the real Shor circuit; classical post-process extracts factors.",
    },
    2: {
      headline: "Step plan & measurement histogram",
      subhead: "Identity slots skipped; quantum slots need circuits.",
      blackboard: {
        tier1: "Precheck → QWARD Shor (Aer/IBM) → continued fractions.",
        tier2: "P(s/r) \\text{ peaks when } s/r \\text{ is close to j/r}",
        tier3:
          "\\text{Phase estimation: } |s\\rangle \\mapsto e^{2\\pi i s/r}|s\\rangle.\\; \\text{Measure } s.",
      },
      sendLabel: "Run Shor on AerSimulator",
    },
    3: {
      headline: "Complexity crossover",
      subhead: "Classical brute-force order is a baseline; Aer/IBM do the quantum period finding.",
      blackboard: {
        tier1: "Classical order: exponential. Shor: polynomial in log N.",
        tier2: "T_{\\text{classical}} \\sim O\\big(\\sqrt{N}\\big),\\; T_{\\text{Shor}} \\sim O\\big((\\log N)^{3}\\big)",
        tier3:
          "Aer validates the ideal distribution; IBM batches show hardware noise on the same QWARD circuit.",
      },
      sendLabel: "Run Shor on AerSimulator",
    },
  },
};

export function getLevelCopy(act: ActNumber, tier: Tier): LevelCopy {
  return LEVELS[act][tier];
}
