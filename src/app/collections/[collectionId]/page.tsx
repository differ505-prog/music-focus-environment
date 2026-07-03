import { notFound } from "next/navigation";

import { CollectionDetailPage } from "@/components/collection-detail-page";
import { trackCollections } from "@/data/music-assets";

type CollectionPageProps = {
  params: Promise<{
    collectionId: string;
  }>;
};

export default async function Page({ params }: CollectionPageProps) {
  const { collectionId } = await params;
  const collectionExists = trackCollections.some((collection) => collection.id === collectionId);

  if (!collectionExists) {
    notFound();
  }

  return <CollectionDetailPage collectionId={collectionId} />;
}
