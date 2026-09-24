import type { Speaker } from "./types";

export type CoinStep = "welcome" | "classical" | "predict" | "reveal" | "qubit" | "hadamard" | "experiment" | "table" | "done";
export type RoomPlace = "table" | "desk" | "board";
interface Scene {
  title: string;
  objective: string;
  place: RoomPlace;
  lines: { speaker: Speaker; text: string }[];
}

export const COIN_STEPS: CoinStep[] = ["welcome", "classical", "predict", "reveal", "qubit", "hadamard", "experiment", "table", "done"];

export const COIN_SCENES: Record<CoinStep, Scene> = {
  welcome: {
    title: "A missing coin", place: "table", objective: "Talk to Ale and Brayan at the game table.",
    lines: [
      { speaker: "ale", text: "The board is ready. Heads, I start. Tails, Brayan starts. Has anyone got a coin?" },
      { speaker: "brayan", text: "No coins. But you brought your laptop." },
      { speaker: "hacker", text: "I can write a coin-flip function. Zero for heads, one for tails. Give me a minute at the desk." },
    ],
  },
  classical: {
    title: "Write a familiar function", place: "desk", objective: "Walk to the desk, build the function, and run five tosses.",
    lines: [
      { speaker: "ale", text: "Can you make the laptop flip our missing coin?" },
      { speaker: "hacker", text: "I have three code lines. Build the function, then we’ll try five calls." },
    ],
  },
  predict: {
    title: "Brayan is one flip ahead", place: "desk", objective: "Predict what Brayan’s copy will do before he runs it.",
    lines: [
      { speaker: "brayan", text: "I saw seed 42 in your program. I’ll start my own copy and make five calls. Predict what happens." },
    ],
  },
  reveal: {
    title: "Find the sixth value", place: "desk", objective: "Run six calls on Brayan’s copy, then predict your sixth toss.",
    lines: [
      { speaker: "brayan", text: "My five calls matched yours. Run six on my copy, then use what you see to predict your next value." },
    ],
  },
  qubit: {
    title: "Start with one qubit", place: "desk", objective: "Prepare zero and measure it. Does that make a coin?",
    lines: [
      { speaker: "ale", text: "Can we build a coin where seeing the circuit does not reveal the next bit?" },
      { speaker: "hacker", text: "Let’s experiment with one qubit in a simulator. First, prepare zero and measure it." },
    ],
  },
  hadamard: {
    title: "Give the coin two possibilities", place: "desk", objective: "Build the circuit with H and measurement, then run ten simulated tosses.",
    lines: [
      { speaker: "ale", text: "Only zeros. Can you change the circuit before we measure?" },
      { speaker: "hacker", text: "Build a new circuit on one qubit. You need both H and measurement; their order matters." },
    ],
  },
  experiment: {
    title: "Fair doesn’t mean alternating", place: "board", objective: "Compare larger batches at the whiteboard, then explain the results.",
    lines: [
      { speaker: "brayan", text: "One batch is small. What do you expect after 100 shots? Let’s compare with 1,000." },
      { speaker: "hacker", text: "The simulator uses software randomness to sample the circuit’s probabilities. We are not running quantum hardware." },
    ],
  },
  table: {
    title: "One toss. No rerolls.", place: "table", objective: "Return to the game table and use one simulated measurement.",
    lines: [
      { speaker: "ale", text: "Zero is heads: I start. One is tails: Brayan starts. We agree before the result arrives." },
      { speaker: "brayan", text: "Use the first result, even if I lose. No shopping for a better toss!" },
      { speaker: "hacker", text: "I’ll send our circuit to the simulator API with one shot and read the returned bit. This is still a simulated toss." },
    ],
  },
  done: {
    title: "Your first quantum program", place: "table", objective: "Game night can begin. Your experiment is complete.",
    lines: [
      { speaker: "ale", text: "We built the circuit, called an API, and turned a measurement into a decision. Let’s play!" },
      { speaker: "brayan", text: "On ideal quantum hardware, knowing this preparation tells me the odds, not the next bit. I could still guess correctly by chance." },
      { speaker: "hacker", text: "Today we simulated that behavior. Seeded generators are useful for replaying tests, and ordinary computers also have secure randomness tools. Different tools for different jobs." },
    ],
  },
};
