"use client";

import { useEffect } from "react";

const BUILD_ID = process.env.NEXT_PUBLIC_PWA_BUILD_ID ?? "dev";
const RELOAD_FLAG = "mitm-pwa-reloaded";
const DEV_SW_CLEARED = "mitm-pwa-dev-sw-cleared";

async function clearDevServiceWorkers(): Promise<void> {
  const hadController = Boolean(navigator.serviceWorker.controller);
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((reg) => reg.unregister()));
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("mitm-shell-"))
        .map((key) => caches.delete(key)),
    );
  }
  // A controlling worker from a prior `next start` / install test keeps
  // intercepting `/_next` until the page reloads without it.
  if (hadController && sessionStorage.getItem(DEV_SW_CLEARED) !== "1") {
    sessionStorage.setItem(DEV_SW_CLEARED, "1");
    window.location.reload();
  }
}

function watchForUpdates(registration: ServiceWorkerRegistration): void {
  const promptReload = (worker: ServiceWorker) => {
    worker.postMessage({ type: "SKIP_WAITING" });
  };

  if (registration.waiting) {
    promptReload(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        promptReload(installing);
      }
    });
  });
}

/**
 * Registers the service worker (needed for installability). The player can
 * rotate freely between portrait and landscape.
 *
 * Each production build embeds a unique NEXT_PUBLIC_PWA_BUILD_ID. The worker
 * is registered as `/sw.js?v=<id>`, so a new deploy installs a new worker and
 * drops every previous mitm-shell-* cache on activate.
 */
export function PwaBootstrap() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // HMR + a caching SW fight each other; strip leftovers from install tests.
    if (process.env.NODE_ENV === "development") {
      void clearDevServiceWorkers();
      return;
    }

    let cancelled = false;
    const focusListeners: Array<() => void> = [];

    const onControllerChange = () => {
      // One reload per update so we don't loop if claim() races.
      if (sessionStorage.getItem(RELOAD_FLAG) === BUILD_ID) return;
      sessionStorage.setItem(RELOAD_FLAG, BUILD_ID);
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = () => {
      void navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(BUILD_ID)}`)
        .then((registration) => {
          if (cancelled) return;
          watchForUpdates(registration);

          const check = () => {
            void registration.update();
          };
          // Catch deploys while the installed app stays open.
          const onVisible = () => {
            if (document.visibilityState === "visible") check();
          };
          document.addEventListener("visibilitychange", onVisible);
          window.addEventListener("focus", check);
          focusListeners.push(() => {
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", check);
          });
          check();
        })
        .catch(() => {
          // Private mode may reject; the game still runs in the browser.
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      for (const dispose of focusListeners) dispose();
    };
  }, []);

  return null;
}
