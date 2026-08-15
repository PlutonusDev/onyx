"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  KeyRound,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  PanelLeftClose,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn, formatRelative } from "@/lib/utils";

/** Sign-in prompt, shown only when there's actually something to resolve. */
function KeyPill({ onOpenKey }: { onOpenKey: () => void }) {
  const { authState } = useStore();
  // Nothing to show once signed in — the badge is intentionally absent.
  if (authState === "ready" || authState === "checking") return null;

  const label =
    authState === "cli-missing"
      ? "Set up sign-in"
      : authState === "error"
        ? "Credential error"
        : "Not signed in";

  return (
    <button
      type="button"
      onClick={onOpenKey}
      className="group flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-left text-xs text-amber-200/90 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
    >
      <KeyRound size={13} className="shrink-0 text-amber-400/70" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <kbd className="hidden shrink-0 font-mono text-[9px] text-amber-200/40 group-hover:inline">
        Ctrl+Shift+K
      </kbd>
    </button>
  );
}

function ChatRow({
  id,
  title,
  updatedAt,
  count,
  active,
  onSelect,
}: {
  id: string;
  title: string;
  updatedAt: number;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  const { renameChat, deleteChat } = useStore();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  // Seed the rename draft when entering edit mode, during render rather than
  // in an effect (avoids a cascading re-render).
  const [wasEditing, setWasEditing] = useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (editing) setDraft(title);
  }

  const commit = () => {
    renameChat(id, draft);
    setEditing(false);
  };

  return (
    <div ref={rowRef} className="group/row relative">
      {editing ? (
        <div className="flex items-center gap-1 rounded-lg border border-amber-500/50 bg-zinc-900 px-2 py-1.5">
          <input
            // Callback ref: the input only exists while editing, so this runs
            // exactly once per edit session.
            ref={(el) => el?.select()}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={commit}
            className="min-w-0 flex-1 bg-transparent text-xs text-zinc-100 outline-none"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            aria-label="Save title"
            className="shrink-0 rounded p-0.5 text-emerald-400 hover:bg-zinc-800"
          >
            <Check size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
            active
              ? "bg-zinc-800/80 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-200",
          )}
        >
          <MessageSquare
            size={13}
            className={cn("shrink-0", active ? "text-amber-400" : "text-zinc-600")}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{title}</span>
            <span className="block truncate text-[10px] text-zinc-600">
              {formatRelative(updatedAt)} · {count} msg{count === 1 ? "" : "s"}
            </span>
          </span>
        </button>
      )}

      {!editing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenu((v) => !v);
          }}
          aria-label="Chat options"
          className={cn(
            "reveal-on-hover absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-1.5 text-zinc-600 transition-all",
            "hover:bg-zinc-700/70 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none",
            menu ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 focus:opacity-100",
          )}
        >
          <MoreHorizontal size={14} />
        </button>
      )}

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-1 z-30 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/95 p-1 shadow-xl shadow-black/60 backdrop-blur-md"
          >
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setEditing(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <Pencil size={12} />
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                void deleteChat(id);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-950/50"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Sidebar({
  onClose,
  onCollapse,
  onOpenKey,
  onOpenSystem,
  searchRef,
}: {
  onClose?: () => void;
  onCollapse?: () => void;
  onOpenKey: () => void;
  onOpenSystem: () => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const { chats, activeId, setActiveId, newChat } = useStore();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [chats, query]);

  return (
    <div className="flex h-full flex-col border-r border-zinc-900 bg-[#09090b]/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.18em] text-zinc-600 uppercase">
            Conversations
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Collapse sidebar"
              className="hidden rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none lg:block"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 lg:hidden"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            newChat();
            onClose?.();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-amber-500/40 hover:bg-zinc-800/80 hover:text-white focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
        >
          <Plus size={14} />
          New chat
          <kbd className="ml-1 hidden rounded border border-zinc-700 px-1 font-mono text-[9px] text-zinc-500 sm:inline">
            Ctrl+Shift+O
          </kbd>
        </button>

        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-600"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder="Search chats…"
            aria-label="Search conversations"
            className="w-full rounded-lg border border-zinc-800/80 bg-black py-1.5 pr-7 pl-8 text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-zinc-600 hover:text-zinc-300"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-zinc-700">
            {query ? "No matching conversations." : "No conversations yet."}
          </p>
        ) : (
          filtered.map((c) => (
            <ChatRow
              key={c.id}
              id={c.id}
              title={c.title}
              updatedAt={c.updatedAt}
              count={c.messages.length}
              active={c.id === activeId}
              onSelect={() => {
                setActiveId(c.id);
                onClose?.();
              }}
            />
          ))
        )}
      </div>

      <div className="space-y-1.5 border-t border-zinc-900 p-3">
        <KeyPill onOpenKey={onOpenKey} />
        <button
          type="button"
          onClick={onOpenSystem}
          className="group flex w-full items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-2.5 py-2 text-left text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
        >
          <SlidersHorizontal size={13} className="shrink-0 text-zinc-600" />
          <span className="min-w-0 flex-1 truncate">System prompt</span>
          <kbd className="hidden shrink-0 font-mono text-[9px] whitespace-nowrap text-zinc-700 group-hover:inline">
            Ctrl+Shift+P
          </kbd>
        </button>
      </div>
    </div>
  );
}
