"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Pencil,
  RefreshCw,
  User,
} from "lucide-react";
import type { ChatMessage } from "@/lib/db";
import { extractSources } from "@/lib/citations";
import { messageIn, spring } from "@/lib/motion";
import { useSmoothText } from "@/lib/useSmoothText";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import Glyph from "./Glyph";
import Markdown from "./Markdown";
import ThinkingIndicator from "./ThinkingIndicator";
import ThinkingPane from "./ThinkingPane";

function MessageItemImpl({
  message,
  streaming,
  isLast,
  onRegenerate,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const { setRevealing, editMessage } = useStore();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }, [message.content]);

  // `live` = this specific turn is the one currently generating.
  const live = streaming && isLast && !isUser;
  const text = useSmoothText(message.content, live);

  // The newest assistant turn tells the store whether its text is still
  // revealing — including the drain after the stream ends — so the ambient
  // field holds "answering" until the words have actually landed.
  const revealing =
    !isUser && isLast && text.length < message.content.length;
  useEffect(() => {
    if (isUser || !isLast) return;
    // Deferred so it isn't a synchronous setState inside the effect body.
    const id = requestAnimationFrame(() => setRevealing(revealing));
    return () => {
      cancelAnimationFrame(id);
      // Releasing the "live" role (new turn, chat switch, unmount) clears the
      // signal; the next live message re-asserts it on its own frame.
      setRevealing(false);
    };
  }, [revealing, isUser, isLast, setRevealing]);
  const hasThinkingOrTools =
    Boolean(message.thinking?.trim()) || Boolean(message.tools?.length);
  // Show the oracle glyph only before anything at all has arrived — thinking,
  // a tool call, or answer text all replace it.
  const pending = live && text.length === 0 && !hasThinkingOrTools;

  const sources = useMemo(
    () => (!isUser && !live ? extractSources(message.content) : []),
    [isUser, live, message.content],
  );

  const startEdit = useCallback(() => {
    setEditText(message.content);
    setEditing(true);
  }, [message.content]);

  const saveEdit = useCallback(() => {
    setEditing(false);
    if (editText.trim() && editText !== message.content) {
      void editMessage(message.id, editText);
    }
  }, [editText, message.content, message.id, editMessage]);

  return (
    <motion.div
      layout="position"
      variants={messageIn}
      initial="hidden"
      animate="show"
      transition={spring}
      className={cn("group/msg flex gap-3 px-4 py-3 sm:gap-4 sm:px-6", isUser && "justify-end")}
    >
      {!isUser && (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-900/50 text-amber-400/90">
          <Glyph className="size-3.5" />
        </div>
      )}

      <div className={cn("min-w-0", isUser ? "max-w-[85%] sm:max-w-[75%]" : "flex-1")}>
        {isUser ? (
          <div className="flex flex-col items-end gap-1.5">
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2">
                {message.attachments.map((a) =>
                  a.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={a.id}
                      src={a.dataUrl}
                      alt={a.name}
                      className="max-h-44 max-w-[12rem] rounded-xl border border-zinc-800 object-cover"
                    />
                  ) : (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300"
                    >
                      <FileText size={14} className="text-red-300" />
                      <span className="max-w-[10rem] truncate">{a.name}</span>
                    </div>
                  ),
                )}
              </div>
            )}

            {editing ? (
              <div className="w-full min-w-[16rem] rounded-2xl border border-amber-500/40 bg-zinc-900/80 p-2">
                <textarea
                  ref={(el) => el?.focus()}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      saveEdit();
                    }
                    if (e.key === "Escape") setEditing(false);
                  }}
                  rows={Math.min(8, editText.split("\n").length + 1)}
                  className="scrollbar-thin w-full resize-none bg-transparent px-2 py-1 text-[0.9375rem] leading-relaxed text-zinc-100 focus:outline-none"
                />
                <div className="mt-1 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-md px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-black transition-colors hover:bg-amber-400"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              message.content && (
                <div className="rounded-2xl rounded-tr-md border border-zinc-800/70 bg-zinc-900/60 px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-zinc-200">
                  {message.content}
                </div>
              )
            )}

            {!editing && !streaming && (
              <div className="reveal-on-hover flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label="Edit and resend"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-zinc-500 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
                >
                  <Pencil size={12} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={copy}
                  aria-label="Copy message"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-zinc-500 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="min-w-0">
            {pending ? (
              <ThinkingIndicator />
            ) : (
              <>
                <ThinkingPane
                  thinking={message.thinking}
                  tools={message.tools}
                  streaming={live}
                  hasAnswer={text.length > 0}
                />
                {text.length > 0 && (
                  <div className={cn(live && "live")}>
                    <Markdown content={text} live={live} />
                  </div>
                )}
                {/* A tool ran but no reasoning or answer is streaming yet —
                    keep the pulse rather than a blank gap. */}
                {live && text.length === 0 && !message.thinking?.trim() && (
                  <div className="mt-1">
                    <ThinkingIndicator label="Composing" />
                  </div>
                )}
              </>
            )}

            <AnimatePresence>
              {message.error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 break-words">{message.error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!streaming && message.content.length > 0 && (
              <div className="reveal-on-hover mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={copy}
                  aria-label="Copy message"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-zinc-500 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={copied ? "done" : "idle"}
                      initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 600, damping: 22 }}
                      className={cn("flex", copied && "text-emerald-400")}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </motion.span>
                  </AnimatePresence>
                  {copied ? "Copied" : "Copy"}
                </button>
                {isLast && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    aria-label="Regenerate response"
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-zinc-500 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
                  >
                    <RefreshCw size={12} />
                    Retry
                  </button>
                )}
              </div>
            )}

            {sources.length > 0 && (
              <div className="mt-3 rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3">
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
                  <Link2 size={12} />
                  Sources
                </div>
                <div className="flex flex-col gap-1">
                  {sources.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/src flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-zinc-800/50"
                    >
                      {/* No external favicon fetch — keeps browsing private. */}
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-zinc-800 text-[9px] font-semibold text-zinc-400 uppercase">
                        {(() => {
                          try {
                            return new URL(s.url).hostname.replace(/^www\./, "")[0];
                          } catch {
                            return "•";
                          }
                        })()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-zinc-300 group-hover/src:text-zinc-100">
                        {s.label}
                      </span>
                      <ExternalLink size={11} className="shrink-0 text-zinc-600" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400">
          <User size={14} />
        </div>
      )}
    </motion.div>
  );
}

export default memo(MessageItemImpl);
