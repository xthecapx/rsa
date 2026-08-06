import ActGamePage from "./ActGamePage";

interface PageProps {
  params: Promise<{ act: string }>;
  searchParams: Promise<{ tier?: string }>;
}

export default async function ActPage({ params, searchParams }: PageProps) {
  const { act } = await params;
  const { tier } = await searchParams;

  return <ActGamePage actParam={act} tierParam={tier} />;
}
