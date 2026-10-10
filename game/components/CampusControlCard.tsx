"use client";
import { useId, type ReactNode } from "react";
import { t } from "@/i18n";

/** A setting's visual identity and help stay beside the control it describes. */
export function CampusControlCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="campus-control-card">
      <h4 className="campus-control-heading">
        <span className="campus-control-icon" aria-hidden="true">
          {icon}
        </span>
        {t(title)}
      </h4>
      {children}
    </section>
  );
}

/** Native checkboxes keep keyboard/touch behavior while the whole card is tappable. */
export function CampusToggleCard({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const help = useId();
  return (
    <label
      className="campus-control-card campus-toggle-card"
      data-active={checked}
    >
      <span className="campus-control-heading">
        <span className="campus-control-icon" aria-hidden="true">
          {icon}
        </span>
        <span>{t(label)}</span>
        <input
          type="checkbox"
          aria-label={t(label)}
          aria-describedby={help}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </span>
      <span id={help} className="campus-control-help">
        {t(description)}
      </span>
    </label>
  );
}

export function CampusChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  cards = false,
}: {
  label: string;
  options: readonly {
    value: T;
    label: string;
    icon?: string;
    description?: string;
  }[];
  value: T;
  onChange: (value: T) => void;
  cards?: boolean;
}) {
  const help = useId();
  return (
    <fieldset className="campus-choice">
      <legend>{t(label)}</legend>
      <div className={cards ? "campus-choice-cards" : "campus-choice-buttons"}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={cards ? "campus-control-card" : "btn-ghost"}
            aria-label={t(option.label)}
            aria-describedby={
              option.description ? `${help}-${option.value}` : undefined
            }
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.icon && (
              <span className="campus-control-icon" aria-hidden="true">
                {option.icon}
              </span>
            )}
            <span>{t(option.label)}</span>
            {option.description && (
              <span
                id={`${help}-${option.value}`}
                className="campus-control-help"
              >
                {t(option.description)}
              </span>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
