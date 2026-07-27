# Ask Nova — AI Mode (demo mock)

> **This is a demo / mock project.** "Northline" and its AI assistant "Nova" are
> fictional. The marketing pages, docs, pricing, and integrations are invented
> content used to showcase an on‑site, RAG‑backed AI assistant pattern — a
> consent‑gated, streaming chat surface with a citation rail. It is not a real
> product and is not intended for production use.

A Next.js re‑implementation of an "Ask AI" web assistant: a persistent **AI‑mode
input** that expands into a full **conversation dialog**, answers questions about
the (fictional) Northline product using retrieval over local markdown docs, and
streams responses from Claude with cited source pages.

---

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **@anthropic-ai/sdk** — streaming chat completions (Claude)
- **Voyage AI embeddings** — retrieval / RAG over `docs/*.md`
- No UI framework — a single global stylesheet (`src/app/globals.css`), theme‑aware (light/dark)

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the keys
npm run dev            # http://localhost:3000
```

### Environment

| Variable            | Required | Default            | Notes                                  |
| ------------------- | -------- | ------------------ | -------------------------------------- |
| `ANTHROPIC_API_KEY` | yes      | —                  | From the Anthropic Console             |
| `VOYAGE_API_KEY`    | yes      | —                  | From the Voyage AI dashboard           |
| `CLAUDE_MODEL`      | no       | `claude-sonnet-5`  | Override the chat model                |
| `VOYAGE_MODEL`      | no       | `voyage-3-lite`    | Override the embedding model           |

`.env` is gitignored — keys are read server‑side only (in the route handler) and
are never exposed to the client.

### Scripts

- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build & serve
- `npm run lint` — Next/ESLint

---

## How it works

### Retrieval (RAG)

`src/lib/retrieval.ts` reads every `docs/*.md` file (front‑matter `title` / `url`
+ body), embeds them once via Voyage, and caches the index in the server
process. On each question it embeds the query, ranks docs by cosine similarity,
and returns the top **3** matches; a match is "confident" when the top score
≥ **0.35**.

### API — `POST /api/ask`

Server route handler (`src/app/api/ask/route.ts`). Runs retrieval, then streams
Claude's answer back as **Server‑Sent Events**:

| Event   | Payload                                             |
| ------- | --------------------------------------------------- |
| `delta` | `{ text }` — incremental answer tokens              |
| `meta`  | `{ sources, confident, cta, fallback }` — sent once at the end |
| `error` | `{ message }`                                       |

The doc index is built lazily on the first request and cached (a shared promise,
retried on failure).

---

## The AI‑mode input

A single **persistent** instance lives in the root layout (`src/app/layout.tsx`),
so its state survives client‑side navigation between pages and its popular
prompts follow the current route (`usePathname`).

### States

| State       | Look                                            |
| ----------- | ----------------------------------------------- |
| `collapsed` | small `✦ Ask AI` pill                           |
| `expanded`  | full‑width input bar (`Ask AI…` + send)         |
| `active`    | expanded bar **+** "Popular prompts" panel above it |

### Transitions

- **Initial load** → `expanded` (one‑time fade‑in/rise entrance).
- `expanded` + scroll / click‑outside → `collapsed`.
- `expanded` + click → `active` (focus input).
- `collapsed` + click → `expanded` → `active` (staged).
- `active` → `expanded` via the panel's ✕; → `collapsed` via click‑outside / Esc.
- Submitting a question (or a popular prompt) opens the dialog through the
  consent gate; the input drops out of `active` first so nothing lingers behind
  the dialog.

The send button shows an **up‑arrow** when there's text (submit); when the input
is empty but a conversation exists it becomes an **expand** icon that re‑opens
the dialog.

### Popular prompts

Always led by a fixed **"Summarize this page"** (paragraph icon), followed by two
route‑specific prompts (return‑arrow icon). Prompt sets are keyed by pathname.

---

## The dialog

One centered dialog hosts two views:

- **Consent** — a one‑time notice; **Accept** proceeds, **Cancel** dismisses.
- **Conversation** — the chat, shown after consent.

### Controls

| Control            | Result                          |
| ------------------ | ------------------------------- |
| Detached ✕ (below) | close → input `collapsed`       |
| Cancel (consent)   | close → input `collapsed`       |
| Esc                | close → input `collapsed`       |
| Minimize `−` (top‑right) | close → input `expanded`   |
| Tap the overlay    | close                           |

Page scroll is locked while the dialog is open (with scrollbar‑width
compensation, so nothing shifts).

### Conversation layout

Messages are grouped into **Q&A turns**. Each turn:

- an **"✦ AI response"** header,
- the **question** — left‑aligned, in a light bubble,
- the **answer** — plain text (no bubble),
- a per‑answer **rail** (right column, top‑aligned with the question):
  **Quick actions** (Get started CTA) + **Relevant pages** (cited sources).

The rail is always present; while an answer streams it shows a size‑matched
**shimmer skeleton** (so there's no layout jump when sources arrive). The whole
panel scrolls as one with a single right‑edge scrollbar and a top/bottom fade
mask. Feedback icons (thumb up/down, copy) are outlined and color on click;
disliking reveals a persistent "Not quite what you needed?" sales card and
scrolls it into view.

### Links in answers (streaming‑safe)

Answers may contain links. Rendering markdown on a **partial** stream risks
emitting a half‑open `<a>` tag and breaking the DOM, so the inline parser only
ever converts **complete, atomic** link tokens:

- `[copy](url)` → a **pill** link,
- bare `https://…` → a **purple underlined** link,
- input is HTML‑escaped first; markdown links are stashed behind a NUL sentinel
  before bare URLs are auto‑linked (so a pill's href isn't re‑linked); the URL
  character class forbids spaces/quotes/`)` and only allows `http(s)`/relative.

Worst case is a one‑frame flicker where a not‑yet‑closed link shows as text —
never malformed HTML. (For the demo, the system prompt seeds each answer with a
sample markdown link and a bare URL.)

### Responsive

On screens ≤ 640px the dialog becomes a **bottom drawer** — it slides up from the
bottom, has no detached ✕, and closes by tapping the overlay or dragging it down.
The AI‑mode input goes full‑width.

---

## Project structure

```
app/
├─ docs/                    # fictional Northline knowledge base (RAG source)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx         # root layout — hosts the persistent <AiModeInput/>
│  │  ├─ page.tsx           # home; also /platform, /solutions, /pricing
│  │  ├─ globals.css        # all styling (theme‑aware)
│  │  └─ api/ask/route.ts   # SSE chat + retrieval endpoint
│  ├─ components/
│  │  ├─ AiModeInput.tsx    # the input state machine + consent + conversation
│  │  ├─ FlowCanvas.tsx     # ambient hero particle canvas
│  │  └─ NavBar.tsx         # top navigation
│  └─ lib/
│     └─ retrieval.ts       # DocIndex — embed + cosine search
└─ .env.example
```
