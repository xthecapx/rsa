import type { Speaker } from "./types";

export type GroverStep = "welcome" | "classical" | "overload" | "lucky" | "init" | "loop" | "tune" | "tuneRun" | "measure" | "disarm" | "done";
export type GroverPlace = "core" | "desk" | "board";
interface Scene {
  title: string;
  objective: string;
  place: GroverPlace;
  lines: { speaker: Speaker; text: string }[];
}

export const GROVER_STEPS: GroverStep[] = ["welcome", "classical", "overload", "lucky", "init", "loop", "tune", "tuneRun", "measure", "disarm", "done"];

export const GROVER_SCENES: Record<GroverStep, Scene> = {
  welcome: {
    title: "An armed drone core", place: "core", objective: "Talk to Professor Thecap at the workbench.",
    lines: [
      { speaker: "guide", text: "You came! This drone core woke up mid-repair and armed itself. Four switches, sixteen PINs. It answers only yes or no — no ‘warmer’, no ‘colder’." },
      { speaker: "guide", text: "Three wrong answers lock the keypad. Try your luck." },
    ],
  },
  classical: {
    title: "Try to open the lock", place: "core", objective: "Flip the four switches and query the lock. You have three tries.",
    lines: [
      { speaker: "system", text: "Drone core armed. 4-bit PIN. Battery: 3 queries." },
    ],
  },
  overload: {
    title: "Lockdown", place: "core", objective: "The keypad is locked. Route the problem to the laptop.",
    lines: [
      { speaker: "system", text: "Three tries are not enough to reliably find one PIN among sixteen. Switch to the quantum core." },
      { speaker: "guide", text: "Three tries gave us a chance, but no guarantee. My laptop connects to the quantum core. Let’s put all sixteen PINs in superposition and use interference to favor the right one." },
    ],
  },
  lucky: {
    title: "A lucky guess", place: "core", objective: "The core has activated a backup lock. Try Grover’s search on the laptop.",
    lines: [
      { speaker: "guide", text: "You’re lucky! But luck isn’t a method." },
      { speaker: "system", text: "Backup lock activated. New PIN set." },
      { speaker: "guide", text: "See? We need better odds than a lucky guess. Let’s try Grover’s search." },
    ],
  },
  init: {
    title: "Prepare all sixteen possibilities", place: "desk", objective: "At the laptop, put the H box on the four-qubit register and run it.",
    lines: [
      { speaker: "guide", text: "Remember the fair coin? H put one qubit in a superposition. Applying H to all four qubits prepares all sixteen PINs with equal amplitudes. Each has a 1/16 chance when measured." },
    ],
  },
  loop: {
    title: "Flip, then reflect", place: "desk", objective: "Put the Oracle and the Diffuser in the repeat box and run one round.",
    lines: [
      { speaker: "guide", text: "The Oracle is sealed; it knows the PIN and flips the sign of the right answer — nothing else. You can’t see the sign by measuring." },
      { speaker: "guide", text: "The Diffuser reflects the signed amplitudes about their average, making the marked answer’s bar taller." },
    ],
  },
  tune: {
    title: "How many rounds?", place: "board", objective: "At the whiteboard, work out how many rounds sixteen PINs need.",
    lines: [
      { speaker: "guide", text: "Too few rounds and the bar is short. Too many and it swings past the top and falls. How many rounds for sixteen PINs?" },
    ],
  },
  tuneRun: {
    title: "Tune the repeat box", place: "desk", objective: "Adjust the number of rounds and run the search until the marked answer’s probability is highest.",
    lines: [
      { speaker: "guide", text: "Three rounds means three questions to the lock — the same budget you just burned by hand. Try other counts too and watch the tallest bar." },
    ],
  },
  measure: {
    title: "Collapse", place: "desk", objective: "Add the measurement to the circuit and collapse it once.",
    lines: [
      { speaker: "guide", text: "Measuring gives us one PIN. Three rounds make the right one about 96% likely. One shot — make it count." },
    ],
  },
  disarm: {
    title: "Disarm the core", place: "core", objective: "Take the measured PIN to the drone core.",
    lines: [
      { speaker: "guide", text: "That is the PIN the quantum core picked. Put it into the keypad." },
    ],
  },
  done: {
    title: "Core disarmed", place: "core", objective: "The drone core is safe. Return to town when you’re ready.",
    lines: [
      { speaker: "guide", text: "Same three questions — 18.75% by hand, 96% with Grover. That’s the √N speed-up: a million PINs would take about 785 rounds instead of up to a million tries." },
    ],
  },
};
