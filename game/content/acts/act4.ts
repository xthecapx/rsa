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
    { id: "install", label: "Get back on the line for the key and the message" },
    { id: "uplink", label: "Open a route to a quantum backend" },
    { id: "decode", label: "Find the period and rebuild the private key" },
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
        objective: "Your client is waiting. Walk over and press Space.",
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
          text: "There is no useful quantum computer in this bag. A superconducting processor lives in a refrigerator at fifteen millikelvin.",
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
          text: "Uplink is open. Shor's algorithm gets the modulus N and a base a that shares no factor with it.",
        },
        {
          speaker: "system",
          text: "The quantum part looks for the period r in the repeating sequence a^x mod N. Given a useful r, ordinary gcd on a^(r/2) - 1 and a^(r/2) + 1 splits N.",
        },
        {
          speaker: "system",
          text: "Run the precheck in the uplink, then the simulator or a real QPU batch, then rebuild the key.",
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
          text: "{qpuName} returned the period r = {order}, and the classical follow-up split N = {modulus} into {factors}.",
        },
        {
          speaker: "hacker",
          text: "Same private key as last time, reached a different way. What changed is not the answer, it is how the cost grows with the size of N.",
        },
        {
          speaker: "system",
          text: "Today's hardware factors numbers this small and no larger. Noise and qubit counts, not the algorithm, are what stand between this demonstration and a real key.",
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
      lines: [{ speaker: "boss", text: "You borrowed a machine in another country. Say the letter." }],
      waitsFor: "report",
      report: {
        wrong:
          "Wrong letter. The period was right; check what came back from the decryption before you convert it.",
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
          text: "For now. Their key is safe because the machine that would break it does not exist yet at that size.",
        },
        {
          speaker: "system",
          text: "Act 4 clear. That is the whole reason post-quantum cryptography is being standardised now: messages recorded today can be opened by hardware that arrives later.",
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
