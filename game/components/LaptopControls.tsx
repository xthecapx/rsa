"use client";
import { t, localize, useLocale } from "@/i18n";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

/** The same question and answer controls in every laptop lesson. */
export function LaptopQuestion({ prompt, children, className }: {
  prompt: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={clsx("laptop-challenge", className)}>
    <p className="laptop-question">{prompt}</p>
    {children}
  </section>;
}

export function LaptopChoiceButton({ selected = false, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button {...props} type="button" className={clsx("laptop-choice", selected && "selected", className)}>
    {children}
  </button>;
}

export function StepHeader({
  step,
  total,
  title,
}: {
  step: number;
  total: number;
  title: string;
}) {
  useLocale((state) => state.locale);
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-[#e8f4f8]">
        {localize(title)}
      </h2>
      <span className="text-xs text-stage-muted">{t("Step ")}{step}/{total}
      </span>
    </div>
  );
}
