type SelectableTileProps = {
  eyebrow: string;
  title: string;
  description: string;
  active?: boolean;
  onClick: () => void;
};

export function SelectableTile({
  eyebrow,
  title,
  description,
  active = false,
  onClick,
}: SelectableTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[26px] border p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/10 ${
        active
          ? "border-fuchsia-300/34 bg-fuchsia-300/10 shadow-[0_0_36px_rgba(217,70,239,0.14)] ring-1 ring-white/12"
          : "border-white/10 bg-black/18"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.3em] text-white/55">{eyebrow}</p>
      <h3 className="mt-3 line-clamp-2 break-words font-serif text-2xl text-white xl:text-xl">{title}</h3>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/68 xl:text-[13px] xl:leading-5">{description}</p>
    </button>
  );
}
