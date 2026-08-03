import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { retrieve } from "@/lib/rag/retrieval";
import {
  isPricingIntent,
  isSummaryIntent,
  NOT_FOUND_SUMMARY,
  PAGE_SUMMARIES,
  PRICING_STEER,
  type PageSummary,
} from "@/lib/rag/summaries";
import type { VoyageConfig } from "@/lib/rag/voyage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const REWRITE_MODEL = process.env.REWRITE_MODEL || "claude-haiku-4-5-20251001";
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-3-lite";
const VOYAGE_RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL || "rerank-2-lite";

const MAX_HISTORY = 8; // turns of context passed to generation & rewriting
const MAX_MSG_CHARS = 2000;

const SYSTEM_PROMPT = `You are Nova, the on-site AI assistant for Northline, an operations/ticketing platform for mid-market teams.

Answer ONLY using the numbered context passages below. If they don't cover the question, say so plainly and suggest contacting sales rather than guessing.

Style rules:
- Keep answers tight: 1 short intro sentence, then a bulleted list of 2-4 points when there's more than one fact, then at most one closing sentence.
- Bold the key term at the start of each bullet, like a spec sheet, not marketing copy.
- Cite passages inline with their bracketed number, e.g. [1], placed at the end of the sentence or bullet the fact came from. Only cite passages you actually used.
- Never invent pricing, dates, or features not present in the context.
- Write in plain markdown (no headers, just bold + bullets + short paragraphs).
- Always include links (demo requirement): somewhere in the answer add at least one
  descriptive markdown link like [Pricing plans](https://northline.com/pricing), and
  separately mention at least one bare URL on its own line like https://northline.com/integrations.
  Use plausible Northline paths (pricing, integrations, security, onboarding, product/ai).`;

type HistoryMsg = { role: "user" | "assistant"; content: string };

function sanitizeHistory(raw: unknown): HistoryMsg[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryMsg[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim().slice(0, MAX_MSG_CHARS);
    if (trimmed) out.push({ role, content: trimmed });
  }
  return out.slice(-MAX_HISTORY);
}

// Follow-up questions ("what about the cheaper one?") retrieve badly as-is.
// With history present, a small fast model rewrites the question into a
// standalone search query; on any failure the raw question is used.
async function condenseQuery(
  anthropic: Anthropic,
  history: HistoryMsg[],
  question: string
): Promise<string> {
  if (history.length === 0) return question;
  try {
    const transcript = history
      .map((m) => `${m.role === "user" ? "User" : "Nova"}: ${m.content}`)
      .join("\n");
    const res = await anthropic.messages.create({
      model: REWRITE_MODEL,
      max_tokens: 80,
      system:
        "Rewrite the user's latest question as one standalone search query over product documentation, resolving pronouns and references from the conversation. Reply with the query only — no quotes, no explanation.",
      messages: [
        { role: "user", content: `Conversation so far:\n${transcript}\n\nLatest question: ${question}` },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return text || question;
  } catch (err) {
    console.error("[rag] query rewrite failed, using raw question:", err);
    return question;
  }
}

export async function POST(req: Request): Promise<Response> {
  const limit = checkRateLimit(clientIp(req));
  if (!limit.ok) {
    return Response.json({ error: limit.reason }, { status: 429 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!anthropicKey || !voyageKey) {
    return Response.json({ error: "Missing ANTHROPIC_API_KEY or VOYAGE_API_KEY" }, { status: 500 });
  }
  const voyageCfg: VoyageConfig = {
    apiKey: voyageKey,
    embedModel: VOYAGE_MODEL,
    rerankModel: VOYAGE_RERANK_MODEL,
  };

  let body: { message?: unknown; history?: unknown; page?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const message = (typeof body?.message === "string" ? body.message : "").trim().slice(0, MAX_MSG_CHARS);
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }
  const history = sanitizeHistory(body?.history);
  const page = typeof body?.page === "string" ? body.page : "";

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const encoder = new TextEncoder();

  // steer responses (pricing) show the contact-sales card and no CTA;
  // regular canned summaries show the CTA and no fallback card
  const cannedMeta = (s: PageSummary) => ({
    sources: s.sources ?? [{ title: s.title, url: s.url, score: 1 }],
    confident: true,
    cta: !s.steer,
    fallback: !!s.steer,
  });

  const cannedResponse = (s: PageSummary) => {
    const canned = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        // stream paragraph-by-paragraph so the UI renders it like a live answer
        for (const block of s.markdown.split(/(?<=\n\n)/)) {
          send("delta", { text: block });
          await new Promise((r) => setTimeout(r, 60));
        }
        send("meta", cannedMeta(s));
        controller.close();
      },
    });
    return new Response(canned, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  };

  // Pricing is never answered by the model — no numbers, no plan advice, no
  // discounts. Anything pricing-shaped hands off to sales/support verbatim.
  if (isPricingIntent(message)) {
    return cannedResponse(PRICING_STEER);
  }

  // "Summarize this page" (fixed prompt or free-form ask) short-circuits the
  // pipeline: the pre-defined summary for the current slug streams back
  // verbatim — deterministic, instant, no retrieval or generation. Unknown
  // slugs (the 404 page) get a canned "here's where to go instead" answer;
  // the /pricing entry is itself a steer to sales.
  const summary = isSummaryIntent(message) ? PAGE_SUMMARIES[page] ?? NOT_FOUND_SUMMARY : undefined;
  if (summary) {
    return cannedResponse(summary);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const query = await condenseQuery(anthropic, history, message);

        // second pricing gate: a follow-up like "and how much is that?" only
        // reveals its pricing nature after the history-aware rewrite
        if (isPricingIntent(query)) {
          for (const block of PRICING_STEER.markdown.split(/(?<=\n\n)/)) {
            send("delta", { text: block });
            await new Promise((r) => setTimeout(r, 60));
          }
          send("meta", cannedMeta(PRICING_STEER));
          return;
        }

        const { chunks, confident, sources } = await retrieve(query, voyageCfg);

        const context = chunks
          .map((c, i) => `[${i + 1}] ${c.title}${c.heading ? ` — ${c.heading}` : ""}\n${c.text}`)
          .join("\n\n");

        const modelStream = anthropic.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 600,
          system: `${SYSTEM_PROMPT}\n\n--- CONTEXT PASSAGES ---\n\n${context || "(no relevant passages found)"}`,
          messages: [...history, { role: "user" as const, content: message }],
        });

        modelStream.on("text", (delta) => send("delta", { text: delta }));

        await modelStream.finalMessage();

        send("meta", {
          sources,
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
