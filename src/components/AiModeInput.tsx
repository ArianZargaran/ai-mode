"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Source = { title: string; url: string; score: number };
type Meta = { sources: Source[]; confident: boolean; cta: boolean; fallback: boolean };
type AiMsg = { role: "ai"; text: string; done: boolean; error?: string; meta?: Meta };
type UserMsg = { role: "user"; text: string };
type Msg = UserMsg | AiMsg;
type Mode = "collapsed" | "expanded" | "active";

// white sparkle for use on gradient / dark avatars inside the chat panel
const SPARK = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" fill="white" />
  </svg>
);

// accent (currentColor) sparkle for the ai-mode input bar
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
function inline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M7 11v9H4v-9h3zm3.6 9c-.9 0-1.6-.7-1.6-1.6V11l4-7 1 .4c.4.2.6.6.6 1v3.6H19c1 0 1.8.9 1.6 1.9l-1.2 6c-.2.9-1 1.6-1.9 1.6h-6.9z" fill="currentColor" />
          </svg>
        </button>
        <button
          className={"down" + (vote === "down" ? " active" : "")}
          title="Poor response"
          onClick={() => setVote((v) => (v === "down" ? null : "down"))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M17 13V4h3v9h-3zm-3.6-9c.9 0 1.6.7 1.6 1.6V13l-4 7-1-.4c-.4-.2-.6-.6-.6-1v-3.6H5c-1 0-1.8-.9-1.6-1.9l1.2-6c.2-.9 1-1.6 1.9-1.6h6.9z" fill="currentColor" />
          </svg>
        </button>
        <button className="copy" title="Copy" onClick={copy}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5 15V6a1 1 0 0 1 1-1h9" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <span className="copied" hidden={!copied}>Copied</span>
      </div>
      {msg.meta?.fallback && (
        <div className="fallback-card">
          <p className="title">Not quite what you needed?</p>
          <p className="body">Connect with our sales team for a walkthrough tailored to your setup.</p>
          <a href="#">Contact sales &rarr;</a>
        </div>
      )}
    </>
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
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [wide, setWide] = useState(false);

  // prompts follow the page the persistent widget is currently on
  const pathname = usePathname();
  const prompts = PROMPTS_BY_ROUTE[pathname] ?? DEFAULT_PROMPTS;

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
          body: JSON.stringify({ message: question }),
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

  // Submit a question: route through the consent gate the first time, then chat.
  const submitQuestion = (text: string) => {
    const v = text.trim();
    if (!v) return;
    setAiInput("");
    setMode("collapsed");
    if (consented) {
      setView("panel");
      streamAnswer(v);
    } else {
      setPending(v);
      setView("consent");
    }
  };

  const accept = () => {
    setConsented(true);
    const q = pending;
    setPending("");
    setView("panel");
    if (q) streamAnswer(q);
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

  const lastMeta = [...messages].reverse().find((m): m is AiMsg => m.role === "ai" && !!m.meta?.sources.length)?.meta;
  const showRail = wide && !!lastMeta;
  const sendDisabled = busy || input.trim().length === 0;
  const aiSendDisabled = aiInput.trim().length === 0;
  const empty = messages.length === 0;
  const overlayOpen = view !== "closed";

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
                  {prompts.map((q) => (
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
              aria-label="Send"
              disabled={aiSendDisabled}
              onClick={(e) => {
                e.stopPropagation();
                submitQuestion(aiInput);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className={"scrim" + (overlayOpen ? " show" : "")} onClick={closeOverlay} />

      <div className={"consent" + (view === "consent" ? " show" : "")}>
        <button className="x" aria-label="Close" onClick={closeOverlay}>
          &times;
        </button>
        <div className="icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M12 2l2.2 6.4L21 10.6l-6.8 2.2L12 19l-2.2-6.2L3 10.6l6.8-2.2L12 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
        <h2>Before you ask Nova</h2>
        <p>
          By clicking &quot;Accept,&quot; you consent to your questions being processed by our AI
          assistant, as described in the <a href="#">Nova AI documentation</a>. Northline won&apos;t
          use this conversation to train external models.
        </p>
        <div className="consent-actions">
          <button className="btn" onClick={closeOverlay}>Cancel</button>
          <button className="btn primary" onClick={accept}>Accept</button>
        </div>
        <div className="genai-note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Nova is generative AI and can produce inaccurate responses.
        </div>
      </div>

      <div className={"panel" + (view === "panel" ? " show" : "")}>
        <div className="panel-head">
          <span className="dot">{SPARK}</span>
          <div className="who">
            Ask Nova<small>Northline&apos;s AI assistant</small>
          </div>
          <div className="sp" />
          <button className="icon-btn" aria-label="Close" onClick={closeOverlay}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={"panel-body" + (showRail ? "" : " no-rail")}>
          <div className="thread" ref={threadRef}>
            {empty && (
              <div className="empty-state">
                <div className="dot">{SPARK}</div>
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

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div className="msg user" key={i}>
                  <div className="avatar">You</div>
                  <div className="bubble">{m.text}</div>
                </div>
              ) : (
                <div className="msg ai" key={i}>
                  <div className="avatar">{SPARK}</div>
                  <div className="bubble">
                    <span className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
                    {!m.done && !m.error && <span className="caret" />}
                    {m.error && <p className="error-text">{m.error}</p>}
                    {m.done && !m.error && <MessageActions msg={m} />}
                  </div>
                </div>
              )
            )}
          </div>

          {showRail && lastMeta && (
            <div className="rail">
              {lastMeta.cta && (
                <div>
                  <h5>Quick actions</h5>
                  <a className="quick-cta" href="#">Get started &rarr;</a>
                </div>
              )}
              <div>
                <h5>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Relevant pages
                </h5>
                <div className="src-list">
                  {lastMeta.sources.map((s, i) => (
                    <a className="src" href="#" key={i}>
                      <div className="t">{s.title}</div>
                      <div className="d">
                        <span>{s.url}</span>
                        <span className="score">{s.score.toFixed(2)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
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
                <path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      </div>
    </>
  );
}
