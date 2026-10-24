import { t } from "@/i18n";

/** Display-only names; wire and position numbers are one-based, top to bottom. */
export function gateLabel(gate: string): string {
  const names: Record<string, string> = {
    H: "H gate (Hadamard)",
    X: "X gate",
    Z: "Z gate",
    CX: "CX gate (CNOT)",
  };
  return t(names[gate] ?? gate);
}
export const addComponentLabel = (component: string) =>
  t("Add {component}").replace("{component}", component);
export const componentCopyLabel = (component: string, copy: number) =>
  t("{component}, copy {copy}")
    .replace("{component}", component)
    .replace("{copy}", String(copy));
export const circuitPositionLabel = (
  component: string,
  wire: number,
  position: number,
) =>
  t("{component}, wire {wire}, position {position}")
    .replace("{component}", component)
    .replace("{wire}", String(wire))
    .replace("{position}", String(position));
export function circuitActionLabel(
  action: "remove" | "left" | "right" | "settings" | "close",
  component: string,
) {
  const templates = {
    remove: "Remove {component}",
    left: "Move {component} left",
    right: "Move {component} right",
    settings: "Settings for {component}",
    close: "Close settings for {component}",
  };
  return t(templates[action]).replace("{component}", component);
}
