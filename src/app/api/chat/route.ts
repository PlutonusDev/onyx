import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { MODELS, DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 600;

/**
 * The response is a single UTF-8 text stream framed with control characters
 * that never occur in model output, so the client can demultiplex thinking,
 * answer text, tool activity, and terminal status without a heavier protocol.
 *
 *   U+0002  switch to THINKING mode  (subsequent text is reasoning)
 *   U+0003  switch to ANSWER mode    (subsequent text is the reply)
 *   U+0004  tool event: `{json}`
 *   U+0000  error: remainder is the reason
 *   U+0001  session: remainder is the resumable id
 */
const THINK = "\u0002";
const ANSWER = "\u0003";
const TOOL = "\u0004";
const ERROR_SENTINEL = "\u0000";
const SESSION_SENTINEL = "\u0001";

interface ReqAttachment {
  kind: "image" | "pdf";
  mediaType: string;
  /** base64 data URL. */
  dataUrl: string;
}

interface ChatRequestBody {
  /** Only the newest user turn; prior context is restored via `sessionId`. */
  prompt?: string;
  /** Full transcript, used to seed context when no session exists yet. */
  messages?: { role: "user" | "assistant"; content: string }[];
  attachments?: ReqAttachment[];
  model?: string;
  system?: string;
  sessionId?: string;
}

/** Split a `data:<media>;base64,<payload>` URL into its parts. */
function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

/** Build a content-block user message carrying text plus images / PDFs. */
function buildAttachmentMessage(
  text: string,
  attachments: ReqAttachment[],
): SDKUserMessage {
  const blocks: unknown[] = [];
  if (text.trim()) blocks.push({ type: "text", text });

  for (const a of attachments) {
    const parsed = parseDataUrl(a.dataUrl);
    if (!parsed) continue;
    if (a.kind === "image") {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: parsed.mediaType, data: parsed.data },
      });
    } else {
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: parsed.data,
        },
      });
    }
  }

  return {
    type: "user",
    message: { role: "user", content: blocks },
    parent_tool_use_id: null,
  } as SDKUserMessage;
}

const ALLOWED_MODELS = new Set(MODELS.map((m) => m.id as string));

function bad(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function reasonFor(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "The request failed before completing.";
}

/**
 * Rebuild context as a single prompt when there is no resumable session
 * (first turn of a chat, or a session Claude Code has since expired).
 */
function transcriptPrompt(
  history: { role: "user" | "assistant"; content: string }[],
): string {
  if (history.length <= 1) return history.at(-1)?.content ?? "";

  const prior = history.slice(0, -1);
  const latest = history.at(-1)?.content ?? "";
  const rendered = prior
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  return [
    "<conversation_history>",
    rendered,
    "</conversation_history>",
    "",
    "Continue this conversation. Respond only to the latest message below.",
    "",
    latest,
  ].join("\n");
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return bad("Malformed request body.", 400);
  }

  const history = (Array.isArray(body.messages) ? body.messages : []).filter(
    (m) =>
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  // With a live session Claude Code already holds the context, so send only the
  // new turn; otherwise replay the transcript.
  const prompt = sessionId
    ? (body.prompt ?? history.at(-1)?.content ?? "")
    : transcriptPrompt(history);

  if (!prompt.trim() && attachments.length === 0) {
    return bad("No message to send.", 400);
  }

  // Attachments require a structured content-block message; plain turns stay a
  // simple string so session resume works unchanged.
  const promptInput: string | AsyncIterable<SDKUserMessage> = attachments.length
    ? (async function* () {
        yield buildAttachmentMessage(prompt, attachments);
      })()
    : prompt;

  const modelId =
    body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;

  const system =
    typeof body.system === "string" && body.system.trim().length > 0
      ? body.system
      : DEFAULT_SYSTEM_PROMPT;

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let failure: string | null = null;
      let session: string | undefined;
      let sawText = false;
      // Only emit a mode marker when the mode actually changes, so the stream
      // stays compact.
      let mode: "answer" | "think" | null = null;

      const send = (text: string) => controller.enqueue(encoder.encode(text));
      const emit = (next: "answer" | "think", text: string) => {
        if (!text) return;
        if (mode !== next) {
          send(next === "think" ? THINK : ANSWER);
          mode = next;
        }
        send(text);
      };
      const emitTool = (name: string, detail?: string) => {
        send(TOOL + JSON.stringify({ name, detail }) + TOOL);
        // A tool frame resets the mode so the next text re-announces itself.
        mode = null;
      };

      try {
        const run = query({
          prompt: promptInput,
          options: {
            model: modelId,
            systemPrompt: system,
            // A conversation surface with read-only reach: web search and fetch
            // are pre-approved; no shell, filesystem, or project settings.
            tools: ["WebSearch", "WebFetch"],
            allowedTools: ["WebSearch", "WebFetch"],
            settingSources: [],
            permissionMode: "default",
            maxTurns: 24,
            includePartialMessages: true,
            // Let the model decide when to reason, and surface a readable
            // summary of it rather than the raw chain.
            thinking: { type: "adaptive", display: "summarized" },
            abortController: abort,
            ...(sessionId ? { resume: sessionId } : {}),
          },
        });

        for await (const message of run) {
          if (message.type === "stream_event") {
            const ev = message.event;
            if (ev.type === "content_block_delta") {
              if (ev.delta.type === "text_delta") {
                sawText = true;
                emit("answer", ev.delta.text);
              } else if (
                // Reasoning stream, when the model surfaces it.
                (ev.delta as { type: string }).type === "thinking_delta"
              ) {
                emit("think", (ev.delta as { thinking?: string }).thinking ?? "");
              }
            }
            session ??= message.session_id;
          } else if (message.type === "assistant") {
            session ??= message.session_id;
            // Surface tool activity (web search / fetch) from the completed
            // assistant turn, where inputs are whole rather than streaming.
            for (const block of message.message.content ?? []) {
              const b = block as {
                type?: string;
                name?: string;
                input?: { query?: string; url?: string };
              };
              if (b.type === "server_tool_use" || b.type === "tool_use") {
                const detail = b.input?.query ?? b.input?.url;
                emitTool(b.name ?? "tool", detail);
              }
            }
          } else if (message.type === "result") {
            session = message.session_id ?? session;
            if (message.is_error) {
              failure =
                "subtype" in message && message.subtype
                  ? `Run failed (${message.subtype}).`
                  : "Run failed.";
            }
          }
        }
      } catch (err) {
        // A client-initiated abort is not an error worth surfacing.
        if (!abort.signal.aborted) failure = reasonFor(err);
      }

      if (!failure && !sawText) {
        failure =
          "No response was produced. If this persists, run `claude` in a terminal to confirm you're signed in.";
      }
      if (failure) {
        controller.enqueue(encoder.encode(ERROR_SENTINEL + failure));
      } else if (session) {
        // Hand the session id back so the next turn can resume in-place.
        controller.enqueue(encoder.encode(SESSION_SENTINEL + session));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
