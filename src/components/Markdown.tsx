"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeTokens from "@/lib/rehype-tokens";
import CodeBlock from "./CodeBlock";

const components: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  // Wide tables scroll inside their own container instead of the page.
  table: ({ children }) => (
    <div className="table-scroll scrollbar-thin">
      <table>{children}</table>
    </div>
  ),
};

const remarkPlugins = [remarkGfm, remarkMath];

const base = [
  [rehypeHighlight, { detect: true, ignoreMissing: true }] as const,
  [rehypeKatex, { throwOnError: false, strict: false }] as const,
];

// Token wrapping is only worth its DOM cost while a message is streaming.
const streamingPlugins = [...base, rehypeTokens];

function MarkdownImpl({ content, live }: { content: string; live?: boolean }) {
  return (
    <div className="prose-claude">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        rehypePlugins={(live ? streamingPlugins : base) as any}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Streaming re-renders this on every frame; memoising keeps the markdown and
// highlight pipeline from running for messages that haven't changed.
export default memo(
  MarkdownImpl,
  (a, b) => a.content === b.content && a.live === b.live,
);
