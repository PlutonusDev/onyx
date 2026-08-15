"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Copy, PanelRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { isPreviewable } from "@/lib/runner";
import { cn } from "@/lib/utils";
import Mermaid from "./Mermaid";

/** Recursively pull the text out of a react-markdown code node. */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return textOf(props?.children);
  }
  return "";
}

export default function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { openCanvas } = useStore();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // react-markdown puts the language on the inner <code> as `language-xxx`.
  const langMatch = /language-([\w+#-]+)/.exec(
    (typeof children === "object" &&
      children !== null &&
      "props" in children &&
      ((children as { props?: { className?: string } }).props?.className ?? "")) ||
      "",
  );
  const language = langMatch?.[1] ?? "text";
  const text = textOf(children).replace(/\n$/, "");

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(preRef.current?.innerText ?? text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked (insecure origin / permission) — fail quietly */
    }
  }, [text]);

  const toCanvas = useCallback(() => {
    openCanvas({ title: `${language} snippet`, language, code: text });
  }, [language, text, openCanvas]);

  // Diagrams render instead of showing source (hooks above must run first).
  if (language.toLowerCase() === "mermaid") {
    return <Mermaid code={text} />;
  }

  const canOpen = isPreviewable(language) || text.split("\n").length > 6;

  return (
    <div className="group/code relative my-4 overflow-hidden rounded-xl border border-zinc-800 bg-[#0b0b0e]">
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/40 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          {language}
        </span>
        <div className="flex items-center gap-1">
          {canOpen && (
            <button
              type="button"
              onClick={toCanvas}
              aria-label="Open in Canvas"
              className="flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 font-mono text-[11px] text-zinc-500 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none"
            >
              <PanelRight size={12} />
              Canvas
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy code"}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1",
              "font-mono text-[11px] text-zinc-500 transition-colors",
              "hover:border-zinc-700 hover:bg-zinc-800/60 hover:text-zinc-200",
              "focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:outline-none",
              copied && "text-emerald-400",
            )}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre
        ref={preRef}
        className={cn("scrollbar-thin overflow-x-auto p-4", className)}
      >
        {children}
      </pre>
    </div>
  );
}
