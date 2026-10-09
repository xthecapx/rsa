"use client";
import { LAB_ITEMS, itemAvailable } from "@/content/lab";
import type { MedalId } from "@/content/medals";
import { useLab } from "@/game/lab";
import { t } from "@/i18n";
import { LabItemIcon } from "./LabArt";
export function LabSupplies({
  earned,
  busy,
  onClose,
}: {
  earned: Partial<Record<MedalId, string>>;
  busy: boolean;
  onClose: () => void;
}) {
  const lab = useLab();
  return (
    <aside className="lab-supplies panel p-3 space-y-3">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-accent-teal">{t("Equipment supplies")}</h2>
        <button
          className="btn-ghost"
          aria-label={t("Close equipment supplies")}
          onClick={() => onClose()}
        >
          ×
        </button>
      </div>
      <p className="text-xs text-stage-muted">
        {t(
          "Medals unlock supplies. Acquire items for free, then place or install them.",
        )}
      </p>
      {LAB_ITEMS.map((item) => {
        const owned = lab.owned.includes(item.id),
          available = itemAvailable(item, earned);
        return (
          <div
            key={item.id}
            className="lab-supply-row flex gap-2 items-center justify-between border-b border-stage-border pb-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <LabItemIcon id={item.id} />
              <span className="min-w-0">
                {t(item.title)}
                {!available && (
                  <small className="block text-stage-muted">
                    {t(
                      [
                        "",
                        "Requires Quantum Coin",
                        "Requires Amplitude Amplifier",
                        "Requires Ghost Key",
                        "Requires all four RSA medals",
                      ][item.tier],
                    )}
                  </small>
                )}
              </span>
            </div>
            <button
              className="btn-ghost text-xs"
              disabled={busy || !available || (owned && !item.module)}
              onClick={() =>
                owned ? lab.install(item.id) : lab.acquire(item.id)
              }
            >
              {t(
                !available
                  ? "Locked"
                  : !owned
                    ? "Acquire"
                    : item.module
                      ? lab.installed.includes(item.id)
                        ? "Uninstall"
                        : "Install"
                      : "Owned",
              )}
            </button>
          </div>
        );
      })}
    </aside>
  );
}
