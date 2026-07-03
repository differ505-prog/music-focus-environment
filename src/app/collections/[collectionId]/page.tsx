import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionDetailPage } from "@/components/collection-detail-page";
import { trackCollections, tracks } from "@/data/music-assets";
import { siteName } from "@/lib/site-metadata";

type CollectionPageProps = {
  params: Promise<{
    collectionId: string;
  }>;
};

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { collectionId } = await params;
  const collection = trackCollections.find((item) => item.id === collectionId);

  if (!collection) {
    return {
      title: "系列不存在",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const coverImage = collection.trackIds
    .map((trackId) => tracks.find((track) => track.id === trackId)?.media.coverImageUrl)
    .find(Boolean);
  const description = `${collection.description} ${collection.summary}`;

  return {
    title: collection.title,
    description,
    alternates: {
      canonical: `/collections/${collection.id}`,
    },
    openGraph: {
      type: "article",
      url: `/collections/${collection.id}`,
      title: `${collection.title} | ${siteName}`,
      description,
      images: coverImage ? [{ url: coverImage, alt: collection.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${collection.title} | ${siteName}`,
      description,
      images: coverImage ? [coverImage] : undefined,
    },
  };
}

export function generateStaticParams() {
  return trackCollections.map((collection) => ({
    collectionId: collection.id,
  }));
}

export default async function Page({ params }: CollectionPageProps) {
  const { collectionId } = await params;
  const collectionExists = trackCollections.some((collection) => collection.id === collectionId);

  if (!collectionExists) {
    notFound();
  }

  return <CollectionDetailPage collectionId={collectionId} />;
}
