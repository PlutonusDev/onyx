"use client";

import { useEffect, useRef, useState } from "react";
import { uid } from "@/lib/utils";

let initialized = false;

/** Renders a mermaid definition to SVG. Falls back to the source on error
 *  (important while streaming, when the definition is still incomplete). */
export default function Mermaid({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);
  const idRef = useRef(`mmd-${uid().slice(0, 8)}`);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!initialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "strict",
            fontFamily: "var(--font-sans)",
            themeVariables: {
              background: "#0b0b0e",
              primaryColor: "#18181b",
              primaryBorderColor: "#3f3f46",
              primaryTextColor: "#e4e4e7",
              lineColor: "#71717a",
            },
          });
          initialized = true;
        }
        const { svg: out } = await mermaid.render(idRef.current, code.trim());
        if (!cancelled) {
          setSvg(out);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (failed || !svg) {
    // While streaming (incomplete) or on a genuine syntax error, show source.
    return (
      <pre className="scrollbar-thin my-4 overflow-x-auto rounded-xl border border-zinc-800 bg-[#0b0b0e] p-4 font-mono text-[0.8125rem] text-zinc-400">
        {code}
      </pre>
    );
  }

  return (
    <div
      className="scrollbar-thin my-4 flex justify-center overflow-x-auto rounded-xl border border-zinc-800 bg-[#0b0b0e] p-4 [&_svg]:max-w-full"
      // Mermaid output is sanitized by its own strict security level.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
