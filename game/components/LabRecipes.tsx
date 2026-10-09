"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { useLab } from "@/game/lab";
import { copyRecipe } from "@/game/labEditor";
import {
  algorithmRecipe,
  starterRecipe,
  validRecipe,
  type LabRecipe,
} from "@/game/labCircuit";
export function LabRecipes({
  recipe,
  installed,
  update,
}: {
  recipe: LabRecipe;
  installed: (id: string) => boolean;
  update: (recipe: LabRecipe, reset?: boolean) => void;
}) {
  const [bits, setBits] = useState("11"),
    [rounds, setRounds] = useState(1);
  return (
    <>
      <details className="panel p-3 lab-recipes">
        <summary>{t("Starter and algorithm recipes")}</summary>
        <div className="space-y-3 pt-3">
          <p className="text-xs text-stage-muted">
            {t(
              "Recipes are optional. Use + in the circuit toolbar to add your own components.",
            )}
          </p>
          <button
            className="btn-ghost"
            onClick={() => {
              update({ ...starterRecipe(), shots: recipe.shots }, true);
            }}
          >
            {t("Load starter experiment")}
          </button>
          {(installed("grover") || installed("kickback")) && (
            <>
              <h4>{t("Installed algorithm boxes")}</h4>
              <label>
                {t("Marked value / parity mask")}
                <input
                  className="lab-input"
                  maxLength={4}
                  value={bits}
                  onChange={(e) =>
                    setBits(e.target.value.replace(/[^01]/g, ""))
                  }
                />
              </label>
              <label>
                {t("Grover rounds")}
                <input
                  className="lab-input"
                  type="number"
                  min={0}
                  max={5}
                  value={rounds}
                  onChange={(e) =>
                    setRounds(Math.max(0, Math.min(5, Number(e.target.value))))
                  }
                />
              </label>
              <button
                className="btn-ghost w-full"
                disabled={!installed("grover") || bits.length < 1}
                onClick={() => {
                  update(
                    algorithmRecipe("grover", bits, rounds, recipe.shots),
                    true,
                  );
                }}
              >
                {t("Load Grover recipe")}
              </button>
              <button
                className="btn-ghost w-full"
                disabled={
                  !installed("kickback") || bits.length < 1 || bits.length > 3
                }
                onClick={() => {
                  update(
                    algorithmRecipe("kickback", bits, 1, recipe.shots),
                    true,
                  );
                }}
              >
                {t("Load phase-kickback recipe")}
              </button>
              <p className="text-xs text-stage-muted">
                {t(
                  "Grover uses oracle → diffuser rounds. Phase kickback prepares the helper in |−⟩, applies the parity oracle, then reads the data wires with H.",
                )}
              </p>
            </>
          )}
        </div>
      </details>
    </>
  );
}

export function SavedLabRecipes({
  recipe,
  recipes,
  update,
  onSaved,
}: {
  recipe: LabRecipe;
  recipes: { name: string; recipe: LabRecipe }[];
  update: (recipe: LabRecipe, reset?: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const valid = validRecipe(recipe);
  return (
    <div className="flex flex-wrap gap-2">
      <label>
        {t("Recipe name")}
        <input
          className="lab-input"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="btn-ghost"
        disabled={
          !name.trim() ||
          !valid ||
          (recipes.length >= 12 && !recipes.some((r) => r.name === name.trim()))
        }
        onClick={() => {
          useLab.setState({
            recipes: [
              ...recipes.filter((r) => r.name !== name.trim()),
              { name: name.trim(), recipe: copyRecipe(recipe) },
            ],
          });
          onSaved(t("Recipe saved."));
        }}
      >
        {t("Save recipe")}
      </button>
      {recipes.map((r) => (
        <button
          key={r.name}
          className="btn-ghost"
          onClick={() => {
            update(r.recipe, true);
          }}
        >
          {r.name}
        </button>
      ))}
    </div>
  );
}
