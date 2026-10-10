import { createRoot, type Root } from "react-dom/client";
import { useEffect, useState } from "react";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ViewportBootstrap } from "@/components/ViewportBootstrap";
import { QuantumJobProgress } from "@/components/QuantumJobProgress";
import { SplashScreen } from "@/components/SplashScreen";
import { TownScreen } from "@/components/TownScreen";
import { gameAudio } from "@/game/audio";
import { invalidateMission } from "@/game/runtime";
import { runtimeInfo, setServiceTransport, type ServiceTransport } from "@/lib/transport";
import type { ActNumber } from "@/content/types";

export interface RuntimeBridge {
  request: ServiceTransport;
  backend: string;
  remoteFinalOnly?: boolean;
  kind: "ideal" | "noise" | "hardware";
}

let root: Root | null = null;
function BrowserWorld() {
  const [entry, setEntry] = useState<{ key: number; props: Parameters<typeof TownScreen>[0] }>({ key: 0, props: {} });
  useEffect(() => {
    const navigate = (event: Event) => {
      const path = (event as CustomEvent<string>).detail;
      let props: Parameters<typeof TownScreen>[0] = {};
      if (path === "/scenarios/coin") props = { initialCoin: true };
      else if (path === "/scenarios/grover") props = { initialGrover: true };
      else if (path === "/scenarios/vault") props = { initialVault: true };
      else if (path === "/scenarios/rsa") props = { visitRsa: true };
      else if (/^\/(?:scenarios\/rsa\/)?play\/[1-4]$/.test(path)) props = { initialAct: Number(path.at(-1)) as ActNumber };
      else if (path !== "/") return;
      setEntry((previous) => ({ key: previous.key + 1, props }));
    };
    window.addEventListener("quantum-playground-entry", navigate);
    return () => window.removeEventListener("quantum-playground-entry", navigate);
  }, []);
  return <TownScreen key={entry.key} {...entry.props} />;
}

export function mountGame(bridge: RuntimeBridge): () => void {
  if (root) root.unmount();
  const host = document.getElementById("quantum-playground");
  if (!host) throw new Error("Missing qWard mount element");
  setServiceTransport(bridge.request);
  Object.assign(runtimeInfo, { target: "qollab", backend: bridge.backend, kind: bridge.kind, remoteFinalOnly: bridge.remoteFinalOnly ?? false });
  document.documentElement.dataset.boot = "1";
  root = createRoot(host);
  root.render(<LanguageProvider><ViewportBootstrap /><SplashScreen /><BrowserWorld /><QuantumJobProgress /></LanguageProvider>);
  const dispose = () => {
    invalidateMission();
    root?.unmount();
    root = null;
    gameAudio.stop();
    setServiceTransport(null);
    window.removeEventListener("pagehide", dispose);
  };
  window.addEventListener("pagehide", dispose, { once: true });
  return dispose;
}
