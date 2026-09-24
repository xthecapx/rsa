"use client";

import { create } from "zustand";
import type { ReactNode } from "react";
import spanish from "./es.json";
import { translate } from "./translate";

export type Locale = "en" | "es";
export const useLocale = create<{ locale: Locale; setLocale: (locale: Locale) => void }>((set) => ({
  locale: "en",
  setLocale: (locale) => {
    set({ locale });
    try { localStorage.setItem("quantum-playground-language", locale); } catch { /* In-memory language still works. */ }
  },
}));

/** Translate display text only. Never use translated strings as IDs or API data. */
export function t(text: string): string {
  return useLocale.getState().locale === "es" ? translate(text, spanish) : text;
}
export function localize(value: ReactNode): ReactNode {
  return typeof value === "string" ? t(value) : value;
}
export function tOptional(text: string): string;
export function tOptional(text: string | undefined): string | undefined;
export function tOptional(text: string | undefined): string | undefined {
  return text === undefined ? undefined : t(text);
}
