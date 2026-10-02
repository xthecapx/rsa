"use client";

import { useLayoutEffect } from "react";
import { trackViewport } from "@/game/viewport";

export function ViewportBootstrap() {
  useLayoutEffect(trackViewport, []);
  return null;
}
