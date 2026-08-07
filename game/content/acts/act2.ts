import { defineAct } from "../defineAct";

/**
 * Act 2 - Caesar. Ale finally encrypts, with a shift cipher. The lesson is
 * that twenty-five possible keys is not a key space at all: the player breaks
 * it by trying every one of them and reading the answer.
 */
export const act2 = defineAct({
  act: 2,
  title: "Caesar",
  subtitle: "Twenty five keys is not a key space",
  brief:
    "Ale now shifts every letter by a secret amount. Capture the ciphertext and find out how long twenty-five keys hold up.",

  entry: "prologue",
  caught: "caught",
  secret: "word",

  tasks: [
    { id: "brief", label: "Hear the client out" },
    { id: "install", label: "Put the listener back on the line" },
    { id: "decode", label: "Recover the shift and read the message" },
    { id: "report", label: "Report the message to the client" },
  ],

  nodes: {
    prologue: {
      onEnter: [{ kind: "task", id: "brief", status: "active" }],
      lines: [
        {
          speaker: "brayan",
          text: "Ale, the numbers were a mistake. Anyone who saw them could count on their fingers.",
        },
        {
          speaker: "ale",
          text: "So we shift them. Every letter moves forward by the same amount before I send it, and you move it back.",
        },
        { speaker: "brayan", text: "How much?" },
        {
          speaker: "ale",
          text: "I will tell you tonight, in person. It never goes near the line. That is the whole point.",
        },
      ],
      travelTo: {
        at: "car",
        objective: "The car is back. Walk over and press Space.",
        next: "briefing",
      },
    },

    briefing: {
      onEnter: [{ kind: "face", target: "car" }],
      lines: [
        {
          speaker: "boss",
          text: "They changed something. My man on the exchange says the traffic is letters now, and it is nonsense.",
        },
        { speaker: "hacker", text: "A cipher. They shift each letter by a number they agreed offline." },
        { speaker: "boss", text: "So you cannot read it." },
        {
          speaker: "hacker",
          text: "I said they agreed on a number. There are twenty-five it could be. That is not a lot of numbers.",
        },
        { speaker: "boss", text: "Then go and try all twenty-five. Quietly." },
      ],
      travelTo: {
        at: "tap",
        objective: "Get back to the junction box before Ale starts typing.",
        next: "box",
      },
    },

    box: {
      onEnter: [
        { kind: "task", id: "brief", status: "done" },
        { kind: "task", id: "install", status: "active" },
      ],
      lines: [
        { speaker: "system", text: "The cabinet is exactly as you left it. Nobody has touched the door." },
        { speaker: "hacker", text: "The shift never crosses this wire, so there is no key to steal. What do I take?" },
      ],
      choices: [
        {
          label: "Just the ciphertext. Let everything through untouched.",
          outcome: "advance",
          next: "installed",
        },
        {
          label: "Jam the line until they give up and go back to numbers.",
          outcome: "retry",
          feedback:
            "You would teach them the line is unreliable, and careful people watch an unreliable line. You would also learn nothing about the cipher.",
        },
        {
          label: "Write to Ale as Brayan and ask her to confirm the shift.",
          outcome: "suspicion",
          suspicion: 35,
          feedback:
            "\"Why are you asking? We set it in person.\" Then she calls him to check. Asking for the key is the loudest thing you can do.",
        },
      ],
    },

    installed: {
      onEnter: [
        { kind: "tapGlow", on: true },
        { kind: "task", id: "install", status: "done" },
        { kind: "task", id: "decode", status: "active" },
        { kind: "terminal", text: "Listener live. Recording ciphertext only." },
      ],
      lines: [
        {
          speaker: "hacker",
          text: "Listener is on and I am not touching their traffic. Whatever she sends, I get a copy of the scrambled version.",
        },
      ],
      next: "chatter",
    },

    chatter: {
      lines: [
        { speaker: "ale", text: "Shifted, like we said. Move each one back and it will read straight." },
        { speaker: "brayan", text: "Sending it now is fine. Nobody can do anything with it." },
      ],
      next: "intercept",
    },

    intercept: {
      onEnter: [
        { kind: "api", call: "caesarEncrypt" },
        { kind: "packet", style: "caesar", from: "ale", to: "brayan", intercept: true },
        { kind: "capture", payload: "{cipherText}", scheme: "Caesar, shift unknown" },
      ],
      lines: [
        {
          speaker: "system",
          text: "The tap records \"{cipherText}\". Brayan shifts every letter back by the agreed amount and reads it normally.",
        },
        {
          speaker: "hacker",
          text: "Each letter became a number from 0 to 25, gained the secret shift k, and wrapped round the alphabet. c = (m + k) mod 26.",
        },
      ],
      next: "decode",
    },

    decode: {
      onEnter: [{ kind: "panel", open: "workbench" }],
      lines: [
        {
          speaker: "hacker",
          text: "k is a whole number between 1 and 25. Zero and twenty-six leave the message alone, so that is the entire key space.",
        },
        {
          speaker: "system",
          text: "Ask the backend for every shift at once. Twenty-five candidates come back and exactly one of them is a word.",
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
        {
          kind: "terminal",
          text: "Secret shift was k = {shift}. Recovered without ever seeing the key.",
        },
      ],
      lines: [
        {
          speaker: "hacker",
          text: "k = {shift}. They kept that number off the wire for nothing: I never needed it, I only needed to try all of them.",
        },
      ],
      travelTo: {
        at: "car",
        objective: "Walk back to the car and press Space to report.",
        next: "report",
      },
    },

    report: {
      onEnter: [
        { kind: "face", target: "car" },
        { kind: "panel", open: "report" },
      ],
      lines: [{ speaker: "boss", text: "Twenty-five tries. Well? What does it say?" }],
      waitsFor: "report",
      report: {
        wrong:
          "\"That is not a word.\" He is right. Go back and pick the candidate that reads like English, not the one next to it.",
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
        { speaker: "boss", text: "\"{message}\". They think that cost them something." },
        {
          speaker: "hacker",
          text: "A secret key only helps if guessing it is expensive. Twenty-five guesses is not expensive.",
        },
        {
          speaker: "system",
          text: "Act 2 clear. What they need is a key space too large to walk through one key at a time. Brayan is about to suggest something with two keys instead of one.",
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
        { speaker: "ale", text: "Brayan, I never sent that. Someone else is writing on our line." },
        { speaker: "brayan", text: "Then we stop using it. Today." },
        {
          speaker: "system",
          text: "Breaking the cipher was never the hard part. Staying invisible while you did it was.",
        },
      ],
      ending: "caught",
    },
  },
});
