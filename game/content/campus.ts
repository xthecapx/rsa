/** Optional foundations: stable IDs are shared by world, notebook, saves and exhibits. */
export const CAMPUS_EXHIBITS = [
  {
    id: "qubit",
    title: "The quantum workshop",
    host: "Rosa",
    sprite: "rosa",
    at: { x: 7, y: 8 },
    glyph: "01",
    brief:
      "Our detector is arriving before the qubit! Arrange preparation, control and measurement, then compare an X switch with H.",
    explain:
      "A qubit is a physical system described by a quantum state. Preparation chooses an input; a gate changes it; measurement gives a classical outcome. A simulator models these steps. A QPU performs them on hardware. Quantum computers help with particular problems, not every task.",
    math: "A qubit lives in a two-dimensional complex state space. |0⟩ = [1, 0]ᵀ and |1⟩ = [0, 1]ᵀ form the computational basis. A classical bit has one definite value; a coherent qubit can support interference.",
    question: "What does the detector return for each shot?",
    options: [
      "A classical outcome, 0 or 1",
      "The entire quantum state",
      "Both outcomes at once",
    ],
    answer: 0,
    goal: "Arrange Prepare → Control → Measure and run the experiment.",
    discovery:
      "Preparation, control and measurement do different jobs. Each shot starts with a new preparation.",
  },
  {
    id: "passports",
    title: "State passports",
    host: "Inés",
    sprite: "ines",
    at: { x: 18, y: 8 },
    glyph: "ψ",
    brief:
      "One traveler, three passports: a picture, a ket and a vector. Turn θ to 90° and φ to 0°, then identify the state.",
    explain:
      "Read |0⟩ as ket zero. |ψ⟩ names a state, not a command or a measurement. Its amplitudes α and β can be complex. Probabilities are their squared magnitudes; the dial keeps their sum equal to one.",
    math: "|ψ⟩ = α|0⟩ + β|1⟩ ↔ [α, β]ᵀ. α = cos(θ/2), β = exp(iφ) sin(θ/2), up to global phase. |α|² + |β|² = 1. Relative phase can change later interference; global phase does not change measurement predictions.",
    question: "Which passport matches θ = 90° and φ = 0°?",
    options: ["|0⟩", "|+⟩ = (|0⟩ + |1⟩)/√2", "|−⟩ = (|0⟩ − |1⟩)/√2"],
    answer: 1,
    goal: "Set θ to 90° and φ to 0°, identify |+⟩, then run.",
    discovery:
      "The picture, ket and column vector describe the same state. Amplitudes are not measurement counts.",
  },
  {
    id: "delivery",
    title: "Circuit delivery line",
    host: "Paco",
    sprite: "paco",
    at: { x: 29, y: 8 },
    glyph: "→",
    brief:
      "The courier must flip zero, then make a superposition. Place X then H on the wire. Try reversing them and inspect the ideal state.",
    explain:
      "Each wire is a qubit. Read gates from left to right in time. M measures the qubit and writes a classical bit. Empty slots do nothing. Gate order matters: X then H and H then X can produce different states.",
    math: "X then H is H X |0⟩ = |−⟩. H then X is X H |0⟩ = |+⟩. Matrix multiplication acts on the vector from the right, although circuit time runs left to right.",
    question: "Which expression describes X followed by H?",
    options: ["X H |0⟩", "H X |0⟩", "X + H"],
    answer: 1,
    goal: "Build X → H, identify its matrix order, and run.",
    discovery:
      "A circuit is an ordered recipe for an experiment. Its measurement output is classical.",
  },
  {
    id: "fountain",
    title: "Superposition fountain",
    host: "Marisol",
    sprite: "marisol",
    at: { x: 7, y: 17 },
    glyph: "≈",
    brief:
      "Two fountain settings look identical at the detector. Change the relative sign, then add the H lens to reveal the difference.",
    explain:
      "Superposition combines amplitudes, which may reinforce or cancel before probabilities are calculated. |+⟩ and |−⟩ both give balanced probabilities in the Z basis. H before measurement reads the X basis and distinguishes them. Water is an analogy for interference, not a qubit.",
    math: "|±⟩ = (|0⟩ ± |1⟩)/√2. H|+⟩ = |0⟩ and H|−⟩ = |1⟩. H H = I. A hidden classical coin does not have these coherent phase relationships.",
    question: "Can one Z-basis histogram distinguish |+⟩ from |−⟩?",
    options: [
      "Yes, the minus state returns only 1",
      "No; change the measurement basis",
      "Yes, collect enough Z-basis shots",
    ],
    answer: 1,
    goal: "Run both signs with and without the H lens, then explain the difference.",
    discovery:
      "Same probabilities in one basis do not mean the same quantum state.",
  },
  {
    id: "observatory",
    title: "Entangled observatory",
    host: "Paloma",
    sprite: "paloma",
    at: { x: 18, y: 17 },
    glyph: "∞",
    brief:
      "Compare independent signals, a Bell pair and matching classical envelopes. Change both detectors between Z and X bases.",
    explain:
      "An entangled pair has a joint state that cannot be written as two independent pure states. A Bell pair has random individual readings but structured joint results. Matching envelopes also correlate in Z, so that histogram alone is insufficient. Comparing X separates these two ideal models. This comparison is not a general certification of entanglement.",
    math: "Bell: (|00⟩ + |11⟩)/√2. Independent: |+⟩ ⊗ |+⟩. Envelopes: ½|00⟩⟨00| + ½|11⟩⟨11|. Output bits read top wire then bottom wire. Correlations cannot send a controllable message faster than light.",
    question: "Does observing only 00 and 11 prove entanglement?",
    options: [
      "Yes, matching always means entangled",
      "No; classical correlations can also match",
      "Yes, if both detectors are far apart",
    ],
    answer: 1,
    goal: "Run independent signals, Bell in Z and X, and envelopes in Z and X.",
    discovery:
      "Study joint outcomes and measurement settings. Correlation in one basis is not proof of entanglement.",
  },
  {
    id: "arcade",
    title: "Measurement arcade",
    host: "Nico",
    sprite: "nico",
    at: { x: 29, y: 17 },
    glyph: "▥",
    brief:
      "One ticket, one outcome. Run one shot, then a batch of at least 256 fresh preparations. Compare counts with the prediction.",
    explain:
      "A shot prepares, evolves and measures a fresh system. Counts record outcomes; count divided by shots estimates probability. Small batches fluctuate more. More shots improve an estimate but do not remove device noise. Balanced counts alone do not prove a physical quantum source.",
    math: "frequency(0) = count(0) / shots. Ideal H|0⟩ gives P(0) = P(1) = ½, but 256 shots need not split 128/128. Repeatedly measuring one unchanged qubit is a different experiment.",
    question:
      "Why might an ideal balanced circuit return 125 zeros and 131 ones?",
    options: [
      "The circuit must be broken",
      "Finite-shot sampling variation",
      "It proves the device has noise",
    ],
    answer: 1,
    goal: "Run 1 shot and a batch of at least 256 shots, then interpret the counts.",
    discovery:
      "A histogram shows observed counts, not a promise about the next outcome.",
  },
  {
    id: "quiet",
    title: "The quiet room",
    host: "Candela",
    sprite: "candela",
    at: { x: 7, y: 26 },
    glyph: "◌",
    brief:
      "Protect the fountain's interference. Compare H → H at disturbance 0% and 100%, then remove the final H at 100%.",
    explain:
      "Decoherence is the loss of phase coherence through interaction with an unobserved environment. We model it by coupling a helper to the qubit and ignoring the helper. Z-basis counts can stay balanced while the H lens reveals lost interference. The disturbance is an explicit teaching channel, separate from your selected backend's noise.",
    math: "E_d(ρ) = (1 − d/2)ρ + (d/2)ZρZ, 0 ≤ d ≤ 1. Off-diagonal entries shrink by 1 − d. At d = 1, |+⟩ becomes a mixture with no phase coherence. More shots or an inverse gate cannot generally restore coherence lost to an unobserved environment.",
    question: "Can more shots restore lost coherence?",
    options: [
      "Yes, enough shots undo dephasing",
      "No; they only improve the estimate",
      "Yes, apply H twice afterward",
    ],
    answer: 1,
    goal: "Compare 0% and 100% with the H lens, then 100% without it.",
    discovery:
      "Decoherence changes the state; sampling variation changes the estimate. Readout errors are another source of noise.",
  },
  {
    id: "rotations",
    title: "Reversible machine shop",
    host: "Vera",
    sprite: "vera",
    at: { x: 18, y: 26 },
    glyph: "θ",
    brief:
      "Turn a rotation, run it, then add its inverse. Compare the circuit, Bloch arrow, vector and matrix.",
    explain:
      "A gate transforms amplitudes. A unitary preserves normalization and has an inverse. Choose an axis and angle, then undo it with the opposite angle. Measurement and decoherence are different: an inverse gate does not generally recover their lost information.",
    math: "R_a(θ) = cos(θ/2)I − i sin(θ/2)σ_a. R_a(−θ)R_a(θ) = I; U†U = I. † means conjugate transpose. The displayed pure-state Bloch arrow is an ideal reference, not reconstruction from a histogram.",
    question: "What undoes RY(θ) before measurement?",
    options: ["RY(θ) for every angle", "RY(−θ)", "Measure twice"],
    answer: 1,
    goal: "Run a nonzero rotation with and without its inverse, then identify the undo operation.",
    discovery:
      "Unitary gates are reversible. Rotation axis and angle determine how amplitudes change.",
  },
] as const;
export type CampusExhibitId = (typeof CAMPUS_EXHIBITS)[number]["id"];
export type CampusActivityId = CampusExhibitId | "festival";
/** Enter from Coin Town's south road through the campus's north gate. */
export const CAMPUS_SPAWN = { x: 18, y: 2 };
export const CAMPUS_FACING = "down" as const;
export const CAMPUS_GUIDE = {
  id: "vpcap",
  title: "Campus guide",
  at: { x: 22, y: 3 },
};
export const CAMPUS_FESTIVAL = {
  id: "festival",
  title: "Open the Festival",
  at: { x: 29, y: 26 },
  stand: { x: 29, y: 27 },
};
export const CAMPUS_NOTEBOOK = {
  id: "notebook",
  title: "Campus field notebook",
  at: { x: 14, y: 3 },
  stand: { x: 14, y: 4 },
};
export const CAMPUS_WELCOME =
  "The open day starts soon, and our exhibits need a hand! Try any pavilion, ask questions, or head straight to Coin Town. The festival badge is optional. Nothing here blocks your adventure.";
export const CAMPUS_NOTEBOOK_ENTRIES = [
  {
    title: "Oracle",
    text: "An oracle is a circuit representing a problem-specific rule. Foundry Town marks a candidate's phase; Hollow Town computes a parity rule. It is not a magical free search operation.",
  },
  {
    title: "Phase kickback",
    text: "With a helper in |−⟩, a controlled flip can put the rule's answer into the input's phase. Hollow Town shows how H turns those phases into readable bits.",
  },
  {
    title: "Grover search",
    text: "Oracle and diffuser rounds use interference to amplify a marked answer. Foundry Town searches sixteen PINs. The final measurement is likely to succeed, not guaranteed.",
  },
  {
    title: "Period finding",
    text: "Shor's circuit returns samples. Classical processing proposes and checks periods, then extracts factors. Cipher Town's small RSA example is distinct from real RSA key sizes.",
  },
] as const;

export const CAMPUS_NPCS = [
  { ...CAMPUS_GUIDE, sprite: "vpcap" as const },
  ...CAMPUS_EXHIBITS.map((e) => ({
    id: e.id,
    sprite: e.sprite,
    title: e.host,
    at: e.at,
  })),
];
export const CAMPUS_PROPS = [
  { sprite: "board" as const, at: CAMPUS_NOTEBOOK.at },
  { sprite: "arcade" as const, at: CAMPUS_FESTIVAL.at },
];
