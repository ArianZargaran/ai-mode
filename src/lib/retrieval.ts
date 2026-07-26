import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "docs");
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

export type Doc = {
  id: string;
  title: string;
  url: string;
  body: string;
};

export type IndexedDoc = Doc & { vector: number[] };
export type ScoredDoc = IndexedDoc & { score: number };
export type SearchResult = { matches: ScoredDoc[]; confident: boolean };

type EmbedOpts = {
  apiKey: string;
  model: string;
  inputType: "document" | "query";
};

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: match[2].trim() };
}

async function embed(texts: string[], { apiKey, model, inputType }: EmbedOpts): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: texts, model, input_type: inputType }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings request failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class DocIndex {
  private apiKey: string;
  private model: string;
  private docs: IndexedDoc[];

  constructor({ apiKey, model }: { apiKey: string; model: string }) {
    this.apiKey = apiKey;
    this.model = model;
    this.docs = [];
  }

  async build(): Promise<number> {
    const files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith(".md"));
    const parsed: Doc[] = await Promise.all(
      files.map(async (file) => {
        const raw = await readFile(path.join(DOCS_DIR, file), "utf8");
        const { meta, body } = parseFrontmatter(raw);
        return { id: file, title: meta.title || file, url: meta.url || "", body };
      })
    );

    const vectors = await embed(
      parsed.map((d) => `${d.title}\n\n${d.body}`),
      { apiKey: this.apiKey, model: this.model, inputType: "document" }
    );

    this.docs = parsed.map((d, i) => ({ ...d, vector: vectors[i] }));
    return this.docs.length;
  }

  async search(
    query: string,
    { topK = 3, minScore = 0.35 }: { topK?: number; minScore?: number } = {}
  ): Promise<SearchResult> {
    if (this.docs.length === 0) return { matches: [], confident: false };
    const [queryVector] = await embed([query], {
      apiKey: this.apiKey,
      model: this.model,
      inputType: "query",
    });

    const ranked = this.docs
      .map((d) => ({ ...d, score: cosine(queryVector, d.vector) }))
      .sort((a, b) => b.score - a.score);

    const matches = ranked.slice(0, topK);
    const confident = matches.length > 0 && matches[0].score >= minScore;
    return { matches, confident };
  }
}
