import "server-only";
import { readFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type AuthState = "ready" | "cli-missing" | "logged-out" | "error";

export interface AuthReport {
  state: AuthState;
  message: string;
  /** Display-only account label, when one is discoverable. */
  account?: string;
}

const CLAUDE_DIR = join(homedir(), ".claude");
const CREDENTIALS = join(CLAUDE_DIR, ".credentials.json");
const CONFIG = join(homedir(), ".claude.json");

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Report whether this machine has a usable Claude Code login.
 *
 * We deliberately only test for the *presence* of a credential record — the
 * secret itself is never read into memory, logged, or returned. A stale or
 * revoked login surfaces as an auth error on the first real request instead.
 */
export async function checkAuth(): Promise<AuthReport> {
  try {
    const hasCreds = await exists(CREDENTIALS);
    const hasConfig = await exists(CONFIG);

    if (!hasCreds && !hasConfig) {
      return {
        state: "cli-missing",
        message: "Claude Code isn't set up on this machine.",
      };
    }

    // The account label lives in the plain config file, never the credential file.
    let account: string | undefined;
    if (hasConfig) {
      try {
        const raw = await readFile(CONFIG, "utf8");
        const parsed = JSON.parse(raw) as {
          oauthAccount?: { emailAddress?: string; organizationName?: string };
        };
        account =
          parsed.oauthAccount?.emailAddress ??
          parsed.oauthAccount?.organizationName;
      } catch {
        /* config unreadable or not JSON — the label is optional */
      }
    }

    if (!hasCreds) {
      return {
        state: "logged-out",
        message: "No active session. Run `claude` and sign in.",
      };
    }

    return {
      state: "ready",
      message: account
        ? `Signed in as ${account}.`
        : "Signed in with your Claude subscription.",
      account,
    };
  } catch {
    return { state: "error", message: "Could not read local credentials." };
  }
}
