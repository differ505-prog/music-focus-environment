'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

type MenuItem = {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "emerald" | "cyan" | "amber";
  disabled?: boolean;
};

type MoreMenuProps = {
  items: MenuItem[];
  trigger?: React.ReactNode;
  placement?: "bottom-left" | "bottom-right";
};

const variantClasses = {
  default: "text-white/74 hover:bg-white/10 hover:text-white",
  danger: "text-rose-100/84 hover:bg-rose-300/16 hover:text-rose-50",
  emerald: "text-emerald-100/84 hover:bg-emerald-300/16 hover:text-emerald-50",
  cyan: "text-cyan-100/84 hover:bg-cyan-300/16 hover:text-cyan-50",
  amber: "text-amber-100/84 hover:bg-amber-300/16 hover:text-amber-50",
};

export function MoreMenu({ items, trigger, placement = "bottom-right" }: MoreMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const handleSelect = useCallback(
    (onClick: () => void) => {
      onClick();
      setIsOpen(false);
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const isLeft = placement === "bottom-left";

  return (
    <div className="relative inline-flex" ref={menuRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="更多選項"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="rounded-full border border-white/10 bg-white/8 p-2 text-white/62 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
      >
        {trigger ?? <MoreHorizontal className="h-4 w-4" />}
      </button>
      {isOpen ? (
        <div
          role="menu"
          className={`absolute top-full z-50 mt-2 flex w-[13rem] flex-col items-stretch gap-0.5 rounded-[20px] border border-white/10 bg-black/95 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.72)] backdrop-blur-xl ${
            isLeft ? "left-0" : "right-0"
          }`}
        >
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => void handleSelect(item.onClick)}
              className={`w-full rounded-[16px] border border-transparent px-3 py-2.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-38 ${
                variantClasses[item.variant ?? "default"]
              } ${index > 0 ? "mt-0.5" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
