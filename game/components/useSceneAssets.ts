"use client";

import { useEffect, useState } from "react";

const COIN_ASSETS = ["/assets/kenney/characters.png", "/assets/kenney/portraits.png"];
const GROVER_ASSETS = [...COIN_ASSETS, "/assets/characters/town-doctor.svg"];

/** SVG references and CSS portraits need to be decoded before the house can play. */
export function useCoinSceneAssets() { return useSceneAssets(COIN_ASSETS); }
export function useGroverSceneAssets() { return useSceneAssets(GROVER_ASSETS); }

function useSceneAssets(assets: string[]) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      cancelled = true;
      setStatus("error");
    }, 20000);
    const images = assets.map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
    void Promise.all(images.map((image) => image.decode())).then(() => {
      if (!cancelled) setStatus("ready");
    }).catch(() => {
      if (!cancelled) setStatus("error");
    }).finally(() => window.clearTimeout(timeout));
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [assets]);
  return status;
}
