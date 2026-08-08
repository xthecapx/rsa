"use client";

import type { ActNumber } from "@/content/types";
import { HackerTerminal } from "./HackerTerminal";
import { ObjectiveList } from "./ObjectiveList";
import { ReportForm } from "./ReportForm";
import { Workbench } from "./Workbench";
import { useGame } from "@/game/state";

/**
 * The workbench stack, shared by the desktop sidebar and the phone sheet.
 *
 * The sidebar divides a fixed column between panels that scroll on their own.
 * `flow` drops that: every panel grows to its content and the parent is the
 * only thing that scrolls, which is far easier to follow on a small screen
 * than three scrollbars stacked on top of each other.
 */
export function SidePanel({
  act,
  flow = false,
}: {
  act: ActNumber;
  flow?: boolean;
}) {
  const panel = useGame((s) => s.panel);

  return (
    <>
      <ObjectiveList />
      {panel === "report" ? (
        <ReportForm flow={flow} />
      ) : (
        <Workbench act={act} flow={flow} />
      )}
      <div className={flow ? undefined : "h-48 shrink-0"}>
        <HackerTerminal flow={flow} />
      </div>
    </>
  );
}
