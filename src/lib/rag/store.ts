import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { chunkDoc, embeddingText, type Chunk, type DocInput } from "./chunker";
import { embed, type VoyageConfig } from "./voyage";

// Vector index with two interchangeable backends behind one interface:
//
//   - PgIndex   — Postgres + pgvector, used when DATABASE_URL is set. This is
//                 the production path: shared across instances, ANN-ready,
//                 SQL-filterable. Ingestion is hash-incremental via upserts.
//   - FileIndex — .rag/index.json + in-memory cosine, used otherwise. Keeps
//                 the demo runnable with zero infrastructure.
//
// Both share the same corpus loading, chunking, and incremental re-embedding
// logic; retrieval code upstream doesn't know which one it's talking to.

const DOCS_DIR = path.join(process.cwd(), "docs");
const INDEX_PATH = path.join(process.cwd(), ".rag", "index.json");
const PG_TABLE = "rag_chunks";

// pricing content is deliberately kept out of the retrieval corpus — pricing
// questions are intercepted and steered to sales before retrieval, and
// excluding the doc ensures tangential questions can't surface plan numbers
const EXCLUDED_DOCS = new Set(["pricing.md"]);

export type SearchHit = Chunk & { sim: number };

export interface VectorIndex {
  search(queryVector: number[], k: number): Promise<SearchHit[]>;
}

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

async function loadDocs(): Promise<DocInput[]> {
  const files = (await readdir(DOCS_DIR)).filter(
    (f) => f.endsWith(".md") && !EXCLUDED_DOCS.has(f)
  );
  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(DOCS_DIR, file), "utf8");
      const { meta, body } = parseFrontmatter(raw);
      return { id: file, title: meta.title || file, url: meta.url || "", body };
    })
  );
}

async function loadChunks(): Promise<Chunk[]> {
  const docs = await loadDocs();
  return docs.flatMap(chunkDoc);
}

// embed only chunks whose hash isn't in `known`; returns hash -> vector
async function embedMissing(
  chunks: Chunk[],
  known: Map<string, number[]>,
  cfg: VoyageConfig
): Promise<Map<string, number[]>> {
  const missing = chunks.filter((c) => !known.has(c.hash));
  const out = new Map<string, number[]>();
  if (missing.length > 0) {
    const vectors = await embed(missing.map(embeddingText), cfg, "document");
    missing.forEach((c, i) => out.set(c.hash, vectors[i]));
  }
  console.log(
    `[rag] index sync: ${chunks.length} chunks (${missing.length} embedded, ${chunks.length - missing.length} reused)`
  );
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* ---------- file backend ---------- */

type StoredIndex = {
  embedModel: string;
  builtAt: string;
  chunks: (Chunk & { vector: number[] })[];
};

class FileIndex implements VectorIndex {
  constructor(private chunks: (Chunk & { vector: number[] })[]) {}

  static async open(cfg: VoyageConfig): Promise<FileIndex> {
    const fresh = await loadChunks();

    let stored: StoredIndex | null = null;
    try {
      stored = JSON.parse(await readFile(INDEX_PATH, "utf8")) as StoredIndex;
    } catch {
      stored = null; // missing or corrupt — full rebuild
    }

    const known = new Map<string, number[]>();
    if (stored && stored.embedModel === cfg.embedModel) {
      for (const c of stored.chunks) known.set(c.hash, c.vector);
    }
    const embedded = await embedMissing(fresh, known, cfg);

    const chunks = fresh.map((c) => ({
      ...c,
      vector: known.get(c.hash) ?? embedded.get(c.hash)!,
    }));

    const next: StoredIndex = {
      embedModel: cfg.embedModel,
      builtAt: new Date().toISOString(),
      chunks,
    };
    try {
      await mkdir(path.dirname(INDEX_PATH), { recursive: true });
      await writeFile(INDEX_PATH, JSON.stringify(next));
    } catch {
      // read-only filesystem (serverless) — run with the in-memory index;
      // each cold start re-embeds, which is fine at this corpus size
      console.warn("[rag] index cache not writable — running in-memory only");
    }

    return new FileIndex(chunks);
  }

  async search(queryVector: number[], k: number): Promise<SearchHit[]> {
    return this.chunks
      .map(({ vector, ...c }) => ({ ...c, sim: cosine(queryVector, vector) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, k);
  }
}

/* ---------- pgvector backend ---------- */

class PgIndex implements VectorIndex {
  constructor(private pool: Pool) {}

  static async open(connectionString: string, cfg: VoyageConfig): Promise<PgIndex> {
    const pool = new Pool({ connectionString, max: 5 });
    const fresh = await loadChunks();

    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

    // dims depend on the embedding model; probe with one embed if the table
    // doesn't exist yet, otherwise trust the existing schema
    const existing = await pool.query(
      "SELECT to_regclass($1) AS t",
      [PG_TABLE]
    );
    if (!existing.rows[0].t) {
      const [probe] = await embed(["dimension probe"], cfg, "document");
      await pool.query(`
        CREATE TABLE ${PG_TABLE} (
          id text PRIMARY KEY,
          doc_id text NOT NULL,
          title text NOT NULL,
          url text NOT NULL,
          heading text NOT NULL,
          text text NOT NULL,
          hash text NOT NULL,
          embed_model text NOT NULL,
          embedding vector(${probe.length}) NOT NULL
        )`);
    }

    // incremental sync: reuse vectors for unchanged hashes, embed the rest,
    // upsert everything, drop chunks that no longer exist in the corpus
    const stored = await pool.query(
      `SELECT hash, embedding::text AS embedding FROM ${PG_TABLE} WHERE embed_model = $1`,
      [cfg.embedModel]
    );
    const known = new Map<string, number[]>(
      stored.rows.map((r: { hash: string; embedding: string }) => [
        r.hash,
        JSON.parse(r.embedding) as number[],
      ])
    );
    const embedded = await embedMissing(fresh, known, cfg);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const c of fresh) {
        const vector = known.get(c.hash) ?? embedded.get(c.hash)!;
        await client.query(
          `INSERT INTO ${PG_TABLE} (id, doc_id, title, url, heading, text, hash, embed_model, embedding)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector)
           ON CONFLICT (id) DO UPDATE SET
             doc_id = EXCLUDED.doc_id, title = EXCLUDED.title, url = EXCLUDED.url,
             heading = EXCLUDED.heading, text = EXCLUDED.text, hash = EXCLUDED.hash,
             embed_model = EXCLUDED.embed_model, embedding = EXCLUDED.embedding`,
          [c.id, c.docId, c.title, c.url, c.heading, c.text, c.hash, cfg.embedModel, JSON.stringify(vector)]
        );
      }
      await client.query(
        `DELETE FROM ${PG_TABLE} WHERE NOT (id = ANY($1))`,
        [fresh.map((c) => c.id)]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return new PgIndex(pool);
  }

  async search(queryVector: number[], k: number): Promise<SearchHit[]> {
    // <=> is pgvector's cosine distance; similarity = 1 - distance
    const res = await this.pool.query(
      `SELECT id, doc_id, title, url, heading, text, hash,
              1 - (embedding <=> $1::vector) AS sim
       FROM ${PG_TABLE}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(queryVector), k]
    );
    return res.rows.map(
      (r: { id: string; doc_id: string; title: string; url: string; heading: string; text: string; hash: string; sim: string | number }) => ({
        id: r.id,
        docId: r.doc_id,
        title: r.title,
        url: r.url,
        heading: r.heading,
        text: r.text,
        hash: r.hash,
        sim: Number(r.sim),
      })
    );
  }
}

/* ---------- factory ---------- */

export async function openIndex(cfg: VoyageConfig): Promise<VectorIndex> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    console.log("[rag] vector store: Postgres + pgvector");
    return PgIndex.open(connectionString, cfg);
  }
  console.log("[rag] vector store: local file index (set DATABASE_URL for pgvector)");
  return FileIndex.open(cfg);
}
