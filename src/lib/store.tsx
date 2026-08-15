"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  loadChats,
  persistChat,
  removeChat,
  clearAllChats,
  type Chat,
  type ChatMessage,
  type ToolEvent,
} from "./db";
import {
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  isModelId,
  type ModelId,
} from "./models";
import { titleFromPrompt, uid } from "./utils";

const MODEL_STORAGE = "ct.model";
const SYSTEM_STORAGE = "ct.systemPrompt";

// Framed-stream control characters — must match src/app/api/chat/route.ts.
const C_THINK = "\u0002";
const C_ANSWER = "\u0003";
const C_TOOL = "\u0004";
const C_ERROR = "\u0000";
const C_SESSION = "\u0001";

interface ParsedStream {
  thinking: string;
  content: string;
  tools: ToolEvent[];
  failure: string | null;
  session: string | null;
}

/**
 * Demultiplex the framed response into thinking, answer, tool activity, and
 * terminal status. Idempotent — safe to re-run over the growing buffer on
 * every chunk. Control chars (code ≤ 4) never appear in model output, so a
 * fast char-code scan finds segment boundaries.
 */
function parseStream(raw: string): ParsedStream {
  let thinking = "";
  let content = "";
  const tools: ToolEvent[] = [];
  let failure: string | null = null;
  let session: string | null = null;
  let mode: "answer" | "think" = "answer";

  let i = 0;
  const n = raw.length;
  while (i < n) {
    let j = i;
    while (j < n && raw.charCodeAt(j) > 4) j++;
    const seg = raw.slice(i, j);
    if (seg) {
      if (mode === "think") thinking += seg;
      else content += seg;
    }
    if (j >= n) break;

    const ctrl = raw[j];
    if (ctrl === C_THINK) {
      mode = "think";
      i = j + 1;
    } else if (ctrl === C_ANSWER) {
      mode = "answer";
      i = j + 1;
    } else if (ctrl === C_TOOL) {
      const end = raw.indexOf(C_TOOL, j + 1);
      if (end === -1) break; // frame still arriving
      try {
        const t = JSON.parse(raw.slice(j + 1, end)) as ToolEvent;
        if (t?.name) tools.push({ name: t.name, detail: t.detail || undefined });
      } catch {
        /* partial/garbled frame — skip */
      }
      i = end + 1;
    } else if (ctrl === C_ERROR) {
      failure = raw.slice(j + 1);
      break;
    } else if (ctrl === C_SESSION) {
      session = raw.slice(j + 1).trim();
      break;
    } else {
      i = j + 1;
    }
  }

  return { thinking, content, tools, failure, session };
}

/** Mirrors `AuthState` in lib/credentials, plus a client-only "checking". */
export type AuthState =
  | "checking"
  | "ready"
  | "cli-missing"
  | "logged-out"
  | "error";

/** What the model is doing right now, for the ambient field to react to. */
export type Phase = "idle" | "thinking" | "answering";

interface StoreValue {
  hydrated: boolean;
  chats: Chat[];
  activeChat: Chat | null;
  activeId: string | null;
  setActiveId: (id: string | null) => void;

  authState: AuthState;
  authMessage: string;
  authReady: boolean;
  refreshAuth: () => Promise<boolean>;

  model: ModelId;
  setModel: (m: ModelId) => void;
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;

  streaming: boolean;
  phase: Phase;
  /** Reported by the live message while its smoothed text is still revealing. */
  setRevealing: (v: boolean) => void;
  sendMessage: (text: string) => Promise<void>;
  stopStreaming: () => void;
  regenerate: () => Promise<void>;

  newChat: () => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => Promise<void>;
  deleteAll: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}

function makeChat(model: ModelId): Chat {
  const now = Date.now();
  return {
    id: uid(),
    title: "New Chat",
    model,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authMessage, setAuthMessage] = useState("Checking credentials…");

  const [model, setModelState] = useState<ModelId>(DEFAULT_MODEL);
  const [systemPrompt, setSystemPromptState] = useState(DEFAULT_SYSTEM_PROMPT);

  const [streaming, setStreaming] = useState(false);
  // True while the newest reply's smoothed text is still animating in, so the
  // ambient stays in its "answering" state until the words actually land.
  const [revealing, setRevealing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Mirrors of state that the async send loop needs without re-binding callbacks.
  const modelRef = useRef(model);
  const systemRef = useRef(systemPrompt);
  useEffect(() => void (modelRef.current = model), [model]);
  useEffect(() => void (systemRef.current = systemPrompt), [systemPrompt]);

  /* ---------------------------------------------------------------- hydrate */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rawModel = localStorage.getItem(MODEL_STORAGE);
      const storedModel = isModelId(rawModel) ? rawModel : null;
      const storedSystem = localStorage.getItem(SYSTEM_STORAGE);

      let rows: Chat[] = [];
      try {
        rows = await loadChats();
      } catch (err) {
        console.error("[store] failed to load chats", err);
      }
      if (cancelled) return;

      if (storedModel) setModelState(storedModel);
      if (storedSystem !== null) setSystemPromptState(storedSystem);

      if (rows.length > 0) {
        setChats(rows);
        setActiveId(rows[0].id);
      } else {
        const fresh = makeChat(storedModel ?? DEFAULT_MODEL);
        setChats([fresh]);
        setActiveId(fresh.id);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeId) ?? null,
    [chats, activeId],
  );

  // What the model is doing, for the ambient field: reasoning/searching before
  // any answer text is "thinking"; once the reply is flowing (and until the
  // smoothed text finishes revealing) it's "answering".
  const phase: Phase = useMemo(() => {
    if (streaming) {
      const last = activeChat?.messages.at(-1);
      return last?.role === "assistant" && last.content.trim().length > 0
        ? "answering"
        : "thinking";
    }
    // Stream done but words are still landing — hold "answering".
    return revealing ? "answering" : "idle";
  }, [streaming, activeChat, revealing]);

  /** Apply a transform to one chat, bump its timestamp, and persist it. */
  const mutateChat = useCallback(
    (id: string, fn: (chat: Chat) => Chat) => {
      setChats((prev) => {
        const next = prev.map((c) => (c.id === id ? fn(c) : c));
        const target = next.find((c) => c.id === id);
        if (target) void persistChat(target).catch(() => {});
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      });
    },
    [],
  );

  /* ------------------------------------------------------------------- auth */

  /** Ask the server whether a usable local credential profile exists. */
  const refreshAuth = useCallback(async () => {
    setAuthState("checking");
    setAuthMessage("Checking credentials…");
    try {
      const res = await fetch("/api/auth", { method: "POST" });
      const data = (await res.json()) as {
        state: Exclude<AuthState, "checking">;
        message: string;
      };
      setAuthState(data.state);
      setAuthMessage(data.message);
      return data.state === "ready";
    } catch {
      setAuthState("error");
      setAuthMessage("Could not reach the local server.");
      return false;
    }
  }, []);

  // One check on startup. Deferred a tick so the synchronous "checking" write
  // lands in its own commit rather than cascading off this effect.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => void refreshAuth(), 0);
    return () => clearTimeout(t);
  }, [hydrated, refreshAuth]);

  const setModel = useCallback(
    (m: ModelId) => {
      setModelState(m);
      localStorage.setItem(MODEL_STORAGE, m);
      if (activeId) mutateChat(activeId, (c) => ({ ...c, model: m }));
    },
    [activeId, mutateChat],
  );

  const setSystemPrompt = useCallback((s: string) => {
    setSystemPromptState(s);
    localStorage.setItem(SYSTEM_STORAGE, s);
  }, []);

  /* --------------------------------------------------------------- chat ops */

  const newChat = useCallback(() => {
    const fresh = makeChat(modelRef.current);
    setChats((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    void persistChat(fresh).catch(() => {});
  }, []);

  const renameChat = useCallback(
    (id: string, title: string) => {
      const clean = title.trim() || "Untitled";
      mutateChat(id, (c) => ({ ...c, title: clean, updatedAt: Date.now() }));
    },
    [mutateChat],
  );

  const deleteChat = useCallback(
    async (id: string) => {
      await removeChat(id).catch(() => {});
      setChats((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (next.length === 0) {
          const fresh = makeChat(modelRef.current);
          void persistChat(fresh).catch(() => {});
          setActiveId(fresh.id);
          return [fresh];
        }
        setActiveId((cur) => (cur === id ? next[0].id : cur));
        return next;
      });
    },
    [],
  );

  const deleteAll = useCallback(async () => {
    await clearAllChats().catch(() => {});
    const fresh = makeChat(modelRef.current);
    void persistChat(fresh).catch(() => {});
    setChats([fresh]);
    setActiveId(fresh.id);
  }, []);

  /* -------------------------------------------------------------- streaming */

  /**
   * Let the model name the chat from the opening message. Replaces the instant
   * heuristic placeholder only if the user hasn't renamed it in the meantime.
   */
  const titleChat = useCallback(
    async (chatId: string, userText: string) => {
      const placeholder = titleFromPrompt(userText);
      try {
        const res = await fetch("/api/title", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: userText }),
        });
        const { title } = (await res.json()) as { title: string | null };
        if (!title) return;
        mutateChat(chatId, (c) =>
          // Only overwrite the auto-generated placeholder, never a manual rename.
          c.title === placeholder || c.title === "New Chat"
            ? { ...c, title }
            : c,
        );
      } catch {
        /* titling is best-effort — keep the heuristic title */
      }
    },
    [mutateChat],
  );

  const runCompletion = useCallback(
    async (chatId: string, history: ChatMessage[], sessionId?: string) => {
      const assistantId = uid();
      // The opening exchange gets a model-written title once it completes.
      const firstTurn =
        history.filter((m) => m.role === "assistant").length === 0;
      const firstUserText =
        history.find((m) => m.role === "user")?.content ?? "";
      const placeholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };

      mutateChat(chatId, (c) => ({
        ...c,
        messages: [...history, placeholder],
        updatedAt: Date.now(),
      }));

      const finish = (patch: Partial<ChatMessage>) =>
        mutateChat(chatId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId ? { ...m, ...patch } : m,
          ),
          updatedAt: Date.now(),
        }));

      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            prompt: history.at(-1)?.content ?? "",
            sessionId,
            model: modelRef.current,
            system: systemRef.current,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let detail = `Request failed (${res.status}).`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) detail = data.error;
          } catch {
            /* non-JSON error body — keep the status message */
          }
          // 401 here means the local profile went stale — re-probe so the
          // status indicator and setup dialog reflect it.
          if (res.status === 401) void refreshAuth();
          finish({ error: detail });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          const p = parseStream(acc);
          finish({ content: p.content, thinking: p.thinking, tools: p.tools });
        }
        acc += decoder.decode();

        const parsed = parseStream(acc);
        finish({
          content: parsed.content,
          thinking: parsed.thinking,
          tools: parsed.tools,
          error: parsed.failure ?? undefined,
        });

        // Persist the session so the next turn resumes in place instead of
        // replaying the whole transcript.
        if (parsed.session) {
          mutateChat(chatId, (c) => ({ ...c, sessionId: parsed.session! }));
        }

        if (!parsed.failure && !parsed.content.trim() && !parsed.thinking) {
          finish({ error: "The model returned an empty response." });
        }

        // Name the conversation from its opening message (fire-and-forget).
        if (!parsed.failure && firstTurn && firstUserText) {
          void titleChat(chatId, firstUserText);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Keep whatever text streamed before the user hit Stop.
          mutateChat(chatId, (c) => ({
            ...c,
            messages: c.messages.filter(
              (m) => m.id !== assistantId || m.content.length > 0,
            ),
          }));
        } else {
          finish({
            error: err instanceof Error ? err.message : "Streaming failed.",
          });
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [mutateChat, refreshAuth, titleChat],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const chat = chats.find((c) => c.id === activeId);
      if (!chat) return;

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const history = [...chat.messages.filter((m) => !m.error), userMsg];

      mutateChat(chat.id, (c) => ({
        ...c,
        title:
          c.messages.length === 0 || c.title === "New Chat"
            ? titleFromPrompt(trimmed)
            : c.title,
        messages: history,
        updatedAt: Date.now(),
      }));

      await runCompletion(chat.id, history, chat.sessionId);
    },
    [activeId, chats, mutateChat, runCompletion, streaming],
  );

  const regenerate = useCallback(async () => {
    if (streaming) return;
    const chat = chats.find((c) => c.id === activeId);
    if (!chat) return;

    const lastUserIdx = [...chat.messages]
      .reverse()
      .findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;

    const cut = chat.messages.length - lastUserIdx;
    const history = chat.messages.slice(0, cut);
    // Drop the session: the previous answer is already part of it, so resuming
    // would ask Claude to continue rather than retry.
    mutateChat(chat.id, (c) => ({
      ...c,
      messages: history,
      sessionId: undefined,
    }));
    await runCompletion(chat.id, history);
  }, [activeId, chats, mutateChat, runCompletion, streaming]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const value: StoreValue = {
    hydrated,
    chats,
    activeChat,
    activeId,
    setActiveId,
    authState,
    authMessage,
    authReady: authState === "ready",
    refreshAuth,
    phase,
    setRevealing,
    model,
    setModel,
    systemPrompt,
    setSystemPrompt,
    streaming,
    sendMessage,
    stopStreaming,
    regenerate,
    newChat,
    renameChat,
    deleteChat,
    deleteAll,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
