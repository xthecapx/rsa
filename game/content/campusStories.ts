import type { CampusActivityId } from "./campus";

export interface CampusStoryOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}
export interface CampusInvestigation {
  id: string;
  question: string;
  keys: string[];
  prompt: string;
  options: CampusStoryOption[];
  clues: string[];
  select: string[];
}
export interface CampusStory {
  intro: string;
  prediction: string;
  predictions: { id: string; label: string }[];
  investigations: CampusInvestigation[];
  application: {
    kind: "board" | "frequency" | "rotation";
    prompt: string;
    slots: {
      id: string;
      label: string;
      options: { id: string; label: string }[];
      correct: string;
    }[];
  };
  payoff: string;
}
/** Stable IDs belong to saves. Text is translated at presentation time. */
export const CAMPUS_STORIES = {
  qubit: {
    intro:
      "The detector arrived early and the workshop is printing nonsense tickets. Help me put the experiment together before the visitors arrive!",
    prediction:
      "When we finally measure a qubit, what do you expect on one ticket?",
    predictions: [
      {
        id: "bit",
        label: "One outcome: 0 or 1",
      },
      {
        id: "state",
        label: "The whole quantum state",
      },
      {
        id: "both",
        label: "Both outcomes at once",
      },
    ],
    investigations: [
      {
        id: "assembly",
        question:
          "Can you prepare, control, and then measure? Compare the X switch with H.",
        keys: ["prepared:X", "prepared:H"],
        prompt:
          "We used two controls. Did either detector ticket contain the full state?",
        options: [
          {
            id: "classical",
            label: "No, each shot returned a classical bit",
            correct: true,
            feedback:
              "Exactly. Preparation and gates describe the experiment; measurement gives us a classical outcome.",
          },
          {
            id: "state",
            label: "The H ticket contained the entire state",
            correct: false,
            feedback:
              "H changes the state, but one measurement still gives one bit. Look at the tickets, not the ideal state picture.",
          },
        ],
        clues: [
          "What must exist before a detector can measure it?",
          "Preparation comes first, control changes the state, and measurement returns the ticket.",
          "Arrange Prepare → Control → Measure. Run once with X and once with H.",
        ],
        select: [],
      },
    ],
    application: {
      kind: "board",
      prompt:
        "Label the workshop drawers. Which holds the state description, and which holds a detector ticket?",
      slots: [
        {
          id: "description",
          label: "State description",
          options: [
            {
              id: "ket",
              label: "|ψ⟩",
            },
            {
              id: "bit",
              label: "A measured 0 or 1",
            },
          ],
          correct: "ket",
        },
        {
          id: "output",
          label: "Detector output",
          options: [
            {
              id: "ket",
              label: "|ψ⟩",
            },
            {
              id: "bit",
              label: "A measured 0 or 1",
            },
          ],
          correct: "bit",
        },
      ],
    },
    payoff:
      "The workshop is ready: prepare a fresh system, change its state, then collect a classical ticket. A simulator models that process; a physical QPU performs it on hardware.",
  },
  passports: {
    intro:
      "This traveler has a picture, a ket, and a column vector under three different names. Can you help me make one consistent passport?",
    prediction:
      "Does a passport describe the state or predict one guaranteed detector ticket?",
    predictions: [
      {
        id: "description",
        label: "It describes the state",
      },
      {
        id: "ticket",
        label: "It guarantees the next ticket",
      },
    ],
    investigations: [
      {
        id: "passport",
        question:
          "Explore the state dial. Find a state with equal positive amplitudes and test its measurement.",
        keys: ["passport"],
        prompt:
          "The passport has equal amplitudes. Are those numbers the counts we just received?",
        options: [
          {
            id: "amplitudes",
            label: "No; squared magnitudes predict probabilities",
            correct: true,
            feedback:
              "Yes. The ket and vector describe the ideal state; the histogram records a finite set of measurements.",
          },
          {
            id: "counts",
            label: "Yes; amplitudes and counts are the same",
            correct: false,
            feedback:
              "Counts are whole numbers from the detector. Amplitudes can have signs and complex phases; their squared magnitudes give probabilities.",
          },
        ],
        clues: [
          "Read |ψ⟩ as a name for a state, not as a measurement instruction.",
          "Look for equal positive entries in the ideal column vector.",
          "Set θ = 90° and φ = 0°, then Run.",
        ],
        select: [],
      },
    ],
    application: {
      kind: "board",
      prompt:
        "Stamp three matching entries for this traveler. The measurement prediction is ideal; the returned counts stay on the evidence card.",
      slots: [
        {
          id: "ket",
          label: "Ket",
          options: [
            {
              id: "plus",
              label: "|+⟩",
            },
            {
              id: "minus",
              label: "|−⟩",
            },
            {
              id: "zero",
              label: "|0⟩",
            },
          ],
          correct: "plus",
        },
        {
          id: "vector",
          label: "Column vector",
          options: [
            {
              id: "plus",
              label: "[1/√2, 1/√2]ᵀ",
            },
            {
              id: "minus",
              label: "[1/√2, −1/√2]ᵀ",
            },
          ],
          correct: "plus",
        },
        {
          id: "picture",
          label: "Ideal Z measurement prediction",
          options: [
            {
              id: "balanced",
              label: "P(0) = P(1) = ½",
            },
            {
              id: "zero",
              label: "P(0) = 1",
            },
          ],
          correct: "balanced",
        },
      ],
    },
    payoff:
      "One traveler, one state, several representations. Its passport is corrected; amplitudes describe the state, while detector frequencies estimate probabilities.",
  },
  delivery: {
    intro:
      "My courier flipped the instruction cards. The parcel arrived, but its phase passport is wrong. Help me check the route.",
    prediction: "Would switching X and H always leave the same state?",
    predictions: [
      {
        id: "same",
        label: "Order should not matter",
      },
      {
        id: "different",
        label: "The order could change the state",
      },
    ],
    investigations: [
      {
        id: "routes",
        question:
          "Compare X → H with H → X. Look at the ideal state as well as the detector.",
        keys: ["delivery", "reversed"],
        prompt:
          "The Z histograms can look alike. What else tells us that these routes are different?",
        options: [
          {
            id: "phase",
            label: "Their ideal states have different relative phases",
            correct: true,
            feedback:
              "Right. X then H prepares |−⟩; H then X prepares |+⟩. The same Z probabilities do not imply the same state.",
          },
          {
            id: "histogram",
            label: "Similar histograms mean identical states",
            correct: false,
            feedback:
              "A Z histogram does not describe every aspect of a state. Compare the signs in the ideal amplitudes.",
          },
        ],
        clues: [
          "Read a circuit from left to right in time.",
          "Try both routes and compare the signs in their state passports.",
          "Run X → H, clear the tape, then run H → X.",
        ],
        select: [],
      },
    ],
    application: {
      kind: "board",
      prompt:
        "Give the courier a route that flips zero before applying H, then attach its matrix label.",
      slots: [
        {
          id: "first",
          label: "First instruction",
          options: [
            {
              id: "X",
              label: "X",
            },
            {
              id: "H",
              label: "H",
            },
          ],
          correct: "X",
        },
        {
          id: "second",
          label: "Second instruction",
          options: [
            {
              id: "X",
              label: "X",
            },
            {
              id: "H",
              label: "H",
            },
          ],
          correct: "H",
        },
        {
          id: "matrix",
          label: "Matrix label: rightmost acts first",
          options: [
            {
              id: "HX",
              label: "H X |0⟩",
            },
            {
              id: "XH",
              label: "X H |0⟩",
            },
          ],
          correct: "HX",
        },
      ],
    },
    payoff:
      "The parcel follows the corrected route. Circuit time goes left to right; matrix operations act on the vector from the right.",
  },
  fountain: {
    intro:
      "I changed the phase setting, but the ordinary detector still looks the same. Did I change nothing, or am I looking the wrong way?",
    prediction:
      "Will the ordinary Z detector distinguish the plus and minus settings?",
    predictions: [
      {
        id: "same",
        label: "I expect the same probabilities",
      },
      {
        id: "different",
        label: "I expect different probabilities",
      },
    ],
    investigations: [
      {
        id: "ordinary",
        question: "Compare both phase signs with the ordinary Z detector.",
        keys: ["false:false", "true:false"],
        prompt:
          "Both ideal Z predictions are balanced. Which test could reveal the phase difference?",
        options: [
          {
            id: "lens",
            label: "Use the H measurement lens",
            correct: true,
            feedback:
              "Let’s change the measurement basis. Keep both earlier samples so we can compare.",
          },
          {
            id: "more",
            label: "Collect more of the same Z samples",
            correct: false,
            feedback:
              "More Z shots estimate the same probabilities more precisely. They do not reveal this relative phase; try a different lens.",
          },
        ],
        clues: [
          "A histogram is a view through one measurement setting.",
          "Leave the H lens off and compare the two signs first.",
          "Run with the minus checkbox off, then on, without the H lens.",
        ],
        select: [],
      },
      {
        id: "lens",
        question: "Compare both signs again, now with the H lens.",
        keys: ["false:true", "true:true"],
        prompt:
          "A visitor says the minus sign was decoration. Which explanation fits our comparison?",
        options: [
          {
            id: "interference",
            label: "Relative phase changes interference",
            correct: true,
            feedback:
              "The lens converts that phase difference into different ideal measurement probabilities. Sampling and device noise can still affect the returned counts.",
          },
          {
            id: "coin",
            label: "The qubit was just a hidden classical coin",
            correct: false,
            feedback:
              "A hidden classical coin does not have these coherent phase relationships. Compare how H acts on the two ideal states.",
          },
        ],
        clues: [
          "Which lens lets amplitudes reinforce or cancel before measurement?",
          "Compare the two phase signs with H enabled.",
          "Enable the H lens. Run once for each sign.",
        ],
        select: ["false:true", "true:true"],
      },
    ],
    application: {
      kind: "board",
      prompt: "Choose the explanation to put beside the fountain.",
      slots: [
        {
          id: "sign",
          label: "Fountain sign",
          options: [
            {
              id: "phase",
              label:
                "Same probabilities in one basis can hide different phases",
            },
            {
              id: "both",
              label: "One shot shows both outcomes",
            },
          ],
          correct: "phase",
        },
      ],
    },
    payoff:
      "The fountain has its explanation back. Water illustrates interference; the actual qubit experiment and its returned measurements remain in your notebook.",
  },
  observatory: {
    intro:
      "Two visitors say their matching signals prove entanglement. I have a Bell source and matching envelopes. Help me check their claim.",
    prediction: "Does seeing only matching bits already settle the question?",
    predictions: [
      {
        id: "yes",
        label: "Matching must mean entangled",
      },
      {
        id: "test",
        label: "We need another comparison",
      },
    ],
    investigations: [
      {
        id: "models",
        question:
          "Compare independent signals, Bell pairs, and matching envelopes. Try both detector bases for the last two.",
        keys: [
          "independent:Z",
          "bell:Z",
          "bell:X",
          "envelopes:Z",
          "envelopes:X",
        ],
        prompt:
          "Select the Bell and envelope measurements in X. What can we say about these models?",
        options: [
          {
            id: "models",
            label: "Changing basis distinguishes these two ideal models",
            correct: true,
            feedback:
              "Yes. Classical envelopes can also match in Z. This comparison distinguishes the supplied models, not every possible source.",
          },
          {
            id: "distance",
            label: "Distance between detectors proves entanglement",
            correct: false,
            feedback:
              "Distance alone does not establish entanglement. Study the joint outcomes and measurement settings. Correlation cannot send a controllable faster-than-light message.",
          },
        ],
        clues: [
          "Could ordinary matching envelopes also produce 00 and 11?",
          "Compare Bell and envelopes in Z, then in X. Keep independent Z as a reference.",
          "Run independent Z, Bell Z, Bell X, envelopes Z, and envelopes X.",
        ],
        select: ["bell:X", "envelopes:X"],
      },
    ],
    application: {
      kind: "board",
      prompt: "Replace the visitors’ claim with a sign the evidence supports.",
      slots: [
        {
          id: "claim",
          label: "Observatory sign",
          options: [
            {
              id: "limited",
              label: "Matching in one basis is not proof of entanglement",
            },
            {
              id: "proof",
              label: "Matching always proves entanglement",
            },
          ],
          correct: "limited",
        },
      ],
    },
    payoff:
      "The observatory now invites visitors to compare joint outcomes and bases. Entanglement concerns the joint state, not a secret signal between detectors.",
  },
  arcade: {
    intro:
      "A visitor wants a refund: the two bars are not equal! Help me decide what the tickets actually tell us before I replace the machine.",
    prediction:
      "Must a balanced experiment return exactly half zeros in every batch?",
    predictions: [
      {
        id: "exact",
        label: "Every batch must split exactly in half",
      },
      {
        id: "vary",
        label: "Batches can fluctuate",
      },
    ],
    investigations: [
      {
        id: "tickets",
        question:
          "Collect one ticket, then a batch of at least 256 fresh preparations.",
        keys: ["single", "batch"],
        prompt:
          "Does a finite imbalance alone prove the machine is faulty or noisy?",
        options: [
          {
            id: "sampling",
            label: "No; finite-shot sampling also fluctuates",
            correct: true,
            feedback:
              "Right. More shots improve an estimate, but do not guarantee an exact split or remove systematic noise.",
          },
          {
            id: "broken",
            label: "Yes; balanced probabilities promise equal counts",
            correct: false,
            feedback:
              "A probability is not a quota. Even an ideal simulator can return uneven counts, and one batch cannot diagnose the source.",
          },
        ],
        clues: [
          "One ticket cannot show the whole distribution.",
          "Compare a single fresh preparation with a larger collection of fresh preparations.",
          "Choose 1 shot and Run. Then choose 256 or 1024 and Run.",
        ],
        select: [],
      },
    ],
    application: {
      kind: "frequency",
      prompt:
        "Help Nico label the real batch and decide what to tell the visitor.",
      slots: [
        {
          id: "advice",
          label: "Advice to the visitor",
          options: [
            {
              id: "honest",
              label:
                "Publish counts and shots; the next outcome is not promised",
            },
            {
              id: "replace",
              label: "Replace the machine because the bars differ",
            },
          ],
          correct: "honest",
        },
      ],
    },
    payoff:
      "The results board keeps the actual counts and batch size. Each ticket comes from a fresh preparation; frequencies estimate probabilities, not the next ticket.",
  },
  quiet: {
    intro:
      "The interference display fades when the room interacts with its surroundings. Should I count longer, reverse a gate, or protect the next preparation?",
    prediction: "What would you try first?",
    predictions: [
      {
        id: "shots",
        label: "Collect more shots",
      },
      {
        id: "inverse",
        label: "Undo a gate",
      },
      {
        id: "isolate",
        label: "Protect a fresh preparation",
      },
    ],
    investigations: [
      {
        id: "environment",
        question:
          "Compare no disturbance and full disturbance with the H lens, then full disturbance without it.",
        keys: ["0:true", "1:true", "1:false"],
        prompt:
          "Would counting longer restore the coherence lost to the unobserved environment?",
        options: [
          {
            id: "estimate",
            label: "No; it only improves our estimate of the changed state",
            correct: true,
            feedback:
              "Exactly. The teaching disturbance changes coherence; sampling changes our estimate. Device noise is an additional effect.",
          },
          {
            id: "restore",
            label: "Yes; enough measurements restore the old phase",
            correct: false,
            feedback:
              "Observing more freshly prepared systems does not recover information lost to an unobserved environment. Compare the ideal density matrices.",
          },
        ],
        clues: [
          "Is the problem with our estimate, or with the state we prepared?",
          "Keep the measurement lens while changing disturbance; then remove the lens at full disturbance.",
          "Run 0% with H, 100% with H, and 100% without H.",
        ],
        select: [],
      },
    ],
    application: {
      kind: "board",
      prompt:
        "Choose a repair for the next experiment. We cannot recover the previous state by installing a screen afterward.",
      slots: [
        {
          id: "repair",
          label: "Protection for future preparations",
          options: [
            {
              id: "screen",
              label: "Isolate a fresh preparation from the disturbance",
            },
            {
              id: "shots",
              label: "Increase the shot count to undo decoherence",
            },
          ],
          correct: "screen",
        },
      ],
    },
    payoff:
      "The protective screen is installed for future experiments. Decoherence, sampling variation, and readout errors are different effects.",
  },
  rotations: {
    intro:
      "My calibration arm turned away from its reference. Can you choose a rotation that brings it back before measurement?",
    prediction: "What kind of operation might undo a rotation?",
    predictions: [
      {
        id: "opposite",
        label: "The opposite angle on the same axis",
      },
      {
        id: "measure",
        label: "Another measurement",
      },
    ],
    investigations: [
      {
        id: "inverse",
        question:
          "Choose X or Y and a nontrivial angle. Compare the rotation alone with the same rotation followed by its inverse.",
        keys: ["rotation:false", "rotation:true"],
        prompt: "Why did the inverse restore the ideal starting state?",
        options: [
          {
            id: "unitary",
            label: "Unitary operations have an inverse: U†U = I",
            correct: true,
            feedback:
              "Yes. Reversing a unitary differs from recovering information lost through measurement or an unobserved environment.",
          },
          {
            id: "any",
            label: "Any second operation cancels the first",
            correct: false,
            feedback:
              "The axis and angle matter. Test the same rotation with the opposite angle; an unrelated operation need not cancel it.",
          },
        ],
        clues: [
          "Which axis did you turn around, and in which direction?",
          "Use X or Y from zero so the displacement is visible. Keep the angle unchanged when adding the inverse.",
          "Choose Y and 90°. Run without the inverse, then enable the inverse and Run.",
        ],
        select: [],
      },
    ],
    application: {
      kind: "rotation",
      prompt:
        "Set the repair dial to undo your recorded rotation. Keep its axis and turn by the opposite angle.",
      slots: [],
    },
    payoff:
      "The arm returns to its reference. The animation illustrates the ideal inverse; your returned measurements still include sampling and any backend noise.",
  },
  festival: {
    intro:
      "Three exhibits need repairs before the open day. You can help directly, even if you have not visited the other stands. Ready to hear the first visitor?",
    prediction: "How would you start checking a visitor’s claim?",
    predictions: [
      {
        id: "test",
        label: "Choose a useful experiment",
      },
      {
        id: "ask",
        label: "Ask for a clue first",
      },
    ],
    investigations: [
      {
        id: "interference",
        question:
          "A visitor thinks two H gates are two coin tosses. Test H → H from zero.",
        keys: ["repair0"],
        prompt: "Why does H → H ideally return zero?",
        options: [
          {
            id: "interference",
            label: "Interference cancels the 1 amplitude",
            correct: true,
            feedback:
              "Yes. Gates change amplitudes before measurement; there are not two measured tosses here.",
          },
          {
            id: "memory",
            label: "The qubit remembers its last measurement",
            correct: false,
            feedback:
              "There is no intermediate measurement. Inspect the ideal amplitudes after each H.",
          },
        ],
        clues: [
          "When does measurement happen in this circuit?",
          "Inspect the ideal state between the two H gates.",
          "Place H then H on the tape and Run.",
        ],
        select: [],
      },
      {
        id: "correlations",
        question:
          "A visitor calls any matching signals entangled. Use the Bell pair with both detectors in X.",
        keys: ["repair1"],
        prompt: "Does matching in one basis prove entanglement?",
        options: [
          {
            id: "models",
            label: "No; compare measurement settings and models",
            correct: true,
            feedback:
              "Exactly. Matching classical envelopes also correlate in Z; this repair invites a more careful comparison.",
          },
          {
            id: "always",
            label: "Yes, any matching pair is entangled",
            correct: false,
            feedback:
              "Classical matching envelopes are a counterexample. Ask the observatory for a deeper comparison if you like.",
          },
        ],
        clues: [
          "Could two ordinary envelopes contain the same bit?",
          "The visitor needs another measurement setting, not a stronger claim.",
          "Choose Bell pair and X for both detectors, then Run.",
        ],
        select: [],
      },
      {
        id: "protection",
        question:
          "Protect a fresh preparation: remove the teaching disturbance and test with the H lens.",
        keys: ["repair2"],
        prompt: "Can extra shots repair decoherence that has already happened?",
        options: [
          {
            id: "estimate",
            label: "No; more shots improve an estimate",
            correct: true,
            feedback:
              "Yes. Protect future preparations rather than promising to recover lost coherence by counting longer.",
          },
          {
            id: "restore",
            label: "Yes, a larger batch restores phase",
            correct: false,
            feedback:
              "A larger sample estimates the changed state. It does not undo the interaction with the environment.",
          },
        ],
        clues: [
          "What changes when we count longer: the state or our estimate?",
          "Protect the new preparation from the teaching disturbance.",
          "Choose 0% disturbance, enable the H lens, then Run.",
        ],
        select: [],
      },
    ],
    application: {
      kind: "board",
      prompt:
        "Help the visitor update the festival guide before moving to the next repair.",
      slots: [
        {
          id: "guide",
          label: "Festival guide",
          options: [
            {
              id: "evidence",
              label: "Describe the experiment and what its evidence supports",
            },
            {
              id: "promise",
              label: "Promise perfect results on every backend",
            },
          ],
          correct: "evidence",
        },
      ],
    },
    payoff:
      "The visitors have their answers and the festival is open! Your optional Quantum Explorer badge celebrates the repairs; Coin Town is always available.",
  },
} satisfies Record<CampusActivityId, CampusStory>;
