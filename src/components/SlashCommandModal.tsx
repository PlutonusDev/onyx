"use client";

import { useState } from "react";
import { Plus, Slash, Trash2 } from "lucide-react";
import { useCommands } from "@/lib/commands";
import Modal from "./Modal";

export default function SlashCommandModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { custom, add, remove } = useCommands();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("");

  const canAdd = name.trim() && template.trim();

  const submit = () => {
    if (!canAdd) return;
    add({ name, description, template });
    setName("");
    setDescription("");
    setTemplate("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Slash commands"
      description="Type / in the composer to run these. Use {{input}} in a template for the text you type after the command."
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100"
        >
          Done
        </button>
      }
    >
      {custom.length > 0 && (
        <div className="mb-5 space-y-1.5">
          <p className="mb-1 font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
            Your commands
          </p>
          {custom.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2"
            >
              <Slash size={12} className="shrink-0 text-amber-400/80" />
              <div className="min-w-0 flex-1">
                <span className="block font-mono text-xs text-zinc-200">/{c.name}</span>
                <span className="block truncate text-[11px] text-zinc-500">
                  {c.description || c.template}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label={`Delete /${c.name}`}
                className="shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-red-950/40 hover:text-red-300"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-3">
        <p className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
          New command
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-zinc-600">/</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            spellCheck={false}
            className="w-32 rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-amber-500/50 focus:outline-none"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="short description"
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-700 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="Prompt template. Use {{input}} for your text."
          rows={3}
          className="scrollbar-thin w-full resize-y rounded-lg border border-zinc-800 bg-black p-2.5 font-mono text-[13px] text-zinc-200 placeholder:text-zinc-700 focus:border-amber-500/50 focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={!canAdd}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={13} />
            Add command
          </button>
        </div>
      </div>
    </Modal>
  );
}
