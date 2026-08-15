"use client";

import { useCallback, useSyncExternalStore } from "react";
import { uid } from "./utils";

/**
 * A slash command expands into a prompt template. `{{input}}` (or a trailing
 * position) is where the user's own text after the command goes.
 */
export interface SlashCommand {
  id: string;
  /** The trigger typed after "/", e.g. "explain". Lowercase, no spaces. */
  name: string;
  description: string;
  template: string;
  builtin?: boolean;
}

const STORAGE = "ct.commands";

export const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    id: "b-explain",
    name: "explain",
    description: "Explain something clearly, from first principles",
    template:
      "Explain the following clearly and from first principles, assuming I'm smart but new to it:\n\n{{input}}",
    builtin: true,
  },
  {
    id: "b-improve",
    name: "improve",
    description: "Rewrite text to be tighter and clearer",
    template:
      "Rewrite the following to be tighter, clearer, and better. Keep my voice; don't pad it:\n\n{{input}}",
    builtin: true,
  },
  {
    id: "b-code",
    name: "code",
    description: "Write code for a task, production quality",
    template:
      "Write clean, production-quality code for this. Explain the key decisions briefly after the code:\n\n{{input}}",
    builtin: true,
  },
  {
    id: "b-debug",
    name: "debug",
    description: "Find the bug and explain the fix",
    template:
      "Find the bug in this and explain the fix. Show the corrected version:\n\n{{input}}",
    builtin: true,
  },
  {
    id: "b-summarize",
    name: "summarize",
    description: "Summarize to the essentials",
    template:
      "Summarize this to its essentials — the points that actually matter, nothing filler:\n\n{{input}}",
    builtin: true,
  },
  {
    id: "b-eli5",
    name: "eli5",
    description: "Explain like I'm five",
    template: "Explain this like I'm five, with a simple analogy:\n\n{{input}}",
    builtin: true,
  },
];

/* --------------------------------------------------------- persistence store */

function readCustom(): SlashCommand[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SlashCommand[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();
let cache: SlashCommand[] | null = null;

function getSnapshot(): SlashCommand[] {
  if (cache === null) cache = readCustom();
  return cache;
}

function emit() {
  cache = null;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function writeCustom(next: SlashCommand[]) {
  localStorage.setItem(STORAGE, JSON.stringify(next));
  emit();
}

const EMPTY: SlashCommand[] = [];

/** Slash commands (built-ins + user-defined) with CRUD for the custom ones. */
export function useCommands() {
  const custom = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const all = [...BUILTIN_COMMANDS, ...custom];

  const add = useCallback((cmd: Omit<SlashCommand, "id" | "builtin">) => {
    const clean: SlashCommand = {
      id: uid(),
      name: cmd.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""),
      description: cmd.description.trim(),
      template: cmd.template,
    };
    if (!clean.name || !clean.template.trim()) return;
    writeCustom([...readCustom(), clean]);
  }, []);

  const update = useCallback((id: string, patch: Partial<SlashCommand>) => {
    writeCustom(
      readCustom().map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }, []);

  const remove = useCallback((id: string) => {
    writeCustom(readCustom().filter((c) => c.id !== id));
  }, []);

  return { all, custom, add, update, remove };
}

/** Fill a command's template with the user's text. */
export function expandCommand(cmd: SlashCommand, input: string): string {
  const text = input.trim();
  if (cmd.template.includes("{{input}}")) {
    return cmd.template.replace(/\{\{input\}\}/g, text).trim();
  }
  return text ? `${cmd.template}\n\n${text}`.trim() : cmd.template.trim();
}

/**
 * Parse a composer value that begins with a slash command.
 * Returns the matched trigger token and the remaining text, or null.
 */
export function parseSlash(
  value: string,
): { token: string; rest: string } | null {
  const m = /^\/([a-z0-9-]*)\s?([\s\S]*)$/i.exec(value);
  if (!m) return null;
  return { token: m[1].toLowerCase(), rest: m[2] ?? "" };
}
