import { notFound } from "next/navigation";

import type { ActNumber } from "@/content/types";
import { ACT_NUMBERS } from "@/content";
import { PlayScreen } from "@/components/PlayScreen";

export function generateStaticParams() {
  return ACT_NUMBERS.map((act) => ({ act: String(act) }));
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ act: string }>;
}) {
  const { act } = await params;
  const parsed = Number(act) as ActNumber;
  if (!ACT_NUMBERS.includes(parsed)) notFound();

  return <PlayScreen act={parsed} />;
}
