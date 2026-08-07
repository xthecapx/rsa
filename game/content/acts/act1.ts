import { defineAct } from "../defineAct";

/**
 * Act 1 - Plaintext. Ale sends a letter down a bare copper pair and the hacker
 * discovers that reading it takes no cleverness at all.
 */
export const act1 = defineAct({
  act: 1,
  title: "Plaintext",
  subtitle: "No secrets on the wire",
  brief:
    "Ale sends Brayan a letter over an unencrypted cable. Tap the line and see what an eavesdropper can read.",

  entry: "van",
  caught: "caught",
  opensAt: "tap",
  objective: "Walk to the junction box in the middle of the street and press Space.",

  nodes: {
    van: {
      lines: [
        {
          speaker: "hacker",
          text: "Two buildings, one leased line between them. Ale on the left, Brayan on the right.",
        },
        {
          speaker: "hacker",
          text: "They think a private cable is the same thing as a private conversation. It is not.",
        },
        {
          speaker: "system",
          text: "Walk to the junction box in the middle of the street. (Arrow keys or WASD, Space to interact.)",
        },
      ],
      next: "approach",
    },

    approach: {
      onEnter: [
        { kind: "walkTo", target: "tap" },
        { kind: "panel", open: "terminal" },
      ],
      lines: [
        {
          speaker: "system",
          text: "A grey junction cabinet. Behind the door, a pair of copper wires carries everything Ale sends to Brayan.",
        },
        { speaker: "hacker", text: "So. How do I get in the middle of this?" },
      ],
      choices: [
        {
          label: "Clip a passive tap across the pair and just listen.",
          outcome: "advance",
          next: "tapped",
          effects: [{ kind: "tapGlow", on: true }],
        },
        {
          label: "Wait until tonight and pull the building's logs instead.",
          outcome: "retry",
          feedback:
            "There is nothing to pull. This is a bare copper pair, not a server. If you are not on the wire while they talk, you get nothing.",
        },
        {
          label: "Cut the line. They will reconnect and resend, louder.",
          outcome: "suspicion",
          suspicion: 40,
          feedback:
            "The line goes dead and Brayan immediately picks up his desk phone. Loud is the opposite of what you want. A tap that anyone notices is not a tap.",
        },
      ],
    },

    tapped: {
      lines: [
        {
          speaker: "hacker",
          text: "The tap is live. I am not changing or delaying the message. I am simply listening to a copy.",
        },
        {
          speaker: "system",
          text: "This is passive eavesdropping: the message still reaches Brayan normally, but someone else can read it on the way.",
        },
      ],
      next: "chatter",
    },

    chatter: {
      lines: [
        { speaker: "ale", text: "Brayan, are you at your desk? I am sending it now." },
        { speaker: "brayan", text: "Go ahead. Nobody else is on this cable but us." },
        { speaker: "hacker", text: "Nobody else. Right." },
      ],
      next: "intercept",
    },

    intercept: {
      onEnter: [
        {
          kind: "packet",
          style: "plain",
          from: "ale",
          to: "brayan",
          intercept: true,
        },
        { kind: "api", call: "plaintext" },
      ],
      lines: [
        {
          speaker: "system",
          text: "The packet crosses the tap and carries on to Brayan, unchanged and unaware.",
        },
        {
          speaker: "hacker",
          text: 'It says "{letter}". No key to find and no cipher to break. The message is already readable.',
        },
        { speaker: "brayan", text: "Got it. {letter}. Perfect." },
      ],
      next: "lesson",
    },

    lesson: {
      lines: [
        {
          speaker: "system",
          text: 'Ale sent the letter "{letter}". The demo labels it m = {value} because cryptographic formulas work with numbers—here A = 1 through Z = 26. That number is an encoding of the letter, not a different message.',
        },
        { speaker: "hacker", text: "Whether I display it as a letter or a number, it is still exposed. What was protecting it?" },
      ],
      choices: [
        {
          label: "Nothing. Anyone who could read the wire could read the letter.",
          outcome: "advance",
          next: "win",
        },
        {
          label: "The fact that only 26 letters are possible.",
          outcome: "retry",
          feedback:
            "A small set of possible letters is not protection. You did not have to guess: the wire revealed the letter directly.",
        },
        {
          label: "Rewrite the payload before it reaches Brayan and see what he does.",
          outcome: "suspicion",
          suspicion: 45,
          feedback:
            'Brayan writes back: "That is not what you sent me a second ago." Ale checks her sent items. Tampering is how a quiet tap turns into an investigation.',
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
          text: "This line provides no confidentiality. If I can access the wire, I can read whatever they send.",
        },
        {
          speaker: "system",
          text: "Act 1 clear. Ale is about to notice how exposed this is, and she will reach for the oldest trick there is.",
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
        { speaker: "brayan", text: "Ale, do not send anything else. Something is on this line." },
        { speaker: "ale", text: "I am calling the building engineer. Now." },
        {
          speaker: "system",
          text: "They opened the cabinet and found your tap. A man in the middle only works while nobody is looking for one.",
        },
      ],
      ending: "caught",
    },
  },
});
