"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface OrdersTabDropdownProps {
  selectedLabel: string;
  selectedKey: string;
  options: Array<{ key: string; label: string; href: string }>;
  active?: boolean;
}

export function OrdersTabDropdown({ selectedLabel, selectedKey, options, active = true }: OrdersTabDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (ref.current && !ref.current.contains(target)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`rounded-md px-3 py-1.5 text-[0.95rem] transition ${
          active
            ? "bg-slate-100 font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200"
            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        {selectedLabel}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-44 rounded-md border border-slate-300 bg-white p-1 shadow-md">
          {options.map((option) => (
            <Link
              key={option.key}
              href={option.href}
              onClick={() => setOpen(false)}
              className={`block rounded px-3 py-2 text-sm ${
                selectedKey === option.key
                  ? "bg-slate-100 font-semibold text-slate-950"
                  : "text-slate-800 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
