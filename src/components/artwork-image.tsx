'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';

import { SmartPlaceholder } from '@/components/ui-system';

type ArtworkImageProps = {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  fallbackPrompt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

export function ArtworkImage({
  src,
  alt,
  width = 1200,
  height = 720,
  fallbackPrompt,
  className = '',
  sizes = '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw',
  priority = false,
}: ArtworkImageProps) {
  const [errored, setErrored] = useState(false);

  const imageSrc = useMemo(() => {
    if (errored || !src) {
      return null;
    }

    return src;
  }, [src, errored]);

  const placeholderPrompt = useMemo(() => {
    return fallbackPrompt ?? `Cinematic music artwork for ${alt}`;
  }, [alt, fallbackPrompt]);

  if (!imageSrc) {
    return (
      <SmartPlaceholder
        width={width}
        height={height}
        label={alt}
        aiPrompt={placeholderPrompt}
        className={className}
      />
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setErrored(true)}
    />
  );
}

type CoverImageProps = {
  src: string | null | undefined;
  alt: string;
  fallbackPrompt?: string;
  containerClassName?: string;
  imageClassName?: string;
};

export function CoverImage({
  src,
  alt,
  fallbackPrompt,
  containerClassName = '',
  imageClassName = '',
}: CoverImageProps) {
  const [errored, setErrored] = useState(false);

  const imageSrc = useMemo(() => {
    if (errored || !src) {
      return null;
    }

    return src;
  }, [src, errored]);

  const placeholderPrompt = useMemo(() => {
    return fallbackPrompt ?? `Cinematic ${alt} music`;
  }, [alt, fallbackPrompt]);

  if (!imageSrc) {
    return (
      <SmartPlaceholder
        width={1200}
        height={720}
        label={alt}
        aiPrompt={placeholderPrompt}
        className={containerClassName}
      />
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={1200}
      height={720}
      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
      className={imageClassName}
      onError={() => setErrored(true)}
    />
  );
}
