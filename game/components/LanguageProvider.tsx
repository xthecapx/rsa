"use client";

import { useEffect, type ReactNode } from "react";
import { useLocale } from "@/i18n";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useLocale((s) => s.locale);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("quantum-playground-language");
      if (saved === "es" || saved === "en") useLocale.getState().setLocale(saved);
    } catch { /* Default to English when storage is unavailable. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return children;
}
