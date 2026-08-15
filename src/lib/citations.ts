export interface Source {
  url: string;
  label: string;
}

/**
 * Pull cited sources out of an answer: markdown links first (their text makes a
 * good label), then any bare URLs. Deduped by URL, capped so the panel stays
 * tidy. Purely client-side — no dependency on the provider surfacing citations.
 */
export function extractSources(content: string): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];

  const push = (url: string, label: string) => {
    const clean = url.replace(/[.,)\]]+$/, "");
    if (!/^https?:\/\//i.test(clean) || seen.has(clean)) return;
    seen.add(clean);
    let host = clean;
    try {
      host = new URL(clean).hostname.replace(/^www\./, "");
    } catch {
      /* keep raw */
    }
    out.push({ url: clean, label: label.trim() || host });
  };

  // [text](url)
  const link = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = link.exec(content))) push(m[2], m[1]);

  // bare URLs — any already captured from a link are deduped by `seen`.
  const bare = /\bhttps?:\/\/[^\s<>()[\]]+/g;
  while ((m = bare.exec(content))) push(m[0], "");

  return out.slice(0, 12);
}
