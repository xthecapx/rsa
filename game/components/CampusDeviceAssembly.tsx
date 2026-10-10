"use client";
import type { CampusSettings } from "@/game/campusExperiment";
import { t } from "@/i18n";

type Device = CampusSettings["order"][number];

function DeviceIcon({ device }: { device: Device }) {
  if (device === "Prepare") return <span className="font-mono">|0⟩</span>;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {device === "Control" ? (
        <>
          <path d="M4 7h5m4 0h7M4 17h9m4 0h3" />
          <circle cx="11" cy="7" r="2" />
          <circle cx="15" cy="17" r="2" />
        </>
      ) : (
        <>
          <path d="M4 19a9 9 0 1 1 16 0H4ZM12 14l4-5M6 11l1 1M12 5v2M18 11l-1 1" />
          <circle cx="12" cy="14" r="1" />
        </>
      )}
    </svg>
  );
}

/** Device identity, parameters and ordering stay together on the assembly bench. */
export function CampusDeviceAssembly({
  settings,
  update,
}: {
  settings: CampusSettings;
  update: (patch: Partial<CampusSettings>) => void;
}) {
  const gateName =
    settings.gate === "X" ? "Classical flip · X" : "Quantum superposition · H";
  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= settings.order.length) return;
    const order = [...settings.order];
    [order[index], order[target]] = [order[target], order[index]];
    update({ order });
  }
  return (
    <section className="space-y-3">
      <p className="text-sm text-stage-muted">
        {t(
          "Arrange the devices in order. Use the reorder buttons below each device.",
        )}
      </p>
      <ol className="campus-device-order" aria-label={t("Device order")}>
        {settings.order.map((device, index) => (
          <li className="campus-device-card" key={device} data-device={device}>
            <div className="campus-device-heading">
              <span className="campus-device-position" aria-hidden="true">
                {index + 1}
              </span>
              <span className="campus-device-icon" aria-hidden="true">
                <DeviceIcon device={device} />
              </span>
              <h4>{t(device)}</h4>
            </div>
            <div className="campus-device-body">
              {device === "Control" ? (
                <fieldset aria-label={t("Control device")}>
                  <div className="campus-device-gates">
                    {(["X", "H"] as const).map((gate) => {
                      const label = t(
                        gate === "X"
                          ? "Classical flip · X"
                          : "Quantum superposition · H",
                      );
                      return (
                        <button
                          type="button"
                          key={gate}
                          aria-label={label}
                          title={label}
                          aria-pressed={settings.gate === gate}
                          onClick={() => update({ gate })}
                        >
                          {gate}
                        </button>
                      );
                    })}
                  </div>
                  <p className="campus-device-caption">{t(gateName)}</p>
                </fieldset>
              ) : (
                <p className="campus-device-caption">
                  {t(
                    device === "Prepare"
                      ? "Start each shot with a fresh |0⟩."
                      : "Read one bit: 0 or 1.",
                  )}
                </p>
              )}
            </div>
            <div
              className="campus-device-reorder"
              role="group"
              aria-label={t("Reorder {device}").replace("{device}", t(device))}
            >
              {([-1, 1] as const).map((offset) => {
                const label = t(
                  offset === -1
                    ? "Move {device} earlier"
                    : "Move {device} later",
                ).replace("{device}", t(device));
                return (
                  <button
                    type="button"
                    key={offset}
                    aria-label={label}
                    title={label}
                    disabled={
                      index + offset < 0 ||
                      index + offset >= settings.order.length
                    }
                    onClick={() => move(index, offset)}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path
                        d={offset === -1 ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"}
                      />
                    </svg>
                    <span>
                      {t(offset === -1 ? "Move earlier" : "Move later")}
                    </span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      {settings.order.join() !== "Prepare,Control,Measure" && (
        <p className="text-accent-amber" role="status">
          {t("Arrange Prepare → Control → Measure before running.")}
        </p>
      )}
    </section>
  );
}
