/** Async story work belongs to the mission generation that started it. */
let generation = 0;
export const missionGeneration = () => generation;
export function invalidateMission() { generation += 1; }
