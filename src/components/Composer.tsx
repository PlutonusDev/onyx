"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Square } from "lucide-react";
import { useStore } from "@/lib/store";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const MAX_HEIGHT = 220;

export default function Composer({ onNeedKey }: { onNeedKey: () => void }) {
  const { sendMessage, stopStreaming, streaming, authReady, activeId } = useStore();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const ready = value.trim().length > 0;

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  useEffect(resize, [value, resize]);

  // Autofocus on load and whenever the user switches conversations.
  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) ref.current?.focus();
  }, [activeId]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || streaming) return;
    if (!authReady) {
      onNeedKey();
      return;
    }
    setValue("");
    void sendMessage(text);
    requestAnimationFrame(() => ref.current?.focus());
  }, [authReady, onNeedKey, sendMessage, streaming, value]);

  return (
    <div className="bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
      <div className="mx-auto w-full max-w-3xl">
        <div
          className={cn(
            "group relative flex items-end gap-2 rounded-2xl border bg-zinc-900/40 p-2 backdrop-blur-xl transition-all duration-200",
            "border-zinc-800 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)]",
            "focus-within:border-amber-500/40 focus-within:shadow-[0_8px_40px_-8px_rgba(251,191,36,0.12)]",
          )}
        >
          {/* Hairline highlight along the top edge, brightening on focus. */}
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent transition-colors group-focus-within:via-amber-500/40" />

          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={authReady ? "Send a message…" : "Sign in to start…"}
            aria-label="Message"
            className="scrollbar-thin max-h-[220px] min-h-[24px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[0.9375rem] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />

          <AnimatePresence mode="wait" initial={false}>
            {streaming ? (
              <motion.button
                key="stop"
                type="button"
                onClick={stopStreaming}
                aria-label="Stop generating"
                initial={{ scale: 0.6, opacity: 0, rotate: -90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: 90 }}
                transition={spring}
                whileTap={{ scale: 0.9 }}
                className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-200 transition-colors hover:border-red-500/50 hover:bg-red-950/50 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:outline-none"
              >
                {/* Ring pulses outward while generation is in flight. */}
                <motion.span
                  className="absolute inset-0 rounded-xl border border-amber-500/50"
                  animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                />
                <Square size={12} fill="currentColor" className="relative" />
              </motion.button>
            ) : (
              <motion.button
                key="send"
                type="button"
                onClick={submit}
                disabled={ready === false}
                aria-label="Send message"
                initial={{ scale: 0.6, opacity: 0, rotate: 90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: -90 }}
                transition={spring}
                whileHover={ready ? { scale: 1.06 } : undefined}
                whileTap={ready ? { scale: 0.9 } : undefined}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-black shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none"
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-2 hidden text-center font-mono text-[10px] text-zinc-700 sm:block">
          <kbd className="text-zinc-600">Enter</kbd> send ·{" "}
          <kbd className="text-zinc-600">Shift+Enter</kbd> newline ·{" "}
          <kbd className="text-zinc-600">Ctrl+K</kbd> commands ·{" "}
          <kbd className="text-zinc-600">Ctrl+B</kbd> sidebar
        </p>
      </div>
    </div>
  );
}
