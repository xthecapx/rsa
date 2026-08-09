import { defineAct } from "../defineAct";

/**
 * Act 1 - Plaintext. Ale and Brayan agree to swap letters for numbers and
 * believe that makes the line private. It does not: an encoding is a way of
 * writing something down, not a way of hiding it.
 */
export const act1 = defineAct({
  act: 1,
  title: "Plaintext",
  subtitle: "An encoding is not a secret",
  brief:
    "Ale and Brayan hide their messages by turning letters into numbers. Install a listener and see how little that hides.",

  entry: "prologue",
  caught: "caught",
  secret: "word",

  tasks: [
    { id: "brief", label: "Hear the client out" },
    { id: "install", label: "Install the listener on the junction box" },
    { id: "decode", label: "Turn the payload back into words" },
    { id: "report", label: "Report the message to the client" },
  ],

  nodes: {
    prologue: {
      onEnter: [{ kind: "task", id: "brief", status: "active" }],
      lines: [
        {
          speaker: "ale",
          text: "Brayan. If anyone reads what we send each other, we are both finished.",
        },
        {
          speaker: "brayan",
          text: "Then we stop sending words. A is one, B is two, all the way to Z is twenty-six. We send numbers.",
        },
        { speaker: "ale", text: "Numbers. Nobody reads numbers." },
        {
          speaker: "brayan",
          text: "Nobody bothers. That is close enough. Same line as always, tonight.",
        },
      ],
      travelTo: {
        at: "car",
        objective: "Your client is waiting in a car on this street. Find it and press Space.",
        next: "briefing",
      },
    },

    briefing: {
      onEnter: [{ kind: "face", target: "car" }],
      lines: [
        {
          speaker: "boss",
          text: "You are late. Those two talk over the leased line between those buildings. I want to know what they say.",
        },
        { speaker: "hacker", text: "You want a transcript." },
        {
          speaker: "boss",
          text: "I want the words. Not numbers, not equations. Words I can repeat to someone.",
        },
        {
          speaker: "hacker",
          text: "Then I need to be on the wire before they start. There is a junction box up the street.",
        },
        {
          speaker: "boss",
          text: "One condition. If they work out somebody is listening, this never happened and neither did you.",
        },
      ],
      travelTo: {
        at: "tap",
        objective: "Walk up the street to the junction box and press Space.",
        next: "box",
      },
    },

    box: {
      onEnter: [
        { kind: "task", id: "brief", status: "done" },
        { kind: "task", id: "install", status: "active" },
      ],
      lines: [
        {
          speaker: "system",
          text: "A grey cabinet at the kerb. Behind the door, one copper pair carrying everything Ale sends to Brayan.",
        },
        { speaker: "hacker", text: "Right. How do I get in the middle of this?" },
      ],
      choices: [
        {
          label: "Clip a passive tap across the pair and listen to a copy.",
          outcome: "advance",
          next: "installed",
        },
        {
          label: "Splice into the pair so everything routes through my box first.",
          outcome: "retry",
          feedback:
            "That is a man in the middle rather than a listener, and it drops the line for a second while you cut in. You do not need to touch their traffic. You only need to hear it.",
        },
        {
          label: "Cut the line. They will reconnect and resend, louder.",
          outcome: "suspicion",
          suspicion: 40,
          feedback:
            "The line goes dead and Brayan reaches straight for his desk phone. A tap anyone notices is not a tap.",
        },
      ],
    },

    installed: {
      onEnter: [
        { kind: "tapGlow", on: true },
        { kind: "task", id: "install", status: "done" },
        { kind: "task", id: "decode", status: "active" },
        { kind: "terminal", text: "Listener live on the copper pair. Passive: nothing is delayed or altered." },
      ],
      lines: [
        {
          speaker: "hacker",
          text: "Listener is on. The message still reaches Brayan exactly as sent. I just get a copy of it.",
        },
        {
          speaker: "system",
          text: "That is passive eavesdropping. There is nothing on the line for either of them to notice.",
        },
      ],
      next: "chatter",
    },

    chatter: {
      lines: [
        { speaker: "ale", text: "Are you at your desk? I am sending it now." },
        { speaker: "brayan", text: "Go ahead. Nobody is on this cable but us." },
        { speaker: "hacker", text: "Nobody. Right." },
      ],
      next: "intercept",
    },

    intercept: {
      onEnter: [
        { kind: "packet", style: "plain", from: "ale", to: "brayan", intercept: true },
        { kind: "api", call: "plaintext" },
        { kind: "capture", payload: "{cipherText}", scheme: "raw numbers" },
      ],
      lines: [
        {
          speaker: "system",
          text: "The packet crosses the tap and carries on to Brayan, unchanged and unread by anyone who was supposed to notice.",
        },
        {
          speaker: "hacker",
          text: "There it is: {cipherText}. Not words. But not hidden either.",
        },
      ],
      next: "decode",
    },

    decode: {
      onEnter: [{ kind: "panel", open: "workbench" }],
      lines: [
        {
          speaker: "hacker",
          text: "They swapped each letter for its position in the alphabet. That is not a key. That is handwriting.",
        },
        {
          speaker: "system",
          text: "Open the laptop: pull the alphabet table off the backend, then run the payload back through it.",
        },
      ],
      waitsFor: "workbench",
      next: "toCar",
    },

    toCar: {
      onEnter: [
        { kind: "panel", open: null },
        { kind: "tapGlow", on: false },
        { kind: "task", id: "decode", status: "done" },
        { kind: "task", id: "report", status: "active" },
      ],
      lines: [
        { speaker: "hacker", text: "Got it. He wants to hear it from my mouth, not read it off a screen." },
      ],
      travelTo: {
        at: "car",
        objective: "Walk back to the car and press Space to report.",
        next: "report",
      },
    },

    report: {
      onEnter: [{ kind: "face", target: "car" }],
      lines: [
        { speaker: "boss", text: "Well? What did she say to him?" },
      ],
      waitsFor: "report",
      report: {
        wrong:
          "He looks at you the way you look at a man who is guessing. Go back over the numbers and count again.",
      },
      next: "win",
    },

    win: {
      onEnter: [
        { kind: "panel", open: null },
        { kind: "task", id: "report", status: "done" },
        { kind: "bubble", actor: "hacker", face: "success" },
      ],
      lines: [
        { speaker: "boss", text: "\"{message}\". Good. Same time tomorrow." },
        {
          speaker: "hacker",
          text: "That took no cleverness at all. They wrote it down differently and called it a secret.",
        },
        {
          speaker: "system",
          text: "Act 1 clear. An encoding is public by definition -- everyone has to agree on it for it to work. Ale is about to reach for the oldest fix there is.",
        },
      ],
      ending: "win",
    },

    caught: {
      onEnter: [
        { kind: "panel", open: null },
        { kind: "tapGlow", on: false },
        { kind: "bubble", actor: "ale", face: "alert" },
        { kind: "bubble", actor: "brayan", face: "alert" },
      ],
      lines: [
        { speaker: "brayan", text: "Ale, stop sending. Something is on this line." },
        { speaker: "ale", text: "I am calling the building engineer. Now." },
        {
          speaker: "system",
          text: "They opened the cabinet and found your listener. The car pulled away twenty seconds ago.",
        },
      ],
      ending: "caught",
    },
  },
});
