"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Source = { title: string; url: string; score: number };
type Meta = { sources: Source[]; confident: boolean; cta: boolean; fallback: boolean };
type AiMsg = { role: "ai"; text: string; done: boolean; error?: string; meta?: Meta };
type UserMsg = { role: "user"; text: string };
type Msg = UserMsg | AiMsg;
type Mode = "collapsed" | "expanded" | "active";

// accent (currentColor) sparkle — used in the ai-mode input bar and as the AI
// avatar / header mark in the conversation
const SPARK_ACCENT = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" fill="currentColor" />
    <path d="M18.5 14l.6 2.1L21 16.5l-1.9.6L18.5 19l-.6-1.9L16 16.5l1.9-.4.6-2.1z" fill="currentColor" opacity="0.7" />
  </svg>
);

const RETURN_ICON = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M9 10L5 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 14h9a5 5 0 0 0 5-5V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// paragraph icon — marks the fixed "Summarize this page" option
const PARAGRAPH_ICON = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M5 6h14M5 10h14M5 14h9M5 18h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const SUMMARIZE_PROMPT = "Summarize this page";

// diagonal two-pointer "expand" icon — shown on the send button when the input
// is empty but a conversation exists (click re-opens the dialog)
const EXPAND_ICON = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M14 4h6v6M20 4l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 20H4v-6M4 20l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UP_ARROW_ICON = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// fires the entrance animation once per full page load (survives remounts
// when the chat overlay opens/closes, but resets on a real page reload)
let hasEntered = false;

// popular prompts shown in the active state — page-dependent, keyed by route
const DEFAULT_PROMPTS = [
  "Does Northline have AI features?",
  "What does Northline cost?",
  "How does onboarding work?",
];
const PROMPTS_BY_ROUTE: Record<string, string[]> = {
  "/": DEFAULT_PROMPTS,
  "/pricing": [
    "What does Northline cost?",
    "Is there a free trial?",
    "Do you offer annual billing?",
  ],
  "/platform": [
    "Does Northline have AI features?",
    "What integrations are supported?",
    "How does routing work?",
  ],
  "/solutions": [
    "How does Northline help ops teams?",
    "How does onboarding work?",
    "Does Northline have AI features?",
  ],
};

// minimal markdown: **bold**, blank-line paragraphs, "- " bullet lists
// Inline markdown. IMPORTANT: `s` is already HTML-escaped, and this runs on the
// PARTIAL buffer during streaming — so we only ever emit COMPLETE, atomic <a>
// tags (a link token must be fully matched, incl. its closing paren, before it
// becomes markup). Half-typed syntax stays as inert escaped text → the HTML is
// always well-formed and can't break the DOM. URL charclass forbids
// spaces/quotes/`)` so an href can't break out, and only http(s)/relative pass.
function inline(s: string): string {
  let out = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // 1) complete markdown links [copy](url) → pill. Stash so autolink can't
  //    touch their href.
  const stash: string[] = [];
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)"']+|\/[^\s)"']+)\)/g,
    (_m, copy: string, url: string) => {
      const i =
        stash.push(
          `<a class="lnk-pill" href="${url}" target="_blank" rel="noopener noreferrer">${copy}</a>`
        ) - 1;
      return `\u0000${i}\u0000`;
    }
  );

  // 2) bare URLs → purple underlined link
  out = out.replace(
    /(https?:\/\/[^\s<"']+)/g,
    (url) => `<a class="lnk" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );

  // 3) restore stashed pills
  out = out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => stash[Number(i)]);
  return out;
}
function mdToHtml(src: string): string {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks = esc.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      const isList = lines.length > 0 && lines.every((l) => /^\s*-\s+/.test(l));
      if (isList) {
        const items = lines
          .map((l) => "<li>" + inline(l.replace(/^\s*-\s+/, "")) + "</li>")
          .join("");
        return "<ul>" + items + "</ul>";
      }
      return "<p>" + inline(lines.join("<br>")) + "</p>";
    })
    .join("");
}

function MessageActions({ msg }: { msg: AiMsg }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);
  // once the user dislikes, the sales card stays for good (latched)
  const [salesShown, setSalesShown] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // when the sales card appears, scroll it into view (centered)
  useEffect(() => {
    if (salesShown) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [salesShown]);

  const copy = () => {
    const plain = msg.text.replace(/\*\*/g, "").trim();
    if (navigator.clipboard) navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <div className="msg-actions">
        <button
          className={"up" + (vote === "up" ? " active" : "")}
          title="Good response"
          onClick={() => setVote((v) => (v === "up" ? null : "up"))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
        </button>
        <button
          className={"down" + (vote === "down" ? " active" : "")}
          title="Poor response"
          onClick={() => {
            setVote((v) => (v === "down" ? null : "down"));
            setSalesShown(true);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z" />
            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
          </svg>
        </button>
        <button className="copy" title="Copy" onClick={copy}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <span className="copied" hidden={!copied}>Copied</span>
      </div>
      {salesShown && (
        <div className="fallback-card" ref={cardRef}>
          <p className="title">Not quite what you needed?</p>
          <p className="body">Connect with our sales team for a walkthrough tailored to your setup.</p>
          <a href="#">Contact sales &rarr;</a>
        </div>
      )}
    </>
  );
}

// per-answer sidebar: quick actions + relevant pages, or a skeleton while the
// answer is still streaming (before its meta/sources arrive)
function AnswerRail({ msg }: { msg: AiMsg }) {
  const meta = msg.meta;
  const loading = !msg.done && !msg.error;
  return (
    <aside className="answer-rail">
      <div>
        <h5>Quick actions</h5>
        <a className="quick-cta" href="#">Get started &rarr;</a>
      </div>
      <div>
        <h5>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Relevant pages
        </h5>
        {meta && meta.sources.length > 0 ? (
          <div className="src-list">
            {meta.sources.map((s, i) => (
              <a className="src" href="#" key={i}>
                <div className="t">{s.title}</div>
                <div className="d">
                  <span>{s.url}</span>
                  <span className="score">{s.score.toFixed(2)}</span>
                </div>
              </a>
            ))}
          </div>
        ) : loading ? (
          <div className="src-list">
            {[0, 1, 2].map((k) => (
              <div className="src skeleton" key={k} aria-hidden="true">
                <span className="sk-line sk-t" />
                <span className="sk-line sk-d" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default function AiModeInput() {
  // ai-mode input state machine
  const [mode, setMode] = useState<Mode>("expanded");
  const [aiInput, setAiInput] = useState("");
  // start in the entering state on the very first mount so the class is present
  // at first paint — otherwise the bar flashes its final position, then snaps
  // back to the animation's start (the "jump" on refresh)
  const [entering, setEntering] = useState(!hasEntered);
  // keep the popular-prompts panel mounted through its exit animation
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelIn, setPanelIn] = useState(false);

  // chat / consent state
  const [view, setView] = useState<"closed" | "consent" | "panel">("closed");
  const [consented, setConsented] = useState(false);
  const [pending, setPending] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  // always-fresh mirror of `messages` — streamAnswer's closure only refreshes
  // on length changes, so it reads history through this ref instead
  const messagesRef = useRef<Msg[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [wide, setWide] = useState(false);
  const [dragY, setDragY] = useState(0); // mobile drawer drag-to-close offset
  const dragStart = useRef<number | null>(null);
  const [swapping, setSwapping] = useState(false); // crossfade consent <-> chat

  // prompts follow the page the persistent widget is currently on
  const pathname = usePathname();
  const prompts = PROMPTS_BY_ROUTE[pathname] ?? DEFAULT_PROMPTS;
  // fresh mirror for streamAnswer (its closure refreshes only on message-count
  // changes, so a route change between questions would otherwise go stale)
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const rootRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollBottom = useCallback(() => {
    const t = threadRef.current;
    if (t) t.scrollTop = t.scrollHeight;
  }, []);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth > 640);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // play the entrance (fade + rise) once on first page load, then clear the
  // class after it finishes so remounts (chat open/close) don't replay it
  useEffect(() => {
    if (hasEntered) return;
    hasEntered = true;
    const id = setTimeout(() => setEntering(false), 950);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    scrollBottom();
  }, [messages, scrollBottom]);

  // lock page scroll while the dialog (consent or chat) is open, compensating
  // for the removed scrollbar so the page doesn't shift underneath
  useEffect(() => {
    if (view === "closed") return;
    const { body, documentElement: html } = document;
    const scrollbarW = window.innerWidth - html.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [view]);

  // focus the chat composer when the panel opens
  useEffect(() => {
    if (view === "panel") {
      const id = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(id);
    }
  }, [view]);

  // focus the ai-mode field whenever it becomes active
  useEffect(() => {
    if (mode === "active") {
      const id = setTimeout(() => aiInputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [mode]);

  // mount the popular-prompts panel on active, animate it out before unmounting
  useEffect(() => {
    if (mode === "active") {
      setPanelMounted(true);
      const raf = requestAnimationFrame(() => setPanelIn(true));
      return () => cancelAnimationFrame(raf);
    }
    setPanelIn(false);
    if (panelMounted) {
      const id = setTimeout(() => setPanelMounted(false), 300);
      return () => clearTimeout(id);
    }
  }, [mode, panelMounted]);

  const closeOverlay = useCallback(() => {
    setView("closed");
    setMode("collapsed");
    setSwapping(false);
  }, []);

  // minimize (dialog "−"): dismiss the overlay but leave the input expanded
  const minimizeOverlay = useCallback(() => {
    setView("closed");
    setMode("expanded");
    setSwapping(false);
  }, []);

  // collapse the ai-mode input on click-outside (any state) and scroll (expanded only)
  useEffect(() => {
    if (view !== "closed") return;
    const onDown = (e: MouseEvent) => {
      if (mode === "collapsed") return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMode("collapsed");
    };
    const onScroll = () => {
      if (mode === "expanded") setMode("collapsed");
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [mode, view]);

  // Escape: close an open overlay, else collapse an active input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view !== "closed") closeOverlay();
      else if (mode !== "collapsed") setMode("collapsed");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view, mode, closeOverlay]);

  const streamAnswer = useCallback(
    async (question: string) => {
      setBusy(true);
      // snapshot prior completed turns BEFORE appending the new question, so
      // the server sees exactly the preceding conversation (no dup of the
      // current question, no empty placeholder)
      const history = messagesRef.current
        .filter((m) => m.role === "user" || (m.done && !m.error && m.text))
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        }));
      const aiIndex = messages.length + 1;
      setMessages((prev) => [
        ...prev,
        { role: "user", text: question },
        { role: "ai", text: "", done: false },
      ]);

      const patchAi = (patch: Partial<AiMsg>) => {
        setMessages((prev) => {
          const next = prev.slice();
          const cur = next[aiIndex] as AiMsg | undefined;
          if (cur && cur.role === "ai") next[aiIndex] = { ...cur, ...patch };
          return next;
        });
      };

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: question, history, page: pathnameRef.current }),
        });
        if (!res.ok || !res.body) throw new Error("Request failed (" + res.status + ")");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let carry = "";
        let buffer = "";

        const handleEvent = (raw: string) => {
          let eventType = "message";
          const dataLines: string[] = [];
          raw.split("\n").forEach((line) => {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          });
          if (dataLines.length === 0) return;
          let data: { text?: string; message?: string } & Partial<Meta>;
          try {
            data = JSON.parse(dataLines.join("\n"));
          } catch {
            return;
          }
          if (eventType === "delta") {
            buffer += data.text ?? "";
            patchAi({ text: buffer });
          } else if (eventType === "error") {
            patchAi({ done: true, error: data.message });
          } else if (eventType === "meta") {
            patchAi({
              done: true,
              meta: {
                sources: data.sources ?? [],
                confident: !!data.confident,
                cta: !!data.cta,
                fallback: !!data.fallback,
              },
            });
          }
        };

        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          carry += decoder.decode(chunk.value, { stream: true });
          const events = carry.split("\n\n");
          carry = events.pop() ?? "";
          events.forEach(handleEvent);
        }
      } catch {
        patchAi({
          done: true,
          error: "Couldn’t reach Nova. Check that the server is running and try again.",
        });
      } finally {
        setBusy(false);
      }
    },
    [messages.length]
  );

  // Leaving the ai-mode input for the dialog: it must never sit in "active"
  // behind the dialog, and the options panel must drop instantly (not animate)
  // so closing the dialog can't replay the panel's exit.
  const dropActive = () => {
    setPanelIn(false);
    setPanelMounted(false);
    setMode("collapsed");
  };

  // Submit a question: route through the consent gate the first time, then chat.
  const submitQuestion = (text: string) => {
    const v = text.trim();
    if (!v) return;
    setAiInput("");
    dropActive();
    if (consented) {
      setView("panel");
      streamAnswer(v);
    } else {
      setPending(v);
      setView("consent");
    }
  };

  const accept = () => {
    // crossfade the dialog from the legal wall to the conversation
    setSwapping(true);
    const q = pending;
    setPending("");
    setTimeout(() => {
      setConsented(true);
      setView("panel");
      if (q) streamAnswer(q);
      // paint the new content at opacity 0, then fade it in
      requestAnimationFrame(() => requestAnimationFrame(() => setSwapping(false)));
    }, 190);
  };

  // ask from within the open chat panel (composer / empty-state chips)
  const ask = (text: string) => {
    const v = text.trim();
    if (!v || busy) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    streamAnswer(v);
  };

  const onBarClick = () => {
    if (mode === "collapsed") {
      setMode("expanded");
      setTimeout(() => setMode("active"), 180);
    } else if (mode === "expanded") {
      setMode("active");
    }
  };

  const onAiInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAiInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 90) + "px";
  };

  const onAiInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion(aiInput);
    }
  };

  const onComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 90) + "px";
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  };

  const sendDisabled = busy || input.trim().length === 0;
  const aiHasText = aiInput.trim().length > 0;
  // empty input + existing conversation → the button expands the dialog instead
  const aiCanExpand = !aiHasText && messages.length > 0;
  const aiSendDisabled = !aiHasText && !aiCanExpand;
  const empty = messages.length === 0;
  const overlayOpen = view !== "closed";

  // group messages into Q&A turns so each answer's rail aligns with its question
  const turns: { q: UserMsg; a: AiMsg | null; key: number }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user") {
      const next = messages[i + 1];
      turns.push({ q: m, a: next && next.role === "ai" ? next : null, key: i });
    }
  }

  return (
    <>
      {/* ai-mode input — collapsed / expanded / active */}
      {!overlayOpen && (
        <div
          className={"aimode " + mode + (entering ? " entering" : "") + (panelMounted ? " surface" : "")}
          ref={rootRef}
        >
          {panelMounted && (
            <div className={"aimode-reveal" + (panelIn ? " in" : "")}>
              <div className="aimode-reveal-inner">
                <div className="aimode-panel-head">
                  <span>Popular prompts</span>
                  <button className="aimode-x" aria-label="Close" onClick={() => setMode("expanded")}>
                    &times;
                  </button>
                </div>
                <div className="aimode-prompts">
                  <button
                    className="aimode-prompt"
                    onClick={() => submitQuestion(SUMMARIZE_PROMPT)}
                  >
                    {PARAGRAPH_ICON}
                    {SUMMARIZE_PROMPT}
                  </button>
                  {prompts.slice(0, 2).map((q) => (
                    <button key={q} className="aimode-prompt" onClick={() => submitQuestion(q)}>
                      {RETURN_ICON}
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="aimode-bar" onClick={onBarClick}>
            <span className="aimode-spark">{SPARK_ACCENT}</span>
            <span className="aimode-label">Ask AI</span>
            <textarea
              ref={aiInputRef}
              className="aimode-input"
              rows={1}
              placeholder="Ask AI…"
              value={aiInput}
              onChange={onAiInputChange}
              onKeyDown={onAiInputKeyDown}
            />
            <button
              className="aimode-send"
              type="button"
              aria-label={aiCanExpand ? "Expand conversation" : "Send"}
              disabled={aiSendDisabled}
              onClick={(e) => {
                e.stopPropagation();
                if (aiHasText) {
                  submitQuestion(aiInput);
                } else if (messages.length > 0) {
                  dropActive();
                  setView("panel");
                }
              }}
            >
              {aiCanExpand ? EXPAND_ICON : UP_ARROW_ICON}
            </button>
          </div>
        </div>
      )}

      <div className={"scrim" + (overlayOpen ? " show" : "")} onClick={closeOverlay} />

      <div
        className={"consent-wrap" + (overlayOpen ? " show" : "")}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeOverlay();
        }}
      >
        <div
          className={"consent" + (view === "panel" ? " chat" : "")}
          style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
          onTouchStart={(e) => {
            if (wide) return;
            dragStart.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            if (wide || dragStart.current == null) return;
            const dy = e.touches[0].clientY - dragStart.current;
            // drag only downward, and only when the scroll area is at the top
            const atTop = !threadRef.current || threadRef.current.scrollTop <= 0;
            if (dy > 0 && atTop) setDragY(dy);
          }}
          onTouchEnd={() => {
            if (wide) return;
            if (dragY > 110) closeOverlay();
            setDragY(0);
            dragStart.current = null;
          }}
        >
          <button className="consent-min" aria-label="Minimize" onClick={minimizeOverlay}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <div
            className={"consent-inner" + (view === "panel" ? " chat" : "")}
            style={{ opacity: swapping ? 0 : 1 }}
          >
          {view === "consent" ? (
            <>
              <div className="consent-body">
                <h2>Before you ask Nova</h2>
                <p>
                  By clicking &quot;Accept,&quot; you consent to your questions being processed by
                  our AI assistant, as described in the <a href="#">Nova AI documentation</a>.
                  Northline won&apos;t use this conversation to train external models.
                </p>
                <div className="consent-actions">
                  <button className="btn primary" onClick={accept}>Accept</button>
                  <button className="cancel" onClick={closeOverlay}>Cancel</button>
                </div>
              </div>
              <div className="genai-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Nova is generative AI and can produce inaccurate responses.
              </div>
            </>
          ) : (
            <>
              <div className="panel-head">
                <div className="who">
                  Ask Nova<small>Northline&apos;s AI assistant</small>
                </div>
                <div className="sp" />
              </div>
              <div className="panel-body" ref={threadRef}>
                {empty && (
                  <div className="empty-state">
                    <div className="dot">{SPARK_ACCENT}</div>
                    <h3>Ask about Northline</h3>
                    <p>Nova retrieves relevant docs and answers with citations, in real time.</p>
                    <div className="chip-row">
                      {prompts.map((q) => (
                        <button key={q} className="chip" onClick={() => ask(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {turns.map((t, ti) => (
                  <Fragment key={t.key}>
                    {ti > 0 && <div className="convo-sep" />}
                    <div className="turn">
                      <div className="turn-main">
                        <div className="turn-head">
                          <span className="turn-head-spark">{SPARK_ACCENT}</span>
                          AI response
                        </div>
                        <div className="msg user">
                          <div className="bubble">{t.q.text}</div>
                        </div>
                        {t.a && (
                          <div className="msg ai">
                            <div className="bubble">
                              <span className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(t.a.text) }} />
                              {!t.a.done && !t.a.error && <span className="caret" />}
                              {t.a.error && <p className="error-text">{t.a.error}</p>}
                              {t.a.done && !t.a.error && <MessageActions msg={t.a} />}
                            </div>
                          </div>
                        )}
                      </div>
                      {wide && t.a && <AnswerRail msg={t.a} />}
                    </div>
                  </Fragment>
                ))}
              </div>
              <div className="composer">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(input);
                  }}
                >
                  <textarea
                    ref={inputRef}
                    rows={1}
                    placeholder="Ask Nova a question…"
                    value={input}
                    onChange={onComposerChange}
                    onKeyDown={onComposerKeyDown}
                  />
                  <button className="send-btn" type="submit" disabled={sendDisabled} aria-label="Send">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </form>
                <div className="disclaimer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Nova uses generative AI, which can produce inaccurate responses.
                </div>
              </div>
            </>
          )}
          </div>
        </div>
        <button className="consent-close" aria-label="Close" onClick={closeOverlay}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </>
  );
}
