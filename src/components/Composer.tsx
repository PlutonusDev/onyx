"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, FileText, Paperclip, Slash, Square, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCommands, parseSlash, expandCommand } from "@/lib/commands";
import type { Attachment } from "@/lib/db";
import { spring } from "@/lib/motion";
import { cn, uid } from "@/lib/utils";

const MAX_HEIGHT = 220;
const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
const OK_IMAGE = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function readFile(file: File): Promise<Attachment | null> {
  const isImage = OK_IMAGE.includes(file.type);
  const isPdf = file.type === "application/pdf";
  if ((!isImage && !isPdf) || file.size > MAX_BYTES) return Promise.resolve(null);
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () =>
      resolve({
        id: uid(),
        kind: isPdf ? "pdf" : "image",
        name: file.name || (isPdf ? "document.pdf" : "image"),
        mediaType: file.type,
        dataUrl: String(fr.result),
        size: file.size,
      });
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(file);
  });
}

export default function Composer({ onNeedKey }: { onNeedKey: () => void }) {
  const { sendMessage, stopStreaming, streaming, authReady, activeId } = useStore();
  const { all: commands } = useCommands();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = value.trim().length > 0 || attachments.length > 0;

  // Slash-command menu: open while the field is a single-line "/token" prefix.
  const slash = parseSlash(value);
  const slashMatches = useMemo(() => {
    if (!slash || value.includes("\n")) return [];
    return commands.filter((c) => c.name.startsWith(slash.token)).slice(0, 6);
  }, [slash, value, commands]);
  const slashOpen = value.startsWith("/") && slashMatches.length > 0;

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, []);
  useEffect(resize, [value, resize]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) ref.current?.focus();
  }, [activeId]);

  // Reset the highlighted command when the typed token changes (during render,
  // not an effect, to avoid a cascading update).
  const [prevToken, setPrevToken] = useState(slash?.token);
  if (slash?.token !== prevToken) {
    setPrevToken(slash?.token);
    setSlashIndex(0);
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const parsed = await Promise.all(Array.from(files).map(readFile));
    const valid = parsed.filter((a): a is Attachment => a !== null);
    if (valid.length) setAttachments((prev) => [...prev, ...valid].slice(0, MAX_FILES));
  }, []);

  const acceptCommand = useCallback(
    (index: number) => {
      const cmd = slashMatches[index];
      if (!cmd || !slash) return;
      setValue(expandCommand(cmd, slash.rest));
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) {
          el.focus();
          el.selectionStart = el.selectionEnd = el.value.length;
        }
      });
    },
    [slashMatches, slash],
  );

  const submit = useCallback(() => {
    if (!ready || streaming) return;
    if (!authReady) {
      onNeedKey();
      return;
    }
    const text = value;
    const files = attachments;
    setValue("");
    setAttachments([]);
    void sendMessage(text, files);
    requestAnimationFrame(() => ref.current?.focus());
  }, [ready, streaming, authReady, onNeedKey, value, attachments, sendMessage]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        acceptCommand(slashIndex);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative">
          {/* Slash-command menu */}
          <AnimatePresence>
            {slashOpen && (
              <motion.ul
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.14 }}
                className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-md overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-md"
              >
                {slashMatches.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseMove={() => setSlashIndex(i)}
                      onClick={() => acceptCommand(i)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        i === slashIndex ? "bg-zinc-800/80" : "hover:bg-zinc-900/60",
                      )}
                    >
                      <Slash size={12} className="shrink-0 text-amber-400/80" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-xs text-zinc-200">/{c.name}</span>
                        <span className="block truncate text-[11px] text-zinc-500">{c.description}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "group relative flex flex-col gap-2 rounded-2xl border bg-zinc-900/40 p-2 backdrop-blur-xl transition-all duration-200",
              "border-zinc-800 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)]",
              "focus-within:border-amber-500/40 focus-within:shadow-[0_8px_40px_-8px_rgba(251,191,36,0.12)]",
              dragOver && "border-amber-500/60 bg-amber-500/5",
            )}
          >
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1 pt-1">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="group/att relative flex items-center gap-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 py-1 pr-6 pl-1"
                  >
                    {a.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.dataUrl} alt={a.name} className="size-8 rounded object-cover" />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded bg-red-950/40 text-red-300">
                        <FileText size={15} />
                      </span>
                    )}
                    <span className="max-w-[9rem] truncate text-[11px] text-zinc-400">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}
                      aria-label={`Remove ${a.name}`}
                      className="absolute top-1 right-1 rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-200"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent transition-colors group-focus-within:via-amber-500/40" />

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach image or PDF"
                className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
              >
                <Paperclip size={17} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              <textarea
                ref={ref}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files);
                  if (files.length) {
                    e.preventDefault();
                    void addFiles(files);
                  }
                }}
                rows={1}
                placeholder={authReady ? "Send a message…  (/ for commands)" : "Sign in to start…"}
                aria-label="Message"
                className="scrollbar-thin max-h-[220px] min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1.5 text-[0.9375rem] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
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
                    disabled={!ready}
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
          </div>
        </div>

        <p className="mt-2 hidden text-center font-mono text-[10px] text-zinc-700 sm:block">
          <kbd className="text-zinc-600">Enter</kbd> send ·{" "}
          <kbd className="text-zinc-600">Shift+Enter</kbd> newline ·{" "}
          <kbd className="text-zinc-600">/</kbd> commands ·{" "}
          <kbd className="text-zinc-600">Ctrl+K</kbd> palette
        </p>
      </div>
    </div>
  );
}
