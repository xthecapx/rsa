"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { t, useLocale } from "@/i18n";

/** One bounded overlay for both town maps; resizing never resets the player's choice. */
export function MinimapPanel({ children }: { children: ReactNode }) {
  useLocale((state) => state.locale);
  // Match the server's first render; choose the initial viewport default only once.
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    setCollapsed(
      window.matchMedia(
        "(pointer: coarse), (max-width: 600px), (max-height: 550px)",
      ).matches,
    );
  }, []);
  const bodyId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <aside
      className={`town-minimap panel bg-stage-bg/95 ${collapsed ? "is-collapsed" : "is-expanded"}`}
      aria-label={t("Town minimap")}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !collapsed && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          setCollapsed(true);
          toggle.current?.focus();
        }
      }}
    >
      <button
        ref={toggle}
        type="button"
        className="minimap-toggle flex w-full items-center justify-between gap-2 text-xs text-accent-teal"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        title={t(collapsed ? "Show minimap" : "Hide minimap")}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span>{t("Town minimap")}</span>
        <span aria-hidden="true">{collapsed ? "+" : "−"}</span>
      </button>
      <div id={bodyId} hidden={collapsed} className="minimap-content">
        {children}
      </div>
    </aside>
  );
}
