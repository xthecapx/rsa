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
    "Factoring is what stands between you and Brayan's private key. Open an uplink to a real quantum processor and let period finding do the work.",

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
          text: "There is no quantum computer in this bag. There is no quantum computer in anyone's bag.",
        },
        {
          speaker: "system",
          text: "A superconducting processor lives in a dilution refrigerator at about fifteen millikelvin. It does not fit in a van and it does not run on a car battery.",
        },
        {
          speaker: "hacker",
          text: "So I do what everyone else does with hardware they cannot own. I rent it, over the network.",
        },
      ],
      next: "uplink",
    },

    uplink: {
      lines: [
        {
          speaker: "system",
          text: "The laptop still has the tap running on one interface. The other one is looking for a route out.",
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
            "You cannot. These machines are not products on a shelf; they are shared instruments with queues. Remote access is not a shortcut in this story, it is how essentially everyone uses quantum hardware.",
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
          text: "Uplink is open. Now I pick the modulus I am attacking and a base to raise to powers of it.",
        },
        {
          speaker: "system",
          text: "Shor finds the period r of a^x mod N. Once you have r, gcd(a^(r/2) +/- 1, N) hands you the factors. The quantum part is only the period.",
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
          text: "{qpuName} returned a period of r = {order}, and N = {modulus} split into {factors}.",
        },
        {
          speaker: "hacker",
          text: 'From there it is the same arithmetic as before. phi(N), invert e, d = {d}, and Ale\'s message was "{recovered}".',
        },
        { speaker: "brayan", text: "Nothing on this line has changed. Everything still looks normal." },
        {
          speaker: "hacker",
          text: "Nothing did change. That is what makes this the most dangerous version of the attack.",
        },
      ],
      next: "reflect",
    },

    reflect: {
      lines: [
        {
          speaker: "system",
          text: "The classical attack on this modulus would take about {projectedYears} years at 2048 bits. Shor's cost grows like a polynomial in the number of digits instead of exponentially.",
        },
        { speaker: "hacker", text: "So what actually saves Ale and Brayan?" },
      ],
      choices: [
        {
          label: "Cryptography whose hardness does not reduce to factoring or discrete logs.",
          outcome: "advance",
          next: "win",
        },
        {
          label: "A longer RSA key. Go to 4096 bits, or 8192.",
          outcome: "retry",
          feedback:
            "Doubling the key roughly doubles the qubits and the depth Shor needs. It is a linear cost to the attacker against a problem they have already solved in principle. It buys time, not safety.",
        },
        {
          label: "Nothing. Every message ever recorded is already lost.",
          outcome: "retry",
          feedback:
            "Recorded ciphertext really is at risk, which is why harvest-now-decrypt-later is taken seriously. But hardware this size cannot factor a 2048-bit modulus today, and post-quantum schemes are already being deployed.",
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
          text: "Four acts. Plaintext, a shift, a public key, and finally the assumption underneath all of it.",
        },
        {
          speaker: "system",
          text: "You never broke into a building and you never guessed a password. You sat between two people and waited for the mathematics to run out.",
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
