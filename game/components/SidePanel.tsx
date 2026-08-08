"use client";

import type { ActNumber } from "@/content/types";
import { HackerTerminal } from "./HackerTerminal";
import { ObjectiveList } from "./ObjectiveList";
import { Workbench } from "./Workbench";

/**
 * The workbench stack, shared by the desktop sidebar and the phone sheet.
 *
 * The sidebar divides a fixed column between panels that scroll on their own.
 * `flow` drops that: every panel grows to its content and the parent is the
 * only thing that scrolls, which is far easier to follow on a small screen
 * than three scrollbars stacked on top of each other.
 *
 * Reporting to the boss happens in the street dialog, not here.
 */
export function SidePanel({
  act,
  flow = false,
}: {
  act: ActNumber;
  flow?: boolean;
}) {
  return (
    <>
      <ObjectiveList />
      <Workbench act={act} flow={flow} />
      <div className={flow ? undefined : "h-48 shrink-0"}>
        <HackerTerminal flow={flow} />
      </div>
    </>
  );
}
