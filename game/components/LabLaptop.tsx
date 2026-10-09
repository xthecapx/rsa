"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLab } from "@/game/lab";
import { useMedals } from "@/game/medals";
import { LAB_ITEMS, itemAvailable } from "@/content/lab";
import { type LabRecipe } from "@/game/labCircuit";
import {
  copyRecipe,
  labEquipment,
  operationLabel as label,
} from "@/game/labEditor";
import { useAsyncOperation } from "./useAsyncOperation";
import { useLabEditor } from "./useLabEditor";
import { LabCircuitEditor } from "./LabCircuitEditor";
import { LabStateExplorer } from "./LabStateExplorer";
import { LabRecipes, SavedLabRecipes } from "./LabRecipes";
import { runLab, type LabResult } from "@/lib/lab";
import { runtimeInfo } from "@/lib/transport";
import { postJson, experimentError } from "@/lib/request";
import { useSimulator } from "@/game/simulator";
import { useGame } from "@/game/state";
import { t, useLocale } from "@/i18n";
import { LaptopShell } from "./LaptopShell";
import { CircuitHistogram } from "./CircuitHistogram";
interface Experiment {
  recipe: LabRecipe;
  result: LabResult;
  date: string;
}
export function LabLaptop({
  open,
  onClose,
  onBusyChange,
  controls,
}: {
  open: boolean;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  controls: ReactNode;
}) {
  useLocale((s) => s.locale);
  const lab = useLab(),
    recipe = lab.recipe,
    earned = useMedals((s) => s.earned),
    preference = useSimulator((s) => s.choice);
  const operation = useAsyncOperation(onBusyChange);
  const { busy } = operation;
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<Experiment | null>(null),
    [previous, setPrevious] = useState<Experiment | null>(null),
    [step, setStep] = useState<number | null>(null);
  const [notice, setNotice] = useState(""),
    [crypto, setCrypto] = useState<string | null>(null),
    [period, setPeriod] = useState<Record<string, unknown> | null>(null);
  const results = useRef<HTMLElement>(null);
  const periodResults = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error)
      feedback.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
  }, [error]);
  useEffect(() => {
    if (latest || period)
      (period ? periodResults.current : results.current)?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [latest, period]);
  const { installed, allowed, available, multipleQubits, canRun } =
    labEquipment(lab.installed, earned);
  const unlocked = canRun(recipe);
  const selectedBackend =
    runtimeInfo.target === "qollab"
      ? runtimeInfo.backend
      : preference === "noise"
        ? "Aer teaching noise"
        : "AerSimulator";
  const same =
    !!latest &&
    JSON.stringify(latest.recipe) === JSON.stringify(recipe) &&
    latest.result.backend === selectedBackend;
  const editor = useLabEditor({
    recipe,
    allowed,
    running: operation.running,
    onChange(next) {
      useLab.setState({ recipe: copyRecipe(next) });
      setError("");
      setStep(null);
      setPeriod(null);
    },
  });
  const { update, resetInteraction } = editor;
  function execute(kind: "circuit" | "period" | "crypto" = "circuit") {
    const snapshot = copyRecipe(recipe);
    return operation.run(
      async () => {
        if (kind === "crypto")
          return {
            kind,
            data: await postJson(
              "/api/rsa/keygen",
              { N: 15 },
              { error: experimentError },
            ),
          } as const;
        if (kind === "period")
          return {
            kind,
            data: await postJson<Record<string, unknown>>(
              "/api/shor/simulate",
              { N: 15, a: 7, num_control: 4, shots: snapshot.shots },
              { error: experimentError },
            ),
          } as const;
        return { kind, data: await runLab(snapshot) } as const;
      },
      {
        start() {
          resetInteraction();
          useGame.getState().changeOperations(1);
          setError("");
        },
        success(result) {
          if (result.kind === "crypto")
            setCrypto(JSON.stringify(result.data, null, 2));
          else if (result.kind === "period") setPeriod(result.data);
          else {
            setPrevious(latest);
            setLatest({
              recipe: snapshot,
              result: result.data,
              date: new Date().toLocaleTimeString(),
            });
            setPeriod(null);
          }
        },
        error(cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The experiment could not finish. Check the backend and try again.",
          );
        },
        settled() {
          useGame.getState().changeOperations(-1);
        },
      },
    );
  }
  return (
    <LaptopShell
      open={open}
      title="Quantum laboratory"
      onClose={() => {
        resetInteraction();
        onClose();
      }}
      closeDisabled={busy}
      restartControl={controls}
      selectedBackend
      footer={
        <p>
          {t(
            "Explore, change a component, and run again. Recipes are saved; no experiment runs automatically.",
          )}
        </p>
      }
    >
      <div className="lab-experiment space-y-4">
        {busy && (
          <p role="status" className="text-accent-teal">
            {t("Waiting for backend measurements…")}
          </p>
        )}
        {error && (
          <p ref={feedback} role="alert" className="text-accent-amber">
            {t(error)}
          </p>
        )}
        {runtimeInfo.remoteFinalOnly && (
          <p className="panel p-3 text-accent-amber text-sm">
            {t(
              "This lab uses your selected remote backend. Run consumes the one job available for this game session. Keep your checkpoint code and export your lab before restarting for another run or final challenge.",
            )}
          </p>
        )}
        <fieldset disabled={busy} className="min-w-0 space-y-3">
          <LabCircuitEditor
            recipe={recipe}
            editor={editor}
            available={available}
            multipleQubits={multipleQubits}
            unlocked={unlocked}
            busy={busy}
            onRun={() => void execute()}
          />
          <LabRecipes recipe={recipe} installed={installed} update={update} />
          <LabStateExplorer
            recipe={recipe}
            step={step}
            setStep={setStep}
            showBloch={
              lab.owned.includes("bloch") &&
              itemAvailable(LAB_ITEMS.find((i) => i.id === "bloch")!, earned)
            }
          />
          <SavedLabRecipes
            recipe={recipe}
            recipes={lab.recipes}
            update={update}
            onSaved={setNotice}
          />
          {installed("crypto") && (
            <button
              className="btn-ghost"
              onClick={() => void execute("crypto")}
            >
              {t("Explore RSA keys (N=15, classical)")}
            </button>
          )}
          {installed("period") && (
            <section className="panel p-3 space-y-2">
              <h3>{t("Period explorer · N=15, a=7")}</h3>
              <p className="text-sm">
                {t(
                  "Prepare control qubits → controlled modular multiplication → inverse QFT → measure. This runs a separate Shor circuit, not the circuit editor above.",
                )}
              </p>
              <button
                className="btn-primary"
                onClick={() => void execute("period")}
              >
                {t("Run period experiment")}
              </button>
            </section>
          )}
        </fieldset>
        {notice && <p role="status">{notice}</p>}
        {latest && (
          <section ref={results} className="space-y-2">
            <h3>
              {t(
                same
                  ? "Current circuit results"
                  : "Previous run — the circuit or selected backend has changed",
              )}
            </h3>
            <p className="text-xs text-stage-muted">
              {latest.date} · {latest.recipe.start} ·{" "}
              {latest.recipe.operations.map(label).join(" → ") || "M"}
            </p>
            <CircuitHistogram {...latest.result} />
            <details>
              <summary>{t("Executed circuit")}</summary>
              <pre className="overflow-auto text-xs">
                {latest.result.circuit_text}
              </pre>
            </details>
          </section>
        )}
        {previous && (
          <details>
            <summary>{t("Compare with previous run")}</summary>
            <p>
              {previous.result.backend} ·{" "}
              {previous.recipe.operations.map(label).join(" → ")}
            </p>
            <CircuitHistogram {...previous.result} />
          </details>
        )}
        {crypto && (
          <pre className="panel p-3 overflow-auto text-sm">{crypto}</pre>
        )}
        {period && (
          <section ref={periodResults} className="space-y-2">
            <h3>{t("Period experiment results")}</h3>
            <CircuitHistogram
              counts={period.counts as Record<string, number>}
              backend={period.backend as string}
              kind={period.kind as "ideal" | "noise" | "hardware"}
              source={period.source as "simulator" | "hardware"}
            />
            <pre className="panel p-3 overflow-auto text-xs">
              {JSON.stringify(period.shor_result, null, 2)}
            </pre>
            <details>
              <summary>{t("Executed circuit")}</summary>
              <pre className="overflow-auto text-xs">
                {String(period.circuit_text)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </LaptopShell>
  );
}
