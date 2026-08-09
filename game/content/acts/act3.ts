import { defineAct } from "../defineAct";

/**
 * Act 3 - RSA. The key crosses the wire in the open and it does not help.
 * The only way in is the factors of N, which the toy modulus gives up
 * instantly -- and that is the whole argument for using a real one.
 */
export const act3 = defineAct({
  act: 3,
  title: "RSA",
  subtitle: "The key is public, the factors are not",
  brief:
    "Brayan publishes a key anyone may copy and keeps a second one secret. Capture both and find out why watching the key is not the same as holding it.",

  entry: "prologue",
  caught: "caught",
  secret: "letter",

  tasks: [
    { id: "brief", label: "Hear the client out" },
    { id: "install", label: "Be on the line before the key is published" },
    { id: "decode", label: "Factor N and rebuild the private key" },
    { id: "report", label: "Report the message to the client" },
  ],

  nodes: {
    prologue: {
      onEnter: [{ kind: "task", id: "brief", status: "active" }],
      lines: [
        {
          speaker: "brayan",
          text: "Shifting letters was never going to hold. I have generated a key pair. I am going to send you half of it, over the line.",
        },
        { speaker: "ale", text: "Over the line? Anyone watching gets it." },
        {
          speaker: "brayan",
          text: "Let them. That half only locks. The half that opens it never leaves this machine.",
        },
        {
          speaker: "ale",
          text: "One warning. It is arithmetic on numbers smaller than the key, so I can only send you one letter at a time.",
        },
      ],
      travelTo: {
        at: "car",
        objective: "Find your client's car and report before Brayan publishes.",
        next: "briefing",
      },
    },

    briefing: {
      onEnter: [{ kind: "face", target: "car" }],
      lines: [
        { speaker: "boss", text: "You are going to tell me they changed it again." },
        {
          speaker: "hacker",
          text: "They did. And this time he is sending the key down the same wire I am listening to.",
        },
        { speaker: "boss", text: "Then this is over. Take the key, open the message." },
        {
          speaker: "hacker",
          text: "It does not work like that. There are two keys. He is sending the one that locks.",
        },
        { speaker: "boss", text: "Then get me the other one. I am not paying for a shrug." },
      ],
      travelTo: {
        at: "tap",
        objective: "Be on the junction box before Brayan publishes his key.",
        next: "box",
      },
    },

    box: {
      onEnter: [
        { kind: "task", id: "brief", status: "done" },
        { kind: "task", id: "install", status: "active" },
      ],
      lines: [
        { speaker: "system", text: "Brayan's machine is about to push a key onto the line." },
        { speaker: "hacker", text: "A key I am allowed to see. So what do I do with it?" },
      ],
      choices: [
        {
          label: "Copy it and pass it through untouched.",
          outcome: "advance",
          next: "installed",
        },
        {
          label: "Hold the key back until Ale gives up and sends in the clear.",
          outcome: "retry",
          feedback:
            "Withholding traffic is tampering, and it teaches them the line is broken. You want them relaxed and talking.",
        },
        {
          label: "Swap it for my own public key so Ale encrypts to me instead.",
          outcome: "suspicion",
          suspicion: 45,
          feedback:
            "Brayan's machine cannot decrypt what Ale sends and says so, immediately. Substituting a public key is a real attack, and it is the noisiest one available to you. Copy it. Do not touch it.",
        },
      ],
    },

    installed: {
      onEnter: [
        { kind: "tapGlow", on: true },
        { kind: "api", call: "rsaKeygen" },
        { kind: "packet", style: "key", from: "brayan", to: "ale", intercept: true },
        { kind: "task", id: "install", status: "done" },
      ],
      lines: [
        {
          speaker: "brayan",
          text: "Ale, here is my public key: e = {e}, N = {modulus}. Encrypt with that before you send anything.",
        },
        {
          speaker: "system",
          text: "The pair (e, N) crosses the wire in the open. The private exponent d never leaves Brayan's machine.",
        },
        {
          speaker: "hacker",
          text: "I have the public key and it does not open anything. It is a padlock, not a key.",
        },
      ],
      next: "chatter",
    },

    chatter: {
      onEnter: [
        { kind: "api", call: "rsaEncrypt" },
        { kind: "packet", style: "rsa", from: "ale", to: "brayan", intercept: true },
        { kind: "capture", payload: "c = {cipherNumber}", scheme: "RSA, e={e} N={modulus}" },
        { kind: "task", id: "decode", status: "active" },
      ],
      lines: [
        {
          speaker: "ale",
          text: "One letter, like you said. It comes out as c = {cipherNumber}.",
        },
        {
          speaker: "system",
          text: "c = m^e mod N. Brayan raises it to his private exponent d to get m back. Nobody else can, because nobody else has d.",
        },
        {
          speaker: "hacker",
          text: "So d is the whole game. And d comes from the factors of N.",
        },
      ],
      next: "decode",
    },

    decode: {
      onEnter: [{ kind: "panel", open: "workbench" }],
      lines: [
        {
          speaker: "hacker",
          text: "N = {modulus}. Two primes multiplied together. Find them and I can rebuild d exactly the way he built it.",
        },
        {
          speaker: "system",
          text: "Factor N on the laptop, then derive d and decrypt. This modulus falls in microseconds -- which is precisely why real ones are hundreds of digits long.",
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
        {
          speaker: "hacker",
          text: "N = {factors}, so d = {d}. His private key, rebuilt from something he published on purpose.",
        },
        {
          speaker: "system",
          text: "Nothing here was a flaw in RSA. The modulus was simply small enough to factor. Scale N up and this same route runs out of time before it runs out of numbers.",
        },
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
        { speaker: "boss", text: "You got the other key. So say the letter." },
      ],
      waitsFor: "report",
      report: {
        wrong:
          "Wrong letter. Check what the decryption actually returned before you put a number back through the alphabet.",
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
        { speaker: "boss", text: "\"{message}\". One letter. That is what I paid for?" },
        {
          speaker: "hacker",
          text: "One letter is all their modulus can carry. And I only got it because that modulus was {modulus}.",
        },
        {
          speaker: "system",
          text: "Act 3 clear. Run the same attack against a 2048-bit modulus and it needs about {projectedYears} years. RSA is not broken by cleverness -- it is broken by a faster way to factor.",
        },
      ],
      ending: "win",
    },

    caught: {
      onEnter: [
        { kind: "panel", open: null },
        { kind: "tapGlow", on: false },
        { kind: "bubble", actor: "brayan", face: "alert" },
        { kind: "bubble", actor: "ale", face: "alert" },
      ],
      lines: [
        { speaker: "brayan", text: "Ale, that is not my key. Someone put their own in front of mine." },
        { speaker: "ale", text: "Then everything I sent went to them." },
        {
          speaker: "system",
          text: "Substituting a public key is the loudest attack in the book. The maths never failed. You did.",
        },
      ],
      ending: "caught",
    },
  },
});
