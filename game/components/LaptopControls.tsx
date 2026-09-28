"use client";

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
