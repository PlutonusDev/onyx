"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, Play, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { jsSandboxDoc, runKindFor, runPython } from "@/lib/runner";
import { cn } from "@/lib/utils";
import Markdown from "./Markdown";
import Mermaid from "./Mermaid";

interface LogLine {
  level: string;
  text: string;
}

const EXT: Record<string, string> = {
  javascript: "js",
  js: "js",
  python: "py",
  py: "py",
  html: "html",
  svg: "svg",
  markdown: "md",
  md: "md",
  mermaid: "mmd",
  typescript: "ts",
  ts: "ts",
  json: "json",
  css: "css",
};

export default function Canvas() {
  const { canvas, closeCanvas, updateCanvasCode } = useStore();
  const open = canvas !== null;

  const language = canvas?.language ?? "text";
  const code = canvas?.code ?? "";
  const kind = runKindFor(language);
  const rendered = kind === "web" || kind === "mermaid" || kind === "markdown";
  const executable = kind === "js" || kind === "python";
  const hasView = rendered || executable;

  const [tab, setTab] = useState<"view" | "code">("view");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [runToken, setRunToken] = useState(0);
  const [copied, setCopied] = useState(false);

  // Reset to the sensible default tab whenever a new artifact opens.
  const [key, setKey] = useState(canvas?.title);
  if (canvas?.title !== key) {
    setKey(canvas?.title);
    setTab(hasView ? "view" : "code");
    setLogs([]);
    setRunToken(0);
  }

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { __onyxLog?: boolean; level?: string; text?: string; __onyxDone?: boolean };
      if (d?.__onyxLog) setLogs((l) => [...l, { level: d.level ?? "log", text: d.text ?? "" }]);
      else if (d?.__onyxDone) setRunning(false);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const run = useCallback(async () => {
    if (kind === "js") {
      setLogs([]);
      setRunning(true);
      setRunToken((t) => t + 1); // remount the sandbox iframe
      return;
    }
    if (kind === "python") {
      setLogs([]);
      setRunning(true);
      setLogs([{ level: "info", text: "Loading Python…" }]);
      const { output, error } = await runPython(code);
      setLogs([
        ...(output ? [{ level: "log", text: output }] : []),
        ...(error ? [{ level: "error", text: error }] : []),
        ...(!output && !error ? [{ level: "info", text: "(no output)" }] : []),
      ]);
      setRunning(false);
    }
  }, [kind, code]);

  const download = useCallback(() => {
    const ext = EXT[language.toLowerCase()] ?? "txt";
    const slug =
      (canvas?.title ?? "artifact").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      "artifact";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [canvas?.title, code, language]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }, [code]);

  const view = useMemo(() => {
    if (kind === "web") {
      return (
        <iframe
          title="preview"
          sandbox="allow-scripts allow-modals"
          srcDoc={code}
          className="h-full w-full border-0 bg-white"
        />
      );
    }
    if (kind === "mermaid") {
      return (
        <div className="p-4">
          <Mermaid code={code} />
        </div>
      );
    }
    if (kind === "markdown") {
      return (
        <div className="p-5">
          <Markdown content={code} />
        </div>
      );
    }
    if (executable) {
      return (
        <div className="flex h-full flex-col">
          {kind === "js" && runToken > 0 && (
            <iframe
              key={runToken}
              title="js-sandbox"
              sandbox="allow-scripts"
              srcDoc={jsSandboxDoc(code)}
              className="hidden"
            />
          )}
          <div className="scrollbar-thin flex-1 overflow-auto p-4 font-mono text-[12.5px] leading-relaxed">
            {logs.length === 0 ? (
              <p className="text-zinc-600">
                Press Run to execute this {kind === "js" ? "JavaScript" : "Python"}.
              </p>
            ) : (
              logs.map((l, i) => (
                <pre
                  key={i}
                  className={cn(
                    "whitespace-pre-wrap break-words",
                    l.level === "error" && "text-red-400",
                    l.level === "warn" && "text-amber-400",
                    l.level === "info" && "text-zinc-500",
                    (l.level === "log" || l.level === "debug") && "text-zinc-300",
                  )}
                >
                  {l.text}
                </pre>
              ))
            )}
          </div>
        </div>
      );
    }
    return null;
  }, [kind, code, executable, logs, runToken]);

  return (
    <AnimatePresence>
      {open && canvas && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeCanvas}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:bg-black/30"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-xl sm:w-[min(46rem,90vw)]"
          >
            <header className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">
                {canvas.title}
              </span>
              <span className="shrink-0 rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
                {language}
              </span>

              {executable && (
                <button
                  type="button"
                  onClick={run}
                  disabled={running}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
                >
                  <Play size={12} fill="currentColor" />
                  {running ? "Running…" : "Run"}
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                aria-label="Copy"
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
              <button
                type="button"
                onClick={download}
                aria-label="Download"
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Download size={14} />
              </button>
              <button
                type="button"
                onClick={closeCanvas}
                aria-label="Close canvas"
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X size={16} />
              </button>
            </header>

            {hasView && (
              <div className="flex shrink-0 items-center gap-1 border-b border-zinc-800 px-2 py-1.5">
                {(
                  [
                    [executable ? "Output" : "Preview", "view"],
                    ["Code", "code"],
                  ] as const
                ).map(([label, id]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs transition-colors",
                      tab === id
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden bg-[#0b0b0e]">
              {tab === "view" && hasView ? (
                <div className="h-full overflow-auto">{view}</div>
              ) : (
                <textarea
                  value={code}
                  onChange={(e) => updateCanvasCode(e.target.value)}
                  spellCheck={false}
                  className="scrollbar-thin h-full w-full resize-none bg-transparent p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200 focus:outline-none"
                />
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
