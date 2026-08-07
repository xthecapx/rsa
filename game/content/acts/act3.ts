import { defineAct } from "../defineAct";

/**
 * Act 3 - RSA. Two beats: the public key crosses the wire in the open (and
 * copying it is correct, swapping it is what gets you caught), then the
 * ciphertext arrives and the only way in is through the factors of N.
 */
export const act3 = defineAct({
  act: 3,
  title: "RSA",
  subtitle: "The key is public, the factors are not",
  brief:
    "Brayan publishes a public key and Ale encrypts with it. Everything you need is on the wire except the one number that matters.",

  entry: "van",
  caught: "caught",
  opensAt: "tap",
  objective: "Brayan is about to publish a key. Be on the tap when he does.",

  nodes: {
    van: {
      lines: [
        {
          speaker: "hacker",
          text: "New scheme. Brayan is handing out a key in public and claiming that is fine.",
        },
        {
          speaker: "hacker",
          text: "A key you are allowed to see. That either means he is careless, or the interesting part is somewhere else.",
        },
      ],
      next: "publish",
    },

    publish: {
      onEnter: [
        { kind: "walkTo", target: "tap" },
        { kind: "tapGlow", on: true },
        { kind: "panel", open: "terminal" },
        { kind: "api", call: "rsaKeygen" },
        {
          kind: "packet",
          style: "key",
          from: "brayan",
          to: "ale",
          intercept: true,
        },
      ],
      lines: [
        {
          speaker: "brayan",
          text: "Ale, here is my public key: e = {e}, N = {modulus}. Anyone can have it. Encrypt with that.",
        },
        {
          speaker: "system",
          text: "The pair (e, N) crosses the tap in the clear. The private exponent d never leaves Brayan's machine.",
        },
        { speaker: "hacker", text: "He is right that I can have it. The question is what I do with it." },
      ],
      choices: [
        {
          label: "Copy the public key and let the real one reach Ale untouched.",
          outcome: "advance",
          next: "copied",
          effects: [{ kind: "flag", set: "pkCopied" }],
        },
        {
          label: "Wait for the private key to cross so I can grab that instead.",
          outcome: "retry",
          feedback:
            "It never crosses. That is the entire point of a public key scheme: the private half is generated on Brayan's side and stays there. Nothing you can do to this wire will make it travel.",
        },
        {
          label: "Swap in my own public key so Ale encrypts to me instead.",
          outcome: "suspicion",
          suspicion: 55,
          feedback:
            'This is the textbook man in the middle, and it is also the loudest thing in this act. Brayan reads his key fingerprint aloud over the phone, Ale reads back a different one. The attack works only if nobody ever compares.',
        },
      ],
    },

    copied: {
      lines: [
        {
          speaker: "hacker",
          text: "So I hold (e = {e}, N = {modulus}). I can encrypt anything I like. I still cannot read anything.",
        },
        {
          speaker: "system",
          text: "Encryption is c = m^e mod N. Decryption is m = c^d mod N. Only d turns the operation around.",
        },
      ],
      next: "cipher",
    },

    cipher: {
      onEnter: [
        { kind: "api", call: "rsaEncrypt" },
        {
          kind: "packet",
          style: "rsa",
          from: "ale",
          to: "brayan",
          intercept: true,
        },
      ],
      lines: [
        { speaker: "ale", text: "Sent. It is a number now, not a letter." },
        {
          speaker: "system",
          text: "The tap logs c = {cipherNumber}. You have c, e and N. You are missing d.",
        },
        { speaker: "hacker", text: "One number between me and the message. How do I get it?" },
      ],
      choices: [
        {
          label: "Factor N. The two primes give me phi(N), and phi(N) gives me d.",
          outcome: "advance",
          next: "factored",
          effects: [{ kind: "api", call: "rsaCrack" }],
        },
        {
          label: "Try every value of d from 1 upward until the message reads correctly.",
          outcome: "retry",
          feedback:
            "That works for a toy modulus and collapses immediately for a real one. You are searching a space the size of N. Factoring is the shortcut, and it is the only structural weakness RSA has.",
        },
        {
          label: 'Tell Brayan the line is noisy and ask Ale to resend in plaintext.',
          outcome: "suspicion",
          suspicion: 45,
          feedback:
            'Ale answers: "Resend it how? Unencrypted? Who is this?" Downgrade attacks are real, but this one is a request from a stranger on a private line.',
        },
      ],
    },

    factored: {
      onEnter: [{ kind: "api", call: "deriveKey" }],
      lines: [
        {
          speaker: "system",
          text: "N = {modulus} came apart into {factors} by trial division, essentially instantly.",
        },
        {
          speaker: "hacker",
          text: 'With p and q I rebuilt phi(N), inverted e, and got d = {d}. The message was "{recovered}".',
        },
        { speaker: "brayan", text: "This is the strongest thing we have used all week." },
        { speaker: "hacker", text: "It is. That is what worries me about the next part." },
      ],
      next: "scale",
    },

    scale: {
      lines: [
        {
          speaker: "system",
          text: "This modulus was two digits. A real one is 2048 bits, and the same attack with the best known classical algorithm would take roughly {projectedYears} years.",
        },
        {
          speaker: "hacker",
          text: "So RSA is not safe because factoring is impossible. It is safe because factoring is slow.",
        },
        { speaker: "hacker", text: "Which means the question is what could make it fast." },
      ],
      choices: [
        {
          label: "Something that factors large numbers in a fundamentally different way.",
          outcome: "advance",
          next: "win",
        },
        {
          label: "More machines. Rent a few thousand and split the work.",
          outcome: "retry",
          feedback:
            "You are trying to divide {projectedYears} years by a number you can afford. Throwing hardware at an exponential problem moves the finish line by almost nothing.",
        },
        {
          label: "Forget the maths and take Brayan's laptop while he is at lunch.",
          outcome: "suspicion",
          suspicion: 50,
          feedback:
            "Stealing the endpoint does beat the cryptography, and it also ends your career as a man in the middle. Building security escorts you out before you reach the lift.",
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
          text: "Their whole scheme rests on one assumption: that nobody can factor quickly. I need a machine that breaks that assumption.",
        },
        {
          speaker: "system",
          text: "Act 3 clear. There is exactly one known way to do this, and it does not run on the laptop in your van.",
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
        { speaker: "brayan", text: "Ale, read me the fingerprint of the key you are using. Digit by digit." },
        { speaker: "ale", text: "It does not match yours." },
        {
          speaker: "system",
          text: "Two people who verify a key out of band will always catch a substituted one. Your session ends here.",
        },
      ],
      ending: "caught",
    },
  },
});
