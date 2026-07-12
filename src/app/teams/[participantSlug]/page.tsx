import { PagePlaceholder } from "@/components/page-placeholder";

type TeamPageProps = {
  params: Promise<{ participantSlug: string }>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { participantSlug } = await params;

  return (
    <PagePlaceholder
      title="Fantasy-team details"
      description={`The team page for “${participantSlug}” is under development. No participant or tournament data has been added yet.`}
    />
  );
}
