"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  Command,
  Download,
  FileJson,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { exportJson, exportMarkdown } from "@/lib/export";
import { panelIn, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import Composer from "./Composer";
import Glyph from "./Glyph";
import MessageItem from "./MessageItem";
import ModelSelector from "./ModelSelector";

const SUGGESTIONS = [
  "Explain the tradeoffs of optimistic vs pessimistic locking",
  "Write a debounce hook in TypeScript with cleanup",
  "Derive the closed form of the Fibonacci sequence",
  "Review this schema for normalization problems",
];

function ExportMenu() {
  const { activeChat } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const empty = !activeChat || activeChat.messages.length === 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={empty}
        aria-label="Export chat"
        className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Download size={14} />
      </button>

      <AnimatePresence>
        {open && activeChat && (
          <motion.div
            variants={panelIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute right-0 z-40 mt-2 w-44 origin-top-right overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-md"
          >
            <button
              type="button"
              onClick={() => {
                exportMarkdown(activeChat);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <FileText size={13} className="text-zinc-500" />
              Export Markdown
            </button>
            <button
              type="button"
              onClick={() => {
                exportJson(activeChat);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <FileJson size={13} className="text-zinc-500" />
              Export JSON
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ChatArea({
  onToggleSidebar,
  sidebarOpen,
  onOpenPalette,
  onNeedKey,
}: {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onOpenPalette: () => void;
  onNeedKey: () => void;
}) {
  const { activeChat, streaming, regenerate, sendMessage, authReady } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const pinnedRef = useRef(true);

  const messages = activeChat?.messages ?? [];
  const activeId = activeChat?.id;
  const lastId = messages.at(-1)?.id;

  const setPin = useCallback((v: boolean) => {
    pinnedRef.current = v;
    setPinned(v);
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPin(distance < 140);
  }, [setPin]);

  // Follow the growing content by observing the DOM directly rather than the
  // message string length. The rendered height lags the raw text (smoothing,
  // per-word fade reflow, images), so tracking actual size is what keeps the
  // tail in view instead of letting it slip below the fold.
  useEffect(() => {
    const view = scrollRef.current;
    const content = contentRef.current;
    if (!view || !content) return;

    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) view.scrollTop = view.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  // Switching conversations, or a brand-new turn, re-pins to the bottom even
  // if the user had scrolled up. The ref is set synchronously (the observer
  // reads it immediately); the state write is deferred a frame to keep it out
  // of the effect body.
  useEffect(() => {
    pinnedRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const raf = requestAnimationFrame(() => setPinned(true));
    return () => cancelAnimationFrame(raf);
  }, [activeId, lastId]);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setPin(true);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="relative flex items-center gap-2 border-b border-zinc-900/80 bg-black/50 px-3 py-2.5 backdrop-blur-xl sm:px-5">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-1.5 text-zinc-500 transition-colors hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
        >
          {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        </button>

        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-400">
          {activeChat?.title ?? "New Chat"}
        </h1>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Palette trigger — the discoverable surface for every shortcut. */}
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Open command palette"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-2 py-1.5 text-zinc-500 transition-colors hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
          >
            <Command size={13} />
            <kbd className="hidden font-mono text-[10px] tracking-wide sm:inline">
              Ctrl K
            </kbd>
          </button>
          <ExportMenu />
          <ModelSelector />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="scrollbar-thin h-full overflow-y-auto overscroll-contain"
        >
          <div ref={contentRef}>
          {messages.length === 0 ? (
            <div className="flex min-h-[calc(100dvh-9rem)] flex-col items-center justify-center px-6 py-16 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.88, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="relative mb-5 flex size-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40 text-amber-400 backdrop-blur-sm"
              >
                <div className="absolute inset-0 rounded-2xl bg-amber-500/10 blur-xl" />
                <Glyph className="relative size-7" />
              </motion.div>
              <h2 className="bg-gradient-to-b from-zinc-100 to-zinc-500 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
                {authReady ? "What are we working on?" : "Sign in to begin"}
              </h2>

              {authReady && (
                <button
                  type="button"
                  onClick={onOpenPalette}
                  className="mt-6 font-mono text-[10px] tracking-wider text-zinc-700 uppercase transition-colors hover:text-zinc-500"
                >
                  Press Ctrl+K for commands
                </button>
              )}

              {!authReady && (
                <button
                  type="button"
                  onClick={onNeedKey}
                  className="mt-6 rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
                >
                  Set up sign-in
                </button>
              )}
            </div>
          ) : (
            <motion.div
              // Re-keying on the chat id replays the stagger when the user
              // switches conversations, so the swap reads as a transition.
              key={activeChat?.id}
              variants={stagger(0.045)}
              initial="hidden"
              animate="show"
              className="mx-auto w-full max-w-3xl py-4"
            >
              {messages.map((m, i) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  streaming={streaming}
                  isLast={i === messages.length - 1}
                  onRegenerate={() => void regenerate()}
                />
              ))}
              {/* Small tail so the last turn's action row isn't flush against
                  the composer. */}
              <div className="h-6" />
            </motion.div>
          )}
          </div>
        </div>

        <AnimatePresence>
          {!pinned && messages.length > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={scrollToBottom}
              aria-label="Scroll to latest"
              className={cn(
                "absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-zinc-700",
                "bg-zinc-900/90 p-2 text-zinc-300 shadow-lg shadow-black/50 backdrop-blur-md",
                "transition-colors hover:border-amber-500/50 hover:text-amber-400",
              )}
            >
              <ArrowDown size={15} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <Composer onNeedKey={onNeedKey} />
    </div>
  );
}
