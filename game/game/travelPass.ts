"use client";

import { create } from "zustand";

/**
 * A temporary travel pass for checking every town without earning its badge.
 * Turn it on with `?travel=on` and off with `?travel=off` (or the panel's End
 * button). It lives in sessionStorage, so it ends when the tab closes and never
 * touches saved progress, cards or medals.
 */
const KEY = "quantum-travel-pass";

interface TravelPass { active: boolean; sync: () => void; end: () => void }

export const useTravelPass = create<TravelPass>((set) => ({
  active: false,
  sync: () => {
    try {
      const url = new URL(window.location.href);
      const asked = url.searchParams.get("travel");
      if (asked === "on" || asked === "1") sessionStorage.setItem(KEY, "1");
      if (asked === "off" || asked === "0") sessionStorage.removeItem(KEY);
      if (asked !== null) { url.searchParams.delete("travel"); window.history.replaceState(null, "", url); }
      set({ active: sessionStorage.getItem(KEY) === "1" });
    } catch { /* No session storage: the pass stays off. */ }
  },
  end: () => {
    try { sessionStorage.removeItem(KEY); } catch { /* Nothing to clear. */ }
    set({ active: false });
  },
}));
