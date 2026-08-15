/**
 * Wraps each word in `<span class="tok">` so newly streamed words can fade in
 * individually.
 *
 * This relies on React reconciliation: words already on screen keep their
 * position in the child list, so their DOM nodes (and their finished CSS
 * animation) are reused. Only spans appended at the tail are new, so only
 * those animate — without tracking any per-word state ourselves.
 */

interface HastText {
  type: "text";
  value: string;
}

interface HastElement {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

type HastNode = HastText | HastElement | { type: string; children?: HastNode[] };

/** Wrapping inside these would corrupt highlighting or math rendering. */
const OPAQUE = new Set(["code", "pre", "style", "script", "math", "svg"]);

function isElement(node: HastNode): node is HastElement {
  return node.type === "element";
}

export default function rehypeTokens() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      const children = (node as { children?: HastNode[] }).children;
      if (!children || children.length === 0) return;

      const out: HastNode[] = [];

      for (const child of children) {
        if (isElement(child)) {
          if (
            OPAQUE.has(child.tagName) ||
            // KaTeX output is generated markup; leave it untouched.
            String(
              (child.properties?.className as string[] | undefined)?.join(" ") ?? "",
            ).includes("katex")
          ) {
            out.push(child);
            continue;
          }
          walk(child);
          out.push(child);
          continue;
        }

        if (child.type !== "text") {
          out.push(child);
          continue;
        }

        const value = (child as HastText).value;
        if (!value) continue;

        // Keep whitespace as bare text so wrapping and spacing stay natural.
        for (const part of value.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            out.push({ type: "text", value: part } as HastText);
          } else {
            out.push({
              type: "element",
              tagName: "span",
              properties: { className: ["tok"] },
              children: [{ type: "text", value: part } as HastText],
            } as HastElement);
          }
        }
      }

      (node as { children?: HastNode[] }).children = out;
    };

    walk(tree);
  };
}
