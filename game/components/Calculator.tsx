"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { calculate } from "@/game/calc";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";

/** One calculator per laptop; benches load a sum into it with their 🧮 buttons. */
interface CalculatorState {
  open: boolean; input: string;
  setInput: (input: string) => void;
  toggle: (open?: boolean) => void;
  /** Put a sum on the display and open the calculator; the player still presses =. */
  load: (input: string) => void;
}
export const useCalculator = create<CalculatorState>((set) => ({
  open: false, input: "",
  setInput: (input) => set({ input }),
  toggle: (open) => set((state) => ({ open: open ?? !state.open })),
  load: (input) => set({ open: true, input }),
}));

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "+", "-", "×", "÷", "^", " mod ", "gcd(", ",", "(", ")"];

/**
 * Whole-number calculator for the laptop: + − × ÷, powers, mod and gcd, exact
 * at any size, so a bench never sends the player to another app.
 */
export function Calculator() {
  useLocale((state) => state.locale);
  const { input, setInput, toggle } = useCalculator();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { field.current?.focus(); }, []);
  const result = input.trim() ? calculate(input) : null;
  const press = (key: string) => { gameAudio.playSfx("click"); setInput(`${input}${key}`); field.current?.focus(); };
  return <section className="calculator" aria-label={t("Calculator")}>
    <div className="calculator-head">
      <strong>🧮 {t("Calculator")}</strong>
      <button type="button" className="btn-ghost text-xs" onClick={() => toggle(false)}>{t("Hide")}</button>
    </div>
    <input ref={field} className="calculator-input" value={input} inputMode="numeric" spellCheck={false} aria-label={t("Sum")}
      placeholder="4^3 mod 7" onChange={(event) => setInput(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); gameAudio.playSfx("select"); } }} />
    <p className="calculator-result" role="status" aria-live="polite">
      {result === null ? <span className="text-stage-muted">{t("Type or tap a sum")}</span>
        : "value" in result ? <>= <b>{result.value.toString()}</b></> : <span className="text-accent-amber">{t(result.error)}</span>}
    </p>
    <div className="calculator-keys">
      {KEYS.map((key) => <button key={key} type="button" className="btn-ghost" onClick={() => press(key)}>{key.trim()}</button>)}
      <button type="button" className="btn-ghost" onClick={() => { gameAudio.playSfx("click"); setInput(input.slice(0, -1)); }} aria-label={t("Delete")}>⌫</button>
      <button type="button" className="btn-ghost" onClick={() => { gameAudio.playSfx("click"); setInput(""); }}>C</button>
    </div>
    <p className="text-[11px] text-stage-muted">{t("mod and ^ go first: 4^3 mod 7 is 64 mod 7.")}</p>
  </section>;
}
