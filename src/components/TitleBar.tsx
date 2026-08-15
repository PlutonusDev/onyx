"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { modelById } from "@/lib/models";
import { cn } from "@/lib/utils";

/**
 * A slim macOS/Windows-style window header, shown only when the app is running
 * as an installed PWA (where there is no browser chrome to orient the user).
 */
export default function TitleBar() {
  const [standalone, setStandalone] = useState(false);
  const { model, authState, streaming } = useStore();

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const iosStandalone =
      "standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    const sync = () => setStandalone(mq.matches || iosStandalone);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!standalone) return null;

  const dot =
    authState === "ready"
      ? "bg-emerald-400"
      : authState === "error"
        ? "bg-red-400"
        : authState === "checking"
          ? "bg-amber-400 animate-pulse"
          : "bg-zinc-600";

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-b border-zinc-900 bg-[#09090b] px-3 select-none">
      {/* Traffic-light affordance — decorative; the OS draws the real controls. */}
      <div className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-zinc-800" />
        <span className="size-2.5 rounded-full bg-zinc-800" />
        <span className="size-2.5 rounded-full bg-zinc-800" />
      </div>

      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
        Onyx
      </span>

      <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-600">
        <span>{modelById(model).name}</span>
        <span
          className={cn("size-1.5 rounded-full", streaming ? "animate-pulse bg-amber-400" : dot)}
        />
      </div>
    </div>
  );
}
