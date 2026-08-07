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
    "Brayan shares a public key that anyone may copy, while keeping a separate private key secret. Find out why seeing the public key is not enough to decrypt Ale's message.",

  entry: "van",
  caught: "caught",
  opensAt: "tap",
  objective: "Brayan is about to publish a key. Be on the tap when he does.",

  nodes: {
    van: {
      lines: [
        {
          speaker: "hacker",
          text: "New scheme. Brayan is sharing an encryption key in public and claiming that it is safe for anyone to see.",
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
          text: "Ale, here is my public key: e = {e}, N = {modulus}. Use it to encrypt your message before you send it.",
        },
        {
          speaker: "system",
          text: "The pair (e, N) crosses the wire openly. Brayan keeps a different value, the private exponent d, on his own machine.",
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
            "It never crosses. Brayan generated both keys, shared only the public one, and kept the private one locally. Listening to this wire cannot reveal a value that was never sent.",
        },
        {
          label: "Swap in my own public key so Ale encrypts to me instead.",
          outcome: "suspicion",
          suspicion: 55,
          feedback:
            'Replacing the key is a real man-in-the-middle attack, but authenticated keys are designed to stop it. Brayan reads his key fingerprint over the phone, Ale reads back a different one, and they detect the substitution.',
        },
      ],
    },

    copied: {
      lines: [
        {
          speaker: "hacker",
          text: "Now I have (e = {e}, N = {modulus}). That lets me encrypt a message for Brayan, but it does not let me decrypt messages sent to him.",
        },
        {
          speaker: "system",
          text: "In this toy example, encryption is c = m^e mod N and decryption is m = c^d mod N. Because there are only a few possible letters, you could also encrypt every candidate and compare the results. Real RSA uses randomized padding, such as OAEP, specifically to prevent that kind of lookup.",
        },
        {
          speaker: "system",
          text: "This act therefore isolates the attack that matters for RSA at realistic message sizes: recovering the private key by factoring N.",
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
        { speaker: "ale", text: 'Sent. My letter "{letter}" is encoded and encrypted now.' },
        {
          speaker: "system",
          text: 'For the demo, "{letter}" is represented by m = {value}. RSA transforms it into the ciphertext c = {cipherNumber}. The tap reveals c, e, and N—but not d.',
        },
        { speaker: "hacker", text: "I have the ciphertext and the public key. How could I reconstruct the missing private key?" },
      ],
      choices: [
        {
          label: "Factor N. Its two primes let me compute phi(N), then recover d from e.",
          outcome: "advance",
          next: "factored",
          effects: [{ kind: "api", call: "rsaCrack" }],
        },
        {
          label: "Try every value of d from 1 upward until the message reads correctly.",
          outcome: "retry",
          feedback:
            "Brute-forcing d works only for tiny classroom values. RSA chooses d from an enormous range. For this lesson, factoring N is the useful route because the factors reveal the information needed to derive d.",
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
          text: "This classroom modulus is tiny: trial division splits N = {modulus} into {factors} almost instantly.",
        },
        {
          speaker: "hacker",
          text: 'With p and q, I computed phi(N). Then I found the modular inverse of e, giving d = {d}, and decrypted the letter "{recovered}".',
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
          text: "This modulus has only two digits. A typical RSA modulus has 2048 bits. The game's classical estimate for factoring one with current methods is about {projectedYears} years.",
        },
        {
          speaker: "hacker",
          text: "So factoring is not impossible. RSA depends on it being impractically slow at real key sizes.",
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
            "More classical machines can help, but not enough to make a properly generated RSA-2048 key practical to factor. The best known classical factoring methods still scale too poorly.",
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
          text: "The mathematical security of this RSA example rests on large-number factoring remaining slow. I need an algorithm that changes that scaling.",
        },
        {
          speaker: "system",
          text: "Act 3 clear. Shor's quantum algorithm offers that change in scaling, but the hardware it needs is not in the laptop in your van.",
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
