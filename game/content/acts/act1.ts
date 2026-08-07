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
    "Ale and Brayan share one cable and no encryption. Clip on quietly and read whatever crosses it.",

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
          text: "A grey junction cabinet. Behind the door, one pair of copper wires carrying everything Ale says to Brayan.",
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
          text: "Tap is live. I am not changing anything, I am not slowing anything down. I am simply also listening.",
        },
        {
          speaker: "system",
          text: "This is the passive eavesdropper: no interference, no trace, complete access.",
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
          text: 'It says "{letter}". No key, no cipher, no work. The letter was the payload.',
        },
        { speaker: "brayan", text: "Got it. {letter}. Perfect." },
      ],
      next: "lesson",
    },

    lesson: {
      lines: [
        {
          speaker: "system",
          text: "Every letter is a number: A is 1, Z is 26. Ale sent m = {value} with nothing wrapped around it.",
        },
        { speaker: "hacker", text: "So what exactly was protecting that message?" },
      ],
      choices: [
        {
          label: "Nothing. The message and the payload were the same thing.",
          outcome: "advance",
          next: "win",
        },
        {
          label: "The fact that only 26 letters are possible.",
          outcome: "retry",
          feedback:
            "A small message space is not secrecy. You did not have to guess between 26 options, you read the answer directly off the wire.",
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
          text: "Confidentiality on this line is exactly zero. Whatever they send, I read.",
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
