"use client";

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { useStore } from "@/lib/store";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/models";
import Modal from "./Modal";

export default function SystemPromptModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { systemPrompt, setSystemPrompt } = useStore();
  const [draft, setDraft] = useState(systemPrompt);

  // Re-seed the draft on each open without an effect (see AuthModal).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(systemPrompt);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="System prompt"
      description="Prepended to every request in every conversation. Saved to localStorage."
      footer={
        <>
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_SYSTEM_PROMPT)}
            className="mr-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
          >
            <RotateCcw size={13} />
            Reset to default
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setSystemPrompt(draft);
              onClose();
            }}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
          >
            <Save size={13} />
            Save
          </button>
        </>
      }
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={10}
        spellCheck={false}
        placeholder="You are a helpful assistant…"
        className="scrollbar-thin min-h-[220px] w-full resize-y rounded-lg border border-zinc-800 bg-black p-3 font-mono text-[13px] leading-relaxed text-zinc-200 placeholder:text-zinc-700 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
      />
      <p className="mt-2 text-right font-mono text-[11px] text-zinc-600">
        {draft.length.toLocaleString()} chars
      </p>
    </Modal>
  );
}
