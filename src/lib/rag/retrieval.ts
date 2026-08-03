import { openIndex, type SearchHit, type VectorIndex } from "./store";
import { embed, rerank, type VoyageConfig } from "./voyage";

// Retrieval pipeline: dense recall over the chunk index (cosine), then a
// cross-encoder rerank pass (Voyage rerank) over the recalled set. Rerank
// relevance scores drive both citation ordering and the confidence gate
// that decides CTA vs. fall-back-to-sales in the UI.

const RECALL_K = 12; // chunks pulled by cosine before reranking
const RERANK_K = 4; // chunks kept as model context
const CONFIDENT_AT = 0.5; // top rerank score ≥ this → confident answer
const CITE_FLOOR = 0.2; // chunks below this never appear as citations

export type RetrievedChunk = SearchHit & { score: number };
export type Retrieval = {
  chunks: RetrievedChunk[];
  confident: boolean;
  // one entry per source doc (best chunk wins), for the UI's source rail
  sources: { title: string; url: string; score: number }[];
};

// the index is opened once per server process and reused; both backends
// (pgvector / file) sync incrementally on open — only changed chunks re-embed
let indexPromise: Promise<VectorIndex> | null = null;

export function getIndex(cfg: VoyageConfig): Promise<VectorIndex> {
  if (!indexPromise) {
    indexPromise = openIndex(cfg);
    indexPromise.catch(() => {
      indexPromise = null; // allow retry on next request
    });
  }
  return indexPromise;
}

export async function retrieve(query: string, cfg: VoyageConfig): Promise<Retrieval> {
  const index = await getIndex(cfg);

  const [qv] = await embed([query], cfg, "query");
  const recalled = await index.search(qv, RECALL_K);
  if (recalled.length === 0) return { chunks: [], confident: false, sources: [] };

  const ranked = await rerank(
    query,
    recalled.map((c) => `${c.title} — ${c.heading}\n${c.text}`),
    cfg,
    RERANK_K
  );

  const chunks: RetrievedChunk[] = ranked.map((r) => ({ ...recalled[r.index], score: r.score }));
  const confident = chunks.length > 0 && chunks[0].score >= CONFIDENT_AT;

  const bestPerDoc = new Map<string, RetrievedChunk>();
  for (const c of chunks) {
    if (c.score < CITE_FLOOR) continue;
    const prev = bestPerDoc.get(c.docId);
    if (!prev || c.score > prev.score) bestPerDoc.set(c.docId, c);
  }
  const sources = [...bestPerDoc.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => ({ title: c.title, url: c.url, score: Number(c.score.toFixed(3)) }));

  return { chunks, confident, sources };
}
