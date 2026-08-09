import { defineAct } from "../defineAct";

/**
 * Act 4 - Shor. Same street, same junction box, same client in the same car.
 * The twist is that the hacker cannot own the machine that does the work: a
 * QPU lives in a laboratory, so the laptop reaches one over the network.
 */
export const act4 = defineAct({
  act: 4,
  title: "Shor",
  subtitle: "Borrowed hardware, different scaling",
  brief:
    "Factoring is what keeps RSA standing. Reach a real quantum backend over the network and watch period finding do the same job a different way.",

  entry: "prologue",
  caught: "caught",
  secret: "letter",

  tasks: [
    { id: "brief", label: "Hear the client out" },
    { id: "install", label: "Tap the line for the key and message" },
    { id: "uplink", label: "Open a route to a quantum backend" },
    { id: "decode", label: "Find the period and rebuild the key" },
    { id: "report", label: "Report the message to the client" },
  ],

  nodes: {
    prologue: {
      onEnter: [{ kind: "task", id: "brief", status: "active" }],
      lines: [
        {
          speaker: "brayan",
          text: "I read about what people are building. Machines that factor numbers a different way.",
        },
        { speaker: "ale", text: "Should we be worried?" },
        {
          speaker: "brayan",
          text: "Not this year. They are laboratory equipment. Nobody has one in a car on our street.",
        },
        { speaker: "ale", text: "Then send the key. Same as last night." },
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
          text: "Last time you factored their number by hand and told me how lucky I was that it was small.",
        },
        { speaker: "hacker", text: "It was small. A real one would take longer than the sun has left." },
        { speaker: "boss", text: "So make it not take that long." },
        {
          speaker: "hacker",
          text: "There is one way, and it is not a faster laptop. It is a different kind of machine, and I do not own one.",
        },
        { speaker: "boss", text: "Then borrow one. Get on the wire first." },
      ],
      travelTo: {
        at: "tap",
        objective: "Back to the junction box for the key and the message.",
        next: "box",
      },
    },

    box: {
      onEnter: [
        { kind: "task", id: "brief", status: "done" },
        { kind: "task", id: "install", status: "active" },
        { kind: "tapGlow", on: true },
        { kind: "api", call: "rsaKeygen" },
        { kind: "packet", style: "key", from: "brayan", to: "ale", intercept: true },
        { kind: "api", call: "rsaEncrypt" },
        { kind: "packet", style: "rsa", from: "ale", to: "brayan", intercept: true },
        { kind: "capture", payload: "c = {cipherNumber}", scheme: "RSA, e={e} N={modulus}" },
        { kind: "task", id: "install", status: "done" },
        {
          kind: "terminal",
          text: "Captured: public key (e = {e}, N = {modulus}) and one ciphertext c = {cipherNumber}.",
        },
      ],
      lines: [
        {
          speaker: "system",
          text: "The public key and the ciphertext both cross the tap. Everything the attack needs is now on your laptop, except the ability to factor N in reasonable time.",
        },
        {
          speaker: "hacker",
          text: "Nothing in this bag can factor that in useful time. The different machine I need is a superconducting processor in a refrigerator at fifteen millikelvin, and it is not mine.",
        },
      ],
      next: "uplink",
    },

    uplink: {
      onEnter: [{ kind: "task", id: "uplink", status: "active" }],
      lines: [
        { speaker: "hacker", text: "So how do I get to a QPU from a kerb in the middle of a street?" },
      ],
      choices: [
        {
          label: "Open a session to a hosted quantum backend and submit the circuit remotely.",
          outcome: "advance",
          next: "decode",
          effects: [{ kind: "flag", set: "uplink" }],
        },
        {
          label: "Buy one and have it delivered here.",
          outcome: "retry",
          feedback:
            "A useful quantum processor is laboratory equipment, not a consumer device. Hosted systems take remote jobs and put them in a queue, which is how nearly everyone runs one.",
        },
        {
          label: "Log in with the university account I found in a paper's supplementary material.",
          outcome: "suspicion",
          suspicion: 40,
          feedback:
            "Every submitted job is stamped with the account that sent it, and every platform keeps that record. Borrowed credentials mean your circuit arrives with somebody's name on it.",
        },
      ],
    },

    decode: {
      onEnter: [
        { kind: "task", id: "uplink", status: "done" },
        { kind: "task", id: "decode", status: "active" },
        { kind: "panel", open: "workbench" },
      ],
      lines: [
        {
          speaker: "hacker",
          text: "Uplink is open. Their machine has one strange job: find a repeating pattern. It never sees the message.",
        },
        {
          speaker: "system",
          text: "Pick a number a and multiply by it repeatedly, keeping only the remainder after division by N. Like a hand circling a clock, the remainders return to 1. The number of steps is the period r.",
        },
        {
          speaker: "hacker",
          text: "The QPU finds r. My laptop turns r into the factors, the private key and the plaintext. That is the entire division of labour.",
        },
        {
          speaker: "system",
          text: "Three settings: N is Brayan's modulus, {modulus}, so it is fixed. You choose a; if it already shares a factor with N, the precheck catches that easy win without using the QPU.",
        },
        {
          speaker: "system",
          text: "m is the counting qubits. Think of marks on a ruler: more marks give a finer reading of the period; too few can round to the wrong one.",
        },
        {
          speaker: "system",
          text: "The simulator runs your settings. A hardware batch is a saved real run, so its N, a and m are fixed.",
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
          speaker: "system",
          text: "{qpuName} returned several measurements, not one answer. The candidate that passed the check gives period r = {order}; the laptop used it to split N = {modulus} into {factors}.",
        },
        {
          speaker: "hacker",
          text: "Here is the trick. Halfway around the loop, the result squares back to 1. The numbers just below and above it share N's two hidden primes; a gcd pulls them out.",
        },
        {
          speaker: "system",
          text: "It does not work every time. An odd period or a bad halfway point means choosing another a and trying again.",
        },
        {
          speaker: "system",
          text: "Each quantum shot is a sample, not a promise, and hardware noise can make the tallest result wrong. Checking is easy: the factors must multiply back to {modulus}.",
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
      lines: [{ speaker: "boss", text: "You borrowed a machine in another country. Say the letter." }],
      waitsFor: "report",
      report: {
        wrong:
          "Wrong letter. The factors checked out, so look at what the decryption returned before you convert it back into a letter.",
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
        { speaker: "boss", text: "\"{message}\". We are finished here." },
        {
          speaker: "hacker",
          text: "For now. The machine that could run this attack at real size does not exist yet.",
        },
        {
          speaker: "system",
          text: "At tiny {modulus}, this route is slower than ordinary factoring. Shor's advantage appears as numbers grow, but nothing near a 617-digit RSA-2048 modulus has been factored this way.",
        },
        {
          speaker: "system",
          text: "Act 4 clear. Breaking that gap needs millions of noisy qubits working as thousands of reliable ones. Post-quantum cryptography is being adopted now because recorded traffic may outlive today's machines.",
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
        {
          speaker: "brayan",
          text: "Ale, there is a job on the research queue with our modulus in it. Under a name from a paper I have read.",
        },
        { speaker: "ale", text: "Then whoever it is, they are not hiding as well as they think." },
        {
          speaker: "system",
          text: "Quantum jobs are logged and attributed like any other computing job. Borrowing hardware quietly is harder than borrowing it.",
        },
      ],
      ending: "caught",
    },
  },
});
