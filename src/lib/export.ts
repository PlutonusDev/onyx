import type { Chat } from "./db";
import { modelById } from "./models";

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "chat"
  );
}

function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportMarkdown(chat: Chat) {
  const model = modelById(chat.model);
  const lines = [
    `# ${chat.title}`,
    "",
    `- **Model:** ${model.name}`,
    `- **Created:** ${new Date(chat.createdAt).toLocaleString()}`,
    `- **Messages:** ${chat.messages.length}`,
    "",
    "---",
    "",
  ];

  for (const m of chat.messages) {
    lines.push(`### ${m.role === "user" ? "User" : "Assistant"}`, "");
    lines.push(m.content || "_(no content)_", "");
    if (m.error) lines.push(`> **Error:** ${m.error}`, "");
  }

  download(`${slug(chat.title)}.md`, lines.join("\n"), "text/markdown");
}

export function exportJson(chat: Chat) {
  download(
    `${slug(chat.title)}.json`,
    JSON.stringify(chat, null, 2),
    "application/json",
  );
}
