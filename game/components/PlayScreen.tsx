"use client";
import type { ActNumber } from "@/content/types";
import { TownScreen } from "./TownScreen";

/** Legacy act links select an offer at the town client, never auto-start a run. */
export function PlayScreen({ act }: { act: ActNumber }) { return <TownScreen initialAct={act} />; }
