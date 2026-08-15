"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Cpu,
  FileJson,
  FileText,
  KeyRound,
  MessageSquare,
  PanelLeft,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { MODELS } from "@/lib/models";
import { exportJson, exportMarkdown } from "@/lib/export";
import { listItemIn, panelIn, stagger } from "@/lib/motion";
import { cn, formatRelative } from "@/lib/utils";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  keywords?: string;
  selected?: boolean;
  danger?: boolean;
  run: () => void;
}

/** Subsequence match — "nc" hits "New chat". Returns null when it doesn't fit. */
function score(needle: string, haystack: string): number | null {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();

  const direct = h.indexOf(n);
  if (direct !== -1) return direct === 0 ? 1000 : 700 - direct;

  let hi = 0;
  let matched = 0;
  let streak = 0;
  let best = 0;
  for (const ch of n) {
    const at = h.indexOf(ch, hi);
    if (at === -1) return null;
    streak = at === hi ? streak + 1 : 0;
    best = Math.max(best, streak);
    hi = at + 1;
    matched++;
  }
  return matched * 10 + best * 5;
}

export default function CommandPalette({
  open,
  onClose,
  onOpenKey,
  onOpenSystem,
  onToggleSidebar,
}: {
  open: boolean;
  onClose: () => void;
  onOpenKey: () => void;
  onOpenSystem: () => void;
  onToggleSidebar: () => void;
}) {
  const {
    chats,
    activeChat,
    activeId,
    setActiveId,
    newChat,
    deleteChat,
    deleteAll,
    model,
    setModel,
  } = useStore();

  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset the query each time the palette opens (during render, not an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }

  const actions: PaletteAction[] = useMemo(() => {
    const list: PaletteAction[] = [
      {
        id: "new-chat",
        label: "New conversation",
        hint: "Ctrl+Shift+O",
        group: "Actions",
        icon: <Plus size={14} />,
        keywords: "create start fresh",
        run: newChat,
      },
      {
        id: "auth",
        label: "Sign in / credentials",
        hint: "Ctrl+Shift+K",
        group: "Actions",
        icon: <KeyRound size={14} />,
        keywords: "auth login token key credential account profile",
        run: onOpenKey,
      },
      {
        id: "system",
        label: "Edit system prompt",
        hint: "Ctrl+Shift+P",
        group: "Actions",
        icon: <SlidersHorizontal size={14} />,
        keywords: "instructions persona behaviour",
        run: onOpenSystem,
      },
      {
        id: "sidebar",
        label: "Toggle sidebar",
        hint: "Ctrl+B",
        group: "Actions",
        icon: <PanelLeft size={14} />,
        keywords: "hide show panel drawer",
        run: onToggleSidebar,
      },
    ];

    for (const m of MODELS) {
      list.push({
        id: `model-${m.id}`,
        label: `Switch to ${m.name}`,
        hint: m.blurb,
        group: "Model",
        icon: <Cpu size={14} />,
        keywords: `model tier ${m.blurb}`,
        selected: m.id === model,
        run: () => setModel(m.id),
      });
    }

    if (activeChat && activeChat.messages.length > 0) {
      list.push(
        {
          id: "export-md",
          label: "Export conversation as Markdown",
          group: "Conversation",
          icon: <FileText size={14} />,
          keywords: "download save md",
          run: () => exportMarkdown(activeChat),
        },
        {
          id: "export-json",
          label: "Export conversation as JSON",
          group: "Conversation",
          icon: <FileJson size={14} />,
          keywords: "download save data",
          run: () => exportJson(activeChat),
        },
      );
    }

    if (activeId) {
      list.push({
        id: "delete-chat",
        label: "Delete this conversation",
        group: "Conversation",
        icon: <Trash2 size={14} />,
        keywords: "remove discard",
        danger: true,
        run: () => void deleteChat(activeId),
      });
    }

    list.push({
      id: "delete-all",
      label: "Delete all conversations",
      group: "Danger",
      icon: <Trash2 size={14} />,
      keywords: "wipe clear reset erase everything",
      danger: true,
      run: () => {
        if (
          window.confirm(
            "Delete every conversation on this device? This cannot be undone.",
          )
        ) {
          void deleteAll();
        }
      },
    });

    return list;
  }, [
    activeChat,
    activeId,
    deleteAll,
    deleteChat,
    model,
    newChat,
    onOpenKey,
    onOpenSystem,
    onToggleSidebar,
    setModel,
  ]);

  const items = useMemo(() => {
    const q = query.trim();

    const ranked = actions
      .map((a) => ({ a, s: score(q, `${a.label} ${a.keywords ?? ""}`) }))
      .filter((r) => r.s !== null)
      .sort((x, y) => (y.s ?? 0) - (x.s ?? 0))
      .map((r) => r.a);

    // Conversations are only worth listing once the user has typed, otherwise
    // they bury the actions.
    const conversations: PaletteAction[] = (
      q
        ? chats
            .map((c) => ({
              c,
              s: Math.max(
                score(q, c.title) ?? -1,
                c.messages.some((m) =>
                  m.content.toLowerCase().includes(q.toLowerCase()),
                )
                  ? 50
                  : -1,
              ),
            }))
            .filter((r) => r.s >= 0)
            .sort((x, y) => y.s - x.s)
            .map((r) => r.c)
        : chats.slice(0, 5)
    ).map((c) => ({
      id: `chat-${c.id}`,
      label: c.title,
      hint: `${formatRelative(c.updatedAt)} · ${c.messages.length} msg${
        c.messages.length === 1 ? "" : "s"
      }`,
      group: q ? "Conversations" : "Recent",
      icon: <MessageSquare size={14} />,
      selected: c.id === activeId,
      run: () => setActiveId(c.id),
    }));

    return [...ranked, ...conversations];
  }, [actions, chats, query, activeId, setActiveId]);

  const clamped = Math.min(cursor, Math.max(items.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${clamped}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [clamped, open]);

  const commit = (item?: PaletteAction) => {
    const target = item ?? items[clamped];
    if (!target) return;
    onClose();
    // Let the palette unmount before the action mutates the view underneath.
    requestAnimationFrame(() => target.run());
  };

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            variants={panelIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="relative z-10 w-full max-w-xl origin-top overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/90 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
          >
            {/* Hairline gradient along the top edge. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

            <div className="flex items-center gap-2.5 border-b border-zinc-800/80 px-4">
              <Search size={15} className="shrink-0 text-zinc-600" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor((c) => (items.length ? (c + 1) % items.length : 0));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) =>
                      items.length ? (c - 1 + items.length) % items.length : 0,
                    );
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    onClose();
                  }
                }}
                placeholder="Search commands and conversations…"
                aria-label="Search commands and conversations"
                className="w-full bg-transparent py-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 sm:block">
                ESC
              </kbd>
            </div>

            <motion.div
              ref={listRef}
              // Re-keying on the query replays the stagger as results change.
              key={query}
              variants={stagger(0.016)}
              initial="hidden"
              animate="show"
              className="scrollbar-thin max-h-[52vh] overflow-y-auto overscroll-contain p-1.5"
            >
              {items.length === 0 ? (
                <p className="px-3 py-10 text-center text-xs text-zinc-700">
                  No matches.
                </p>
              ) : (
                items.map((item, i) => {
                  const header = item.group !== lastGroup ? item.group : null;
                  lastGroup = item.group;
                  const active = i === clamped;

                  return (
                    <motion.div key={item.id} variants={listItemIn}>
                      {header && (
                        <p className="px-2.5 pt-3 pb-1 font-mono text-[10px] tracking-[0.15em] text-zinc-700 uppercase">
                          {header}
                        </p>
                      )}
                      <button
                        type="button"
                        data-index={i}
                        onMouseMove={() => setCursor(i)}
                        onClick={() => commit(item)}
                        className={cn(
                          "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                          !active && "hover:bg-zinc-900/60",
                        )}
                      >
                        {/* Shared-layout cursor slides between rows as you
                            arrow through the list. */}
                        {active && (
                          <motion.span
                            layoutId="palette-cursor"
                            transition={{ type: "spring", stiffness: 700, damping: 42 }}
                            className="absolute inset-0 rounded-lg border border-zinc-700/60 bg-zinc-800/70"
                          />
                        )}
                        <span
                          className={cn(
                            "relative shrink-0 transition-colors",
                            item.danger
                              ? "text-red-400"
                              : active
                                ? "text-amber-400"
                                : "text-zinc-600",
                          )}
                        >
                          {item.icon}
                        </span>
                        <span className="relative min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-[13px]",
                              item.danger ? "text-red-300" : "text-zinc-200",
                            )}
                          >
                            {item.label}
                          </span>
                        </span>
                        {item.selected && (
                          <Check size={13} className="relative shrink-0 text-amber-400" />
                        )}
                        {item.hint && (
                          <span className="relative shrink-0 truncate font-mono text-[10px] text-zinc-600">
                            {item.hint}
                          </span>
                        )}
                      </button>
                    </motion.div>
                  );
                })
              )}
            </motion.div>

            <div className="flex items-center gap-3 border-t border-zinc-800/80 bg-black/40 px-4 py-2 font-mono text-[10px] text-zinc-700">
              <span>↑↓ navigate</span>
              <span>⏎ run</span>
              <span className="ml-auto">{items.length} results</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
