"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { MODELS, modelById, type ModelId } from "@/lib/models";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function ModelSelector() {
  const { model, setModel } = useStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = modelById(model);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
      >
        <span className={cn("size-1.5 rounded-full bg-current", active.accent)} />
        <span className="font-medium">{active.name}</span>
        <ChevronDown
          size={13}
          className={cn("text-zinc-500 transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-md"
          >
            {MODELS.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m.id === model}
                  onClick={() => {
                    setModel(m.id as ModelId);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    "hover:bg-zinc-800/70 focus-visible:bg-zinc-800/70 focus-visible:outline-none",
                    m.id === model && "bg-zinc-900",
                  )}
                >
                  <span
                    className={cn("mt-1.5 size-1.5 shrink-0 rounded-full bg-current", m.accent)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-zinc-100">
                      {m.name}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {m.blurb}
                    </span>
                  </span>
                  {m.id === model && (
                    <Check size={13} className="mt-1 shrink-0 text-amber-400" />
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
