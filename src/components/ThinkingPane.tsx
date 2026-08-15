"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, ChevronRight, Globe } from "lucide-react";
import type { ToolEvent } from "@/lib/db";
import { cn } from "@/lib/utils";

/** A friendly verb for each tool the model can reach. */
function toolLabel(t: ToolEvent) {
  const n = t.name.toLowerCase();
  if (n.includes("search")) return { verb: "Searched", detail: t.detail };
  if (n.includes("fetch")) return { verb: "Read", detail: t.detail };
  return { verb: "Used", detail: t.detail ?? t.name };
}

export default function ThinkingPane({
  thinking,
  tools,
  streaming,
  hasAnswer,
}: {
  thinking?: string;
  tools?: ToolEvent[];
  streaming: boolean;
  hasAnswer: boolean;
}) {
  // Open while reasoning is the only thing happening; collapse once the answer
  // begins so the reply is what the eye lands on. User can reopen.
  const auto = streaming && !hasAnswer;
  const [open, setOpen] = useState(auto);
  const [touched, setTouched] = useState(false);
  const effectiveOpen = touched ? open : auto;

  const hasThinking = Boolean(thinking && thinking.trim());
  const hasTools = Boolean(tools && tools.length > 0);
  if (!hasThinking && !hasTools) return null;

  return (
    <div className="mb-2.5 space-y-1.5">
      {hasTools && (
        <div className="flex flex-wrap gap-1.5">
          {tools!.map((t, i) => {
            const { verb, detail } = toolLabel(t);
            return (
              <motion.span
                key={`${t.name}-${i}-${detail ?? ""}`}
                initial={{ opacity: 0, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-200/90"
              >
                <Globe size={11} className="shrink-0 text-indigo-300/80" />
                <span className="shrink-0 font-medium">{verb}</span>
                {detail && (
                  <span className="truncate text-indigo-200/60">{detail}</span>
                )}
              </motion.span>
            );
          })}
        </div>
      )}

      {hasThinking && (
        <div className="overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-950/40">
          <button
            type="button"
            onClick={() => {
              setTouched(true);
              setOpen(!effectiveOpen);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-900/50"
          >
            <Brain
              size={13}
              className={cn(
                "shrink-0 text-amber-400/80",
                auto && "animate-pulse",
              )}
            />
            <span className="flex-1 font-mono text-[11px] tracking-wide text-zinc-500 uppercase">
              {auto ? "Reasoning" : "Thought process"}
            </span>
            <ChevronRight
              size={14}
              className={cn(
                "shrink-0 text-zinc-600 transition-transform",
                effectiveOpen && "rotate-90",
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {effectiveOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="scrollbar-thin max-h-72 overflow-y-auto border-t border-zinc-800/60 px-3 py-2.5">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-500">
                    {thinking}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
