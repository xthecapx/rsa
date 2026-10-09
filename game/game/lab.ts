"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { saveStorage } from "./storage";
import { LAB_ITEMS, itemAvailable } from "@/content/lab";
import { useMedals } from "./medals";
import { defaultLayout, validLayout, type Placement } from "./labLayout";
import { starterRecipe, validRecipe, type LabRecipe } from "./labCircuit";
export interface LabData {
  owned: string[];
  installed: string[];
  layout: Placement[];
  recipe: LabRecipe;
  recipes: { name: string; recipe: LabRecipe }[];
}
const initial = (): LabData => ({
  owned: ["laptop", "desk", "lamp", "storage"],
  installed: [],
  layout: defaultLayout(),
  recipe: starterRecipe(),
  recipes: [],
});
export function validateLab(value: unknown): value is LabData {
  if (!value || typeof value !== "object") return false;
  const d = value as LabData;
  return (
    Array.isArray(d.owned) &&
    d.owned.length <= LAB_ITEMS.length &&
    new Set(d.owned).size === d.owned.length &&
    d.owned.every((id) => LAB_ITEMS.some((item) => item.id === id)) &&
    ["laptop", "desk", "lamp", "storage"].every((id) => d.owned.includes(id)) &&
    Array.isArray(d.installed) &&
    new Set(d.installed).size === d.installed.length &&
    d.installed.every(
      (id) =>
        d.owned.includes(id) &&
        LAB_ITEMS.some((item) => item.id === id && item.module),
    ) &&
    validLayout(d.layout) &&
    d.layout.every((p) => d.owned.includes(p.id)) &&
    validRecipe(d.recipe) &&
    Array.isArray(d.recipes) &&
    d.recipes.length <= 12 &&
    new Set(d.recipes.map((r) => r?.name)).size === d.recipes.length &&
    d.recipes.every(
      (r) =>
        r &&
        typeof r.name === "string" &&
        r.name.trim().length > 0 &&
        r.name.length <= 40 &&
        validRecipe(r.recipe),
    )
  );
}
/** Never import extra JSON keys into Zustand's methods or runtime state. */
function cleanLab(data: LabData): LabData {
  const recipe = (r: LabRecipe): LabRecipe => ({
    qubits: r.qubits,
    start: r.start,
    shots: r.shots,
    operations: r.operations.map((op) => ({
      gate: op.gate,
      ...(op.wire !== undefined ? { wire: op.wire } : {}),
      ...(op.control !== undefined ? { control: op.control } : {}),
      ...(op.angle !== undefined ? { angle: op.angle } : {}),
      ...(op.axis !== undefined ? { axis: op.axis } : {}),
      ...(op.bits !== undefined ? { bits: op.bits } : {}),
    })),
  });
  return {
    owned: [...data.owned],
    installed: [...data.installed],
    layout: data.layout.map(({ id, x, y, rotated }) => ({ id, x, y, rotated })),
    recipe: recipe(data.recipe),
    recipes: data.recipes.map((r) => ({
      name: r.name,
      recipe: recipe(r.recipe),
    })),
  };
}
export function parseLab(text: string): LabData | null {
  if (text.length > 65536) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed.version === 1 && validateLab(parsed.lab)
      ? cleanLab(parsed.lab)
      : null;
  } catch {
    return null;
  }
}
interface LabStore extends LabData {
  discovered: boolean;
  discover: () => void;
  acquire: (id: string) => boolean;
  install: (id: string) => void;
  importPlan: (text: string) => boolean;
  reset: () => void;
}
export const useLab = create<LabStore>()(
  persist(
    (set, get) => ({
      ...initial(),
      discovered: false,
      discover: () => set({ discovered: true }),
      acquire: (id) => {
        const item = LAB_ITEMS.find((i) => i.id === id);
        if (
          !item ||
          get().owned.includes(id) ||
          !itemAvailable(item, useMedals.getState().earned)
        )
          return false;
        set({ owned: [...get().owned, id] });
        return true;
      },
      install: (id) => {
        const item = LAB_ITEMS.find((i) => i.id === id);
        if (
          !item?.module ||
          !get().owned.includes(id) ||
          !itemAvailable(item, useMedals.getState().earned)
        )
          return;
        set({
          installed: get().installed.includes(id)
            ? get().installed.filter((i) => i !== id)
            : [...get().installed, id],
        });
      },
      importPlan: (text) => {
        const data = parseLab(text);
        if (!data) return false;
        set(JSON.parse(JSON.stringify(data)));
        return true;
      },
      reset: () => set({ ...initial(), discovered: false }),
    }),
    {
      name: "quantum-player-lab-v1",
      version: 1,
      skipHydration: true,
      storage: saveStorage<LabData & { discovered: boolean }>(),
      partialize: ({
        owned,
        installed,
        layout,
        recipe,
        recipes,
        discovered,
      }) => ({ owned, installed, layout, recipe, recipes, discovered }),
      merge: (saved, current) =>
        validateLab(saved)
          ? {
              ...current,
              ...cleanLab(saved as LabData),
              discovered:
                (saved as { discovered?: boolean }).discovered === true,
            }
          : current,
    },
  ),
);
export function exportLab(): string {
  const { owned, installed, layout, recipe, recipes } = useLab.getState();
  return JSON.stringify(
    { version: 1, lab: { owned, installed, layout, recipe, recipes } },
    null,
    2,
  );
}
