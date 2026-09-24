/** Scenario order is independent of the missions inside each game. */
export const SCENARIOS = [
  {
    id: "coin", number: "01", title: "Who Goes First?", difficulty: "Beginner",
    setting: "Game night · at home", href: "/scenarios/coin",
    description: "A coin app. A suspiciously good prediction. Build your first quantum circuit to settle game night.",
    lessons: "Seeds · one qubit · measurement", missions: ["coin"],
  },
  {
    id: "rsa", number: "02", title: "Breaking RSA", difficulty: "Intermediate",
    setting: "Man in the Middle · on the street", href: "/scenarios/rsa",
    description: "Tap Ale and Brayan’s messages as they move from plaintext to RSA. Use Shor’s algorithm to recover the secret.",
    lessons: "Encryption · factoring · Shor", missions: ["1", "2", "3", "4"],
  },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]["id"];
