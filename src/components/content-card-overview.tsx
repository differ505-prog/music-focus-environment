'use client';

import { Chip } from '@/components/ui-system';

type ContentCardOverviewProps = {
  eyebrow: string;
  title: string;
  description?: string;
  metaItems?: string[];
  wrapperClassName?: string;
  eyebrowClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  metaListClassName?: string;
  metaItemClassName?: string;
};

export function ContentCardOverview({
  eyebrow,
  title,
  description,
  metaItems = [],
  wrapperClassName = "",
  eyebrowClassName = "",
  titleClassName = "",
  descriptionClassName = "",
  metaListClassName = "",
  metaItemClassName = "",
}: ContentCardOverviewProps) {
  return (
    <div className={wrapperClassName}>
      <p className={`text-[11px] uppercase tracking-[0.28em] text-white/42 ${eyebrowClassName}`.trim()}>{eyebrow}</p>
      <h3 className={`mt-3 line-clamp-2 break-words font-serif text-2xl text-white ${titleClassName}`.trim()}>{title}</h3>
      {description ? (
        <p className={`mt-3 text-sm leading-6 text-white/66 ${descriptionClassName}`.trim()}>{description}</p>
      ) : null}
      {metaItems.length > 0 ? (
        <div className={`mt-4 flex flex-wrap gap-2 ${metaListClassName}`.trim()}>
          {metaItems.map((item) => (
            <Chip key={`${title}-${item}`} className={metaItemClassName}>
              {item}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
