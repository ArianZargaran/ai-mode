import Anthropic from "@anthropic-ai/sdk";
import { DocIndex } from "@/lib/retrieval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-3-lite";

const SYSTEM_PROMPT = `You are Nova, the on-site AI assistant for Northline, an operations/ticketing platform for mid-market teams.

Answer ONLY using the context documents provided below. If the context doesn't cover the question, say so plainly and suggest contacting sales rather than guessing.

Style rules:
- Keep answers tight: 1 short intro sentence, then a bulleted list of 2-4 points when there's more than one fact, then at most one closing sentence.
- Bold the key term at the start of each bullet, like a spec sheet, not marketing copy.
- Never invent pricing, dates, or features not present in the context.
- Write in plain markdown (no headers, just bold + bullets + short paragraphs).`;

// Build the doc index once per server process and reuse it across requests.
// A promise is cached so concurrent first-requests share a single build.
let indexPromise: Promise<DocIndex> | null = null;

function getIndex(): Promise<DocIndex> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const apiKey = process.env.VOYAGE_API_KEY;
      if (!apiKey) throw new Error("Missing VOYAGE_API_KEY");
      const index = new DocIndex({ apiKey, model: VOYAGE_MODEL });
      const count = await index.build();
      console.log(`Indexed ${count} docs via Voyage (${VOYAGE_MODEL}).`);
      return index;
    })();
    // Allow a retry on a later request if the build failed.
    indexPromise.catch(() => {
      indexPromise = null;
    });
  }
  return indexPromise;
}

export async function POST(req: Request): Promise<Response> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return Response.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  let body: { message?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const message = (typeof body?.message === "string" ? body.message : "").trim().slice(0, 2000);
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const index = await getIndex();
        const { matches, confident } = await index.search(message);
        const context = matches.map((m) => `### ${m.title}\n${m.body}`).join("\n\n");

        const modelStream = anthropic.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 500,
          system: `${SYSTEM_PROMPT}\n\n--- CONTEXT DOCUMENTS ---\n\n${context || "(no relevant documents found)"}`,
          messages: [{ role: "user", content: message }],
        });

        modelStream.on("text", (delta) => send("delta", { text: delta }));

        await modelStream.finalMessage();

        send("meta", {
          sources: matches.map((m) => ({ title: m.title, url: m.url, score: Number(m.score.toFixed(3)) })),
          confident,
          cta: confident,
          fallback: !confident,
        });
      } catch (err) {
        console.error("Request failed:", err);
        send("error", { message: "Something went wrong handling that question." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
