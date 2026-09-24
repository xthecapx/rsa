"use client";

import { useLocale } from "@/i18n";

export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return <div className="language-switch" role="group" aria-label="Language / Idioma">
    <button lang="en" aria-label="English" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
    <button lang="es" aria-label="Español" aria-pressed={locale === "es"} onClick={() => setLocale("es")}>ES</button>
  </div>;
}
