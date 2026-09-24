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
    title: "Write a familiar function", place: "desk", objective: "Walk to the desk and run five practice tosses.",
    lines: [
      { speaker: "hacker", text: "I’ll start the random generator with seed 42. A seed is the starting point of a repeatable sequence." },
      { speaker: "ale", text: "One setup, then one call to flip_coin() each time. Let’s try five flips." },
    ],
  },
  predict: {
    title: "Brayan is one flip ahead", place: "desk", objective: "Let Brayan replay your seed and predict toss six.",
    lines: [
      { speaker: "brayan", text: "I saw your seed. I’ll start my own generator at 42 and make the same five calls." },
      { speaker: "ale", text: "Your five results match! Now write down the sixth before we flip ours." },
    ],
  },
  reveal: {
    title: "Prediction locked", place: "desk", objective: "Reveal your sixth toss and compare it with Brayan’s prediction.",
    lines: [
      { speaker: "brayan", text: "My prediction is locked. Your next result will be heads: zero." },
      { speaker: "hacker", text: "You know the starting point and how many calls I’ve made. Let’s check." },
    ],
  },
  qubit: {
    title: "Start with one qubit", place: "desk", objective: "Prepare zero and measure it. Does that make a coin?",
    lines: [
      { speaker: "ale", text: "Could we use a physical experiment where knowing the program doesn’t tell us the next outcome?" },
      { speaker: "hacker", text: "A quantum coin can do that. Today we’ll build and test it in a simulator on an ordinary computer. We won’t connect to hardware." },
      { speaker: "brayan", text: "So this is a rehearsal of quantum behavior. Start with a qubit in zero and see what measuring it does." },
    ],
  },
  hadamard: {
    title: "Give the coin two possibilities", place: "desk", objective: "Add the H gate, then run ten simulated tosses.",
    lines: [
      { speaker: "ale", text: "All zeros! Measurement alone didn’t make it a fair coin." },
      { speaker: "hacker", text: "The Hadamard gate, H, prepares a superposition. Measuring this state gives zero or one with equal probability in the ideal experiment." },
      { speaker: "brayan", text: "Each shot starts over: prepare zero, apply H, measure. Let’s build that." },
    ],
  },
  experiment: {
    title: "Fair doesn’t mean alternating", place: "board", objective: "Compare larger batches at the whiteboard, then explain the results.",
    lines: [
      { speaker: "ale", text: "The two counts don’t have to be exactly equal, even when both outcomes have a fifty percent chance." },
      { speaker: "brayan", text: "Let’s try more shots. A shot is one fresh run of our circuit. Bigger batches usually bring the proportions closer to half." },
      { speaker: "hacker", text: "The simulator samples these probabilities with software randomness. A fifty-fifty chart by itself can’t prove that the source is quantum." },
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
