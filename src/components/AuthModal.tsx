"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Loader2, RefreshCw, ShieldCheck, Terminal } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import Modal from "./Modal";

function CopyLine({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-zinc-800 bg-black px-3 py-2">
      <span className="shrink-0 font-mono text-[11px] text-zinc-700 select-none">$</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-amber-300">
        {command}
      </code>
      <button
        type="button"
        aria-label="Copy command"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
      >
        <motion.span
          key={copied ? "y" : "n"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 600, damping: 22 }}
          className={cn("block", copied && "text-emerald-400")}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </motion.span>
      </button>
    </div>
  );
}

export default function AuthModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { authState, authMessage, refreshAuth } = useStore();
  const [busy, setBusy] = useState(false);

  const recheck = async () => {
    setBusy(true);
    const ok = await refreshAuth();
    setBusy(false);
    if (ok) onClose();
  };

  const tone =
    authState === "ready"
      ? "text-emerald-400"
      : authState === "checking"
        ? "text-zinc-500"
        : "text-amber-400";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sign in"
      description="Uses the subscription login already on this machine. No API key, and no credential is ever stored in the browser or sent from it."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
          >
            Close
          </button>
          <button
            type="button"
            onClick={recheck}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            Re-check
          </button>
        </>
      }
    >
      <div
        className={cn(
          "mb-5 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs",
          authState === "ready"
            ? "border-emerald-900/60 bg-emerald-950/20"
            : "border-zinc-800 bg-zinc-900/40",
        )}
      >
        {authState === "ready" ? (
          <ShieldCheck size={15} className="shrink-0 text-emerald-400" />
        ) : authState === "checking" ? (
          <Loader2 size={15} className="shrink-0 animate-spin text-zinc-500" />
        ) : (
          <Terminal size={15} className="shrink-0 text-amber-400" />
        )}
        <span className={cn("min-w-0 flex-1", tone)}>{authMessage}</span>
      </div>

      {authState !== "ready" && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
              1 · Install the runtime
            </p>
            <CopyLine command="npm install -g @anthropic-ai/claude-code" />
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
              2 · Sign in with your subscription
            </p>
            <CopyLine command="claude" />
            <p className="mt-1.5 text-[11px] text-zinc-600">
              Launch it once and complete the browser login. Credentials are
              stored under{" "}
              <code className="font-mono text-zinc-500">~/.claude</code>.
            </p>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
              3 · Re-check
            </p>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Press <span className="text-zinc-400">Re-check</span> below once the
              login completes.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 text-[11px] leading-relaxed text-zinc-500">
        <p>
          <span className="text-zinc-400">Local only.</span> The login lives on
          this machine, so this works when you run the app yourself — not on a
          deployed instance.
        </p>
        <p>
          Conversations draw on your existing subscription allowance. No API key
          and no separate API billing.
        </p>
      </div>
    </Modal>
  );
}
