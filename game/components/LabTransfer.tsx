"use client";
import { useLab, exportLab } from "@/game/lab";
import { t } from "@/i18n";
export function LabTransfer({
  busy,
  input,
  setInput,
  setMessage,
  onClose,
  onImported,
}: {
  busy: boolean;
  input: string;
  setInput: (input: string) => void;
  setMessage: (message: string) => void;
  onClose: () => void;
  onImported: () => void;
}) {
  const lab = useLab();
  return (
    <section className="panel p-3 space-y-3 lab-transfer">
      <div className="flex justify-between items-center gap-2">
        <h2>{t("Export / import lab")}</h2>
        <button
          className="btn-ghost"
          aria-label={t("Close lab transfer")}
          onClick={() => onClose()}
        >
          ×
        </button>
      </div>
      <p className="text-sm">
        {t(
          "Keep your checkpoint code for medals. This plan saves furniture, installed equipment and recipes; it submits no jobs.",
        )}
      </p>
      <textarea
        aria-label={t("Exported lab plan")}
        className="w-full bg-stage-bg p-2 font-mono text-xs"
        readOnly
        rows={4}
        value={exportLab()}
      />
      <button
        className="btn-ghost"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([exportLab()], { type: "application/json" }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "quantum-lab.json";
          a.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        {t("Download lab plan")}
      </button>
      <textarea
        aria-label={t("Import lab plan")}
        className="w-full bg-stage-bg p-2 text-base"
        rows={4}
        maxLength={65536}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <input
        aria-label={t("Choose lab plan file")}
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file && file.size <= 65536) setInput(await file.text());
          else setMessage(t("Invalid lab plan."));
        }}
      />
      <button
        className="btn-primary"
        disabled={busy}
        onClick={() => {
          setMessage(
            t(
              lab.importPlan(input)
                ? "Lab plan restored. Locked equipment stays in storage until its medal is earned."
                : "Invalid lab plan.",
            ),
          );
          onImported();
        }}
      >
        {t("Import lab plan")}
      </button>
    </section>
  );
}
