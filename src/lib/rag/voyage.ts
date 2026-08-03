// Thin Voyage AI client: embeddings + reranking. Both endpoints take the
// same bearer key. Errors surface with status + body so retrieval failures
// are debuggable from the server log.

const EMBED_URL = "https://api.voyageai.com/v1/embeddings";
const RERANK_URL = "https://api.voyageai.com/v1/rerank";

export type VoyageConfig = {
  apiKey: string;
  embedModel: string;
  rerankModel: string;
};

async function post(url: string, apiKey: string, payload: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Voyage request failed (${res.status} ${url}): ${detail.slice(0, 300)}`);
  }
  return res.json();
}

export async function embed(
  texts: string[],
  cfg: VoyageConfig,
  inputType: "document" | "query"
): Promise<number[][]> {
  const data = (await post(EMBED_URL, cfg.apiKey, {
    input: texts,
    model: cfg.embedModel,
    input_type: inputType,
  })) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

export type Reranked = { index: number; score: number };

export async function rerank(
  query: string,
  documents: string[],
  cfg: VoyageConfig,
  topK: number
): Promise<Reranked[]> {
  const data = (await post(RERANK_URL, cfg.apiKey, {
    query,
    documents,
    model: cfg.rerankModel,
    top_k: topK,
  })) as { data: { index: number; relevance_score: number }[] };
  return data.data.map((d) => ({ index: d.index, score: d.relevance_score }));
}
