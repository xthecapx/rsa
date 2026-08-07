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
    "Ale now shifts every letter by a secret amount. Capture the encrypted letter and test how much protection 25 possible keys really provide.",

  entry: "van",
  caught: "caught",
  opensAt: "tap",
  objective: "Get back to the junction box before Ale finishes typing.",

  nodes: {
    van: {
      lines: [
        {
          speaker: "hacker",
          text: "They noticed the problem. Ale spent the morning reading about ciphers, and now the letters on the wire no longer match what she types.",
        },
        { speaker: "hacker", text: "Scrambled is not necessarily secure. Let us see how many possibilities her cipher leaves me." },
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
        { speaker: "ale", text: "I am moving every letter forward by our secret shift before I send it. Same shift as always." },
        { speaker: "brayan", text: "Understood. I will move each letter back by the same amount." },
        { speaker: "hacker", text: "They agreed on the shift somewhere else, so it never crossed this wire. I will have to recover it." },
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
          text: 'Ale types "{letter}", and the tap records the encrypted letter "{cipherChar}". Brayan reverses the shift and reads it normally.',
        },
        {
          speaker: "hacker",
          text: "The cipher turns each letter into a position from 0 to 25, adds the secret shift k, and wraps around the alphabet: c = (m + k) mod 26.",
        },
        {
          speaker: "system",
          text: 'For this training example, the original letter "{letter}" is shown so you can verify each attempt. From one encrypted letter alone, every shifted letter would still be possible.',
        },
        { speaker: "hacker", text: "Even so, there are only 25 nontrivial shifts to test." },
      ],
      next: "attack",
    },

    attack: {
      lines: [
        {
          speaker: "system",
          text: "k has to be a whole number between 1 and 25. Shifting by 0 or by 26 would leave the message unchanged.",
        },
        { speaker: "hacker", text: "What is the reliable way to search such a small key space?" },
      ],
      choices: [
        {
          label: "Try all 25 shifts and compare every candidate with the expected message or its context.",
          outcome: "advance",
          next: "cracked",
          effects: [{ kind: "api", call: "caesarCrack" }],
        },
        {
          label: "Assume it is 13. Everyone uses ROT13.",
          outcome: "retry",
          feedback:
            "You might get lucky, but guessing one popular shift is not a reliable attack. Testing the whole key space guarantees that the correct shift is among the candidates.",
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
          text: 'All 25 candidates were computed in {crackMs} milliseconds. In this demo, the known original letter "{letter}" identifies the matching shift.',
        },
        {
          speaker: "hacker",
          text: 'The matching key is k = {shift}, which turns "{cipherChar}" back into "{letter}". With a longer message, readable words and context usually reveal the right candidate.',
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
          text: "Caesar has only 25 useful keys. Trying every one is so cheap that the secret shift offers almost no protection.",
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
            "A larger alphabet adds only a few more shifts. A secure key space must be so large that checking every key is computationally infeasible.",
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
          text: "They need a key space far too large to search one key at a time. That requires a modern cipher, not a single alphabet shift.",
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
