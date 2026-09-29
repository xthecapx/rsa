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
      { speaker: "guide", text: "Three wrong answers and it locks forever. Try your luck on the keypad." },
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
      { speaker: "system", text: "Unstructured search space too large for classical trial-and-error under emergency constraints. Switch to Quantum Core." },
      { speaker: "guide", text: "Three tries out of sixteen was never going to be enough. My laptop talks to the quantum core — let’s ask all sixteen at once." },
    ],
  },
  lucky: {
    title: "A lucky guess", place: "core", objective: "The core armed a backup cipher. Solve it with quantum.",
    lines: [
      { speaker: "guide", text: "You’re lucky! But luck isn’t a method." },
      { speaker: "system", text: "Backup cipher engaged. New PIN armed." },
      { speaker: "guide", text: "See? Solve it with quantum — that works every time." },
    ],
  },
  init: {
    title: "Ask every PIN at once", place: "desk", objective: "At the laptop, put the H box on the four-qubit register and run it.",
    lines: [
      { speaker: "guide", text: "Remember the fair coin? One H made one qubit heads and tails. One H box on four qubits makes all sixteen PINs at once, each at 1/16." },
    ],
  },
  loop: {
    title: "Flip, then reflect", place: "desk", objective: "Put the Oracle and the Diffuser in the repeat box and run one round.",
    lines: [
      { speaker: "guide", text: "The Oracle is sealed; it knows the PIN and flips the sign of the right answer — nothing else. You can’t see the sign by measuring." },
      { speaker: "guide", text: "The Diffuser turns that hidden flip into a taller bar: it reflects every bar about the average." },
    ],
  },
  tune: {
    title: "How many rounds?", place: "board", objective: "At the whiteboard, work out how many rounds sixteen PINs need.",
    lines: [
      { speaker: "guide", text: "Too few rounds and the bar is short. Too many and it swings past the top and falls. How many rounds for sixteen PINs?" },
    ],
  },
  tuneRun: {
    title: "Tune the repeat box", place: "desk", objective: "Change the repeat count and run the search until the tallest bar peaks.",
    lines: [
      { speaker: "guide", text: "Three rounds means three questions to the lock — the same budget you just burned by hand. Try other counts too and watch the tallest bar." },
    ],
  },
  measure: {
    title: "Collapse", place: "desk", objective: "Add the measurement to the circuit and collapse it once.",
    lines: [
      { speaker: "guide", text: "Measuring collapses all sixteen into one. Once. Make it count." },
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
