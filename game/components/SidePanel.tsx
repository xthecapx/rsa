"use client";
import { useLocale } from "@/i18n";

import { HackerTerminal } from "./HackerTerminal";
import { ObjectiveList } from "./ObjectiveList";

/**
 * Street-side checklist and log. Decode work lives in the full-screen laptop.
 */
export function SidePanel() {
  useLocale((state) => state.locale);
  return (
    <>
      <ObjectiveList />
      <div className="min-h-0 flex-1">
        <HackerTerminal />
      </div>
    </>
  );
}
