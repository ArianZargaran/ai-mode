import { createHash } from "node:crypto";

// Markdown-aware chunking: docs split into heading-scoped sections, sections
// packed into overlapping windows on paragraph boundaries. Each chunk keeps
// its doc metadata plus the heading path, so citations can point at the
// section, not just the file.

export type DocInput = {
  id: string; // filename
  title: string;
  url: string;
  body: string; // markdown, frontmatter already stripped
};

export type Chunk = {
  id: string; // `${docId}#${n}`
  docId: string;
  title: string;
  url: string;
  heading: string; // nearest heading ("" for preamble)
  text: string;
  hash: string; // content hash — drives incremental re-embedding
};

const TARGET = 900; // chars per chunk (~220 tokens)
const OVERLAP = 1; // paragraphs carried over between consecutive windows

function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

type Section = { heading: string; paragraphs: string[] };

function sections(body: string): Section[] {
  const out: Section[] = [{ heading: "", paragraphs: [] }];
  for (const block of body.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const h = trimmed.match(/^#{1,4}\s+(.+)$/m);
    if (h && trimmed.startsWith("#")) {
      out.push({ heading: h[1].trim(), paragraphs: [] });
      const rest = trimmed.replace(/^#{1,4}\s+.+$/m, "").trim();
      if (rest) out[out.length - 1].paragraphs.push(rest);
    } else {
      out[out.length - 1].paragraphs.push(trimmed);
    }
  }
  return out.filter((s) => s.paragraphs.length > 0);
}

export function chunkDoc(doc: DocInput): Chunk[] {
  const chunks: Chunk[] = [];

  for (const section of sections(doc.body)) {
    let window: string[] = [];
    let size = 0;

    const flush = () => {
      if (window.length === 0) return;
      const text = window.join("\n\n");
      const n = chunks.length;
      chunks.push({
        id: `${doc.id}#${n}`,
        docId: doc.id,
        title: doc.title,
        url: doc.url,
        heading: section.heading,
        text,
        hash: sha1(`${doc.title}|${section.heading}|${text}`),
      });
    };

    for (const p of section.paragraphs) {
      if (size + p.length > TARGET && window.length > 0) {
        flush();
        window = window.slice(-OVERLAP);
        size = window.reduce((a, b) => a + b.length, 0);
      }
      window.push(p);
      size += p.length;
    }
    flush();
  }

  return chunks;
}

// text sent to the embedder: title + heading give the vector doc-level context
export function embeddingText(c: Chunk): string {
  return [c.title, c.heading, c.text].filter(Boolean).join("\n");
}
