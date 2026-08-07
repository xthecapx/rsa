import { defineAct } from "../defineAct";

/**
 * Act 2 - Caesar. Ale finally encrypts, with a shift cipher. The lesson is
 * that a key space of 25 is not a key space at all.
 */
export const act2 = defineAct({
  act: 2,
  title: "Caesar",
  subtitle: "Twenty five keys is not a key space",
  brief:
    "Ale shifts every letter by a secret k before sending it. Find k without ever asking either of them for it.",

  entry: "van",
  caught: "caught",
  opensAt: "tap",
  objective: "Get back to the junction box before Ale finishes typing.",

  nodes: {
    van: {
      lines: [
        {
          speaker: "hacker",
          text: "They noticed. Ale spent the morning reading about ciphers and now the wire is full of nonsense.",
        },
        { speaker: "hacker", text: "Nonsense is not the same as unreadable. Let us find out which one this is." },
      ],
      next: "approach",
    },

    approach: {
      onEnter: [
        { kind: "walkTo", target: "tap" },
        { kind: "tapGlow", on: true },
        { kind: "panel", open: "terminal" },
      ],
      lines: [
        { speaker: "ale", text: "I am shifting every letter by our number before I send it. Same number as always." },
        { speaker: "brayan", text: "Understood. I will shift it back on my side." },
        { speaker: "hacker", text: "They agreed on the number somewhere I could not hear. Fine." },
      ],
      choices: [
        {
          label: "Let the traffic through untouched and keep a copy of the ciphertext.",
          outcome: "advance",
          next: "capture",
        },
        {
          label: "Jam the line until they give up and go back to plaintext.",
          outcome: "retry",
          feedback:
            "You would be teaching them that the line is unreliable, and a careful person responds to an unreliable line by watching it. Also, you would learn nothing about the cipher.",
        },
        {
          label: "Message Ale pretending to be Brayan and ask her to confirm the number.",
          outcome: "suspicion",
          suspicion: 35,
          feedback:
            'Ale replies: "Why are you asking? We set it in person." Then she calls Brayan to check. Asking for the key is the loudest thing you can possibly do.',
        },
      ],
    },

    capture: {
      onEnter: [
        { kind: "api", call: "caesarEncrypt" },
        {
          kind: "packet",
          style: "caesar",
          from: "ale",
          to: "brayan",
          intercept: true,
        },
      ],
      lines: [
        {
          speaker: "system",
          text: 'The tap logs a single character: "{cipherChar}". Brayan receives the same thing and reads it happily.',
        },
        {
          speaker: "hacker",
          text: "One letter of ciphertext and no key. Formally, c = (m + k) mod 26 and I know neither m nor k.",
        },
        { speaker: "hacker", text: "But I do know something about k." },
      ],
      next: "attack",
    },

    attack: {
      lines: [
        {
          speaker: "system",
          text: "k has to be a whole number between 1 and 25. Shifting by 0 or by 26 would leave the message unchanged.",
        },
        { speaker: "hacker", text: "So how do I get m?" },
      ],
      choices: [
        {
          label: "Try all 25 shifts and look at which one produces sense.",
          outcome: "advance",
          next: "cracked",
          effects: [{ kind: "api", call: "caesarCrack" }],
        },
        {
          label: "Assume it is 13. Everyone uses ROT13.",
          outcome: "retry",
          feedback:
            "You might get lucky, and luck is not an attack. If 13 is wrong you have learned nothing, and you have no way to tell whether you were right.",
        },
        {
          label: "Send Brayan my own ciphertext and see what he answers.",
          outcome: "suspicion",
          suspicion: 35,
          feedback:
            'Brayan decrypts your letter, gets gibberish, and writes back: "Ale, your shift is off, resend." Now two people are staring at the line.',
        },
      ],
    },

    cracked: {
      lines: [
        {
          speaker: "system",
          text: "All 25 candidates computed in {crackMs} milliseconds. Exactly one of them was a real message.",
        },
        {
          speaker: "hacker",
          text: 'k = {shift}, and the letter was "{letter}". Their secret number is now my secret number, and I never had to ask.',
        },
        { speaker: "brayan", text: "Works perfectly. This is much safer than before." },
        { speaker: "hacker", text: "It is not." },
      ],
      next: "scale",
    },

    scale: {
      lines: [
        {
          speaker: "system",
          text: "The cost of breaking Caesar is the size of its key space. Twenty five decryptions is not a defence, it is a formality.",
        },
        { speaker: "hacker", text: "So what would actually stop me here?" },
      ],
      choices: [
        {
          label: "A key space so large that trying every key is out of reach.",
          outcome: "advance",
          next: "win",
        },
        {
          label: "A longer alphabet, so there are more shifts to try.",
          outcome: "retry",
          feedback:
            "Doubling the alphabet doubles the work. You need the search to grow beyond any machine, not to get twice as annoying.",
        },
        {
          label: "Keeping the algorithm secret so nobody knows it is a Caesar shift.",
          outcome: "suspicion",
          suspicion: 20,
          feedback:
            "That is security through obscurity, and it fails the moment anyone looks at the traffic. You worked out the scheme in one glance. Assume your opponent always knows the algorithm and only lacks the key.",
        },
      ],
    },

    win: {
      onEnter: [
        { kind: "tapGlow", on: false },
        { kind: "bubble", actor: "hacker", face: "success" },
      ],
      lines: [
        {
          speaker: "hacker",
          text: "They need a key space I cannot walk through. That means real mathematics, not an agreed-upon number.",
        },
        {
          speaker: "system",
          text: "Act 2 clear. Brayan is about to suggest something with two keys instead of one.",
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
        { speaker: "ale", text: "Brayan, I never sent that. Someone else is writing on our line." },
        { speaker: "brayan", text: "Then we stop using it. Today." },
        {
          speaker: "system",
          text: "You were rumbled. Breaking the cipher was never the hard part; staying invisible while you did it was.",
        },
      ],
      ending: "caught",
    },
  },
});
