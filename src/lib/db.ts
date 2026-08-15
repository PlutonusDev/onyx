import Dexie, { type EntityTable } from "dexie";
import type { ModelId } from "./models";

export interface ToolEvent {
  name: string;
  /** Short human label, e.g. a search query or fetched URL. */
  detail?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  /** Extended-thinking transcript that preceded the answer, when present. */
  thinking?: string;
  /** Tool activity (web search / fetch) surfaced during the turn. */
  tools?: ToolEvent[];
  /** Set when the assistant turn failed, so the UI can render an error state. */
  error?: string;
}

export interface Chat {
  id: string;
  title: string;
  model: ModelId;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  /**
   * Agent-runtime session this chat resumes into, so context is restored
   * server-side instead of replaying the transcript on every turn.
   */
  sessionId?: string;
}

const db = new Dexie("claude-terminal") as Dexie & {
  chats: EntityTable<Chat, "id">;
};

db.version(1).stores({
  chats: "id, updatedAt, createdAt, title",
});

export async function loadChats(): Promise<Chat[]> {
  const rows = await db.chats.toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function persistChat(chat: Chat) {
  await db.chats.put(chat);
}

export async function removeChat(id: string) {
  await db.chats.delete(id);
}

export async function clearAllChats() {
  await db.chats.clear();
}

export default db;
