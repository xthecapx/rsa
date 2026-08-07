import { defineAct } from "../defineAct";

/**
 * Act 4 - Shor. Same street, same van. The twist is that the hacker cannot own
 * the machine he needs, so the attack becomes a network problem: rent time on
 * a real QPU and drive it from the passenger seat.
 */
export const act4 = defineAct({
  act: 4,
  title: "Shor",
  subtitle: "You do not own the machine you need",
  brief:
    "Factoring protects Brayan's toy RSA private key. Connect to a hosted quantum processor and learn how Shor turns period finding into factors.",

  entry: "van",
  caught: "caught",
  opensAt: "van",
  objective: "Get back in the van. The rest of this happens over the network.",

  nodes: {
    van: {
      onEnter: [
        { kind: "walkTo", target: "van" },
        { kind: "panel", open: "terminal" },
        // The tap has been running since Act 3, so the run starts with a live
        // public key and a captured ciphertext already on the laptop.
        { kind: "api", call: "rsaKeygen", label: "Replaying yesterday's capture" },
        { kind: "api", call: "rsaEncrypt", label: "Replaying yesterday's capture" },
        {
          kind: "terminal",
          text: "Restored from the tap log: public key (e, N) and one intercepted ciphertext.",
        },
      ],
      lines: [
        {
          speaker: "hacker",
          text: "There is no useful quantum computer in this bag. Machines like that live in laboratories, not parked vans.",
        },
        {
          speaker: "system",
          text: "A superconducting processor lives in a dilution refrigerator at about fifteen millikelvin. It does not fit in a van and it does not run on a car battery.",
        },
        {
          speaker: "hacker",
          text: "So I will use it the way researchers use most quantum hardware today: submit a job to a hosted system over the network.",
        },
      ],
      next: "uplink",
    },

    uplink: {
      lines: [
        {
          speaker: "system",
          text: "The laptop still has the captured public key and ciphertext. It now needs a network route to a quantum service.",
        },
        { speaker: "hacker", text: "How am I getting to a QPU from a parked van?" },
      ],
      choices: [
        {
          label: "Open a session to a hosted quantum backend and submit the circuit remotely.",
          outcome: "advance",
          next: "configure",
          effects: [{ kind: "flag", set: "uplink" }],
        },
        {
          label: "Buy one and have it delivered here.",
          outcome: "retry",
          feedback:
            "A useful quantum processor is specialized laboratory equipment, not a consumer device. Hosted systems accept remote jobs and usually place them in a queue.",
        },
        {
          label: "Log in with the university account I found in a paper's supplementary material.",
          outcome: "suspicion",
          suspicion: 40,
          feedback:
            "Every submitted job is stamped with the account that sent it, and every one of these platforms keeps that record. Using someone else's credentials means your circuit arrives with a name attached to it.",
        },
      ],
    },

    configure: {
      onEnter: [{ kind: "panel", open: "uplink" }],
      waitsFor: "uplink",
      lines: [
        {
          speaker: "hacker",
          text: "The uplink is open. I will give Shor's algorithm the modulus N and choose a base a that shares no factor with it.",
        },
        {
          speaker: "system",
          text: "The quantum subroutine looks for the period r in the repeating sequence a^x mod N. When r satisfies the needed conditions, classical gcd calculations using a^(r/2) - 1 and a^(r/2) + 1 can reveal factors of N.",
        },
        {
          speaker: "system",
          text: "Use the uplink panel: run the precheck, then either the local simulator or a real QPU batch.",
        },
      ],
    },

    recovered: {
      onEnter: [{ kind: "api", call: "deriveKey" }],
      lines: [
        {
          speaker: "system",
          text: "{qpuName} returned the useful period r = {order}. The classical follow-up then split N = {modulus} into {factors}.",
        },
        {
          speaker: "hacker",
          text: 'From there, the RSA steps are the same as before: compute phi(N), find the modular inverse of e, recover d = {d}, and decrypt Ale\'s letter as "{recovered}".',
        },
        { speaker: "brayan", text: "Nothing on this line has changed. Everything still looks normal." },
        {
          speaker: "hacker",
          text: "Nothing on their line changed. I attacked the mathematics behind the captured ciphertext, so passive monitoring would not reveal it.",
        },
      ],
      next: "reflect",
    },

    reflect: {
      lines: [
        {
          speaker: "system",
          text: "For RSA-2048, the game's classical estimate is about {projectedYears} years. The best known classical factoring algorithms are sub-exponential but still impractical at that size; Shor's idealized running time grows polynomially with the key length.",
        },
        { speaker: "hacker", text: "So what actually saves Ale and Brayan?" },
      ],
      choices: [
        {
          label: "Migrate to post-quantum cryptography that does not rely on factoring or discrete logarithms.",
          outcome: "advance",
          next: "win",
        },
        {
          label: "A longer RSA key. Go to 4096 bits, or 8192.",
          outcome: "retry",
          feedback:
            "A larger RSA key raises the quantum resources required, but it does not remove Shor's polynomial-time attack. It may buy time; it is not a post-quantum solution.",
        },
        {
          label: "Nothing. Every message ever recorded is already lost.",
          outcome: "retry",
          feedback:
            "Recorded ciphertext is a real concern—often called harvest now, decrypt later. But today's quantum computers cannot factor a properly generated RSA-2048 modulus, and systems can migrate to post-quantum cryptography.",
        },
      ],
    },

    win: {
      onEnter: [
        { kind: "tapGlow", on: false },
        { kind: "bubble", actor: "hacker", face: "success" },
        { kind: "panel", open: "terminal" },
      ],
      lines: [
        {
          speaker: "hacker",
          text: "Four acts: readable plaintext, a tiny shift cipher, public-key encryption, and finally the factoring assumption behind RSA.",
        },
        {
          speaker: "system",
          text: "The lesson is not that encryption always fails. Plaintext offered no protection, Caesar offered too little, RSA resists classical factoring at real key sizes, and sufficiently capable quantum hardware would change that calculation. Post-quantum cryptography is designed for that future threat.",
        },
      ],
      ending: "win",
    },

    caught: {
      onEnter: [
        { kind: "tapGlow", on: false },
        { kind: "bubble", actor: "ale", face: "alert" },
        { kind: "bubble", actor: "brayan", face: "alert" },
      ],
      lines: [
        {
          speaker: "system",
          text: "A job lands in the queue under a name that is not yours, on a backend that logs everything.",
        },
        { speaker: "brayan", text: "Someone has been sitting on our line for a week. I have the cabinet on camera." },
        {
          speaker: "system",
          text: "The quantum part worked perfectly. The operational security did not.",
        },
      ],
      ending: "caught",
    },
  },
});
