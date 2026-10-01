/** Scenario order is independent of the missions inside each game. */
export const SCENARIOS = [
  {
    id: "coin", number: "01", title: "Who Goes First?", difficulty: "Beginner",
    setting: "Game night · at home", href: "/scenarios/coin",
    description: "A coin app. A suspiciously good prediction. Build your first quantum circuit to settle game night.",
    worldEntry: { target: "coinDoor", mode: "interior" },
    lessons: "Seeds · one qubit · measurement", missions: ["coin"],
  },
  {
    id: "grover", number: "02", title: "Echo Chamber", difficulty: "Intermediate",
    setting: "Emergency · Thecap’s workshop, Foundry Town", href: "/scenarios/grover",
    description: "A drone core has armed itself. Its 4-bit PIN gives you sixteen possibilities and only three tries. Build Grover’s search to make the right PIN much more likely.",
    worldEntry: { target: "groverDoor", mode: "interior" },
    lessons: "Search · oracle · amplitude amplification", missions: ["grover"],
  },
  {
    id: "vault", number: "03", title: "Operation Ghost Key", difficulty: "Advanced",
    setting: "Haunted house · Casa Ofelia", href: "/scenarios/vault",
    description: "Doña Ofelia’s house knocks at night. Open her late husband’s 25-bit vault with three questions, and find out what the ghost really is.",
    worldEntry: { target: "vaultDoor", mode: "interior" },
    lessons: "Structure · phase kickback · Bernstein–Vazirani", missions: ["vault"],
  },
  {
    id: "rsa", number: "04", title: "Breaking RSA", difficulty: "Final",
    setting: "Man in the Middle · on the street", href: "/scenarios/rsa",
    description: "Tap Ale and Brayan’s messages as they move from plaintext to RSA. Use Shor’s algorithm to recover the secret.",
    worldEntry: { target: "car", mode: "outdoor" },
    lessons: "Encryption · factoring · Shor", missions: ["1", "2", "3", "4"],
  },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]["id"];
