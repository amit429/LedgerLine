"use client";

import { useEffect, useRef, useState } from "react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  allLabel: string;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  allLabel,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length <= 2
        ? options
            .filter((o) => selected.includes(o.value))
            .map((o) => o.label)
            .join(", ")
        : `${selected.length} selected`;

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-[13px] ${
          selected.length > 0 ? "border-primary" : "border-border"
        }`}
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{summary}</span>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 z-10 mt-1.5 w-56 rounded-md border border-border bg-white py-1.5 shadow-lg">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[13px] hover:bg-secondary"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
