import { query } from "@anthropic-ai/claude-agent-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM =
  "You write a very short title for a conversation from the user's first " +
  "message. Rules: at most 20 characters, ideally 2 or 3 words. Title Case. " +
  "No surrounding quotes, no trailing punctuation, no emoji. Title the topic " +
  "only — never mention Claude, Anthropic, an AI, a model, or an assistant. " +
  "Output only the title.";

function clean(raw: string): string {
  let t = raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Defensive scrub: never surface the underlying model / vendor / app name.
  t = t
    .replace(/\b(claude|anthropic|onyx)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Hard 20-character cap, trimmed to a word boundary when that leaves enough.
  if (t.length > 20) {
    const cut = t.slice(0, 20);
    const sp = cut.lastIndexOf(" ");
    t = (sp >= 8 ? cut.slice(0, sp) : cut).trim();
  }
  return t;
}

export async function POST(req: Request) {
  let prompt = "";
  try {
    const body = (await req.json()) as { prompt?: string };
    prompt = (body.prompt ?? "").trim();
  } catch {
    return Response.json({ title: null }, { status: 400 });
  }
  if (!prompt) return Response.json({ title: null });

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  try {
    // A cheap, isolated one-shot on the fastest tier — never resumes or touches
    // the conversation's own session.
    const run = query({
      prompt: `First message:\n"""${prompt.slice(0, 2000)}"""\n\nTitle:`,
      options: {
        model: "haiku",
        systemPrompt: SYSTEM,
        tools: [],
        settingSources: [],
        maxTurns: 1,
        thinking: { type: "disabled" },
        abortController: abort,
      },
    });

    let text = "";
    for await (const message of run) {
      if (message.type === "assistant") {
        for (const block of message.message.content ?? []) {
          const b = block as { type?: string; text?: string };
          if (b.type === "text" && b.text) text += b.text;
        }
      }
    }

    const title = clean(text);
    return Response.json({ title: title || null });
  } catch {
    return Response.json({ title: null });
  }
}
