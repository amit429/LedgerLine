"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

interface DropzoneProps {
  label: string;
  columnsHint: string;
  file: File | null;
  onFileSelected: (file: File) => void;
}

export function Dropzone({ label, columnsHint, file, onFileSelected }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) onFileSelected(dropped);
      }}
      className={`flex-1 cursor-pointer rounded-lg border-[1.5px] border-dashed bg-white px-5.5 py-7 text-left transition-colors ${
        isDragOver ? "border-primary bg-secondary" : "border-ring"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onFileSelected(selected);
        }}
      />
      <Upload size={28} className="mb-2 text-muted-foreground" />
      <p className="mb-2 text-[15px] font-semibold">{label}</p>
      {file ? (
        <p className="mb-2 text-[12.5px] font-medium text-[var(--severity-reconciled)]">
          {file.name} selected
        </p>
      ) : (
        <p className="mb-2 text-[12.5px] text-muted-foreground">
          Drop a CSV here, or browse
        </p>
      )}
      <code className="block font-mono text-[11px] leading-[17px] text-muted-foreground/70">
        {columnsHint}
      </code>
    </div>
  );
}
